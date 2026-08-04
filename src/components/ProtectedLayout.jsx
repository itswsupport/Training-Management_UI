"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HelpCircle, LogOut, Menu } from "lucide-react";

/** The manual page. Written out in full because it opens in a new tab. */
const MANUAL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH || "/etms"}/user-guide`;

import { AppSidebar } from "@/components/app-sidebar";
import ScrollFooter from "@/components/ScrollFooter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  canAccessRoute,
  getAllUserRoles,
  getDefaultDashboardForUser,
  isChromelessRoute,
  isPublicRoute,
} from "@/lib/permissions";

export default function ProtectedLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isAuthPage = isPublicRoute(pathname);

  // Checked synchronously on every render so protected content never flashes
  // before the redirect effect runs.
  const hasRouteAccess = useMemo(() => {
    if (!user || isAuthPage) return true;
    return canAccessRoute(user, pathname);
  }, [user, pathname, isAuthPage]);

  useEffect(() => {
    if (loading) return;

    if (!user && !isAuthPage) {
      router.replace("/Login");
      return;
    }

    if (user && !isAuthPage && !hasRouteAccess && !isRedirecting) {
      setIsRedirecting(true);
      // Brief pause so the access-denied card is actually readable.
      setTimeout(() => router.replace(getDefaultDashboardForUser(user)), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, pathname, hasRouteAccess]);

  // Reset the guard when the user navigates away.
  useEffect(() => {
    setIsRedirecting(false);
  }, [pathname]);

  // While loading, or signed out on a protected page, render nothing rather
  // than a frame that will immediately be replaced.
  if (loading || (!user && !isAuthPage)) return null;

  // Signed out on the login page: no shell, just the form.
  if (!user) return <>{children}</>;

  if (!hasRouteAccess) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-100">
        <div className="w-[90%] max-w-md rounded-lg bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-6xl">🚫</div>
          <h1 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mb-4 text-gray-600">
            You don&apos;t have permission to access this page.
          </p>
          <p className="mb-4 text-sm text-gray-500">
            Your role:{" "}
            <span className="font-semibold">
              {getAllUserRoles(user).join(", ") || "NONE"}
            </span>
          </p>
          <p className="text-sm text-gray-400">
            Redirecting you to your dashboard...
          </p>
          <div className="mt-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#3482AE]" />
          </div>
        </div>
      </div>
    );
  }

  // A document rather than a screen: no sidebar, no header bar, and it scrolls
  // itself because there is no <main> around it to do so. The access checks
  // above still ran, so this is the frame being dropped, not the guard.
  if (isChromelessRoute(pathname)) {
    return <div className="h-screen w-full overflow-auto">{children}</div>;
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <AppSidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header
          className="z-10 flex items-center justify-between bg-[#3482AE] px-3 py-2 text-white"
          style={{ minHeight: 44 }}
        >
          <SidebarTrigger className="border-none bg-transparent p-0 shadow-none hover:bg-transparent">
            <Menu className="h-6 w-6" />
          </SidebarTrigger>
          <div className="flex items-center space-x-4">
            {/* Opens in its own tab so whatever the user was part-way through
                — a video, a half-answered assignment — is still there behind
                it. A plain anchor rather than next/link: target="_blank" wants
                a real navigation, and the basePath has to be written in either
                way. The manual carries its own PDF download. */}
            <a
              href={MANUAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the ETMS user manual"
              className="flex items-center space-x-2 rounded px-3 py-1.5 transition-colors hover:bg-teal-500"
            >
              <HelpCircle className="h-5 w-5" />
              <span>HELP</span>
            </a>
            <button
              className="flex items-center space-x-2 rounded px-3 py-1.5 transition-colors hover:bg-teal-500"
              onClick={logout}
            >
              <LogOut className="h-5 w-5" />
              <span>LOGOUT</span>
            </button>
          </div>
        </header>
        {/* ScrollFooter is absolutely positioned over the bottom of this
            column, so the scroll area needs padding to clear it — otherwise the
            last line of every page sits underneath the footer. */}
        <main
          className="flex-1 overflow-auto bg-[#f4f6f9] pb-16"
          id="main-content"
        >
          {children}
        </main>
        <ScrollFooter />
      </div>
    </div>
  );
}
