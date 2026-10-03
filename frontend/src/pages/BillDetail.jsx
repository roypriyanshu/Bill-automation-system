import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  History,
  Loader2,
  Sparkles,
  Building2,
  Calendar,
  DollarSign,
  Hash,
  RotateCcw,
  Check,
  Trash2
} from 'lucide-react';
import FilePreview from '../components/FilePreview';
import StatusBadge from '../components/StatusBadge';
import { fetchBillById, updateBill, updateBillStatus, deleteBill } from '../services/api';
import { DEFAULT_PARTY_OPTIONS } from '../constants/parties';

export default function BillDetail({ billId, onBack, onStatusUpdated }) {

  const [bill, setBill] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  // Form editing state
  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const loadBill = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBillById(billId);
      setBill(data.bill);
      setAuditLogs(data.auditLogs || []);
      setEvaluation(data.evaluation);

      setFormData({
        contractor_name: data.bill.contractor_name || '',
        party_name: data.bill.party_name || '',
        po_number: data.bill.po_number || 'NA',
        po_number_na: data.bill.po_number === 'NA',
        wo_number: data.bill.wo_number || 'NA',
        wo_number_na: data.bill.wo_number === 'NA',
        po_date: data.bill.po_date || 'NA',
        po_date_na: data.bill.po_date === 'NA',
        invoice_number: data.bill.invoice_number || '',
        invoice_date: data.bill.invoice_date || '',
        bill_value: data.bill.bill_value || '',
        bill_received_date_site: data.bill_received_date_site || '',
        bill_received_date_back_office: data.bill_received_date_back_office || '',
        bill_received_by_accounts: data.bill_received_by_accounts || '',
        payment_details: data.bill.payment_details || '',
        handover_to: data.bill.handover_to || '',
        remarks: data.bill.remarks || '',
        status: data.bill.status || 'pending'
      });
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to load bill:', err);
      setFeedbackMsg({ type: 'error', text: 'Error loading bill details.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (billId) {
      loadBill();
    }
  }, [billId]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // NA Checkbox handler
  const handleNaToggle = (field) => {
    const naKey = `${field}_na`;
    setFormData((prev) => {
      const willBeNa = !prev[naKey];
      return {
        ...prev,
        [naKey]: willBeNa,
        [field]: willBeNa ? 'NA' : ''
      };
    });
    setIsDirty(true);
  };

  // Save manual overrides
  const handleSaveEdits = async () => {
    setIsSaving(true);
    setFeedbackMsg({ type: '', text: '' });

    try {
      const payload = {
        contractor_name: formData.contractor_name.trim(),
        party_name: formData.party_name.trim(),
        po_number: formData.po_number_na ? 'NA' : (formData.po_number || 'NA'),
        wo_number: formData.wo_number_na ? 'NA' : (formData.wo_number || 'NA'),
        po_date: formData.po_date_na ? 'NA' : (formData.po_date || 'NA'),
        invoice_number: formData.invoice_number.trim(),
        invoice_date: formData.invoice_date.trim(),
        bill_value: formData.bill_value.toString().trim(),
        bill_received_date_site: formData.bill_received_date_site,
        bill_received_date_back_office: formData.bill_received_date_back_office,
        bill_received_by_accounts: formData.bill_received_by_accounts,
        payment_details: formData.payment_details,
        handover_to: formData.handover_to,
        remarks: formData.remarks,
        _actionDescription: 'Manual metadata edits saved'
      };

      const res = await updateBill(billId, payload);
      setBill(res.bill);
      setAuditLogs(res.auditLogs || []);
      setIsDirty(false);

      if (res.isDuplicate) {
        setFeedbackMsg({
          type: 'warning',
          text: 'Changes saved. Note: Bill is marked as Duplicate due to matching Party and Invoice Number!'
        });
      } else {
        setFeedbackMsg({ type: 'success', text: 'All metadata updates safely saved to Excel database.' });
      }

      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick status updates (Approve / Validate, Reject, Flag Needs Review)
  const handleSetStatus = async (newStatus) => {
    setIsSaving(true);
    setFeedbackMsg({ type: '', text: '' });

    try {
      const res = await updateBillStatus(billId, newStatus, `Manual action: marked as ${newStatus}`);
      setBill(res.bill);
      setAuditLogs(res.auditLogs || []);
      setFormData((prev) => ({ ...prev, status: res.bill.status }));
      setFeedbackMsg({ type: 'success', text: `Bill status successfully updated to '${newStatus}'.` });
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update status.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Permanently delete bill
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteBill(billId);
      if (onStatusUpdated) onStatusUpdated();
      onBack();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to delete bill record.' });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500 mb-3" />
        <p className="text-sm font-medium">Loading bill inspection view...</p>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Bill record not found.</p>
        <button onClick={onBack} className="btn-secondary mt-3 text-xs">
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 h-full flex flex-col overflow-y-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900 font-mono">
                {bill.invoice_number || 'Untitled Bill'}
              </h2>
              <StatusBadge status={bill.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: <span className="font-mono">{bill.id}</span> &bull; Created {new Date(bill.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {bill.status !== 'validated' && (
            <button
              onClick={() => handleSetStatus('validated')}
              disabled={isSaving || isDeleting}
              className="btn-primary text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve / Validate</span>
            </button>
          )}

          {bill.status !== 'needs_review' && (
            <button
              onClick={() => handleSetStatus('needs_review')}
              disabled={isSaving || isDeleting}
              className="btn-secondary text-xs h-8 px-3 border-amber-300 text-amber-800 hover:bg-amber-50"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Flag Review</span>
            </button>
          )}

          {bill.status !== 'rejected' && (
            <button
              onClick={() => handleSetStatus('rejected')}
              disabled={isSaving || isDeleting}
              className="btn-secondary text-xs h-8 px-3 border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Reject</span>
            </button>
          )}

          <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>

          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={isSaving || isDeleting}
            className="btn-secondary text-xs h-8 px-2.5 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors"
            title="Delete this bill permanently"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg.text && (
        <div
          className={`p-3 rounded-md text-xs flex items-center justify-between shrink-0 ${feedbackMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : feedbackMsg.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-300'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg({ type: '', text: '' })}
            className="text-xs font-bold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split-Screen View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[650px] flex-1">
        {/* Left Column: Original File Scan / PDF Viewer */}
        <div className="lg:col-span-6 flex flex-col h-[720px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Source Document Attachment
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {bill.raw_file_path || 'No file attached'}
            </span>
          </div>
          <div className="flex-1">
            <FilePreview fileUrl={bill.raw_file_path} />
          </div>
        </div>

        {/* Right Column: Editable Metadata + Audit Log */}
        <div className="lg:col-span-6 flex flex-col h-[720px] overflow-hidden space-y-4">
          <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm p-5 overflow-y-auto space-y-5">
            {/* Section 1: Extracted Fields */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Extracted Invoice Fields (Editable)</span>
                </span>
              </div>

              {/* Contractor / Vendor Name */}
              <div>
                <label className="form-label flex items-center gap-1 mb-1">
                  <Building2 className="w-3 h-3 text-blue-600" />
                  <span>Contractor / Vendor Name (Sender)</span>
                </label>
                <input
                  type="text"
                  value={formData.contractor_name || ''}
                  onChange={(e) => handleInputChange('contractor_name', e.target.value)}
                  placeholder="e.g. M/s Sharma Electricals, Apex Supplies"
                  className="form-input"
                />
              </div>

              {/* Invoice Number */}
              <div>
                <label className="form-label flex items-center gap-1 mb-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>Invoice / Bill / Ref #</span>
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="form-label flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Invoice Date</span>
                </label>
                <input
                  type="text"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Bill Value */}
              <div>
                <label className="form-label flex items-center gap-1 mb-1">
                  <DollarSign className="w-3 h-3 text-slate-400" />
                  <span>Bill Value</span>
                </label>
                <input
                  type="text"
                  value={formData.bill_value}
                  onChange={(e) => handleInputChange('bill_value', e.target.value)}
                  className="form-input font-mono"
                />
              </div>
            </div>

            {/* Section 2: Operations Metadata */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Operations & Receiving Information
              </span>

              {/* Party Name */}
              <div>
                <label className="form-label flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Name of Party (Receiving Site / Department)</span>
                </label>
                <input
                  type="text"
                  list="bill-detail-parties"
                  value={formData.party_name || ''}
                  onChange={(e) => handleInputChange('party_name', e.target.value)}
                  placeholder="Select or type party name..."
                  className="form-input"
                />
                <datalist id="bill-detail-parties">
                  {DEFAULT_PARTY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>


              {/* PO & WO with NA Checkbox */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label mb-0">PO Number</label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.po_number_na}
                        onChange={() => handleNaToggle('po_number')}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-[11px]">NA</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={formData.po_number_na}
                    value={formData.po_number}
                    onChange={(e) => handleInputChange('po_number', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label mb-0">WO Number</label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.wo_number_na}
                        onChange={() => handleNaToggle('wo_number')}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-[11px]">NA</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={formData.wo_number_na}
                    value={formData.wo_number}
                    onChange={(e) => handleInputChange('wo_number', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* PO Date with NA Checkbox */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label mb-0">PO Date</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.po_date_na}
                      onChange={() => handleNaToggle('po_date')}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-[11px]">NA</span>
                  </label>
                </div>
                <input
                  type="date"
                  disabled={formData.po_date_na}
                  value={formData.po_date === 'NA' ? '' : formData.po_date}
                  onChange={(e) => handleInputChange('po_date', e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Received Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Bill Received Date (Site)</label>
                  <input
                    type="date"
                    value={formData.bill_received_date_site}
                    onChange={(e) => handleInputChange('bill_received_date_site', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Bill Received Date (Back Office)</label>
                  <input
                    type="date"
                    value={formData.bill_received_date_back_office}
                    onChange={(e) => handleInputChange('bill_received_date_back_office', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Accounts & Handover */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Bill Received by Accounts</label>
                  <input
                    type="text"
                    value={formData.bill_received_by_accounts}
                    onChange={(e) => handleInputChange('bill_received_by_accounts', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Handover To</label>
                  <input
                    type="text"
                    value={formData.handover_to}
                    onChange={(e) => handleInputChange('handover_to', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <label className="form-label">Payment Details</label>
                <input
                  type="text"
                  value={formData.payment_details}
                  onChange={(e) => handleInputChange('payment_details', e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="form-label">Remarks</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* Save Edits button */}
            <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {isDirty ? 'Unsaved changes pending' : 'All changes saved to Excel'}
              </span>
              <button
                onClick={handleSaveEdits}
                disabled={isSaving || !isDirty}
                className="btn-primary text-xs px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Metadata Edits</span>
              </button>
            </div>

            {/* Section 3: Audit Log History */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Audit Log Ledger (Sheet: "AuditLog")</span>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-md bg-slate-50 p-3 max-h-48 overflow-y-auto">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <div key={log.id} className="text-xs border-b border-slate-200/80 last:border-0 pb-1.5 last:pb-0">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                        <span className="font-mono text-[10px] text-slate-400">ID: {log.id.substring(0, 8)}</span>
                      </div>
                      <p className="text-slate-800 font-medium mt-0.5">{log.action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">No audit logs found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Bill Record?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to permanently delete this bill from the Excel database?
                </p>

                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice #:</span>
                    <strong className="font-mono text-slate-800">{bill.invoice_number || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Party:</span>
                    <span className="text-slate-700 truncate max-w-[200px]">{bill.party_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {bill.bill_value ? `₹${parseFloat(bill.bill_value).toFixed(2)}` : '—'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-rose-600 mt-2 font-medium">
                  This action cannot be undone and will update the master Excel file immediately.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="btn-secondary text-xs h-8 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn-primary text-xs h-8 px-3.5 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
