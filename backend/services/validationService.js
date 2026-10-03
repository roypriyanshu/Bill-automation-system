import { checkDuplicate } from './excelService.js';

/**
 * Validates extracted values and business rules to determine initial status
 * 
 * Rules:
 * 1. If (Party Name + Invoice Number) already exists in Bills -> 'duplicate'
 * 2. If required fields (party_name, invoice_number, invoice_date, bill_value) are missing -> 'needs_review'
 * 3. Otherwise -> 'validated'
 */
export async function determineBillStatus({
  party_name,
  invoice_number,
  invoice_date,
  bill_value,
  status = null,
  excludeId = null
}) {
  const flags = [];

  // If status is manually set and duplicate check passes
  if (status && status !== 'pending' && status !== 'needs_review') {
    if (party_name && invoice_number) {
      const isDuplicate = await checkDuplicate(party_name, invoice_number, excludeId);
      if (isDuplicate) {
        flags.push({
          type: 'duplicate',
          message: `Duplicate detected: Party '${party_name}' with Invoice '${invoice_number}' already exists.`
        });
        return { status: 'duplicate', flags, missingFields: [] };
      }
    }
    return { status, flags: [], missingFields: [] };
  }

  // 1. Duplicate check (party_name + invoice_number)
  if (party_name && invoice_number) {
    const isDuplicate = await checkDuplicate(party_name, invoice_number, excludeId);
    if (isDuplicate) {
      flags.push({
        type: 'duplicate',
        message: `Duplicate detected: Party '${party_name}' with Invoice '${invoice_number}' already exists.`
      });
      return {
        status: 'duplicate',
        flags,
        missingFields: []
      };
    }
  }

  // 2. Missing required fields check
  const missingFields = [];
  if (!party_name || party_name.trim() === '') {
    missingFields.push('party_name');
    flags.push({
      type: 'missing_field',
      field: 'party_name',
      message: 'Party Name is missing.'
    });
  }

  if (!invoice_number || invoice_number.trim() === '') {
    missingFields.push('invoice_number');
    flags.push({
      type: 'missing_field',
      field: 'invoice_number',
      message: 'Invoice Number is missing.'
    });
  }

  if (!invoice_date || invoice_date.trim() === '') {
    missingFields.push('invoice_date');
    flags.push({
      type: 'missing_field',
      field: 'invoice_date',
      message: 'Invoice Date is missing.'
    });
  }

  if (!bill_value || bill_value.toString().trim() === '') {
    missingFields.push('bill_value');
    flags.push({
      type: 'missing_field',
      field: 'bill_value',
      message: 'Bill Value is missing.'
    });
  }

  if (missingFields.length > 0) {
    return {
      status: 'needs_review',
      flags,
      missingFields
    };
  }

  return {
    status: 'validated',
    flags: [],
    missingFields: []
  };
}
