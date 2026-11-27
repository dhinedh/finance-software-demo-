import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Banknote,
  Scale,
  Store,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Receipt,
  BookOpen,
  Sparkles,
  Database,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { salesService } from '../../services/salesService';
import { collectionService } from '../../services/collectionService';
import { outstandingService } from '../../services/outstandingService';
import { retailerService } from '../../services/retailerService';
import { beatService } from '../../services/beatService';
import { dayEndService } from '../../services/dayEndService';
import { seedService } from '../../services/seedService';
import { DateRangeFilter } from '../../components/common/DateRangeFilter';
import { formatINR, toRupees } from '../../utils/money';
import { formatDateDisplay, getDateRangeFromFilter, getTodayDateString, type DateFilterType } from '../../utils/date';
import { useApp } from '../../context/AppContext';
import type {
  Sale,
  Collection,
  RetailerOutstandingSummary,
  Retailer,
} from '../../types';

export const DashboardPage: React.FC = () => {
  const { setCurrentTab, openRetailerLedger, reloadTrigger, refreshData, showToast } = useApp();

  const [dateFilter, setDateFilter] = useState<DateFilterType>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // KPIs
  const [todaySales, setTodaySales] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [todayCollections, setTodayCollections] = useState(0);
  const [todayCash, setTodayCash] = useState(0);
  const [todayGPay, setTodayGPay] = useState(0);
  const [todayCheque, setTodayCheque] = useState(0);
  const [todayUnclearedCheque, setTodayUnclearedCheque] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalRetailers, setTotalRetailers] = useState(0);
  const [activeBeatsCount, setActiveBeatsCount] = useState(0);

  // Total sales across all time (to check if fresh database)
  const [allTimeSalesCount, setAllTimeSalesCount] = useState(0);

  // Mismatch Alert
  const [hasBalanceMismatch, setHasBalanceMismatch] = useState(false);
  const [mismatchDate, setMismatchDate] = useState<string | null>(null);

  // Lists & Charts
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [recentCollections, setRecentCollections] = useState<Collection[]>([]);
  const [retailerMap, setRetailerMap] = useState<Map<number, Retailer>>(new Map());
  const [topDebtors, setTopDebtors] = useState<RetailerOutstandingSummary[]>([]);
  const [beatOutstandingData, setBeatOutstandingData] = useState<{ name: string; outstanding: number }[]>([]);
  const [dailyTrendData, setDailyTrendData] = useState<{ date: string; sales: number; collections: number }[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  const loadDashboardData = async () => {
    // Ensure beats and base config are clean & deduplicated
    await seedService.ensureBaseConfig();

    const today = getTodayDateString();

    // 1. Today's figures
    const todaySalesList = await salesService.getSales({ date: today });
    const totTodaySales = todaySalesList.reduce((sum, s) => sum + s.billAmount, 0);
    setTodaySales(totTodaySales);
    setTodaySalesCount(todaySalesList.length);

    const todayColList = await collectionService.getCollections({ date: today });
    let cCash = 0;
    let cGPay = 0;
    let cCheque = 0;
    let cChequePending = 0;
    let cOther = 0;

    for (const c of todayColList) {
      if (c.paymentMethod === 'CASH') cCash += c.totalAmount;
      else if (c.paymentMethod === 'GPAY') cGPay += c.totalAmount;
      else if (c.paymentMethod === 'CHEQUE') {
        if (c.chequeStatus === 'CLEARED') cCheque += c.totalAmount;
        else if (c.chequeStatus === 'RECEIVED') cChequePending += c.totalAmount;
      } else cOther += c.totalAmount;
    }

    setTodayCash(cCash);
    setTodayGPay(cGPay);
    setTodayCheque(cCheque);
    setTodayUnclearedCheque(cChequePending);
    setTodayCollections(cCash + cGPay + cCheque + cOther);

    // 2. Retailers & Beats Counts
    const allRetailers = await retailerService.getAll();
    setTotalRetailers(allRetailers.length);
    const rMap = new Map<number, Retailer>();
    allRetailers.forEach((r) => rMap.set(r.id!, r));
    setRetailerMap(rMap);

    const activeBeats = await beatService.getActiveBeats();
    setActiveBeatsCount(activeBeats.length);

    // All time sales count
    const allSales = await salesService.getAll();
    setAllTimeSalesCount(allSales.length);

    // 3. Outstanding Totals & Top 10 Debtors
    const allOutstanding = await outstandingService.getAllRetailersOutstanding();
    const totOut = allOutstanding.reduce((sum, r) => sum + r.currentOutstanding, 0);
    setTotalOutstanding(totOut);
    setTopDebtors(allOutstanding.filter((d) => d.currentOutstanding > 0).slice(0, 7));

    // 4. Beat-wise Outstanding Chart (Deduplicated)
    const beatSummaries = await outstandingService.getAllBeatsOutstanding();
    const seenBeatNames = new Set<string>();
    const cleanBeatData: { name: string; outstanding: number }[] = [];

    for (const b of beatSummaries) {
      if (!seenBeatNames.has(b.beat.name)) {
        seenBeatNames.add(b.beat.name);
        cleanBeatData.push({
          name: b.beat.name,
          outstanding: toRupees(b.totalOutstanding),
        });
      }
    }
    setBeatOutstandingData(cleanBeatData);

    // 5. Recent Transactions
    setRecentSales(allSales.slice(0, 5));
    const allCols = await collectionService.getCollections({});
    setRecentCollections(allCols.slice(0, 5));

    // 6. Day-end verification check (mismatch alert)
    const daySummary = await dayEndService.calculateDayEndSummary(today);
    if (daySummary.verificationStatus === 'MISMATCH') {
      setHasBalanceMismatch(true);
      setMismatchDate(today);
    } else {
      setHasBalanceMismatch(false);
      setMismatchDate(null);
    }

    // 7. Trend Chart based on selected date filter
    const range = getDateRangeFromFilter(dateFilter, customFrom, customTo);
    const periodSales = await salesService.getSales({ fromDate: range.from, toDate: range.to });
    const periodCols = await collectionService.getCollections({ fromDate: range.from, toDate: range.to });

    const dateMap = new Map<string, { sales: number; collections: number }>();
    periodSales.forEach((s) => {
      const entry = dateMap.get(s.date) || { sales: 0, collections: 0 };
      entry.sales += toRupees(s.billAmount);
      dateMap.set(s.date, entry);
    });

    periodCols.forEach((c) => {
      const isConfirmed = c.paymentMethod !== 'CHEQUE' || c.chequeStatus === 'CLEARED';
      if (isConfirmed) {
        const entry = dateMap.get(c.date) || { sales: 0, collections: 0 };
        entry.collections += toRupees(c.totalAmount);
        dateMap.set(c.date, entry);
      }
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    const trend = sortedDates.map((d) => ({
      date: formatDateDisplay(d),
      sales: Math.round(dateMap.get(d)!.sales),
      collections: Math.round(dateMap.get(d)!.collections),
    }));
    setDailyTrendData(trend);
  };

  useEffect(() => {
    loadDashboardData();
  }, [dateFilter, customFrom, customTo, reloadTrigger]);

  const handleQuickSeedDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await seedService.seedDemoData();
      showToast({
        type: 'success',
        message: `Loaded ${res.retailers} sample retailers with ${res.sales} sales & ${res.collections} collections!`,
      });
      refreshData();
      await loadDashboardData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Demo load failed' });
    } finally {
      setIsSeeding(false);
    }
  };

  const COLORS = ['#1d446e', '#2563eb', '#0284c7', '#0d9488', '#f59e0b'];

  return (
    <div className="space-y-5">
      {/* Balance Mismatch Warning Banner */}
      {hasBalanceMismatch && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900 rounded-lg text-rose-700 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                Daily Balance Reconciliation Mismatch Detected!
              </h4>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Opening and closing balances for {formatDateDisplay(mismatchDate)} show an unverified variance.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentTab('dayEnd')}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
          >
            Open Reconciliation
          </button>
        </div>
      )}

      {/* Empty Database Quick-Start Banner */}
      {totalRetailers === 0 && (
        <div className="p-4 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-950 text-white rounded-xl shadow-md border border-navy-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold tracking-wide">
                Database is Currently Empty (0 Retailers, 0 Bills)
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              This client-side ERP runs 100% offline in your browser. Click <strong className="text-sky-300">"Load Sample Data"</strong> to instantly populate 20 retailers across 5 beats, sales bills, collections, and explore all charts and reports.
            </p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => setCurrentTab('sales')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            >
              + Record Sale
            </button>
            <button
              onClick={handleQuickSeedDemo}
              disabled={isSeeding}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-navy-950 shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSeeding ? 'Loading Data...' : '⚡ Load Sample Data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 Clean Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Sales */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today's Invoiced Sales
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell text-left tracking-tight">
              {formatINR(todaySales)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {todaySalesCount} bill{todaySalesCount === 1 ? '' : 's'} recorded today
            </p>
          </div>
        </div>

        {/* 2. Today's Collections */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today's Collections
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 num-cell text-left tracking-tight">
              {formatINR(todayCollections)}
            </h3>
            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1 font-medium">
              <span>Cash: <strong className="text-slate-700 dark:text-slate-300">{formatINR(todayCash, false)}</strong></span>
              <span>•</span>
              <span>GPay: <strong className="text-slate-700 dark:text-slate-300">{formatINR(todayGPay, false)}</strong></span>
              <span>•</span>
              <span>Chq: <strong className="text-slate-700 dark:text-slate-300">{formatINR(todayCheque, false)}</strong></span>
            </div>
          </div>
        </div>

        {/* 3. Total Outstanding */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-rose-200 dark:border-rose-900 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Total Outstanding Due
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 num-cell text-left tracking-tight">
              {formatINR(totalOutstanding)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Net market debt across retailers
            </p>
          </div>
        </div>

        {/* 4. Pending Cheques */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Uncleared Cheques
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 num-cell text-left tracking-tight">
              {formatINR(todayUnclearedCheque)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pending bank deposit/clearance
            </p>
          </div>
        </div>
      </div>

      {/* Subtle Information Strip & Quick Action Bar */}
      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3 text-slate-500">
          <span className="flex items-center space-x-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-sky-600" />
            <span><strong className="text-slate-800 dark:text-white">{activeBeatsCount}</strong> Active Beats</span>
          </span>
          <span>•</span>
          <span className="flex items-center space-x-1.5 font-medium">
            <Store className="w-3.5 h-3.5 text-navy-700 dark:text-sky-400" />
            <span><strong className="text-slate-800 dark:text-white">{totalRetailers}</strong> Registered Retailers</span>
          </span>
          <span>•</span>
          <span className="text-emerald-600 font-semibold">100% Offline IndexedDB</span>
        </div>

        <div className="flex items-center space-x-2">
          {totalRetailers === 0 && (
            <button
              onClick={handleQuickSeedDemo}
              disabled={isSeeding}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition text-xs shadow-xs"
            >
              <Database className="w-3.5 h-3.5" />
              <span>⚡ Load Sample Data</span>
            </button>
          )}
          <button
            onClick={() => setCurrentTab('sales')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-white font-semibold transition"
          >
            <PlusCircle className="w-3.5 h-3.5 text-sky-300" />
            <span>+ New Sale</span>
          </button>
          <button
            onClick={() => setCurrentTab('collections')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold transition"
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-200" />
            <span>+ Collection</span>
          </button>
          <button
            onClick={() => setCurrentTab('ledger')}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Ledger</span>
          </button>
        </div>
      </div>

      {/* Charts Section: Sales vs Collection & Beat-wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales vs Collections Comparison Chart */}
        <div className="lg:col-span-2 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Sales vs Collection Daily Inflow
              </h3>
              <p className="text-[11px] text-slate-500">Invoiced value vs payment recovery comparison</p>
            </div>
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
          </div>

          <div className="h-64 w-full">
            {dailyTrendData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <p>No sales or collection records found in this selected period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip formatter={(value: any) => [`₹${value}`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Sales (₹)" fill="#1d446e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collections" name="Collections (₹)" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Beat-wise Outstanding Distribution */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Beat Outstanding Split
            </h3>
            <p className="text-[11px] text-slate-500">Uncollected dues across active beats</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            {totalOutstanding === 0 ? (
              <div className="flex flex-col items-center text-center space-y-2 text-xs text-slate-400 p-4">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Zero Outstanding Balances
                </p>
                <p className="text-[11px] text-slate-400">
                  All retailer balances are either settled or no invoices are due.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={beatOutstandingData.filter((b) => b.outstanding > 0)}
                    dataKey="outstanding"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={42}
                    paddingAngle={3}
                  >
                    {beatOutstandingData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`₹${val}`, 'Outstanding']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Top Retailers by Outstanding & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Retailers by Outstanding */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Top Retailers by Outstanding
            </h3>
            <button
              onClick={() => setCurrentTab('outstanding')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              View Full Aging Report →
            </button>
          </div>

          {topDebtors.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No outstanding dues recorded.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {topDebtors.map((debtor, index) => (
                <div
                  key={debtor.retailer.id}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition px-1 rounded cursor-pointer"
                  onClick={() => openRetailerLedger(debtor.retailer.id!)}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold text-[10px] flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {debtor.retailer.retailerName}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2">({debtor.beatName})</span>
                    </div>
                  </div>
                  <span className="font-bold text-rose-600 dark:text-rose-400 num-cell">
                    {formatINR(debtor.currentOutstanding)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Sales & Collections
            </h3>
            <span className="text-[11px] text-slate-400">Latest business activity</span>
          </div>

          {recentSales.length === 0 && recentCollections.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No transactions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {recentSales.map((s) => (
                <div key={`s-${s.id}`} className="py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Bill #{s.billNumber}
                      </span>
                      <span className="text-slate-400 ml-1">
                        • {retailerMap.get(s.retailerId)?.retailerName}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white num-cell">
                    {formatINR(s.billAmount)}
                  </span>
                </div>
              ))}

              {recentCollections.map((c) => (
                <div key={`c-${c.id}`} className="py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Receipt #{c.collectionNumber}
                      </span>
                      <span className="text-slate-400 ml-1">
                        • {retailerMap.get(c.retailerId)?.retailerName} ({c.paymentMethod})
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 num-cell">
                    {formatINR(c.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
