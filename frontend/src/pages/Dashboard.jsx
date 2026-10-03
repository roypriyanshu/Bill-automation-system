import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Copy,
  XCircle,
  TrendingUp,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Clock,
  Download,
  RefreshCw,
  Check,
  FileCheck,
  Layers,
  ArrowUpRight,
  FolderOpen,
  Loader2
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import MasterExcelModal from '../components/MasterExcelModal';
import { getExportExcelUrl, fetchMasterInfo, openMasterExcel, openMasterFolder } from '../services/api';

export default function Dashboard({ stats, error, onRetry, onNavigate, onSelectBill }) {
  const [masterInfo, setMasterInfo] = useState(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [openingExcel, setOpeningExcel] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);

  const loadMasterInfo = async () => {
    try {
      const data = await fetchMasterInfo();
      setMasterInfo(data);
    } catch (e) {
      console.error('Failed to load master Excel info:', e);
    }
  };

  const handleOpenExcel = async () => {
    setOpeningExcel(true);
    try {
      await openMasterExcel();
      setActionNotice('Opened in Microsoft Excel!');
      setTimeout(() => setActionNotice(''), 3500);
    } catch (err) {
      alert(err.message || 'Failed to open Excel file.');
    } finally {
      setOpeningExcel(false);
    }
  };

  const handleOpenFolder = async () => {
    setOpeningFolder(true);
    try {
      await openMasterFolder();
      setActionNotice('Opened containing folder in Explorer!');
      setTimeout(() => setActionNotice(''), 3500);
    } catch (err) {
      alert(err.message || 'Failed to open folder.');
    } finally {
      setOpeningFolder(false);
    }
  };

  useEffect(() => {
    loadMasterInfo();
  }, [stats]);

  const handleMasterUpdated = (newInfo) => {
    setMasterInfo(newInfo);
    setActionNotice('Master Excel workbook updated successfully!');
    setTimeout(() => setActionNotice(''), 3500);
    if (onRetry) onRetry();
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

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto h-[60vh]">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Unable to Load Dashboard Data</h3>
          <p className="text-xs text-slate-500 mt-1">
            {error || 'Make sure the backend server is running on port 5000.'}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-primary text-xs bg-blue-700 hover:bg-blue-800"
          >
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 flex flex-col items-center justify-center space-y-3 text-slate-500 h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium">Loading operational metrics...</p>
      </div>
    );
  }

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
  };

  const total = stats.total || 0;
  const needsReviewPct = total > 0 ? Math.round(((stats.needs_review || 0) / total) * 100) : 0;
  const validatedPct = total > 0 ? Math.round(((stats.validated || 0) / total) * 100) : 0;
  const duplicatePct = total > 0 ? Math.round((((stats.duplicate || 0) + (stats.rejected || 0)) / total) * 100) : 0;
  const hasMaster = masterInfo?.hasMaster ?? stats?.hasActiveMaster ?? false;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Persistent Master Excel Status Hub */}
      {hasMaster ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-xl p-5 text-white shadow-md border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Active Server Master Workbook
              </span>
              <span className="text-xs text-slate-400">
                All uploaded bills append to this master file automatically
              </span>
            </div>

            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Active File: <span className="font-mono text-emerald-300 font-normal">{masterInfo?.fileName || 'Bills_Master_Database.xlsx'}</span></span>
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-white">{masterInfo?.recordCount ?? total}</strong> records
              </span>
              <span className="text-slate-500">&bull;</span>
              <span>
                Size: <strong className="text-white">{formatBytes(masterInfo?.fileSizeBytes)}</strong>
              </span>
              <span className="text-slate-500">&bull;</span>
              <span>
                Updated: <strong className="text-white">{formatDate(masterInfo?.lastModified)}</strong>
              </span>
            </div>
          </div>

          {/* Master Excel Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleOpenExcel}
              disabled={openingExcel}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              title="Launch and open the live Master Excel file on your PC in Microsoft Excel"
            >
              {openingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Open in Excel</span>
            </button>

            <button
              onClick={handleOpenFolder}
              disabled={openingFolder}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Reveal active Master Excel file in Windows Explorer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Show in Folder</span>
            </button>

            <a
              href={getExportExcelUrl()}
              download={masterInfo?.fileName || 'Bills_Master_Database.xlsx'}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Download the current Master Excel copy (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download Copy</span>
            </a>

            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Replace the active Master Excel file with a new .xlsx"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Replace File</span>
            </button>

            <button
              onClick={() => onNavigate('upload')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Bill</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border-2 border-dashed border-amber-400/60 rounded-xl p-5 text-amber-950 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200/80 text-amber-900">
                Setup Required
              </span>
              <span className="text-xs font-semibold text-amber-800">
                No active Master Excel workbook configured
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Upload your Master Excel file to start processing bills
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              To record and sync extracted invoices, upload your master <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-slate-800">.xlsx</code> file. It will be stored securely on the server and used for all bill entries.
            </p>
          </div>
          <button
            onClick={() => setIsMasterModalOpen(true)}
            className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-md shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Master Excel (.xlsx)</span>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingested */}
        <div className="card p-5 border-l-4 border-l-blue-600 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Ingested Bills
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total || 0}</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Value: <span className="font-semibold text-slate-700">{formatCurrency(stats.total_amount)}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Validated & Synced */}
        <div className="card p-5 border-l-4 border-l-emerald-600 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Validated & Synced
              </p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">{stats.validated || 0}</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                <span className="font-semibold text-emerald-600">{validatedPct}%</span> pass rate
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Needs Human Review */}
        <div
          onClick={() => onNavigate('needs-review')}
          className="card p-5 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Needs Review
                </p>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              </div>
              <h3 className="text-2xl font-bold text-amber-800 mt-1">{stats.needs_review || 0}</h3>
              <p className="text-[11px] text-amber-700 mt-1 group-hover:underline flex items-center gap-1">
                <span>Pending Verification</span>
                <ArrowRight className="w-3 h-3" />
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Duplicates Detected */}
        <div className="card p-5 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Duplicate Detected
              </p>
              <h3 className="text-2xl font-bold text-rose-700 mt-1">{stats.duplicate || 0}</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Rejected: <span className="font-semibold text-slate-700">{stats.rejected || 0}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <Copy className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Operational Triage Banner (if items need review) */}
      {stats.needs_review > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                {stats.needs_review} Bill{stats.needs_review > 1 ? 's' : ''} Require Attention in Triage Queue
              </h4>
              <p className="text-[11px] text-amber-700">
                Bills flagged for missing fields or human verification before finalizing.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('needs-review')}
            className="btn-secondary text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shrink-0"
          >
            Review Queue
          </button>
        </div>
      )}

      {/* Two Column Layout: Recent Ingestions & Pipeline Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Ingestions Table (2 Columns) */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Master Ingestions</h3>
              <p className="text-xs text-slate-500">Latest invoices processed and saved to Master Excel</p>
            </div>
            <button
              onClick={() => onNavigate('all-bills')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Party Name</th>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_bills && stats.recent_bills.length > 0 ? (
                  stats.recent_bills.map((bill) => (
                    <tr
                      key={bill.id}
                      onClick={() => onSelectBill(bill.id)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="font-semibold text-slate-800">
                        {bill.party_name || '-'}
                      </td>
                      <td className="font-mono text-xs text-slate-700">
                        {bill.invoice_number || '-'}
                      </td>
                      <td className="text-xs text-slate-500">
                        {bill.invoice_date || '-'}
                      </td>
                      <td className="font-medium text-slate-800">
                        {formatCurrency(bill.bill_value)}
                      </td>
                      <td>
                        <StatusBadge status={bill.status} />
                      </td>
                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBill(bill.id);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-400 text-xs">
                      No bills in the master record yet. Upload your first bill.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown & Health Widget (1 Column) */}
        <div className="space-y-6">
          {/* Status Breakdown */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Status Distribution</h3>

            <div className="space-y-3">
              {/* Validated */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Validated & Clean</span>
                  <span className="font-bold text-emerald-700">{stats.validated || 0} ({validatedPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${validatedPct}%` }}></div>
                </div>
              </div>

              {/* Needs Review */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Needs Human Review</span>
                  <span className="font-bold text-amber-700">{stats.needs_review || 0} ({needsReviewPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${needsReviewPct}%` }}></div>
                </div>
              </div>

              {/* Duplicates / Rejected */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Duplicate / Rejected</span>
                  <span className="font-bold text-rose-700">{(stats.duplicate || 0) + (stats.rejected || 0)} ({duplicatePct}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${duplicatePct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card p-5 space-y-3 bg-slate-900 text-white">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('upload')}
                className="w-full py-2 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span>Upload Scanned Bill</span>
                <Upload className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMasterModalOpen(true)}
                className="w-full py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between transition-colors"
              >
                <span>{hasMaster ? 'Replace Master Excel File' : 'Upload Master Excel File'}</span>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              </button>

              <a
                href={getExportExcelUrl()}
                download={masterInfo?.fileName || 'Bills_Master_Database.xlsx'}
                className="w-full py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between transition-colors block"
              >
                <span>Download Master Excel</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </div>

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
