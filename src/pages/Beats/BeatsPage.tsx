import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Users, CheckCircle, XCircle } from 'lucide-react';
import { beatService } from '../../services/beatService';
import { retailerService } from '../../services/retailerService';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { DataTable, type Column } from '../../components/common/DataTable';
import type { Beat, Retailer } from '../../types';

export const BeatsPage: React.FC = () => {
  const { showToast, askConfirmation, openRetailerLedger } = useApp();
  const [beats, setBeats] = useState<Beat[]>([]);
  const [retailersCountMap, setRetailersCountMap] = useState<Map<number, number>>(new Map());
  const [selectedBeatRetailers, setSelectedBeatRetailers] = useState<{ beat: Beat; retailers: Retailer[] } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBeat, setEditingBeat] = useState<Beat | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const loadData = async () => {
    const list = await beatService.getAll();
    setBeats(list);

    const counts = new Map<number, number>();
    for (const b of list) {
      const rets = await retailerService.getByBeat(b.id!);
      counts.set(b.id!, rets.length);
    }
    setRetailersCountMap(counts);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingBeat(null);
    setFormName('');
    setFormDescription('');
    setFormStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (beat: Beat) => {
    setEditingBeat(beat);
    setFormName(beat.name);
    setFormDescription(beat.description);
    setFormStatus(beat.status);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast({ type: 'error', message: 'Beat name is required' });
      return;
    }

    try {
      if (editingBeat) {
        await beatService.update(editingBeat.id!, {
          name: formName.trim(),
          description: formDescription.trim(),
          status: formStatus,
        });
        showToast({ type: 'success', message: 'Beat updated successfully' });
      } else {
        await beatService.create({
          name: formName.trim(),
          description: formDescription.trim(),
          status: formStatus,
        });
        showToast({ type: 'success', message: 'Beat created successfully' });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save beat' });
    }
  };

  const handleToggleStatus = (beat: Beat) => {
    const newStatus = beat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    askConfirmation({
      title: `${newStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} Beat?`,
      message: `Are you sure you want to change status of ${beat.name} to ${newStatus}?`,
      confirmText: 'Yes, change status',
      onConfirm: async () => {
        await beatService.update(beat.id!, { status: newStatus });
        showToast({ type: 'info', message: `Beat status set to ${newStatus}` });
        loadData();
      },
    });
  };

  const handleViewRetailers = async (beat: Beat) => {
    const rets = await retailerService.getByBeat(beat.id!);
    setSelectedBeatRetailers({ beat, retailers: rets });
  };

  const columns: Column<Beat>[] = [
    {
      key: 'id',
      header: 'Beat ID',
      render: (row) => <span className="font-mono text-slate-500">BEAT-{row.id}</span>,
    },
    {
      key: 'name',
      header: 'Beat Name',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span className="font-bold text-slate-900 dark:text-white">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.description || '-'}</span>,
    },
    {
      key: 'retailers',
      header: 'Assigned Retailers',
      align: 'center',
      render: (row) => {
        const count = retailersCountMap.get(row.id!) || 0;
        return (
          <button
            onClick={() => handleViewRetailers(row)}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-navy-50 text-navy-800 dark:bg-navy-900 dark:text-sky-300 hover:bg-navy-100"
          >
            <Users className="w-3 h-3" />
            <span>{count} Retailers</span>
          </button>
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
          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
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
        <button
          onClick={() => handleOpenEdit(row)}
          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-sky-600" />
            <span>Geographical Beat Management</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage distribution beats, geographical routes, and retailer clusters.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs transition"
        >
          <Plus className="w-4 h-4 text-sky-300" />
          <span>+ Add Beat</span>
        </button>
      </div>

      {/* Beats DataTable */}
      <DataTable
        columns={columns}
        data={beats}
        searchPlaceholder="Search beats..."
        emptyMessage="No beats defined. Add a beat to start grouping retailers."
      />

      {/* Add / Edit Beat Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBeat ? `Edit Beat: ${editingBeat.name}` : 'Create New Geographical Beat'}
        subtitle="Beats cannot be permanently deleted once historical transactions exist"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Beat Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Bazaar Beat, Gandhi Road Beat..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-navy-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Area Route
            </label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Area landmarks, streets, routes included in this beat..."
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
              {editingBeat ? 'Update Beat' : 'Create Beat'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Beat Retailers List Modal */}
      {selectedBeatRetailers && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBeatRetailers(null)}
          title={`Retailers assigned to ${selectedBeatRetailers.beat.name}`}
          subtitle={`${selectedBeatRetailers.retailers.length} retailers in this beat`}
          maxWidth="2xl"
        >
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedBeatRetailers.retailers.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No retailers currently assigned to this beat.
              </p>
            ) : (
              selectedBeatRetailers.retailers.map((ret) => (
                <div
                  key={ret.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {ret.retailerName}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {ret.contactNumber} • {ret.address}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBeatRetailers(null);
                      openRetailerLedger(ret.id!);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-navy-50 text-navy-800 dark:bg-navy-900 dark:text-sky-300 border border-navy-200 dark:border-navy-800 hover:bg-navy-100"
                  >
                    View Ledger
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
