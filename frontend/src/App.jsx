import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import AllBills from './pages/AllBills';
import NeedsReview from './pages/NeedsReview';
import UploadBill from './pages/UploadBill';
import BillDetail from './pages/BillDetail';
import { fetchStats } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [stats, setStats] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const loadStatsData = async () => {
    setIsRefreshing(true);
    setStatsError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setStatsError(err.message || 'Unable to connect to backend server');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatsData();
  }, []);

  const handleNavigate = (tab) => {
    setSelectedBillId(null);
    setCurrentTab(tab);
    loadStatsData();
  };

  const handleSelectBill = (id) => {
    setSelectedBillId(id);
    setCurrentTab('bill-detail');
  };

  const handleBillCreated = (newBill) => {
    loadStatsData();
    if (newBill?.id) {
      handleSelectBill(newBill.id);
    } else {
      handleNavigate('all-bills');
    }
  };

  const renderContent = () => {
    if (selectedBillId && currentTab === 'bill-detail') {
      return (
        <BillDetail
          billId={selectedBillId}
          onBack={() => handleNavigate('all-bills')}
          onStatusUpdated={() => loadStatsData()}
        />
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            error={statsError}
            onRetry={loadStatsData}
            onNavigate={handleNavigate}
            onSelectBill={handleSelectBill}
          />
        );
      case 'all-bills':
        return (
          <AllBills
            onSelectBill={handleSelectBill}
            onNewUpload={() => handleNavigate('upload')}
          />
        );
      case 'needs-review':
        return (
          <NeedsReview
            onSelectBill={handleSelectBill}
            onNewUpload={() => handleNavigate('upload')}
          />
        );
      case 'upload':
        return (
          <UploadBill
            onBillCreated={handleBillCreated}
            onCancel={() => handleNavigate('dashboard')}
          />
        );
      default:
        return (
          <Dashboard
            stats={stats}
            onNavigate={handleNavigate}
            onSelectBill={handleSelectBill}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Persistent Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setTab={handleNavigate}
        needsReviewCount={stats ? (stats.needs_review || 0) + (stats.duplicate || 0) : 0}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          currentTab={currentTab}
          selectedBillId={selectedBillId}
          onNewUpload={() => handleNavigate('upload')}
          onRefresh={loadStatsData}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 overflow-hidden bg-[#f8fafc]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
