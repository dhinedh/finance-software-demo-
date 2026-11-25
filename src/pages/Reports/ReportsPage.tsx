import React, { useState, useEffect } from 'react';
import {
  FileBarChart2,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  MapPin,
  Store,
  DollarSign,
  Clock,
  Layers,
} from 'lucide-react';
import { salesService } from '../../services/salesService';
import { collectionService } from '../../services/collectionService';
import { outstandingService } from '../../services/outstandingService';
import { beatService } from '../../services/beatService';
import { retailerService } from '../../services/retailerService';
import { reportExportService } from '../../services/reportService';
import { DateRangeFilter } from '../../components/common/DateRangeFilter';
import { DataTable, type Column } from '../../components/common/DataTable';
import { formatINR } from '../../utils/money';
import { formatDateDisplay, getDateRangeFromFilter, type DateFilterType } from '../../utils/date';
import type { Sale, Collection, Retailer, Beat, BeatOutstandingSummary, OutstandingAgeingSummary } from '../../types';

export type ReportType =
  | 'daily_sales'
  | 'daily_collections'
  | 'beat_sales'
  | 'beat_outstanding'
  | 'overall_outstanding'
  | 'collection_history'
  | 'ageing';

export const ReportsPage: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('daily_sales');

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedBeatId, setSelectedBeatId] = useState<number | 'all'>('all');
  const [selectedRetailerId, setSelectedRetailerId] = useState<number | 'all'>('all');

  // Data cache
  const [sales, setSales] = useState<Sale[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatMap, setBeatMap] = useState<Map<number, string>>(new Map());
  const [retailerMap, setRetailerMap] = useState<Map<number, Retailer>>(new Map());
  const [beatSummaries, setBeatSummaries] = useState<BeatOutstandingSummary[]>([]);
  const [ageingList, setAgeingList] = useState<OutstandingAgeingSummary[]>([]);

  const loadData = async () => {
    const range = getDateRangeFromFilter(dateFilter, customFrom, customTo);

    const rets = await retailerService.getAll();
    const bts = await beatService.getAll();
    const rMap = new Map<number, Retailer>();
    const bMap = new Map<number, string>();
    rets.forEach((r) => rMap.set(r.id!, r));
    bts.forEach((b) => bMap.set(b.id!, b.name));

    setRetailers(rets);
    setBeats(bts);
    setRetailerMap(rMap);
    setBeatMap(bMap);

    const sList = await salesService.getSales({
      fromDate: range.from,
      toDate: range.to,
      beatId: selectedBeatId === 'all' ? undefined : selectedBeatId,
      retailerId: selectedRetailerId === 'all' ? undefined : selectedRetailerId,
    });
    setSales(sList);

    const cList = await collectionService.getCollections({
      fromDate: range.from,
      toDate: range.to,
      retailerId: selectedRetailerId === 'all' ? undefined : selectedRetailerId,
    });
    setCollections(cList);

    const bSummaries = await outstandingService.getAllBeatsOutstanding();
    setBeatSummaries(bSummaries);

    const age = await outstandingService.getOutstandingAgeing();
    setAgeingList(age);
  };

  useEffect(() => {
    loadData();
  }, [selectedReport, dateFilter, customFrom, customTo, selectedBeatId, selectedRetailerId]);

  // Handle Export Excel
  const handleExportExcel = () => {
    if (selectedReport === 'daily_sales') {
      const rows = sales.map((s, idx) => ({
        'S.No': idx + 1,
        'Serial No': s.serialNumber,
        'Sales Date': s.date,
        'Collection Due': s.collectionDate || s.date,
        'Bill Number': s.billNumber,
        'Retailer': retailerMap.get(s.retailerId)?.retailerName || '-',
        'Beat': beatMap.get(s.beatIdAtTransaction) || '-',
        'Bill Amount (₹)': (s.billAmount / 100).toFixed(2),
        'Remarks': s.remarks || '',
      }));
      reportExportService.exportToExcel('Daily_Sales_Report', 'Sales', rows);
    } else if (selectedReport === 'daily_collections') {
      const rows = collections.map((c, idx) => ({
        'S.No': idx + 1,
        'Date': c.date,
        'Receipt No': c.collectionNumber,
        'Retailer': retailerMap.get(c.retailerId)?.retailerName || '-',
        'Method': c.paymentMethod,
        'Status': c.chequeStatus || 'CONFIRMED',
        'Amount (₹)': (c.totalAmount / 100).toFixed(2),
        'Remarks': c.remarks || '',
      }));
      reportExportService.exportToExcel('Daily_Collections_Report', 'Collections', rows);
    } else if (selectedReport === 'beat_sales' || selectedReport === 'beat_outstanding') {
      const rows = beatSummaries.map((b) => ({
        'Beat Name': b.beat.name,
        'Retailer Count': b.retailerCount,
        'Total Sales (₹)': (b.totalSales / 100).toFixed(2),
        'Total Collections (₹)': (b.totalCollections / 100).toFixed(2),
        'Total Outstanding (₹)': (b.totalOutstanding / 100).toFixed(2),
      }));
      reportExportService.exportToExcel('Beat_Wise_Report', 'Beats', rows);
    } else if (selectedReport === 'ageing') {
      const rows = ageingList.map((a) => ({
        'Retailer': a.retailerName,
        'Beat': a.beatName,
        'Current Due (₹)': (a.currentOutstanding / 100).toFixed(2),
        '0-7 Days (₹)': (a.days0To7 / 100).toFixed(2),
        '8-15 Days (₹)': (a.days8To15 / 100).toFixed(2),
        '16-30 Days (₹)': (a.days16To30 / 100).toFixed(2),
        '31-60 Days (₹)': (a.days31To60 / 100).toFixed(2),
        '>60 Days (₹)': (a.daysAbove60 / 100).toFixed(2),
      }));
      reportExportService.exportToExcel('Outstanding_Ageing_Report', 'Ageing', rows);
    }
  };

  // Handle Export PDF
  const handleExportPdf = () => {
    if (selectedReport === 'daily_sales') {
      const totalAmt = sales.reduce((sum, s) => sum + s.billAmount, 0);
      reportExportService.exportToPdf({
        title: 'Daily Sales Report',
        subtitle: `Period: ${dateFilter}`,
        fileName: 'Daily_Sales_Report',
        columns: ['S.No', 'Date', 'Collection Due', 'Bill No', 'Retailer', 'Beat', 'Amount (₹)'],
        rows: sales.map((s, idx) => [
          idx + 1,
          formatDateDisplay(s.date),
          formatDateDisplay(s.collectionDate || s.date),
          s.billNumber,
          retailerMap.get(s.retailerId)?.retailerName || '-',
          beatMap.get(s.beatIdAtTransaction) || '-',
          (s.billAmount / 100).toFixed(2),
        ]),
        summaryRow: ['TOTAL', '', '', '', '', `${sales.length} Bills`, (totalAmt / 100).toFixed(2)],
      });
    } else if (selectedReport === 'daily_collections') {
      const totalAmt = collections.reduce((sum, c) => sum + c.totalAmount, 0);
      reportExportService.exportToPdf({
        title: 'Daily Collections Report',
        subtitle: `Period: ${dateFilter}`,
        fileName: 'Daily_Collections_Report',
        columns: ['S.No', 'Date', 'Receipt No', 'Retailer', 'Method', 'Status', 'Amount (₹)'],
        rows: collections.map((c, idx) => [
          idx + 1,
          formatDateDisplay(c.date),
          c.collectionNumber,
          retailerMap.get(c.retailerId)?.retailerName || '-',
          c.paymentMethod,
          c.chequeStatus || 'CONFIRMED',
          (c.totalAmount / 100).toFixed(2),
        ]),
        summaryRow: ['TOTAL', '', '', '', '', `${collections.length} Receipts`, (totalAmt / 100).toFixed(2)],
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileBarChart2 className="w-5 h-5 text-sky-600" />
            <span>Comprehensive Financial Reports</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export and analyze verified daily sales, collections, beat balances, and debt ageing.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-sky-300" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Selection Ribbon */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700">
        {[
          { id: 'daily_sales', label: 'Daily Sales Report' },
          { id: 'daily_collections', label: 'Daily Collections Report' },
          { id: 'beat_sales', label: 'Beat-wise Sales' },
          { id: 'beat_outstanding', label: 'Beat-wise Outstanding' },
          { id: 'ageing', label: 'Debt Ageing (0-60+ Days)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedReport(tab.id as ReportType)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              selectedReport === tab.id
                ? 'bg-navy-800 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Ribbon */}
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

        <div className="flex items-center space-x-3">
          {/* Beat Filter */}
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-slate-500 font-semibold">Beat:</span>
            <select
              value={selectedBeatId}
              onChange={(e) =>
                setSelectedBeatId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Beats</option>
              {beats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Retailer Filter */}
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-slate-500 font-semibold">Retailer:</span>
            <select
              value={selectedRetailerId}
              onChange={(e) =>
                setSelectedRetailerId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 max-w-xs"
            >
              <option value="all">All Retailers</option>
              {retailers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.retailerName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Render Table based on active report */}
      {selectedReport === 'daily_sales' && (
        <DataTable
          columns={[
            {
              key: 'date',
              header: 'Date',
              render: (row: Sale) => <span>{formatDateDisplay(row.date)}</span>,
            },
            {
              key: 'collectionDate',
              header: 'Collection Due',
              render: (row: Sale) => (
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatDateDisplay(row.collectionDate || row.date)}
                </span>
              ),
            },
            {
              key: 'serialNumber',
              header: 'Serial No',
              render: (row: Sale) => <span className="font-mono text-slate-500">{row.serialNumber}</span>,
            },
            {
              key: 'billNumber',
              header: 'Bill Number',
              render: (row: Sale) => (
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {row.billNumber}
                </span>
              ),
            },
            {
              key: 'retailerId',
              header: 'Retailer',
              render: (row: Sale) => (
                <span className="font-bold text-slate-800 dark:text-white">
                  {retailerMap.get(row.retailerId)?.retailerName || '-'}
                </span>
              ),
            },
            {
              key: 'beatIdAtTransaction',
              header: 'Beat',
              render: (row: Sale) => <span>{beatMap.get(row.beatIdAtTransaction) || '-'}</span>,
            },
            {
              key: 'billAmount',
              header: 'Bill Amount',
              align: 'right',
              render: (row: Sale) => (
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatINR(row.billAmount)}
                </span>
              ),
            },
          ]}
          data={sales}
          searchPlaceholder="Search sales records..."
        />
      )}

      {selectedReport === 'daily_collections' && (
        <DataTable
          columns={[
            {
              key: 'date',
              header: 'Date',
              render: (row: Collection) => <span>{formatDateDisplay(row.date)}</span>,
            },
            {
              key: 'collectionNumber',
              header: 'Receipt No',
              render: (row: Collection) => (
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {row.collectionNumber}
                </span>
              ),
            },
            {
              key: 'retailerId',
              header: 'Retailer',
              render: (row: Collection) => (
                <span className="font-bold text-slate-800 dark:text-white">
                  {retailerMap.get(row.retailerId)?.retailerName || '-'}
                </span>
              ),
            },
            {
              key: 'paymentMethod',
              header: 'Method',
              render: (row: Collection) => (
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {row.paymentMethod}
                </span>
              ),
            },
            {
              key: 'chequeStatus',
              header: 'Clearance',
              render: (row: Collection) => <span>{row.chequeStatus || 'CONFIRMED'}</span>,
            },
            {
              key: 'totalAmount',
              header: 'Amount',
              align: 'right',
              render: (row: Collection) => (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(row.totalAmount)}
                </span>
              ),
            },
          ]}
          data={collections}
          searchPlaceholder="Search collections..."
        />
      )}

      {(selectedReport === 'beat_sales' || selectedReport === 'beat_outstanding') && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Beat</th>
                <th className="px-4 py-3 text-center">Retailer Count</th>
                <th className="px-4 py-3 text-right">Total Invoiced Sales</th>
                <th className="px-4 py-3 text-right">Confirmed Collections</th>
                <th className="px-4 py-3 text-right">Net Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {beatSummaries.map((b) => (
                <tr key={b.beat.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>{b.beat.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{b.retailerCount} Retailers</td>
                  <td className="px-4 py-3 text-right num-cell">{formatINR(b.totalSales)}</td>
                  <td className="px-4 py-3 text-right num-cell text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatINR(b.totalCollections)}
                  </td>
                  <td className="px-4 py-3 text-right num-cell font-bold text-rose-600 dark:text-rose-400">
                    {formatINR(b.totalOutstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedReport === 'ageing' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Retailer Name</th>
                <th className="px-4 py-3">Beat</th>
                <th className="px-4 py-3 text-right">Total Outstanding</th>
                <th className="px-4 py-3 text-right">0–7 Days</th>
                <th className="px-4 py-3 text-right">8–15 Days</th>
                <th className="px-4 py-3 text-right">16–30 Days</th>
                <th className="px-4 py-3 text-right">31–60 Days</th>
                <th className="px-4 py-3 text-right">&gt;60 Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {ageingList.map((a) => (
                <tr key={a.retailerId} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                    {a.retailerName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{a.beatName}</td>
                  <td className="px-4 py-2.5 text-right num-cell font-bold text-slate-900 dark:text-white">
                    {formatINR(a.currentOutstanding)}
                  </td>
                  <td className="px-4 py-2.5 text-right num-cell">{a.days0To7 > 0 ? formatINR(a.days0To7) : '-'}</td>
                  <td className="px-4 py-2.5 text-right num-cell">{a.days8To15 > 0 ? formatINR(a.days8To15) : '-'}</td>
                  <td className="px-4 py-2.5 text-right num-cell">{a.days16To30 > 0 ? formatINR(a.days16To30) : '-'}</td>
                  <td className="px-4 py-2.5 text-right num-cell text-amber-600 font-semibold">{a.days31To60 > 0 ? formatINR(a.days31To60) : '-'}</td>
                  <td className="px-4 py-2.5 text-right num-cell text-rose-600 font-bold">{a.daysAbove60 > 0 ? formatINR(a.daysAbove60) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
