import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Clock, Copy } from 'lucide-react';

export default function StatusBadge({ status, size = 'md' }) {
  const normalized = (status || 'pending').toLowerCase();

  const config = {
    validated: {
      label: 'Validated',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
      dot: 'bg-emerald-500'
    },
    needs_review: {
      label: 'Needs Review',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: AlertTriangle,
      dot: 'bg-amber-500'
    },
    duplicate: {
      label: 'Duplicate',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: Copy,
      dot: 'bg-rose-500'
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: XCircle,
      dot: 'bg-rose-500'
    },
    pending: {
      label: 'Pending',
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: Clock,
      dot: 'bg-slate-400'
    }
  };

  const item = config[normalized] || config.pending;
  const Icon = item.icon;

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs font-medium' 
    : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${item.bg} ${sizeClasses} tracking-tight whitespace-nowrap`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
      <span>{item.label}</span>
    </span>
  );
}
