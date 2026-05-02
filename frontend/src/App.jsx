import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import Login from './components/Login';
import VendorLayout from './vendor/components/VendorLayout';

// Pages
import Home from './vendor/pages/Home';
import Appointments from './vendor/pages/Appointments';
import CallLog from './vendor/pages/CallLog';
import Escalations from './vendor/pages/Escalations';
import PatientHistory from './vendor/pages/PatientHistory';
import Settings from './vendor/pages/Settings';
import Campaigns from './vendor/pages/Campaigns';

const App = () => {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (email, password) => {
    const loggedInUser = await login(email, password);
    // After login, redirect admins to the admin portal
    if (loggedInUser?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} type="Vendor" />;
  }

  // Role Guard: Prevents Admins from staying in the Vendor portal
  if (user?.type === 'Admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Routes>
      <Route element={<VendorLayout />}>
        <Route index element={<Home />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="call-log" element={<CallLog />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="patients" element={<PatientHistory />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
