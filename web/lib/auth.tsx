'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthResponse, UserSummary } from './api';

interface AuthState {
  user: UserSummary | null;
  token: string | null;
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  login: (resp: AuthResponse) => void;
  logout: () => void;
}

const STORAGE_KEY = 'cobra_pets_auth_v1';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    ready: false,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { user: UserSummary; token: string };
        setState({ user: parsed.user, token: parsed.token, ready: true });
        return;
      }
    } catch {
      // Ignore corrupt storage; fall through to logged-out state.
    }
    setState((s) => ({ ...s, ready: true }));
  }, []);

  const login = useCallback((resp: AuthResponse) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: resp.user, token: resp.accessToken }),
    );
    setState({ user: resp.user, token: resp.accessToken, ready: true });
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, token: null, ready: true });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
