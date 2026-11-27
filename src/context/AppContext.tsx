import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/database';
import { seedService } from '../services/seedService';
import type { AppSettings } from '../types';

export type NavTab =
  | 'dashboard'
  | 'beats'
  | 'retailers'
  | 'sales'
  | 'collections'
  | 'collectionSchedule'
  | 'expenses'
  | 'ledger'
  | 'outstanding'
  | 'dayEnd'
  | 'reports'
  | 'audit'
  | 'backup'
  | 'settings';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface AppContextType {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  selectedRetailerId?: number;
  openRetailerLedger: (retailerId: number) => void;
  operatorName: string;
  setOperatorName: (name: string) => void;
  businessName: string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  confirmModal: ConfirmOptions | null;
  askConfirmation: (options: ConfirmOptions) => void;
  closeConfirmation: () => void;
  isOnline: boolean;
  backupReminderNeeded: boolean;
  reloadTrigger: number;
  refreshData: () => void;
  isSaleModalOpen: boolean;
  setIsSaleModalOpen: (open: boolean) => void;
  openSaleModal: () => void;
  isCollectionModalOpen: boolean;
  setIsCollectionModalOpen: (open: boolean) => void;
  openCollectionModal: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedRetailerId, setSelectedRetailerId] = useState<number | undefined>(undefined);
  const [operatorName, setOperatorName] = useState<string>('S. Ramanathan (Owner)');
  const [businessName, setBusinessName] = useState<string>('Sri Balaji Distribution Agency');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [backupReminderNeeded, setBackupReminderNeeded] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState<boolean>(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState<boolean>(false);

  const openSaleModal = () => {
    setCurrentTab('sales');
    setIsSaleModalOpen(true);
  };

  const openCollectionModal = () => {
    setCurrentTab('collections');
    setIsCollectionModalOpen(true);
  };

  const refreshData = () => {
    setReloadTrigger((prev) => prev + 1);
  };

  const openRetailerLedger = (retailerId: number) => {
    setSelectedRetailerId(retailerId);
    setCurrentTab('ledger');
  };

  // Initialize DB and settings
  useEffect(() => {
    const init = async () => {
      await seedService.ensureBaseConfig();

      // Auto-populate demo dataset on initial application start if empty
      const retailerCount = await db.retailers.count();
      const hasPurged = localStorage.getItem('retailfinance_has_purged') === 'true';
      if (retailerCount === 0 && !hasPurged) {
        await seedService.seedDemoData();
        setReloadTrigger((prev) => prev + 1);
      }

      const settings = await db.settings.toCollection().first();
      if (settings) {
        if (settings.operatorName) setOperatorName(settings.operatorName);
        if (settings.businessName) setBusinessName(settings.businessName);
        if (settings.theme) setTheme(settings.theme);

        // Check backup reminder
        if (settings.lastBackupDate) {
          const diffDays = (new Date().getTime() - new Date(settings.lastBackupDate).getTime()) / (1000 * 3600 * 24);
          if (diffDays >= (settings.backupReminderDays || 7)) {
            setBackupReminderNeeded(true);
          }
        } else {
          setBackupReminderNeeded(true);
        }
      }
    };
    init();

    // Online/offline listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Apply stored theme
    const storedTheme = localStorage.getItem('retailFinance_theme') as 'light' | 'dark' | null;
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle('dark', storedTheme === 'dark');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('retailFinance_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const askConfirmation = (options: ConfirmOptions) => {
    setConfirmModal(options);
  };

  const closeConfirmation = () => {
    setConfirmModal(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        selectedRetailerId,
        openRetailerLedger,
        operatorName,
        setOperatorName,
        businessName,
        theme,
        toggleTheme,
        toasts,
        showToast,
        removeToast,
        confirmModal,
        askConfirmation,
        closeConfirmation,
        isOnline,
        backupReminderNeeded,
        reloadTrigger,
        refreshData,
        isSaleModalOpen,
        setIsSaleModalOpen,
        openSaleModal,
        isCollectionModalOpen,
        setIsCollectionModalOpen,
        openCollectionModal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
