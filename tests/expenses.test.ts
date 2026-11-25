import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database';
import { expenseService } from '../src/services/expenseService';
import { getTodayDateString } from '../src/utils/date';

describe('Expense Management Service Tests', () => {
  beforeEach(async () => {
    await db.expenses.clear();
    await db.auditLogs.clear();
  });

  it('creates an expense voucher with sequential voucher numbering and stores paise amount', async () => {
    const today = getTodayDateString();

    const exp1 = await expenseService.create({
      date: today,
      category: 'FUEL_TRANSPORT',
      amount: 150000, // ₹1,500.00 in paise
      paymentMethod: 'CASH',
      paidTo: 'HP Fuel Station',
      vehicleNumber: 'TN-22-AA-1111',
      remarks: 'Delivery van fuel filling',
    });

    expect(exp1.id).toBeDefined();
    expect(exp1.voucherNumber).toContain(`EXP-${today.replace(/-/g, '')}-001`);
    expect(exp1.amount).toBe(150000);
    expect(exp1.isVoided).toBe(false);

    // Second expense on the same day gets sequential sequence 002
    const exp2 = await expenseService.create({
      date: today,
      category: 'OFFICE_TEA',
      amount: 24000, // ₹240.00 in paise
      paymentMethod: 'CASH',
      paidTo: 'Sri Krishna Tea Stall',
      remarks: 'Morning refreshments for 6 delivery boys',
    });

    expect(exp2.voucherNumber).toContain(`EXP-${today.replace(/-/g, '')}-002`);
  });

  it('computes summary with cash outflow vs digital outflow and category percentage breakdown', async () => {
    const today = getTodayDateString();

    // 1. Cash expense: ₹1,000
    await expenseService.create({
      date: today,
      category: 'FUEL_TRANSPORT',
      amount: 100000, // ₹1,000
      paymentMethod: 'CASH',
      paidTo: 'Fuel Bunk',
    });

    // 2. Cash expense: ₹500
    await expenseService.create({
      date: today,
      category: 'STAFF_ALLOWANCE',
      amount: 50000, // ₹500
      paymentMethod: 'CASH',
      paidTo: 'Salesman DA',
    });

    // 3. Digital (GPay) expense: ₹2,500
    await expenseService.create({
      date: today,
      category: 'VEHICLE_MAINTENANCE',
      amount: 250000, // ₹2,500
      paymentMethod: 'GPAY',
      paidTo: 'Auto Garage',
    });

    const summary = await expenseService.getSummary(today);

    // Total today = ₹4,000
    expect(summary.todayTotal).toBe(400000);
    // Cash today = ₹1,500
    expect(summary.todayCash).toBe(150000);
    // Digital today = ₹2,500
    expect(summary.todayDigital).toBe(250000);

    // Check category breakdown
    expect(summary.categoryBreakdown.length).toBe(3);
    const maintenance = summary.categoryBreakdown.find((c) => c.category === 'VEHICLE_MAINTENANCE');
    expect(maintenance).toBeDefined();
    expect(maintenance?.amount).toBe(250000);
  });

  it('voids an expense and removes it from active list and summary', async () => {
    const today = getTodayDateString();

    const exp = await expenseService.create({
      date: today,
      category: 'MISCELLANEOUS',
      amount: 50000,
      paymentMethod: 'CASH',
      paidTo: 'Stationery Store',
    });

    let activeList = await expenseService.getExpenses({ date: today });
    expect(activeList.length).toBe(1);

    await expenseService.void(exp.id!, 'Incorrectly logged receipt voucher');

    activeList = await expenseService.getExpenses({ date: today });
    expect(activeList.length).toBe(0);

    const summary = await expenseService.getSummary(today);
    expect(summary.todayTotal).toBe(0);
  });
});
