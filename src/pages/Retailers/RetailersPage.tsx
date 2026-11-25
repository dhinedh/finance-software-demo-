import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Edit2,
  BookOpen,
  MapPin,
  CheckCircle,
  XCircle,
  Eye,
  Phone,
} from 'lucide-react';
import { retailerService } from '../../services/retailerService';
import { beatService } from '../../services/beatService';
import { outstandingService } from '../../services/outstandingService';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { DataTable, type Column } from '../../components/common/DataTable';
import { formatINR, toPaise, toRupees } from '../../utils/money';
import { formatDateDisplay, getTodayDateString } from '../../utils/date';
import type { Retailer, Beat, RetailerOutstandingSummary } from '../../types';
import { RetailerDetailModal } from './RetailerDetailModal';

export const RetailersPage: React.FC = () => {
  const { showToast, askConfirmation, openRetailerLedger } = useApp();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatMap, setBeatMap] = useState<Map<number, string>>(new Map());
  const [outstandingMap, setOutstandingMap] = useState<Map<number, RetailerOutstandingSummary>>(new Map());
  const [selectedBeatFilter, setSelectedBeatFilter] = useState<number | 'all'>('all');

  // Detail Modal
  const [detailRetailerId, setDetailRetailerId] = useState<number | null>(null);

  // Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<Retailer | null>(null);
  const [formName, setFormName] = useState('');
  const [formBeatId, setFormBeatId] = useState<number>(0);
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOpeningBalance, setFormOpeningBalance] = useState<string>('0');
  const [formOpeningDate, setFormOpeningDate] = useState<string>(getTodayDateString());
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formRemarks, setFormRemarks] = useState('');
  const [formReason, setFormReason] = useState('');

  const loadData = async () => {
    const retList = await retailerService.getAll();
    const beatList = await beatService.getAll();
    const map = new Map<number, string>();
    beatList.forEach((b) => map.set(b.id!, b.name));

    setRetailers(retList);
    setBeats(beatList);
    setBeatMap(map);

    const summaries = await outstandingService.getAllRetailersOutstanding();
    const outMap = new Map<number, RetailerOutstandingSummary>();
    summaries.forEach((s) => outMap.set(s.retailer.id!, s));
    setOutstandingMap(outMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingRetailer(null);
    setFormName('');
    setFormBeatId(beats.length > 0 ? beats[0].id! : 0);
    setFormAddress('');
    setFormPhone('');
    setFormOpeningBalance('0');
    setFormOpeningDate(getTodayDateString());
    setFormStatus('ACTIVE');
    setFormRemarks('');
    setFormReason('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ret: Retailer) => {
    setEditingRetailer(ret);
    setFormName(ret.retailerName);
    setFormBeatId(ret.beatId);
    setFormAddress(ret.address);
    setFormPhone(ret.contactNumber);
    setFormOpeningBalance(toRupees(ret.openingBalance).toString());
    setFormOpeningDate(ret.openingBalanceDate);
    setFormStatus(ret.status);
    setFormRemarks(ret.remarks || '');
    setFormReason('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast({ type: 'error', message: 'Retailer name is required' });
      return;
    }
    if (!formBeatId) {
      showToast({ type: 'error', message: 'Please select a valid beat' });
      return;
    }

    const openingPaise = toPaise(formOpeningBalance);

    try {
      if (editingRetailer) {
        const openingChanged = openingPaise !== editingRetailer.openingBalance;
        if (openingChanged && !formReason.trim()) {
          showToast({
            type: 'error',
            message: 'A reason is required when modifying opening balance for audit tracking',
          });
          return;
        }

        await retailerService.update(
          editingRetailer.id!,
          {
            retailerName: formName.trim(),
            beatId: formBeatId,
            address: formAddress.trim(),
            contactNumber: formPhone.trim(),
            openingBalance: openingPaise,
            openingBalanceDate: formOpeningDate,
            status: formStatus,
            remarks: formRemarks.trim(),
          },
          formReason.trim() || 'Retailer master update'
        );
        showToast({ type: 'success', message: 'Retailer updated successfully' });
      } else {
        await retailerService.create({
          retailerName: formName.trim(),
          beatId: formBeatId,
          address: formAddress.trim(),
          contactNumber: formPhone.trim(),
          openingBalance: openingPaise,
          openingBalanceDate: formOpeningDate,
          status: formStatus,
          remarks: formRemarks.trim(),
        });
        showToast({ type: 'success', message: 'Retailer registered successfully' });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save retailer' });
    }
  };

  const handleToggleStatus = (ret: Retailer) => {
    const newStatus = ret.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    askConfirmation({
      title: `${newStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} Retailer?`,
      message: `Change active status of "${ret.retailerName}" to ${newStatus}?`,
      confirmText: 'Yes, change status',
      onConfirm: async () => {
        await retailerService.toggleStatus(ret.id!);
        showToast({ type: 'info', message: `Retailer status updated to ${newStatus}` });
        loadData();
      },
    });
  };

  const filteredRetailers = retailers.filter((r) => {
    if (selectedBeatFilter === 'all') return true;
    return r.beatId === selectedBeatFilter;
  });

  const columns: Column<Retailer>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (row) => <span className="font-mono text-slate-500">RET-{row.id}</span>,
    },
    {
      key: 'retailerName',
      header: 'Retailer Name',
      render: (row) => (
        <div>
          <button
            onClick={() => setDetailRetailerId(row.id!)}
            className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 text-left"
          >
            {row.retailerName}
          </button>
          {row.address && (
            <p className="text-[10px] text-slate-400 truncate max-w-xs">{row.address}</p>
          )}
        </div>
      ),
    },
    {
      key: 'beatId',
      header: 'Assigned Beat',
      render: (row) => (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          <MapPin className="w-2.5 h-2.5" />
          <span>{beatMap.get(row.beatId) || 'Unknown Beat'}</span>
        </span>
      ),
    },
    {
      key: 'contactNumber',
      header: 'Contact',
      render: (row) => (
        <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 text-xs">
          <Phone className="w-3 h-3 text-slate-400" />
          <span>{row.contactNumber || '-'}</span>
        </span>
      ),
    },
    {
      key: 'openingBalance',
      header: 'Opening Bal',
      align: 'right',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {formatINR(row.openingBalance)}
          </span>
          <p className="text-[10px] text-slate-400">{formatDateDisplay(row.openingBalanceDate)}</p>
        </div>
      ),
    },
    {
      key: 'currentOutstanding',
      header: 'Current Outstanding',
      align: 'right',
      render: (row) => {
        const out = outstandingMap.get(row.id!)?.currentOutstanding || 0;
        return (
          <span
            className={`font-bold ${
              out > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {formatINR(out)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <button
          onClick={() => handleToggleStatus(row)}
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
            row.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {row.status === 'ACTIVE' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          <span>{row.status}</span>
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => setDetailRetailerId(row.id!)}
            title="View Details & History"
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openRetailerLedger(row.id!)}
            title="Open Retailer Ledger"
            className="p-1 rounded-md text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            title="Edit Retailer"
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Store className="w-5 h-5 text-sky-600" />
            <span>Retailer Master Directory</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage ~300 retail accounts, credit balances, and beat assignments.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Beat Filter Dropdown */}
          <select
            value={selectedBeatFilter}
            onChange={(e) =>
              setSelectedBeatFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs"
          >
            <option value="all">All Beats ({retailers.length} Retailers)</option>
            {beats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-sky-300" />
            <span>+ Add Retailer</span>
          </button>
        </div>
      </div>

      {/* Retailers DataTable */}
      <DataTable
        columns={columns}
        data={filteredRetailers}
        searchPlaceholder="Search by retailer name or phone..."
        emptyMessage="No retailers found matching your filter."
      />

      {/* Add / Edit Retailer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRetailer ? `Edit Retailer: ${editingRetailer.retailerName}` : 'Add New Retailer'}
        subtitle="Historical transactions maintain beat at transaction even if beat is reassigned"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Retailer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Sri Murugan Stores..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Beat <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formBeatId}
                onChange={(e) => setFormBeatId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              >
                <option value={0}>Select a Beat</option>
                {beats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. 9840112233"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Shop Address / Location
              </label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Door no, street name, area..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Opening Outstanding Balance (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formOpeningBalance}
                onChange={(e) => setFormOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Opening Balance Date
              </label>
              <input
                type="date"
                value={formOpeningDate}
                onChange={(e) => setFormOpeningDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
            </div>

            {editingRetailer &&
              toPaise(formOpeningBalance) !== editingRetailer.openingBalance && (
                <div className="md:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg">
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                    Reason for Opening Balance Correction <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="Provide reason for financial audit trail..."
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks / Credit Terms
              </label>
              <input
                type="text"
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                placeholder="Optional notes or remarks..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
            >
              {editingRetailer ? 'Update Retailer' : 'Save Retailer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Retailer Detail & History Modal */}
      {detailRetailerId && (
        <RetailerDetailModal
          retailerId={detailRetailerId}
          onClose={() => setDetailRetailerId(null)}
        />
      )}
    </div>
  );
};
