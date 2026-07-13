import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../lib/api';
import type { SetupState, User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setup: SetupState | null;
  login(email: string, password: string): Promise<void>;
  register(displayName: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  completeOnboarding(): Promise<void>;
  /** Drops the local session state without calling the API (e.g. after a 401). */
  clearSession(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<SetupState | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<SetupState>('/v1/setup').then(setSetup),
      apiRequest<{ user: User }>('/v1/me')
        .then((response) => setUser(response.user))
        .catch(() => setUser(null)),
    ]).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setup,
      async login(email, password) {
        const response = await apiRequest<{ user: User }>('/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setUser(response.user);
        setSetup((current) =>
          current ? { ...current, setupRequired: false, registrationOpen: false } : current,
        );
      },
      async register(displayName, email, password) {
        const response = await apiRequest<{ user: User }>('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({ displayName, email, password }),
        });
        setUser(response.user);
      },
      async logout() {
        await apiRequest('/v1/auth/logout', { method: 'POST' });
        setUser(null);
      },
      async completeOnboarding() {
        const response = await apiRequest<{ onboardingCompletedAt: string }>('/v1/me/onboarding', {
          method: 'PATCH',
          body: JSON.stringify({ completed: true }),
        });
        setUser((current) =>
          current ? { ...current, onboardingCompletedAt: response.onboardingCompletedAt } : current,
        );
      },
      clearSession() {
        setUser(null);
      },
    }),
    [user, setup],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
