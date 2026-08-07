"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import * as AuthService from "@/services/AuthService";
import { PORTAL_DASHBOARD_URL } from "@/config/portal";
import {
  getDefaultDashboardForUser,
  getEmpCode,
  getUserRole,
} from "@/lib/permissions";
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

  // Set once the browser has been told to leave. Every path out of the app is a
  // full page load, and several of them can fire at once — the interval and a
  // click landing in the same moment — so this keeps it to one navigation.
  const leavingRef = useRef(false);

  /**
   * Leaves the app for the portal: the end of a session, however it ended —
   * LOGOUT, HOME, or a deadline passing.
   *
   * The backend's GET /logout is a no-op — it inspects a singleton LoginUser
   * bean whose username login never sets, so it always reports "already logged
   * out". Clearing local state is what actually ends the session.
   *
   * It is a hard navigation because the portal is another origin, and the page
   * load is what clears React state. `user` is deliberately left standing until
   * then: dropping it here would let ProtectedLayout flash the login form in
   * the moment before the browser leaves.
   */
  const leaveForPortal = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    clearSession();
    // replace(), not href: the page being left is dropped from history, so Back
    // from the portal does not return to the screen the user just logged out of.
    window.location.replace(PORTAL_DASHBOARD_URL);
  }, []);

  /**
   * Catches the app coming back out of the browser's back/forward cache.
   *
   * A bfcache restore is not a page load: React state is restored exactly as it
   * was, so `user` is still set and nothing re-reads storage. Press Back after
   * logging out and the app would sit there looking signed in on a session that
   * no longer exists — and, because `leavingRef` was left standing by the
   * navigation that got us here, neither the idle check nor a click could get
   * out of it. Resetting the flag is what makes the exit work a second time.
   */
  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      leavingRef.current = false;

      const stored = readSession();
      if (!stored) {
        leaveForPortal();
        return;
      }

      // Somebody else signed in from another tab while this page sat in the
      // cache — a shared shop-floor machine does this. The restored page still
      // shows the previous employee's screens, so re-mount it on the session
      // that is actually current.
      if (getEmpCode(stored.user) !== getEmpCode(user)) {
        window.location.reload();
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [leaveForPortal, user]);

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
   *
   * The same listener does both jobs. `touchSession` re-stamps a session that is
   * still good and returns null for one that is not, so the first click, tap or
   * keypress after the deadline is what takes the user out — they never get to
   * open a tab on a dead session and find out from a failed request. The
   * interval is the backstop for a window nobody is touching.
   */
  useEffect(() => {
    if (!user) return undefined;

    const onActivity = () => {
      if (!touchSession()) leaveForPortal();
    };
    const events = ["mousedown", "keydown", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true })
    );

    const check = setInterval(() => {
      if (readSession()) return;
      leaveForPortal();
    }, CHECK_MS);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      clearInterval(check);
    };
  }, [user, leaveForPortal]);

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

  /**
   * Signs in from a portal hand-off token.
   *
   * Any session already in storage is replaced, not merged: the portal may have
   * been switched to a different employee since this browser last signed in,
   * and the token is the newer statement of who is here.
   */
  const loginWithPortalToken = async (token) => {
    try {
      const signedIn = await AuthService.loginWithPortalToken(token);
      startSession(signedIn);
      setUser(signedIn);
      return signedIn;
    } catch (err) {
      clearSession();
      setUser(null);
      throw err;
    }
  };

  /** The LOGOUT button. An expired session leaves by exactly the same door. */
  const logout = leaveForPortal;

  const forgetPassword = (empCode) => AuthService.forgetPassword(empCode);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithPortalToken,
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
