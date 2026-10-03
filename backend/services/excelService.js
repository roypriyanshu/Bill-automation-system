import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env if available
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');
const MASTER_DIR = path.join(DATA_DIR, 'master');
const ACTIVE_MASTER_FILE_PATH = path.join(MASTER_DIR, 'active_master.xlsx');
const MASTER_META_FILE_PATH = path.join(DATA_DIR, 'master_meta.json');

// Legacy fallback path if migrating an existing local file
const LEGACY_DB_PATH = path.join(DATA_DIR, 'bills_database.xlsx');

// Ensure necessary directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MASTER_DIR)) {
  fs.mkdirSync(MASTER_DIR, { recursive: true });
}

// Columns definition for Bills sheet (Clean 18 Business Columns)
export const BILLS_COLUMNS = [
  { header: 'ID', key: 'id', width: 36 },
  { header: 'Contractor / Vendor Name', key: 'contractor_name', width: 30 },
  { header: 'Party Name (Receiving Site)', key: 'party_name', width: 25 },
  { header: 'PO Number', key: 'po_number', width: 15 },
  { header: 'PO Date', key: 'po_date', width: 15 },
  { header: 'WO Number', key: 'wo_number', width: 15 },
  { header: 'Invoice Number', key: 'invoice_number', width: 20 },
  { header: 'Invoice Date', key: 'invoice_date', width: 15 },
  { header: 'Bill Value', key: 'bill_value', width: 18 },
  { header: 'Bill Received Date (Site)', key: 'bill_received_date_site', width: 24 },
  { header: 'Bill Received Date (Back Office)', key: 'bill_received_date_back_office', width: 28 },
  { header: 'Bill Received by Accounts', key: 'bill_received_by_accounts', width: 24 },
  { header: 'Payment Details', key: 'payment_details', width: 30 },
  { header: 'Handover To', key: 'handover_to', width: 20 },
  { header: 'Remarks', key: 'remarks', width: 30 },
  { header: 'Status', key: 'status', width: 16 },
  { header: 'Raw File Path', key: 'raw_file_path', width: 40 },
  { header: 'Created At', key: 'created_at', width: 24 }
];

// Columns definition for AuditLog sheet
export const AUDIT_COLUMNS = [
  { header: 'ID', key: 'id', width: 36 },
  { header: 'Bill ID', key: 'bill_id', width: 36 },
  { header: 'Action', key: 'action', width: 40 },
  { header: 'Timestamp', key: 'timestamp', width: 24 }
];

const HEADER_KEY_MAP = {
  'ID': 'id',
  'Contractor / Vendor Name': 'contractor_name',
  'Contractor Name': 'contractor_name',
  'Vendor Name': 'contractor_name',
  'Party Name (Receiving Site)': 'party_name',
  'Party Name': 'party_name',
  'Receiving Site': 'party_name',
  'PO Number': 'po_number',
  'PO No': 'po_number',
  'WO Number': 'wo_number',
  'WO No': 'wo_number',
  'PO Date': 'po_date',
  'Invoice Number': 'invoice_number',
  'Invoice No': 'invoice_number',
  'Invoice Date': 'invoice_date',
  'Bill Value': 'bill_value',
  'Amount': 'bill_value',
  'Total Amount': 'bill_value',
  'Bill Received Date (Site)': 'bill_received_date_site',
  'Bill Received Date (Back Office)': 'bill_received_date_back_office',
  'Bill Received by Accounts': 'bill_received_by_accounts',
  'Payment Details': 'payment_details',
  'Handover To': 'handover_to',
  'Remarks': 'remarks',
  'Status': 'status',
  'Raw File Path': 'raw_file_path',
  'Created At': 'created_at'
};

// Sequential Mutex/Write-Queue to guarantee serial write operations without race conditions
class WriteQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(() => fn())
        .then(resolve)
        .catch((err) => {
          console.error('[WriteQueue Error]:', err);
          reject(err);
        });
    });
  }
}

const writeQueue = new WriteQueue();

function styleHeaderRow(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800 corporate dark blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;
}

/**
 * Reads Master Workbook Metadata from JSON file
 */
