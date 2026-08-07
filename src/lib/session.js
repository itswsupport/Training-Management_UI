"use client";

import { clearCourseGrants } from "@/lib/courseGrant";

/**
 * How long a signed-in session lasts.
 *
 * The backend issues no token — `LoginUser.token` is declared, never set, and
 * comes back null — so there is nothing with an expiry in it to honour. Until
 * it does, the deadline is kept here: without one, the record written at login
 * simply sits in localStorage and signs the user back in on every refresh, for
 * ever, on a shared shop-floor machine as readily as on their own.
 */

/** A session cannot outlive this, however active the user is. One shift. */
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;

/** …nor survive this long untouched. */
const MAX_IDLE_MS = 60 * 60 * 1000;

const STORAGE_KEY = "etms_user";

/** Reads the stored session, or null when there is none worth restoring. */
export function readSession(now = Date.now()) {
  if (typeof window === "undefined") return null;

  let stored;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "undefined") return null;
    stored = JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }

  // Written before sessions had a deadline: honoured once and stamped, so
  // nobody signed in today is thrown out by this arriving.
  if (stored && !stored.endsAt && !stored.user) {
    return { user: stored, endsAt: now + MAX_SESSION_MS, seenAt: now };
  }

  if (!stored?.user) {
    clearSession();
    return null;
  }
  if (now > stored.endsAt || now - stored.seenAt > MAX_IDLE_MS) {
    clearSession();
    return null;
  }
  return stored;
}

/** Starts a session at sign-in. */
export function startSession(user, now = Date.now()) {
  write({ user, endsAt: now + MAX_SESSION_MS, seenAt: now });
}

/**
 * Marks the session as still in use.
 *
 * Only the idle clock moves — `endsAt` is fixed at sign-in, so a session cannot
 * be kept alive indefinitely by leaving a tab open.
 */
export function touchSession(now = Date.now()) {
  const session = readSession(now);
  if (!session) return null;
  write({ ...session, seenAt: now });
  return session;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* a blocked or full storage must not break signing out */
  }
  // The course the session was last navigated to goes with it, or the next
  // person to sign in on this browser could open it by typing its id.
  clearCourseGrants();
}

/** The token to send with API calls, once the backend ever issues one. */
export function sessionToken() {
  const session = readSession();
  const token = session?.user?.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function write(session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* nothing to be done; the session simply will not survive a refresh */
  }
}
