import { db } from '../db/database';
import { subDays, addDays, format } from 'date-fns';
import { auditService } from './auditService';

export const INITIAL_BEATS = [
  { name: 'Bazaar Beat', description: 'Central town market & main bazaar commercial area', status: 'ACTIVE' as const },
  { name: 'Gandhi Road Beat', description: 'Gandhi Road and adjoining retail corridors', status: 'ACTIVE' as const },
  { name: 'Keelapalam', description: 'Keelapalam regional retail zone', status: 'ACTIVE' as const },
  { name: 'Bus Stand', description: 'Bus terminal complex and transport hub shops', status: 'ACTIVE' as const },
  { name: 'Other Beat', description: 'Outlying suburban and peripheral retail points', status: 'ACTIVE' as const },
];

export const DEMO_RETAILERS = [
  { name: 'Sri Murugan Stores', beatIndex: 0, phone: '9840112345', address: '12 Bazaar St', opening: 4500000 },
  { name: 'Annai Agencies', beatIndex: 0, phone: '9840223456', address: '45 Big Bazaar Rd', opening: 2500000 },
  { name: 'Venkateswara Traders', beatIndex: 0, phone: '9840334567', address: '88 Market St', opening: 6000000 },
  { name: 'Raja Supermarket', beatIndex: 0, phone: '9840445678', address: '102 Bazaar Main Rd', opening: 1500000 },
  { name: 'Lakshmi Provision Store', beatIndex: 1, phone: '9841112233', address: '22 Gandhi Road', opening: 3500000 },
  { name: 'Kavitha Departmental', beatIndex: 1, phone: '9841223344', address: '56 Gandhi Road', opening: 4000000 },
  { name: 'Saravana Enterprises', beatIndex: 1, phone: '9841334455', address: '110 Gandhi Rd Extn', opening: 8000000 },
  { name: 'Selvam Maligai', beatIndex: 1, phone: '9841445566', address: '14 Gandhi Cross Rd', opening: 2000000 },
  { name: 'Subam Stores', beatIndex: 2, phone: '9842111222', address: '5 Keelapalam Main', opening: 5500000 },
  { name: 'Balaji Provisions', beatIndex: 2, phone: '9842222333', address: '34 Keelapalam Junction', opening: 3000000 },
  { name: 'Vijay Agencies', beatIndex: 2, phone: '9842333444', address: '78 Keelapalam South', opening: 7000000 },
  { name: 'Ganesh General Store', beatIndex: 2, phone: '9842444555', address: '90 Keelapalam High Rd', opening: 1800000 },
  { name: 'City Super Stores', beatIndex: 3, phone: '9843110011', address: '1 Bus Stand Complex', opening: 9000000 },
  { name: 'Kumaran Retailers', beatIndex: 3, phone: '9843220022', address: '14 Bus Stand Circle', opening: 2200000 },
  { name: 'Pravin Departmental', beatIndex: 3, phone: '9843330033', address: '28 Station Rd', opening: 4800000 },
  { name: 'Thangam Maligai', beatIndex: 3, phone: '9843440044', address: '42 Depot Rd', opening: 3200000 },
  { name: 'Devi Enterprises', beatIndex: 4, phone: '9844119988', address: '7 Bypass Highway', opening: 5000000 },
  { name: 'Classic Traders', beatIndex: 4, phone: '9844229988', address: '19 Outer Ring Rd', opening: 1200000 },
  { name: 'Maruthi Stores', beatIndex: 4, phone: '9844339988', address: '85 Industrial Colony', opening: 3800000 },
  { name: 'Star Provision Store', beatIndex: 4, phone: '9844449988', address: '62 Lake View Rd', opening: 6500000 },
];

