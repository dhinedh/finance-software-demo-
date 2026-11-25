import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Printer,
  FileSpreadsheet,
  Calendar,
  Store,
  ArrowDownRight,
  ArrowUpRight,
  MapPin,
  Phone,
} from 'lucide-react';
import { ledgerService } from '../../services/ledgerService';
import { retailerService } from '../../services/retailerService';
import { beatService } from '../../services/beatService';
import { reportExportService } from '../../services/reportService';
import { RetailerAutocomplete } from '../../components/common/RetailerAutocomplete';
import { formatINR } from '../../utils/money';
import { formatDateDisplay, getTodayDateString, getYesterdayDateString } from '../../utils/date';
import { subMonths, format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import type { Retailer, LedgerEntry, Beat } from '../../types';

export const LedgerPage: React.FC = () => {
  const { selectedRetailerId } = useApp();

  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [currentRetailerId, setCurrentRetailerId] = useState<number | undefined>(selectedRetailerId);
  const [currentRetailer, setCurrentRetailer] = useState<Retailer | null>(null);
  const [beat, setBeat] = useState<Beat | null>(null);

  // Date range default: past 30 days to today
  const defaultFrom = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(getTodayDateString());

  // Ledger state
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [totalDebit, setTotalDebit] = useState<number>(0);
  const [totalCredit, setTotalCredit] = useState<number>(0);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadRetailers = async () => {
      const list = await retailerService.getAll();
      setRetailers(list);
      if (!currentRetailerId && list.length > 0) {
        setCurrentRetailerId(list[0].id);
      }
    };
    loadRetailers();
  }, []);

  useEffect(() => {
    if (selectedRetailerId) {
      setCurrentRetailerId(selectedRetailerId);
    }
  }, [selectedRetailerId]);

  const fetchLedger = async () => {
    if (!currentRetailerId) return;
    setIsLoading(true);
    try {
      const ret = await retailerService.getById(currentRetailerId);
      if (ret) {
        setCurrentRetailer(ret);
        const b = await beatService.getById(ret.beatId);
        setBeat(b || null);
      }

      const res = await ledgerService.getRetailerLedger(currentRetailerId, fromDate, toDate);
      setOpeningBalance(res.openingBalance);
      setClosingBalance(res.closingBalance);
      setTotalDebit(res.totalDebit);
      setTotalCredit(res.totalCredit);
      setEntries(res.entries);
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [currentRetailerId, fromDate, toDate]);

  const handleExportExcel = () => {
    if (!currentRetailer) return;
    const rows = [
      {
        Date: formatDateDisplay(fromDate),
        Particulars: 'Opening Balance as on Date',
        'Ref No': '-',
        'Debit (Sales ₹)': '-',
        'Credit (Collections ₹)': '-',
        'Running Balance (₹)': (openingBalance / 100).toFixed(2),
        Remarks: '',
      },
      ...entries.map((e) => ({
        Date: formatDateDisplay(e.date),
        Particulars: e.particulars,
        'Ref No': e.referenceNo,
        'Debit (Sales ₹)': e.debit > 0 ? (e.debit / 100).toFixed(2) : '-',
        'Credit (Collections ₹)': e.credit > 0 ? (e.credit / 100).toFixed(2) : '-',
        'Running Balance (₹)': (e.runningBalance / 100).toFixed(2),
        Remarks: e.allocationDetails || e.remarks || '',
      })),
      {
        Date: formatDateDisplay(toDate),
        Particulars: 'Closing Outstanding Balance',
        'Ref No': '-',
        'Debit (Sales ₹)': (totalDebit / 100).toFixed(2),
        'Credit (Collections ₹)': (totalCredit / 100).toFixed(2),
        'Running Balance (₹)': (closingBalance / 100).toFixed(2),
        Remarks: '',
      },
    ];

    reportExportService.exportToExcel(
      `Ledger_${currentRetailer.retailerName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}`,
      'Ledger',
      rows
    );
  };

  const handleExportPdf = () => {
    if (!currentRetailer) return;
    const columns = ['Date', 'Particulars', 'Ref', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'];
    const rows: (string | number)[][] = [
      [
        formatDateDisplay(fromDate),
        'Opening Balance',
        '-',
        '-',
        '-',
        (openingBalance / 100).toFixed(2),
      ],
      ...entries.map((e) => [
        formatDateDisplay(e.date),
        e.particulars,
        e.referenceNo,
        e.debit > 0 ? (e.debit / 100).toFixed(2) : '-',
        e.credit > 0 ? (e.credit / 100).toFixed(2) : '-',
        (e.runningBalance / 100).toFixed(2),
      ]),
    ];
    const summaryRow = [
      formatDateDisplay(toDate),
      'CLOSING BALANCE',
      '-',
      (totalDebit / 100).toFixed(2),
      (totalCredit / 100).toFixed(2),
      (closingBalance / 100).toFixed(2),
    ];

    reportExportService.exportToPdf({
      title: `Retailer Ledger Statement: ${currentRetailer.retailerName}`,
      subtitle: `Beat: ${beat?.name || '-'} • Period: ${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}`,
      fileName: `Ledger_${currentRetailer.retailerName.replace(/\s+/g, '_')}`,
      columns,
      rows,
      summaryRow,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-sky-600" />
            <span>Retailer Transaction Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chronological statement of invoices, payment receipts, allocations, and running balances.
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
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-sky-300" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Retailer Selector & Date Filters */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Select Retailer:
          </label>
          <select
            value={currentRetailerId || 0}
            onChange={(e) => setCurrentRetailerId(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.retailerName} (RET-{r.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            From Date:
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            To Date:
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Retailer Account Overview Bar */}
      {currentRetailer && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {currentRetailer.retailerName}
              </h3>
              <span className="text-xs text-slate-400 font-mono">(RET-{currentRetailer.id})</span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-sky-600" />
                <span>Beat: <strong className="text-slate-700 dark:text-slate-300">{beat?.name || '-'}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{currentRetailer.contactNumber || 'No phone'}</span>
              </span>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="flex items-center space-x-4 text-right">
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Opening</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 num-cell">
                {formatINR(openingBalance)}
              </span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Invoiced Debit</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white num-cell">
                {formatINR(totalDebit)}
              </span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Collected Credit</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 num-cell">
                {formatINR(totalCredit)}
              </span>
            </div>
            <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border-2 border-navy-800 dark:border-sky-500">
              <span className="text-[10px] text-navy-800 dark:text-sky-300 uppercase font-bold block">Closing Due</span>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400 num-cell">
                {formatINR(closingBalance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-navy-950 text-white text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Particulars & Transaction Details</th>
                <th className="px-4 py-3">Reference No</th>
                <th className="px-4 py-3 text-right">Debit (Sales +)</th>
                <th className="px-4 py-3 text-right">Credit (Paid -)</th>
                <th className="px-4 py-3 text-right">Running Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {/* Row 0: Opening Balance */}
              <tr className="bg-slate-50/80 dark:bg-slate-900/40 font-semibold">
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                  {formatDateDisplay(fromDate)}
                </td>
                <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-bold" colSpan={2}>
                  Opening Balance as on {formatDateDisplay(fromDate)}
                </td>
                <td className="px-4 py-2.5 text-right num-cell text-slate-400">-</td>
                <td className="px-4 py-2.5 text-right num-cell text-slate-400">-</td>
                <td className="px-4 py-2.5 text-right num-cell font-bold text-slate-900 dark:text-white">
                  {formatINR(openingBalance)}
                </td>
              </tr>

              {/* Transactions */}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No transactions recorded between {formatDateDisplay(fromDate)} and {formatDateDisplay(toDate)}.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-750 transition"
                  >
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateDisplay(entry.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center space-x-1.5">
                        {entry.transactionType === 'SALE' ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {entry.particulars}
                          </span>
                          {entry.allocationDetails && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Allocated: {entry.allocationDetails}
                            </p>
                          )}
                          {entry.remarks && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{entry.remarks}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                      {entry.referenceNo}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell font-semibold text-slate-900 dark:text-white">
                      {entry.debit > 0 ? formatINR(entry.debit) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell font-semibold text-emerald-600 dark:text-emerald-400">
                      {entry.credit > 0 ? formatINR(entry.credit) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell font-bold text-slate-900 dark:text-white">
                      {formatINR(entry.runningBalance)}
                    </td>
                  </tr>
                ))
              )}

              {/* Final Row: Closing Balance Summary */}
              <tr className="bg-navy-50/80 dark:bg-navy-950/60 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                  {formatDateDisplay(toDate)}
                </td>
                <td className="px-4 py-3 text-slate-900 dark:text-white" colSpan={2}>
                  Closing Outstanding Balance
                </td>
                <td className="px-4 py-3 text-right num-cell text-slate-900 dark:text-white">
                  {formatINR(totalDebit)}
                </td>
                <td className="px-4 py-3 text-right num-cell text-emerald-600 dark:text-emerald-400">
                  {formatINR(totalCredit)}
                </td>
                <td className="px-4 py-3 text-right num-cell text-base text-rose-600 dark:text-rose-400">
                  {formatINR(closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
