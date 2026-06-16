import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, landingFor } from './lib/auth';
import { Toaster } from './components/ui/toast';
import LoginPage from './routes/LoginPage';
import AppShell from './routes/AppShell';
import OverviewPage from './routes/OverviewPage';
import DeskPage from './routes/DeskPage';
import MyTasksPage from './routes/MyTasksPage';
import AnchorDashboard from './routes/AnchorDashboard';
import NotificationsPage from './routes/NotificationsPage';
import ProjectsBoard from './routes/ProjectsBoard';
import TeamView from './routes/TeamView';
import PipelineView from './routes/PipelineView';
import { LeadsPage, AssignPage, ReviewPage } from './routes/adminSections';
import type { UserRole } from '@/backend';

function RoleGate({ roles, children }: { roles: UserRole[]; children: React.ReactElement }) {
  const user = useAuth((s) => s.user)!;
  return roles.includes(user.role) ? children : <Navigate to={landingFor(user.role)} replace />;
}

export default function App() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const init = useAuth((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-ink-dim">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line2 border-t-amber" />
          <span className="mono text-sm">Loading Studio OS…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/overview" element={<RoleGate roles={['ceo']}><OverviewPage /></RoleGate>} />
            <Route path="/pipeline" element={<RoleGate roles={['ceo']}><PipelineView /></RoleGate>} />
            <Route path="/desk" element={<RoleGate roles={['admin']}><DeskPage /></RoleGate>} />
            <Route path="/leads" element={<RoleGate roles={['admin']}><LeadsPage /></RoleGate>} />
            <Route path="/assign" element={<RoleGate roles={['admin']}><AssignPage /></RoleGate>} />
            <Route path="/review" element={<RoleGate roles={['admin']}><ReviewPage /></RoleGate>} />
            <Route path="/projects" element={<RoleGate roles={['ceo', 'admin']}><ProjectsBoard /></RoleGate>} />
            <Route path="/team" element={<RoleGate roles={['ceo', 'admin']}><TeamView /></RoleGate>} />
            <Route path="/my-tasks" element={<RoleGate roles={['staff']}><MyTasksPage /></RoleGate>} />
            <Route path="/anchor" element={<RoleGate roles={['anchor']}><AnchorDashboard /></RoleGate>} />
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
