import sys
import os
import json
import re
import numpy as np

# Suppress Paddle debug logs
os.environ['GLOG_minloglevel'] = '2'
os.environ['FLAGS_fraction_of_gpu_memory_to_use'] = '0'

def preprocess_image(img_path):
    """
    Enhanced preprocessing for physical bills (scans/photos):
    Auto-rotate, deskew, contrast adjustment, and shadow removal.
    """
    import cv2

    # Check if PDF
    if img_path.lower().endswith('.pdf'):
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(img_path)
            page = pdf[0]
            bitmap = page.render(scale=2.0) # High-res rendering
            pil_image = bitmap.to_pil()
            temp_img_path = img_path + "_converted.png"
            pil_image.save(temp_img_path)
            img = cv2.imread(temp_img_path)
        except Exception as e:
            print(f"Error converting PDF: {e}", file=sys.stderr)
            img = cv2.imread(img_path)
    else:
        img = cv2.imread(img_path)

    if img is None:
        raise ValueError(f"Unable to read image at: {img_path}")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Shadow removal / Illumination correction using morphological opening
    dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
    bg_img = cv2.medianBlur(dilated, 21)
    diff_img = 255 - cv2.absdiff(gray, bg_img)
    norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)

    # 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(norm_img)

    # 3. Deskewing
    coords = np.column_stack(np.where(enhanced < 200))
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle

        # If significant skew detected (between 0.5 and 45 degrees)
        if abs(angle) > 0.5 and abs(angle) < 45:
            (h, w) = enhanced.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            enhanced = cv2.warpAffine(enhanced, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    # Save preprocessed image for OCR
    preprocessed_path = img_path + "_preprocessed.png"
    cv2.imwrite(preprocessed_path, enhanced)
    return preprocessed_path

def parse_extracted_data(ocr_results):
    """
    Extract:
    - Invoice Number
    - Invoice Date
    - Bill Value
    Along with per-field confidence scores (0-100%).
    """
    extracted = {
        "invoice_number": "",
        "invoice_number_confidence": 0.0,
        "invoice_date": "",
        "invoice_date_confidence": 0.0,
        "bill_value": "",
        "bill_value_confidence": 0.0,
        "raw_text": []
    }

    if not ocr_results:
        return extracted

    items = []
    # Normalize OCR results structure
    for res in ocr_results:
        if isinstance(res, list):
            for line in res:
                if line and len(line) >= 2:
                    bbox, text_tuple = line[0], line[1]
                    text, conf = str(text_tuple[0]).strip(), float(text_tuple[1])
                    items.append({"text": text, "conf": conf * 100.0, "bbox": bbox})
        elif isinstance(res, dict) and 'text' in res:
            items.append(res)

    extracted["raw_text"] = [i["text"] for i in items]

    # Regex patterns for Invoice / Bill / Reference Number
    inv_num_patterns = [
        # Explicit labels (e.g. Reference No:, Ref. No., Bill No., Invoice No., Cash Memo No., Doc No., Challan No:)
        r'(?:tax\s*invoice|retail\s*invoice|commercial\s*invoice|proforma\s*invoice|tax\s*bill)?\s*(?:invoice|inv|bill|ref(?:erence)?|memo|voucher|receipt|challan|doc(?:ument)?)\s*(?:[.\/-]?\s*(?:no\.?|num(?:ber)?|#|\.))\s*[:.\s-]*\s*([A-Za-z0-9\/-]{2,35})',
        
        # Concatenated words without space (e.g. InvoiceNoINV-123, BillNo8841, RefNo/991)
        r'(?:invoice|inv|bill|ref(?:erence)?|memo|voucher|receipt)(?:no|num|number|#)[:\s.-]*([A-Za-z0-9\/-]{2,35})',
        
        # Standalone hash or prefix like INV/2024/001 or REF-2024-01
        r'(?:inv|invoice|bill|ref)[\s\/:#-]+([A-Za-z0-9\/-]{3,25})',
        r'#\s*([A-Za-z0-9\/-]{3,25})'
    ]

    forbidden_values = {
        'date', 'total', 'amount', 'rs', 'inr', 'of', 'supply', 'bill', 'invoice',
        'reference', 'memo', 'tax', 'cash', 'credit', 'debit', 'original', 'duplicate',
        'triplicate', 'buyer', 'seller', 'party', 'gstin', 'pan', 'state', 'code', 'no',
        'suppl', 'billof', 'taxinvoice', 'billed', 'terms'
    }

    # 1. Scan for Invoice / Bill / Reference Number
    for i, item in enumerate(items):
        text = item["text"]
        # Skip title lines like "TAX INVOICE / BILL OF SUPPLY", "TAXINVOICE/BILLOF"
        if re.search(r'tax\s*invoice|bill\s*of\s*supply|taxinvoice|billof\s*suppl', text, re.I):
            continue

        for pat in inv_num_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val = m.group(1).strip()
                # Clean up if matched forbidden keyword or has no alphanumeric code
                if len(val) >= 2 and val.lower() not in forbidden_values:
                    # Prefer values with digits or standard code pattern
                    extracted["invoice_number"] = val
                    extracted["invoice_number_confidence"] = round(item["conf"], 1)
                    break
        if extracted["invoice_number"]:
            break

    # If not found inline, check adjacent line (e.g. Line 1: 'Reference No.', Line 2: 'REF-98421')
    if not extracted["invoice_number"]:
        adjacent_label_pattern = r'^(?:(?:tax\s*)?invoice|inv|bill|ref(?:erence)?|memo|receipt|voucher|doc(?:ument)?|challan)\s*(?:[.\/-]?\s*(?:no\.?|num(?:ber)?|#|\.))?[:.\s-]*$'
        for i, item in enumerate(items):
            if re.search(adjacent_label_pattern, item["text"], re.I) and i + 1 < len(items):
                next_val = items[i+1]["text"].strip()
                if len(next_val) >= 2 and next_val.lower() not in forbidden_values:
                    extracted["invoice_number"] = next_val
                    extracted["invoice_number_confidence"] = round((item["conf"] + items[i+1]["conf"]) / 2, 1)
                    break

    # 2. Scan for Invoice Date
    date_patterns = [
        r'(?:invoice\s*date|bill\s*date|date\s*of\s*issue|dated|date)[:\s.-]*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})',
        r'(?:invoice\s*date|bill\s*date|date\s*of\s*issue|dated|date)[:\s.-]*(\d{1,2}[-\/\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/\s]+\d{2,4})',
        r'(\d{1,2}[-\/\.](?:0[1-9]|1[0-2])[-\/\.](?:19|20)\d{2})',
        r'((?:19|20)\d{2}[-\/\.](?:0[1-9]|1[0-2])[-\/\.]\d{1,2})',
        r'(\d{1,2}[-\/\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/\s]+(?:19|20)\d{2})'
    ]

    for i, item in enumerate(items):
        text = item["text"]
        for pat in date_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                extracted["invoice_date"] = m.group(1).strip()
                extracted["invoice_date_confidence"] = round(item["conf"], 1)
                break
        if extracted["invoice_date"]:
            break

    # 3. Scan for Bill Value
    amount_patterns = [
        r'(?:grand\s*total|total\s*amount|bill\s*value|total\s*payable|net\s*amount|amount\s*payable|invoice\s*total|total\s*value|balance\s*due)[:\s₹Rs\.\$]*([0-9,]+(?:\.\d{1,2})?)',
        r'(?:total)[:\s₹Rs\.\$]*([0-9,]+(?:\.\d{2}))',
        r'(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.\d{1,2})?)'
    ]
    amount_candidates = []
    for i, item in enumerate(items):
        text = item["text"]
        for pat in amount_patterns:
            matches = re.finditer(pat, text, re.IGNORECASE)
            for m in matches:
                clean_num_str = m.group(1).replace(',', '').strip()
                try:
                    num_val = float(clean_num_str)
                    if 0.1 <= num_val <= 100000000:
                        amount_candidates.append({
                            "value": f"{num_val:.2f}",
                            "conf": item["conf"],
                            "text": text,
                            "index": i
                        })
                except ValueError:
                    pass

    if amount_candidates:
        best_candidate = amount_candidates[-1]
        for cand in reversed(amount_candidates):
            if re.search(r'grand\s*total|total\s*payable|net\s*amount', cand["text"], re.I):
                best_candidate = cand
                break
        extracted["bill_value"] = best_candidate["value"]
        extracted["bill_value_confidence"] = round(best_candidate["conf"], 1)

    return extracted

def run_ocr(file_path):
    if not os.path.exists(file_path):
        return {"error": f"File does not exist: {file_path}"}

    preprocessed_path = file_path
    try:
        preprocessed_path = preprocess_image(file_path)
    except Exception as e:
        print(f"Warning: Preprocessing failed, using original: {e}", file=sys.stderr)
        preprocessed_path = file_path

    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        result = ocr.ocr(preprocessed_path, cls=True)
        extracted = parse_extracted_data(result)
        return extracted
    except Exception as e:
        print(f"PaddleOCR error: {e}", file=sys.stderr)
        return {
            "invoice_number": "",
            "invoice_number_confidence": 0.0,
            "invoice_date": "",
            "invoice_date_confidence": 0.0,
            "bill_value": "",
            "bill_value_confidence": 0.0,
            "raw_text": [],
            "warning": str(e)
        }
    finally:
        if preprocessed_path != file_path and os.path.exists(preprocessed_path):
            try:
                os.remove(preprocessed_path)
            except:
                pass
        converted_pdf_png = file_path + "_converted.png"
        if os.path.exists(converted_pdf_png):
            try:
                os.remove(converted_pdf_png)
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "File path argument required"}))
        sys.exit(1)

    target_file = sys.argv[1]
    result = run_ocr(target_file)
    print(json.dumps(result))
