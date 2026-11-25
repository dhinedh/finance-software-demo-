import React, { useState, useEffect } from 'react';
import { Settings, Save, Database, Trash2, ShieldCheck, User } from 'lucide-react';
import { db } from '../../db/database';
import { seedService } from '../../services/seedService';
import { useApp } from '../../context/AppContext';
import type { AppSettings } from '../../types';

export const SettingsPage: React.FC = () => {
  const {
    operatorName,
    setOperatorName,
    businessName,
    showToast,
    askConfirmation,
    refreshData,
  } = useApp();

  const [formBusinessName, setFormBusinessName] = useState(businessName);
  const [formOperatorName, setFormOperatorName] = useState(operatorName);
  const [formYearStart, setFormYearStart] = useState('2024-04-01');
  const [formReminderDays, setFormReminderDays] = useState(7);

  useEffect(() => {
    const load = async () => {
      const s = await db.settings.toCollection().first();
      if (s) {
        setFormBusinessName(s.businessName);
        setFormOperatorName(s.operatorName);
        setFormYearStart(s.financialYearStart);
        setFormReminderDays(s.backupReminderDays || 7);
      }
    };
    load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = await db.settings.toCollection().first();
      const payload: AppSettings = {
        businessName: formBusinessName.trim(),
        operatorName: formOperatorName.trim(),
        financialYearStart: formYearStart,
        backupReminderDays: Number(formReminderDays),
        theme: 'light',
      };

      if (existing && existing.id) {
        await db.settings.update(existing.id, payload);
      } else {
        await db.settings.add(payload);
      }

      setOperatorName(formOperatorName.trim());
      showToast({ type: 'success', message: 'Application settings saved successfully' });
    } catch {
      showToast({ type: 'error', message: 'Failed to update settings' });
    }
  };

  const handleSeedDemoData = () => {
    askConfirmation({
      title: 'Load Realistic Demo Dataset?',
      message: 'This will seed 20 retailers across 5 beats with historical sales bills and partial/full collections for testing.',
      confirmText: 'Seed Demo Data',
      onConfirm: async () => {
        try {
          const res = await seedService.seedDemoData();
          showToast({
            type: 'success',
            message: `Loaded ${res.retailers} retailers, ${res.sales} sales, ${res.collections} collections!`,
          });
          refreshData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Seeding failed' });
        }
      },
    });
  };

  const handlePurgeAllData = () => {
    askConfirmation({
      title: 'Purge All Transactional Data?',
      message: 'CAUTION: This will delete all retailer accounts, sales bills, collection receipts, and day-end records to prepare the application for real business production data. Master beats and settings will be preserved.',
      confirmText: 'Purge All Data',
      isDanger: true,
      onConfirm: async () => {
        try {
          await seedService.purgeDemoData();
          showToast({
            type: 'info',
            message: 'All transactional and demo records purged. Ready for fresh production data.',
          });
          refreshData();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Purge failed' });
        }
      },
    });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Settings className="w-5 h-5 text-sky-600" />
          <span>System & Business Profile Settings</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure agency metadata, operator identity, financial periods, and demo data utilities.
        </p>
      </div>

      {/* Business & Operator Profile Form */}
      <form onSubmit={handleSaveSettings} className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
          Business & Operator Identity
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Distribution Agency Business Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formBusinessName}
              onChange={(e) => setFormBusinessName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Active Operator / Owner Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formOperatorName}
              onChange={(e) => setFormOperatorName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Recorded in the audit trail for all sales and collections.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Financial Year Start Date
            </label>
            <input
              type="date"
              value={formYearStart}
              onChange={(e) => setFormYearStart(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Backup Reminder Interval (Days)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={formReminderDays}
              onChange={(e) => setFormReminderDays(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
          >
            <Save className="w-3.5 h-3.5 text-sky-300" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Production Data Reset Utilities */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
          Production Data Reset
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Wipe out all transactional records, retailers, sales, and collections for a clean production start. Master beats and settings are preserved.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePurgeAllData}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Purge All Records (Clean Production Start)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
