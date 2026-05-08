import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import { LoadingScreen } from './components/UI';
import './index.css';

import { SignUp, SignIn, ForgotPassword, ResetPassword, AcceptInvite } from './pages/Auth';
import { EmployeeDashboard, EmployeeSchedule, AvailableShifts, MyRequests, EmpNotifications } from './pages/EmployeePages';
import { ManagerDashboard, ScheduleBuilder, ManagerRequests, ManagerEmployees, ManagerNotifications } from './pages/ManagerPages';
import Billing from './pages/Billing';
import Landing from './pages/Landing';

// ── Protected layout ──────────────────────────────────────────────────────────
function AppLayout({ children, requireRole }) {
  const { isAuthenticated, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { navigate('/login', { replace: true }); return; }
    if (requireRole && profile?.role !== requireRole) {
      navigate(profile?.role === 'manager' ? '/manager/dashboard' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, profile, loading, navigate, requireRole]);

  if (loading) return <LoadingScreen message="Loading ScheduForge…" />;
  if (!isAuthenticated) return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}

// ── Root: landing for guests, dashboard redirect for authenticated users ───────
function Root() {
  const { isAuthenticated, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Landing />;
  return <Navigate to={profile?.role === 'manager' ? '/manager/dashboard' : '/dashboard'} replace />;
}

// ── Routes ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/signup"          element={<SignUp />} />
      <Route path="/login"           element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/invite"          element={<AcceptInvite />} />

      {/* Employee */}
      <Route path="/dashboard"    element={<AppLayout requireRole="employee"><EmployeeDashboard /></AppLayout>} />
      <Route path="/schedule"     element={<AppLayout requireRole="employee"><EmployeeSchedule /></AppLayout>} />
      <Route path="/available"    element={<AppLayout requireRole="employee"><AvailableShifts /></AppLayout>} />
      <Route path="/requests"     element={<AppLayout requireRole="employee"><MyRequests /></AppLayout>} />
      <Route path="/notifications"element={<AppLayout requireRole="employee"><EmpNotifications /></AppLayout>} />

      {/* Manager */}
      <Route path="/manager/dashboard"     element={<AppLayout requireRole="manager"><ManagerDashboard /></AppLayout>} />
      <Route path="/manager/schedule"      element={<AppLayout requireRole="manager"><ScheduleBuilder /></AppLayout>} />
      <Route path="/manager/requests"      element={<AppLayout requireRole="manager"><ManagerRequests /></AppLayout>} />
      <Route path="/manager/employees"     element={<AppLayout requireRole="manager"><ManagerEmployees /></AppLayout>} />
      <Route path="/manager/notifications" element={<AppLayout requireRole="manager"><ManagerNotifications /></AppLayout>} />
      <Route path="/billing"               element={<AppLayout requireRole="manager"><Billing /></AppLayout>} />

      {/* Catch-all */}
      <Route path="/"   element={<Root />} />
      <Route path="*"   element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
