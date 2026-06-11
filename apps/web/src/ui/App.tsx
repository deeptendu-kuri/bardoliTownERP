import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, landingFor } from './lib/auth';
import { Toaster } from './components/ui/toast';
import LoginPage from './routes/LoginPage';
import AppShell from './routes/AppShell';
import OverviewPage from './routes/OverviewPage';
import DeskPage from './routes/DeskPage';
import MyTasksPage from './routes/MyTasksPage';
import NotificationsPage from './routes/NotificationsPage';
import type { UserRole } from '@/backend';

function RoleGate({ roles, children }: { roles: UserRole[]; children: React.ReactElement }) {
  const user = useAuth((s) => s.user)!;
  return roles.includes(user.role) ? children : <Navigate to={landingFor(user.role)} replace />;
}

export default function App() {
  const user = useAuth((s) => s.user);

  return (
    <>
      {user ? (
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/overview" element={<RoleGate roles={['ceo']}><OverviewPage /></RoleGate>} />
            <Route path="/desk" element={<RoleGate roles={['admin']}><DeskPage /></RoleGate>} />
            <Route path="/my-tasks" element={<RoleGate roles={['staff']}><MyTasksPage /></RoleGate>} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Navigate to={landingFor(user.role)} replace />} />
          </Route>
        </Routes>
      ) : (
        <LoginPage />
      )}
      <Toaster />
    </>
  );
}
