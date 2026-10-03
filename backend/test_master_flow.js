import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as excelService from './services/excelService.js';
import { determineBillStatus } from './services/validationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMasterWorkbookTests() {
  console.log('========================================================');
  console.log(' Starting Persistent Master Excel Workbook Verification ');
  console.log('========================================================');

  // Step 1: Create a mock client .xlsx workbook in memory to simulate a user uploading their file
  console.log('\n[Test 1] Creating a sample client Master Excel workbook in memory...');
  const sampleWorkbook = new ExcelJS.Workbook();
  sampleWorkbook.creator = 'Client Company Finance Dept';
  sampleWorkbook.created = new Date();

  const billsSheet = sampleWorkbook.addWorksheet('Bills');
  billsSheet.columns = excelService.BILLS_COLUMNS;
  // Pre-seed with 1 initial row
  billsSheet.addRow({
    id: 'seed-bill-001',
    contractor_name: 'Alpha Logistics',
    party_name: 'Branch Office Mumbai',
    po_number: 'PO-ALPHA-01',
    wo_number: 'WO-ALPHA-01',
    po_date: '2024-01-10',
    invoice_number: 'INV-ALPHA-100',
    invoice_date: '2024-01-12',
    bill_value: '5000.00',
    bill_received_date_site: '2024-01-15',
    bill_received_date_back_office: '2024-01-16',
    status: 'validated',
    created_at: new Date().toISOString()
  });

  const buffer = await sampleWorkbook.xlsx.writeBuffer();
  console.log(`[Test 1 PASSED] Created sample buffer (${buffer.length} bytes).`);

  // Step 2: Test invalid file upload rejection
  console.log('\n[Test 2] Testing invalid file upload rejection...');
  try {
    const invalidBuffer = Buffer.from('This is a plain text file, not an Excel workbook!');
    await excelService.uploadMasterWorkbook(invalidBuffer, 'bad_file.txt');
    console.error('[Test 2 FAILED] Expected error for corrupted/invalid file but none was thrown.');
  } catch (err) {
    console.log(`[Test 2 PASSED] Corrupted/invalid file correctly rejected with message: "${err.message}"`);
  }

  // Step 3: Test valid master workbook activation
  console.log('\n[Test 3] Uploading and activating sample Master Excel workbook...');
  const meta = await excelService.uploadMasterWorkbook(buffer, 'Company_Master_2024.xlsx');
  console.log('[Test 3 Metadata Result]:', meta);

  if (meta.hasMaster && meta.fileName === 'Company_Master_2024.xlsx' && meta.recordCount === 1) {
    console.log('[Test 3 PASSED] Master Excel file activated and seed record preserved!');
  } else {
    throw new Error(`[Test 3 FAILED] Metadata mismatch: ${JSON.stringify(meta)}`);
  }

  // Step 4: Verify getAllBills loads seed record from active server master
  console.log('\n[Test 4] Verifying getAllBills() loads from active server master...');
  const billsAfterUpload = await excelService.getAllBills();
  console.log(`Retrieved ${billsAfterUpload.length} bills from active master.`);
  if (billsAfterUpload.length === 1 && billsAfterUpload[0].invoice_number === 'INV-ALPHA-100') {
    console.log('[Test 4 PASSED] Seed bill loaded successfully.');
  } else {
    throw new Error('[Test 4 FAILED] Could not retrieve seed bill.');
  }

  // Step 5: Append new bill to active master workbook
  console.log('\n[Test 5] Appending new bill to active Master Excel workbook...');
  const newBillData = {
    contractor_name: 'Beta Power Solutions',
    party_name: 'Branch Office Delhi',
    po_number: 'PO-BETA-02',
    wo_number: 'WO-BETA-02',
    po_date: '2024-02-10',
    invoice_number: 'INV-BETA-200',
    invoice_date: '2024-02-14',
    bill_value: '12500.00',
    bill_received_date_site: '2024-02-16',
    bill_received_date_back_office: '2024-02-17',
    remarks: 'Auto-appended test bill',
    status: 'validated'
  };

  const addedBill = await excelService.addBill(newBillData);
  console.log(`Created bill ID: ${addedBill.id}, status: ${addedBill.status}`);

  const updatedBills = await excelService.getAllBills();
  console.log(`Master database now contains ${updatedBills.length} total bills.`);
  if (updatedBills.length === 2) {
    console.log('[Test 5 PASSED] New bill appended and saved to server storage.');
  } else {
    throw new Error('[Test 5 FAILED] Bill count mismatch.');
  }

  // Step 6: Verify duplicate check against stored master
  console.log('\n[Test 6] Testing duplicate detection against active master...');
  const isDuplicate = await excelService.checkDuplicate('Branch Office Delhi', 'INV-BETA-200');
  if (isDuplicate) {
    console.log('[Test 6 PASSED] Duplicate detected accurately against active master.');
  } else {
    throw new Error('[Test 6 FAILED] Duplicate was not detected.');
  }

  // Step 7: Verify export / download buffer
  console.log('\n[Test 7] Verifying getExcelFileBuffer() for downloads...');
  const exportBuffer = await excelService.getExcelFileBuffer();
  console.log(`Generated export buffer size: ${exportBuffer.length} bytes.`);
  if (exportBuffer && exportBuffer.length > 0) {
    console.log('[Test 7 PASSED] Export buffer generated cleanly.');
  } else {
    throw new Error('[Test 7 FAILED] Export buffer is empty.');
  }

  // Step 8: Test Master Replacement
  console.log('\n[Test 8] Testing Master Workbook replacement...');
  const replaceWorkbook = new ExcelJS.Workbook();
  const newSheet = replaceWorkbook.addWorksheet('Bills');
  newSheet.columns = excelService.BILLS_COLUMNS;
  newSheet.addRow({
    id: 'replaced-001',
    contractor_name: 'Gamma Corp',
    party_name: 'Branch Office Bangalore',
    invoice_number: 'INV-GAMMA-300',
    invoice_date: '2024-03-01',
    bill_value: '8000.00',
    status: 'validated'
  });
  const replaceBuf = await replaceWorkbook.xlsx.writeBuffer();
  const replacedMeta = await excelService.uploadMasterWorkbook(replaceBuf, 'Swapped_Master_March.xlsx');

  const replacedBills = await excelService.getAllBills();
  console.log(`Replaced master has ${replacedBills.length} bills (File: ${replacedMeta.fileName}).`);
  if (replacedBills.length === 1 && replacedBills[0].invoice_number === 'INV-GAMMA-300') {
    console.log('[Test 8 PASSED] Master workbook successfully swapped and active reference updated.');
  } else {
    throw new Error('[Test 8 FAILED] Master replacement did not update active records.');
  }

  console.log('\n========================================================');
  console.log(' ALL MASTER EXCEL WORKBOOK TESTS PASSED SUCCESSFULLY!   ');
  console.log('========================================================');
}

runMasterWorkbookTests().catch((err) => {
  console.error('\n[FATAL TEST ERROR]:', err);
  process.exit(1);
});
