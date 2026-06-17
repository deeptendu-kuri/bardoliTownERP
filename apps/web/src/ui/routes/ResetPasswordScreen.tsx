import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input } from '../components/ui/primitives';
import { toast } from '../components/ui/toast';
import { setPassword as sbSetPassword, EngineError } from '@/backend';

export default function ResetPasswordScreen() {
  const { setRecovery, refresh, logout } = useAuth();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await sbSetPassword(pw);
      setRecovery(false);
      await refresh();
      toast('Password updated — you can use it next time.', 'green');
    } catch (e) {
      toast(e instanceof EngineError ? e.message : 'Could not update the password.', 'red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="display text-2xl font-bold">Set a new password</div>
          <p className="mt-1 text-sm text-ink-soft">Choose a new password for your account.</p>
        </div>
        <Card className="space-y-4 p-6">
          <Field label="New password">
            <Input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
          </Field>
          <Button variant="primary" className="w-full" disabled={busy || pw.length < 6} onClick={submit}>Update password</Button>
          <button onClick={() => { setRecovery(false); logout(); }} className="mono w-full text-center text-[11px] text-ink-dim hover:text-ink">Cancel</button>
        </Card>
      </div>
    </div>
  );
}
