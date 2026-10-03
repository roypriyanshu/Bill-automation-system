import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  Eye, 
  RefreshCw, 
  X, 
  Download, 
  Loader2, 
  Trash2, 
  AlertOctagon 
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import MasterExcelModal from '../components/MasterExcelModal';
import { fetchBills, getExportExcelUrl, fetchMasterInfo, openMasterExcel, deleteBill } from '../services/api';
import { DEFAULT_PARTY_OPTIONS } from '../constants/parties';

export default function AllBills({ onSelectBill, onNewUpload }) {
  const [bills, setBills] = useState([]);
  const [parties, setParties] = useState(DEFAULT_PARTY_OPTIONS);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [masterInfo, setMasterInfo] = useState(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [openingExcel, setOpeningExcel] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotification, setDeleteNotification] = useState(null);


  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partyFilter, setPartyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const loadData = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchBills({
        page,
        limit: pagination.limit,
        search,
        status: statusFilter,
        party: partyFilter,
        sortBy,
        sortOrder
      });
      setBills(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      
      // Combine official options with any distinct parties from the database
      const combinedParties = Array.from(
        new Set([...DEFAULT_PARTY_OPTIONS, ...(res.parties || [])])
      ).filter(Boolean).sort();
      setParties(combinedParties);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [statusFilter, partyFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPartyFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const handleDeletePrompt = (e, bill) => {
    e.stopPropagation();
    setBillToDelete(bill);
  };

  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBill(billToDelete.id);
      setDeleteNotification({
        type: 'success',
        text: `Record for Invoice #${billToDelete.invoice_number || billToDelete.id.substring(0, 8)} successfully deleted from Excel database.`
      });
      setBillToDelete(null);
      await loadData(pagination.page);
    } catch (err) {
      setDeleteNotification({
        type: 'error',
        text: err.message || 'Failed to delete bill record.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 h-full flex flex-col overflow-y-auto">
      {/* Notification Toast */}
      {deleteNotification && (
        <div
          className={`p-3 rounded-md text-xs flex items-center justify-between shrink-0 transition-all ${
            deleteNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span className="font-medium">{deleteNotification.text}</span>
          <button
            onClick={() => setDeleteNotification(null)}
            className="text-xs font-bold underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="card p-4 space-y-3 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Invoice #, Party, PO/WO, Remarks..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-800"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); loadData(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Filters and Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="validated">Validated</option>
              <option value="needs_review">Needs Review</option>
              <option value="duplicate">Duplicate</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>

            {/* Party Filter */}
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-800 max-w-[180px] truncate"
            >
              <option value="all">All Parties / Sites</option>
              {parties.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {(search || statusFilter !== 'all' || partyFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                title="Reset Filters"
              >
                Clear Filters
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {/* Master Excel Open, Download & Upload actions */}
            <button
              onClick={async () => {
                setOpeningExcel(true);
                try {
                  await openMasterExcel();
                } catch (e) {
                  alert(e.message || 'Failed to open Excel');
                } finally {
                  setOpeningExcel(false);
                }
              }}
              disabled={openingExcel}
              className="btn-secondary text-xs h-8 px-2.5 border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1.5 shadow-sm"
              title="Launch and open the live Master Excel file on your PC in Microsoft Excel"
            >
              {openingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Open in Excel</span>
            </button>

            <a
              href={getExportExcelUrl()}
              download="Bills_Master_Database.xlsx"
              className="btn-secondary text-xs h-8 px-2.5 flex items-center gap-1.5"
              title="Download current Master Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </a>

            <button
              onClick={() => setIsMasterModalOpen(true)}
              className="btn-secondary text-xs h-8 px-2.5 flex items-center gap-1.5"
              title="Replace or upload Master Excel file"
            >
              <span>Replace File</span>
            </button>

            <button
              onClick={onNewUpload}
              className="btn-primary text-xs h-8 px-3 bg-blue-700 hover:bg-blue-800"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Bill</span>
            </button>
          </div>
        </div>
      </div>


      {/* Main Data Table */}
      <div className="card overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider text-[11px] select-none sticky top-0 z-10 shadow-sm">
                <th 
                  onClick={() => handleSort('invoice_number')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Invoice #</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('party_name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Party (Receiving Site)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('invoice_date')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Invoice Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('bill_value')}
                  className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Bill Value</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">PO / WO</th>
                <th className="py-3 px-4">Received (Site / BackOffice)</th>
                <th 
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                    <span>Loading master records...</span>
                  </td>
                </tr>
              ) : bills.length > 0 ? (
                bills.map((bill) => (
                  <tr
                    key={bill.id}
                    onClick={() => onSelectBill(bill.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{bill.invoice_number || '—'}</span>
                        {bill.invoice_number_confidence > 0 && (
                          <ConfidenceBadge score={bill.invoice_number_confidence} />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-[200px]" title={bill.party_name}>
                      {bill.contractor_name && (
                        <div className="text-[11px] font-semibold text-blue-800 truncate flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-normal">From:</span>
                          <span>{bill.contractor_name}</span>
                        </div>
                      )}
                      <div className="text-xs text-slate-700 truncate">
                        <span className="text-[10px] text-slate-400 font-normal">To: </span>
                        <span>{bill.party_name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {bill.invoice_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {bill.bill_value ? `₹${parseFloat(bill.bill_value).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      <div>PO: {bill.po_number || 'NA'}</div>
                      <div>WO: {bill.wo_number || 'NA'}</div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                      <div>Site: {bill.bill_received_date_site || '—'}</div>
                      <div>BO: {bill.bill_received_date_back_office || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={bill.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBill(bill.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline px-1.5 py-1 rounded hover:bg-blue-50"
                          title="Inspect Bill Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                        <button
                          onClick={(e) => handleDeletePrompt(e, bill)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline px-1.5 py-1 rounded hover:bg-rose-50 transition-colors"
                          title="Delete from Excel database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No matching bills found in the master database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800">{bills.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</strong> to{' '}
              <strong className="text-slate-800">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
              <strong className="text-slate-800">{pagination.total}</strong> records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              className="btn-secondary text-xs h-7 px-2.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="font-mono text-xs text-slate-700 px-2">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => loadData(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="btn-secondary text-xs h-7 px-2.5 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      {billToDelete && (
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
                    <strong className="font-mono text-slate-800">{billToDelete.invoice_number || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Party:</span>
                    <span className="text-slate-700 truncate max-w-[200px]">{billToDelete.party_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {billToDelete.bill_value ? `₹${parseFloat(billToDelete.bill_value).toFixed(2)}` : '—'}
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
                onClick={() => setBillToDelete(null)}
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
      {/* Master Excel Upload / Replace Modal */}
      <MasterExcelModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        currentMaster={masterInfo}
        onMasterUpdated={(newInfo) => {
          setMasterInfo(newInfo);
          loadData(1);
        }}
      />
    </div>
  );
}
