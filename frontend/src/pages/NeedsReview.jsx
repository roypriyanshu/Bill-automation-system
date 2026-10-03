import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { fetchBills } from '../services/api';

export default function NeedsReview({ onSelectBill, onNewUpload }) {
  const [bills, setBills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchBills({
        needs_review_only: 'true',
        limit: 100
      });
      setBills(res.data || []);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getReviewReasons = (bill) => {
    const reasons = [];
    if (bill.status === 'duplicate') {
      reasons.push({
        type: 'duplicate',
        label: 'Duplicate Party + Invoice #',
        color: 'bg-rose-100 text-rose-800 border-rose-200'
      });
    }

    if (!bill.party_name) {
      reasons.push({
        type: 'missing_party',
        label: 'Missing Party Name',
        color: 'bg-amber-100 text-amber-800 border-amber-300'
      });
    }

    if (!bill.invoice_number) {
      reasons.push({
        type: 'missing_inv_num',
        label: 'Missing Invoice #',
        color: 'bg-amber-100 text-amber-800 border-amber-300'
      });
    }

    if (!bill.invoice_date) {
      reasons.push({
        type: 'missing_inv_date',
        label: 'Missing Date',
        color: 'bg-amber-100 text-amber-800 border-amber-300'
      });
    }

    if (!bill.bill_value) {
      reasons.push({
        type: 'missing_bill_val',
        label: 'Missing Value',
        color: 'bg-amber-100 text-amber-800 border-amber-300'
      });
    }

    return reasons;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 h-full flex flex-col overflow-y-auto">
      {/* Information Header */}
      <div className="card p-4 bg-amber-50/40 border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 border border-amber-300 font-bold">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 leading-tight">
              Triage & Review Queue ({bills.length} Items Pending)
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">
              Bills flagged automatically due to missing required fields or duplicate party-invoice detection.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="btn-secondary text-xs h-8 px-3 border-amber-300 bg-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10 select-none shadow-sm">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Party (Receiving Site)</th>
                <th className="py-3 px-4">Flagged Reason</th>
                <th className="py-3 px-4">Invoice Date</th>
                <th className="py-3 px-4 text-right">Bill Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Triage Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                    <span>Checking review items...</span>
                  </td>
                </tr>
              ) : bills.length > 0 ? (
                bills.map((bill) => {
                  const reasons = getReviewReasons(bill);
                  return (
                    <tr
                      key={bill.id}
                      onClick={() => onSelectBill(bill.id)}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {bill.invoice_number || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 truncate max-w-[200px]" title={bill.party_name}>
                        {bill.party_name || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {reasons.map((r, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${r.color}`}
                            >
                              {r.label}
                            </span>
                          ))}
                          {reasons.length === 0 && (
                            <span className="text-[11px] text-slate-400">Manual review flag</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <span>{bill.invoice_date || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        <span>{bill.bill_value ? `₹${parseFloat(bill.bill_value).toFixed(2)}` : '—'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={bill.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBill(bill.id);
                          }}
                          className="btn-primary text-xs h-7 px-3 bg-amber-600 hover:bg-amber-700"
                        >
                          <span>Review &rarr;</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto stroke-[1.5]" />
                      <p className="text-sm font-semibold text-slate-700">Queue is Clear!</p>
                      <p className="text-xs text-slate-400">No bills currently require review or duplicate resolution.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
