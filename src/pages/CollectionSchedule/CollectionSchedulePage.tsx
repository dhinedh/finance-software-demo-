import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Phone,
  Receipt,
  FileSpreadsheet,
  Printer,
  BookOpen,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { collectionScheduleService } from '../../services/collectionScheduleService';
import { beatService } from '../../services/beatService';
import { reportExportService } from '../../services/reportService';
import { formatINR } from '../../utils/money';
import { formatDateDisplay, getTodayDateString } from '../../utils/date';
import { useApp } from '../../context/AppContext';
import { DataTable, type Column } from '../../components/common/DataTable';
import type {
  ScheduledCollectionItem,
  CollectionScheduleSummary,
  BeatScheduleBreakdown,
  SchedulePeriodType,
  Beat,
} from '../../types';

export const CollectionSchedulePage: React.FC = () => {
  const { openRetailerLedger, openCollectionModal, reloadTrigger } = useApp();

  const [period, setPeriod] = useState<SchedulePeriodType>('today');
  const [selectedBeatId, setSelectedBeatId] = useState<number | 'all'>('all');
  const [customFrom, setCustomFrom] = useState<string>(getTodayDateString());
  const [customTo, setCustomTo] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [beats, setBeats] = useState<Beat[]>([]);
  const [items, setItems] = useState<ScheduledCollectionItem[]>([]);
  const [summary, setSummary] = useState<CollectionScheduleSummary>({
    dueTodayAmount: 0,
    dueTodayCount: 0,
    dueTomorrowAmount: 0,
    dueTomorrowCount: 0,
    upcomingAmount: 0,
    upcomingCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    totalPendingAmount: 0,
    totalPendingCount: 0,
  });
  const [beatBreakdown, setBeatBreakdown] = useState<BeatScheduleBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Beats
  useEffect(() => {
    const fetchBeats = async () => {
      const allBeats = await beatService.getAll();
      setBeats(allBeats);
    };
    fetchBeats();
  }, []);

  // Load Schedule Data
  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const res = await collectionScheduleService.getSchedule({
        period,
        beatId: selectedBeatId,
        customFrom: period === 'custom' ? customFrom : undefined,
        customTo: period === 'custom' ? customTo : undefined,
        search: searchQuery,
      });

      setItems(res.items);
      setSummary(res.summary);
      setBeatBreakdown(res.beatBreakdown);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [period, selectedBeatId, customFrom, customTo, searchQuery, reloadTrigger]);

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = items.map((item, idx) => ({
      'S.No': idx + 1,
      'Status': item.status,
      'Collection Due Date': item.collectionDate,
      'Sales Date': item.salesDate,
      'Bill Number': item.billNumber,
      'Retailer Name': item.retailerName,
      'Beat': item.beatName,
      'Phone': item.retailerPhone || '-',
      'Original Bill (₹)': (item.originalAmount / 100).toFixed(2),
      'Collected (₹)': (item.previouslyCollected / 100).toFixed(2),
      'Remaining Target (₹)': (item.remainingAmount / 100).toFixed(2),
    }));

    reportExportService.exportToExcel(
      `Collection_Schedule_${period}_${getTodayDateString()}`,
      'Schedule',
      exportRows
    );
  };

  // Export to PDF (Field Recovery Sheet)
  const handleExportPdf = () => {
    const totalTarget = items.reduce((sum, i) => sum + i.remainingAmount, 0);
    const columns = ['S.No', 'Due Date', 'Retailer', 'Beat', 'Bill No', 'Target (₹)', 'Sign / Notes'];
    const rows = items.map((item, idx) => [
      idx + 1,
      formatDateDisplay(item.collectionDate),
      item.retailerName,
      item.beatName,
      item.billNumber,
      (item.remainingAmount / 100).toFixed(2),
      '', // blank column for salesman recovery checkmark / signature
    ]);

    const summaryRow = ['TOTAL', '', `${items.length} Target Bills`, '', '', (totalTarget / 100).toFixed(2), ''];

    reportExportService.exportToPdf({
      title: 'Daily Collection Target & Field Recovery Sheet',
      subtitle: `Target Period: ${period.toUpperCase()} • Generated on: ${formatDateDisplay(getTodayDateString())}`,
      fileName: `Collection_Target_Sheet_${period}`,
      columns,
      rows,
      summaryRow,
    });
  };

  // DataTable Columns definition
  const columns: Column<ScheduledCollectionItem>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (row.status === 'DUE_TODAY') {
          return (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
              <span>DUE TODAY</span>
            </span>
          );
        }
        if (row.status === 'DUE_TOMORROW') {
          return (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              <Clock className="w-3 h-3" />
              <span>DUE TOMORROW</span>
            </span>
          );
        }
        if (row.status === 'OVERDUE') {
          return (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              <AlertTriangle className="w-3 h-3" />
              <span>{Math.abs(row.daysDifference)}d OVERDUE</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            <span>+{row.daysDifference}d Upcoming</span>
          </span>
        );
      },
    },
    {
      key: 'collectionDate',
      header: 'Collection Due',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {formatDateDisplay(row.collectionDate)}
          </span>
          <p className="text-[10px] text-slate-400">
            Billed on {formatDateDisplay(row.salesDate)}
          </p>
        </div>
      ),
    },
    {
      key: 'retailerName',
      header: 'Retailer Name',
      render: (row) => (
        <div>
          <button
            onClick={() => openRetailerLedger(row.retailerId)}
            className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 text-left transition"
          >
            {row.retailerName}
          </button>
          {row.retailerPhone && (
            <p className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Phone className="w-2.5 h-2.5" />
              <span>{row.retailerPhone}</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'beatId',
      header: 'Beat',
      render: (row) => (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          <MapPin className="w-2.5 h-2.5" />
          <span>{row.beatName}</span>
        </span>
      ),
    },
    {
      key: 'billNumber',
      header: 'Bill Number',
      render: (row) => (
        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
          {row.billNumber}
        </span>
      ),
    },
    {
      key: 'originalAmount',
      header: 'Original Bill',
      align: 'right',
      render: (row) => (
        <span className="num-cell text-slate-500 text-xs">
          {formatINR(row.originalAmount)}
        </span>
      ),
    },
    {
      key: 'remainingAmount',
      header: 'Remaining Due',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-slate-900 dark:text-white text-sm num-cell">
          {formatINR(row.remainingAmount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => openCollectionModal()}
            title="Record Collection"
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition"
          >
            <Receipt className="w-3 h-3" />
            <span>Collect</span>
          </button>
          <button
            onClick={() => openRetailerLedger(row.retailerId)}
            title="View Statement"
            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-150 dark:hover:bg-slate-700"
          >
            <BookOpen className="w-3.5 h-3.5" />
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
            <CalendarClock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Daily Collection Schedule & Forecast</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track collections scheduled for today, tomorrow, and forecast upcoming payment recoveries across beats.
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
            <span>Print Target Sheet</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Schedule Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today */}
        <button
          onClick={() => setPeriod('today')}
          className={`p-4 rounded-xl border text-left transition shadow-xs flex flex-col justify-between ${
            period === 'today'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Due Today
            </span>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell tracking-tight">
              {formatINR(summary.dueTodayAmount)}
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {summary.dueTodayCount} Bills Due Today
            </p>
          </div>
        </button>

        {/* Card 2: Tomorrow */}
        <button
          onClick={() => setPeriod('tomorrow')}
          className={`p-4 rounded-xl border text-left transition shadow-xs flex flex-col justify-between ${
            period === 'tomorrow'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Due Tomorrow
            </span>
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell tracking-tight">
              {formatINR(summary.dueTomorrowAmount)}
            </h3>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              {summary.dueTomorrowCount} Bills Due Tomorrow
            </p>
          </div>
        </button>

        {/* Card 3: Upcoming (Next 7 Days) */}
        <button
          onClick={() => setPeriod('upcoming_7')}
          className={`p-4 rounded-xl border text-left transition shadow-xs flex flex-col justify-between ${
            period === 'upcoming_7'
              ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 ring-2 ring-sky-500/20'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              Next 7 Days
            </span>
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell tracking-tight">
              {formatINR(summary.upcomingAmount)}
            </h3>
            <p className="text-xs text-sky-600 dark:text-sky-400 font-semibold mt-1">
              {summary.upcomingCount} Bills Scheduled
            </p>
          </div>
        </button>

        {/* Card 4: Overdue */}
        <button
          onClick={() => setPeriod('overdue')}
          className={`p-4 rounded-xl border text-left transition shadow-xs flex flex-col justify-between ${
            period === 'overdue'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
              Overdue Pending
            </span>
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell tracking-tight">
              {formatINR(summary.overdueAmount)}
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
              {summary.overdueCount} Overdue Bills
            </p>
          </div>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Period Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              period === 'today'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>Today</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500 text-white font-mono">
              {summary.dueTodayCount}
            </span>
          </button>

          <button
            onClick={() => setPeriod('tomorrow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              period === 'tomorrow'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>Tomorrow</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500 text-white font-mono">
              {summary.dueTomorrowCount}
            </span>
          </button>

          <button
            onClick={() => setPeriod('upcoming_7')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              period === 'upcoming_7'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            Next 7 Days
          </button>

          <button
            onClick={() => setPeriod('overdue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              period === 'overdue'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <span>Overdue</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
              {summary.overdueCount}
            </span>
          </button>

          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              period === 'all'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            All Pending Dues ({summary.totalPendingCount})
          </button>

          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              period === 'custom'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Beat Dropdown & Search */}
        <div className="flex items-center space-x-2">
          {period === 'custom' && (
            <div className="flex items-center space-x-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          <select
            value={selectedBeatId}
            onChange={(e) =>
              setSelectedBeatId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
          >
            <option value="all">All Beats</option>
            {beats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Beat Target Summary Cards */}
      {beatBreakdown.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Beat-Wise Target Breakdown ({period.toUpperCase()})</span>
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Total Target: <strong className="text-slate-900 dark:text-white">{formatINR(items.reduce((sum, i) => sum + i.remainingAmount, 0))}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {beatBreakdown.map((b) => (
              <div
                key={b.beatId}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs"
              >
                <p className="text-[11px] font-semibold text-slate-500 truncate">{b.beatName}</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white num-cell mt-0.5">
                  {formatINR(b.amount)}
                </p>
                <p className="text-[10px] text-slate-400">{b.billCount} Bills</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Schedule DataTable */}
      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Search retailer, bill number, phone..."
        emptyMessage={`No pending collections scheduled for ${period.replace('_', ' ')}.`}
      />
    </div>
  );
};
