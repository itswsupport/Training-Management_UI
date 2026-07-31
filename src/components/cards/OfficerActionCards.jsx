"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, FilePlus, List, MessageSquareText } from "lucide-react";

import StatusCard from "@/components/StatusCard";

/**
 * The four solid shortcut tiles across the top of every officer screen — the
 * same colour tiles payroll uses for its dashboard tabs, in the same
 * blue / amber / green / red order.
 *
 * ADD MODULE, ALL MODULES and FEEDBACK FORM are tabs: they swap the panel
 * below on the dashboard rather than navigating. COURSE STATUS is its own route
 * (the report is heavy enough to want one).
 *
 * @param {object} props
 * @param {string} [props.activeTab] which tab's panel is showing
 * @param {Function} [props.onSelectTab] called with the tab id. Omit it on a
 *   screen that has no panels — the tiles then navigate to the dashboard with
 *   that tab open.
 */
const TAB_CONFIG = [
  {
    id: "add",
    label: "ADD MODULE",
    icon: FilePlus,
    color: "bg-[#3482AE] hover:bg-[#2a6a8f]",
  },
  {
    id: "modules",
    // A list, not a pencil: the tile opens the module list, and editing a
    // course starts from the course itself.
    label: "ALL MODULES",
    icon: List,
    color: "bg-[#ffc107] hover:bg-[#e0a800]",
  },
  {
    id: "status",
    href: "/TrainingOfficerDashboard/courseStatus",
    label: "COURSE STATUS",
    icon: ClipboardCheck,
    color: "bg-[#20c997] hover:bg-[#1aa179]",
  },
  {
    id: "feedback",
    label: "FEEDBACK FORM",
    icon: MessageSquareText,
    color: "bg-[#dc3545] hover:bg-[#c82333]",
  },
];

export default function OfficerActionCards({ activeTab, onSelectTab }) {
  const router = useRouter();
  const pathname = usePathname();

  const select = (tab) => {
    if (tab.href) {
      router.push(tab.href);
      return;
    }
    if (onSelectTab) onSelectTab(tab.id);
    else router.push(`/TrainingOfficerDashboard?tab=${tab.id}`);
  };

  return (
    <nav className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {TAB_CONFIG.map((tab) => (
        <StatusCard
          key={tab.id}
          label={tab.label}
          Icon={tab.icon}
          color={tab.color}
          isActive={tab.href ? pathname === tab.href : activeTab === tab.id}
          onClick={() => select(tab)}
        />
      ))}
    </nav>
  );
}
