import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Plus,
  Trash2,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { collectionService } from '../../services/collectionService';
import { retailerService } from '../../services/retailerService';
import { reportExportService } from '../../services/reportService';
import { useApp } from '../../context/AppContext';
import { DataTable, type Column } from '../../components/common/DataTable';
import { DateRangeFilter } from '../../components/common/DateRangeFilter';
import { formatINR } from '../../utils/money';
import { formatDateDisplay, getDateRangeFromFilter, type DateFilterType } from '../../utils/date';
import type { Collection, Retailer, PaymentMethodType, ChequeStatusType } from '../../types';
import { CollectionFormModal } from './CollectionFormModal';

export const CollectionsPage: React.FC = () => {
  const {
    showToast,
    askConfirmation,
    openRetailerLedger,
    operatorName,
    isCollectionModalOpen: isFormOpen,
    setIsCollectionModalOpen: setIsFormOpen,
  } = useApp();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [retailersMap, setRetailersMap] = useState<Map<number, Retailer>>(new Map());

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethodType | 'all'>('all');

  const loadData = async () => {
    const range = getDateRangeFromFilter(dateFilter, customFrom, customTo);
    const colList = await collectionService.getCollections({
      fromDate: range.from,
      toDate: range.to,
      paymentMethod: methodFilter === 'all' ? undefined : methodFilter,
    });

    const rets = await retailerService.getAll();
    const rMap = new Map<number, Retailer>();
    rets.forEach((r) => rMap.set(r.id!, r));

    setCollections(colList);
    setRetailersMap(rMap);
  };

  useEffect(() => {
    loadData();
  }, [dateFilter, customFrom, customTo, methodFilter]);

  // Method-wise aggregations
  let totalCash = 0;
  let totalGPay = 0;
  let totalChequeConfirmed = 0;
  let totalChequePending = 0;
  let totalBankTransfer = 0;
  let totalOther = 0;

  for (const c of collections) {
    if (c.paymentMethod === 'CASH') {
      totalCash += c.totalAmount;
    } else if (c.paymentMethod === 'GPAY') {
      totalGPay += c.totalAmount;
    } else if (c.paymentMethod === 'CHEQUE') {
      if (c.chequeStatus === 'CLEARED') {
        totalChequeConfirmed += c.totalAmount;
      } else if (c.chequeStatus === 'RECEIVED') {
        totalChequePending += c.totalAmount;
      }
    } else if (c.paymentMethod === 'BANK_TRANSFER') {
      totalBankTransfer += c.totalAmount;
    } else {
      totalOther += c.totalAmount;
    }
  }

  const totalConfirmedCollections =
    totalCash + totalGPay + totalChequeConfirmed + totalBankTransfer + totalOther;

  const handleChequeStatusToggle = (col: Collection) => {
    if (col.paymentMethod !== 'CHEQUE') return;

    const nextStatus: ChequeStatusType =
      col.chequeStatus === 'RECEIVED'
        ? 'CLEARED'
        : col.chequeStatus === 'CLEARED'
        ? 'BOUNCED'
        : 'RECEIVED';

    askConfirmation({
      title: `Update Cheque Status to ${nextStatus}?`,
      message: `Cheque #${col.chequeNumber || col.collectionNumber} for ${formatINR(col.totalAmount)} will be set to ${nextStatus}. Only CLEARED cheques reduce confirmed outstanding balance.`,
      confirmText: `Set to ${nextStatus}`,
      onConfirm: async () => {
        try {
          await collectionService.updateChequeStatus(
            col.id!,
            nextStatus,
            `Operator updated cheque status to ${nextStatus}`,
            operatorName
          );
          showToast({ type: 'info', message: `Cheque status updated to ${nextStatus}` });
          loadData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Failed to update cheque status' });
        }
      },
    });
  };

  const handleVoidCollection = (col: Collection) => {
    askConfirmation({
      title: `Void Collection Receipt #${col.collectionNumber}?`,
      message: `Are you sure you want to void this collection of ${formatINR(col.totalAmount)}? The retailer's outstanding balance will be restored automatically.`,
      confirmText: 'Yes, Void Collection',
      isDanger: true,
      onConfirm: async () => {
        try {
          await collectionService.voidCollection(col.id!, 'Voided by business operator', operatorName);
          showToast({ type: 'warning', message: `Receipt #${col.collectionNumber} voided` });
          loadData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Failed to void collection' });
        }
      },
    });
  };

  const handleExportExcel = () => {
    const exportRows = collections.map((c, idx) => ({
      'S.No': idx + 1,
      'Receipt No': c.collectionNumber,
      'Date': c.date,
      'Retailer Name': retailersMap.get(c.retailerId)?.retailerName || '-',
      'Amount (₹)': (c.totalAmount / 100).toFixed(2),
      'Payment Method': c.paymentMethod,
      'Cheque Status': c.chequeStatus || '-',
      'Cheque Number': c.chequeNumber || '',
      'Bank Name': c.bankName || '',
      'Salesman': c.salesmanName || '',
      'Remarks': c.remarks || '',
    }));
    reportExportService.exportToExcel(`Collections_${dateFilter}`, 'Collections', exportRows);
  };

  const handleExportPdf = () => {
    const columns = ['S.No', 'Date', 'Receipt No', 'Retailer', 'Method', 'Status', 'Amount (₹)'];
    const rows = collections.map((c, idx) => [
      idx + 1,
      formatDateDisplay(c.date),
      c.collectionNumber,
      retailersMap.get(c.retailerId)?.retailerName || '-',
      c.paymentMethod,
      c.chequeStatus || 'CONFIRMED',
      (c.totalAmount / 100).toFixed(2),
    ]);
    const summaryRow = ['TOTAL', '', '', '', '', `${collections.length} Receipts`, (totalConfirmedCollections / 100).toFixed(2)];

    reportExportService.exportToPdf({
      title: 'Daily Collections Report',
      subtitle: `Payment Receipts Summary • Period: ${dateFilter}`,
      fileName: `Collections_${dateFilter}`,
      columns,
      rows,
      summaryRow,
    });
  };

  const columns: Column<Collection>[] = [
    {
      key: 'collectionNumber',
      header: 'Receipt No',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          {row.collectionNumber}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span>{formatDateDisplay(row.date)}</span>,
    },
    {
      key: 'retailerId',
      header: 'Retailer Name',
      render: (row) => {
        const ret = retailersMap.get(row.retailerId);
        return (
          <button
            onClick={() => ret && openRetailerLedger(ret.id!)}
            className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 text-left"
          >
            {ret ? ret.retailerName : `Retailer #${row.retailerId}`}
          </button>
        );
      },
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      render: (row) => {
        const badges = {
          CASH: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
          GPAY: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
          CHEQUE: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          BANK_TRANSFER: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
          OTHER: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
        };
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              badges[row.paymentMethod] || badges.OTHER
            }`}
          >
            {row.paymentMethod}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Clearance Status',
      render: (row) => {
        if (row.paymentMethod !== 'CHEQUE') {
          return (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirmed</span>
            </span>
          );
        }

        return (
          <button
            onClick={() => handleChequeStatusToggle(row)}
            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
              row.chequeStatus === 'CLEARED'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : row.chequeStatus === 'BOUNCED'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {row.chequeStatus === 'CLEARED' && <CheckCircle2 className="w-3 h-3" />}
            {row.chequeStatus === 'RECEIVED' && <Clock className="w-3 h-3" />}
            {row.chequeStatus === 'BOUNCED' && <XCircle className="w-3 h-3" />}
            <span>{row.chequeStatus || 'RECEIVED'}</span>
          </button>
        );
      },
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {formatINR(row.totalAmount)}
        </span>
      ),
    },
    {
      key: 'remarks',
      header: 'Details / Remarks',
      render: (row) => {
        const details: string[] = [];
        if (row.chequeNumber) details.push(`Chq: ${row.chequeNumber}`);
        if (row.bankName) details.push(row.bankName);
        if (row.salesmanName) details.push(`Rep: ${row.salesmanName}`);
        if (row.remarks) details.push(row.remarks);

        return (
          <span className="text-slate-500 text-[11px] truncate max-w-xs block">
            {details.join(' • ') || '-'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          onClick={() => handleVoidCollection(row)}
          title="Void Collection"
          className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span>Retailer Collections & Settlements</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Log collections received with manual bill-wise allocation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Collection</span>
          </button>
        </div>
      </div>

      {/* Simplified 2-Card Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Total Confirmed Collections */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Confirmed Collections Received
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 num-cell text-left tracking-tight">
              {formatINR(totalConfirmedCollections)}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 mt-1.5 font-medium">
              <span>Cash: <strong className="text-slate-800 dark:text-slate-200">{formatINR(totalCash, false)}</strong></span>
              <span>•</span>
              <span>GPay: <strong className="text-slate-800 dark:text-slate-200">{formatINR(totalGPay, false)}</strong></span>
              <span>•</span>
              <span>Cleared Chq: <strong className="text-slate-800 dark:text-slate-200">{formatINR(totalChequeConfirmed, false)}</strong></span>
              <span>•</span>
              <span>Bank Transfer: <strong className="text-slate-800 dark:text-slate-200">{formatINR(totalBankTransfer, false)}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: Cheques in Hand (Pending) */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cheques Awaiting Bank Clearance
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 num-cell text-left tracking-tight">
              {formatINR(totalChequePending)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Received in hand • Not yet cleared into bank account
            </p>
          </div>
        </div>
      </div>

      {/* Streamlined Filter Bar */}
      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter
          selectedFilter={dateFilter}
          onChange={setDateFilter}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(from, to) => {
            setCustomFrom(from);
            setCustomTo(to);
          }}
        />

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500">Method:</span>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="all">All Methods</option>
            <option value="CASH">Cash Only</option>
            <option value="GPAY">GPay Only</option>
            <option value="CHEQUE">Cheque Only</option>
            <option value="BANK_TRANSFER">Bank Transfer Only</option>
          </select>
        </div>
      </div>

      {/* Collections DataTable */}
      <DataTable
        columns={columns}
        data={collections}
        searchPlaceholder="Search receipt number, cheque or retailer..."
        emptyMessage="No collection receipts found for this period."
        emptyAction={
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs transition mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record New Collection</span>
          </button>
        }
      />

      {/* Collection Form Modal */}
      <CollectionFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
};
