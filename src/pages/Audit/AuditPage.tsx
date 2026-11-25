import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldAlert, ArrowRight, User } from 'lucide-react';
import { auditService } from '../../services/auditService';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { formatDateTimeDisplay } from '../../utils/date';
import type { AuditLog, EntityType, AuditActionType } from '../../types';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<EntityType | 'all'>('all');
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    const list = await auditService.getLogs({
      entityType: selectedEntityFilter === 'all' ? undefined : selectedEntityFilter,
    });
    setLogs(list);
  };

  useEffect(() => {
    loadLogs();
  }, [selectedEntityFilter]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (row) => (
        <span className="font-mono text-slate-500 whitespace-nowrap">
          {formatDateTimeDisplay(row.timestamp)}
        </span>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity / Target',
      render: (row) => {
        const colors = {
          SALE: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
          COLLECTION: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
          RETAILER: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
          BEAT: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
          DAILY_BALANCE: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          SETTINGS: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
          EXPENSE: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
        };
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              colors[row.entityType] || colors.SETTINGS
            }`}
          >
            {row.entityType} #{row.entityId}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => {
        const actionBadges = {
          CREATE: 'text-emerald-600 font-bold',
          UPDATE: 'text-sky-600 font-bold',
          VOID: 'text-rose-600 font-bold',
          RESTORE: 'text-indigo-600 font-bold',
          CORRECTION: 'text-amber-600 font-bold',
        };
        return (
          <span className={`text-xs ${actionBadges[row.action] || 'text-slate-600'}`}>
            {row.action}
          </span>
        );
      },
    },
    {
      key: 'reason',
      header: 'Reason / Description',
      render: (row) => (
        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-sm block">
          {row.reason}
        </span>
      ),
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (row) => (
        <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-300">
          <User className="w-3 h-3 text-slate-400" />
          <span>{row.operator}</span>
        </span>
      ),
    },
    {
      key: 'inspect',
      header: 'Diff',
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          onClick={() => setInspectLog(row)}
          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          View Values
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-sky-600" />
            <span>Audit Trail & Financial Action History</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable tracking for all sales invoices, collection edits, void actions, and balance corrections.
          </p>
        </div>

        {/* Entity Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500">Filter Entity:</span>
          <select
            value={selectedEntityFilter}
            onChange={(e) => setSelectedEntityFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs"
          >
            <option value="all">All Audit Events</option>
            <option value="SALE">Sales Bills</option>
            <option value="COLLECTION">Collections</option>
            <option value="RETAILER">Retailers Master</option>
            <option value="DAILY_BALANCE">Day-End Balances</option>
            <option value="BEAT">Beats Master</option>
            <option value="SETTINGS">System Settings & Backups</option>
          </select>
        </div>
      </div>

      {/* Audit DataTable */}
      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Search reason, operator or action..."
        emptyMessage="No audit logs recorded for this filter."
      />

      {/* Inspect Values Diff Modal */}
      {inspectLog && (
        <Modal
          isOpen={true}
          onClose={() => setInspectLog(null)}
          title={`Audit Record #${inspectLog.id}: ${inspectLog.action} on ${inspectLog.entityType}`}
          subtitle={`By ${inspectLog.operator} at ${formatDateTimeDisplay(inspectLog.timestamp)}`}
          maxWidth="3xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">Reason:</span>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{inspectLog.reason}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1.5 uppercase text-[11px]">
                  Previous State (Old Value)
                </span>
                <pre className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-[11px] overflow-x-auto max-h-64">
                  {inspectLog.oldValue
                    ? JSON.stringify(JSON.parse(inspectLog.oldValue), null, 2)
                    : 'None (Record was created)'}
                </pre>
              </div>

              <div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1.5 uppercase text-[11px]">
                  New State (Updated Value)
                </span>
                <pre className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-[11px] overflow-x-auto max-h-64">
                  {inspectLog.newValue
                    ? JSON.stringify(JSON.parse(inspectLog.newValue), null, 2)
                    : 'None (Record was voided)'}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