export function getMasterMetadata() {
  try {
    if (fs.existsSync(MASTER_META_FILE_PATH)) {
      const raw = fs.readFileSync(MASTER_META_FILE_PATH, 'utf-8');
      const meta = JSON.parse(raw);
      if (fs.existsSync(ACTIVE_MASTER_FILE_PATH)) {
        const stat = fs.statSync(ACTIVE_MASTER_FILE_PATH);
        meta.fileSizeBytes = stat.size;
        meta.lastModified = stat.mtime.toISOString();
        meta.hasMaster = true;
        return meta;
      }
    }
  } catch (err) {
    console.warn('[ExcelService] Error reading master metadata:', err.message);
  }

  // Check if active master file exists on disk even if metadata file is missing
  if (fs.existsSync(ACTIVE_MASTER_FILE_PATH)) {
    try {
      const stat = fs.statSync(ACTIVE_MASTER_FILE_PATH);
      const meta = {
        hasMaster: true,
        fileName: 'Bills_Master_Database.xlsx',
        storagePath: ACTIVE_MASTER_FILE_PATH,
        uploadedAt: stat.ctime.toISOString(),
        lastModified: stat.mtime.toISOString(),
        fileSizeBytes: stat.size,
        recordCount: 0
      };
      saveMasterMetadata(meta);
      return meta;
    } catch (e) {
      // ignore
    }
  }

  return {
    hasMaster: false,
    fileName: null,
    storagePath: null,
    uploadedAt: null,
    lastModified: null,
    fileSizeBytes: 0,
    recordCount: 0
  };
}

/**
 * Saves Master Workbook Metadata to JSON file
 */
export function saveMasterMetadata(meta) {
  try {
    fs.writeFileSync(MASTER_META_FILE_PATH, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ExcelService] Error writing master metadata:', err);
  }
}

/**
 * Check if an active master Excel workbook exists server-side
 */
export function hasActiveMaster() {
  if (fs.existsSync(ACTIVE_MASTER_FILE_PATH)) {
    return true;
  }
  return false;
}

/**
 * Helper to parse row to JS Object
 */
function rowToObject(row, columns) {
  const obj = {};
  columns.forEach((col, idx) => {
    const cell = row.getCell(idx + 1);
    const cellValue = cell.value;
    if (cellValue && typeof cellValue === 'object' && cellValue.text !== undefined) {
      obj[col.key] = cellValue.text;
    } else if (cellValue && typeof cellValue === 'object' && cellValue.result !== undefined) {
      obj[col.key] = cellValue.result;
    } else if (cellValue !== null && cellValue !== undefined) {
      obj[col.key] = String(cellValue);
    } else {
      obj[col.key] = '';
    }
  });
  return obj;
}

/**
 * Inspects the current Excel file on disk and rebuilds/re-aligns
 * the columns if needed to match standard BILLS_COLUMNS schema while preserving all existing data.
 */
async function syncSchemaIfNeeded(workbook) {
  let billsSheet = workbook.getWorksheet('Bills') || workbook.worksheets[0];
  if (!billsSheet) return false;

  // Rename primary sheet to 'Bills' if named differently
  if (billsSheet.name !== 'Bills') {
    billsSheet.name = 'Bills';
  }

  const headerRow = billsSheet.getRow(1);
  const existingHeaders = [];
  headerRow.eachCell((cell) => existingHeaders.push(String(cell.value || '').trim()));

  const targetHeaders = BILLS_COLUMNS.map((c) => c.header.trim());

  // Check if header counts and titles already match
  const isMatch =
    existingHeaders.length === targetHeaders.length &&
    existingHeaders.every((h, i) => h === targetHeaders[i]);

  if (isMatch) return false;

  console.log(`[ExcelService] Column alignment needed. Mapping rows to standard schema...`);

  // Map each column index to its data key
  const colKeys = existingHeaders.map((h) => {
    if (HEADER_KEY_MAP[h]) return HEADER_KEY_MAP[h];
    const match = BILLS_COLUMNS.find((c) => c.header.trim().toLowerCase() === h.toLowerCase());
    return match ? match.key : null;
  });

  // Extract all existing rows as clean data objects
  const existingRecords = [];
  billsSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const record = {};
      colKeys.forEach((key, idx) => {
        if (!key) return;
        const cell = row.getCell(idx + 1);
        const cellValue = cell.value;
        if (cellValue && typeof cellValue === 'object' && cellValue.text !== undefined) {
          record[key] = cellValue.text;
        } else if (cellValue && typeof cellValue === 'object' && cellValue.result !== undefined) {
          record[key] = cellValue.result;
        } else if (cellValue !== null && cellValue !== undefined) {
          record[key] = String(cellValue);
        } else {
          record[key] = '';
        }
      });
      // Generate ID if missing
      if (!record.id) {
        record.id = uuidv4();
      }
      existingRecords.push(record);
    }
  });

  // Remove old worksheet and recreate with standard schema
  workbook.removeWorksheet(billsSheet.id);
  const newBillsSheet = workbook.addWorksheet('Bills', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });
  newBillsSheet.columns = BILLS_COLUMNS;
  styleHeaderRow(newBillsSheet);

  // Re-insert all rows matching the new schema
  existingRecords.forEach((record) => {
    const rowValues = BILLS_COLUMNS.map((col) => record[col.key] ?? '');
    newBillsSheet.addRow(rowValues);
  });

  // Ensure AuditLog worksheet exists
  let auditSheet = workbook.getWorksheet('AuditLog');
  if (!auditSheet) {
    auditSheet = workbook.addWorksheet('AuditLog', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });
    auditSheet.columns = AUDIT_COLUMNS;
    styleHeaderRow(auditSheet);
  }

  await workbook.xlsx.writeFile(ACTIVE_MASTER_FILE_PATH);
  console.log(`[ExcelService] Master Excel aligned to standard schema (${existingRecords.length} records preserved).`);
  return true;
}

