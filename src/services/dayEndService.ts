import { db } from '../db/database';
import { subDays, format, parseISO } from 'date-fns';
import type { DayEndReportData, VerificationStatusType } from '../types';
import { auditService } from './auditService';

export const dayEndService = {
  /**
   * Computes the day-end financial figures for any specific date.
   * Opening + Sales - Confirmed Collections = Closing.
   */
  async calculateDayEndSummary(date: string): Promise<DayEndReportData> {
    // 1. Calculate opening balance for this date:
    // Opening balance on `date` = Closing balance of previous business day (or prior accumulated balance)
    const openingBalance = await this.calculateOpeningBalanceForDate(date);

    // 2. Sales on this date
    const sales = await db.sales
      .filter((s) => !s.isVoided && s.date === date)
      .toArray();
    const totalSales = sales.reduce((sum, s) => sum + s.billAmount, 0);

    // 3. Collections on this date
    const collections = await db.collections
      .filter((c) => !c.isVoided && c.date === date)
      .toArray();

    let cashCollection = 0;
    let gpayCollection = 0;
    let clearedChequeCollection = 0;
    let bankTransferCollection = 0;
    let otherCollection = 0;
    let unclearedChequeCollection = 0;

    for (const c of collections) {
      if (c.paymentMethod === 'CASH') {
        cashCollection += c.totalAmount;
      } else if (c.paymentMethod === 'GPAY') {
        gpayCollection += c.totalAmount;
      } else if (c.paymentMethod === 'CHEQUE') {
        if (c.chequeStatus === 'CLEARED') {
          clearedChequeCollection += c.totalAmount;
        } else if (c.chequeStatus === 'RECEIVED') {
          unclearedChequeCollection += c.totalAmount;
        }
      } else if (c.paymentMethod === 'BANK_TRANSFER') {
        bankTransferCollection += c.totalAmount;
      } else {
        otherCollection += c.totalAmount;
      }
    }

    const totalConfirmedCollection =
      cashCollection + gpayCollection + clearedChequeCollection + bankTransferCollection + otherCollection;

    // Formula: Closing Balance = Opening Balance + Total Sales - Total Confirmed Collections
    const closingBalance = openingBalance + totalSales - totalConfirmedCollection;

    // Check next day's opening balance if it exists in the system
    const nextDay = format(new Date(parseISO(date).getTime() + 86400000), 'yyyy-MM-dd');
    const existingNextDaily = await db.dailyBalances.where('date').equals(nextDay).first();
    const nextDayOpening = existingNextDaily?.openingBalance;
    const difference = nextDayOpening !== undefined ? nextDayOpening - closingBalance : undefined;

    let verificationStatus: VerificationStatusType = 'PENDING';
    if (difference !== undefined) {
      verificationStatus = difference === 0 ? 'VERIFIED' : 'MISMATCH';
    }

    return {
      date,
      openingBalance,
      totalSales,
      cashCollection,
      gpayCollection,
      clearedChequeCollection,
      bankTransferCollection,
      otherCollection,
      totalConfirmedCollection,
      unclearedChequeCollection,
      closingBalance,
      nextDayOpening,
      difference,
      verificationStatus,
      salesCount: sales.length,
      collectionsCount: collections.length,
    };
  },

  /**
   * Calculates opening balance as of a given date by finding total initial retailer balances
   * + all sales before this date - all confirmed collections before this date.
   */
  async calculateOpeningBalanceForDate(targetDate: string): Promise<number> {
    const retailers = await db.retailers.toArray();
    const totalRetailerOpening = retailers.reduce((sum, r) => sum + r.openingBalance, 0);

    const priorSales = await db.sales
      .filter((s) => !s.isVoided && s.date < targetDate)
      .toArray();
    const priorSalesTotal = priorSales.reduce((sum, s) => sum + s.billAmount, 0);

    const priorCollections = await db.collections
      .filter((c) => !c.isVoided && c.date < targetDate)
      .toArray();

    let priorConfirmedCollections = 0;
    for (const c of priorCollections) {
      if (c.paymentMethod === 'CHEQUE') {
        if (c.chequeStatus === 'CLEARED') {
          priorConfirmedCollections += c.totalAmount;
        }
      } else {
        priorConfirmedCollections += c.totalAmount;
      }
    }

    return totalRetailerOpening + priorSalesTotal - priorConfirmedCollections;
  },

  /**
   * Generates day-end reports for a date range.
   */
  async getDayEndHistory(fromDate: string, toDate: string): Promise<DayEndReportData[]> {
    // Generate dates list
    const from = parseISO(fromDate);
    const to = parseISO(toDate);
    const dates: string[] = [];

    let current = from;
    while (current <= to) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = new Date(current.getTime() + 86400000);
    }

    const summaries: DayEndReportData[] = [];
    for (const d of dates) {
      const summary = await this.calculateDayEndSummary(d);
      // Only include if there are transactions or if explicitly recorded
      summaries.push(summary);
    }

    return summaries.sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * Saves and verifies day-end record in dailyBalances table.
   */
  async verifyDayEnd(date: string, operator = 'Admin', notes?: string): Promise<number> {
    const summary = await this.calculateDayEndSummary(date);

    const existing = await db.dailyBalances.where('date').equals(date).first();

    const record = {
      date,
      openingBalance: summary.openingBalance,
      totalSales: summary.totalSales,
      cashCollections: summary.cashCollection,
      gpayCollections: summary.gpayCollection,
      clearedChequeCollections: summary.clearedChequeCollection,
      otherConfirmedCollections: summary.bankTransferCollection + summary.otherCollection,
      totalConfirmedCollections: summary.totalConfirmedCollection,
      closingBalance: summary.closingBalance,
      verificationStatus: 'VERIFIED' as VerificationStatusType,
      notes,
      verifiedAt: new Date().toISOString(),
      verifiedBy: operator,
    };

    let id: number;
    if (existing) {
      id = existing.id!;
      await db.dailyBalances.put({ ...record, id });
      await auditService.log({
        entityType: 'DAILY_BALANCE',
        entityId: id,
        action: 'UPDATE',
        oldValue: existing,
        newValue: record,
        reason: `Day-end record for ${date} re-verified`,
        operator,
      });
    } else {
      id = await db.dailyBalances.add(record);
      await auditService.log({
        entityType: 'DAILY_BALANCE',
        entityId: id,
        action: 'CREATE',
        newValue: record,
        reason: `Day-end record for ${date} verified and locked`,
        operator,
      });
    }

    return id;
  },
};
