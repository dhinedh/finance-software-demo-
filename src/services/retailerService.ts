import { db } from '../db/database';
import type { Retailer } from '../types';
import { auditService } from './auditService';

export const retailerService = {
  async getAll(): Promise<Retailer[]> {
    return await db.retailers.toArray();
  },

  async getById(id: number): Promise<Retailer | undefined> {
    return await db.retailers.get(id);
  },

  async getByBeat(beatId: number): Promise<Retailer[]> {
    return await db.retailers.where('beatId').equals(beatId).toArray();
  },

  async search(query: string): Promise<Retailer[]> {
    const q = query.trim().toLowerCase();
    if (!q) return await db.retailers.toArray();
    return await db.retailers
      .filter((r) => r.retailerName.toLowerCase().includes(q) || r.contactNumber.includes(q))
      .toArray();
  },

  async checkDuplicateName(name: string, excludeId?: number): Promise<boolean> {
    const existing = await db.retailers
      .filter((r) => r.retailerName.trim().toLowerCase() === name.trim().toLowerCase() && r.id !== excludeId)
      .first();
    return !!existing;
  },

  async create(data: Omit<Retailer, 'id' | 'createdAt' | 'updatedAt'>, operator = 'Admin'): Promise<number> {
    const isDuplicate = await this.checkDuplicateName(data.retailerName);
    if (isDuplicate) {
      throw new Error(`A retailer with the name "${data.retailerName}" already exists.`);
    }

    const now = new Date().toISOString();
    const retailer: Retailer = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.retailers.add(retailer);

    await auditService.log({
      entityType: 'RETAILER',
      entityId: id,
      action: 'CREATE',
      newValue: retailer,
      reason: 'Retailer created with opening balance',
      operator,
    });

    return id;
  },

  async update(id: number, data: Partial<Retailer>, reason = 'Retailer details update', operator = 'Admin'): Promise<void> {
    const existing = await db.retailers.get(id);
    if (!existing) throw new Error(`Retailer ${id} not found`);

    if (data.retailerName && data.retailerName.trim().toLowerCase() !== existing.retailerName.toLowerCase()) {
      const isDuplicate = await this.checkDuplicateName(data.retailerName, id);
      if (isDuplicate) {
        throw new Error(`A retailer with the name "${data.retailerName}" already exists.`);
      }
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await db.retailers.put(updated);

    await auditService.log({
      entityType: 'RETAILER',
      entityId: id,
      action: data.openingBalance !== undefined && data.openingBalance !== existing.openingBalance ? 'CORRECTION' : 'UPDATE',
      oldValue: existing,
      newValue: updated,
      reason,
      operator,
    });
  },

  async toggleStatus(id: number, operator = 'Admin'): Promise<void> {
    const existing = await db.retailers.get(id);
    if (!existing) return;
    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await this.update(id, { status: newStatus }, `Retailer marked as ${newStatus}`, operator);
  },
};
