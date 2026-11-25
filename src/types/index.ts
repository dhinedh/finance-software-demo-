export type PaymentMethodType = 'CASH' | 'GPAY' | 'CHEQUE' | 'BANK_TRANSFER' | 'OTHER';
export type ChequeStatusType = 'RECEIVED' | 'CLEARED' | 'BOUNCED';
export type VerificationStatusType = 'VERIFIED' | 'MISMATCH' | 'PENDING';
export type EntityType = 'SALE' | 'COLLECTION' | 'RETAILER' | 'BEAT' | 'DAILY_BALANCE' | 'SETTINGS' | 'EXPENSE';
export type AuditActionType = 'CREATE' | 'UPDATE' | 'VOID' | 'RESTORE' | 'CORRECTION';

export interface Beat {
  id?: number;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Retailer {
  id?: number;
  retailerName: string;
  beatId: number;
  address: string;
  contactNumber: string;
  openingBalance: number; // in paise
  openingBalanceDate: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'INACTIVE';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id?: number;
  serialNumber: string;
  date: string; // YYYY-MM-DD
  collectionDate?: string; // Expected collection date (YYYY-MM-DD)
  billNumber: string;
  retailerId: number;
  beatIdAtTransaction: number;
  billAmount: number; // in paise (total invoice amount including any taxes)
  gstAmount?: number; // in paise (optional informational breakdown)
  remarks?: string;
  isVoided?: boolean;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id?: number;
  collectionNumber: string;
  date: string; // YYYY-MM-DD
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
  isVoided?: boolean;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionAllocation {
  id?: number;
  collectionId: number;
  saleId: number;
  allocatedAmount: number; // in paise
  createdAt: string;
}

export interface DailyBalance {
  id?: number;
  date: string; // YYYY-MM-DD
  openingBalance: number; // in paise
  totalSales: number; // in paise
  cashCollections: number; // in paise
  gpayCollections: number; // in paise
  clearedChequeCollections: number; // in paise
  otherConfirmedCollections: number; // in paise
  totalConfirmedCollections: number; // in paise
  closingBalance: number; // in paise
  nextDayOpeningBalance?: number; // in paise
  difference?: number; // in paise
  verificationStatus: VerificationStatusType;
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface AuditLog {
  id?: number;
  entityType: EntityType;
  entityId: number;
  action: AuditActionType;
  oldValue?: string; // JSON string
  newValue?: string; // JSON string
  reason: string;
  timestamp: string; // ISO
  operator: string;
}

export interface AppSettings {
  id?: number;
  businessName: string;
  operatorName: string;
  financialYearStart: string;
  backupReminderDays: number;
  lastBackupDate?: string;
  theme: 'light' | 'dark';
}

// Composite / ViewModel Types
export interface BillWithStatus {
  sale: Sale;
  originalAmount: number;
  previouslyCollected: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'SETTLED';
  allocations: {
    allocationId: number;
    collectionId: number;
    collectionDate: string;
    collectionNumber: string;
    paymentMethod: PaymentMethodType;
    chequeStatus?: ChequeStatusType;
    amount: number;
  }[];
}

export interface RetailerOutstandingSummary {
  retailer: Retailer;
  beatName: string;
  openingBalance: number;
  totalSales: number;
  totalConfirmedCollections: number;
  pendingChequeAmount: number;
  currentOutstanding: number;
  lastCollectionDate?: string;
  oldestUnpaidBillDate?: string;
  unpaidBillsCount: number;
}

export interface BeatOutstandingSummary {
  beat: Beat;
  retailerCount: number;
  totalSales: number;
  totalCollections: number;
  totalOutstanding: number;
  retailers: RetailerOutstandingSummary[];
}

export interface OutstandingAgeingSummary {
  retailerId: number;
  retailerName: string;
  beatName: string;
  currentOutstanding: number;
  days0To7: number;
  days8To15: number;
  days16To30: number;
  days31To60: number;
  daysAbove60: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  particulars: string;
  referenceNo: string;
  transactionType: 'OPENING' | 'SALE' | 'COLLECTION';
  paymentMethod?: PaymentMethodType;
  chequeStatus?: ChequeStatusType;
  debit: number; // in paise (Sales increase outstanding)
  credit: number; // in paise (Confirmed collections decrease outstanding)
  runningBalance: number; // in paise
  remarks?: string;
  allocationDetails?: string;
}

export interface DayEndReportData {
  date: string;
  openingBalance: number;
  totalSales: number;
  cashCollection: number;
  gpayCollection: number;
  clearedChequeCollection: number;
  bankTransferCollection: number;
  otherCollection: number;
  totalConfirmedCollection: number;
  unclearedChequeCollection: number;
  closingBalance: number;
  nextDayOpening?: number;
  difference?: number;
  verificationStatus: VerificationStatusType;
  salesCount: number;
  collectionsCount: number;
}

// Collection Schedule Types
export type ScheduleStatusType = 'DUE_TODAY' | 'DUE_TOMORROW' | 'UPCOMING' | 'OVERDUE';
export type SchedulePeriodType = 'today' | 'tomorrow' | 'upcoming_7' | 'overdue' | 'all' | 'custom';

export interface ScheduledCollectionItem {
  saleId: number;
  billNumber: string;
  salesDate: string;
  collectionDate: string;
  retailerId: number;
  retailerName: string;
  retailerPhone: string;
  beatId: number;
  beatName: string;
  originalAmount: number; // in paise
  previouslyCollected: number; // in paise
  remainingAmount: number; // in paise
  status: ScheduleStatusType;
  daysDifference: number;
}

export interface CollectionScheduleSummary {
  dueTodayAmount: number;
  dueTodayCount: number;
  dueTomorrowAmount: number;
  dueTomorrowCount: number;
  upcomingAmount: number;
  upcomingCount: number;
  overdueAmount: number;
  overdueCount: number;
  totalPendingAmount: number;
  totalPendingCount: number;
}

export interface BeatScheduleBreakdown {
  beatId: number;
  beatName: string;
  amount: number;
  billCount: number;
}

// Expense Management Types
export type ExpenseCategoryType =
  | 'FUEL_TRANSPORT'
  | 'STAFF_ALLOWANCE'
  | 'VEHICLE_MAINTENANCE'
  | 'OFFICE_TEA'
  | 'LOADING_UNLOADING'
  | 'RENT_UTILITIES'
  | 'PACKAGING'
  | 'MISCELLANEOUS';

export interface Expense {
  id?: number;
  voucherNumber: string; // e.g. EXP-20261125-001
  date: string; // YYYY-MM-DD
  category: ExpenseCategoryType | string;
  amount: number; // in paise
  paymentMethod: PaymentMethodType;
  paidTo: string; // Recipient / Vendor name
  beatId?: number; // Optional beat allocation
  vehicleNumber?: string; // Optional vehicle ref
  remarks?: string;
  isVoided?: boolean;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  todayTotal: number; // in paise
  todayCash: number; // in paise (reduces cash drawer balance)
  todayDigital: number; // in paise (GPay / Bank transfer)
  thisMonthTotal: number; // in paise
  totalCount: number;
  categoryBreakdown: {
    category: string;
    amount: number; // in paise
    count: number;
    percentage: number;
  }[];
}
