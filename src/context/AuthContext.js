"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import * as AuthService from "@/services/AuthService";
import { getDefaultDashboardForUser, getUserRole } from "@/lib/permissions";
import {
  clearSession,
  readSession,
  startSession,
  touchSession,
} from "@/lib/session";

/** How often the deadline is re-checked while the app is open. */
const CHECK_MS = 60 * 1000;

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Restore the session on first mount — if it is still within its deadline.
  useEffect(() => {
    const session = readSession();
    const restored = session?.user ?? null;

    // A stored error envelope (or a record whose role was since revoked) is
    // not a session — clear it rather than letting a dashboard render on it.
    if (restored && (restored.status_code === 401 || !getUserRole(restored))) {
      clearSession();
    } else if (restored) {
      // Re-stamped so the idle clock runs from this visit, not the last one.
      touchSession();
      setUser(restored);
    }
    setLoading(false);
  }, []);

  /**
   * Ends the session the moment it falls out of its window, rather than at the
   * next refresh — a machine left signed in on the shop floor is exactly the
   * case a deadline is for.
   */
  useEffect(() => {
    if (!user) return undefined;

    const keepAlive = () => touchSession();
    const events = ["mousedown", "keydown", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, keepAlive, { passive: true })
    );

    const check = setInterval(() => {
      if (readSession()) return;
      setUser(null);
      router.replace("/Login");
    }, CHECK_MS);

    return () => {
      events.forEach((event) => window.removeEventListener(event, keepAlive));
      clearInterval(check);
    };
  }, [user, router]);

  /**
   * Signs in and persists the session. Returns the user so the login form can
   * decide where to redirect.
   */
  const login = async (empCode, password) => {
    try {
      const signedIn = await AuthService.login(empCode, password);
      startSession(signedIn);
      setUser(signedIn);
      return signedIn;
    } catch (err) {
      clearSession();
      setUser(null);
      throw err;
    }
  };

  const logout = () => {
    // The backend's GET /logout is a no-op: it inspects a singleton LoginUser
    // bean whose username login never sets, so it always reports "already
    // logged out". Clearing local state is what actually ends the session.
    clearSession();
    setUser(null);
    router.push("/Login");
  };

  const forgetPassword = (empCode) => AuthService.forgetPassword(empCode);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        forgetPassword,
        homePath: getDefaultDashboardForUser(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
