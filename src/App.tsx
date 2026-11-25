import React from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { ToastContainer } from './components/common/ToastContainer';
import { ConfirmDialog } from './components/common/ConfirmDialog';

// Pages
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { BeatsPage } from './pages/Beats/BeatsPage';
import { RetailersPage } from './pages/Retailers/RetailersPage';
import { SalesPage } from './pages/Sales/SalesPage';
import { CollectionsPage } from './pages/Collections/CollectionsPage';
import { CollectionSchedulePage } from './pages/CollectionSchedule/CollectionSchedulePage';
import { ExpensePage } from './pages/Expenses/ExpensePage';
import { LedgerPage } from './pages/Ledger/LedgerPage';
import { OutstandingPage } from './pages/Outstanding/OutstandingPage';
import { DayEndPage } from './pages/DayEnd/DayEndPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { AuditPage } from './pages/Audit/AuditPage';
import { BackupPage } from './pages/Backup/BackupPage';
import { SettingsPage } from './pages/Settings/SettingsPage';

export const AppContent: React.FC = () => {
  const { currentTab } = useApp();

  const renderActivePage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'beats':
        return <BeatsPage />;
      case 'retailers':
        return <RetailersPage />;
      case 'sales':
        return <SalesPage />;
      case 'collections':
        return <CollectionsPage />;
      case 'collectionSchedule':
        return <CollectionSchedulePage />;
      case 'expenses':
        return <ExpensePage />;
      case 'ledger':
        return <LedgerPage />;
      case 'outstanding':
        return <OutstandingPage />;
      case 'dayEnd':
        return <DayEndPage />;
      case 'reports':
        return <ReportsPage />;
      case 'audit':
        return <AuditPage />;
      case 'backup':
        return <BackupPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {renderActivePage()}
          </div>
        </main>
      </div>

      {/* Global Toast Notifications & Confirm Modals */}
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
};

export default AppContent;