/**
 * Initializes or migrates database if active master is available
 */
export async function initDatabase() {
  if (!hasActiveMaster()) {
    // Check if legacy DB exists in backend/data/bills_database.xlsx or root Bills_Master_Database.xlsx
    const rootPath = path.join(__dirname, '..', '..', 'Bills_Master_Database.xlsx');
    if (fs.existsSync(LEGACY_DB_PATH)) {
      console.log(`[ExcelService] Migrating existing database from ${LEGACY_DB_PATH} to server Master storage...`);
      fs.copyFileSync(LEGACY_DB_PATH, ACTIVE_MASTER_FILE_PATH);
      const stat = fs.statSync(ACTIVE_MASTER_FILE_PATH);
      saveMasterMetadata({
        hasMaster: true,
        fileName: 'Bills_Master_Database.xlsx',
        storagePath: ACTIVE_MASTER_FILE_PATH,
        uploadedAt: new Date().toISOString(),
        lastModified: stat.mtime.toISOString(),
        fileSizeBytes: stat.size,
        recordCount: 0
      });
    } else if (fs.existsSync(rootPath)) {
      console.log(`[ExcelService] Initializing server Master storage from existing root ${rootPath}...`);
      fs.copyFileSync(rootPath, ACTIVE_MASTER_FILE_PATH);
      const stat = fs.statSync(ACTIVE_MASTER_FILE_PATH);
      saveMasterMetadata({
        hasMaster: true,
        fileName: 'Bills_Master_Database.xlsx',
        storagePath: ACTIVE_MASTER_FILE_PATH,
        uploadedAt: new Date().toISOString(),
        lastModified: stat.mtime.toISOString(),
        fileSizeBytes: stat.size,
        recordCount: 0
      });
    }
  }

  if (hasActiveMaster()) {
    const meta = getMasterMetadata();
    try {
      const bills = await getAllBills();
      meta.recordCount = bills.length;
      saveMasterMetadata(meta);
    } catch (e) {
      console.warn('[ExcelService] Initial master scan warning:', e.message);
    }
  }
}

/**
 * Upload and set active Master Excel file from a browser upload buffer or file path
 */
