import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Card, Field, Input } from '../components/ui/primitives';
import { toast } from '../components/ui/toast';
import { sendOtp, verifyOtp, requestPasswordReset, EngineError } from '@/backend';
import { cn } from '../lib/cn';

type Mode = 'password' | 'otp';

export default function LoginPage() {
  const { loginPassword, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('password');
  const [forgot, setForgot] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

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
      onClick={() => { setMode(m); setCodeSent(false); }}
      className={cn('mono flex-1 rounded-sm px-3 py-2 text-xs uppercase tracking-wide transition', mode === m ? 'bg-surface2 text-ink' : 'text-ink-dim hover:text-ink')}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="display text-3xl font-bold tracking-tight">Studio<span className="text-amber">OS</span></div>
          <p className="mt-2 text-sm text-ink-soft">Production command center</p>
        </div>

        <Card className="p-6">
          {forgot ? (
            <div className="space-y-4">
              <h1 className="display text-lg font-semibold">Reset your password</h1>
              <p className="text-sm text-ink-soft">We'll email you a link to set a new password.</p>
              <Field label="Email">
                <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
              </Field>
              <Button variant="primary" className="w-full" disabled={busy || !email}
                onClick={() => run(async () => { await requestPasswordReset(email); toast('Reset email sent — check your inbox.', 'blue'); setForgot(false); })}>
                Send reset link
              </Button>
              <button onClick={() => setForgot(false)} className="mono w-full text-center text-[11px] text-ink-dim hover:text-ink">Back to sign in</button>
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
                  else if (!codeSent) run(async () => { await sendOtp(email); setCodeSent(true); toast('Check your email for the code (or sign-in link).', 'blue'); });
                  else run(async () => { const p = await verifyOtp(email, code); setUser(p); });
                }}
              >
                <Field label="Email">
                  <Input type="email" autoComplete="username" placeholder="you@studio.com" value={email} disabled={codeSent} onChange={(e) => setEmail(e.target.value)} />
                </Field>

                {mode === 'password' && (
                  <Field label="Password">
                    <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                )}

                {mode === 'otp' && codeSent && (
                  <Field label="6-digit code">
                    <Input inputMode="numeric" autoFocus placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
                  </Field>
                )}

                <Button type="submit" variant="primary" className="w-full" disabled={busy || !email}>
                  {mode === 'password' ? 'Sign in' : !codeSent ? 'Email me a code' : 'Verify & continue'}
                </Button>
              </form>

              {mode === 'otp' && codeSent && (
                <button onClick={() => run(async () => { await sendOtp(email); toast('New code sent.', 'blue'); })} className="mono mt-3 w-full text-center text-[11px] text-ink-dim hover:text-ink">
                  Resend code
                </button>
              )}
              {mode === 'password' && (
                <div className="mono mt-3 flex justify-between text-[11px] text-ink-dim">
                  <button onClick={() => { setMode('otp'); setCodeSent(false); }} className="text-blue hover:underline">First time? Register</button>
                  <button onClick={() => setForgot(true)} className="hover:text-ink">Forgot password?</button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