export const seedService = {
  /**
   * Initializes basic settings and default beats if empty, deduplicating beats.
   */
  async ensureBaseConfig(): Promise<void> {
    const existingBeats = await db.beats.toArray();
    const seenNames = new Set<string>();
    const duplicateIds: number[] = [];

    for (const b of existingBeats) {
      const cleanName = b.name.trim().toLowerCase();
      if (seenNames.has(cleanName)) {
        duplicateIds.push(b.id!);
      } else {
        seenNames.add(cleanName);
      }
    }

    // Delete any duplicate beats created during concurrency
    if (duplicateIds.length > 0) {
      await db.beats.bulkDelete(duplicateIds);
    }

    // Insert only if not already present
    const now = new Date().toISOString();
    for (const b of INITIAL_BEATS) {
      if (!seenNames.has(b.name.trim().toLowerCase())) {
        await db.beats.add({
          name: b.name,
          description: b.description,
          status: b.status,
          createdAt: now,
          updatedAt: now,
        });
        seenNames.add(b.name.trim().toLowerCase());
      }
    }

    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.add({
        businessName: 'Sri Balaji Distribution Agency',
        operatorName: 'S. Ramanathan (Owner)',
        financialYearStart: '2024-04-01',
        backupReminderDays: 7,
        theme: 'light',
      });
    }
  },

  /**
   * Seeds demo data (20 retailers, sales across historical dates, collections with partial/full allocations).
   */
  async seedDemoData(): Promise<{ retailers: number; sales: number; collections: number }> {
    await this.ensureBaseConfig();

    // Check if demo retailers already exist to prevent duplicate seeding
    const existingRetailers = await db.retailers.count();
    if (existingRetailers > 0) {
      // Clear before re-seeding clean demo data
      await this.purgeDemoData();
      await this.ensureBaseConfig();
    }

    const beats = await db.beats.filter((b) => b.status === 'ACTIVE').toArray();
    const now = new Date();
    const pastDateStr = format(subDays(now, 30), 'yyyy-MM-dd');

    const createdRetailerIds: number[] = [];

    // 1. Add 20 retailers
    for (const r of DEMO_RETAILERS) {
      const beat = beats[r.beatIndex % beats.length];
      const retailerId = await db.retailers.add({
        retailerName: r.name,
        beatId: beat.id!,
        address: r.address,
        contactNumber: r.phone,
        openingBalance: r.opening,
        openingBalanceDate: pastDateStr,
        status: 'ACTIVE',
        remarks: 'Sample demo retailer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      createdRetailerIds.push(retailerId);
    }

    // 2. Add realistic sales bills for each retailer over past 20 days
    let salesCount = 0;
    let collectionsCount = 0;
    let billIndex = 1001;

    for (let i = 0; i < createdRetailerIds.length; i++) {
      const retailerId = createdRetailerIds[i];
      const retailer = await db.retailers.get(retailerId);
      if (!retailer) continue;

      // Create 2-3 bills per retailer
      const billsCount = 2 + (i % 2);
      const retailerSaleIds: { id: number; amount: number; billNo: string; date: string }[] = [];

      for (let b = 0; b < billsCount; b++) {
        const daysAgo = 18 - b * 5;
        const billDateObj = subDays(now, Math.max(1, daysAgo));
        const billDate = format(billDateObj, 'yyyy-MM-dd');
        const collectionDate = format(addDays(billDateObj, 7), 'yyyy-MM-dd');
        const billNumber = `INV-${billIndex++}`;
        const billAmount = (8000 + (i * 1500) + (b * 4000)) * 100; // in paise
        const gstAmount = Math.round(billAmount * 0.05);

        const saleId = await db.sales.add({
          serialNumber: `S-${billDate.replace(/-/g, '')}-${(b + 1).toString().padStart(3, '0')}`,
          date: billDate,
          collectionDate,
          billNumber,
          retailerId,
          beatIdAtTransaction: retailer.beatId,
          billAmount,
          gstAmount,
          remarks: 'Daily supply delivery',
          isVoided: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        salesCount++;
        retailerSaleIds.push({ id: saleId, amount: billAmount, billNo: billNumber, date: billDate });
      }

      // Add realistic collections (some full, some partial, some cash, gpay, cheque)
      if (retailerSaleIds.length > 0) {
        // Collection 1: Pay bill 0 fully
        const firstBill = retailerSaleIds[0];
        const colDate1 = format(subDays(now, 7), 'yyyy-MM-dd');
        const method1 = (i % 3 === 0) ? 'GPAY' : (i % 3 === 1) ? 'CASH' : 'BANK_TRANSFER';

        const col1Id = await db.collections.add({
          collectionNumber: `C-${colDate1.replace(/-/g, '')}-${(i + 1).toString().padStart(3, '0')}`,
          date: colDate1,
          retailerId,
          totalAmount: firstBill.amount,
          paymentMethod: method1,
          remarks: `Payment for bill ${firstBill.billNo}`,
          isVoided: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        collectionsCount++;

        await db.collectionAllocations.add({
          collectionId: col1Id,
          saleId: firstBill.id,
          allocatedAmount: firstBill.amount,
          createdAt: new Date().toISOString(),
        });

        // Collection 2: Partial collection on second bill
        if (retailerSaleIds.length > 1 && i % 2 === 0) {
          const secondBill = retailerSaleIds[1];
          const colDate2 = format(subDays(now, 2), 'yyyy-MM-dd');
          const partialAmount = Math.round(secondBill.amount * 0.6); // 60% partial payment

          const isCheque = i % 4 === 0;
          const col2Id = await db.collections.add({
            collectionNumber: `C-${colDate2.replace(/-/g, '')}-${(i + 50).toString().padStart(3, '0')}`,
            date: colDate2,
            retailerId,
            totalAmount: partialAmount,
            paymentMethod: isCheque ? 'CHEQUE' : 'CASH',
            chequeStatus: isCheque ? 'CLEARED' : undefined,
            chequeNumber: isCheque ? `CHQ${400000 + i}` : undefined,
            bankName: isCheque ? 'State Bank of India' : undefined,
            remarks: `Partial collection against bill ${secondBill.billNo}`,
            isVoided: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          collectionsCount++;

          await db.collectionAllocations.add({
            collectionId: col2Id,
            saleId: secondBill.id,
            allocatedAmount: partialAmount,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    await auditService.log({
      entityType: 'SETTINGS',
      entityId: 0,
      action: 'CREATE',
      reason: `Seeded demo dataset: ${createdRetailerIds.length} retailers, ${salesCount} sales, ${collectionsCount} collections`,
      operator: 'System Seeder',
    });

    return { retailers: createdRetailerIds.length, sales: salesCount, collections: collectionsCount };
  },

  /**
   * Completely purges all demo transactions and retailers before production use.
   * Keeps beats and settings intact.
   */
  async purgeDemoData(): Promise<void> {
    await db.transaction(
      'rw',
      [db.retailers, db.sales, db.collections, db.collectionAllocations, db.dailyBalances, db.auditLogs],
      async () => {
        await db.collectionAllocations.clear();
        await db.collections.clear();
        await db.sales.clear();
        await db.retailers.clear();
        await db.dailyBalances.clear();
      }
    );

    await auditService.log({
      entityType: 'SETTINGS',
      entityId: 0,
      action: 'VOID',
      reason: 'All demo and transactional data purged for production start',
      operator: 'Admin',
    });
  },
};
