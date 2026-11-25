import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
  const { confirmModal, closeConfirmation } = useApp();

  if (!confirmModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden transform transition-all animate-in zoom-in-95">
        <div className="p-5">
          <div className="flex items-center space-x-3 mb-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                confirmModal.isDanger
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
              }`}
            >
              {confirmModal.isDanger ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {confirmModal.title}
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {confirmModal.message}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-2">
          <button
            onClick={closeConfirmation}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            {confirmModal.cancelText || 'Cancel'}
          </button>
          <button
            onClick={async () => {
              const action = confirmModal.onConfirm;
              closeConfirmation();
              await action();
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white shadow-xs ${
              confirmModal.isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-navy-800 hover:bg-navy-700'
            }`}
          >
            {confirmModal.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
