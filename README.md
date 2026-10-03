# Bill & Invoice Automation System

A production-grade internal operations web application for processing physical bill scans, receipts, and invoices with **PaddleOCR**, **OpenCV image preprocessing**, an **Express/Node.js** backend utilizing an **ExcelJS single-source database with atomic write-queue**, and a **React + Tailwind CSS** dashboard and split-view verification interface.

---

## Tech Stack & Architecture

- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Vite.
  - Desktop-first, corporate neutral design system (whites, slates, deep navy accents).
  - High-density operational data tables with sorting, filtering, and pagination.
  - Split-screen document inspection viewer (with interactive zoom, rotation, and reset).
- **Backend**: Node.js (Express) with REST endpoints.
- **Database**: Single Excel Workbook (`data/bills_database.xlsx`) with two sheets:
  - `Bills`: Complete master ledger of all processed bills and metadata.
  - `AuditLog`: Immutable chronological ledger recording all creation, verification, and manual edit actions.
  - **Write-Queue Engine**: In-memory sequential mutex queue that serializes all write operations to eliminate race conditions and Excel workbook corruption.
- **File Storage**: Local disk storage in `uploads/` folder referenced directly in Excel rows.
- **AI Extraction Engine**: Hybrid Multimodal LLM (Gemini Flash) + Local PaddleOCR engine:
  - Multimodal LLM reasoning distinguishes between **Contractor / Vendor Name (Sender)** and **Internal Receiving Party / Site (Billed To)**.
  - Automatic deskewing, orientation correction, and morphological illumination/shadow removal.
  - PDF rendering via high-resolution rasterization (`pypdfium2`).
  - Scoped field extraction: **Contractor / Vendor Name**, **Invoice / Bill / Reference Number**, **Invoice Date**, and **Bill Value** along with per-field confidence percentages (0-100%).

---

## Excel Database Schema

### Sheet 1: `Bills`
| Column | Type / Format | Description |
|---|---|---|
| `id` | UUID | Unique Bill identifier |
| `party_name` | String | Internal site/branch/department receiving the bill |
| `po_number` | String | Purchase Order Number (or "NA") |
| `wo_number` | String | Work Order Number (or "NA") |
| `po_date` | Date / "NA" | PO Date (or "NA") |
| `invoice_number` | String | Auto-extracted or user-edited Invoice # |
| `invoice_number_confidence` | Number (%) | PaddleOCR confidence score for Invoice # |
| `invoice_date` | String | Auto-extracted or user-edited Invoice Date |
| `invoice_date_confidence` | Number (%) | PaddleOCR confidence score for Date |
| `bill_value` | String / Float | Auto-extracted total payable amount |
| `bill_value_confidence` | Number (%) | PaddleOCR confidence score for Amount |
| `bill_received_date_site` | Date | Date bill was received at the site |
| `bill_received_date_back_office` | Date | Date bill was received at back office |
| `bill_received_by_accounts` | String | Accounts desk recipient |
| `payment_details` | String | Payment method / credit terms |
| `handover_to` | String | Staff recipient name |
| `remarks` | String | Operational remarks / notes |
| `status` | Enum | `validated` \| `needs_review` \| `duplicate` \| `rejected` \| `pending` |
| `raw_file_path` | String | Relative URL / disk reference to uploaded scan |
| `created_at` | ISO Timestamp | Initial ingestion timestamp |

### Sheet 2: `AuditLog`
| Column | Description |
|---|---|
| `id` | Unique Audit Log ID |
| `bill_id` | Foreign key referencing `Bills.id` |
| `action` | Description of operation (Created, Status Changed, Metadata Edited) |
| `timestamp` | ISO timestamp of the action |

---

## Validation Rules & Business Logic

1. **Confidence Threshold (< 80%)**:
   - If `invoice_number_confidence < 80` OR `invoice_date_confidence < 80` OR `bill_value_confidence < 80` -> Automatically marked as **`Needs Review`** and highlighted in amber across tables and split views.
2. **Automated Duplicate Detection**:
   - Matches `(party_name + invoice_number)` against existing non-rejected bills.
   - If matched -> Flagged as **`Duplicate`** (red/rose badge) and queued for review.
3. **NA Checkbox Rules**:
   - Strictly applies **only** to `po_number`, `wo_number`, and `po_date`.
   - Checking the NA box greys out the input and auto-sets the value to `"NA"`.
   - All other manual fields remain required standard inputs.

---

## Running the Application Locally

### 1. Backend Setup & Start
```bash
cd backend
npm install
node server.js
```
*Backend runs on `http://localhost:5000`*

### 2. Frontend Setup & Start
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`*

---

## Running Verification Tests
To run the automated write-queue concurrency & business logic test suite:
```bash
cd backend
node test_concurrency.js
```
