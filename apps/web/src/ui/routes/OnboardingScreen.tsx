import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input, Select } from '../components/ui/primitives';
import { toast } from '../components/ui/toast';
import { completeOnboarding, setPassword as sbSetPassword, EngineError } from '@/backend';

const ROLE_OPTIONS = [
  { value: 'staff:employee', label: 'Staff — in-house (shoots & edits)' },
  { value: 'staff:freelancer', label: 'Freelancer — paid hourly' },
  { value: 'anchor:employee', label: 'Anchor — on-camera talent' },
];

export default function OnboardingScreen() {
  const { user, refresh, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [roleChoice, setRoleChoice] = useState('staff:employee');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const [role, employment] = roleChoice.split(':');
      await completeOnboarding(user!.id, fullName.trim(), phone.trim(), role, employment);
      if (password) await sbSetPassword(password);
      await refresh();
      toast('Welcome aboard! 🎬', 'green');
    } catch (e) {
      toast(e instanceof EngineError ? e.message : 'Could not save your details.', 'red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="display text-2xl font-bold">Welcome to Studio<span className="text-amber">OS</span></div>
          <p className="mt-1 text-sm text-ink-soft">A couple of details to finish setting up your account.</p>
        </div>
        <Card className="space-y-4 p-6">
          <Field label="Your name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Phone (optional)">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
          </Field>
          <Field label="I am a…">
            <Select value={roleChoice} onChange={(e) => setRoleChoice(e.target.value)}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Set a password (optional — for faster sign-in)">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </Field>
          <Button variant="primary" className="w-full" disabled={busy || !fullName.trim()} onClick={submit}>Get started</Button>
          <button onClick={() => logout()} className="mono w-full text-center text-[11px] text-ink-dim hover:text-ink">Sign out</button>
        </Card>
      </div>
    </div>
  );
}
