import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from "react";
import {apiClient, refreshAccessToken, setAccessToken} from "@/kavach/api/client";
import type {AuthenticatedUser, KavachRole} from "@/kavach/api/types";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoSession: boolean;
  login: (email: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

interface LoginPayload {
  accessToken?: string;
  user?: Partial<AuthenticatedUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authRequired = import.meta.env.VITE_AUTH_REQUIRED === "true" || new URLSearchParams(window.location.search).get("auth") === "required";

const demoEvaluator: AuthenticatedUser = {
  userId: "demo-evaluator",
  email: "evaluator@kavach.local",
  displayName: "Synthetic Data Evaluator",
  roleCode: "EVALUATOR",
  clearanceLevel: 1,
};

function unwrapPayload<T>(payload: unknown): T {
  const value = payload as {data?: T};
  return value?.data ?? (payload as T);
}

function normalizeUser(candidate?: Partial<AuthenticatedUser> | null): AuthenticatedUser | null {
  if (!candidate) return null;
  const userId = candidate.userId ?? (candidate as {id?: string}).id;
  const roleCode = candidate.roleCode ?? (candidate as {role?: KavachRole}).role;
  if (!userId || !candidate.email || !roleCode) return null;

  return {
    userId,
    email: candidate.email,
    displayName: candidate.displayName ?? candidate.email,
    roleCode,
    districtId: candidate.districtId ?? null,
    unitId: candidate.unitId ?? null,
    clearanceLevel: candidate.clearanceLevel ?? null,
  };
}

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoSession, setIsDemoSession] = useState(false);

  const applyOptionalDemoSession = useCallback(() => {
    if (!authRequired) {
      setUser(demoEvaluator);
      setIsDemoSession(true);
    } else {
      setUser(null);
      setIsDemoSession(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshAccessToken();
      const response = await apiClient.get("/api/auth/me");
      const currentUser = normalizeUser(unwrapPayload<Partial<AuthenticatedUser>>(response.data));
      if (!currentUser) throw new Error("Session user was not returned");
      setUser(currentUser);
      setIsDemoSession(false);
    } catch {
      applyOptionalDemoSession();
    } finally {
      setIsLoading(false);
    }
  }, [applyOptionalDemoSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post("/api/auth/login", {email, password});
    const payload = unwrapPayload<LoginPayload>(response.data);
    setAccessToken(payload.accessToken ?? null);

    let currentUser = normalizeUser(payload.user);
    if (!currentUser) {
      const meResponse = await apiClient.get("/api/auth/me");
      currentUser = normalizeUser(unwrapPayload<Partial<AuthenticatedUser>>(meResponse.data));
    }
    if (!currentUser) throw new Error("The server did not return an authenticated user");

    setUser(currentUser);
    setIsDemoSession(false);
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/api/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
      setIsDemoSession(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isDemoSession,
    login,
    logout,
    refreshSession,
  }), [isDemoSession, isLoading, login, logout, refreshSession, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
