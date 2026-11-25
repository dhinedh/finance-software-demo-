import React, { useState, useEffect } from 'react';
import {
  CalendarCheck2,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { dayEndService } from '../../services/dayEndService';
import { reportExportService } from '../../services/reportService';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../utils/money';
import { formatDateDisplay, getTodayDateString } from '../../utils/date';
import { subDays, format } from 'date-fns';
import type { DayEndReportData } from '../../types';

export const DayEndPage: React.FC = () => {
  const { showToast, askConfirmation, operatorName } = useApp();

  const todayStr = getTodayDateString();
  const past30Str = format(subDays(new Date(), 20), 'yyyy-MM-dd');

  const [history, setHistory] = useState<DayEndReportData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [todaySummary, setTodaySummary] = useState<DayEndReportData | null>(null);
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const summ = await dayEndService.calculateDayEndSummary(selectedDate);
      setTodaySummary(summ);

      const hist = await dayEndService.getDayEndHistory(past30Str, todayStr);
      setHistory(hist);
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleVerifyDayEnd = () => {
    if (!todaySummary) return;

    askConfirmation({
      title: `Verify & Lock Day-End for ${formatDateDisplay(selectedDate)}?`,
      message: `Opening: ${formatINR(todaySummary.openingBalance)} + Sales: ${formatINR(todaySummary.totalSales)} - Confirmed: ${formatINR(todaySummary.totalConfirmedCollection)} = Closing: ${formatINR(todaySummary.closingBalance)}. This will record the verified closing balance in the audit registry.`,
      confirmText: 'Verify Day-End',
      onConfirm: async () => {
        try {
          await dayEndService.verifyDayEnd(selectedDate, operatorName, verifyNotes);
          showToast({
            type: 'success',
            message: `Day-end for ${formatDateDisplay(selectedDate)} verified and locked`,
          });
          setVerifyNotes('');
          loadData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Verification failed' });
        }
      },
    });
  };

  const handleExportExcel = () => {
    const rows = history.map((d) => ({
      Date: formatDateDisplay(d.date),
      'Opening Bal (₹)': (d.openingBalance / 100).toFixed(2),
      'Sales (₹)': (d.totalSales / 100).toFixed(2),
      'Cash (₹)': (d.cashCollection / 100).toFixed(2),
      'GPay (₹)': (d.gpayCollection / 100).toFixed(2),
      'Cleared Cheques (₹)': (d.clearedChequeCollection / 100).toFixed(2),
      'Total Confirmed Collections (₹)': (d.totalConfirmedCollection / 100).toFixed(2),
      'Closing Bal (₹)': (d.closingBalance / 100).toFixed(2),
      'Verification Status': d.verificationStatus,
    }));
    reportExportService.exportToExcel(`DayEnd_Verification_History`, 'DayEnd', rows);
  };

  const handleExportPdf = () => {
    const columns = ['Date', 'Opening', 'Sales', 'Collections', 'Closing', 'Status'];
    const rows = history.map((d) => [
      formatDateDisplay(d.date),
      (d.openingBalance / 100).toFixed(2),
      (d.totalSales / 100).toFixed(2),
      (d.totalConfirmedCollection / 100).toFixed(2),
      (d.closingBalance / 100).toFixed(2),
      d.verificationStatus,
    ]);

    reportExportService.exportToPdf({
      title: 'Daily Day-End Balance Verification History',
      subtitle: 'Opening + Daily Sales - Confirmed Collections = Closing Balance',
      fileName: 'DayEnd_Verification_History',
      columns,
      rows,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <CalendarCheck2 className="w-5 h-5 text-sky-600" />
            <span>Daily Day-End Verification & Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verify consecutive day opening/closing balances to detect missing or mismatched records.
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
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Selected Day Verification Box */}
      {todaySummary && (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Verification Business Date:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold ${
                  todaySummary.verificationStatus === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : todaySummary.verificationStatus === 'MISMATCH'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {todaySummary.verificationStatus === 'VERIFIED' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>Status: {todaySummary.verificationStatus}</span>
              </span>
            </div>
          </div>

          {/* Equation Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Opening Balance</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {formatINR(todaySummary.openingBalance)}
              </span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-semibold block">
                + Daily Sales ({todaySummary.salesCount})
              </span>
              <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                {formatINR(todaySummary.totalSales)}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold block">
                - Confirmed Paid ({todaySummary.collectionsCount})
              </span>
              <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                {formatINR(todaySummary.totalConfirmedCollection)}
              </span>
            </div>
            <div className="p-3 bg-navy-50 dark:bg-navy-950/60 rounded-lg border-2 border-navy-800 dark:border-sky-500">
              <span className="text-[10px] text-navy-800 dark:text-sky-300 uppercase font-bold block">
                = Closing Balance
              </span>
              <span className="text-base font-bold text-navy-950 dark:text-white">
                {formatINR(todaySummary.closingBalance)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Next Day Opening</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {todaySummary.nextDayOpening !== undefined
                  ? formatINR(todaySummary.nextDayOpening)
                  : 'Pending'}
              </span>
              {todaySummary.difference !== undefined && todaySummary.difference !== 0 && (
                <p className="text-[10px] text-rose-500 font-bold mt-0.5">
                  Mismatch: {formatINR(todaySummary.difference)}
                </p>
              )}
            </div>
          </div>

          {/* Breakdown Notes & Verification Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Optional verification note or physical cash drawer remark..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleVerifyDayEnd}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
            >
              <Lock className="w-3.5 h-3.5 text-sky-300" />
              <span>Lock & Verify Day-End Record</span>
            </button>
          </div>
        </div>
      )}

      {/* Date-wise Historical Verification Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-800 dark:text-white">
          Historical Daily Balance Verification Register (Past 20 Days)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Opening Bal</th>
                <th className="px-4 py-3 text-right">Sales (+)</th>
                <th className="px-4 py-3 text-right">Cash Paid</th>
                <th className="px-4 py-3 text-right">GPay Paid</th>
                <th className="px-4 py-3 text-right">Cleared Chq</th>
                <th className="px-4 py-3 text-right">Total Confirmed (-)</th>
                <th className="px-4 py-3 text-right">Closing Bal</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {history.map((row) => (
                <tr
                  key={row.date}
                  className="hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
                  onClick={() => setSelectedDate(row.date)}
                >
                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatDateDisplay(row.date)}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell text-slate-700 dark:text-slate-300">
                    {formatINR(row.openingBalance)}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell font-medium text-slate-900 dark:text-white">
                    {formatINR(row.totalSales)}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell text-slate-600 dark:text-slate-300">
                    {row.cashCollection > 0 ? formatINR(row.cashCollection) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell text-slate-600 dark:text-slate-300">
                    {row.gpayCollection > 0 ? formatINR(row.gpayCollection) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell text-slate-600 dark:text-slate-300">
                    {row.clearedChequeCollection > 0 ? formatINR(row.clearedChequeCollection) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(row.totalConfirmedCollection)}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell font-bold text-slate-900 dark:text-white">
                    {formatINR(row.closingBalance)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.verificationStatus === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : row.verificationStatus === 'MISMATCH'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {row.verificationStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
