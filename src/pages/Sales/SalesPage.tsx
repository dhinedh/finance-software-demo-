import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Printer,
  Calendar,
  Store,
  MapPin,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { salesService } from '../../services/salesService';
import { retailerService } from '../../services/retailerService';
import { beatService } from '../../services/beatService';
import { reportExportService } from '../../services/reportService';
import { useApp } from '../../context/AppContext';
import { DataTable, type Column } from '../../components/common/DataTable';
import { DateRangeFilter } from '../../components/common/DateRangeFilter';
import { formatINR } from '../../utils/money';
import { formatDateDisplay, getDateRangeFromFilter, type DateFilterType } from '../../utils/date';
import type { Sale, Retailer, Beat } from '../../types';
import { SaleFormModal } from './SaleFormModal';

export const SalesPage: React.FC = () => {
  const {
    showToast,
    askConfirmation,
    openRetailerLedger,
    isSaleModalOpen: isFormOpen,
    setIsSaleModalOpen: setIsFormOpen,
  } = useApp();
  const [sales, setSales] = useState<Sale[]>([]);
  const [retailersMap, setRetailersMap] = useState<Map<number, Retailer>>(new Map());
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatMap, setBeatMap] = useState<Map<number, string>>(new Map());

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedBeatId, setSelectedBeatId] = useState<number | 'all'>('all');

  // Modal
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const loadData = async () => {
    const range = getDateRangeFromFilter(dateFilter, customFrom, customTo);
    const saleList = await salesService.getSales({
      fromDate: range.from,
      toDate: range.to,
      beatId: selectedBeatId === 'all' ? undefined : selectedBeatId,
    });

    const rets = await retailerService.getAll();
    const rMap = new Map<number, Retailer>();
    rets.forEach((r) => rMap.set(r.id!, r));

    const bList = await beatService.getAll();
    const bMap = new Map<number, string>();
    bList.forEach((b) => bMap.set(b.id!, b.name));

    setSales(saleList);
    setRetailersMap(rMap);
    setBeats(bList);
    setBeatMap(bMap);
  };

  useEffect(() => {
    loadData();
  }, [dateFilter, customFrom, customTo, selectedBeatId]);

  const totalSalesAmount = sales.reduce((sum, s) => sum + s.billAmount, 0);

  const handleOpenAdd = () => {
    setEditingSale(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setIsFormOpen(true);
  };

  const handleVoidSale = (sale: Sale) => {
    askConfirmation({
      title: `Void Sales Bill #${sale.billNumber}?`,
      message: `Are you sure you want to void this sales bill of ${formatINR(sale.billAmount)}? Financial records are reversed for audit safety, not permanently deleted.`,
      confirmText: 'Yes, Void Bill',
      isDanger: true,
      onConfirm: async () => {
        try {
          await salesService.voidSale(sale.id!, 'Voided by business operator');
          showToast({ type: 'warning', message: `Bill #${sale.billNumber} voided` });
          loadData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Failed to void bill' });
        }
      },
    });
  };

  const handleExportExcel = () => {
    const exportRows = sales.map((s, idx) => ({
      'S.No': idx + 1,
      'Serial No': s.serialNumber,
      'Sales Date': s.date,
      'Collection Date': s.collectionDate || s.date,
      'Bill Number': s.billNumber,
      'Retailer Name': retailersMap.get(s.retailerId)?.retailerName || `ID ${s.retailerId}`,
      'Beat': beatMap.get(s.beatIdAtTransaction) || '-',
      'Bill Amount (₹)': (s.billAmount / 100).toFixed(2),
      'GST Breakdown (₹)': s.gstAmount ? (s.gstAmount / 100).toFixed(2) : '0.00',
      'Remarks': s.remarks || '',
    }));
    reportExportService.exportToExcel(`DailySales_${dateFilter}`, 'DailySales', exportRows);
  };

  const handleExportPdf = () => {
    const columns = ['S.No', 'Date', 'Collection Due', 'Bill No', 'Retailer', 'Beat', 'Amount (₹)', 'Remarks'];
    const rows = sales.map((s, idx) => [
      idx + 1,
      formatDateDisplay(s.date),
      formatDateDisplay(s.collectionDate || s.date),
      s.billNumber,
      retailersMap.get(s.retailerId)?.retailerName || '-',
      beatMap.get(s.beatIdAtTransaction) || '-',
      (s.billAmount / 100).toFixed(2),
      s.remarks || '-',
    ]);
    const summaryRow = ['TOTAL', '', '', '', '', `${sales.length} Bills`, (totalSalesAmount / 100).toFixed(2), ''];

    reportExportService.exportToPdf({
      title: 'Daily Sales Report',
      subtitle: `Filtered Sales Summary • Period: ${dateFilter}`,
      fileName: `DailySales_${dateFilter}`,
      columns,
      rows,
      summaryRow,
    });
  };

  const columns: Column<Sale>[] = [
    {
      key: 'serialNumber',
      header: 'S.No / Serial',
      render: (row) => (
        <span className="font-mono text-slate-500 font-semibold">{row.serialNumber}</span>
      ),
    },
    {
      key: 'date',
      header: 'Sales Date',
      render: (row) => <span>{formatDateDisplay(row.date)}</span>,
    },
    {
      key: 'collectionDate',
      header: 'Collection Due',
      render: (row) => (
        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-medium">
          <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
          <span>{formatDateDisplay(row.collectionDate || row.date)}</span>
        </span>
      ),
    },
    {
      key: 'billNumber',
      header: 'Bill Number',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          {row.billNumber}
        </span>
      ),
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
      key: 'beatIdAtTransaction',
      header: 'Beat',
      render: (row) => (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          <MapPin className="w-2.5 h-2.5" />
          <span>{beatMap.get(row.beatIdAtTransaction) || 'Unknown'}</span>
        </span>
      ),
    },
    {
      key: 'billAmount',
      header: 'Bill Amount',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {formatINR(row.billAmount)}
        </span>
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => (
        <span className="text-slate-500 text-[11px] truncate max-w-xs block">
          {row.remarks || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            onClick={() => handleOpenEdit(row)}
            title="Edit Bill"
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleVoidSale(row)}
            title="Void Bill"
            className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-sky-600" />
            <span>Daily Sales Entry & Verification</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rapid manual invoice logging to cross-verify distribution billing records.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-sky-300" />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      {/* Filter & Metric Bar */}
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

        <div className="flex items-center space-x-4">
          {/* Beat Selector */}
          <select
            value={selectedBeatId}
            onChange={(e) =>
              setSelectedBeatId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="all">All Beats</option>
            {beats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Sales Metric */}
          <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">Period Total:</span>
            <span className="text-sm font-bold text-navy-900 dark:text-sky-300">
              {formatINR(totalSalesAmount)}
            </span>
            <span className="text-[11px] text-slate-400">({sales.length} Bills)</span>
          </div>
        </div>
      </div>

      {/* Sales DataTable */}
      <DataTable
        columns={columns}
        data={sales}
        searchPlaceholder="Search bill number or remarks..."
        emptyMessage="No sales bills found for the selected date and filter."
        emptyAction={
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs transition mt-1"
          >
            <Plus className="w-3.5 h-3.5 text-sky-300" />
            <span>Record New Sale</span>
          </button>
        }
      />

      {/* Sale Form Modal */}
      <SaleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={loadData}
        editingSale={editingSale}
      />
    </div>
  );
};
