import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  RefreshCw,
  Info,
  Download
} from 'lucide-react';
import { uploadMasterExcel, getExportExcelUrl } from '../services/api';

export default function MasterExcelModal({ isOpen, onClose, currentMaster, onMasterUpdated }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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

  const handleFileSelected = (selected) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMsg('Invalid file format. Please select an Excel workbook (.xlsx).');
      setFile(null);
      return;
    }

    if (selected.size > 25 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 25MB limit.');
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleUploadSubmit = async () => {
    if (!file) {
      setErrorMsg('Please choose an .xlsx file first.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await uploadMasterExcel(file);
      setSuccessMsg(response.message || 'Master Excel file successfully activated!');
      setFile(null);
      if (onMasterUpdated) {
        onMasterUpdated(response.masterInfo);
      }
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload Master Excel file.');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const isReplacing = currentMaster && currentMaster.hasMaster;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight">
                {isReplacing ? 'Replace Master Excel File' : 'Upload Master Excel File'}
              </h3>
              <p className="text-xs text-slate-400">
                Persistent server-side master database for all bill extractions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Current Master Info (if active) */}
          {isReplacing && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Currently Active Workbook:
                </span>
                <a
                  href={getExportExcelUrl()}
                  download={currentMaster.fileName || 'Bills_Master_Database.xlsx'}
                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                >
                  <Download className="w-3 h-3" />
                  Download Backup
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-150">
                <div>
                  <span className="text-slate-400 block">File Name</span>
                  <span className="font-mono font-medium text-slate-800 truncate block">
                    {currentMaster.fileName || 'Bills_Master_Database.xlsx'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Records Stored</span>
                  <span className="font-semibold text-slate-800">
                    {currentMaster.recordCount ?? 0} Bills
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Size</span>
                  <span className="text-slate-700">{formatBytes(currentMaster.fileSizeBytes)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Last Updated</span>
                  <span className="text-slate-700">{formatDate(currentMaster.lastModified)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Guidelines Box */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] text-blue-800 leading-relaxed">
              <p className="font-medium text-blue-950">
                {isReplacing
                  ? 'Replacing the file will set the new .xlsx as the active server workbook.'
                  : 'Upload an .xlsx file once. All future bill uploads will append to this file automatically.'}
              </p>
              <p className="text-blue-700">
                Standard columns (<code className="font-mono text-blue-900 bg-blue-100/70 px-1 py-0.5 rounded">Bills</code>, <code className="font-mono text-blue-900 bg-blue-100/70 px-1 py-0.5 rounded">AuditLog</code>) and any existing records are automatically preserved.
              </p>
            </div>
          </div>

          {/* Upload Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                : file
                ? 'border-emerald-400 bg-emerald-50/20'
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 font-mono break-all">{file.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Click to browse or drag and drop your Master Excel file
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Only <strong className="text-slate-600">.xlsx</strong> files up to 25MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="btn-secondary text-xs px-4 h-9"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={!file || uploading}
            className="btn-primary text-xs px-5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Activating Master Workbook...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>{isReplacing ? 'Replace & Activate' : 'Upload & Set Active'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
