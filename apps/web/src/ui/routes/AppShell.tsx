import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useUnreadCount, useSidebarCounts } from '../lib/hooks';
import { Button, Field, Input } from '../components/ui/primitives';
import { Modal } from '../components/ui/overlays';
import { toast } from '../components/ui/toast';
import { setPassword as sbSetPassword, type UserRole } from '@/backend';
import { cn } from '../lib/cn';

const NAV: Record<UserRole, { to: string; label: string; icon: string }[]> = {
  ceo: [
    { to: '/overview', label: 'Overview', icon: '◎' },
    { to: '/projects', label: 'Projects', icon: '▦' },
    { to: '/team', label: 'Team', icon: '◐' },
    { to: '/pipeline', label: 'Pipeline', icon: '⌁' },
    { to: '/notifications', label: 'Activity', icon: '◔' },
  ],
  admin: [
    { to: '/desk', label: 'Desk', icon: '◎' },
    { to: '/leads', label: 'Leads', icon: '✦' },
    { to: '/assign', label: 'Assign', icon: '⊕' },
    { to: '/review', label: 'Review', icon: '◉' },
    { to: '/projects', label: 'Projects', icon: '▦' },
    { to: '/team', label: 'Team', icon: '◐' },
    { to: '/notifications', label: 'Activity', icon: '◔' },
  ],
  staff: [
    { to: '/my-tasks', label: 'My Tasks', icon: '✓' },
    { to: '/notifications', label: 'Activity', icon: '◔' },
  ],
  anchor: [
    { to: '/anchor', label: 'My Shoots', icon: '🎤' },
    { to: '/notifications', label: 'Activity', icon: '◔' },
  ],
};

const roleLabel: Record<UserRole, string> = { ceo: 'CEO', admin: 'Admin', staff: 'Staff', anchor: 'Anchor' };

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadCount(user?.id ?? '').data ?? 0;
  const counts = useSidebarCounts(user?.id ?? '').data ?? {};
  const [showAccount, setShowAccount] = useState(false);
  const [newPw, setNewPw] = useState('');
  if (!user) return null;
  const items = NAV[user.role];
  const chipFor = (to: string) => (to === '/notifications' ? unread : counts[to] ?? 0);

  const navItem = (collapsed: boolean) => (i: (typeof items)[number]) => (
    <NavLink
      key={i.to}
      to={i.to}
      className={({ isActive }) =>
        cn(
          'mono flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm transition',
          collapsed ? 'shrink-0 min-w-[60px] flex-col gap-1 text-[11px]' : '',
          isActive ? 'bg-surface2 text-ink' : 'text-ink-dim hover:text-ink',
        )
      }
    >
      <span className="text-base" aria-hidden>{i.icon}</span>
      <span className="flex items-center gap-1.5">
        {i.label}
        {chipFor(i.to) > 0 && (
          <span
            className="mono rounded-full px-1.5 text-[10px] font-semibold"
            style={{ backgroundColor: i.to === '/notifications' ? 'var(--red)' : 'var(--amber)', color: '#1a1205' }}
          >
            {chipFor(i.to)}
          </span>
        )}
      </span>
    </NavLink>
  );

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-bg2 px-3 py-4 md:flex">
        <div className="display px-2 pb-5 text-lg font-bold tracking-tight">
          Studio<span className="text-amber">OS</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">{items.map(navItem(false))}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="display text-base font-bold md:hidden">
            Studio<span className="text-amber">OS</span>
          </div>
          <div className="hidden text-sm text-ink-dim md:block">{roleLabel[user.role]} workspace</div>
          <div className="flex items-center gap-3">
            <NavLink to="/notifications" className="relative text-lg text-ink-soft hover:text-ink" aria-label="Activity">
              ◔
              {unread > 0 && <span className="absolute -right-1.5 -top-1 h-4 min-w-4 rounded-full bg-red px-1 text-center text-[10px] font-semibold leading-4 text-[#1a0a08]">{unread}</span>}
            </NavLink>
            <button onClick={() => setShowAccount(true)} className="hidden text-right transition hover:opacity-80 sm:block">
              <div className="text-sm text-ink">{user.full_name}</div>
              <div className="mono text-[11px] text-ink-dim">{roleLabel[user.role]} · account</div>
            </button>
            <Button variant="ghost" onClick={async () => { await logout(); navigate('/'); }}>Sign out</Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:px-6 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch gap-1 overflow-x-auto border-t border-line bg-bg2 px-2 py-1.5 md:hidden">
        {items.map(navItem(true))}
      </nav>

      <Modal open={showAccount} onClose={() => setShowAccount(false)} title="Account">
        <div className="space-y-3">
          <div className="text-sm text-ink">{user.full_name} <span className="text-ink-dim">· {user.email}</span></div>
          <Field label="Change password">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 6)" />
          </Field>
        </div>
        <div className="mt-5 flex justify-between gap-2">
          <Button variant="ghost" onClick={async () => { setShowAccount(false); await logout(); navigate('/'); }}>Sign out</Button>
          <Button
            variant="primary"
            disabled={newPw.length < 6}
            onClick={async () => {
              try { await sbSetPassword(newPw); toast('Password updated.', 'green'); setNewPw(''); setShowAccount(false); }
              catch (e) { toast((e as Error).message, 'red'); }
            }}
          >
            Update password
          </Button>
        </div>
      </Modal>
    </div>
  );
}
