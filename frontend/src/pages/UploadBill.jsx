import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Info,
  Save,
  RotateCcw,
  Sparkles,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import FilePreview from '../components/FilePreview';
import StatusBadge from '../components/StatusBadge';
import MasterExcelModal from '../components/MasterExcelModal';
import { uploadAndOCR, createBill, fetchMasterInfo } from '../services/api';
import { DEFAULT_PARTY_OPTIONS } from '../constants/parties';

function findMatchingParty(extractedText) {
  if (!extractedText || typeof extractedText !== 'string') return '';
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanExtracted = clean(extractedText);
  if (!cleanExtracted) return '';

  // 1. Exact match
  const exact = DEFAULT_PARTY_OPTIONS.find((opt) => opt.toLowerCase() === extractedText.trim().toLowerCase());
  if (exact) return exact;

  // 2. Cleaned alphanumeric match (handles "PVT.LTD" vs "Private Limited" vs "pvt ltd")
  const norm = DEFAULT_PARTY_OPTIONS.find((opt) => {
    const cleanOpt = clean(opt);
    return cleanOpt === cleanExtracted || cleanOpt.includes(cleanExtracted) || cleanExtracted.includes(cleanOpt);
  });
  if (norm) return norm;

  // 3. Keyword matching (e.g. "Mandya Finance", "Salarpuria Properties", "Baid Finex")
  const keywordMatch = DEFAULT_PARTY_OPTIONS.find((opt) => {
    const words = opt.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !['head', 'office', 'private', 'limited', 'pvt.ltd', 'pvt', 'ltd'].includes(w));
    return words.length > 0 && words.every((w) => extractedText.toLowerCase().includes(w));
  });
  if (keywordMatch) return keywordMatch;

  return '';
}

