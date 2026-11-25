import { db } from '../db/database';
import type { AuditLog, EntityType, AuditActionType } from '../types';

export const auditService = {
  async log(params: {
    entityType: EntityType;
    entityId: number;
    action: AuditActionType;
    oldValue?: any;
    newValue?: any;
    reason: string;
    operator?: string;
  }): Promise<number> {
    const logEntry: AuditLog = {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue !== undefined ? JSON.stringify(params.oldValue) : undefined,
      newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : undefined,
      reason: params.reason || 'Financial record adjustment',
      timestamp: new Date().toISOString(),
      operator: params.operator || 'Business Owner',
    };

    return await db.auditLogs.add(logEntry);
  },

  async getLogs(filter?: {
    entityType?: EntityType;
    entityId?: number;
    limit?: number;
  }): Promise<AuditLog[]> {
    let query = db.auditLogs.orderBy('id').reverse();
    let logs = await query.toArray();

    if (filter?.entityType) {
      logs = logs.filter((l) => l.entityType === filter.entityType);
    }
    if (filter?.entityId) {
      logs = logs.filter((l) => l.entityId === filter.entityId);
    }
    if (filter?.limit) {
      logs = logs.slice(0, filter.limit);
    }

    return logs;
  },
};
