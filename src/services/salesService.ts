import { db } from '../db/database';
import type { Sale } from '../types';
import { auditService } from './auditService';
import { retailerService } from './retailerService';

export const salesService = {
  async getNextSerialNumber(date: string): Promise<string> {
    // Format: S-YYYYMMDD-001
    const cleanDate = date.replace(/-/g, '');
    const countToday = await db.sales.where('date').equals(date).count();
    const nextNum = (countToday + 1).toString().padStart(3, '0');
    return `S-${cleanDate}-${nextNum}`;
  },

  async checkDuplicateBill(billNumber: string, retailerId: number, excludeSaleId?: number): Promise<boolean> {
    const cleanBill = billNumber.trim().toLowerCase();
    const existing = await db.sales
      .filter((s) => !s.isVoided && s.retailerId === retailerId && s.billNumber.trim().toLowerCase() === cleanBill && s.id !== excludeSaleId)
      .first();
    return !!existing;
  },

  async create(data: {
    date: string;
    collectionDate?: string;
    billNumber: string;
    retailerId: number;
    billAmount: number; // in paise
    gstAmount?: number; // in paise
    remarks?: string;
  }, operator = 'Admin'): Promise<number> {
    const retailer = await retailerService.getById(data.retailerId);
    if (!retailer) throw new Error('Retailer not found');

    const serialNumber = await this.getNextSerialNumber(data.date);
    const now = new Date().toISOString();

    const sale: Sale = {
      serialNumber,
      date: data.date,
      collectionDate: data.collectionDate || data.date,
      billNumber: data.billNumber.trim(),
      retailerId: data.retailerId,
      beatIdAtTransaction: retailer.beatId,
      billAmount: Math.round(data.billAmount),
      gstAmount: data.gstAmount ? Math.round(data.gstAmount) : undefined,
      remarks: data.remarks?.trim() || '',
      isVoided: false,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.sales.add(sale);

    await auditService.log({
      entityType: 'SALE',
      entityId: id,
      action: 'CREATE',
      newValue: sale,
      reason: `New Sales Bill #${sale.billNumber} created`,
      operator,
    });

    return id;
  },

  async update(id: number, data: Partial<Sale>, reason: string, operator = 'Admin'): Promise<void> {
    const existing = await db.sales.get(id);
    if (!existing) throw new Error(`Sale #${id} not found`);

    const updated: Sale = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await db.sales.put(updated);

    await auditService.log({
      entityType: 'SALE',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
      reason: reason || 'Sale record updated',
      operator,
    });
  },

  async voidSale(id: number, reason: string, operator = 'Admin'): Promise<void> {
    const existing = await db.sales.get(id);
    if (!existing) throw new Error(`Sale #${id} not found`);

    // Check if any allocations exist
    const allocations = await db.collectionAllocations.where('saleId').equals(id).toArray();
    if (allocations.length > 0) {
      throw new Error(`Cannot void bill #${existing.billNumber}: Payments are already allocated against this bill. Remove allocations first.`);
    }

    const updated: Sale = {
      ...existing,
      isVoided: true,
      voidReason: reason,
      updatedAt: new Date().toISOString(),
    };

    await db.sales.put(updated);

    await auditService.log({
      entityType: 'SALE',
      entityId: id,
      action: 'VOID',
      oldValue: existing,
      newValue: updated,
      reason: `Bill #${existing.billNumber} voided: ${reason}`,
      operator,
    });
  },

  async getAll(): Promise<Sale[]> {
    return await db.sales.filter((s) => !s.isVoided).toArray();
  },

  async getById(id: number): Promise<Sale | undefined> {
    return await db.sales.get(id);
  },

  async getSales(filter?: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    retailerId?: number;
    beatId?: number;
    search?: string;
    includeVoided?: boolean;
  }): Promise<Sale[]> {
    let sales = await db.sales.toArray();

    if (!filter?.includeVoided) {
      sales = sales.filter((s) => !s.isVoided);
    }

    if (filter?.date) {
      sales = sales.filter((s) => s.date === filter.date);
    } else {
      if (filter?.fromDate) {
        sales = sales.filter((s) => s.date >= filter.fromDate!);
      }
      if (filter?.toDate) {
        sales = sales.filter((s) => s.date <= filter.toDate!);
      }
    }

    if (filter?.retailerId) {
      sales = sales.filter((s) => s.retailerId === filter.retailerId);
    }

    if (filter?.beatId) {
      sales = sales.filter((s) => s.beatIdAtTransaction === filter.beatId);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      sales = sales.filter((s) => s.billNumber.toLowerCase().includes(q) || s.serialNumber.toLowerCase().includes(q));
    }

    return sales.sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0));
  },
};
