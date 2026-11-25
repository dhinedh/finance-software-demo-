import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  Store,
  ShoppingCart,
  Banknote,
  CalendarClock,
  Receipt,
  BookOpen,
  Scale,
  CalendarCheck2,
  FileBarChart2,
  History,
  HardDriveDownload,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp, type NavTab } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const { currentTab, setCurrentTab, isOnline } = useApp();

  const navItems: { tab: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { tab: 'beats', label: 'Beat Master', icon: MapPin },
    { tab: 'retailers', label: 'Retailers Master', icon: Store },
    { tab: 'sales', label: 'Daily Sales Entry', icon: ShoppingCart },
    { tab: 'collections', label: 'Collection Entry', icon: Banknote },
    { tab: 'collectionSchedule', label: 'Collection Schedule', icon: CalendarClock },
    { tab: 'expenses', label: 'Daily Expenses', icon: Receipt },
    { tab: 'ledger', label: 'Retailer Ledger', icon: BookOpen },
    { tab: 'outstanding', label: 'Outstanding Mgmt', icon: Scale },
    { tab: 'dayEnd', label: 'Day-End Verify', icon: CalendarCheck2 },
    { tab: 'reports', label: 'Financial Reports', icon: FileBarChart2 },
    { tab: 'audit', label: 'Audit Trail', icon: History },
    { tab: 'backup', label: 'Backup & Restore', icon: HardDriveDownload },
    { tab: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-navy-950 text-slate-300 flex flex-col flex-shrink-0 h-screen select-none border-r border-navy-900 sticky top-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-navy-900 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-navy-700 flex items-center justify-center text-white font-bold shadow-md">
          <ShieldCheck className="w-6 h-6 text-sky-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide uppercase">RetailFinance</h1>
          <p className="text-xs text-sky-300 font-medium">Internal Audit ERP</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => setCurrentTab(item.tab)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-navy-800 text-white font-semibold shadow-sm border-l-4 border-sky-400'
                  : 'text-slate-400 hover:text-white hover:bg-navy-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Offline / Storage Status Footer */}
      <div className="p-3 border-t border-navy-900 text-xs bg-navy-950/80">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="flex items-center space-x-1.5">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] text-amber-400">Offline Mode</span>
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-400">Dexie IndexedDB</span>
        </div>
        <p className="text-[10px] text-slate-400 truncate">Local persistent storage active</p>
      </div>
    </aside>
  );
};
