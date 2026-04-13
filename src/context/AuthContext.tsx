'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  StoredUser, getStoredUser, getAccessToken, getRefreshToken,
  setTokens, setStoredUser, clearAuth, decodeJwtPayload,
} from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface PumpAssignment {
  pump_id: string;
  role: string;
}

interface MePumpResponse {
  data: {
    pump?: PumpAssignment | null;
    assignment?: PumpAssignment | null;
    pumps?: PumpAssignment[];
  };
}

interface AuthContextValue {
  user: StoredUser | null;
  accessToken: string | null;
  isAdmin: boolean;
  isEmployee: boolean;
  pumpAssignments: PumpAssignment[];
  myPumpId: string | null;
  canAccessDashboard: boolean;
  defaultRoute: '/dashboard' | '/transactions';
  login: (email: string, password: string) => Promise<'/dashboard' | '/transactions'>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [pumpAssignments, setPumpAssignments] = useState<PumpAssignment[]>([]);
  const [myPumpId, setMyPumpId] = useState<string | null>(null);
  const [canAccessDashboard, setCanAccessDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateAuthorization = useCallback(async (currentUser: StoredUser): Promise<{ canAccessDashboard: boolean }> => {
    if (currentUser.role === 'admin') {
      setPumpAssignments([]);
      setMyPumpId(null);
      setCanAccessDashboard(true);
      return { canAccessDashboard: true };
    }

    try {
      const res = await apiFetch<MePumpResponse>('/api/pumps/me/pump');
      const assignment = res.data.pump ?? res.data.assignment ?? res.data.pumps?.[0] ?? null;
      const assignments = assignment ? [assignment] : [];
      const primaryPumpId = assignment?.pump_id ?? null;
      const hasDashboardAccess = assignment?.role === 'pump_admin' || currentUser.pump_role === 'pump_admin';

      setPumpAssignments(assignments);
      setMyPumpId(primaryPumpId);
      setCanAccessDashboard(hasDashboardAccess);
      return { canAccessDashboard: hasDashboardAccess };
    } catch {
      setPumpAssignments([]);
      setMyPumpId(null);
      const hasDashboardAccess = currentUser.pump_role === 'pump_admin';
      setCanAccessDashboard(hasDashboardAccess);
      return { canAccessDashboard: hasDashboardAccess };
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const storedUser = getStoredUser();
      const token = getAccessToken();
      if (storedUser && token) {
        setUser(storedUser);
        setAccessTokenState(token);
        await hydrateAuthorization(storedUser);
      }
      setIsLoading(false);
    };

    void bootstrap();
  }, [hydrateAuthorization]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: { access_token: string; refresh_token: string } }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      const { access_token, refresh_token } = res.data;
      setTokens(access_token, refresh_token);
      setAccessTokenState(access_token);

      // JWT payload has: { user_id, role, exp }
      const payload = decodeJwtPayload(access_token);
      const userId = (payload?.user_id ?? payload?.sub ?? payload?.identity) as string;

      let storedUser: StoredUser;
      try {
        const profileRes = await apiFetch<{ data: { user: { _id: string; name: string; email: string; role: StoredUser['role']; pump_role?: StoredUser['pump_role'] } } }>(
          `/api/users/${userId}`
        );
        const u = profileRes.data.user;
        storedUser = { id: u._id, name: u.name, email: u.email, role: u.role, pump_role: u.pump_role ?? null };
      } catch {
        // Fallback to JWT payload if profile fetch fails
        storedUser = {
          id: userId,
          name: payload?.name as string ?? email,
          email: payload?.email as string ?? email,
          role: payload?.role as StoredUser['role'] ?? 'employee',
          pump_role: (payload?.pump_role as StoredUser['pump_role']) ?? null,
        };
      }

      setStoredUser(storedUser);
      setUser(storedUser);

      const authz = await hydrateAuthorization(storedUser);
      return authz.canAccessDashboard ? '/dashboard' : '/transactions';
    } finally {
      setIsLoading(false);
    }
  }, [hydrateAuthorization]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch { /* ignore */ }
    clearAuth();
    disconnectSocket();
    setUser(null);
    setAccessTokenState(null);
    setPumpAssignments([]);
    setMyPumpId(null);
    setCanAccessDashboard(false);
  }, []);

  const defaultRoute: '/dashboard' | '/transactions' = canAccessDashboard ? '/dashboard' : '/transactions';

  return (
    <AuthContext.Provider value={{
      user, accessToken,
      isAdmin: user?.role === 'admin',
      isEmployee: user?.role === 'employee',
      pumpAssignments,
      myPumpId,
      canAccessDashboard,
      defaultRoute,
      login, logout, isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
