import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database';
import { salesService } from '../src/services/salesService';
import { collectionService } from '../src/services/collectionService';
import { outstandingService } from '../src/services/outstandingService';
import { ledgerService } from '../src/services/ledgerService';
import { dayEndService } from '../src/services/dayEndService';
import { backupRestoreService } from '../src/services/backupRestoreService';
import { auditService } from '../src/services/auditService';
import { beatService } from '../src/services/beatService';
import { retailerService } from '../src/services/retailerService';

describe('Retail Sales, Collection & Outstanding Management - 17 Mandatory Tests', () => {
  let beatId: number;
  let retailerId: number;

  beforeEach(async () => {
    // Clear all IndexedDB tables before each test
    await db.collectionAllocations.clear();
    await db.collections.clear();
    await db.sales.clear();
    await db.retailers.clear();
    await db.beats.clear();
    await db.dailyBalances.clear();
    await db.auditLogs.clear();
    await db.settings.clear();

    beatId = await beatService.create({
      name: 'Bazaar Beat',
      description: 'Main Bazaar',
      status: 'ACTIVE',
    });

    retailerId = await retailerService.create({
      retailerName: 'Sri Murugan Stores',
      beatId,
      address: '10 Bazaar Street',
      contactNumber: '9840112233',
      openingBalance: 100000, // ₹1,000.00
      openingBalanceDate: '2024-11-01',
      status: 'ACTIVE',
    });
  });

  // Test 1: Sales increase outstanding correctly.
  it('1. Sales increase outstanding correctly', async () => {
    const initial = await outstandingService.getRetailerOutstanding(retailerId);
    expect(initial.currentOutstanding).toBe(100000); // ₹1,000.00

    // Add sale of ₹5,000.00 (500000 paise)
    await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1001',
      retailerId,
      billAmount: 500000,
    });

    const updated = await outstandingService.getRetailerOutstanding(retailerId);
    expect(updated.totalSales).toBe(500000);
    expect(updated.currentOutstanding).toBe(600000); // 100000 + 500000 = ₹6,000.00
  });

  // Test 2: Partial collection reduces outstanding correctly.
  it('2. Partial collection reduces outstanding correctly', async () => {
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1001',
      retailerId,
      billAmount: 1000000, // ₹10,000.00
    });

    // Pay ₹4,000.00 partially against BILL-1001
    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 400000,
      paymentMethod: 'CASH',
      allocations: [{ saleId, amount: 400000 }],
    });

    const outstanding = await outstandingService.getRetailerOutstanding(retailerId);
    // Opening 100000 + Sales 1000000 - Confirmed 400000 = 700000 (₹7,000.00)
    expect(outstanding.currentOutstanding).toBe(700000);

    const unpaidBills = await collectionService.getUnpaidBillsForRetailer(retailerId);
    const bill = unpaidBills.find((b) => b.sale.id === saleId);
    expect(bill?.status).toBe('PARTIALLY_PAID');
    expect(bill?.remainingAmount).toBe(600000); // ₹6,000.00 remaining
  });

  // Test 3: Full collection settles a bill.
  it('3. Full collection settles a bill', async () => {
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1001',
      retailerId,
      billAmount: 500000, // ₹5,000.00
    });

    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 500000,
      paymentMethod: 'GPAY',
      allocations: [{ saleId, amount: 500000 }],
    });

    const unpaidBills = await collectionService.getUnpaidBillsForRetailer(retailerId);
    const bill = unpaidBills.find((b) => b.sale.id === saleId);
    expect(bill?.status).toBe('SETTLED');
    expect(bill?.remainingAmount).toBe(0);
  });

  // Test 4: Multiple collections against one bill work correctly.
  it('4. Multiple collections against one bill work correctly', async () => {
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1001',
      retailerId,
      billAmount: 1000000, // ₹10,000.00
    });

    // First collection: ₹3,000.00
    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 300000,
      paymentMethod: 'CASH',
      allocations: [{ saleId, amount: 300000 }],
    });

    // Second collection: ₹5,000.00
    await collectionService.create({
      date: '2024-11-04',
      retailerId,
      totalAmount: 500000,
      paymentMethod: 'GPAY',
      allocations: [{ saleId, amount: 500000 }],
    });

    const unpaidBills = await collectionService.getUnpaidBillsForRetailer(retailerId);
    const bill = unpaidBills.find((b) => b.sale.id === saleId);
    expect(bill?.previouslyCollected).toBe(800000); // ₹8,000.00
    expect(bill?.remainingAmount).toBe(200000); // ₹2,000.00
    expect(bill?.status).toBe('PARTIALLY_PAID');
  });

  // Test 5: One collection allocated to multiple bills works correctly.
  it('5. One collection allocated to multiple bills works correctly', async () => {
    // Bill 1: ₹10,000.00
    const sale1Id = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1001',
      retailerId,
      billAmount: 1000000,
    });

    // Bill 2: ₹8,000.00
    const sale2Id = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1002',
      retailerId,
      billAmount: 800000,
    });

    // Customer pays ₹12,000.00 (Allocated: ₹10,000 to Bill 1, ₹2,000 to Bill 2)
    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 1200000,
      paymentMethod: 'BANK_TRANSFER',
      allocations: [
        { saleId: sale1Id, amount: 1000000 },
        { saleId: sale2Id, amount: 200000 },
      ],
    });

    const unpaidBills = await collectionService.getUnpaidBillsForRetailer(retailerId);
    const bill1 = unpaidBills.find((b) => b.sale.id === sale1Id);
    const bill2 = unpaidBills.find((b) => b.sale.id === sale2Id);

    expect(bill1?.remainingAmount).toBe(0);
    expect(bill1?.status).toBe('SETTLED');

    expect(bill2?.remainingAmount).toBe(600000); // ₹6,000.00 remaining
    expect(bill2?.status).toBe('PARTIALLY_PAID');
  });

  // Test 6: Cash collection totals exclude GPay and cheque.
  it('6. Cash collection totals exclude GPay and cheque', async () => {
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-1001',
      retailerId,
      billAmount: 2000000,
    });

    // Cash: ₹3,000.00
    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 300000,
      paymentMethod: 'CASH',
      allocations: [{ saleId, amount: 300000 }],
    });

    // GPay: ₹4,000.00
    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 400000,
      paymentMethod: 'GPAY',
      allocations: [{ saleId, amount: 400000 }],
    });

    // Cheque (Received): ₹5,000.00
    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 500000,
      paymentMethod: 'CHEQUE',
      chequeStatus: 'RECEIVED',
      allocations: [{ saleId, amount: 500000 }],
    });

    const daySummary = await dayEndService.calculateDayEndSummary('2024-11-03');
    expect(daySummary.cashCollection).toBe(300000); // strictly Cash
    expect(daySummary.gpayCollection).toBe(400000);
    expect(daySummary.clearedChequeCollection).toBe(0);
    expect(daySummary.unclearedChequeCollection).toBe(500000);
  });

  // Test 7: GPay collection is included in confirmed collections.
  it('7. GPay collection is included in confirmed collections', async () => {
    const saleId = await salesService.create({
      date: '2024-11-03',
      billNumber: 'BILL-2001',
      retailerId,
      billAmount: 500000,
    });

    await collectionService.create({
      date: '2024-11-03',
      retailerId,
      totalAmount: 500000,
      paymentMethod: 'GPAY',
      allocations: [{ saleId, amount: 500000 }],
    });

    const daySummary = await dayEndService.calculateDayEndSummary('2024-11-03');
    expect(daySummary.gpayCollection).toBe(500000);
    expect(daySummary.totalConfirmedCollection).toBe(500000);
  });

  // Test 8: Uncleared cheque does not reduce confirmed outstanding.
  it('8. Uncleared cheque does not reduce confirmed outstanding', async () => {
    const saleId = await salesService.create({
      date: '2024-11-04',
      billNumber: 'BILL-3001',
      retailerId,
      billAmount: 1000000,
    });

    // Issue cheque in RECEIVED status
    await collectionService.create({
      date: '2024-11-04',
      retailerId,
      totalAmount: 1000000,
      paymentMethod: 'CHEQUE',
      chequeStatus: 'RECEIVED',
      allocations: [{ saleId, amount: 1000000 }],
    });

    const outstanding = await outstandingService.getRetailerOutstanding(retailerId);
    // Opening 100000 + Sale 1000000 = 1100000. Outstanding MUST NOT be reduced yet!
    expect(outstanding.currentOutstanding).toBe(1100000);
    expect(outstanding.pendingChequeAmount).toBe(1000000);
    expect(outstanding.totalConfirmedCollections).toBe(0);
  });

  // Test 9: Bounced cheque restores outstanding.
  it('9. Bounced cheque restores outstanding', async () => {
    const saleId = await salesService.create({
      date: '2024-11-04',
      billNumber: 'BILL-4001',
      retailerId,
      billAmount: 1000000,
    });

    // Create cheque as CLEARED first
    const colId = await collectionService.create({
      date: '2024-11-04',
      retailerId,
      totalAmount: 1000000,
      paymentMethod: 'CHEQUE',
      chequeStatus: 'CLEARED',
      allocations: [{ saleId, amount: 1000000 }],
    });

    let outstanding = await outstandingService.getRetailerOutstanding(retailerId);
    expect(outstanding.currentOutstanding).toBe(100000); // reduced when cleared

    // Cheque subsequently bounces
    await collectionService.updateChequeStatus(colId, 'BOUNCED', 'Insufficient funds');

    outstanding = await outstandingService.getRetailerOutstanding(retailerId);
    // Bounced cheque is no longer confirmed, restoring full outstanding
    expect(outstanding.currentOutstanding).toBe(1100000);
    expect(outstanding.totalConfirmedCollections).toBe(0);
    expect(outstanding.pendingChequeAmount).toBe(0);
  });

  // Test 10: Previous closing becomes next opening.
  it('10. Previous closing becomes next opening', async () => {
    // 24 November
    await salesService.create({
      date: '2024-11-24',
      billNumber: 'BILL-NOV24',
      retailerId,
      billAmount: 2000000, // ₹20,000.00
    });

    await collectionService.create({
      date: '2024-11-24',
      retailerId,
      totalAmount: 1500000, // ₹15,000.00
      paymentMethod: 'CASH',
      allocations: [],
    });

    const day1Summary = await dayEndService.calculateDayEndSummary('2024-11-24');
    // Opening 100000 + Sales 2000000 - Collections 1500000 = 600000 (₹6,000.00)
    expect(day1Summary.closingBalance).toBe(600000);

    // 25 November opening balance must strictly equal 24 November closing balance
    const day2Summary = await dayEndService.calculateDayEndSummary('2024-11-25');
    expect(day2Summary.openingBalance).toBe(day1Summary.closingBalance);
  });

  // Test 11: Historical transaction correction recalculates affected balances.
  it('11. Historical transaction correction recalculates affected balances', async () => {
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-HIST',
      retailerId,
      billAmount: 1000000, // ₹10,000.00
    });

    let outstanding = await outstandingService.getRetailerOutstanding(retailerId);
    expect(outstanding.currentOutstanding).toBe(1100000);

    // Correct the bill amount to ₹8,000.00 (800000 paise)
    await salesService.update(saleId, { billAmount: 800000 }, 'Typo correction from paper voucher');

    outstanding = await outstandingService.getRetailerOutstanding(retailerId);
    // Corrected outstanding = 100000 + 800000 = 900000
    expect(outstanding.currentOutstanding).toBe(900000);
  });

  // Test 12: Duplicate bill detection works.
  it('12. Duplicate bill detection works', async () => {
    await salesService.create({
      date: '2024-11-02',
      billNumber: 'INV-999',
      retailerId,
      billAmount: 500000,
    });

    const isDuplicate = await salesService.checkDuplicateBill('INV-999', retailerId);
    expect(isDuplicate).toBe(true);

    const isNotDuplicate = await salesService.checkDuplicateBill('INV-999-DIFFERENT', retailerId);
    expect(isNotDuplicate).toBe(false);
  });

  // Test 13: Retailer ledger calculates correctly.
  it('13. Retailer ledger calculates correctly', async () => {
    // Opening balance: 100000
    // 02-11: Sale 500000 -> Running: 600000
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-101',
      retailerId,
      billAmount: 500000,
    });

    // 05-11: Cash collection 200000 -> Running: 400000
    await collectionService.create({
      date: '2024-11-05',
      retailerId,
      totalAmount: 200000,
      paymentMethod: 'CASH',
      allocations: [{ saleId, amount: 200000 }],
    });

    // 08-11: Sale 300000 -> Running: 700000
    await salesService.create({
      date: '2024-11-08',
      billNumber: 'BILL-102',
      retailerId,
      billAmount: 300000,
    });

    const ledger = await ledgerService.getRetailerLedger(retailerId, '2024-11-01', '2024-11-30');
    expect(ledger.openingBalance).toBe(100000);
    expect(ledger.totalDebit).toBe(800000);
    expect(ledger.totalCredit).toBe(200000);
    expect(ledger.closingBalance).toBe(700000);
    expect(ledger.entries.length).toBe(3);
    expect(ledger.entries[0].runningBalance).toBe(600000);
    expect(ledger.entries[1].runningBalance).toBe(400000);
    expect(ledger.entries[2].runningBalance).toBe(700000);
  });

  // Test 14: Beat-wise outstanding matches retailer-wise totals.
  it('14. Beat-wise outstanding matches retailer-wise totals', async () => {
    // Add second retailer to the same beat
    const ret2Id = await retailerService.create({
      retailerName: 'Annai Agencies',
      beatId,
      address: '22 Bazaar Rd',
      contactNumber: '9840223344',
      openingBalance: 200000, // ₹2,000.00
      openingBalanceDate: '2024-11-01',
      status: 'ACTIVE',
    });

    // Sale for retailer 1
    await salesService.create({
      date: '2024-11-02',
      billNumber: 'B1',
      retailerId,
      billAmount: 300000,
    });

    // Sale for retailer 2
    await salesService.create({
      date: '2024-11-02',
      billNumber: 'B2',
      retailerId: ret2Id,
      billAmount: 400000,
    });

    const retailerSummaries = await outstandingService.getAllRetailersOutstanding();
    const sumRetailerOutstanding = retailerSummaries.reduce((sum, r) => sum + r.currentOutstanding, 0);

    const beatSummaries = await outstandingService.getAllBeatsOutstanding();
    const sumBeatOutstanding = beatSummaries.reduce((sum, b) => sum + b.totalOutstanding, 0);

    expect(sumBeatOutstanding).toBe(sumRetailerOutstanding);
    // (100000 + 300000) + (200000 + 400000) = 400000 + 600000 = 1000000 (₹10,000.00)
    expect(sumBeatOutstanding).toBe(1000000);
  });

  // Test 15: Backup and restore preserve all records.
  it('15. Backup and restore preserve all records', async () => {
    await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-BK1',
      retailerId,
      billAmount: 500000,
    });

    const backup = await backupRestoreService.generateBackupJson();
    expect(backup.tableCounts.retailers).toBe(1);
    expect(backup.tableCounts.sales).toBe(1);

    // Clear and restore
    await db.sales.clear();
    await db.retailers.clear();
    expect(await db.sales.count()).toBe(0);

    const restoreResult = await backupRestoreService.restoreFromJson(backup);
    expect(restoreResult.success).toBe(true);
    expect(await db.retailers.count()).toBe(1);
    expect(await db.sales.count()).toBe(1);

    const restoredSale = await db.sales.where('billNumber').equals('BILL-BK1').first();
    expect(restoredSale?.billAmount).toBe(500000);
  });

  // Test 16: Date filtering produces correct reports.
  it('16. Date filtering produces correct reports', async () => {
    await salesService.create({
      date: '2024-11-01',
      billNumber: 'B-NOV01',
      retailerId,
      billAmount: 100000,
    });

    await salesService.create({
      date: '2024-11-05',
      billNumber: 'B-NOV05',
      retailerId,
      billAmount: 200000,
    });

    await salesService.create({
      date: '2024-11-10',
      billNumber: 'B-NOV10',
      retailerId,
      billAmount: 300000,
    });

    const filtered = await salesService.getSales({
      fromDate: '2024-11-02',
      toDate: '2024-11-06',
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].billNumber).toBe('B-NOV05');
  });

  // Test 17: Audit records preserve modifications.
  it('17. Audit records preserve modifications', async () => {
    const saleId = await salesService.create({
      date: '2024-11-02',
      billNumber: 'BILL-AUDIT',
      retailerId,
      billAmount: 500000,
    }, 'Operator Raman');

    await salesService.update(
      saleId,
      { billAmount: 600000 },
      'Voucher corrected for items returned',
      'Operator Raman'
    );

    const logs = await auditService.getLogs({ entityType: 'SALE', entityId: saleId });
    expect(logs.length).toBe(2);

    const updateLog = logs.find((l) => l.action === 'UPDATE');
    expect(updateLog).toBeDefined();
    expect(updateLog?.reason).toBe('Voucher corrected for items returned');
    expect(updateLog?.operator).toBe('Operator Raman');

    const parsedOld = JSON.parse(updateLog!.oldValue!);
    const parsedNew = JSON.parse(updateLog!.newValue!);
    expect(parsedOld.billAmount).toBe(500000);
    expect(parsedNew.billAmount).toBe(600000);
  });
});