export async function uploadMasterWorkbook(fileBufferOrPath, originalFilename) {
  return writeQueue.enqueue(async () => {
    const workbook = new ExcelJS.Workbook();
    try {
      if (typeof fileBufferOrPath === 'string') {
        await workbook.xlsx.readFile(fileBufferOrPath);
      } else {
        await workbook.xlsx.load(fileBufferOrPath);
      }
    } catch (err) {
      console.error('[ExcelService] Failed to parse Excel file:', err);
      throw new Error('The uploaded file is not a valid Excel workbook (.xlsx) or is corrupted.');
    }

    // Ensure 'Bills' worksheet exists
    let billsSheet = workbook.getWorksheet('Bills') || workbook.worksheets[0];
    if (!billsSheet) {
      billsSheet = workbook.addWorksheet('Bills', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      });
      billsSheet.columns = BILLS_COLUMNS;
      styleHeaderRow(billsSheet);
    } else {
      if (billsSheet.name !== 'Bills') {
        billsSheet.name = 'Bills';
      }
    }

    // Ensure 'AuditLog' worksheet exists
    let auditSheet = workbook.getWorksheet('AuditLog');
    if (!auditSheet) {
      auditSheet = workbook.addWorksheet('AuditLog', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      });
      auditSheet.columns = AUDIT_COLUMNS;
      styleHeaderRow(auditSheet);
    }

    // Write directly to active master storage location
    await workbook.xlsx.writeFile(ACTIVE_MASTER_FILE_PATH);

    // Sync schema & columns
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.readFile(ACTIVE_MASTER_FILE_PATH);
    await syncSchemaIfNeeded(reloaded);

    // Count records
    const finalWorkbook = new ExcelJS.Workbook();
    await finalWorkbook.xlsx.readFile(ACTIVE_MASTER_FILE_PATH);
    const finalSheet = finalWorkbook.getWorksheet('Bills');
    let recordCount = 0;
    if (finalSheet) {
      finalSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(1).value) {
          recordCount++;
        }
      });
    }

    const stat = fs.statSync(ACTIVE_MASTER_FILE_PATH);
    const sanitizedFilename = path.basename(originalFilename || 'Bills_Master_Database.xlsx');

    const metadata = {
      hasMaster: true,
      fileName: sanitizedFilename,
      storagePath: ACTIVE_MASTER_FILE_PATH,
      uploadedAt: new Date().toISOString(),
      lastModified: stat.mtime.toISOString(),
      fileSizeBytes: stat.size,
      recordCount
    };

    saveMasterMetadata(metadata);
    console.log(`[ExcelService] Master Excel workbook activated: ${sanitizedFilename} (${recordCount} records, ${stat.size} bytes).`);

    return metadata;
  });
}

/**
 * Helper to read workbook and configure worksheet columns
 */
async function loadWorkbook() {
  if (!hasActiveMaster()) {
    throw new Error('NO_MASTER_WORKBOOK: No active Master Excel workbook configured. Please upload a Master Excel file first.');
  }

  let workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(ACTIVE_MASTER_FILE_PATH);
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      throw new Error('The Master Excel workbook is currently locked or being accessed by another operation. Please try again.');
    }
    throw new Error(`Failed to read Master Excel workbook: ${err.message}`);
  }

  // Check and auto-migrate column schema if columns changed
  const migrated = await syncSchemaIfNeeded(workbook);
  if (migrated) {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(ACTIVE_MASTER_FILE_PATH);
  }

  let billsSheet = workbook.getWorksheet('Bills');
  if (!billsSheet) {
    billsSheet = workbook.addWorksheet('Bills', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });
    billsSheet.columns = BILLS_COLUMNS;
    styleHeaderRow(billsSheet);
  } else {
    billsSheet.columns = BILLS_COLUMNS;
  }

  let auditSheet = workbook.getWorksheet('AuditLog');
  if (!auditSheet) {
    auditSheet = workbook.addWorksheet('AuditLog', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });
    auditSheet.columns = AUDIT_COLUMNS;
    styleHeaderRow(auditSheet);
  } else {
    auditSheet.columns = AUDIT_COLUMNS;
  }

  return workbook;
}

/**
 * Get all bills from the active master workbook
 */
export async function getAllBills() {
  if (!hasActiveMaster()) {
    return [];
  }

  const workbook = await loadWorkbook();
  const billsSheet = workbook.getWorksheet('Bills');
  if (!billsSheet) return [];

  const bills = [];
  billsSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const bill = rowToObject(row, BILLS_COLUMNS);
      if (bill.id && bill.id.trim() !== '') {
        bills.push(bill);
      }
    }
  });

  return bills;
}

/**
 * Get bill by ID
 */
export async function getBillById(id) {
  if (!hasActiveMaster()) return null;
  const bills = await getAllBills();
  return bills.find((b) => b.id === id) || null;
}

/**
 * Check for duplicate: (Party Name + Invoice Number)
 */
export async function checkDuplicate(partyName, invoiceNumber, excludeId = null) {
  if (!partyName || !invoiceNumber || !hasActiveMaster()) return false;
  const bills = await getAllBills();
  const normalizedParty = partyName.trim().toLowerCase();
  const normalizedInvoice = invoiceNumber.trim().toLowerCase();

  return bills.some(
    (b) =>
      b.id !== excludeId &&
      (b.party_name || '').trim().toLowerCase() === normalizedParty &&
      (b.invoice_number || '').trim().toLowerCase() === normalizedInvoice &&
      b.status !== 'rejected'
  );
}

