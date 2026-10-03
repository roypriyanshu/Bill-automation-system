const API_BASE = '/api/bills';

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}

export async function fetchBills(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });

  const res = await fetch(`${API_BASE}?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load bills');
  return res.json();
}

export async function fetchBillById(id) {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error('Failed to load bill details');
  return res.json();
}

export async function uploadAndOCR(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ocr`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to process document OCR');
  }
  return res.json();
}

export async function createBill(billData) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(billData)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to submit bill');
  }
  return res.json();
}

export async function updateBill(id, updateData) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update bill');
  }
  return res.json();
}

export async function updateBillStatus(id, status, remarks = '') {
  const res = await fetch(`${API_BASE}/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, remarks })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update bill status');
  }
  return res.json();
}

export async function deleteBill(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete bill');
  }
  return res.json();
}

// -------------------------------------------------------------
// Master Excel API Endpoints
// -------------------------------------------------------------

export function getExportExcelUrl() {
  return `${API_BASE}/master/download`;
}

export async function fetchMasterInfo() {
  const res = await fetch(`${API_BASE}/master/info`);
  if (!res.ok) throw new Error('Failed to load Master Excel information');
  return res.json();
}

export async function uploadMasterExcel(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/master/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload Master Excel file');
  }
  return res.json();
}

export async function openMasterExcel() {
  const res = await fetch(`${API_BASE}/open-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to open Excel file');
  }
  return res.json();
}

export async function openMasterFolder() {
  const res = await fetch(`${API_BASE}/open-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to open folder in Explorer');
  }
  return res.json();
}
