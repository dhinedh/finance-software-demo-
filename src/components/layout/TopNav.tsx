import React from 'react';
import {
  Sun,
  Moon,
  AlertTriangle,
  User,
  PlusCircle,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/date';

export const TopNav: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    operatorName,
    businessName,
    theme,
    toggleTheme,
    backupReminderNeeded,
    refreshData,
    openSaleModal,
    openCollectionModal,
  } = useApp();

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-14 px-6 flex items-center justify-between shadow-xs sticky top-0 z-20">
      {/* Title & Date */}
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white capitalize">
            {businessName}
          </h2>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Date: <strong className="text-slate-700 dark:text-slate-200">{formatDateDisplay(todayStr)}</strong></span>
            <span>•</span>
            <span className="text-sky-600 dark:text-sky-400 font-medium">Beat Sales Verification</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Backup Reminder Banner Button */}
        {backupReminderNeeded && (
          <button
            onClick={() => setCurrentTab('backup')}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Backup Due</span>
          </button>
        )}

        {/* Quick Action: New Sale */}
        <button
          onClick={openSaleModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-white shadow-xs transition"
        >
          <PlusCircle className="w-3.5 h-3.5 text-sky-300" />
          <span>New Sale</span>
        </button>

        {/* Quick Action: New Collection */}
        <button
          onClick={openCollectionModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs transition"
        >
          <Receipt className="w-3.5 h-3.5 text-emerald-200" />
          <span>New Collection</span>
        </button>

        {/* Refresh Data */}
        <button
          onClick={refreshData}
          title="Refresh view"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle Theme"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Operator Badge */}
        <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="w-7 h-7 rounded-full bg-navy-100 dark:bg-navy-900 text-navy-800 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              {operatorName}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Operator</p>
          </div>
        </div>
      </div>
    </header>
  );
};
