import React, { useState, useEffect } from 'react';
import {
  HardDriveDownload,
  Upload,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { backupRestoreService, type BackupPayload } from '../../services/backupRestoreService';
import { db } from '../../db/database';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { formatDateTimeDisplay } from '../../utils/date';

export const BackupPage: React.FC = () => {
  const { showToast, askConfirmation, operatorName, refreshData } = useApp();

  const [tableCounts, setTableCounts] = useState<{
    beats: number;
    retailers: number;
    sales: number;
    collections: number;
    collectionAllocations: number;
    dailyBalances: number;
    auditLogs: number;
  }>({
    beats: 0,
    retailers: 0,
    sales: 0,
    collections: 0,
    collectionAllocations: 0,
    dailyBalances: 0,
    auditLogs: 0,
  });

  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  // Restore Modal State
  const [uploadedBackup, setUploadedBackup] = useState<BackupPayload | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const loadCounts = async () => {
    setTableCounts({
      beats: await db.beats.count(),
      retailers: await db.retailers.count(),
      sales: await db.sales.count(),
      collections: await db.collections.count(),
      collectionAllocations: await db.collectionAllocations.count(),
      dailyBalances: await db.dailyBalances.count(),
      auditLogs: await db.auditLogs.count(),
    });

    const settings = await db.settings.toCollection().first();
    if (settings && settings.lastBackupDate) {
      setLastBackupDate(settings.lastBackupDate);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const handleDownloadJson = async () => {
    try {
      const exportDate = await backupRestoreService.downloadJsonBackup();
      setLastBackupDate(exportDate);
      showToast({ type: 'success', message: 'Complete JSON backup downloaded successfully' });
      loadCounts();
    } catch {
      showToast({ type: 'error', message: 'Failed to generate backup JSON' });
    }
  };

  const handleDownloadExcel = async () => {
    try {
      await backupRestoreService.downloadExcelSummary();
      showToast({ type: 'success', message: 'Complete multi-sheet Excel summary exported' });
    } catch {
      showToast({ type: 'error', message: 'Failed to export Excel summary' });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = backupRestoreService.validateBackupPayload(parsed);

        if (!validation.valid) {
          showToast({
            type: 'error',
            message: `Invalid backup file: ${validation.errors.join(', ')}`,
          });
          return;
        }

        setUploadedBackup(parsed);
        setIsRestoreModalOpen(true);
      } catch {
        showToast({ type: 'error', message: 'Corrupt or unreadable JSON file' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!uploadedBackup) return;

    askConfirmation({
      title: 'Overwrite and Restore Financial Data?',
      message: `WARNING: Restoring will overwrite existing IndexedDB records with the backup dated ${formatDateTimeDisplay(
        uploadedBackup.exportDate
      )}. An emergency snapshot of your current database will be saved before proceeding.`,
      confirmText: 'Yes, Restore Now',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await backupRestoreService.restoreFromJson(uploadedBackup, operatorName);
          if (res.success) {
            showToast({
              type: 'success',
              message: 'Database restored successfully from backup!',
            });
            setIsRestoreModalOpen(false);
            setUploadedBackup(null);
            await loadCounts();
            refreshData();
          }
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Restoration failed' });
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <HardDriveDownload className="w-5 h-5 text-sky-600" />
          <span>Data Backup, Export & Disaster Recovery</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Browser IndexedDB storage is device-specific. Regularly export JSON and Excel backups to safeguard records.
        </p>
      </div>

      {/* Storage Information & Last Backup Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Storage Engine
          </span>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              IndexedDB (Dexie.js)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            High performance client-side persistent database. Operates 100% offline.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Last Backup Taken
          </span>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {formatDateTimeDisplay(lastBackupDate)}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Recommended interval: Weekly or after large batch entries.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Current Record Inventory
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {tableCounts.retailers} Retailers • {tableCounts.sales} Sales • {tableCounts.collections} Collections
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {tableCounts.dailyBalances} Day-End Balances • {tableCounts.auditLogs} Audit Trail Events
          </p>
        </div>
      </div>

      {/* Backup Actions Card */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Create & Export Manual Backup
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Save a complete copy of all normalized tables, financial transactions, and audit records to your local computer drive.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadJson}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-white font-semibold text-xs shadow-xs transition"
          >
            <FileText className="w-4 h-4 text-sky-300" />
            <span>Download Full JSON Backup (.json)</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Export Complete Excel Workbook (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Restore Card */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Restore Database from Backup
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Upload a previously generated JSON backup file to restore records. The system will preview table contents and save an emergency snapshot before proceeding.
        </p>

        <label className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-navy-600 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50">
          <Upload className="w-4 h-4 text-slate-400" />
          <span>Select JSON Backup File to Restore...</span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Restore Preview Modal */}
      {uploadedBackup && (
        <Modal
          isOpen={isRestoreModalOpen}
          onClose={() => setIsRestoreModalOpen(false)}
          title="Backup Content Preview"
          subtitle={`Export Date: ${formatDateTimeDisplay(uploadedBackup.exportDate)} • Version: ${uploadedBackup.version}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold">Important Notice:</p>
                <p className="mt-0.5">
                  Restoring will replace all current tables with the data below. An automatic pre-restore emergency copy will be preserved in browser memory.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-800 dark:text-white block uppercase text-[11px]">
                Table Record Counts in Backup:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px]">Beats</span>
                  <p className="font-bold text-slate-900 dark:text-white">{uploadedBackup.tableCounts.beats}</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px]">Retailers</span>
                  <p className="font-bold text-slate-900 dark:text-white">{uploadedBackup.tableCounts.retailers}</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px]">Sales Bills</span>
                  <p className="font-bold text-slate-900 dark:text-white">{uploadedBackup.tableCounts.sales}</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px]">Collections</span>
                  <p className="font-bold text-slate-900 dark:text-white">{uploadedBackup.tableCounts.collections}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                Proceed with Restoration
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
