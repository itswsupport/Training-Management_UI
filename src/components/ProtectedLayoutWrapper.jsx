"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// ✅ Dynamically import your actual client-only layout
const ProtectedLayout = dynamic(() => import("./ProtectedLayout"), {
  ssr: false,
});

export default function ProtectedLayoutWrapper({ children }) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <ProtectedLayout>{children}</ProtectedLayout>
    </Suspense>
  );
}
