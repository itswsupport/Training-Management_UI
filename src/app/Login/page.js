"use client";

import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";

/**
 * /Login is now a way out, not a way in.
 *
 * ETMS is entered from the REPL portal, which authenticates the employee and
 * hands over a token (src/app/[token]/page.js). Nobody signs in here any more,
 * so every arrival on this route — a session that ran out and refreshed, the
 * guard sending a visitor without a session here, someone typing the URL — does
 * exactly what LOGOUT does: clears whatever session is left and returns to the
 * portal.
 *
 * The form itself is kept in src/components/ui/common/Loginform.jsx, unused,
 * for the day password sign-in is wanted back.
 */
export default function LoginPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  // Nothing renders: the browser is on its way to the portal.
  return null;
}
