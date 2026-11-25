import { db } from '../db/database';
import { auditService } from './auditService';
import { getTodayDateString } from '../utils/date';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import type { Expense, ExpenseCategoryType, ExpenseSummary, PaymentMethodType } from '../types';

export const EXPENSE_CATEGORIES: { key: ExpenseCategoryType; label: string; color: string }[] = [
  { key: 'FUEL_TRANSPORT', label: 'Fuel & Delivery Transport', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'STAFF_ALLOWANCE', label: 'Salesman DA / Staff Allowance', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { key: 'VEHICLE_MAINTENANCE', label: 'Vehicle Service & Maintenance', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'OFFICE_TEA', label: 'Tea & Refreshments', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { key: 'LOADING_UNLOADING', label: 'Loading / Unloading Coolie', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { key: 'RENT_UTILITIES', label: 'Godown Rent & Electricity', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { key: 'PACKAGING', label: 'Packaging Materials', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { key: 'MISCELLANEOUS', label: 'Other Miscellaneous Expenses', color: 'bg-slate-100 text-slate-800 border-slate-300' },
];

export interface ExpenseFilterParams {
  date?: string;
  fromDate?: string;
  toDate?: string;
  category?: string;
  paymentMethod?: PaymentMethodType;
  beatId?: number;
  search?: string;
  includeVoided?: boolean;
}

export const expenseService = {
  /**
   * Generates sequential voucher number for a date: EXP-YYYYMMDD-001
   */
  async generateVoucherNumber(date: string): Promise<string> {
    const cleanDate = date.replace(/-/g, '');
    const prefix = `EXP-${cleanDate}-`;
    const count = await db.expenses
      .filter((e) => e.date === date)
      .count();
    const nextSeq = (count + 1).toString().padStart(3, '0');
    return `${prefix}${nextSeq}`;
  },

  /**
   * Fetch expenses matching filters
   */
  async getExpenses(params: ExpenseFilterParams = {}): Promise<Expense[]> {
    let collection = db.expenses.toCollection();

    let list = await collection.toArray();

    if (!params.includeVoided) {
      list = list.filter((e) => !e.isVoided);
    }

    if (params.date) {
      list = list.filter((e) => e.date === params.date);
    }

    if (params.fromDate) {
      list = list.filter((e) => e.date >= params.fromDate!);
    }

    if (params.toDate) {
      list = list.filter((e) => e.date <= params.toDate!);
    }

    if (params.category && params.category !== 'ALL') {
      list = list.filter((e) => e.category === params.category);
    }

    if (params.paymentMethod) {
      list = list.filter((e) => e.paymentMethod === params.paymentMethod);
    }

    if (params.beatId) {
      list = list.filter((e) => e.beatId === params.beatId);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.voucherNumber.toLowerCase().includes(q) ||
          e.paidTo.toLowerCase().includes(q) ||
          (e.remarks && e.remarks.toLowerCase().includes(q)) ||
          (e.vehicleNumber && e.vehicleNumber.toLowerCase().includes(q))
      );
    }

    // Sort descending by date, then id
    return list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.id || 0) - (a.id || 0);
    });
  },

  /**
   * Get single expense by ID
   */
  async getExpenseById(id: number): Promise<Expense | undefined> {
    return db.expenses.get(id);
  },

  /**
   * Create a new expense entry
   */
  async create(
    data: {
      date: string;
      category: ExpenseCategoryType | string;
      amount: number; // in paise
      paymentMethod: PaymentMethodType;
      paidTo: string;
      beatId?: number;
      vehicleNumber?: string;
      remarks?: string;
    },
    operator = 'Operator'
  ): Promise<Expense> {
    if (data.amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }
    if (!data.paidTo.trim()) {
      throw new Error('Recipient / Vendor name is required');
    }

    const voucherNumber = await this.generateVoucherNumber(data.date);
    const now = new Date().toISOString();

    const newExpense: Expense = {
      voucherNumber,
      date: data.date,
      category: data.category,
      amount: Math.round(data.amount),
      paymentMethod: data.paymentMethod,
      paidTo: data.paidTo.trim(),
      beatId: data.beatId,
      vehicleNumber: data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : undefined,
      remarks: data.remarks ? data.remarks.trim() : undefined,
      isVoided: false,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.expenses.add(newExpense);
    newExpense.id = id;

    await auditService.log({
      entityType: 'EXPENSE',
      entityId: id,
      action: 'CREATE',
      newValue: JSON.stringify(newExpense),
      reason: `Recorded expense voucher ${voucherNumber} for ₹${(data.amount / 100).toFixed(2)} (${data.category})`,
      operator,
    });

    return newExpense;
  },

  /**
   * Update an existing expense
   */
  async update(
    id: number,
    data: Partial<Omit<Expense, 'id' | 'voucherNumber' | 'createdAt'>>,
    reason: string,
    operator = 'Operator'
  ): Promise<Expense> {
    const existing = await db.expenses.get(id);
    if (!existing) {
      throw new Error('Expense record not found');
    }
    if (existing.isVoided) {
      throw new Error('Cannot edit a voided expense');
    }

    const updated: Expense = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await db.expenses.put(updated);

    await auditService.log({
      entityType: 'EXPENSE',
      entityId: id,
      action: 'UPDATE',
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
      reason: reason || 'Updated expense voucher details',
      operator,
    });

    return updated;
  },

  /**
   * Void an expense
   */
  async void(id: number, reason: string, operator = 'Operator'): Promise<void> {
    const existing = await db.expenses.get(id);
    if (!existing) {
      throw new Error('Expense record not found');
    }

    const updated: Expense = {
      ...existing,
      isVoided: true,
      voidReason: reason || 'Voided by operator',
      updatedAt: new Date().toISOString(),
    };

    await db.expenses.put(updated);

    await auditService.log({
      entityType: 'EXPENSE',
      entityId: id,
      action: 'VOID',
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
      reason: reason || 'Voided expense voucher',
      operator,
    });
  },

  /**
   * Computes comprehensive expense summary:
   * - Today Total
   * - Today Cash (reduces physical cash in hand)
   * - Today Digital (GPay/Bank)
   * - This Month Total
   * - Category Breakdown with percentages
   */
  async getSummary(date?: string): Promise<ExpenseSummary> {
    const today = date || getTodayDateString();
    const todayObj = new Date(today);
    const monthStart = format(startOfMonth(todayObj), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(todayObj), 'yyyy-MM-dd');

    const allExpenses = await db.expenses.filter((e) => !e.isVoided).toArray();

    let todayTotal = 0;
    let todayCash = 0;
    let todayDigital = 0;
    let thisMonthTotal = 0;

    const catMap = new Map<string, { amount: number; count: number }>();

    for (const exp of allExpenses) {
      // Month calculation
      if (exp.date >= monthStart && exp.date <= monthEnd) {
        thisMonthTotal += exp.amount;

        // Group categories for the active month
        const curr = catMap.get(exp.category) || { amount: 0, count: 0 };
        curr.amount += exp.amount;
        curr.count += 1;
        catMap.set(exp.category, curr);
      }

      // Today calculation
      if (exp.date === today) {
        todayTotal += exp.amount;
        if (exp.paymentMethod === 'CASH') {
          todayCash += exp.amount;
        } else {
          todayDigital += exp.amount;
        }
      }
    }

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([cat, val]) => ({
        category: cat,
        amount: val.amount,
        count: val.count,
        percentage: thisMonthTotal > 0 ? Math.round((val.amount / thisMonthTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      todayTotal,
      todayCash,
      todayDigital,
      thisMonthTotal,
      totalCount: allExpenses.length,
      categoryBreakdown,
    };
  },
};
