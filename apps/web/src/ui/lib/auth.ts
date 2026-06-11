import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, currentUser, type PublicProfile, type UserRole } from '@/backend';

interface AuthState {
  user: PublicProfile | null;
  login: (email: string, password: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: currentUser(),
  login: (email, password) => set({ user: apiLogin(email, password) }),
  logout: () => {
    apiLogout();
    set({ user: null });
  },
}));

export const landingFor = (role: UserRole): string =>
  role === 'ceo' ? '/overview' : role === 'admin' ? '/desk' : '/my-tasks';
