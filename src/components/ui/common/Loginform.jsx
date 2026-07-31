"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { alerts } from "@/lib/alerts";
import { getDefaultDashboardForUser } from "@/lib/permissions";

export default function Loginform() {
  const { login, forgetPassword } = useAuth();

  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    setForgotMessage("");
    setLoading(true);

    try {
      const user = await login(empCode, password);

      // A hard navigation, not router.push: the session lives in localStorage,
      // and a full load guarantees AuthProvider re-reads it before the target
      // dashboard's guard runs.
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/etms";
      window.location.href = `${basePath}${getDefaultDashboardForUser(user)}`;
    } catch (err) {
      const message = err?.message || "Login failed. Please try again.";
      setLoginError(message);
      await alerts.error(message, "Login failed");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!empCode.trim()) {
      setForgotMessage("Enter your employee code first.");
      return;
    }
    setForgotLoading(true);
    setForgotMessage("");
    try {
      await forgetPassword(empCode);
      setForgotMessage("A reset link has been sent to your registered email.");
    } catch (err) {
      setForgotMessage(err?.message || "Could not process the request.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
      <div className="w-[360px] rounded-md border border-gray-300 bg-white p-8">
        {/* Logo */}
        <div className="mb-4 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/etms/rucha-logo.png"
            alt="Rucha Engineers"
            className="mb-1 h-16"
          />
          <h1 className="text-md font-bold tracking-wide text-[#3482AE]">
            RUCHA ENGINEERS PVT. LTD.
          </h1>
        </div>

        {/* Title */}
        <h2 className="mb-4 text-center text-sm font-semibold text-gray-700">
          TRAINING MANAGEMENT SYSTEM
        </h2>

        <form onSubmit={handleLogin}>
          {/* EMP CODE */}
          <div className="relative mb-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Employee Code"
              className="w-full rounded-md border border-gray-400 py-2 pr-4 pl-10 text-sm outline-none focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30"
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              autoFocus
              required
            />
            <User className="absolute top-2.5 left-3 h-4 w-4 text-gray-500" />
          </div>

          {/* PASSWORD */}
          <div className="relative mb-3">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              className="w-full rounded-md border border-gray-400 py-2 pr-10 pl-10 text-sm outline-none focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Lock className="absolute top-2.5 left-3 h-4 w-4 text-gray-500" />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-2.5 right-3 text-gray-500"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Links */}
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              className="text-xs font-semibold text-[#3482AE] hover:underline disabled:opacity-60"
            >
              {forgotLoading ? "Processing..." : "FORGET PASSWORD"}
            </button>
            <button
              className="rounded bg-[#3482AE] px-5 py-1.5 text-sm text-white transition-colors hover:bg-[#2a6a8f] disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "LOG IN"}
            </button>
          </div>

          {loginError ? (
            <div className="mb-2 text-xs text-red-600">{loginError}</div>
          ) : null}
          {forgotMessage ? (
            <div
              className={`mb-2 text-xs ${
                forgotMessage.includes("sent") ? "text-green-600" : "text-red-600"
              }`}
            >
              {forgotMessage}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
