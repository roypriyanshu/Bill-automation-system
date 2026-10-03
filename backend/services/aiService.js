import fs from 'fs';
import path from 'path';
import { processBillOCR } from './ocrService.js';

/**
 * Enhanced AI Extraction Service
 * Uses Multimodal LLM (Gemini 1.5 Flash / 2.0 Flash) when GEMINI_API_KEY is present,
 * with seamless fallback to PaddleOCR + Regex heuristics.
 */
export async function extractBillWithAI(filePath) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  // 1. If Gemini API Key is configured, use Multimodal LLM
  if (apiKey) {
    try {
      console.log('[AI Service] Processing bill with Gemini Multimodal LLM...');
      const llmResult = await callGeminiVision(filePath, apiKey);
      if (llmResult && (llmResult.invoice_number || llmResult.bill_value || llmResult.contractor_name)) {
        return llmResult;
      }
    } catch (err) {
      console.warn('[AI Service] Gemini LLM failed, falling back to PaddleOCR:', err.message);
    }
  }

  // 2. Fallback / Local extraction via PaddleOCR + Heuristics
  console.log('[AI Service] Running PaddleOCR engine...');
  const ocrResult = await processBillOCR(filePath);

  // Extract contractor/vendor name from OCR text if not present
  const contractorName = extractContractorFromOCR(ocrResult.raw_text || []);

  return {
    contractor_name: contractorName.name,
    contractor_name_confidence: contractorName.confidence,
    invoice_number: ocrResult.invoice_number || '',
    invoice_number_confidence: ocrResult.invoice_number_confidence || 0,
    invoice_date: ocrResult.invoice_date || '',
    invoice_date_confidence: ocrResult.invoice_date_confidence || 0,
    bill_value: ocrResult.bill_value || '',
    bill_value_confidence: ocrResult.bill_value_confidence || 0,
    party_name: '',
    raw_text: ocrResult.raw_text || []
  };
}

/**
 * Call Gemini Multimodal API with image/PDF
 */
async function callGeminiVision(filePath, apiKey) {
  const ext = path.extname(filePath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.pdf') mimeType = 'application/pdf';
  else if (ext === '.webp') mimeType = 'image/webp';

  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');

  const systemInstruction = `You are an expert commercial invoice & contractor bill data extraction system.
Carefully inspect the uploaded bill scan/photo.
Extract the following information:
1. "contractor_name": (The company, contractor, vendor, supplier, or agency WHO ISSUED THE BILL / DID THE WORK - e.g. "M/s Sharma Electricals", "Apex Industrial Supplies Pvt Ltd", "Contractor: Raju Buildcon").
2. "receiving_party": (The internal company, branch, site office, or department WHO RECEIVED THE BILL in "Billed To" / "Consignee" - e.g. "Site Office - Mumbai North").
3. "invoice_number": (The invoice number, bill number, reference number, memo number, e.g. "INV-2024-8841", "REF/24/099", "BILL-102").
4. "invoice_date": (Date of the bill/invoice in YYYY-MM-DD or DD/MM/YYYY format).
5. "bill_value": (The final total payable amount as a float/number string, e.g. "48250.00").
6. "po_number": (Purchase Order number if mentioned on the bill, otherwise empty string "").
7. "wo_number": (Work Order number if mentioned on the bill, otherwise empty string "").

Return ONLY valid JSON with this exact structure:
{
  "contractor_name": string,
  "contractor_name_confidence": number (0-100),
  "invoice_number": string,
  "invoice_number_confidence": number (0-100),
  "invoice_date": string,
  "invoice_date_confidence": number (0-100),
  "bill_value": string,
  "bill_value_confidence": number (0-100),
  "po_number": string,
  "wo_number": string,
  "receiving_party": string,
  "raw_summary": string
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          },
          { text: "Extract all key bill metadata now in the specified JSON format." }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1
    }
  };

  const models = ['gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'];
  let lastError = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Gemini API [${model}] (${response.status}): ${errorText}`);
        continue;
      }

      const jsonResponse = await response.json();
      const textOutput = jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) continue;

      const parsed = JSON.parse(textOutput);
      return {
        contractor_name: parsed.contractor_name || '',
        contractor_name_confidence: Number(parsed.contractor_name_confidence || 95),
        invoice_number: parsed.invoice_number || '',
        invoice_number_confidence: Number(parsed.invoice_number_confidence || 95),
        invoice_date: parsed.invoice_date || '',
        invoice_date_confidence: Number(parsed.invoice_date_confidence || 95),
        bill_value: parsed.bill_value || '',
        bill_value_confidence: Number(parsed.bill_value_confidence || 95),
        po_number: parsed.po_number || '',
        wo_number: parsed.wo_number || '',
        party_name: parsed.receiving_party || '',
        raw_text: [parsed.raw_summary || '']
      };
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All Gemini model endpoints failed');
}

/**
 * Helper to extract Contractor / Vendor from raw OCR lines using pattern anchors
 */
function extractContractorFromOCR(lines) {
  if (!lines || lines.length === 0) {
    return { name: '', confidence: 0 };
  }

  const contractorPatterns = [
    /^(?:name\s*of\s*contractor|contractor\s*name|contractor|vendor\s*name|vendor|supplier\s*name|supplier|agency)[:\s.-]+([A-Za-z0-9\s.,&'-]{3,60})/i,
    /^(?:m\/s\.?|messrs\.?)\s+([A-Za-z0-9\s.,&'-]{3,60})/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const pat of contractorPatterns) {
      const match = line.match(pat);
      if (match && match[1]) {
        return { name: match[1].trim(), confidence: 88.0 };
      }
    }
  }

  // If not explicitly labeled, check top 1-3 lines for company title
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    if (
      line.length >= 4 &&
      !line.match(/tax\s*invoice|bill\s*of\s*supply|cash\s*memo|receipt|original/i) &&
      line.match(/pvt|ltd|limited|enterprises|supplies|contractors|services|corporation|industries|works|co\./i)
    ) {
      return { name: line, confidence: 84.0 };
    }
  }

  return { name: '', confidence: 0 };
}
