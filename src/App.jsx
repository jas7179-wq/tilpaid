import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Toast from './components/Toast';
import LandingPage from './screens/LandingPage';
import SetupScreen from './screens/SetupScreen';
import HomeScreen from './screens/HomeScreen';
import AddTransactionScreen from './screens/AddTransactionScreen';
import EditTransactionScreen from './screens/EditTransactionScreen';
import AddAccountScreen from './screens/AddAccountScreen';
import AddRecurringScreen from './screens/AddRecurringScreen';
import EditRecurringScreen from './screens/EditRecurringScreen';
import UpcomingScreen from './screens/UpcomingScreen';
import ReconcileScreen from './screens/ReconcileScreen';
import AdjustBalanceScreen from './screens/AdjustBalanceScreen';
import SettingsScreen from './screens/SettingsScreen';
import { DollarSign } from 'lucide-react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #4A8B3F 0%, transparent 70%)' }} />
      </div>
      <div className="relative text-center splash-content">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4A8B3F] to-[#2DBF7E] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/20">
          <DollarSign size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1.5">
          <span className="text-text">Til</span><span className="text-brand-500">Paid</span>
        </h1>
        <p className="text-sm text-text-muted">Your money, mapped to payday.</p>
      </div>
    </div>
  );
}

function ScreenTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.key} className="screen-enter">
      {children}
    </div>
  );
}

function AppRoutes() {
  const { isLoading, isSetupComplete } = useApp();
  const [showSplash, setShowSplash] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!isLoading) setDataReady(true);
  }, [isLoading]);

  useEffect(() => {
    if (dataReady) {
      const timer = setTimeout(() => setShowSplash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [dataReady]);

  if (showSplash || isLoading) {
    return <SplashScreen />;
  }

  if (!isSetupComplete) {
    return <SetupScreen />;
  }

  return (
    <ScreenTransition>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/add" element={<AddTransactionScreen />} />
        <Route path="/edit/:id" element={<EditTransactionScreen />} />
        <Route path="/add-account" element={<AddAccountScreen />} />
        <Route path="/recurring" element={<UpcomingScreen />} />
        <Route path="/upcoming" element={<Navigate to="/recurring" replace />} />
        <Route path="/add-recurring" element={<AddRecurringScreen />} />
        <Route path="/edit-recurring/:id" element={<EditRecurringScreen />} />
        <Route path="/reconcile" element={<ReconcileScreen />} />
        <Route path="/adjust" element={<Navigate to="/reconcile" replace />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ScreenTransition>
  );
}

function AppContent() {
  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/*" element={
        <div className="max-w-md mx-auto min-h-screen bg-surface">
          <AppRoutes />
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ScrollToTop />
        <Toast />
        <AppContent />
      </AppProvider>
    </BrowserRouter>
  );
}
