import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  Building,
  Truck,
  CircleDollarSign,
  Edit2,
  Trash2,
} from 'lucide-react';
import { DataTable, type Column } from '../../components/common/DataTable';
import { DateRangeFilter } from '../../components/common/DateRangeFilter';
import { ExpenseFormModal } from './ExpenseFormModal';
import { expenseService, EXPENSE_CATEGORIES } from '../../services/expenseService';
import { beatService } from '../../services/beatService';
import { formatINR, toRupees } from '../../utils/money';
import { formatDateDisplay, getDateRangeFromFilter, getTodayDateString, type DateFilterType } from '../../utils/date';
import { useApp } from '../../context/AppContext';
import type { Expense, Beat, ExpenseSummary, PaymentMethodType } from '../../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ExpensePage: React.FC = () => {
  const { showToast, askConfirmation, reloadTrigger, refreshData, businessName, operatorName } = useApp();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    todayTotal: 0,
    todayCash: 0,
    todayDigital: 0,
    thisMonthTotal: 0,
    totalCount: 0,
    categoryBreakdown: [],
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>(undefined);

  const beatMap = useMemo(() => {
    const map = new Map<number, string>();
    beats.forEach((b) => map.set(b.id!, b.name));
    return map;
  }, [beats]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allBeats = await beatService.getAll();
      setBeats(allBeats);

      const { from, to } = getDateRangeFromFilter(dateFilter, customFrom, customTo);

      const list = await expenseService.getExpenses({
        fromDate: from,
        toDate: to,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        paymentMethod: selectedMethod !== 'ALL' ? (selectedMethod as PaymentMethodType) : undefined,
        search: searchQuery,
      });
      setExpenses(list);

      const sum = await expenseService.getSummary();
      setSummary(sum);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to load expenses' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter, customFrom, customTo, selectedCategory, selectedMethod, searchQuery, reloadTrigger]);

  const handleOpenAddModal = () => {
    setExpenseToEdit(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const handleVoidExpense = (expense: Expense) => {
    askConfirmation({
      title: `Void Expense Voucher #${expense.voucherNumber}?`,
      message: `Are you sure you want to void this expense of ${formatINR(expense.amount)} for "${expense.paidTo}"? This action is recorded in the audit trail.`,
      confirmText: 'Void Expense',
      isDanger: true,
      onConfirm: async () => {
        try {
          await expenseService.void(expense.id!, 'Voided by user request', operatorName);
          showToast({ type: 'success', message: `Expense voucher #${expense.voucherNumber} voided` });
          refreshData();
          loadData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Failed to void expense' });
        }
      },
    });
  };

  // Helper for category badge
  const getCategoryBadge = (category: string) => {
    const found = EXPENSE_CATEGORIES.find((c) => c.key === category);
    const label = found ? found.label : category;
    const color = found ? found.color : 'bg-slate-100 text-slate-800 border-slate-300';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}>
        {label}
      </span>
    );
  };

  // Helper for payment method badge
  const getPaymentMethodBadge = (method: PaymentMethodType) => {
    switch (method) {
      case 'CASH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            💵 Cash
          </span>
        );
      case 'GPAY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            📱 GPay
          </span>
        );
      case 'BANK_TRANSFER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            🏦 Bank Transfer
          </span>
        );
      case 'CHEQUE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            📝 Cheque
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            {method}
          </span>
        );
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (expenses.length === 0) {
      showToast({ type: 'warning', message: 'No expenses available to export' });
      return;
    }

    const rows = expenses.map((e) => ({
      'Voucher No': e.voucherNumber,
      'Date': e.date,
      'Category': EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label || e.category,
      'Paid To': e.paidTo,
      'Payment Method': e.paymentMethod,
      'Amount (INR)': toRupees(e.amount),
      'Route Beat': e.beatId ? beatMap.get(e.beatId) || '' : '',
      'Vehicle No': e.vehicleNumber || '',
      'Notes': e.remarks || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `Expenses_${getTodayDateString()}.xlsx`);
    showToast({ type: 'success', message: 'Expenses exported to Excel successfully' });
  };

  // PDF Export
  const handleExportPDF = () => {
    if (expenses.length === 0) {
      showToast({ type: 'warning', message: 'No expenses available to export' });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(businessName || 'Retail Distribution Agency', 14, 15);
    doc.setFontSize(10);
    doc.text(`Daily Business Expenses Voucher Register - Date: ${formatDateDisplay(getTodayDateString())}`, 14, 22);

    const tableData = expenses.map((e) => [
      e.voucherNumber,
      formatDateDisplay(e.date),
      EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label || e.category,
      e.paidTo,
      e.paymentMethod,
      `INR ${toRupees(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      e.beatId ? beatMap.get(e.beatId) || '' : '',
      e.remarks || '',
    ]);

    autoTable(doc, {
      head: [['Voucher No', 'Date', 'Category', 'Paid To', 'Method', 'Amount', 'Beat', 'Notes']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [29, 68, 110] },
    });

    doc.save(`Expenses_Register_${getTodayDateString()}.pdf`);
    showToast({ type: 'success', message: 'Expenses register saved as PDF' });
  };

  const columns: Column<Expense>[] = [
    {
      key: 'voucherNumber',
      header: 'Voucher No',
      sortable: true,
      render: (exp: Expense) => (
        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{exp.voucherNumber}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (exp: Expense) => <span className="text-xs text-slate-700 dark:text-slate-300">{formatDateDisplay(exp.date)}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (exp: Expense) => getCategoryBadge(exp.category),
    },
    {
      key: 'paidTo',
      header: 'Paid To / Beneficiary',
      sortable: true,
      render: (exp: Expense) => (
        <div>
          <span className="font-semibold text-xs text-slate-900 dark:text-white">{exp.paidTo}</span>
          {exp.vehicleNumber && (
            <span className="block text-[11px] font-mono text-slate-500">Reg: {exp.vehicleNumber}</span>
          )}
        </div>
      ),
    },
    {
      key: 'beatId',
      header: 'Route Beat',
      render: (exp: Expense) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {exp.beatId ? beatMap.get(exp.beatId) || 'Unknown' : '—'}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Payment Method',
      render: (exp: Expense) => getPaymentMethodBadge(exp.paymentMethod),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      render: (exp: Expense) => <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">{formatINR(exp.amount)}</span>,
    },
    {
      key: 'remarks',
      header: 'Notes / Remarks',
      render: (exp: Expense) => <span className="text-xs text-slate-500 truncate max-w-[180px] block">{exp.remarks || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (exp: Expense) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => handleOpenEditModal(exp)}
            title="Edit Expense Voucher"
            className="p-1 text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleVoidExpense(exp)}
            title="Void Expense"
            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-lg text-rose-700 dark:text-rose-400">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daily Business Expenses & Outflows</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track operational overheads, vehicle fuel, staff allowance, and maintenance for daily cash drawer reconciliation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-sky-400" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Total Expenses */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell text-left tracking-tight">
              {formatINR(summary.todayTotal)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Total vouchers logged today</p>
          </div>
        </div>

        {/* 2. Today's Cash Outflow */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Outflow (Today)</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 num-cell text-left tracking-tight">
              {formatINR(summary.todayCash)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Deducted from daily cash in drawer</p>
          </div>
        </div>

        {/* 3. Today's Digital / Bank Outflow */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Digital & Bank (Today)</span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-sky-600 dark:text-sky-400 num-cell text-left tracking-tight">
              {formatINR(summary.todayDigital)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Paid via GPay / NEFT / Cheque</p>
          </div>
        </div>

        {/* 4. This Month's Cumulative Expenses */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">This Month Total</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white num-cell text-left tracking-tight">
              {formatINR(summary.thisMonthTotal)}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Cumulative monthly operational cost</p>
          </div>
        </div>
      </div>

      {/* Monthly Category Spending Breakdown (if any expenses logged this month) */}
      {summary.categoryBreakdown.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Monthly Category Spending Breakdown
            </span>
            <span className="text-xs text-slate-500">
              Month Total: <strong className="text-slate-900 dark:text-white">{formatINR(summary.thisMonthTotal)}</strong>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summary.categoryBreakdown.map((item) => {
              const catMeta = EXPENSE_CATEGORIES.find((c) => c.key === item.category);
              return (
                <div key={item.category} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {catMeta ? catMeta.label : item.category}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{item.percentage}%</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{formatINR(item.amount)}</div>
                  <div className="w-full bg-slate-200 dark:bg-slate-600 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-sky-500 h-full rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Date Filter */}
          <DateRangeFilter
            selectedFilter={dateFilter}
            onChange={setDateFilter}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, t) => {
              setCustomFrom(f);
              setCustomTo(t);
            }}
          />

          {/* Category & Payment Method Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="GPAY">GPay / UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by voucher number, paid to vendor, vehicle registration, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={expenses}
          emptyMessage="No expense records found for the selected date and filter."
        />
      </div>

      {/* Modal Dialog */}
      <ExpenseFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          refreshData();
          loadData();
        }}
        expenseToEdit={expenseToEdit}
      />
    </div>
  );
};
