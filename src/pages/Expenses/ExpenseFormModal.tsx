import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/common/Modal';
import { expenseService, EXPENSE_CATEGORIES } from '../../services/expenseService';
import { beatService } from '../../services/beatService';
import { getTodayDateString } from '../../utils/date';
import { toPaise, toRupees } from '../../utils/money';
import { useApp } from '../../context/AppContext';
import type { Expense, Beat, PaymentMethodType, ExpenseCategoryType } from '../../types';

const expenseSchema = z.object({
  date: z.string().min(10, 'Valid date is required'),
  category: z.string().min(1, 'Please select a category'),
  amountRupees: z
    .number({ invalid_type_error: 'Enter valid expense amount' })
    .positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'GPAY', 'CHEQUE', 'BANK_TRANSFER', 'OTHER']),
  paidTo: z.string().min(2, 'Recipient or vendor name is required'),
  beatId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  remarks: z.string().optional(),
  reason: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expenseToEdit?: Expense;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
}) => {
  const { showToast, operatorName } = useApp();
  const [beats, setBeats] = useState<Beat[]>([]);
  const isEditing = Boolean(expenseToEdit);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: getTodayDateString(),
      category: 'FUEL_TRANSPORT',
      amountRupees: undefined,
      paymentMethod: 'CASH',
      paidTo: '',
      beatId: '',
      vehicleNumber: '',
      remarks: '',
      reason: '',
    },
  });

  useEffect(() => {
    beatService.getActiveBeats().then((b: Beat[]) => setBeats(b));
  }, [isOpen]);

  useEffect(() => {
    if (expenseToEdit) {
      reset({
        date: expenseToEdit.date,
        category: expenseToEdit.category,
        amountRupees: toRupees(expenseToEdit.amount),
        paymentMethod: expenseToEdit.paymentMethod,
        paidTo: expenseToEdit.paidTo,
        beatId: expenseToEdit.beatId ? expenseToEdit.beatId.toString() : '',
        vehicleNumber: expenseToEdit.vehicleNumber || '',
        remarks: expenseToEdit.remarks || '',
        reason: '',
      });
    } else {
      reset({
        date: getTodayDateString(),
        category: 'FUEL_TRANSPORT',
        amountRupees: undefined,
        paymentMethod: 'CASH',
        paidTo: '',
        beatId: '',
        vehicleNumber: '',
        remarks: '',
        reason: '',
      });
    }
  }, [expenseToEdit, reset, isOpen]);

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const amountPaise = toPaise(data.amountRupees);
      const beatIdNum = data.beatId ? parseInt(data.beatId, 10) : undefined;

      if (isEditing && expenseToEdit?.id) {
        if (!data.reason?.trim()) {
          showToast({ type: 'error', message: 'Please provide a reason for editing this expense' });
          return;
        }

        await expenseService.update(
          expenseToEdit.id,
          {
            date: data.date,
            category: data.category as ExpenseCategoryType,
            amount: amountPaise,
            paymentMethod: data.paymentMethod as PaymentMethodType,
            paidTo: data.paidTo.trim(),
            beatId: beatIdNum,
            vehicleNumber: data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : undefined,
            remarks: data.remarks?.trim() || undefined,
          },
          data.reason.trim(),
          operatorName
        );

        showToast({
          type: 'success',
          message: `Expense ${expenseToEdit.voucherNumber} updated successfully`,
        });
      } else {
        const created = await expenseService.create(
          {
            date: data.date,
            category: data.category as ExpenseCategoryType,
            amount: amountPaise,
            paymentMethod: data.paymentMethod as PaymentMethodType,
            paidTo: data.paidTo.trim(),
            beatId: beatIdNum,
            vehicleNumber: data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : undefined,
            remarks: data.remarks?.trim() || undefined,
          },
          operatorName
        );

        showToast({
          type: 'success',
          message: `Recorded expense voucher ${created.voucherNumber}`,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save expense' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Expense Voucher #${expenseToEdit?.voucherNumber}` : 'Record Daily Business Expense'}
      subtitle="Log operational overheads, transport, fuel, DA, and maintenance for cash drawer reconciliation."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Date & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Expense Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              {...register('date')}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            {errors.date && <p className="text-[11px] text-rose-500 mt-1">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Expense Category <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('category')}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-[11px] text-rose-500 mt-1">{errors.category.message}</p>}
          </div>
        </div>

        {/* Amount & Payment Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                {...register('amountRupees', { valueAsNumber: true })}
                className="w-full pl-7 pr-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            {errors.amountRupees && <p className="text-[11px] text-rose-500 mt-1">{errors.amountRupees.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              {...register('paymentMethod')}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="CASH">💵 Cash (Deducts from Cash Drawer)</option>
              <option value="GPAY">📱 GPay / UPI</option>
              <option value="BANK_TRANSFER">🏦 Bank Transfer (NEFT/RTGS)</option>
              <option value="CHEQUE">📝 Cheque</option>
              <option value="OTHER">Other</option>
            </select>
            {errors.paymentMethod && <p className="text-[11px] text-rose-500 mt-1">{errors.paymentMethod.message}</p>}
          </div>
        </div>

        {/* Paid To / Beneficiary */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Paid To / Vendor / Beneficiary <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Driver Ravi, HP Petrol Bunk, Refreshments, Stationery..."
            {...register('paidTo')}
            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          {errors.paidTo && <p className="text-[11px] text-rose-500 mt-1">{errors.paidTo.message}</p>}
        </div>

        {/* Route Beat & Vehicle Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Linked Beat Route <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <select
              {...register('beatId')}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="">-- General / Not Beat Specific --</option>
              {beats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vehicle Reg. No. <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. TN-22-AX-1234"
              {...register('vehicleNumber')}
              className="w-full px-3 py-2 text-xs uppercase border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Remarks / Delivery Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Voucher Description / Notes <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. 15 liters diesel for van delivery route, morning tea for 4 staff..."
            {...register('remarks')}
            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        {/* Reason for Edit (Only in edit mode) */}
        {isEditing && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
              Reason for Voucher Modification <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Corrected fuel invoice receipt typo..."
              {...register('reason')}
              className="w-full px-3 py-2 text-xs border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs transition"
          >
            {isEditing ? 'Update Expense' : 'Save Expense Voucher'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
