import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OCR_SCRIPT_PATH = path.join(__dirname, '..', 'python', 'ocr_engine.py');

/**
 * Execute Python OCR Engine on uploaded bill file
 */
export async function processBillOCR(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found for OCR: ${filePath}`));
    }

    const pythonProcess = spawn('python', [OCR_SCRIPT_PATH, filePath], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (stderrData) {
        console.warn(`[OCR Engine Stderr]: ${stderrData}`);
      }

      try {
        // Find JSON block in stdout
        const trimmed = stdoutData.trim();
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return resolve(parsed);
        } else {
          console.warn('[OCR Engine] No JSON matched, returning empty extraction object');
          return resolve({
            invoice_number: '',
            invoice_number_confidence: 0,
            invoice_date: '',
            invoice_date_confidence: 0,
            bill_value: '',
            bill_value_confidence: 0,
            raw_text: []
          });
        }
      } catch (err) {
        console.error('[OCR Engine JSON Parse Error]:', err, stdoutData);
        return resolve({
          invoice_number: '',
          invoice_number_confidence: 0,
          invoice_date: '',
          invoice_date_confidence: 0,
          bill_value: '',
          bill_value_confidence: 0,
          raw_text: []
        });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('[OCR Engine Process Error]:', err);
      reject(err);
    });
  });
}
