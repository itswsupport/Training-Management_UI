"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The feedback question bank is now the FEEDBACK FORM tab on the dashboard, not
 * a page of its own. This route is kept so existing links and bookmarks still
 * work: it sends the officer to the dashboard with that tab open.
 */
export default function FeedbackFormPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/TrainingOfficerDashboard?tab=feedback");
  }, [router]);

  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3482AE]"></div>
        </div>
      </div>
    </div>
  );
}
