import React, { useState, useEffect } from 'react';
import { collectionService } from '../../services/collectionService';
import { Modal } from '../../components/common/Modal';
import { RetailerAutocomplete } from '../../components/common/RetailerAutocomplete';
import { formatINR, toPaise, toRupees } from '../../utils/money';
import { formatDateDisplay, getTodayDateString } from '../../utils/date';
import { useApp } from '../../context/AppContext';
import {
  Receipt,
  CreditCard,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import type {
  BillWithStatus,
  PaymentMethodType,
  ChequeStatusType,
  Retailer,
} from '../../types';

interface CollectionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const CollectionFormModal: React.FC<CollectionFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { showToast, operatorName } = useApp();

  const [date, setDate] = useState<string>(getTodayDateString());
  const [retailerId, setRetailerId] = useState<number | undefined>(undefined);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);

  // Unpaid bills for the retailer
  const [unpaidBills, setUnpaidBills] = useState<BillWithStatus[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);

  // Form Fields
  const [collectionAmount, setCollectionAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
  const [chequeStatus, setChequeStatus] = useState<ChequeStatusType>('RECEIVED');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(getTodayDateString());
  const [bankName, setBankName] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [salesmanName, setSalesmanName] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Bill-wise allocations map: saleId -> amount string in rupees
  const [allocations, setAllocations] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isOpen) {
      setDate(getTodayDateString());
      setRetailerId(undefined);
      setSelectedRetailer(null);
      setUnpaidBills([]);
      setCollectionAmount('');
      setPaymentMethod('CASH');
      setChequeStatus('RECEIVED');
      setChequeNumber('');
      setChequeDate(getTodayDateString());
      setBankName('');
      setTransactionRef('');
      setSalesmanName('');
      setRemarks('');
      setAllocations({});
    }
  }, [isOpen]);

  const handleRetailerSelect = async (id: number, ret: Retailer) => {
    setRetailerId(id);
    setSelectedRetailer(ret);
    setIsLoadingBills(true);
    try {
      const bills = await collectionService.getUnpaidBillsForRetailer(id);
      const activeBills = bills.filter((b) => b.remainingAmount > 0);
      setUnpaidBills(activeBills);
      setAllocations({});
    } catch {
      showToast({ type: 'error', message: 'Failed to fetch unpaid bills for retailer' });
    } finally {
      setIsLoadingBills(false);
    }
  };

  const handleAllocationChange = (saleId: number, val: string) => {
    setAllocations((prev) => ({
      ...prev,
      [saleId]: val,
    }));
  };

  const handleAllocateFullBill = (saleId: number, remainingPaise: number) => {
    const rupees = (remainingPaise / 100).toFixed(2);
    setAllocations((prev) => ({
      ...prev,
      [saleId]: rupees,
    }));
  };

  // Calculate sum of allocations in paise
  const totalAllocatedPaise = Object.values(allocations).reduce(
    (sum, val) => sum + toPaise(val || 0),
    0
  );
  const totalCollectionPaise = toPaise(collectionAmount || 0);
  const remainingUnallocatedPaise = totalCollectionPaise - totalAllocatedPaise;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!retailerId) {
      showToast({ type: 'error', message: 'Please select a retailer' });
      return;
    }
    if (totalCollectionPaise <= 0) {
      showToast({ type: 'error', message: 'Collection amount must be greater than zero' });
      return;
    }
    if (totalAllocatedPaise > totalCollectionPaise) {
      showToast({
        type: 'error',
        message: `Total allocated amount exceeds received collection amount!`,
      });
      return;
    }

    // Prepare allocations array
    const allocArray = Object.entries(allocations)
      .map(([saleId, amtStr]) => ({
        saleId: Number(saleId),
        amount: toPaise(amtStr || 0),
      }))
      .filter((a) => a.amount > 0);

    // Validate each allocation doesn't exceed bill's remaining amount
    for (const alloc of allocArray) {
      const bill = unpaidBills.find((b) => b.sale.id === alloc.saleId);
      if (bill && alloc.amount > bill.remainingAmount) {
        showToast({
          type: 'error',
          message: `Allocation for Bill #${bill.sale.billNumber} exceeds its unpaid balance of ${formatINR(bill.remainingAmount)}`,
        });
        return;
      }
    }

    try {
      await collectionService.create(
        {
          date,
          retailerId,
          totalAmount: totalCollectionPaise,
          paymentMethod,
          chequeStatus: paymentMethod === 'CHEQUE' ? chequeStatus : undefined,
          chequeNumber: chequeNumber.trim(),
          chequeDate: paymentMethod === 'CHEQUE' ? chequeDate : undefined,
          bankName: bankName.trim(),
          transactionRef: transactionRef.trim(),
          salesmanName: salesmanName.trim(),
          remarks: remarks.trim(),
          allocations: allocArray,
        },
        operatorName
      );

      showToast({
        type: 'success',
        message: `Collection receipt recorded via ${paymentMethod} (${formatINR(totalCollectionPaise)})`,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to record collection receipt' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Retailer Collection"
      subtitle="Enter received payment and manually allocate to specific outstanding bills"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1 & 2: Date & Retailer Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Collection Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>

          <div className="sm:col-span-2">
            <RetailerAutocomplete
              value={retailerId}
              onChange={handleRetailerSelect}
              autoFocus
            />
          </div>
        </div>

        {/* Step 3: Unpaid Bills Table */}
        {retailerId && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Unpaid / Partially Paid Bills ({unpaidBills.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Choose which bill(s) the payment belongs to
              </span>
            </div>

            {isLoadingBills ? (
              <p className="text-xs text-slate-500 py-3 text-center">Loading unpaid bills...</p>
            ) : unpaidBills.length === 0 ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  This retailer currently has no unpaid sales bills! (Payment will be treated as general advance / on-account credit).
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Bill Date</th>
                      <th className="px-3 py-2">Collection Due</th>
                      <th className="px-3 py-2">Bill Number</th>
                      <th className="px-3 py-2 text-right">Original Amount</th>
                      <th className="px-3 py-2 text-right">Previously Paid</th>
                      <th className="px-3 py-2 text-right">Remaining Due</th>
                      <th className="px-3 py-2 text-right w-36">Allocate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {unpaidBills.map((bill) => {
                      const saleId = bill.sale.id!;
                      const allocatedVal = allocations[saleId] || '';

                      return (
                        <tr key={saleId} className="hover:bg-white dark:hover:bg-slate-750">
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {formatDateDisplay(bill.sale.date)}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                              <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span>{formatDateDisplay(bill.sale.collectionDate || bill.sale.date)}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                            {bill.sale.billNumber}
                          </td>
                          <td className="px-3 py-2 text-right num-cell text-slate-700 dark:text-slate-300">
                            {formatINR(bill.originalAmount)}
                          </td>
                          <td className="px-3 py-2 text-right num-cell text-slate-500">
                            {formatINR(bill.previouslyCollected)}
                          </td>
                          <td className="px-3 py-2 text-right num-cell font-bold text-rose-600 dark:text-rose-400">
                            {formatINR(bill.remainingAmount)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center space-x-1 justify-end">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={toRupees(bill.remainingAmount)}
                                value={allocatedVal}
                                onChange={(e) => handleAllocationChange(saleId, e.target.value)}
                                placeholder="0.00"
                                className="w-24 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600 font-medium"
                              />
                              <button
                                type="button"
                                onClick={() => handleAllocateFullBill(saleId, bill.remainingAmount)}
                                title="Allocate full remaining amount"
                                className="px-1.5 py-1 text-[10px] font-semibold rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 hover:bg-sky-200"
                              >
                                Full
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Collection Amount & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Received Collection Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                value={collectionAmount}
                onChange={(e) => setCollectionAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600 font-bold"
              />
              <span className="absolute left-2.5 top-2 text-xs text-slate-400">₹</span>
            </div>

            {/* Allocation Status Indicator */}
            {totalCollectionPaise > 0 && (
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Allocated: <strong>{formatINR(totalAllocatedPaise)}</strong>
                </span>
                <span
                  className={
                    remainingUnallocatedPaise < 0
                      ? 'text-rose-500 font-bold'
                      : remainingUnallocatedPaise === 0
                      ? 'text-emerald-600 font-semibold'
                      : 'text-amber-600 font-semibold'
                  }
                >
                  {remainingUnallocatedPaise < 0
                    ? `Over-allocated by ${formatINR(Math.abs(remainingUnallocatedPaise))}`
                    : remainingUnallocatedPaise === 0
                    ? '100% Fully Allocated'
                    : `Unallocated: ${formatINR(remainingUnallocatedPaise)}`}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600 font-semibold"
            >
              <option value="CASH">CASH (Physical Currency)</option>
              <option value="GPAY">GPAY (UPI / QR Payment)</option>
              <option value="CHEQUE">CHEQUE (Bank Cheque)</option>
              <option value="BANK_TRANSFER">BANK TRANSFER (NEFT / RTGS / IMPS)</option>
              <option value="OTHER">OTHER PAYMENT METHOD</option>
            </select>
          </div>
        </div>

        {/* Cheque Specific Fields */}
        {paymentMethod === 'CHEQUE' && (
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-3">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">
              Cheque Verification Details (Only CLEARED cheques reduce confirmed outstanding)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Cheque Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={chequeStatus}
                  onChange={(e) => setChequeStatus(e.target.value as ChequeStatusType)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="RECEIVED">RECEIVED (Pending Clearance)</option>
                  <option value="CLEARED">CLEARED (Confirmed in Bank)</option>
                  <option value="BOUNCED">BOUNCED (Dishonoured)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Cheque Number
                </label>
                <input
                  type="text"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g. 401928"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. SBI, Indian Bank"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Cheque Date
                </label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* General Reference & Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Salesman / Collector
            </label>
            <input
              type="text"
              value={salesmanName}
              onChange={(e) => setSalesmanName(e.target.value)}
              placeholder="e.g. Ravi (Beat Rep)"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Transaction / UPI Ref
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="UPI Ref / Bank UTR..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs"
          >
            Save Collection Receipt
          </button>
        </div>
      </form>
    </Modal>
  );
};
