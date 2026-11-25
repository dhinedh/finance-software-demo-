import { db } from '../db/database';
import type { Retailer, LedgerEntry } from '../types';
import { formatDateDisplay } from '../utils/date';

export const ledgerService = {
  /**
   * Generates a complete transaction ledger for a retailer between fromDate and toDate.
   */
  async getRetailerLedger(
    retailerId: number,
    fromDate: string,
    toDate: string
  ): Promise<{
    retailer: Retailer;
    openingBalance: number;
    entries: LedgerEntry[];
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
  }> {
    const retailer = await db.retailers.get(retailerId);
    if (!retailer) throw new Error(`Retailer #${retailerId} not found`);

    // 1. Calculate the opening balance as of fromDate:
    // Opening balance as of fromDate = retailer.openingBalance + (sales before fromDate) - (confirmed collections before fromDate)
    const priorSales = await db.sales
      .filter((s) => !s.isVoided && s.retailerId === retailerId && s.date < fromDate)
      .toArray();
    const priorSalesTotal = priorSales.reduce((sum, s) => sum + s.billAmount, 0);

    const priorCollections = await db.collections
      .filter((c) => !c.isVoided && c.retailerId === retailerId && c.date < fromDate)
      .toArray();

    let priorCollectionsTotal = 0;
    for (const c of priorCollections) {
      if (c.paymentMethod === 'CHEQUE') {
        if (c.chequeStatus === 'CLEARED') {
          priorCollectionsTotal += c.totalAmount;
        }
      } else {
        priorCollectionsTotal += c.totalAmount;
      }
    }

    const calculatedOpeningBalance = retailer.openingBalance + priorSalesTotal - priorCollectionsTotal;

    // 2. Fetch sales and collections within the [fromDate, toDate] range
    const periodSales = await db.sales
      .filter((s) => !s.isVoided && s.retailerId === retailerId && s.date >= fromDate && s.date <= toDate)
      .toArray();

    const periodCollections = await db.collections
      .filter((c) => !c.isVoided && c.retailerId === retailerId && c.date >= fromDate && c.date <= toDate)
      .toArray();

    // Get allocations for all period collections to show details
    const periodCollectionIds = new Set(periodCollections.map((c) => c.id!));
    const allocations = await db.collectionAllocations
      .filter((a) => periodCollectionIds.has(a.collectionId))
      .toArray();

    const saleMap = new Map<number, string>();
    const allSalesForLookup = await db.sales.where('retailerId').equals(retailerId).toArray();
    allSalesForLookup.forEach((s) => saleMap.set(s.id!, s.billNumber));

    // 3. Create unified chronological ledger entries
    interface RawLedgerItem {
      date: string;
      createdAt: string;
      id: string;
      type: 'SALE' | 'COLLECTION';
      particulars: string;
      referenceNo: string;
      debit: number;
      credit: number;
      paymentMethod?: any;
      chequeStatus?: any;
      remarks?: string;
      allocationDetails?: string;
    }

    const rawItems: RawLedgerItem[] = [];

    // Map sales to debit entries
    for (const s of periodSales) {
      rawItems.push({
        id: `S-${s.id}`,
        date: s.date,
        createdAt: s.createdAt,
        type: 'SALE',
        particulars: `Sales Bill #${s.billNumber}${s.collectionDate ? ` • Due: ${formatDateDisplay(s.collectionDate)}` : ''}`,
        referenceNo: s.billNumber,
        debit: s.billAmount,
        credit: 0,
        remarks: s.remarks,
      });
    }

    // Map collections to credit entries (or pending cheque notes)
    for (const c of periodCollections) {
      const isConfirmed = c.paymentMethod !== 'CHEQUE' || c.chequeStatus === 'CLEARED';
      const credit = isConfirmed ? c.totalAmount : 0;

      const colAllocations = allocations.filter((a) => a.collectionId === c.id);
      const allocSummary = colAllocations.length > 0
        ? colAllocations.map((a) => `Bill #${saleMap.get(a.saleId) || a.saleId}: ₹${(a.allocatedAmount / 100).toFixed(2)}`).join(', ')
        : 'General / Unallocated';

      let chequeNote = '';
      if (c.paymentMethod === 'CHEQUE') {
        chequeNote = ` [Cheque: ${c.chequeStatus || 'RECEIVED'}${c.chequeNumber ? ` #${c.chequeNumber}` : ''}]`;
      }

      rawItems.push({
        id: `C-${c.id}`,
        date: c.date,
        createdAt: c.createdAt,
        type: 'COLLECTION',
        particulars: `${c.paymentMethod} Collection #${c.collectionNumber}${chequeNote}`,
        referenceNo: c.collectionNumber,
        debit: 0,
        credit,
        paymentMethod: c.paymentMethod,
        chequeStatus: c.chequeStatus,
        remarks: c.remarks,
        allocationDetails: allocSummary,
      });
    }

    // Sort by date ascending, then createdAt
    rawItems.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    // 4. Calculate running balances
    let runningBalance = calculatedOpeningBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries: LedgerEntry[] = rawItems.map((item) => {
      runningBalance = runningBalance + item.debit - item.credit;
      totalDebit += item.debit;
      totalCredit += item.credit;

      return {
        id: item.id,
        date: item.date,
        particulars: item.particulars,
        referenceNo: item.referenceNo,
        transactionType: item.type,
        paymentMethod: item.paymentMethod,
        chequeStatus: item.chequeStatus,
        debit: item.debit,
        credit: item.credit,
        runningBalance,
        remarks: item.remarks,
        allocationDetails: item.allocationDetails,
      };
    });

    return {
      retailer,
      openingBalance: calculatedOpeningBalance,
      entries,
      closingBalance: runningBalance,
      totalDebit,
      totalCredit,
    };
  },
};
