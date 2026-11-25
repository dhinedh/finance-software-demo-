import { db } from '../db/database';
import type {
  Collection,
  CollectionAllocation,
  BillWithStatus,
  ChequeStatusType,
  PaymentMethodType,
} from '../types';
import { auditService } from './auditService';

export const collectionService = {
  async getNextCollectionNumber(date: string): Promise<string> {
    const cleanDate = date.replace(/-/g, '');
    const countToday = await db.collections.where('date').equals(date).count();
    const nextNum = (countToday + 1).toString().padStart(3, '0');
    return `C-${cleanDate}-${nextNum}`;
  },

  /**
   * Returns all unpaid or partially paid bills for a retailer.
   * Calculates previously collected confirmed amounts.
   */
  async getUnpaidBillsForRetailer(retailerId: number): Promise<BillWithStatus[]> {
    // 1. Get all non-voided sales for this retailer
    const sales = await db.sales
      .filter((s) => !s.isVoided && s.retailerId === retailerId)
      .toArray();

    // 2. Get all allocations for these sales
    const saleIds = new Set(sales.map((s) => s.id!));
    const allAllocations = await db.collectionAllocations
      .filter((a) => saleIds.has(a.saleId))
      .toArray();

    // 3. Get corresponding collections to verify if confirmed (not voided, and if cheque, must be CLEARED)
    const collectionIds = new Set(allAllocations.map((a) => a.collectionId));
    const collections = await db.collections
      .filter((c) => collectionIds.has(c.id!))
      .toArray();

    const collectionMap = new Map<number, Collection>();
    collections.forEach((c) => collectionMap.set(c.id!, c));

    const billsWithStatus: BillWithStatus[] = [];

    for (const sale of sales) {
      const saleAllocations = allAllocations.filter((a) => a.saleId === sale.id);
      
      let previouslyCollected = 0;
      const validAllocations: BillWithStatus['allocations'] = [];

      for (const alloc of saleAllocations) {
        const col = collectionMap.get(alloc.collectionId);
        if (!col || col.isVoided) continue;

        // Financial rule: Only CLEARED cheques reduce confirmed outstanding!
        const isConfirmed = col.paymentMethod !== 'CHEQUE' || col.chequeStatus === 'CLEARED';
        if (isConfirmed) {
          previouslyCollected += alloc.allocatedAmount;
        }

        validAllocations.push({
          allocationId: alloc.id!,
          collectionId: col.id!,
          collectionDate: col.date,
          collectionNumber: col.collectionNumber,
          paymentMethod: col.paymentMethod,
          chequeStatus: col.chequeStatus,
          amount: alloc.allocatedAmount,
        });
      }

      const remainingAmount = Math.max(0, sale.billAmount - previouslyCollected);
      const status: BillWithStatus['status'] =
        remainingAmount === 0 ? 'SETTLED' : previouslyCollected > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      billsWithStatus.push({
        sale,
        originalAmount: sale.billAmount,
        previouslyCollected,
        remainingAmount,
        status,
        allocations: validAllocations,
      });
    }

    // Sort by bill date ascending (or bill number)
    return billsWithStatus.sort((a, b) => a.sale.date.localeCompare(b.sale.date) || a.sale.billNumber.localeCompare(b.sale.billNumber));
  },

  async create(data: {
    date: string;
    retailerId: number;
    totalAmount: number; // in paise
    paymentMethod: PaymentMethodType;
    chequeStatus?: ChequeStatusType;
    chequeNumber?: string;
    chequeDate?: string;
    bankName?: string;
    transactionRef?: string;
    salesmanName?: string;
    remarks?: string;
    allocations: { saleId: number; amount: number }[];
  }, operator = 'Admin'): Promise<number> {
    if (data.totalAmount <= 0) {
      throw new Error('Collection amount must be greater than zero.');
    }

    // Verify allocated amount does not exceed total collection amount
    const totalAllocated = data.allocations.reduce((sum, a) => sum + Math.round(a.amount), 0);
    if (totalAllocated > data.totalAmount) {
      throw new Error(`Total allocated amount (₹${(totalAllocated / 100).toFixed(2)}) cannot exceed collection amount (₹${(data.totalAmount / 100).toFixed(2)}).`);
    }

    // Verify allocation doesn't exceed individual bill remaining amounts
    const unpaidBills = await this.getUnpaidBillsForRetailer(data.retailerId);
    const billMap = new Map(unpaidBills.map((b) => [b.sale.id!, b]));

    for (const alloc of data.allocations) {
      if (alloc.amount <= 0) continue;
      const bill = billMap.get(alloc.saleId);
      if (!bill) {
        throw new Error(`Sale #${alloc.saleId} not found or invalid for this retailer.`);
      }
      if (Math.round(alloc.amount) > bill.remainingAmount) {
        throw new Error(
          `Allocated amount (₹${(alloc.amount / 100).toFixed(2)}) for Bill #${bill.sale.billNumber} exceeds remaining unpaid balance of ₹${(bill.remainingAmount / 100).toFixed(2)}.`
        );
      }
    }

    const collectionNumber = await this.getNextCollectionNumber(data.date);
    const now = new Date().toISOString();

    const collection: Collection = {
      collectionNumber,
      date: data.date,
      retailerId: data.retailerId,
      totalAmount: Math.round(data.totalAmount),
      paymentMethod: data.paymentMethod,
      chequeStatus: data.paymentMethod === 'CHEQUE' ? (data.chequeStatus || 'RECEIVED') : undefined,
      chequeNumber: data.chequeNumber?.trim(),
      chequeDate: data.chequeDate,
      bankName: data.bankName?.trim(),
      transactionRef: data.transactionRef?.trim(),
      salesmanName: data.salesmanName?.trim(),
      remarks: data.remarks?.trim() || '',
      isVoided: false,
      createdAt: now,
      updatedAt: now,
    };

    const collectionId = await db.collections.add(collection);

    // Save allocations
    for (const alloc of data.allocations) {
      if (alloc.amount <= 0) continue;
      const allocationRecord: CollectionAllocation = {
        collectionId,
        saleId: alloc.saleId,
        allocatedAmount: Math.round(alloc.amount),
        createdAt: now,
      };
      await db.collectionAllocations.add(allocationRecord);
    }

    await auditService.log({
      entityType: 'COLLECTION',
      entityId: collectionId,
      action: 'CREATE',
      newValue: { ...collection, allocations: data.allocations },
      reason: `Collection #${collection.collectionNumber} received via ${data.paymentMethod}`,
      operator,
    });

    return collectionId;
  },

  async updateChequeStatus(
    collectionId: number,
    newStatus: ChequeStatusType,
    reason: string,
    operator = 'Admin'
  ): Promise<void> {
    const existing = await db.collections.get(collectionId);
    if (!existing) throw new Error(`Collection #${collectionId} not found`);
    if (existing.paymentMethod !== 'CHEQUE') {
      throw new Error('Only cheque payments can have their status updated.');
    }

    const updated: Collection = {
      ...existing,
      chequeStatus: newStatus,
      updatedAt: new Date().toISOString(),
    };

    await db.collections.put(updated);

    await auditService.log({
      entityType: 'COLLECTION',
      entityId: collectionId,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
      reason: `Cheque status changed to ${newStatus}: ${reason}`,
      operator,
    });
  },

  async voidCollection(collectionId: number, reason: string, operator = 'Admin'): Promise<void> {
    const existing = await db.collections.get(collectionId);
    if (!existing) throw new Error(`Collection #${collectionId} not found`);

    const updated: Collection = {
      ...existing,
      isVoided: true,
      voidReason: reason,
      updatedAt: new Date().toISOString(),
    };

    await db.collections.put(updated);

    await auditService.log({
      entityType: 'COLLECTION',
      entityId: collectionId,
      action: 'VOID',
      oldValue: existing,
      newValue: updated,
      reason: `Collection #${existing.collectionNumber} voided: ${reason}`,
      operator,
    });
  },

  async getCollections(filter?: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    retailerId?: number;
    paymentMethod?: PaymentMethodType;
    chequeStatus?: ChequeStatusType;
    includeVoided?: boolean;
  }): Promise<Collection[]> {
    let collections = await db.collections.toArray();

    if (!filter?.includeVoided) {
      collections = collections.filter((c) => !c.isVoided);
    }

    if (filter?.date) {
      collections = collections.filter((c) => c.date === filter.date);
    } else {
      if (filter?.fromDate) {
        collections = collections.filter((c) => c.date >= filter.fromDate!);
      }
      if (filter?.toDate) {
        collections = collections.filter((c) => c.date <= filter.toDate!);
      }
    }

    if (filter?.retailerId) {
      collections = collections.filter((c) => c.retailerId === filter.retailerId);
    }

    if (filter?.paymentMethod) {
      collections = collections.filter((c) => c.paymentMethod === filter.paymentMethod);
    }

    if (filter?.chequeStatus) {
      collections = collections.filter((c) => c.chequeStatus === filter.chequeStatus);
    }

    return collections.sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0));
  },

  async getAllocations(collectionId: number): Promise<CollectionAllocation[]> {
    return await db.collectionAllocations.where('collectionId').equals(collectionId).toArray();
  },

  async getById(id: number): Promise<Collection | undefined> {
    return await db.collections.get(id);
  },
};
