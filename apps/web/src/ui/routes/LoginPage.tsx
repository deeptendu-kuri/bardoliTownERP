import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input } from '../components/ui/primitives';
import { toast } from '../components/ui/toast';
import { sendOtp, verifyOtp, setPassword as sbSetPassword, EngineError, type PublicProfile } from '@/backend';
import { cn } from '../lib/cn';

type Mode = 'password' | 'otp';
type Step = 'enter' | 'code' | 'setpw';

export default function LoginPage() {
  const { loginPassword, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('password');
  const [step, setStep] = useState<Step>('enter');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof EngineError ? e.message : 'Something went wrong.', 'red');
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string) => (
    <button
      onClick={() => { setMode(m); setStep('enter'); }}
      className={cn(
        'mono flex-1 rounded-sm px-3 py-2 text-xs uppercase tracking-wide transition',
        mode === m ? 'bg-surface2 text-ink' : 'text-ink-dim hover:text-ink',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="display text-3xl font-bold tracking-tight">
            Studio<span className="text-amber">OS</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">Production command center</p>
        </div>

        <Card className="p-6">
          {step === 'setpw' ? (
            <div className="space-y-4">
              <div>
                <h1 className="display text-lg font-semibold">You're in 🎉</h1>
                <p className="mt-1 text-sm text-ink-soft">Set a password so you can sign in faster next time (optional).</p>
              </div>
              <Field label="New password">
                <Input type="password" autoFocus value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters" />
              </Field>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => profile && setUser(profile)}>Skip</Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={busy || newPw.length < 6}
                  onClick={() => run(async () => { await sbSetPassword(newPw); if (profile) setUser(profile); })}
                >
                  Save & continue
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5 flex gap-1 rounded-sm border border-line p-1">
                {tab('password', 'Password')}
                {tab('otp', 'Email code')}
              </div>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mode === 'password') run(() => loginPassword(email, password));
                  else if (step === 'enter') run(async () => { await sendOtp(email); setStep('code'); toast('Code sent — check your email.', 'blue'); });
                  else run(async () => { const p = await verifyOtp(email, code); setProfile(p); setStep('setpw'); });
                }}
              >
                <Field label="Email">
                  <Input type="email" autoComplete="username" placeholder="you@studio.com" value={email} disabled={step === 'code'} onChange={(e) => setEmail(e.target.value)} />
                </Field>

                {mode === 'password' && (
                  <Field label="Password">
                    <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                )}

                {mode === 'otp' && step === 'code' && (
                  <Field label="6-digit code">
                    <Input inputMode="numeric" autoFocus placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
                  </Field>
                )}

                <Button type="submit" variant="primary" className="w-full" disabled={busy || !email}>
                  {mode === 'password' ? 'Sign in' : step === 'enter' ? 'Email me a code' : 'Verify & sign in'}
                </Button>
              </form>

              {mode === 'otp' && step === 'code' && (
                <button onClick={() => run(async () => { await sendOtp(email); toast('New code sent.', 'blue'); })} className="mono mt-3 w-full text-center text-[11px] text-ink-dim hover:text-ink">
                  Resend code
                </button>
              )}
              {mode === 'password' && (
                <p className="mono mt-3 text-center text-[11px] text-ink-dim">First time? Use <button onClick={() => { setMode('otp'); setStep('enter'); }} className="text-blue hover:underline">email code</button> to register.</p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
