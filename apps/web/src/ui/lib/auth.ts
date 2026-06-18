import { create } from 'zustand';
import {
  getCurrentProfile,
  loginPassword as sbLoginPassword,
  logout as sbLogout,
  resetLoaded,
  type PublicProfile,
  type UserRole,
} from '@/backend';

interface AuthState {
  user: PublicProfile | null;
  ready: boolean;
  recovery: boolean;
  setRecovery: (v: boolean) => void;
  init: () => Promise<void>;
  loginPassword: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: PublicProfile) => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  recovery: false,
  setRecovery: (v) => set({ recovery: v }),
  async init() {
    try {
      const user = await getCurrentProfile();
      set({ user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  async loginPassword(email, password) {
    const user = await sbLoginPassword(email, password);
    resetLoaded();
    set({ user });
  },
  async refresh() {
    const user = await getCurrentProfile();
    set({ user });
  },
  setUser(user) {
    resetLoaded();
    set({ user });
  },
  async logout() {
    await sbLogout();
    resetLoaded();
    set({ user: null, recovery: false });
  },
}));

export const landingFor = (role: UserRole): string =>
  role === 'ceo' ? '/overview'
  : role === 'admin' ? '/desk'
  : role === 'anchor' ? '/anchor'
  : role === 'scriptwriter' ? '/script'
  : role === 'salesperson' ? '/add-lead'
  : '/my-tasks';
