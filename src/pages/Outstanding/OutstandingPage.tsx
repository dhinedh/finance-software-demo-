import React, { useState, useEffect } from 'react';
import {
  Scale,
  FileSpreadsheet,
  Printer,
  Calendar,
  AlertCircle,
  MapPin,
  Clock,
  BookOpen,
} from 'lucide-react';
import { outstandingService } from '../../services/outstandingService';
import { beatService } from '../../services/beatService';
import { reportExportService } from '../../services/reportService';
import { useApp } from '../../context/AppContext';
import { DataTable, type Column } from '../../components/common/DataTable';
import { MetricCard } from '../../components/common/Card';
import { formatINR } from '../../utils/money';
import { formatDateDisplay } from '../../utils/date';
import type {
  RetailerOutstandingSummary,
  BeatOutstandingSummary,
  OutstandingAgeingSummary,
  Beat,
} from '../../types';

export const OutstandingPage: React.FC = () => {
  const { openRetailerLedger } = useApp();
  const [activeTab, setActiveTab] = useState<'retailers' | 'beats' | 'ageing'>('retailers');

  // Overall Totals
  const [totalOpening, setTotalOpening] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState(0);
  const [pendingCheques, setPendingCheques] = useState(0);
  const [totalClosing, setTotalClosing] = useState(0);

  // Lists
  const [retailersList, setRetailersList] = useState<RetailerOutstandingSummary[]>([]);
  const [beatsList, setBeatsList] = useState<BeatOutstandingSummary[]>([]);
  const [ageingList, setAgeingList] = useState<OutstandingAgeingSummary[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatFilter, setBeatFilter] = useState<number | 'all'>('all');

  const loadData = async () => {
    const overall = await outstandingService.getOverallOutstanding();
    setTotalOpening(overall.totalOpening);
    setTotalSales(overall.totalSales);
    setTotalConfirmed(overall.totalConfirmedCollections);
    setPendingCheques(overall.pendingCheques);
    setTotalClosing(overall.totalClosingOutstanding);

    const rets = await outstandingService.getAllRetailersOutstanding();
    const bts = await outstandingService.getAllBeatsOutstanding();
    const age = await outstandingService.getOutstandingAgeing();
    const allBeats = await beatService.getAll();

    setRetailersList(rets);
    setBeatsList(bts);
    setAgeingList(age);
    setBeats(allBeats);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRetailers = retailersList.filter((r) => {
    if (beatFilter === 'all') return true;
    return r.retailer.beatId === beatFilter;
  });

  const handleExportExcel = () => {
    if (activeTab === 'retailers') {
      const rows = filteredRetailers.map((r, idx) => ({
        'S.No': idx + 1,
        'Retailer Name': r.retailer.retailerName,
        'Beat': r.beatName,
        'Opening Bal (₹)': (r.openingBalance / 100).toFixed(2),
        'Total Invoiced (₹)': (r.totalSales / 100).toFixed(2),
        'Confirmed Paid (₹)': (r.totalConfirmedCollections / 100).toFixed(2),
        'Pending Cheques (₹)': (r.pendingChequeAmount / 100).toFixed(2),
        'Current Outstanding (₹)': (r.currentOutstanding / 100).toFixed(2),
        'Last Paid Date': formatDateDisplay(r.lastCollectionDate),
      }));
      reportExportService.exportToExcel('Retailers_Outstanding', 'Outstanding', rows);
    } else if (activeTab === 'beats') {
      const rows = beatsList.map((b) => ({
        'Beat Name': b.beat.name,
        'Retailer Count': b.retailerCount,
        'Total Sales (₹)': (b.totalSales / 100).toFixed(2),
        'Total Collections (₹)': (b.totalCollections / 100).toFixed(2),
        'Total Outstanding (₹)': (b.totalOutstanding / 100).toFixed(2),
      }));
      reportExportService.exportToExcel('Beat_Wise_Outstanding', 'Beats', rows);
    } else {
      const rows = ageingList.map((a) => ({
        'Retailer Name': a.retailerName,
        'Beat': a.beatName,
        'Total Due (₹)': (a.currentOutstanding / 100).toFixed(2),
        '0-7 Days (₹)': (a.days0To7 / 100).toFixed(2),
        '8-15 Days (₹)': (a.days8To15 / 100).toFixed(2),
        '16-30 Days (₹)': (a.days16To30 / 100).toFixed(2),
        '31-60 Days (₹)': (a.days31To60 / 100).toFixed(2),
        '>60 Days (₹)': (a.daysAbove60 / 100).toFixed(2),
      }));
      reportExportService.exportToExcel('Outstanding_Ageing', 'Ageing', rows);
    }
  };

  const handleExportPdf = () => {
    if (activeTab === 'retailers') {
      const columns = ['Retailer Name', 'Beat', 'Opening', 'Sales', 'Collections', 'Outstanding'];
      const rows = filteredRetailers.map((r) => [
        r.retailer.retailerName,
        r.beatName,
        (r.openingBalance / 100).toFixed(2),
        (r.totalSales / 100).toFixed(2),
        (r.totalConfirmedCollections / 100).toFixed(2),
        (r.currentOutstanding / 100).toFixed(2),
      ]);
      const summaryRow = ['TOTAL', `${filteredRetailers.length} Retailers`, '', '', '', (totalClosing / 100).toFixed(2)];
      reportExportService.exportToPdf({
        title: 'Retailer-wise Outstanding Report',
        fileName: 'Retailers_Outstanding',
        columns,
        rows,
        summaryRow,
      });
    } else if (activeTab === 'beats') {
      const columns = ['Beat Name', 'Retailers', 'Total Sales (₹)', 'Total Collections (₹)', 'Outstanding (₹)'];
      const rows = beatsList.map((b) => [
        b.beat.name,
        b.retailerCount,
        (b.totalSales / 100).toFixed(2),
        (b.totalCollections / 100).toFixed(2),
        (b.totalOutstanding / 100).toFixed(2),
      ]);
      reportExportService.exportToPdf({
        title: 'Beat-wise Outstanding Summary',
        fileName: 'Beat_Outstanding',
        columns,
        rows,
      });
    } else {
      const columns = ['Retailer', 'Beat', 'Total', '0-7 d', '8-15 d', '16-30 d', '31-60 d', '>60 d'];
      const rows = ageingList.map((a) => [
        a.retailerName,
        a.beatName,
        (a.currentOutstanding / 100).toFixed(2),
        (a.days0To7 / 100).toFixed(2),
        (a.days8To15 / 100).toFixed(2),
        (a.days16To30 / 100).toFixed(2),
        (a.days31To60 / 100).toFixed(2),
        (a.daysAbove60 / 100).toFixed(2),
      ]);
      reportExportService.exportToPdf({
        title: 'Outstanding Ageing Classification Report',
        fileName: 'Outstanding_Ageing',
        columns,
        rows,
        landscape: true,
      });
    }
  };

  const retailerColumns: Column<RetailerOutstandingSummary>[] = [
    {
      key: 'retailerName',
      header: 'Retailer Name',
      render: (row) => (
        <div>
          <button
            onClick={() => openRetailerLedger(row.retailer.id!)}
            className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 text-left"
          >
            {row.retailer.retailerName}
          </button>
          <p className="text-[10px] text-slate-400 font-mono">RET-{row.retailer.id}</p>
        </div>
      ),
    },
    {
      key: 'beatName',
      header: 'Beat',
      render: (row) => (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          <MapPin className="w-2.5 h-2.5" />
          <span>{row.beatName}</span>
        </span>
      ),
    },
    {
      key: 'openingBalance',
      header: 'Opening Bal',
      align: 'right',
      render: (row) => <span>{formatINR(row.openingBalance)}</span>,
    },
    {
      key: 'totalSales',
      header: 'Total Sales',
      align: 'right',
      render: (row) => <span>{formatINR(row.totalSales)}</span>,
    },
    {
      key: 'totalConfirmedCollections',
      header: 'Confirmed Paid',
      align: 'right',
      render: (row) => (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
          {formatINR(row.totalConfirmedCollections)}
        </span>
      ),
    },
    {
      key: 'pendingChequeAmount',
      header: 'Pending Cheques',
      align: 'right',
      render: (row) =>
        row.pendingChequeAmount > 0 ? (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {formatINR(row.pendingChequeAmount)}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      key: 'currentOutstanding',
      header: 'Current Outstanding',
      align: 'right',
      render: (row) => (
        <span
          className={`font-bold ${
            row.currentOutstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'
          }`}
        >
          {formatINR(row.currentOutstanding)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          onClick={() => openRetailerLedger(row.retailer.id!)}
          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-navy-50 text-navy-800 dark:bg-navy-900 dark:text-sky-300 hover:bg-navy-100"
        >
          <BookOpen className="w-3 h-3" />
          <span>Ledger</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Scale className="w-5 h-5 text-sky-600" />
            <span>Outstanding Management Engine</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Formula: Closing Outstanding = Opening Outstanding + Invoiced Sales - Confirmed Collections.
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
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard
          title="Total Opening"
          value={formatINR(totalOpening)}
          subtitle="Baseline balance"
          icon={Scale}
          variant="default"
        />
        <MetricCard
          title="Total Invoiced"
          value={formatINR(totalSales)}
          subtitle="Cumulative sales"
          icon={Scale}
          variant="primary"
        />
        <MetricCard
          title="Confirmed Paid"
          value={formatINR(totalConfirmed)}
          subtitle="Cash + GPay + Cleared"
          icon={Scale}
          variant="success"
        />
        <MetricCard
          title="Uncleared Cheques"
          value={formatINR(pendingCheques)}
          subtitle="Pending in bank"
          icon={Clock}
          variant="warning"
        />
        <MetricCard
          title="Total Outstanding"
          value={formatINR(totalClosing)}
          subtitle="Current net due"
          icon={Scale}
          variant="danger"
        />
      </div>

      {/* Tab Switcher & Beat Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('retailers')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'retailers'
                ? 'bg-navy-800 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            Retailer-wise Outstanding ({retailersList.length})
          </button>
          <button
            onClick={() => setActiveTab('beats')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'beats'
                ? 'bg-navy-800 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            Beat-wise Aggregation ({beatsList.length})
          </button>
          <button
            onClick={() => setActiveTab('ageing')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'ageing'
                ? 'bg-navy-800 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            Ageing Analysis (0-60+ Days)
          </button>
        </div>

        {activeTab === 'retailers' && (
          <select
            value={beatFilter}
            onChange={(e) =>
              setBeatFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
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
        )}
      </div>

      {/* Tab 1: Retailers Table */}
      {activeTab === 'retailers' && (
        <DataTable
          columns={retailerColumns}
          data={filteredRetailers}
          searchPlaceholder="Search retailer name..."
          emptyMessage="No retailers found."
        />
      )}

      {/* Tab 2: Beat-wise Aggregation */}
      {activeTab === 'beats' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Beat Name</th>
                <th className="px-4 py-3 text-center">Retailers Count</th>
                <th className="px-4 py-3 text-right">Total Invoiced Sales</th>
                <th className="px-4 py-3 text-right">Confirmed Collections</th>
                <th className="px-4 py-3 text-right">Net Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {beatsList.map((b) => (
                <tr key={b.beat.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>{b.beat.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                    {b.retailerCount} Retailers
                  </td>
                  <td className="px-4 py-3 text-right num-cell text-slate-800 dark:text-slate-200">
                    {formatINR(b.totalSales)}
                  </td>
                  <td className="px-4 py-3 text-right num-cell text-emerald-600 dark:text-emerald-400 font-semibold">
                    {formatINR(b.totalCollections)}
                  </td>
                  <td className="px-4 py-3 text-right num-cell font-bold text-rose-600 dark:text-rose-400">
                    {formatINR(b.totalOutstanding)}
                  </td>
                </tr>
              ))}
              <tr className="bg-navy-50/80 dark:bg-navy-950/60 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                <td className="px-4 py-3 text-slate-900 dark:text-white">TOTAL CONSOLIDATED</td>
                <td className="px-4 py-3 text-center">{retailersList.length} Retailers</td>
                <td className="px-4 py-3 text-right num-cell">{formatINR(totalSales)}</td>
                <td className="px-4 py-3 text-right num-cell text-emerald-600 dark:text-emerald-400">{formatINR(totalConfirmed)}</td>
                <td className="px-4 py-3 text-right num-cell text-rose-600 dark:text-rose-400">{formatINR(totalClosing)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Outstanding Ageing Analysis */}
      {activeTab === 'ageing' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500">
            Ageing calculated from each bill's invoice date and remaining unpaid balance.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Retailer Name</th>
                  <th className="px-4 py-3">Beat</th>
                  <th className="px-4 py-3 text-right">Total Due</th>
                  <th className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">0–7 Days</th>
                  <th className="px-4 py-3 text-right text-sky-700 dark:text-sky-400">8–15 Days</th>
                  <th className="px-4 py-3 text-right text-blue-700 dark:text-blue-400">16–30 Days</th>
                  <th className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">31–60 Days</th>
                  <th className="px-4 py-3 text-right text-rose-700 dark:text-rose-400">&gt;60 Days</th>
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
                    <td className="px-4 py-2.5 text-right num-cell text-slate-700 dark:text-slate-300">
                      {a.days0To7 > 0 ? formatINR(a.days0To7) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell text-slate-700 dark:text-slate-300">
                      {a.days8To15 > 0 ? formatINR(a.days8To15) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell text-slate-700 dark:text-slate-300">
                      {a.days16To30 > 0 ? formatINR(a.days16To30) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell text-amber-600 font-semibold">
                      {a.days31To60 > 0 ? formatINR(a.days31To60) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right num-cell text-rose-600 font-bold">
                      {a.daysAbove60 > 0 ? formatINR(a.daysAbove60) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
