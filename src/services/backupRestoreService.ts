import { db } from '../db/database';
import { auditService } from './auditService';
import * as XLSX from 'xlsx';

export interface BackupPayload {
  version: string;
  exportDate: string;
  environment: string;
  tableCounts: {
    beats: number;
    retailers: number;
    sales: number;
    collections: number;
    collectionAllocations: number;
    dailyBalances: number;
    auditLogs: number;
    settings: number;
  };
  data: {
    beats: any[];
    retailers: any[];
    sales: any[];
    collections: any[];
    collectionAllocations: any[];
    dailyBalances: any[];
    auditLogs: any[];
    settings: any[];
  };
}

export const backupRestoreService = {
  /**
   * Exports complete database as a structured JSON object.
   */
  async generateBackupJson(): Promise<BackupPayload> {
    const beats = await db.beats.toArray();
    const retailers = await db.retailers.toArray();
    const sales = await db.sales.toArray();
    const collections = await db.collections.toArray();
    const collectionAllocations = await db.collectionAllocations.toArray();
    const dailyBalances = await db.dailyBalances.toArray();
    const auditLogs = await db.auditLogs.toArray();
    const settings = await db.settings.toArray();

    const payload: BackupPayload = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      environment: 'RetailFinance-IndexedDB',
      tableCounts: {
        beats: beats.length,
        retailers: retailers.length,
        sales: sales.length,
        collections: collections.length,
        collectionAllocations: collectionAllocations.length,
        dailyBalances: dailyBalances.length,
        auditLogs: auditLogs.length,
        settings: settings.length,
      },
      data: {
        beats,
        retailers,
        sales,
        collections,
        collectionAllocations,
        dailyBalances,
        auditLogs,
        settings,
      },
    };

    // Update settings with lastBackupDate
    const existingSettings = await db.settings.toCollection().first();
    if (existingSettings && existingSettings.id) {
      await db.settings.update(existingSettings.id, { lastBackupDate: payload.exportDate });
    }

    return payload;
  },

  /**
   * Generates a downloadable JSON file in the browser.
   */
  async downloadJsonBackup(): Promise<string> {
    const backup = await this.generateBackupJson();
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateFormatted = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `RetailFinance_Backup_${dateFormatted}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return backup.exportDate;
  },

  /**
   * Generates a comprehensive multi-sheet Excel workbook with all financial data.
   */
  async downloadExcelSummary(): Promise<void> {
    const backup = await this.generateBackupJson();
    const wb = XLSX.utils.book_new();

    // 1. Retailers Sheet
    const retailersSheetData = backup.data.retailers.map((r) => ({
      'Retailer ID': r.id,
      'Retailer Name': r.retailerName,
      'Beat ID': r.beatId,
      'Contact Number': r.contactNumber,
      'Address': r.address,
      'Opening Balance (₹)': (r.openingBalance / 100).toFixed(2),
      'Opening Date': r.openingBalanceDate,
      'Status': r.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(retailersSheetData), 'Retailers');

    // 2. Sales Sheet
    const salesSheetData = backup.data.sales.map((s) => ({
      'Sale ID': s.id,
      'Serial Number': s.serialNumber,
      'Date': s.date,
      'Bill Number': s.billNumber,
      'Retailer ID': s.retailerId,
      'Beat ID': s.beatIdAtTransaction,
      'Bill Amount (₹)': (s.billAmount / 100).toFixed(2),
      'GST Amount (₹)': s.gstAmount ? (s.gstAmount / 100).toFixed(2) : '0.00',
      'Remarks': s.remarks || '',
      'Voided': s.isVoided ? 'YES' : 'NO',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesSheetData), 'Sales');

    // 3. Collections Sheet
    const collectionsSheetData = backup.data.collections.map((c) => ({
      'Collection ID': c.id,
      'Collection Number': c.collectionNumber,
      'Date': c.date,
      'Retailer ID': c.retailerId,
      'Total Amount (₹)': (c.totalAmount / 100).toFixed(2),
      'Payment Method': c.paymentMethod,
      'Cheque Status': c.chequeStatus || '-',
      'Cheque Number': c.chequeNumber || '',
      'Bank Name': c.bankName || '',
      'Remarks': c.remarks || '',
      'Voided': c.isVoided ? 'YES' : 'NO',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collectionsSheetData), 'Collections');

    // 4. Allocations Sheet
    const allocSheetData = backup.data.collectionAllocations.map((a) => ({
      'Allocation ID': a.id,
      'Collection ID': a.collectionId,
      'Sale ID': a.saleId,
      'Allocated Amount (₹)': (a.allocatedAmount / 100).toFixed(2),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allocSheetData), 'Allocations');

    const dateFormatted = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `RetailFinance_CompleteSummary_${dateFormatted}.xlsx`);
  },

  /**
   * Validates structure of a backup file before restoring.
   */
  validateBackupPayload(payload: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['Invalid JSON format: Payload is not an object.'] };
    }
    if (!payload.data || typeof payload.data !== 'object') {
      errors.push('Missing "data" object containing tables.');
    } else {
      const requiredTables = ['beats', 'retailers', 'sales', 'collections', 'collectionAllocations'];
      for (const table of requiredTables) {
        if (!Array.isArray(payload.data[table])) {
          errors.push(`Table "${table}" is missing or is not an array.`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  },

  /**
   * Restores data from a validated backup payload.
   * Creates an emergency pre-restore snapshot first.
   */
  async restoreFromJson(payload: BackupPayload, operator = 'Admin'): Promise<{
    success: boolean;
    restoredCounts: Record<string, number>;
  }> {
    const validation = this.validateBackupPayload(payload);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    // 1. Create safety snapshot in localStorage
    try {
      const currentBackup = await this.generateBackupJson();
      localStorage.setItem('retailFinance_pre_restore_snapshot', JSON.stringify(currentBackup));
    } catch {
      // Continue if localStorage is constrained
    }

    // 2. Perform transactional restoration in correct relational order
    await db.transaction(
      'rw',
      [
        db.beats,
        db.retailers,
        db.sales,
        db.collections,
        db.collectionAllocations,
        db.dailyBalances,
        db.auditLogs,
        db.settings,
      ],
      async () => {
        // Clear existing tables
        await db.collectionAllocations.clear();
        await db.collections.clear();
        await db.sales.clear();
        await db.retailers.clear();
        await db.beats.clear();
        await db.dailyBalances.clear();
        await db.auditLogs.clear();
        await db.settings.clear();

        // Restore tables
        if (payload.data.beats?.length) await db.beats.bulkAdd(payload.data.beats);
        if (payload.data.retailers?.length) await db.retailers.bulkAdd(payload.data.retailers);
        if (payload.data.sales?.length) await db.sales.bulkAdd(payload.data.sales);
        if (payload.data.collections?.length) await db.collections.bulkAdd(payload.data.collections);
        if (payload.data.collectionAllocations?.length) {
          await db.collectionAllocations.bulkAdd(payload.data.collectionAllocations);
        }
        if (payload.data.dailyBalances?.length) await db.dailyBalances.bulkAdd(payload.data.dailyBalances);
        if (payload.data.auditLogs?.length) await db.auditLogs.bulkAdd(payload.data.auditLogs);
        if (payload.data.settings?.length) await db.settings.bulkAdd(payload.data.settings);
      }
    );

    // 3. Log the restoration event in audit log
    await auditService.log({
      entityType: 'SETTINGS',
      entityId: 0,
      action: 'RESTORE',
      newValue: payload.tableCounts,
      reason: `Full database restored from backup dated ${payload.exportDate}`,
      operator,
    });

    const restoredCounts = {
      beats: await db.beats.count(),
      retailers: await db.retailers.count(),
      sales: await db.sales.count(),
      collections: await db.collections.count(),
      collectionAllocations: await db.collectionAllocations.count(),
    };

    return { success: true, restoredCounts };
  },
};
