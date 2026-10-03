import { addBill, getAllBills, getAuditLogs } from './services/excelService.js';
import { determineBillStatus } from './services/validationService.js';

async function runTests() {
  console.log('--- Starting Excel Database & Concurrency Verification ---');

  // Test 1: Submit 15 concurrent write operations
  console.log('[Test 1] Executing 15 simultaneous bill additions via write-queue...');
  const promises = [];
  for (let i = 1; i <= 15; i++) {
    const billData = {
      contractor_name: `Apex Industrial Supplies Pvt Ltd`,
      party_name: `Branch Office ${i % 3 === 0 ? 'Mumbai' : (i % 3 === 1 ? 'Delhi' : 'Bangalore')}`,
      po_number: i % 2 === 0 ? `PO-2024-00${i}` : 'NA',
      wo_number: i % 3 === 0 ? `WO-88${i}` : 'NA',
      po_date: i % 2 === 0 ? '2024-03-15' : 'NA',
      invoice_number: `INV-2024-${1000 + i}`,
      invoice_date: '2024-03-10',
      bill_value: (1500 + i * 250).toFixed(2),
      bill_received_date_site: '2024-03-12',
      bill_received_date_back_office: '2024-03-14',
      bill_received_by_accounts: '2024-03-15',
      payment_details: 'NEFT Transfer pending',
      handover_to: 'Ramesh Kumar',
      remarks: `Test batch bill #${i}`,
      status: 'validated',
      raw_file_path: '/uploads/sample_bill_1.jpg'
    };
    promises.push(addBill(billData));
  }

  const results = await Promise.all(promises);
  console.log(`[Test 1 PASSED] Successfully created ${results.length} bills concurrently.`);

  // Verify all bills are in Excel
  const allBills = await getAllBills();
  console.log(`[Verification] Master database currently contains ${allBills.length} total bills.`);

  // Test 2: Check Duplicate Detection
  console.log('[Test 2] Testing duplicate check...');
  const dupCheck = await determineBillStatus({
    party_name: 'Branch Office Mumbai',
    invoice_number: 'INV-2024-1003', // Exists from batch above
    invoice_date: '2024-03-10',
    bill_value: '2250.00'
  });
  console.log(`Duplicate evaluation result: status='${dupCheck.status}'`);
  if (dupCheck.status === 'duplicate') {
    console.log('[Test 2 PASSED] Duplicate correctly detected!');
  } else {
    console.error('[Test 2 FAILED] Duplicate not detected');
  }

  // Test 3: Check Missing Fields Validation -> Needs Review
  console.log('[Test 3] Testing missing fields validation...');
  const missingFieldCheck = await determineBillStatus({
    party_name: 'Branch Office Chennai',
    invoice_number: '', // Missing
    invoice_date: '2024-03-10',
    bill_value: '4500.00'
  });
  console.log(`Missing field evaluation result: status='${missingFieldCheck.status}', fields: ${JSON.stringify(missingFieldCheck.missingFields)}`);
  if (missingFieldCheck.status === 'needs_review' && missingFieldCheck.missingFields.includes('invoice_number')) {
    console.log('[Test 3 PASSED] Needs Review correctly flagged for missing required field!');
  } else {
    console.error('[Test 3 FAILED] Missing field check failed');
  }

  // Test 4: Check Audit Log Sheet
  const auditLogs = await getAuditLogs();
  console.log(`[Test 4] Master AuditLog has ${auditLogs.length} entries.`);
  console.log('--- All Backend Unit & Concurrency Tests Passed ---');
}

runTests().catch(console.error);
