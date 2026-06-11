import type { Profile } from '../models/types';

/** A profile with the demo password stripped — the only profile shape the UI sees. */
export type PublicProfile = Omit<Profile, 'password'>;

export const publicProfile = (p: Profile): PublicProfile => {
  const { password: _password, ...rest } = p;
  return rest;
};