/**
 * Add a new bill with write queue and audit log directly to the active master workbook
 */
export async function addBill(billData) {
  if (!hasActiveMaster()) {
    throw new Error('NO_MASTER_WORKBOOK: Cannot save bill. Please upload a Master Excel file first.');
  }

  return writeQueue.enqueue(async () => {
    const workbook = await loadWorkbook();
    const billsSheet = workbook.getWorksheet('Bills');
    const auditSheet = workbook.getWorksheet('AuditLog');

    const billId = billData.id || uuidv4();
    const timestamp = new Date().toISOString();

    const newBillRow = {
      id: billId,
      contractor_name: billData.contractor_name || '',
      party_name: billData.party_name || '',
      po_number: billData.po_number || 'NA',
      wo_number: billData.wo_number || 'NA',
      po_date: billData.po_date || 'NA',
      invoice_number: billData.invoice_number || '',
      invoice_date: billData.invoice_date || '',
      bill_value: billData.bill_value || '',
      bill_received_date_site: billData.bill_received_date_site || '',
      bill_received_date_back_office: billData.bill_received_date_back_office || '',
      bill_received_by_accounts: billData.bill_received_by_accounts || '',
      payment_details: billData.payment_details || '',
      handover_to: billData.handover_to || '',
      remarks: billData.remarks || '',
      status: billData.status || 'pending',
      raw_file_path: billData.raw_file_path || '',
      created_at: timestamp
    };

    // Convert to row values array to guarantee column placement
    const rowValues = BILLS_COLUMNS.map((col) => newBillRow[col.key] ?? '');
    billsSheet.addRow(rowValues);

    // Add Audit Log
    const auditRow = {
      id: uuidv4(),
      bill_id: billId,
      action: `Bill created with status '${newBillRow.status}'`,
      timestamp: timestamp
    };
    const auditValues = AUDIT_COLUMNS.map((col) => auditRow[col.key] ?? '');
    auditSheet.addRow(auditValues);

    await workbook.xlsx.writeFile(ACTIVE_MASTER_FILE_PATH);

    // Update metadata record count
    const meta = getMasterMetadata();
    meta.recordCount = (meta.recordCount || 0) + 1;
    meta.lastModified = timestamp;
    saveMasterMetadata(meta);

    return newBillRow;
  });
}

/**
 * Update an existing bill
 */
export async function updateBill(id, updateData, actionDescription = 'Bill details updated') {
  if (!hasActiveMaster()) {
    throw new Error('NO_MASTER_WORKBOOK: No active Master Excel workbook configured.');
  }

  return writeQueue.enqueue(async () => {
    const workbook = await loadWorkbook();
    const billsSheet = workbook.getWorksheet('Bills');
    const auditSheet = workbook.getWorksheet('AuditLog');

    let targetRowNumber = -1;
    billsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && String(row.getCell(1).value).trim() === String(id).trim()) {
        targetRowNumber = rowNumber;
      }
    });

    if (targetRowNumber === -1) {
      throw new Error(`Bill with ID ${id} not found in Master Excel database`);
    }

    const row = billsSheet.getRow(targetRowNumber);
    const existing = rowToObject(row, BILLS_COLUMNS);

    // Merge updates
    const updated = {
      ...existing,
      ...updateData,
      id // preserve ID
    };

    BILLS_COLUMNS.forEach((col, idx) => {
      if (updated[col.key] !== undefined) {
        row.getCell(idx + 1).value = updated[col.key];
      }
    });
    row.commit();

    // Add Audit Log
    const timestamp = new Date().toISOString();
    const auditRow = {
      id: uuidv4(),
      bill_id: id,
      action: actionDescription,
      timestamp: timestamp
    };
    const auditValues = AUDIT_COLUMNS.map((col) => auditRow[col.key] ?? '');
    auditSheet.addRow(auditValues);

    await workbook.xlsx.writeFile(ACTIVE_MASTER_FILE_PATH);

    const meta = getMasterMetadata();
    meta.lastModified = timestamp;
    saveMasterMetadata(meta);

    return updated;
  });
}

/**
 * Delete a bill from the database
 */
