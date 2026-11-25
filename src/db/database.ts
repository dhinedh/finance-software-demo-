import Dexie, { type Table } from 'dexie';
import type {
  Beat,
  Retailer,
  Sale,
  Collection,
  CollectionAllocation,
  DailyBalance,
  AuditLog,
  AppSettings,
  Expense,
} from '../types';

export class RetailFinanceDB extends Dexie {
  beats!: Table<Beat, number>;
  retailers!: Table<Retailer, number>;
  sales!: Table<Sale, number>;
  collections!: Table<Collection, number>;
  collectionAllocations!: Table<CollectionAllocation, number>;
  dailyBalances!: Table<DailyBalance, number>;
  auditLogs!: Table<AuditLog, number>;
  settings!: Table<AppSettings, number>;
  expenses!: Table<Expense, number>;

  constructor() {
    super('RetailFinanceDB');

    // Define DB Schema & Indexes
    this.version(1).stores({
      beats: '++id, name, status, createdAt',
      retailers: '++id, retailerName, beatId, status, openingBalanceDate, createdAt',
      sales: '++id, serialNumber, date, billNumber, retailerId, beatIdAtTransaction, [retailerId+date], createdAt, isVoided',
      collections: '++id, collectionNumber, date, retailerId, paymentMethod, chequeStatus, [retailerId+date], createdAt, isVoided',
      collectionAllocations: '++id, collectionId, saleId, createdAt',
      dailyBalances: '++id, date, verificationStatus',
      auditLogs: '++id, entityType, entityId, action, timestamp, operator',
      settings: '++id',
    });

    this.version(2).stores({
      beats: '++id, name, status, createdAt',
      retailers: '++id, retailerName, beatId, status, openingBalanceDate, createdAt',
      sales: '++id, serialNumber, date, billNumber, retailerId, beatIdAtTransaction, [retailerId+date], createdAt, isVoided',
      collections: '++id, collectionNumber, date, retailerId, paymentMethod, chequeStatus, [retailerId+date], createdAt, isVoided',
      collectionAllocations: '++id, collectionId, saleId, createdAt',
      dailyBalances: '++id, date, verificationStatus',
      auditLogs: '++id, entityType, entityId, action, timestamp, operator',
      settings: '++id',
      expenses: '++id, voucherNumber, date, category, paymentMethod, beatId, isVoided, createdAt',
    });
  }
}

export const db = new RetailFinanceDB();
