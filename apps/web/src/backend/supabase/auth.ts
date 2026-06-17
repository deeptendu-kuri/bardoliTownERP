import { supabase } from '../db/supabaseClient';
import { EngineError } from '../engine/errors';
import type { PublicProfile } from '../lib/safe';

/** Send a one-time login code to the email (creates the user on first use). */
export async function sendOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  });
  if (error) throw new EngineError('otp', error.message);
}

/** Verify the emailed code and return the signed-in profile. */
export async function verifyOtp(email: string, token: string): Promise<PublicProfile> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw new EngineError('otp', error.message);
  return requireProfile();
}

export async function loginPassword(email: string, password: string): Promise<PublicProfile> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new EngineError('bad_credentials', error.message);
  return requireProfile();
}

/** Set/change the password for the currently signed-in user. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new EngineError('password', error.message);
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentProfile(): Promise<PublicProfile | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  return fetchProfile(session.user.id, session.user.email ?? '');
}

async function requireProfile(): Promise<PublicProfile> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new EngineError('auth', 'No active session.');
  return fetchProfile(data.user.id, data.user.email ?? '');
}

async function fetchProfile(id: string, email: string): Promise<PublicProfile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error || !data) throw new EngineError('auth', 'Your profile is not set up yet — contact an admin.');
  return {
    ...(data as Record<string, unknown>),
    email,
    hourly_rate: data.hourly_rate == null ? null : Number(data.hourly_rate),
    skills: (data.skills as string[]) ?? [],
  } as PublicProfile;
}
