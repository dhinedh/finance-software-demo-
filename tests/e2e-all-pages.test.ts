import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database';
import { seedService } from '../src/services/seedService';
import { beatService } from '../src/services/beatService';
import { retailerService } from '../src/services/retailerService';
import { salesService } from '../src/services/salesService';
import { collectionService } from '../src/services/collectionService';
import { outstandingService } from '../src/services/outstandingService';
import { ledgerService } from '../src/services/ledgerService';
import { dayEndService } from '../src/services/dayEndService';
import { reportExportService } from '../src/services/reportService';
import { auditService } from '../src/services/auditService';
import { backupRestoreService } from '../src/services/backupRestoreService';
import { toPaise, toRupees, formatINR } from '../src/utils/money';
import { getTodayDateString, getYesterdayDateString, formatDateDisplay } from '../src/utils/date';
import { subDays, format } from 'date-fns';

describe('End-to-End Verification of Each and Every Page & Feature with Fake Data', () => {
  beforeEach(async () => {
    // Completely clear all tables and re-seed fresh demo data for deterministic testing
    await db.collectionAllocations.clear();
    await db.collections.clear();
    await db.sales.clear();
    await db.retailers.clear();
    await db.beats.clear();
    await db.dailyBalances.clear();
    await db.auditLogs.clear();
    await db.settings.clear();

    await seedService.ensureBaseConfig();
    await seedService.seedDemoData();
  });

  // PAGE 1: DASHBOARD
  it('PAGE 1: Dashboard - Aggregates KPIs, Trends, Beats, Top Debtors, and Mismatch Detection', async () => {
    const today = getTodayDateString();

    // 1. Verify retailer and beat counts
    const retailers = await retailerService.getAll();
    expect(retailers.length).toBe(20);

    const beats = await beatService.getActiveBeats();
    expect(beats.length).toBe(5);

    // 2. Add today's sale and collection to test live dashboard KPIs
    const retailer = retailers[0];
    const saleId = await salesService.create({
      date: today,
      billNumber: 'DASH-SALE-01',
      retailerId: retailer.id!,
      billAmount: 1500000, // ₹15,000.00
      remarks: 'Morning delivery',
    });

    const colId = await collectionService.create({
      date: today,
      retailerId: retailer.id!,
      totalAmount: 1000000, // ₹10,000.00
      paymentMethod: 'GPAY',
      allocations: [{ saleId, amount: 1000000 }],
    });

    // 3. Verify Today's Sales and Collections
    const todaySales = await salesService.getSales({ date: today });
    const totSales = todaySales.reduce((sum, s) => sum + s.billAmount, 0);
    expect(totSales).toBe(1500000);

    const todayCols = await collectionService.getCollections({ date: today });
    const totCols = todayCols.reduce((sum, c) => sum + c.totalAmount, 0);
    expect(totCols).toBe(1000000);

    // 4. Verify Total Outstanding & Top Debtors list
    const outstandingList = await outstandingService.getAllRetailersOutstanding();
    expect(outstandingList.length).toBe(20);
    expect(outstandingList[0].currentOutstanding).toBeGreaterThan(0);

    // 5. Verify Beat-wise Outstanding Chart Data
    const beatSummaries = await outstandingService.getAllBeatsOutstanding();
    expect(beatSummaries.length).toBe(5);
    const totalBeatOutstanding = beatSummaries.reduce((sum, b) => sum + b.totalOutstanding, 0);
    const totalRetailerOutstanding = outstandingList.reduce((sum, r) => sum + r.currentOutstanding, 0);
    expect(totalBeatOutstanding).toBe(totalRetailerOutstanding);

    // 6. Day-end summary formula verification on dashboard
    const daySummary = await dayEndService.calculateDayEndSummary(today);
    expect(daySummary.closingBalance).toBe(
      daySummary.openingBalance + daySummary.totalSales - daySummary.totalConfirmedCollection
    );
  });

  // PAGE 2: BEAT MANAGEMENT
  it('PAGE 2: Beat Management - Add, Edit, Deactivate, View Retailers, and Delete Prevention', async () => {
    // 1. View initial beats
    const initialBeats = await beatService.getAll();
    expect(initialBeats.length).toBe(5);

    // 2. Add new beat
    const newBeatId = await beatService.create({
      name: 'Harbor Commercial Beat',
      description: 'Port and shipping terminal retail shops',
      status: 'ACTIVE',
    });
    expect(newBeatId).toBeDefined();

    // 3. Edit beat
    await beatService.update(newBeatId, {
      description: 'Updated shipping corridor retail shops',
    });
    const updatedBeat = await beatService.getById(newBeatId);
    expect(updatedBeat?.description).toBe('Updated shipping corridor retail shops');

    // 4. Deactivate beat
    await beatService.deactivate(newBeatId);
    const deactivatedBeat = await beatService.getById(newBeatId);
    expect(deactivatedBeat?.status).toBe('INACTIVE');

    // 5. Verify deletion protection (existing beats with retailers cannot be deleted)
    const existingBeatWithRetailers = initialBeats[0];
    const canDeleteResult = await beatService.canDelete(existingBeatWithRetailers.id!);
    expect(canDeleteResult.canDelete).toBe(false);
    expect(canDeleteResult.reason).toContain('retailers are assigned');
  });

  // PAGE 3: RETAILER MANAGEMENT
  it('PAGE 3: Retailer Management - Add, Autocomplete Search, Duplicate Prevention, Balance Correction Audit', async () => {
    const beats = await beatService.getAll();
    const beatId = beats[0].id!;

    // 1. Create a new retailer
    const retId = await retailerService.create({
      retailerName: 'Modern Provisions Superstore',
      beatId,
      address: '99 Main Road',
      contactNumber: '9840998877',
      openingBalance: 500000, // ₹5,000.00
      openingBalanceDate: getTodayDateString(),
      status: 'ACTIVE',
    });
    expect(retId).toBeDefined();

    // 2. Prevent duplicate retailer name
    await expect(
      retailerService.create({
        retailerName: 'Modern Provisions Superstore',
        beatId,
        address: '100 Other Road',
        contactNumber: '9840998800',
        openingBalance: 0,
        openingBalanceDate: getTodayDateString(),
        status: 'ACTIVE',
      })
    ).rejects.toThrow(/already exists/i);

    // 3. Autocomplete search by 2-3 letters
    const searchResults = await retailerService.search('Mod');
    expect(searchResults.some((r) => r.id === retId)).toBe(true);

    // 4. Correct opening balance with mandatory audit trail
    await retailerService.update(
      retId,
      { openingBalance: 750000 },
      'Opening balance voucher reconciled from audited paper records',
      'Owner S. Ramanathan'
    );

    const auditLogs = await auditService.getLogs({ entityType: 'RETAILER', entityId: retId });
    const correctionLog = auditLogs.find((l) => l.action === 'CORRECTION');
    expect(correctionLog).toBeDefined();
    expect(correctionLog?.reason).toContain('Opening balance voucher reconciled');
  });

  // PAGE 4: DAILY SALES ENTRY
  it('PAGE 4: Daily Sales Entry - Auto Serials, Duplicate Warning, Edit & Void with Audit Trail', async () => {
    const retailers = await retailerService.getAll();
    const retailer = retailers[0];
    const today = getTodayDateString();

    // 1. Verify auto-generated serial number format
    const serial = await salesService.getNextSerialNumber(today);
    expect(serial).toMatch(/^S-\d{8}-\d{3}$/);

    // 2. Record sales bill
    const billNumber = 'TEST-INV-5001';
    const saleId = await salesService.create({
      date: today,
      billNumber,
      retailerId: retailer.id!,
      billAmount: 1200000, // ₹12,000.00
      gstAmount: 60000,
      remarks: 'Urgent weekend batch delivery',
    });

    // 3. Duplicate bill detection
    const isDuplicate = await salesService.checkDuplicateBill(billNumber, retailer.id!);
    expect(isDuplicate).toBe(true);

    // 4. Update sales bill with audit reason
    await salesService.update(
      saleId,
      { billAmount: 1150000 },
      'Applied trade discount on damaged packaging',
      'Owner S. Ramanathan'
    );
    const updatedSale = await salesService.getById(saleId);
    expect(updatedSale?.billAmount).toBe(1150000);

    // 5. Void sales bill (safe reversal instead of hard delete)
    await salesService.voidSale(saleId, 'Customer cancelled order after delivery truck return');
    const voidedSale = await salesService.getById(saleId);
    expect(voidedSale?.isVoided).toBe(true);

    const activeSales = await salesService.getAll();
    expect(activeSales.some((s) => s.id === saleId)).toBe(false);
  });

  // PAGE 5: COLLECTION ENTRY & BILL-LEVEL ALLOCATION
  it('PAGE 5: Collection Entry - Display Unpaid Bills, Multi-bill Allocation, Payment Methods, Cheque Transitions', async () => {
    const beats = await beatService.getAll();
    const beatId = beats[0].id!;

    // Create a fresh retailer specifically for this test
    const testRetailerId = await retailerService.create({
      retailerName: 'Fresh Test Retailer',
      beatId,
      address: '77 Test Lane',
      contactNumber: '9999911111',
      openingBalance: 0,
      openingBalanceDate: getTodayDateString(),
      status: 'ACTIVE',
    });

    const today = getTodayDateString();

    // Create 2 test bills
    const bill1Id = await salesService.create({
      date: today,
      billNumber: 'BILL-ALPHA-01',
      retailerId: testRetailerId,
      billAmount: 800000, // ₹8,000.00
    });

    const bill2Id = await salesService.create({
      date: today,
      billNumber: 'BILL-ALPHA-02',
      retailerId: testRetailerId,
      billAmount: 600000, // ₹6,000.00
    });

    // 1. Fetch unpaid bills for retailer
    const unpaidBills = await collectionService.getUnpaidBillsForRetailer(testRetailerId);
    expect(unpaidBills.some((b) => b.sale.id === bill1Id)).toBe(true);
    expect(unpaidBills.some((b) => b.sale.id === bill2Id)).toBe(true);

    // 2. Allocate payment across both bills: ₹8,000 fully to Bill 1, ₹3,000 partially to Bill 2
    const colId = await collectionService.create({
      date: today,
      retailerId: testRetailerId,
      totalAmount: 1100000, // ₹11,000.00
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: 'NEFT9922001',
      allocations: [
        { saleId: bill1Id, amount: 800000 },
        { saleId: bill2Id, amount: 300000 },
      ],
    });
    expect(colId).toBeDefined();

    // Verify bill statuses
    const updatedUnpaid = await collectionService.getUnpaidBillsForRetailer(testRetailerId);
    const b1 = updatedUnpaid.find((b) => b.sale.id === bill1Id);
    const b2 = updatedUnpaid.find((b) => b.sale.id === bill2Id);

    expect(b1?.status).toBe('SETTLED');
    expect(b1?.remainingAmount).toBe(0);

    expect(b2?.status).toBe('PARTIALLY_PAID');
    expect(b2?.remainingAmount).toBe(300000); // ₹3,000.00 remaining

    // 3. Test Cheque transitions: RECEIVED -> CLEARED -> BOUNCED
    const chequeColId = await collectionService.create({
      date: today,
      retailerId: testRetailerId,
      totalAmount: 300000,
      paymentMethod: 'CHEQUE',
      chequeStatus: 'RECEIVED',
      chequeNumber: 'CHQ-881122',
      bankName: 'HDFC Bank',
      allocations: [{ saleId: bill2Id, amount: 300000 }],
    });

    // When RECEIVED, cheque does not reduce confirmed outstanding
    let out = await outstandingService.getRetailerOutstanding(testRetailerId);
    expect(out.pendingChequeAmount).toBe(300000);
    expect(out.totalConfirmedCollections).toBe(1100000);

    // Clear cheque
    await collectionService.updateChequeStatus(chequeColId, 'CLEARED', 'Cleared in bank statement');
    out = await outstandingService.getRetailerOutstanding(testRetailerId);
    expect(out.pendingChequeAmount).toBe(0);
    expect(out.totalConfirmedCollections).toBe(1400000);

    // Cheque subsequently bounces
    await collectionService.updateChequeStatus(chequeColId, 'BOUNCED', 'Insufficient funds');
    out = await outstandingService.getRetailerOutstanding(testRetailerId);
    expect(out.pendingChequeAmount).toBe(0);
    expect(out.totalConfirmedCollections).toBe(1100000); // only bank transfer remains confirmed
  });

  // PAGE 6: RETAILER LEDGER
  it('PAGE 6: Retailer Ledger - Chronological Debit, Credit, Running Balance, and Exports', async () => {
    const retailers = await retailerService.getAll();
    const retailer = retailers[0];

    const fromDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const toDate = getTodayDateString();

    const ledger = await ledgerService.getRetailerLedger(retailer.id!, fromDate, toDate);

    expect(ledger.retailer.id).toBe(retailer.id);
    expect(ledger.entries.length).toBeGreaterThan(0);

    // Check mathematical running balance invariant on every row
    let running = ledger.openingBalance;
    for (const entry of ledger.entries) {
      running = running + entry.debit - entry.credit;
      expect(entry.runningBalance).toBe(running);
    }
    expect(ledger.closingBalance).toBe(running);
  });

  // PAGE 7: OUTSTANDING ENGINE & AGING ANALYSIS
  it('PAGE 7: Outstanding Management - Consolidated Balances, Beat Aggregations, 0-60+ Days Aging', async () => {
    const overall = await outstandingService.getOverallOutstanding();
    expect(overall.totalOpening).toBeGreaterThan(0);
    expect(overall.totalSales).toBeGreaterThan(0);
    expect(overall.totalClosingOutstanding).toBe(
      overall.totalOpening + overall.totalSales - overall.totalConfirmedCollections
    );

    // Beat aggregations
    const beatSummaries = await outstandingService.getAllBeatsOutstanding();
    const sumBeatOut = beatSummaries.reduce((sum, b) => sum + b.totalOutstanding, 0);
    expect(sumBeatOut).toBe(overall.totalClosingOutstanding);

    // Aging buckets: 0-7, 8-15, 16-30, 31-60, >60 days
    const aging = await outstandingService.getOutstandingAgeing();
    expect(aging.length).toBeGreaterThan(0);
    for (const a of aging) {
      const bucketSum = a.days0To7 + a.days8To15 + a.days16To30 + a.days31To60 + a.daysAbove60;
      expect(bucketSum).toBe(a.currentOutstanding);
    }
  });

  // PAGE 8: DAY-END BALANCE VERIFICATION
  it('PAGE 8: Day-End Verification - Daily Invariants, Continuity, Verification Locking', async () => {
    const today = getTodayDateString();
    const summary = await dayEndService.calculateDayEndSummary(today);

    // Formula check
    expect(summary.closingBalance).toBe(
      summary.openingBalance + summary.totalSales - summary.totalConfirmedCollection
    );

    // Verify and lock day-end
    const recordId = await dayEndService.verifyDayEnd(today, 'S. Ramanathan (Owner)', 'Cash drawer counted and balanced');
    expect(recordId).toBeDefined();

    const storedRecord = await db.dailyBalances.get(recordId);
    expect(storedRecord?.verificationStatus).toBe('VERIFIED');
    expect(storedRecord?.notes).toBe('Cash drawer counted and balanced');
  });

  // PAGE 9: FINANCIAL REPORTS & EXPORTS
  it('PAGE 9: Reports - Filtered Queries and Export Generation (Excel & PDF)', async () => {
    const fromDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const toDate = getTodayDateString();

    const salesReport = await salesService.getSales({
      fromDate,
      toDate,
    });
    expect(salesReport.length).toBeGreaterThan(0);

    const collectionsReport = await collectionService.getCollections({
      fromDate,
      toDate,
    });
    expect(collectionsReport.length).toBeGreaterThan(0);

    // Test Excel export generation
    expect(() => {
      reportExportService.exportToExcel('Test_Report', 'Sheet1', [
        { 'Bill No': 'INV-101', Amount: 5000 },
      ]);
    }).not.toThrow();

    // Test PDF export generation
    expect(() => {
      reportExportService.exportToPdf({
        title: 'Daily Sales Report Test',
        fileName: 'Test_Sales_Report',
        columns: ['Bill No', 'Amount'],
        rows: [['INV-101', '5000.00']],
      });
    }).not.toThrow();
  });

  // PAGE 10: AUDIT TRAIL
  it('PAGE 10: Audit Trail - Entity Tracking, Diffs and Modification Reasons', async () => {
    const allLogs = await auditService.getLogs({});
    expect(allLogs.length).toBeGreaterThan(0);

    const firstLog = allLogs[0];
    expect(firstLog.timestamp).toBeDefined();
    expect(firstLog.operator).toBeDefined();
    expect(firstLog.reason).toBeDefined();
  });

  // PAGE 11: DATA BACKUP & RESTORE
  it('PAGE 11: Backup & Recovery - JSON Backup, Validation, Relational Restoration', async () => {
    // 1. Generate backup
    const backup = await backupRestoreService.generateBackupJson();
    expect(backup.tableCounts.retailers).toBe(20);
    expect(backup.tableCounts.beats).toBe(5);
    expect(backup.tableCounts.sales).toBeGreaterThan(0);

    // 2. Validate payload
    const validation = backupRestoreService.validateBackupPayload(backup);
    expect(validation.valid).toBe(true);

    // 3. Clear database and restore
    await db.sales.clear();
    await db.retailers.clear();
    expect(await db.sales.count()).toBe(0);
    expect(await db.retailers.count()).toBe(0);

    const restoreResult = await backupRestoreService.restoreFromJson(backup);
    expect(restoreResult.success).toBe(true);
    expect(await db.retailers.count()).toBe(20);
    expect(await db.sales.count()).toBe(backup.tableCounts.sales);
  });

  // PAGE 12: SETTINGS & PRODUCTION RESET
  it('PAGE 12: Settings - Configuration Persistence and Production Data Purge', async () => {
    const existing = await db.settings.toCollection().first();
    expect(existing).toBeDefined();

    // Update settings
    await db.settings.update(existing!.id!, {
      businessName: 'Sri Balaji Distribution Agency (Updated)',
      backupReminderDays: 14,
    });
    const updated = await db.settings.get(existing!.id!);
    expect(updated?.businessName).toBe('Sri Balaji Distribution Agency (Updated)');
    expect(updated?.backupReminderDays).toBe(14);

    // Test Purge Demo Data (resets to 0 retailers/transactions for production)
    await seedService.purgeDemoData();
    expect(await db.retailers.count()).toBe(0);
    expect(await db.sales.count()).toBe(0);
    expect(await db.collections.count()).toBe(0);
    expect(await db.beats.count()).toBe(5); // beats are preserved!
  });
});
