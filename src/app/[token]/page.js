"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { decryptPortalToken } from "@/lib/token";
import { getDefaultDashboardForUser, isTokenLoginRoute } from "@/lib/permissions";

/**
 * Portal hand-off: `https://replportal.co.in/etms/<token>`.
 *
 * The portal's dashboard encrypts the employee code it already has and sends
 * the browser here. This page turns that token back into a session and gets out
 * of the way. The password form at /Login stays for anyone reaching the app
 * directly.
 *
 * This is the app's catch-all single-segment route, so a mistyped URL — /login
 * rather than /Login, matching being case-sensitive — lands here too. Those are
 * sent to the login form rather than reported as a token failure.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/etms";

/**
 * Tokens already spent, kept at module level rather than in a ref: React's
 * strict mode runs effects twice, and ProtectedLayout remounts its children the
 * moment the user state flips — either would otherwise redeem the same token a
 * second time.
 */
const processedTokens = new Set();

export default function TokenLoginPage() {
  const { user, loading, loginWithEmpCode } = useAuth();
  const router = useRouter();
  const params = useParams();

  const [error, setError] = useState(null);

  const token = typeof params?.token === "string" ? params.token : "";

  useEffect(() => {
    if (loading || error) return;

    // Not a token at all — a mistyped path that fell through to this route.
    if (!isTokenLoginRoute(`/${token}`)) {
      router.replace(user ? getDefaultDashboardForUser(user) : "/Login");
      return;
    }

    if (processedTokens.has(token)) return;
    processedTokens.add(token);

    (async () => {
      try {
        const empCode = await decryptPortalToken(token);
        const signedIn = await loginWithEmpCode(empCode);

        // A hard navigation, matching the login form: the session lives in
        // localStorage, and a full load guarantees AuthProvider re-reads it
        // before the target dashboard's guard runs. It also drops the token
        // from the address bar rather than leaving it in history.
        window.location.replace(
          `${BASE_PATH}${getDefaultDashboardForUser(signedIn)}`
        );
      } catch (err) {
        setError(err?.message || "Sign-in from the portal failed.");
      }
    })();
    // AuthProvider hands out a new `loginWithEmpCode` on every render, so this
    // effect re-runs freely. That is harmless: `processedTokens` above turns
    // every run after the first into a no-op, and the redirect branch is
    // idempotent.
  }, [token, user, loading, error, router, loginWithEmpCode]);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md rounded-md border border-gray-300 bg-white p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE_PATH}/rucha-logo.png`}
            alt="Rucha Engineers"
            className="mx-auto mb-4 h-14"
          />
          <h1 className="mb-2 text-center text-lg font-semibold text-red-600">
            Sign-in failed
          </h1>
          <p className="mb-6 text-center text-sm whitespace-pre-wrap text-gray-700">
            {error}
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => router.replace("/Login")}
              className="rounded bg-[#3482AE] px-5 py-1.5 text-sm text-white transition-colors hover:bg-[#2a6a8f]"
            >
              GO TO LOGIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-gray-100">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#3482AE]" />
      <p className="text-sm text-gray-600">Signing you in…</p>
    </div>
  );
}
