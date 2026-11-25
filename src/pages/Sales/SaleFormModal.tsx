import React, { useState, useEffect } from 'react';
import { salesService } from '../../services/salesService';
import { beatService } from '../../services/beatService';
import { Modal } from '../../components/common/Modal';
import { RetailerAutocomplete } from '../../components/common/RetailerAutocomplete';
import { formatINR, toPaise, toRupees } from '../../utils/money';
import { getTodayDateString, getDefaultCollectionDate } from '../../utils/date';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, MapPin, Calculator } from 'lucide-react';
import type { Sale, Retailer } from '../../types';

interface SaleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingSale?: Sale | null;
}

export const SaleFormModal: React.FC<SaleFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingSale,
}) => {
  const { showToast, operatorName } = useApp();

  const [date, setDate] = useState<string>(getTodayDateString());
  const [collectionDate, setCollectionDate] = useState<string>(getDefaultCollectionDate(getTodayDateString()));
  const [billNumber, setBillNumber] = useState<string>('');
  const [retailerId, setRetailerId] = useState<number | undefined>(undefined);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [beatName, setBeatName] = useState<string>('');
  const [billAmount, setBillAmount] = useState<string>('');
  const [gstAmount, setGstAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [updateReason, setUpdateReason] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);

  useEffect(() => {
    if (editingSale) {
      setDate(editingSale.date);
      setCollectionDate(editingSale.collectionDate || getDefaultCollectionDate(editingSale.date));
      setBillNumber(editingSale.billNumber);
      setRetailerId(editingSale.retailerId);
      setBillAmount(toRupees(editingSale.billAmount).toString());
      setGstAmount(editingSale.gstAmount ? toRupees(editingSale.gstAmount).toString() : '');
      setRemarks(editingSale.remarks || '');
      setUpdateReason('');
      setDuplicateWarning(false);
    } else {
      const today = getTodayDateString();
      setDate(today);
      setCollectionDate(getDefaultCollectionDate(today));
      setBillNumber('');
      setRetailerId(undefined);
      setSelectedRetailer(null);
      setBeatName('');
      setBillAmount('');
      setGstAmount('');
      setRemarks('');
      setUpdateReason('');
      setDuplicateWarning(false);
    }
  }, [editingSale, isOpen]);

  const handleSalesDateChange = (newDate: string) => {
    setDate(newDate);
    // Keep collection date defaulted to 7 days after the selected sales date
    setCollectionDate(getDefaultCollectionDate(newDate));
  };

  // Check duplicate bill number
  useEffect(() => {
    const checkDup = async () => {
      if (billNumber.trim() && retailerId) {
        const isDup = await salesService.checkDuplicateBill(
          billNumber,
          retailerId,
          editingSale?.id
        );
        setDuplicateWarning(isDup);
      } else {
        setDuplicateWarning(false);
      }
    };
    checkDup();
  }, [billNumber, retailerId, editingSale]);

  const handleRetailerSelect = async (id: number, ret: Retailer) => {
    setRetailerId(id);
    setSelectedRetailer(ret);
    const beat = await beatService.getById(ret.beatId);
    setBeatName(beat ? beat.name : 'Unknown Beat');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!retailerId) {
      showToast({ type: 'error', message: 'Please select a retailer' });
      return;
    }
    if (!billNumber.trim()) {
      showToast({ type: 'error', message: 'Bill number is required' });
      return;
    }
    const paise = toPaise(billAmount);
    if (paise <= 0) {
      showToast({ type: 'error', message: 'Bill amount must be greater than zero' });
      return;
    }

    try {
      if (editingSale) {
        if (!updateReason.trim()) {
          showToast({ type: 'error', message: 'A reason is required to edit a financial transaction' });
          return;
        }

        await salesService.update(
          editingSale.id!,
          {
            date,
            collectionDate,
            billNumber: billNumber.trim(),
            retailerId,
            billAmount: paise,
            gstAmount: gstAmount ? toPaise(gstAmount) : undefined,
            remarks: remarks.trim(),
          },
          updateReason.trim(),
          operatorName
        );
        showToast({ type: 'success', message: `Sale Bill #${billNumber} updated successfully` });
      } else {
        await salesService.create(
          {
            date,
            collectionDate,
            billNumber: billNumber.trim(),
            retailerId,
            billAmount: paise,
            gstAmount: gstAmount ? toPaise(gstAmount) : undefined,
            remarks: remarks.trim(),
          },
          operatorName
        );
        showToast({ type: 'success', message: `Sales Bill #${billNumber} recorded successfully` });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save sales transaction' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSale ? `Edit Sales Bill #${editingSale.billNumber}` : 'Record Daily Sales Entry'}
      subtitle="Manual entry to independently verify external billing records"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sales Date, Collection Date & Bill Number */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sales Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => handleSalesDateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Collection Date <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">+7 Days Cycle</span>
            </label>
            <input
              type="date"
              required
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bill / Invoice Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="e.g. INV-1001"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600 font-mono"
            />
            {duplicateWarning && (
              <p className="flex items-center space-x-1 text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>Notice: Bill #{billNumber} already exists for this retailer!</span>
              </p>
            )}
          </div>
        </div>

        {/* Retailer Autocomplete */}
        <div>
          <RetailerAutocomplete
            value={retailerId}
            onChange={handleRetailerSelect}
            autoFocus={!editingSale}
          />
        </div>

        {/* Auto Populated Beat */}
        {beatName && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-500">Auto-populated Beat:</span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              <MapPin className="w-3 h-3" />
              <span>{beatName}</span>
            </span>
          </div>
        )}

        {/* Bill Amount & GST Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Total Bill Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600 font-bold"
              />
              <span className="absolute left-2.5 top-2 text-xs text-slate-400">₹</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Enter the full invoice amount inclusive of all taxes.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GST Amount (₹) <span className="text-slate-400 font-normal">(Optional breakdown)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
              <span className="absolute left-2.5 top-2 text-xs text-slate-400">₹</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              GST is informational only; not added again to total.
            </p>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Remarks / Delivery Notes
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Driver name, route notes, order specifics..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
          />
        </div>

        {/* Audit Reason if Editing */}
        {editingSale && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
              Reason for Bill Modification <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={updateReason}
              onChange={(e) => setUpdateReason(e.target.value)}
              placeholder="e.g. Corrected invoice price typo from billing voucher..."
              className="w-full px-3 py-1.5 text-xs rounded-md border border-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        )}

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
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
          >
            {editingSale ? 'Update Sales Bill' : 'Record Sales Bill'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
