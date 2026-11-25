import { db } from '../db/database';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type {
  Retailer,
  RetailerOutstandingSummary,
  BeatOutstandingSummary,
  OutstandingAgeingSummary,
} from '../types';
import { collectionService } from './collectionService';
import { beatService } from './beatService';
import { getTodayDateString } from '../utils/date';

export const outstandingService = {
  /**
   * Calculates confirmed and pending outstanding for a single retailer.
   */
  async getRetailerOutstanding(retailerId: number): Promise<RetailerOutstandingSummary> {
    const retailer = await db.retailers.get(retailerId);
    if (!retailer) throw new Error(`Retailer #${retailerId} not found`);

    const beat = await db.beats.get(retailer.beatId);
    const beatName = beat ? beat.name : 'Unknown Beat';

    // 1. Sales
    const sales = await db.sales
      .filter((s) => !s.isVoided && s.retailerId === retailerId)
      .toArray();
    const totalSales = sales.reduce((sum, s) => sum + s.billAmount, 0);

    // 2. Collections
    const collections = await db.collections
      .filter((c) => !c.isVoided && c.retailerId === retailerId)
      .toArray();

    let totalConfirmedCollections = 0;
    let pendingChequeAmount = 0;
    let lastCollectionDate: string | undefined;

    for (const c of collections) {
      if (c.paymentMethod === 'CHEQUE') {
        if (c.chequeStatus === 'CLEARED') {
          totalConfirmedCollections += c.totalAmount;
        } else if (c.chequeStatus === 'RECEIVED') {
          pendingChequeAmount += c.totalAmount;
        }
      } else {
        totalConfirmedCollections += c.totalAmount;
      }

      if (!lastCollectionDate || c.date > lastCollectionDate) {
        lastCollectionDate = c.date;
      }
    }

    // Formula: Closing Outstanding = Opening Outstanding + Sales - Confirmed Collections
    const currentOutstanding = retailer.openingBalance + totalSales - totalConfirmedCollections;

    // 3. Unpaid bills analysis
    const unpaidBills = await collectionService.getUnpaidBillsForRetailer(retailerId);
    const activeUnpaid = unpaidBills.filter((b) => b.remainingAmount > 0);
    const oldestUnpaidBillDate = activeUnpaid.length > 0 ? activeUnpaid[0].sale.date : undefined;

    return {
      retailer,
      beatName,
      openingBalance: retailer.openingBalance,
      totalSales,
      totalConfirmedCollections,
      pendingChequeAmount,
      currentOutstanding,
      lastCollectionDate,
      oldestUnpaidBillDate,
      unpaidBillsCount: activeUnpaid.length,
    };
  },

  /**
   * Returns outstanding summaries for all retailers.
   */
  async getAllRetailersOutstanding(): Promise<RetailerOutstandingSummary[]> {
    const retailers = await db.retailers.toArray();
    const beats = await beatService.getAll();
    const beatMap = new Map(beats.map((b) => [b.id!, b.name]));

    const sales = await db.sales.filter((s) => !s.isVoided).toArray();
    const collections = await db.collections.filter((c) => !c.isVoided).toArray();

    // Map sales by retailerId
    const salesByRetailer = new Map<number, number>();
    sales.forEach((s) => {
      salesByRetailer.set(s.retailerId, (salesByRetailer.get(s.retailerId) || 0) + s.billAmount);
    });

    // Map confirmed and pending collections by retailerId
    const confirmedCollectionsByRetailer = new Map<number, number>();
    const pendingChequesByRetailer = new Map<number, number>();
    const lastCollectionDateByRetailer = new Map<number, string>();

    collections.forEach((c) => {
      if (c.paymentMethod === 'CHEQUE') {
        if (c.chequeStatus === 'CLEARED') {
          confirmedCollectionsByRetailer.set(
            c.retailerId,
            (confirmedCollectionsByRetailer.get(c.retailerId) || 0) + c.totalAmount
          );
        } else if (c.chequeStatus === 'RECEIVED') {
          pendingChequesByRetailer.set(
            c.retailerId,
            (pendingChequesByRetailer.get(c.retailerId) || 0) + c.totalAmount
          );
        }
      } else {
        confirmedCollectionsByRetailer.set(
          c.retailerId,
          (confirmedCollectionsByRetailer.get(c.retailerId) || 0) + c.totalAmount
        );
      }

      const existingDate = lastCollectionDateByRetailer.get(c.retailerId);
      if (!existingDate || c.date > existingDate) {
        lastCollectionDateByRetailer.set(c.retailerId, c.date);
      }
    });

    const results: RetailerOutstandingSummary[] = [];

    for (const r of retailers) {
      const totSales = salesByRetailer.get(r.id!) || 0;
      const totConfirmed = confirmedCollectionsByRetailer.get(r.id!) || 0;
      const pendingCheque = pendingChequesByRetailer.get(r.id!) || 0;
      const currentOutstanding = r.openingBalance + totSales - totConfirmed;

      results.push({
        retailer: r,
        beatName: beatMap.get(r.beatId) || 'Unknown Beat',
        openingBalance: r.openingBalance,
        totalSales: totSales,
        totalConfirmedCollections: totConfirmed,
        pendingChequeAmount: pendingCheque,
        currentOutstanding,
        lastCollectionDate: lastCollectionDateByRetailer.get(r.id!),
        oldestUnpaidBillDate: undefined,
        unpaidBillsCount: 0,
      });
    }

    return results.sort((a, b) => b.currentOutstanding - a.currentOutstanding);
  },

  /**
   * Returns beat-wise aggregated sales, collections, and outstanding.
   */
  async getAllBeatsOutstanding(): Promise<BeatOutstandingSummary[]> {
    const beats = await beatService.getAll();
    const retailerSummaries = await this.getAllRetailersOutstanding();

    const beatSummaries: BeatOutstandingSummary[] = beats.map((beat) => {
      const beatRetailers = retailerSummaries.filter((r) => r.retailer.beatId === beat.id);
      const totalSales = beatRetailers.reduce((sum, r) => sum + r.totalSales, 0);
      const totalCollections = beatRetailers.reduce((sum, r) => sum + r.totalConfirmedCollections, 0);
      const totalOutstanding = beatRetailers.reduce((sum, r) => sum + r.currentOutstanding, 0);

      return {
        beat,
        retailerCount: beatRetailers.length,
        totalSales,
        totalCollections,
        totalOutstanding,
        retailers: beatRetailers,
      };
    });

    return beatSummaries;
  },

  /**
   * Overall system outstanding summary.
   */
  async getOverallOutstanding(): Promise<{
    totalOpening: number;
    totalSales: number;
    totalConfirmedCollections: number;
    pendingCheques: number;
    totalClosingOutstanding: number;
  }> {
    const retailerSummaries = await this.getAllRetailersOutstanding();

    let totalOpening = 0;
    let totalSales = 0;
    let totalConfirmedCollections = 0;
    let pendingCheques = 0;
    let totalClosingOutstanding = 0;

    for (const r of retailerSummaries) {
      totalOpening += r.openingBalance;
      totalSales += r.totalSales;
      totalConfirmedCollections += r.totalConfirmedCollections;
      pendingCheques += r.pendingChequeAmount;
      totalClosingOutstanding += r.currentOutstanding;
    }

    return {
      totalOpening,
      totalSales,
      totalConfirmedCollections,
      pendingCheques,
      totalClosingOutstanding,
    };
  },

  /**
   * Calculates Ageing buckets for unpaid amounts:
   * 0–7 days, 8–15 days, 16–30 days, 31–60 days, Above 60 days
   */
  async getOutstandingAgeing(asOfDateStr?: string): Promise<OutstandingAgeingSummary[]> {
    const asOfDate = asOfDateStr ? parseISO(asOfDateStr) : parseISO(getTodayDateString());
    const retailers = await db.retailers.toArray();
    const beats = await beatService.getAll();
    const beatMap = new Map(beats.map((b) => [b.id!, b.name]));

    const ageingList: OutstandingAgeingSummary[] = [];

    for (const retailer of retailers) {
      const unpaidBills = await collectionService.getUnpaidBillsForRetailer(retailer.id!);

      let days0To7 = 0;
      let days8To15 = 0;
      let days16To30 = 0;
      let days31To60 = 0;
      let daysAbove60 = 0;

      // Ageing for unpaid bills
      for (const bill of unpaidBills) {
        if (bill.remainingAmount <= 0) continue;
        const billDate = parseISO(bill.sale.date);
        const days = Math.max(0, differenceInCalendarDays(asOfDate, billDate));

        if (days <= 7) {
          days0To7 += bill.remainingAmount;
        } else if (days <= 15) {
          days8To15 += bill.remainingAmount;
        } else if (days <= 30) {
          days16To30 += bill.remainingAmount;
        } else if (days <= 60) {
          days31To60 += bill.remainingAmount;
        } else {
          daysAbove60 += bill.remainingAmount;
        }
      }

      // Ageing for opening balance if unpaid
      // If opening balance > 0, age it from openingBalanceDate
      if (retailer.openingBalance > 0) {
        // Any confirmed collections not allocated to sales reduce opening balance
        const openingDays = Math.max(0, differenceInCalendarDays(asOfDate, parseISO(retailer.openingBalanceDate)));
        const openingAmount = retailer.openingBalance; // default bucket
        if (openingDays <= 7) {
          days0To7 += openingAmount;
        } else if (openingDays <= 15) {
          days8To15 += openingAmount;
        } else if (openingDays <= 30) {
          days16To30 += openingAmount;
        } else if (openingDays <= 60) {
          days31To60 += openingAmount;
        } else {
          daysAbove60 += openingAmount;
        }
      }

      const currentOutstanding = days0To7 + days8To15 + days16To30 + days31To60 + daysAbove60;

      if (currentOutstanding > 0) {
        ageingList.push({
          retailerId: retailer.id!,
          retailerName: retailer.retailerName,
          beatName: beatMap.get(retailer.beatId) || 'Unknown Beat',
          currentOutstanding,
          days0To7,
          days8To15,
          days16To30,
          days31To60,
          daysAbove60,
        });
      }
    }

    return ageingList.sort((a, b) => b.currentOutstanding - a.currentOutstanding);
  },
};
