"use client";

import { useEffect } from "react";

import Loginform from "@/components/ui/common/Loginform";
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
 * The one exception is local development. There is no portal to be handed over
 * from on a developer's machine, so the bounce to replportal.co.in leaves the
 * app with no way in at all. NEXT_PUBLIC_ENABLE_LOCAL_LOGIN brings the password
 * form back — the same /login the backend has always had, not a bypass, so it
 * still wants a real employee code and password. It is read from .env.local,
 * which is gitignored and never present in a deployed build, so production
 * keeps the bounce whatever this file says.
 */
const LOCAL_LOGIN = process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN === "true";

export default function LoginPage() {
  const { logout } = useAuth();

  useEffect(() => {
    if (LOCAL_LOGIN) return;
    logout();
  }, [logout]);

  if (LOCAL_LOGIN) return <Loginform />;

  // Nothing renders: the browser is on its way to the portal.
  return null;
}
