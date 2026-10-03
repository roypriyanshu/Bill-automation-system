import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Upload,
  ShieldCheck,
  ChevronRight,
  FileSpreadsheet,
  Download,
  AlertCircle,
  ExternalLink,
  FolderOpen,
  Loader2,
  Check
} from 'lucide-react';
import { getExportExcelUrl, fetchMasterInfo, openMasterExcel, openMasterFolder } from '../services/api';
import MasterExcelModal from './MasterExcelModal';

export default function Header({ currentTab, selectedBillId, onNewUpload, onRefresh, isRefreshing }) {
  const [masterInfo, setMasterInfo] = useState(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [openingExcel, setOpeningExcel] = useState(false);
  const [openStatus, setOpenStatus] = useState('');

  const loadMasterStatus = async () => {
    try {
      const data = await fetchMasterInfo();
      setMasterInfo(data);
    } catch (e) {
      console.warn('Header: Failed to load master info:', e);
    }
  };

  useEffect(() => {
    loadMasterStatus();
  }, [isRefreshing]);

  const handleMasterUpdated = (newInfo) => {
    setMasterInfo(newInfo);
    if (onRefresh) onRefresh();
  };

  const handleOpenExcel = async () => {
    setOpeningExcel(true);
    setOpenStatus('');
    try {
      await openMasterExcel();
      setOpenStatus('Opened!');
      setTimeout(() => setOpenStatus(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to open Excel on this machine.');
    } finally {
      setOpeningExcel(false);
    }
  };

  const getBreadcrumb = () => {
    if (selectedBillId) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="capitalize">{currentTab.replace('-', ' ')}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono font-medium text-slate-800">Bill ID: {selectedBillId.substring(0, 8)}...</span>
        </div>
      );
    }
    return (
      <span className="text-xs font-medium text-slate-500 capitalize">
        Operations &bull; {currentTab.replace('-', ' ')}
      </span>
    );
  };

  const getTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Operations Dashboard';
      case 'all-bills':
        return 'All Bills Master Record';
      case 'needs-review':
        return 'Needs Review & Triage Queue';
      case 'upload':
        return 'Upload & Ingest Bill';
      case 'bill-detail':
        return 'Bill Inspection & Verification';
      default:
        return 'Bill Management';
    }
  };

  const hasMaster = masterInfo?.hasMaster ?? false;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none">
      <div>
        {getBreadcrumb()}
        <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none mt-1">
          {getTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Quick Open in Excel Button */}
        {hasMaster && (
          <button
            onClick={handleOpenExcel}
            disabled={openingExcel}
            className="btn-secondary text-xs h-9 px-3 border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1.5 shadow-sm"
            title="Directly launch and open the live Master Excel file on your PC"
          >
            {openingExcel ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : openStatus ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{openStatus || 'Open in Excel'}</span>
          </button>
        )}

        {/* Master Excel Quick Status & Action Pill */}
        {hasMaster ? (
          <div className="flex items-center gap-1.5 p-1 pl-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 hidden sm:inline">Master:</span>
            <span className="font-mono font-semibold text-slate-800 max-w-[120px] truncate" title={masterInfo.fileName}>
              {masterInfo.fileName || 'Bills_Master_Database.xlsx'}
            </span>
            <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-1">
              <a
                href={getExportExcelUrl()}
                download={masterInfo.fileName || 'Bills_Master_Database.xlsx'}
                className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-emerald-700 transition-colors"
                title="Download current Master Excel copy (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setIsMasterModalOpen(true)}
                className="px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded"
                title="Replace Master Excel file"
              >
                Replace
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsMasterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors animate-pulse"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Setup Master Excel</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-secondary text-xs h-9 px-3"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {currentTab !== 'upload' && (
          <button
            onClick={onNewUpload}
            className="btn-primary text-xs h-9"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Bill</span>
          </button>
        )}
      </div>

      <MasterExcelModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        currentMaster={masterInfo}
        onMasterUpdated={handleMasterUpdated}
      />
    </header>
  );
}
