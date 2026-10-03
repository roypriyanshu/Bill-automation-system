import React from 'react';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  Database
} from 'lucide-react';
import { getExportExcelUrl } from '../services/api';

export default function Sidebar({ currentTab, setTab, needsReviewCount = 0 }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'all-bills',
      label: 'All Bills',
      icon: FileText,
      badge: null
    },
    {
      id: 'needs-review',
      label: 'Needs Review',
      icon: AlertTriangle,
      badge: needsReviewCount > 0 ? needsReviewCount : null,
      badgeColor: 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
    },
    {
      id: 'upload',
      label: 'Upload Bill',
      icon: UploadCloud,
      badge: null
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white uppercase">
            Bill Operations
          </h1>
          {/* <p className="text-[11px] text-slate-400 font-mono tracking-tighter">
            Excel & PaddleOCR Engine
          </p>  */}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="p-3 space-y-1 flex-1">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Workspace Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${isActive
                      ? 'bg-white/20 text-white font-semibold'
                      : item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Master Excel Export */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30">
        <a
          href={getExportExcelUrl()}
          download
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-md hover:bg-emerald-900/60 hover:text-emerald-300 transition-colors shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Export Master Excel (.xlsx)</span>
        </a>
      </div>
    </aside>
  );
}
