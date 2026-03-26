import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
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

function AppRoutes() {
  const { isLoading, isSetupComplete } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-600 to-success-500 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-medium">T</span>
          </div>
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return <SetupScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/add" element={<AddTransactionScreen />} />
      <Route path="/edit/:id" element={<EditTransactionScreen />} />
      <Route path="/add-account" element={<AddAccountScreen />} />
      <Route path="/upcoming" element={<UpcomingScreen />} />
      <Route path="/add-recurring" element={<AddRecurringScreen />} />
      <Route path="/edit-recurring/:id" element={<EditRecurringScreen />} />
      <Route path="/reconcile" element={<ReconcileScreen />} />
      <Route path="/adjust" element={<Navigate to="/reconcile" replace />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="max-w-md mx-auto min-h-screen bg-surface">
          <AppRoutes />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}
