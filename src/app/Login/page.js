"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Loginform from "@/components/ui/common/Loginform";
import { useAuth } from "@/context/AuthContext";
import { getDefaultDashboardForUser } from "@/lib/permissions";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // An already signed-in visitor has no business on the login form.
  useEffect(() => {
    if (!loading && user) {
      router.replace(getDefaultDashboardForUser(user));
    }
  }, [user, loading, router]);

  if (loading || user) return null;

  return <Loginform />;
}
