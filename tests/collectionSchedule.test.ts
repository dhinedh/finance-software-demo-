import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database';
import { collectionScheduleService } from '../src/services/collectionScheduleService';
import { salesService } from '../src/services/salesService';
import { collectionService } from '../src/services/collectionService';
import { retailerService } from '../src/services/retailerService';
import { beatService } from '../src/services/beatService';
import { getTodayDateString } from '../src/utils/date';
import { format, addDays, subDays, parseISO } from 'date-fns';

describe('Collection Schedule Service & Forecasting Tests', () => {
  let beatId: number;
  let retailerId: number;

  beforeEach(async () => {
    await db.collectionAllocations.clear();
    await db.collections.clear();
    await db.sales.clear();
    await db.retailers.clear();
    await db.beats.clear();
    await db.dailyBalances.clear();
    await db.auditLogs.clear();

    beatId = await beatService.create({
      name: 'Bazaar Beat',
      description: 'Main commercial beat',
      status: 'ACTIVE',
    });

    retailerId = await retailerService.create({
      retailerName: 'Sri Murugan Stores',
      beatId,
      address: '12 Bazaar St',
      contactNumber: '9840112345',
      openingBalance: 0,
      openingBalanceDate: getTodayDateString(),
      status: 'ACTIVE',
    });
  });

  it('correctly categorizes Due Today, Due Tomorrow, Upcoming and Overdue bills', async () => {
    const todayStr = getTodayDateString();
    const todayDate = parseISO(todayStr);
    const tomorrowStr = format(addDays(todayDate, 1), 'yyyy-MM-dd');
    const in5DaysStr = format(addDays(todayDate, 5), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(todayDate, 1), 'yyyy-MM-dd');

    // 1. Bill due TODAY
    await salesService.create({
      date: format(subDays(todayDate, 7), 'yyyy-MM-dd'),
      collectionDate: todayStr,
      billNumber: 'BILL-TODAY',
      retailerId,
      billAmount: 1000000, // ₹10,000
    });

    // 2. Bill due TOMORROW
    await salesService.create({
      date: format(subDays(todayDate, 6), 'yyyy-MM-dd'),
      collectionDate: tomorrowStr,
      billNumber: 'BILL-TOMORROW',
      retailerId,
      billAmount: 1500000, // ₹15,000
    });

    // 3. Bill UPCOMING in 5 days
    await salesService.create({
      date: todayStr,
      collectionDate: in5DaysStr,
      billNumber: 'BILL-UPCOMING',
      retailerId,
      billAmount: 2000000, // ₹20,000
    });

    // 4. Bill OVERDUE from yesterday
    await salesService.create({
      date: format(subDays(todayDate, 8), 'yyyy-MM-dd'),
      collectionDate: yesterdayStr,
      billNumber: 'BILL-OVERDUE',
      retailerId,
      billAmount: 500000, // ₹5,000
    });

    // Fetch full schedule summary
    const schedule = await collectionScheduleService.getSchedule({ period: 'all' });

    expect(schedule.summary.dueTodayAmount).toBe(1000000);
    expect(schedule.summary.dueTodayCount).toBe(1);

    expect(schedule.summary.dueTomorrowAmount).toBe(1500000);
    expect(schedule.summary.dueTomorrowCount).toBe(1);

    expect(schedule.summary.upcomingAmount).toBe(2000000);
    expect(schedule.summary.upcomingCount).toBe(1);

    expect(schedule.summary.overdueAmount).toBe(500000);
    expect(schedule.summary.overdueCount).toBe(1);

    expect(schedule.summary.totalPendingAmount).toBe(5000000); // ₹50,000
    expect(schedule.summary.totalPendingCount).toBe(4);
  });

  it('filters schedule items by period (today, tomorrow, overdue)', async () => {
    const todayStr = getTodayDateString();
    const todayDate = parseISO(todayStr);
    const tomorrowStr = format(addDays(todayDate, 1), 'yyyy-MM-dd');

    await salesService.create({
      date: todayStr,
      collectionDate: todayStr,
      billNumber: 'B-TODAY',
      retailerId,
      billAmount: 100000,
    });

    await salesService.create({
      date: todayStr,
      collectionDate: tomorrowStr,
      billNumber: 'B-TOMORROW',
      retailerId,
      billAmount: 200000,
    });

    const todayItems = await collectionScheduleService.getSchedule({ period: 'today' });
    expect(todayItems.items.length).toBe(1);
    expect(todayItems.items[0].billNumber).toBe('B-TODAY');

    const tomorrowItems = await collectionScheduleService.getSchedule({ period: 'tomorrow' });
    expect(tomorrowItems.items.length).toBe(1);
    expect(tomorrowItems.items[0].billNumber).toBe('B-TOMORROW');
  });

  it('settling a bill reduces scheduled remaining amount and drops settled bills', async () => {
    const todayStr = getTodayDateString();

    const saleId = await salesService.create({
      date: todayStr,
      collectionDate: todayStr,
      billNumber: 'B-SETTLE',
      retailerId,
      billAmount: 1000000, // ₹10,000
    });

    // 1. Initially ₹10,000 due
    let res = await collectionScheduleService.getSchedule({ period: 'today' });
    expect(res.items.length).toBe(1);
    expect(res.items[0].remainingAmount).toBe(1000000);

    // 2. Partial collection of ₹4,000
    await collectionService.create({
      date: todayStr,
      retailerId,
      totalAmount: 400000,
      paymentMethod: 'CASH',
      allocations: [{ saleId, amount: 400000 }],
    });

    res = await collectionScheduleService.getSchedule({ period: 'today' });
    expect(res.items.length).toBe(1);
    expect(res.items[0].remainingAmount).toBe(600000); // ₹6,000 left
    expect(res.summary.dueTodayAmount).toBe(600000);

    // 3. Settle remaining ₹6,000
    await collectionService.create({
      date: todayStr,
      retailerId,
      totalAmount: 600000,
      paymentMethod: 'GPAY',
      allocations: [{ saleId, amount: 600000 }],
    });

    res = await collectionScheduleService.getSchedule({ period: 'today' });
    expect(res.items.length).toBe(0); // Bill is fully settled!
    expect(res.summary.dueTodayAmount).toBe(0);
  });
});
