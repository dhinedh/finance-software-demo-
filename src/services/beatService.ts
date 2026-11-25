import { db } from '../db/database';
import type { Beat } from '../types';
import { auditService } from './auditService';

export const beatService = {
  async getAll(): Promise<Beat[]> {
    return await db.beats.toArray();
  },

  async getActiveBeats(): Promise<Beat[]> {
    return await db.beats.filter((b) => b.status === 'ACTIVE').toArray();
  },

  async getById(id: number): Promise<Beat | undefined> {
    return await db.beats.get(id);
  },

  async create(data: Omit<Beat, 'id' | 'createdAt' | 'updatedAt'>, operator = 'Admin'): Promise<number> {
    const now = new Date().toISOString();
    const beat: Beat = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.beats.add(beat);
    await auditService.log({
      entityType: 'BEAT',
      entityId: id,
      action: 'CREATE',
      newValue: beat,
      reason: 'Beat created',
      operator,
    });
    return id;
  },

  async update(id: number, data: Partial<Beat>, operator = 'Admin'): Promise<void> {
    const existing = await db.beats.get(id);
    if (!existing) throw new Error(`Beat ${id} not found`);

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await db.beats.put(updated);

    await auditService.log({
      entityType: 'BEAT',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
      reason: 'Beat updated',
      operator,
    });
  },

  async canDelete(id: number): Promise<{ canDelete: boolean; reason?: string }> {
    const retailersCount = await db.retailers.where('beatId').equals(id).count();
    if (retailersCount > 0) {
      return { canDelete: false, reason: `Cannot delete: ${retailersCount} retailers are assigned to this beat.` };
    }

    const salesCount = await db.sales.where('beatIdAtTransaction').equals(id).count();
    if (salesCount > 0) {
      return { canDelete: false, reason: `Cannot delete: ${salesCount} sales transactions recorded under this beat.` };
    }

    return { canDelete: true };
  },

  async deactivate(id: number, operator = 'Admin'): Promise<void> {
    await this.update(id, { status: 'INACTIVE' }, operator);
  },
};
