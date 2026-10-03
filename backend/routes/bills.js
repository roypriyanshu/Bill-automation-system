import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as excelService from '../services/excelService.js';
import { extractBillWithAI } from '../services/aiService.js';
import { determineBillStatus } from '../services/validationService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration for scanned bill invoices
const billStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitizedName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${uuidv4().substring(0, 8)}_${sanitizedName}${ext}`);
  }
});

const billUpload = multer({
  storage: billStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpe?g|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF, JPG, PNG files (up to 10MB) are accepted.'));
    }
  }
});

// Multer in-memory storage for Master Excel uploads (.xlsx only)
const masterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const isXlsxExt = /\.xlsx$/i.test(file.originalname);
    const isXlsxMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
      'application/zip'
    ].includes(file.mimetype);

    if (isXlsxExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Please upload a standard Excel workbook (.xlsx file).'));
    }
  }
});

// -------------------------------------------------------------
// Master Excel Management Routes
// -------------------------------------------------------------

/**
 * POST /api/bills/master/upload
 * Upload or replace the persistent server-side Master Excel workbook
 */
router.post('/master/upload', masterUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file provided. Please select an .xlsx file.' });
    }

    console.log(`[MasterUpload] Received Master Excel workbook: ${req.file.originalname} (${req.file.size} bytes)`);

    const metadata = await excelService.uploadMasterWorkbook(req.file.buffer, req.file.originalname);

    res.json({
      success: true,
      message: 'Master Excel workbook activated successfully!',
      masterInfo: metadata
    });
  } catch (err) {
    console.error('[Error in Master Excel upload]:', err);
    res.status(400).json({
      error: err.message || 'Failed to process and activate Master Excel file.'
    });
  }
});

/**
 * GET /api/bills/master/info & GET /api/bills/master-info
 * Get active Master Excel workbook metadata and status
 */
const handleMasterInfo = (req, res) => {
  try {
    const info = excelService.getMasterFileInfo();
    res.json(info);
  } catch (err) {
    console.error('[Error getting master Excel info]:', err);
    res.status(500).json({ error: 'Failed to retrieve master Excel info' });
  }
};

router.get('/master/info', handleMasterInfo);
router.get('/master-info', handleMasterInfo);

/**
 * GET /api/bills/master/download & GET /api/bills/export/excel
 * Download the current active Master Excel workbook
 */
const handleMasterDownload = async (req, res) => {
  try {
    if (!excelService.hasActiveMaster()) {
      return res.status(404).json({
        error: 'No active Master Excel file exists. Please upload a Master Excel workbook first.'
      });
    }

    const info = excelService.getMasterFileInfo();
    const downloadFilename = info.fileName || 'Bills_Master_Database.xlsx';
    const buffer = await excelService.getExcelFileBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Error downloading Master Excel]:', err);
    res.status(500).json({ error: err.message || 'Failed to download Master Excel workbook' });
  }
};

router.get('/master/download', handleMasterDownload);
router.get('/export/excel', handleMasterDownload);

/**
 * POST /api/bills/open-excel
 * Launch and open the live Master Excel file in Microsoft Excel
 */
router.post('/open-excel', async (req, res) => {
  try {
    const result = await excelService.openMasterExcel();
    res.json({
      success: true,
      message: 'Master Excel opened successfully in Microsoft Excel',
      ...result
    });
  } catch (err) {
    console.error('[Error opening Excel]:', err);
    res.status(500).json({ error: err.message || 'Failed to open Excel file' });
  }
});

/**
 * POST /api/bills/open-folder
 * Open containing folder in Windows Explorer with the active Master Excel file selected
 */
router.post('/open-folder', async (req, res) => {
  try {
    const result = await excelService.openMasterFolder();
    res.json({
      success: true,
      message: 'Containing folder opened in Explorer',
      ...result
    });
  } catch (err) {
    console.error('[Error opening folder]:', err);
    res.status(500).json({ error: err.message || 'Failed to open folder' });
  }
});

// -------------------------------------------------------------
// Bill Processing & CRUD Routes
// -------------------------------------------------------------

/**
 * POST /api/bills/ocr
 * Ingest bill scan file, save to uploads, run AI / PaddleOCR extraction
 */
router.post('/ocr', billUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const rawFilePath = `/uploads/${req.file.filename}`;

    console.log(`[Ingest] Processing AI / OCR on: ${req.file.filename}`);
    const ocrResult = await extractBillWithAI(filePath);

    // Initial validation
    const statusEvaluation = await determineBillStatus({
      party_name: ocrResult.party_name || '',
      invoice_number: ocrResult.invoice_number,
      invoice_date: ocrResult.invoice_date,
      bill_value: ocrResult.bill_value
    });

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        raw_file_path: rawFilePath
      },
      extracted: {
        contractor_name: ocrResult.contractor_name || '',
        invoice_number: ocrResult.invoice_number || '',
        invoice_date: ocrResult.invoice_date || '',
        bill_value: ocrResult.bill_value || '',
        suggested_party: ocrResult.party_name || '',
        raw_text: ocrResult.raw_text || []
      },
      evaluation: statusEvaluation,
      hasActiveMaster: excelService.hasActiveMaster()
    });
  } catch (err) {
    console.error('[Error in OCR upload]:', err);
    res.status(500).json({ error: err.message || 'Failed to process OCR' });
  }
});

/**
 * POST /api/bills
 * Save verified bill record to Master Excel database & AuditLog
 */
router.post('/', async (req, res) => {
  try {
    if (!excelService.hasActiveMaster()) {
      return res.status(400).json({
        error: 'No active Master Excel workbook configured. Please upload a Master Excel file first.'
      });
    }

    const {
      contractor_name,
      party_name,
      po_number,
      wo_number,
      po_date,
      invoice_number,
      invoice_date,
      bill_value,
      bill_received_date_site,
      bill_received_date_back_office,
      bill_received_by_accounts,
      payment_details,
      handover_to,
      remarks,
      raw_file_path
    } = req.body;

    // Validate required fields
    if (!party_name || !invoice_number || !invoice_date || !bill_value) {
      return res.status(400).json({ error: 'Party Name, Invoice Number, Invoice Date, and Bill Value are required.' });
    }

    // Determine status (duplicate or needs_review or validated)
    const evaluation = await determineBillStatus({
      party_name,
      invoice_number,
      invoice_date,
      bill_value
    });

    const billData = {
      id: uuidv4(),
      contractor_name: contractor_name ? contractor_name.trim() : '',
      party_name: party_name.trim(),
      po_number: po_number ? po_number.trim() : 'NA',
      wo_number: wo_number ? wo_number.trim() : 'NA',
      po_date: po_date ? po_date.trim() : 'NA',
      invoice_number: invoice_number.trim(),
      invoice_date: invoice_date.trim(),
      bill_value: bill_value.toString().trim(),
      bill_received_date_site: bill_received_date_site || '',
      bill_received_date_back_office: bill_received_date_back_office || '',
      bill_received_by_accounts: bill_received_by_accounts || '',
      payment_details: payment_details || '',
      handover_to: handover_to || '',
      remarks: remarks || '',
      status: evaluation.status,
      raw_file_path: raw_file_path || ''
    };

    const createdBill = await excelService.addBill(billData);
    res.status(201).json({ success: true, bill: createdBill, evaluation });
  } catch (err) {
    console.error('[Error creating bill]:', err);
    res.status(500).json({ error: err.message || 'Failed to save bill' });
  }
});

/**
 * GET /api/bills
 * List all bills with sorting, filtering, and pagination
 */
router.get('/', async (req, res) => {
  try {
    let bills = await excelService.getAllBills();

    const {
      status,
      party,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      needs_review_only
    } = req.query;

    // Collect list of distinct parties for filter dropdown
    const distinctParties = Array.from(new Set(bills.map((b) => b.party_name).filter(Boolean))).sort();

    // Filter by needs_review_only flag
    if (needs_review_only === 'true') {
      bills = bills.filter((b) => b.status === 'needs_review' || b.status === 'duplicate');
    }

    // Filter by status
    if (status && status !== 'all') {
      bills = bills.filter((b) => b.status === status);
    }

    // Filter by party
    if (party && party !== 'all') {
      bills = bills.filter((b) => (b.party_name || '').toLowerCase() === party.toLowerCase());
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase();
      bills = bills.filter((b) =>
        (b.party_name && b.party_name.toLowerCase().includes(q)) ||
        (b.invoice_number && b.invoice_number.toLowerCase().includes(q)) ||
        (b.po_number && b.po_number.toLowerCase().includes(q)) ||
        (b.wo_number && b.wo_number.toLowerCase().includes(q)) ||
        (b.remarks && b.remarks.toLowerCase().includes(q)) ||
        (b.id && b.id.toLowerCase().includes(q))
      );
    }

    // Sorting
    bills.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';

      if (sortBy === 'bill_value') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = bills.length;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(limit));
    const paginatedBills = bills.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    res.json({
      data: paginatedBills,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize) || 1
      },
      parties: distinctParties,
      hasActiveMaster: excelService.hasActiveMaster()
    });
  } catch (err) {
    console.error('[Error fetching bills]:', err);
    res.status(500).json({ error: 'Failed to retrieve bills' });
  }
});

/**
 * GET /api/bills/stats
 * Summary stats for dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const hasMaster = excelService.hasActiveMaster();
    const bills = await excelService.getAllBills();

    const stats = {
      hasActiveMaster: hasMaster,
      total: bills.length,
      validated: bills.filter((b) => b.status === 'validated').length,
      needs_review: bills.filter((b) => b.status === 'needs_review').length,
      duplicate: bills.filter((b) => b.status === 'duplicate').length,
      rejected: bills.filter((b) => b.status === 'rejected').length,
      pending: bills.filter((b) => b.status === 'pending').length,
      total_amount: bills.reduce((acc, b) => acc + (parseFloat(b.bill_value) || 0), 0),
      recent_bills: bills.slice(-5).reverse()
    };

    res.json(stats);
  } catch (err) {
    console.error('[Error getting stats]:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});

/**
 * GET /api/bills/:id
 * Retrieve bill details + audit logs
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await excelService.getBillById(id);
    if (!bill) {
      return res.status(404).json({ error: `Bill not found with ID ${id}` });
    }

    const auditLogs = await excelService.getAuditLogs(id);
    const evaluation = await determineBillStatus({
      party_name: bill.party_name,
      invoice_number: bill.invoice_number,
      invoice_date: bill.invoice_date,
      bill_value: bill.bill_value,
      status: bill.status,
      excludeId: id
    });

    res.json({
      bill,
      auditLogs,
      evaluation
    });
  } catch (err) {
    console.error('[Error getting bill]:', err);
    res.status(500).json({ error: 'Failed to retrieve bill' });
  }
});

/**
 * PUT /api/bills/:id
 * Update bill details
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingBill = await excelService.getBillById(id);
    if (!existingBill) {
      return res.status(404).json({ error: `Bill not found with ID ${id}` });
    }

    const updateFields = req.body;
    
    // Evaluate new status if party or invoice changed
    const party_name = updateFields.party_name !== undefined ? updateFields.party_name : existingBill.party_name;
    const invoice_number = updateFields.invoice_number !== undefined ? updateFields.invoice_number : existingBill.invoice_number;
    const invoice_date = updateFields.invoice_date !== undefined ? updateFields.invoice_date : existingBill.invoice_date;
    const bill_value = updateFields.bill_value !== undefined ? updateFields.bill_value : existingBill.bill_value;

    // Check duplicate
    const isDuplicate = await excelService.checkDuplicate(party_name, invoice_number, id);
    let newStatus = updateFields.status || existingBill.status;

    if (isDuplicate) {
      newStatus = 'duplicate';
    } else if (updateFields.status) {
      newStatus = updateFields.status;
    }

    const payload = {
      ...updateFields,
      status: newStatus
    };

    const actionText = updateFields._actionDescription || `Manual edit saved by user (Status: ${newStatus})`;
    delete payload._actionDescription;

    const updatedBill = await excelService.updateBill(id, payload, actionText);
    const auditLogs = await excelService.getAuditLogs(id);

    res.json({
      success: true,
      bill: updatedBill,
      auditLogs,
      isDuplicate
    });
  } catch (err) {
    console.error('[Error updating bill]:', err);
    res.status(500).json({ error: err.message || 'Failed to update bill' });
  }
});

/**
 * POST /api/bills/:id/status
 * Quick action to update status
 */
router.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks = '' } = req.body;

    if (!['validated', 'rejected', 'needs_review', 'duplicate', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const existingBill = await excelService.getBillById(id);
    if (!existingBill) {
      return res.status(404).json({ error: `Bill not found with ID ${id}` });
    }

    const updatePayload = {
      status,
      remarks: remarks ? `${existingBill.remarks ? existingBill.remarks + ' | ' : ''}${remarks}` : existingBill.remarks
    };

    const actionText = `Status updated to '${status}'${remarks ? `. Note: ${remarks}` : ''}`;
    const updatedBill = await excelService.updateBill(id, updatePayload, actionText);
    const auditLogs = await excelService.getAuditLogs(id);

    res.json({
      success: true,
      bill: updatedBill,
      auditLogs
    });
  } catch (err) {
    console.error('[Error updating status]:', err);
    res.status(500).json({ error: err.message || 'Failed to update bill status' });
  }
});

/**
 * DELETE /api/bills/:id
 * Permanently delete a bill from the Master Excel database
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingBill = await excelService.getBillById(id);
    if (!existingBill) {
      return res.status(404).json({ error: `Bill not found with ID ${id}` });
    }

    // Attempt to delete raw scan file if it exists in uploads/
    if (existingBill.raw_file_path && existingBill.raw_file_path.startsWith('/uploads/')) {
      const filename = path.basename(existingBill.raw_file_path);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn(`[DeleteBill] Could not delete physical file ${filePath}:`, e.message);
        }
      }
    }

    const result = await excelService.deleteBill(id);
    res.json({
      success: true,
      message: `Bill record ${id} deleted successfully.`,
      deletedBill: result.deletedBill
    });
  } catch (err) {
    console.error('[Error deleting bill]:', err);
    res.status(500).json({ error: err.message || 'Failed to delete bill' });
  }
});

export default router;
