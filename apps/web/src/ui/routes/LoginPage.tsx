import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input } from '../components/ui/primitives';
import { toast } from '../components/ui/toast';
import { demoAccounts, DEMO_PASSWORD, EngineError } from '@/backend';

const roleOrder = { ceo: 0, admin: 1, staff: 2 } as const;

export default function LoginPage() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const accounts = demoAccounts().sort((a, b) => roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder]);

  const attempt = (mail: string, pass: string) => {
    try {
      login(mail, pass);
    } catch (e) {
      toast(e instanceof EngineError ? e.message : 'Login failed.', 'red');
    }
  };

  const roleTag = (role: string, type: string) =>
    role === 'ceo' ? 'CEO' : role === 'admin' ? 'Admin' : type === 'freelancer' ? 'Freelancer' : 'Staff';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <div className="display text-3xl font-bold tracking-tight">
            Studio<span className="text-amber">OS</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">Production command center — demo build (data lives in your browser)</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Sign in */}
          <Card className="p-6">
            <h1 className="display mb-4 text-lg font-semibold">Sign in</h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                attempt(email, password);
              }}
              className="space-y-4"
            >
              <Field label="Email">
                <Input type="email" autoComplete="username" placeholder="admin@studio.test" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <Input type="password" autoComplete="current-password" placeholder={DEMO_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" className="w-full">Sign in</Button>
              <p className="mono text-center text-[11px] text-ink-dim">
                Demo password for every account: <span className="text-ink-soft">{DEMO_PASSWORD}</span>
              </p>
            </form>
          </Card>

          {/* Quick-switch demo accounts */}
          <Card className="p-6">
            <h2 className="display mb-1 text-lg font-semibold">Or jump in as…</h2>
            <p className="mb-4 text-xs text-ink-soft">One click signs you in so you can see each role's view.</p>
            <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {accounts.map((a) => (
                <button
                  key={a.email}
                  onClick={() => attempt(a.email, DEMO_PASSWORD)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm border border-line bg-surface2 px-3 py-2.5 text-left transition hover:border-line2"
                >
                  <span>
                    <span className="block text-sm text-ink">{a.full_name}</span>
                    <span className="mono block text-[11px] text-ink-dim">{a.email}</span>
                  </span>
                  <span className="mono shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-soft">
                    {roleTag(a.role, a.employment_type)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
