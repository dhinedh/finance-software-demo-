import { db } from '../db/database';
import { format, parseISO, addDays, differenceInCalendarDays, isValid } from 'date-fns';
import { getTodayDateString, getDefaultCollectionDate } from '../utils/date';
import type {
  ScheduledCollectionItem,
  CollectionScheduleSummary,
  BeatScheduleBreakdown,
  SchedulePeriodType,
  ScheduleStatusType,
  Sale,
  Retailer,
  Beat,
  Collection,
  CollectionAllocation,
} from '../types';

export const collectionScheduleService = {
  /**
   * Retrieves collection schedule items, comprehensive forecast summaries, and beat breakdowns.
   */
  async getSchedule(params: {
    period?: SchedulePeriodType;
    beatId?: number | 'all';
    customFrom?: string;
    customTo?: string;
    search?: string;
  } = {}): Promise<{
    items: ScheduledCollectionItem[];
    summary: CollectionScheduleSummary;
    beatBreakdown: BeatScheduleBreakdown[];
  }> {
    const todayStr = getTodayDateString();
    const todayDate = parseISO(todayStr);
    const tomorrowStr = format(addDays(todayDate, 1), 'yyyy-MM-dd');
    const in7DaysStr = format(addDays(todayDate, 7), 'yyyy-MM-dd');

    // 1. Fetch sales, retailers, beats, allocations, collections in parallel
    const [sales, retailers, beats, allocations, collections] = await Promise.all([
      db.sales.filter((s) => !s.isVoided).toArray(),
      db.retailers.toArray(),
      db.beats.toArray(),
      db.collectionAllocations.toArray(),
      db.collections.filter((c) => !c.isVoided).toArray(),
    ]);

    const retailerMap = new Map<number, Retailer>();
    retailers.forEach((r) => retailerMap.set(r.id!, r));

    const beatMap = new Map<number, Beat>();
    beats.forEach((b) => beatMap.set(b.id!, b));

    // Map confirmed collection IDs
    // Financial rule: Non-cheques and CLEARED cheques are confirmed
    const confirmedCollectionIds = new Set<number>();
    collections.forEach((c) => {
      if (c.paymentMethod !== 'CHEQUE' || c.chequeStatus === 'CLEARED') {
        confirmedCollectionIds.add(c.id!);
      }
    });

    // Map confirmed allocations per saleId
    const paidPerSale = new Map<number, number>();
    allocations.forEach((a) => {
      if (confirmedCollectionIds.has(a.collectionId)) {
        paidPerSale.set(a.saleId, (paidPerSale.get(a.saleId) || 0) + a.allocatedAmount);
      }
    });

    // 2. Identify all pending bills and categorize
    const allPendingItems: ScheduledCollectionItem[] = [];

    const summary: CollectionScheduleSummary = {
      dueTodayAmount: 0,
      dueTodayCount: 0,
      dueTomorrowAmount: 0,
      dueTomorrowCount: 0,
      upcomingAmount: 0,
      upcomingCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
      totalPendingAmount: 0,
      totalPendingCount: 0,
    };

    for (const sale of sales) {
      const previouslyCollected = paidPerSale.get(sale.id!) || 0;
      const remainingAmount = Math.max(0, sale.billAmount - previouslyCollected);

      if (remainingAmount <= 0) {
        continue; // Fully settled bill
      }

      const colDateStr = sale.collectionDate || getDefaultCollectionDate(sale.date);
      const colDateParsed = parseISO(colDateStr);
      const diffDays = isValid(colDateParsed)
        ? differenceInCalendarDays(colDateParsed, todayDate)
        : 0;

      let status: ScheduleStatusType = 'UPCOMING';
      if (diffDays < 0) {
        status = 'OVERDUE';
        summary.overdueAmount += remainingAmount;
        summary.overdueCount += 1;
      } else if (diffDays === 0) {
        status = 'DUE_TODAY';
        summary.dueTodayAmount += remainingAmount;
        summary.dueTodayCount += 1;
      } else if (diffDays === 1) {
        status = 'DUE_TOMORROW';
        summary.dueTomorrowAmount += remainingAmount;
        summary.dueTomorrowCount += 1;
      } else {
        status = 'UPCOMING';
        summary.upcomingAmount += remainingAmount;
        summary.upcomingCount += 1;
      }

      summary.totalPendingAmount += remainingAmount;
      summary.totalPendingCount += 1;

      const ret = retailerMap.get(sale.retailerId);
      const beat = ret ? beatMap.get(ret.beatId) : beatMap.get(sale.beatIdAtTransaction);

      allPendingItems.push({
        saleId: sale.id!,
        billNumber: sale.billNumber,
        salesDate: sale.date,
        collectionDate: colDateStr,
        retailerId: sale.retailerId,
        retailerName: ret ? ret.retailerName : `Retailer #${sale.retailerId}`,
        retailerPhone: ret ? ret.contactNumber : '',
        beatId: beat ? beat.id! : sale.beatIdAtTransaction,
        beatName: beat ? beat.name : 'Unknown Beat',
        originalAmount: sale.billAmount,
        previouslyCollected,
        remainingAmount,
        status,
        daysDifference: diffDays,
      });
    }

    // 3. Filter items based on user criteria
    const period = params.period || 'today';
    const beatFilter = params.beatId;
    const query = (params.search || '').trim().toLowerCase();

    let filtered = allPendingItems.filter((item) => {
      // Period filter
      if (period === 'today') {
        if (item.status !== 'DUE_TODAY') return false;
      } else if (period === 'tomorrow') {
        if (item.status !== 'DUE_TOMORROW') return false;
      } else if (period === 'upcoming_7') {
        if (item.collectionDate < todayStr || item.collectionDate > in7DaysStr) return false;
      } else if (period === 'overdue') {
        if (item.status !== 'OVERDUE') return false;
      } else if (period === 'custom') {
        if (params.customFrom && item.collectionDate < params.customFrom) return false;
        if (params.customTo && item.collectionDate > params.customTo) return false;
      }
      // 'all' includes all pending items

      // Beat filter
      if (beatFilter && beatFilter !== 'all' && item.beatId !== beatFilter) {
        return false;
      }

      // Search query
      if (query) {
        const matchName = item.retailerName.toLowerCase().includes(query);
        const matchBill = item.billNumber.toLowerCase().includes(query);
        const matchPhone = item.retailerPhone.toLowerCase().includes(query);
        const matchBeat = item.beatName.toLowerCase().includes(query);
        if (!matchName && !matchBill && !matchPhone && !matchBeat) return false;
      }

      return true;
    });

    // 4. Sort items chronologically (earliest due date first, then by retailer)
    filtered.sort((a, b) => {
      if (a.collectionDate !== b.collectionDate) {
        return a.collectionDate.localeCompare(b.collectionDate);
      }
      return a.retailerName.localeCompare(b.retailerName);
    });

    // 5. Compute Beat breakdown for the filtered results
    const beatTotals = new Map<number, { beatName: string; amount: number; count: number }>();
    filtered.forEach((item) => {
      const existing = beatTotals.get(item.beatId) || {
        beatName: item.beatName,
        amount: 0,
        count: 0,
      };
      existing.amount += item.remainingAmount;
      existing.count += 1;
      beatTotals.set(item.beatId, existing);
    });

    const beatBreakdown: BeatScheduleBreakdown[] = Array.from(beatTotals.entries()).map(
      ([beatId, data]) => ({
        beatId,
        beatName: data.beatName,
        amount: data.amount,
        billCount: data.count,
      })
    );

    beatBreakdown.sort((a, b) => b.amount - a.amount);

    return {
      items: filtered,
      summary,
      beatBreakdown,
    };
  },
};
