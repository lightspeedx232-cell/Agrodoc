// Auth context: tracks the logged-in user and exposes login/register/logout.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
    preferred_language?: string;
    state?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, if a token exists, fetch the current user.
  useEffect(() => {
    const token = localStorage.getItem("agrodoc.access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("agrodoc.access_token");
        localStorage.removeItem("agrodoc.refresh_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    localStorage.setItem("agrodoc.access_token", tokens.access_token);
    localStorage.setItem("agrodoc.refresh_token", tokens.refresh_token);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const register = useCallback(
    async (body: {
      full_name: string;
      email: string;
      password: string;
      phone?: string;
      preferred_language?: string;
      state?: string;
    }) => {
      await authApi.register(body);
      await login(body.email, body.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("agrodoc.access_token");
    localStorage.removeItem("agrodoc.refresh_token");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