export default function UploadBill({ onBillCreated, onCancel }) {
  const [masterInfo, setMasterInfo] = useState(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Extracted & Form State
  const [fileData, setFileData] = useState(null);
  const [formData, setFormData] = useState({
    contractor_name: '',
    party_name: '',
    custom_party: '',
    po_number: '',
    po_number_na: false,
    wo_number: '',
    wo_number_na: false,
    po_date: '',
    po_date_na: false,
    invoice_number: '',
    invoice_date: '',
    bill_value: '',
    bill_received_date_site: new Date().toISOString().split('T')[0],
    bill_received_date_back_office: new Date().toISOString().split('T')[0],
    bill_received_by_accounts: '',
    payment_details: '',
    handover_to: '',
    remarks: ''
  });

  const [evaluation, setEvaluation] = useState(null);
  const fileInputRef = useRef(null);

  const loadMasterStatus = async () => {
    try {
      const data = await fetchMasterInfo();
      setMasterInfo(data);
    } catch (e) {
      console.warn('Failed to load master Excel status:', e);
    }
  };

  useEffect(() => {
    loadMasterStatus();
  }, []);

  const handleMasterUpdated = (newInfo) => {
    setMasterInfo(newInfo);
    setErrorMsg('');
    setSuccessMsg(`Master Excel workbook activated: ${newInfo.fileName || 'Bills_Master_Database.xlsx'}`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file) => {
    if (masterInfo && !masterInfo.hasMaster) {
      setErrorMsg('Cannot upload bills yet. Please upload a Master Excel (.xlsx) file first.');
      setIsMasterModalOpen(true);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 10MB limit. Please upload a smaller scan.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|webp)$/i)) {
      setErrorMsg('Unsupported format. Please upload PDF, JPG, or PNG files.');
      return;
    }

    setSelectedFile(file);
    setErrorMsg('');
    setIsProcessing(true);

    try {
      setProcessingStage('Uploading document to disk storage...');
      await new Promise((r) => setTimeout(r, 400));

      setProcessingStage('Running AI / OpenCV preprocessing & LLM extraction...');

      const response = await uploadAndOCR(file);
      setFileData(response.file);
      setEvaluation(response.evaluation);

      // Pre-fill extracted fields automatically from AI / OCR
      setFormData((prev) => {
        const extractedPo = response.extracted.po_number || '';
        const extractedWo = response.extracted.wo_number || '';
        const extractedParty = response.extracted.party_name || response.extracted.suggested_party || '';

        const matchedParty = findMatchingParty(extractedParty);

        return {
          ...prev,
          contractor_name: response.extracted.contractor_name || prev.contractor_name || '',
          invoice_number: response.extracted.invoice_number || prev.invoice_number || '',
          invoice_date: response.extracted.invoice_date || prev.invoice_date || '',
          bill_value: response.extracted.bill_value || prev.bill_value || '',
          // If NA checkbox was pre-checked, keep NA, otherwise auto-fill extracted PO/WO if found
          po_number: prev.po_number_na ? 'NA' : (extractedPo || prev.po_number || ''),
          wo_number: prev.wo_number_na ? 'NA' : (extractedWo || prev.wo_number || ''),
          party_name: matchedParty ? matchedParty : (extractedParty ? '__custom__' : prev.party_name),
          custom_party: (!matchedParty && extractedParty) ? extractedParty : prev.custom_party
        };
      });

    } catch (err) {
      console.error('OCR Processing error:', err);
      setErrorMsg(err.message || 'Error occurred while processing OCR.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (masterInfo && !masterInfo.hasMaster) {
      setErrorMsg('No active Master Excel workbook configured. Please upload a Master Excel file first.');
      setIsMasterModalOpen(true);
      return;
    }

    // Determine final party name
    const finalParty = formData.party_name === '__custom__'
      ? formData.custom_party.trim()
      : formData.party_name;

    if (!finalParty) {
      setErrorMsg('Please select or specify the Name of Party (receiving internal branch).');
      return;
    }

    if (!formData.invoice_number.trim()) {
      setErrorMsg('Invoice Number is required.');
      return;
    }

    if (!formData.invoice_date.trim()) {
      setErrorMsg('Invoice Date is required.');
      return;
    }

    if (!formData.bill_value.toString().trim()) {
      setErrorMsg('Bill Value is required.');
      return;
    }

    if (!formData.bill_received_date_site) {
      setErrorMsg('Bill Received Date by Site is required.');
      return;
    }

    if (!formData.bill_received_date_back_office) {
      setErrorMsg('Bill Received Date by Back Office is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        contractor_name: formData.contractor_name.trim(),
        party_name: finalParty,
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
        raw_file_path: fileData?.raw_file_path || ''
      };

      const result = await createBill(payload);
      const masterName = masterInfo?.fileName || 'Bills_Master_Database.xlsx';
      setSuccessMsg(`✓ Bill saved! Automatically recorded in Master Excel (${masterName})`);

      setTimeout(() => {
        if (onBillCreated) {
          onBillCreated(result.bill);
        }
      }, 900);

    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileData(null);
    setEvaluation(null);
    setErrorMsg('');
    setSuccessMsg('');
    setFormData({
      contractor_name: '',
      party_name: '',
      custom_party: '',
      po_number: '',
      po_number_na: false,
      wo_number: '',
      wo_number_na: false,
      po_date: '',
      po_date_na: false,
      invoice_number: '',
      invoice_date: '',
      bill_value: '',
      bill_received_date_site: new Date().toISOString().split('T')[0],
      bill_received_date_back_office: new Date().toISOString().split('T')[0],
      bill_received_by_accounts: '',
      payment_details: '',
      handover_to: '',
      remarks: ''
    });
  };

  const hasMaster = masterInfo?.hasMaster ?? false;

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"
            title="Back to Bills"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Ingest & Process Physical Bill
            </h2>
            <p className="text-xs text-slate-500">
              Upload scanned invoice &bull; AI extraction &bull; Atomic append to Master Excel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {hasMaster ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Active Master: <strong className="font-mono">{masterInfo.fileName || 'Bills_Master_Database.xlsx'}</strong></span>
              <button
                type="button"
                onClick={() => setIsMasterModalOpen(true)}
                className="text-emerald-700 hover:text-emerald-900 underline font-semibold ml-1 text-[11px]"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold hover:bg-amber-100"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>Upload Master Excel First</span>
            </button>
          )}

          {fileData && (
            <button
              onClick={handleReset}
              className="btn-secondary text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload Another File</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Validation Alert</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-700 flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Warning Banner if No Master Workbook Exists */}
      {!hasMaster && (
        <div className="mb-6 p-5 bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Master Excel Workbook Required
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 max-w-xl leading-relaxed">
                Before uploading bills, please upload your Master Excel file (<code className="font-mono font-semibold">.xlsx</code>). All extracted bill data will be saved directly into this workbook on the server.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMasterModalOpen(true)}
            className="btn-primary text-xs px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shrink-0 shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Master Excel (.xlsx)</span>
          </button>
        </div>
      )}

      {/* Step 1: File Upload Screen */}
      {!fileData && !isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[440px]">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => {
              if (!hasMaster) {
                setIsMasterModalOpen(true);
              } else {
                fileInputRef.current?.click();
              }
            }}
            className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-150 ${
              !hasMaster
                ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                : dragActive
                ? 'border-blue-600 bg-blue-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-slate-400 bg-white shadow-sm'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              disabled={!hasMaster}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-600 shadow-inner">
              <UploadCloud className={`w-8 h-8 ${hasMaster ? 'text-blue-700' : 'text-amber-600'} stroke-[1.6]`} />
            </div>

            <h3 className="text-base font-semibold text-slate-800 mb-1">
              {hasMaster ? 'Drag and drop your bill or invoice here' : 'Set up Master Excel first to enable uploads'}
            </h3>
            <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
              {hasMaster
                ? 'Accepts physical bill scans, photos, or digital receipts in PDF, JPG, PNG format (Max: 10MB).'
                : 'Click here or use the banner above to upload your Master Excel file.'}
            </p>

            <button
              type="button"
              className={`btn-primary text-xs px-5 py-2.5 pointer-events-none ${!hasMaster ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            >
              {hasMaster ? (
                <>
                  <FileUp className="w-4 h-4" />
                  <span>Browse Bill Scan</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Upload Master Excel First</span>
                </>
              )}
            </button>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center">
              <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Pre-Select NA Fields (Optional)
                  </span>
                  <span className="text-[11px] text-slate-500">Checked fields will automatically default to "NA"</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:border-slate-300 select-none text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={formData.po_number_na}
                      onChange={() => handleNaToggle('po_number')}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">PO Number (NA)</span>
                  </label>

                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:border-slate-300 select-none text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={formData.wo_number_na}
                      onChange={() => handleNaToggle('wo_number')}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">WO Number (NA)</span>
                  </label>

                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 cursor-pointer hover:border-slate-300 select-none text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={formData.po_date_na}
                      onChange={() => handleNaToggle('po_date')}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-slate-700 font-medium">PO Date (NA)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-left">
              <div className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block">1. Multimodal AI Extraction</span>
                Distinguishes contractor/vendor name, invoice #, date, and value.
              </div>
              <div className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block">2. Automatic Pre-population</span>
                All bill data is extracted and filled automatically into the form.
              </div>
              <div className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block">3. Write-Queue Excel Entry</span>
                Direct atomic write to master Excel without manual retyping.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading & Extraction Progress */}
      {isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <div className="card p-8 max-w-md w-full text-center space-y-4 shadow-md">
            <Loader2 className="w-10 h-10 text-blue-700 animate-spin mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Processing Document</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">{selectedFile?.name}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 font-medium animate-pulse">
              {processingStage}
            </div>
            <p className="text-[11px] text-slate-400">
              Extracting Invoice Number, Invoice Date, and Bill Value...
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Split Screen Verification & Form */}
      {fileData && (
        <form onSubmit={handleSubmit} className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          {/* Left Column: Document File Preview */}
          <div className="lg:col-span-6 flex flex-col h-[700px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Source Document Scan
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {(fileData.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <div className="flex-1">
              <FilePreview
                fileUrl={fileData.raw_file_path}
                fileName={fileData.originalName}
                mimeType={fileData.mimetype}
              />
            </div>
          </div>

          {/* Right Column: Editable Metadata Form */}
          <div className="lg:col-span-6 flex flex-col h-[700px] overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Bill Metadata & Verification
              </span>
              <span className="text-xs text-slate-500">
                Confirm all fields prior to Excel submission
              </span>
            </div>

            <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm p-5 overflow-y-auto space-y-5">
              {/* Top OCR Extraction Status Banner */}
              <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      OCR Extracted Fields
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. OCR Extracted Fields */}
              <div className="space-y-4">
                {/* Contractor / Vendor Name */}
                <div>
                  <label className="form-label flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Contractor / Vendor Name (Sender)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contractor_name}
                    onChange={(e) => handleInputChange('contractor_name', e.target.value)}
                    placeholder="e.g. M/s Sharma Electricals, Apex Supplies"
                    className="form-input"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Identified company or contractor issuing this bill
                  </p>
                </div>

                {/* Invoice / Bill / Reference Number */}
                <div>
                  <label className="form-label flex items-center gap-1.5 mb-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-500" />
                    <span>Invoice / Bill / Ref # *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_number}
                    onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                    placeholder="e.g. INV-2024-001, REF-8821, B-9901"
                    className="form-input"
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="form-label flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Invoice Date *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_date}
                    onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                    placeholder="e.g. 2024-03-15 or 15/03/2024"
                    className="form-input"
                  />
                </div>

                {/* Bill Value */}
                <div>
                  <label className="form-label flex items-center gap-1.5 mb-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                    <span>Bill Value (INR) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bill_value}
                    onChange={(e) => handleInputChange('bill_value', e.target.value)}
                    placeholder="e.g. 15000.00"
                    className="form-input"
                  />
                </div>
              </div>

              {/* 2. Receiving Branch & Party Details */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Receiving Site & Tracking Metadata
                </span>

                {/* Party Name Dropdown */}
                <div>
                  <label className="form-label">
                    Name of Party (Internal Branch / Receiving Location) *
                  </label>
                  <select
                    value={formData.party_name}
                    onChange={(e) => handleInputChange('party_name', e.target.value)}
                    className="form-input mb-2"
                    required
                  >
                    <option value="">-- Select Receiving Party --</option>
                    {DEFAULT_PARTY_OPTIONS.map((party) => (
                      <option key={party} value={party}>
                        {party}
                      </option>
                    ))}
                    <option value="__custom__">+ Enter Custom Party Name</option>
                  </select>

                  {formData.party_name === '__custom__' && (
                    <input
                      type="text"
                      required
                      placeholder="Type specific internal branch name..."
                      value={formData.custom_party}
                      onChange={(e) => handleInputChange('custom_party', e.target.value)}
                      className="form-input bg-blue-50/40 border-blue-300 animate-in fade-in duration-150"
                    />
                  )}
                </div>

                {/* PO Number & WO Number Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="form-label mb-0 text-[11px]">PO Number</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.po_number_na}
                          onChange={() => handleNaToggle('po_number')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>NA</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={formData.po_number_na}
                      value={formData.po_number}
                      onChange={(e) => handleInputChange('po_number', e.target.value)}
                      placeholder={formData.po_number_na ? 'NA' : 'e.g. PO-9801'}
                      className={`form-input text-xs ${formData.po_number_na ? 'bg-slate-100 text-slate-400' : ''}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="form-label mb-0 text-[11px]">WO Number</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.wo_number_na}
                          onChange={() => handleNaToggle('wo_number')}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>NA</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={formData.wo_number_na}
                      value={formData.wo_number}
                      onChange={(e) => handleInputChange('wo_number', e.target.value)}
                      placeholder={formData.wo_number_na ? 'NA' : 'e.g. WO-5512'}
                      className={`form-input text-xs ${formData.wo_number_na ? 'bg-slate-100 text-slate-400' : ''}`}
                    />
                  </div>
                </div>

                {/* PO Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label mb-0 text-[11px]">PO Date</label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.po_date_na}
                        onChange={() => handleNaToggle('po_date')}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>NA</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={formData.po_date_na}
                    value={formData.po_date}
                    onChange={(e) => handleInputChange('po_date', e.target.value)}
                    placeholder={formData.po_date_na ? 'NA' : 'YYYY-MM-DD'}
                    className={`form-input text-xs ${formData.po_date_na ? 'bg-slate-100 text-slate-400' : ''}`}
                  />
                </div>
              </div>

              {/* 3. Dates & Logistics */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Logistics & Reception Dates
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-[11px]">Bill Received by Site *</label>
                    <input
                      type="date"
                      required
                      value={formData.bill_received_date_site}
                      onChange={(e) => handleInputChange('bill_received_date_site', e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="form-label text-[11px]">Received Back Office *</label>
                    <input
                      type="date"
                      required
                      value={formData.bill_received_date_back_office}
                      onChange={(e) => handleInputChange('bill_received_date_back_office', e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-[11px]">Received by Accounts</label>
                    <input
                      type="date"
                      value={formData.bill_received_by_accounts}
                      onChange={(e) => handleInputChange('bill_received_by_accounts', e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="form-label text-[11px]">Handover To (Person)</label>
                    <input
                      type="text"
                      value={formData.handover_to}
                      onChange={(e) => handleInputChange('handover_to', e.target.value)}
                      placeholder="e.g. Ramesh Kumar (Accounts)"
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label text-[11px]">Payment Details / Bank Ref</label>
                  <input
                    type="text"
                    value={formData.payment_details}
                    onChange={(e) => handleInputChange('payment_details', e.target.value)}
                    placeholder="e.g. Cheque #442190 / NEFT Pending / Advance Adjusted"
                    className="form-input text-xs"
                  />
                </div>

                <div>
                  <label className="form-label text-[11px]">Remarks / Notes</label>
                  <textarea
                    rows={2}
                    value={formData.remarks}
                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                    placeholder="Internal audit notes or vendor verification details..."
                    className="form-input text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 sticky bottom-0 bg-white py-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary text-xs"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 flex items-center gap-2 font-semibold shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Writing to Master Excel...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Commit to Master Excel</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Master Excel Upload / Replace Modal */}
      <MasterExcelModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        currentMaster={masterInfo}
        onMasterUpdated={handleMasterUpdated}
      />
    </div>
  );
}