export async function deleteBill(id) {
  if (!hasActiveMaster()) {
    throw new Error('NO_MASTER_WORKBOOK: No active Master Excel workbook configured.');
  }

  return writeQueue.enqueue(async () => {
    const workbook = await loadWorkbook();
    const billsSheet = workbook.getWorksheet('Bills');
    const auditSheet = workbook.getWorksheet('AuditLog');

    let targetRowNumber = -1;
    let deletedBill = null;

    billsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && String(row.getCell(1).value).trim() === String(id).trim()) {
        targetRowNumber = rowNumber;
        deletedBill = rowToObject(row, BILLS_COLUMNS);
      }
    });

    if (targetRowNumber === -1) {
      throw new Error(`Bill with ID ${id} not found`);
    }

    // Splice out the row from Bills sheet
    billsSheet.spliceRows(targetRowNumber, 1);

    // Remove matching audit log entries from AuditLog sheet
    if (auditSheet) {
      const auditRowNumbers = [];
      auditSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && String(row.getCell(2).value).trim() === String(id).trim()) {
          auditRowNumbers.push(rowNumber);
        }
      });
      for (let i = auditRowNumbers.length - 1; i >= 0; i--) {
        auditSheet.spliceRows(auditRowNumbers[i], 1);
      }
    }

    await workbook.xlsx.writeFile(ACTIVE_MASTER_FILE_PATH);

    const meta = getMasterMetadata();
    meta.recordCount = Math.max(0, (meta.recordCount || 1) - 1);
    meta.lastModified = new Date().toISOString();
    saveMasterMetadata(meta);

    return { success: true, deletedBill };
  });
}

/**
 * Get audit logs for a bill (or all audit logs)
 */
export async function getAuditLogs(billId = null) {
  if (!hasActiveMaster()) return [];

  const workbook = await loadWorkbook();
  const auditSheet = workbook.getWorksheet('AuditLog');
  if (!auditSheet) return [];

  const logs = [];
  auditSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const log = rowToObject(row, AUDIT_COLUMNS);
      if (log.id && (!billId || log.bill_id === billId)) {
        logs.push(log);
      }
    }
  });

  return logs.reverse(); // Newest first
}

/**
 * Export raw buffer for downloading the active master Excel file
 */
export async function getExcelFileBuffer() {
  if (!hasActiveMaster()) {
    throw new Error('NO_MASTER_WORKBOOK: No master Excel file exists to export. Please upload a Master Excel file first.');
  }
  const workbook = await loadWorkbook();
  return await workbook.xlsx.writeBuffer();
}

/**
 * Get metadata and live status of Master Excel file for API responses
 */
export function getMasterFileInfo() {
  const meta = getMasterMetadata();
  return {
    ...meta,
    storageType: 'local_server_disk',
    activePath: ACTIVE_MASTER_FILE_PATH
  };
}

/**
 * Directly open the live Master Excel file in Microsoft Excel (or default system spreadsheet viewer)
 */
export function openMasterExcel() {
  return new Promise((resolve, reject) => {
    if (!hasActiveMaster()) {
      return reject(new Error('No active Master Excel workbook configured. Please upload a Master Excel file first.'));
    }
    const filePath = ACTIVE_MASTER_FILE_PATH;
    if (!fs.existsSync(filePath)) {
      return reject(new Error('Master Excel file does not exist on disk.'));
    }

    let cmd = '';
    if (process.platform === 'win32') {
      cmd = `start "" "${filePath}"`;
    } else if (process.platform === 'darwin') {
      cmd = `open "${filePath}"`;
    } else {
      cmd = `xdg-open "${filePath}"`;
    }

    exec(cmd, (err) => {
      if (err) {
        console.error('[ExcelService] Failed to launch Excel application:', err);
        return reject(err);
      }
      resolve({ success: true, filePath });
    });
  });
}

/**
 * Open containing folder in Windows Explorer with the active Master Excel file selected
 */
export function openMasterFolder() {
  return new Promise((resolve, reject) => {
    if (!hasActiveMaster()) {
      return reject(new Error('No active Master Excel workbook configured.'));
    }
    const filePath = ACTIVE_MASTER_FILE_PATH;
    const folderPath = path.dirname(filePath);

    let cmd = '';
    if (process.platform === 'win32') {
      cmd = `explorer.exe /select,"${filePath}"`;
    } else if (process.platform === 'darwin') {
      cmd = `open -R "${filePath}"`;
    } else {
      cmd = `xdg-open "${folderPath}"`;
    }

    exec(cmd, (err) => {
      resolve({ success: true, folderPath, filePath });
    });
  });
}

export { ACTIVE_MASTER_FILE_PATH };
