"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { getDefaultDashboardForUser } from "@/lib/permissions";

/** Entry point: send the visitor to their dashboard, or to the login form. */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? getDefaultDashboardForUser(user) : "/Login");
  }, [user, loading, router]);

  return null;
}
