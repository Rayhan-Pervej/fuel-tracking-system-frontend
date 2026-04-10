'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  StoredUser, getStoredUser, getAccessToken, getRefreshToken,
  setTokens, setStoredUser, clearAuth, decodeJwtPayload,
} from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface AuthContextValue {
  user: StoredUser | null;
  accessToken: string | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isCustomer: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getAccessToken();
    if (storedUser && token) {
      setUser(storedUser);
      setAccessTokenState(token);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
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
      const profileRes = await apiFetch<{ data: { user: { _id: string; name: string; email: string; role: StoredUser['role'] } } }>(
        `/api/users/${userId}`
      );
      const u = profileRes.data.user;
      storedUser = { id: u._id, name: u.name, email: u.email, role: u.role };
    } catch {
      // Fallback to JWT payload if profile fetch fails
      storedUser = {
        id: userId,
        name: payload?.name as string ?? email,
        email: payload?.email as string ?? email,
        role: payload?.role as StoredUser['role'] ?? 'customer',
      };
    }

    setStoredUser(storedUser);
    setUser(storedUser);
  }, []);

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
  }, []);

  return (
    <AuthContext.Provider value={{
      user, accessToken,
      isAdmin: user?.role === 'admin',
      isEmployee: user?.role === 'employee',
      isCustomer: user?.role === 'customer',
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
