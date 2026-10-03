import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function ConfidenceBadge({ score, threshold = 80 }) {
  const numericScore = parseFloat(score) || 0;
  const isHigh = numericScore >= threshold;
  const isVerified = numericScore >= 99.9;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
        isHigh
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-300 font-semibold'
      }`}
      title={isHigh ? `Confidence ${numericScore.toFixed(1)}% (Verified / High)` : `Low confidence (${numericScore.toFixed(1)}% < ${threshold}%) - Needs verification`}
    >
      {isHigh ? (
        <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
      ) : (
        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
      )}
      <span>{numericScore.toFixed(1)}%</span>
      {isVerified ? (
        <span className="text-[10px] text-emerald-800 uppercase tracking-tighter ml-0.5 font-bold">Verified</span>
      ) : !isHigh ? (
        <span className="text-[10px] text-amber-800 uppercase tracking-tighter ml-0.5">Low</span>
      ) : null}
    </span>
  );
}
