import React, { useState, useEffect } from 'react';
import { db } from '../../db/database';
import { outstandingService } from '../../services/outstandingService';
import { collectionService } from '../../services/collectionService';
import { Modal } from '../../components/common/Modal';
import { formatINR } from '../../utils/money';
import { formatDateDisplay } from '../../utils/date';
import { useApp } from '../../context/AppContext';
import { BookOpen, ShoppingBag, Receipt, Scale, MapPin, Phone } from 'lucide-react';
import type { Retailer, RetailerOutstandingSummary, Sale, Collection } from '../../types';

interface RetailerDetailModalProps {
  retailerId: number;
  onClose: () => void;
}

export const RetailerDetailModal: React.FC<RetailerDetailModalProps> = ({
  retailerId,
  onClose,
}) => {
  const { openRetailerLedger } = useApp();
  const [summary, setSummary] = useState<RetailerOutstandingSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'sales' | 'collections'>('summary');

  useEffect(() => {
    const load = async () => {
      const summ = await outstandingService.getRetailerOutstanding(retailerId);
      const sList = await db.sales
        .filter((s) => !s.isVoided && s.retailerId === retailerId)
        .reverse()
        .toArray();
      const cList = await db.collections
        .filter((c) => !c.isVoided && c.retailerId === retailerId)
        .reverse()
        .toArray();

      setSummary(summ);
      setSales(sList);
      setCollections(cList);
    };
    load();
  }, [retailerId]);

  if (!summary) return null;

  const { retailer } = summary;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={retailer.retailerName}
      subtitle={`Retailer Profile & Account Snapshot (ID: RET-${retailer.id})`}
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Top Info Bar */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
              <MapPin className="w-3 h-3" />
              <span>{summary.beatName}</span>
            </span>
            <span className="flex items-center space-x-1 text-xs text-slate-600 dark:text-slate-300">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{retailer.contactNumber || 'No phone'}</span>
            </span>
          </div>

          <button
            onClick={() => {
              onClose();
              openRetailerLedger(retailer.id!);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-300" />
            <span>Open Complete Ledger</span>
          </button>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <span className="text-slate-400 font-medium">Opening Balance</span>
            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
              {formatINR(summary.openingBalance)}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <span className="text-slate-400 font-medium">Total Invoiced Sales</span>
            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
              {formatINR(summary.totalSales)}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <span className="text-slate-400 font-medium">Confirmed Collections</span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatINR(summary.totalConfirmedCollections)}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <span className="text-slate-400 font-medium">Current Outstanding</span>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {formatINR(summary.currentOutstanding)}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'summary'
                ? 'border-navy-800 text-navy-800 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'sales'
                ? 'border-navy-800 text-navy-800 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sales History ({sales.length})
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === 'collections'
                ? 'border-navy-800 text-navy-800 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Collections History ({collections.length})
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'summary' && (
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400">Address:</span>
                <p className="font-medium mt-0.5">{retailer.address || 'None provided'}</p>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <p className="font-medium mt-0.5">{retailer.status}</p>
              </div>
              <div>
                <span className="text-slate-400">Opening Balance Date:</span>
                <p className="font-medium mt-0.5">{formatDateDisplay(retailer.openingBalanceDate)}</p>
              </div>
              <div>
                <span className="text-slate-400">Last Collection Received:</span>
                <p className="font-medium mt-0.5">{formatDateDisplay(summary.lastCollectionDate)}</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Remarks:</span>
                <p className="font-medium mt-0.5">{retailer.remarks || 'No remarks recorded'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
            {sales.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No sales invoices recorded.</p>
            ) : (
              sales.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">Bill #{s.billNumber}</span>
                    <span className="text-slate-400 ml-2">({formatDateDisplay(s.date)})</span>
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300">
                      Collection Due: {formatDateDisplay(s.collectionDate || s.date)}
                    </span>
                    {s.remarks && <p className="text-[10px] text-slate-400">{s.remarks}</p>}
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white num-cell">
                    {formatINR(s.billAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
            {collections.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No collection receipts recorded.</p>
            ) : (
              collections.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">
                      Receipt #{c.collectionNumber}
                    </span>
                    <span className="text-slate-400 ml-2">({formatDateDisplay(c.date)})</span>
                    <p className="text-[10px] text-slate-400">
                      Method: <strong className="text-slate-600 dark:text-slate-300">{c.paymentMethod}</strong>
                      {c.chequeStatus && ` • Status: ${c.chequeStatus}`}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 num-cell">
                    {formatINR(c.totalAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
