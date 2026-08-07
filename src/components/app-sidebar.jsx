"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  Home,
  LogOut,
  User,
  UserCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  AUTHORITY_TRAINING_OFFICER,
  getDisplayName,
  getUserRole,
  isTrainingOfficer,
} from "@/lib/permissions";

/** Dashboard key → the route it opens. */
const ROLE_ROUTES = {
  USER: "/UserDashboard",
  [AUTHORITY_TRAINING_OFFICER]: "/TrainingOfficerDashboard",
};

const ROLE_ICONS = {
  USER: UserCheck,
  [AUTHORITY_TRAINING_OFFICER]: GraduationCap,
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const displayName = getDisplayName(user);
  const displayRole = `[${getUserRole(user) ?? "USER"}]`;

  // Every dashboard this user may open. USER is always present; the officer
  // dashboard only appears for someone the backend granted that authority.
  const dashboards = ["USER"];
  if (isTrainingOfficer(user)) dashboards.push(AUTHORITY_TRAINING_OFFICER);

  const isActive = (route) =>
    pathname === route || pathname.startsWith(`${route}/`);

  return (
    <Sidebar className="w-64 bg-[#3482AE] text-white flex flex-col h-screen">
      {/* Header */}
      <SidebarHeader className="p-4 border-b border-white/30">
        <div className="flex items-center space-x-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/etms/rucha-logo-white.png"
            alt="Rucha Engineers"
            className="h-10 w-auto object-contain"
          />
          <span className="font-bold text-base tracking-wide whitespace-nowrap">
            REPL ETMS
          </span>
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="p-0 border-b border-white/60">
        <div className="px-4 py-3 flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center bg-[#f5f5f5]">
            <User className="w-7 h-7 text-[#3482AE]" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight text-sm truncate">
              {displayName}
            </div>
            <div className="text-xs text-white/70 uppercase tracking-wider">
              {displayRole}
            </div>
          </div>
        </div>

        <hr className="border-t border-white/60 my-2" />

        <nav className="px-4 py-2 text-xl text-white border-white border-opacity-80">
          <SidebarGroup>
            <ul className="space-y-0">
              {/* HOME — the group portal the ETMS sits inside. Leaving for it
                  ends the session, exactly as LOGOUT does: this is the way out
                  of the app, and a session left behind on a shop-floor machine
                  is the thing the deadline exists to prevent. It was a plain
                  link with the portal URL written into it, which walked away
                  from the app leaving the session standing. */}
              <li>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center space-x-4 px-4 py-3 rounded-none hover:bg-[#2a6a8f] font-semibold text-lg w-full text-left"
                >
                  <Home className="w-7 h-7" />
                  <span>HOME</span>
                </button>
              </li>

              {dashboards.map((key) => {
                const route = ROLE_ROUTES[key];
                const Icon = ROLE_ICONS[key] ?? User;
                return (
                  <li key={key}>
                    <button
                      onClick={() => router.push(route)}
                      className={`flex items-center space-x-4 px-4 py-3 font-semibold text-lg w-full text-left ${
                        isActive(route) ? "bg-[#1e7ca0]" : "hover:bg-[#2a6a8f]"
                      }`}
                    >
                      <Icon className="w-7 h-7" />
                      <span>{key}</span>
                    </button>
                  </li>
                );
              })}

              {/* LOGOUT */}
              <li>
                <button
                  onClick={logout}
                  className="flex items-center space-x-4 px-4 py-3 hover:bg-[#2a6a8f] font-semibold text-lg w-full text-left"
                >
                  <LogOut className="w-7 h-7" />
                  <span>LOGOUT</span>
                </button>
              </li>
            </ul>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
