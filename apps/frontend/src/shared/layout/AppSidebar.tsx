import { NavLink, useLocation } from "react-router-dom";
import {
  Shield,
  Map,
  TrendingUp,
  GitBranch,
  Users,
  AlertTriangle,
  BarChart3,
  Bot,
  Bell,
  FileText,
  Database,
  Sparkles,
  MessageSquare,
  Table2,
  Upload,
  BrainCircuit,
  FileUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import type { KavachRole } from "@/kavach/api/types";
import { useImportData } from "@/kavach/context/ImportDataContext";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: KavachRole[];
  badge?: boolean;
}

const kavachNavItems: NavigationItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: Shield },
  { label: "Intelligence OS", to: "/intelligence-os", icon: BrainCircuit },
  { label: "Geo Intelligence", to: "/geo-intelligence", icon: Map },
  { label: "Trend Intelligence", to: "/trend-intelligence", icon: TrendingUp },
  { label: "Network Intelligence", to: "/network-intelligence", icon: GitBranch },
  {
    label: "Person Links",
    to: "/offenders",
    icon: Users,
    roles: ["STATE_ADMIN", "DISTRICT_OFFICER", "STATION_OFFICER", "INVESTIGATOR", "SCRB_ANALYST", "EVALUATOR"] as KavachRole[],
  },
  { label: "Risk Intelligence", to: "/risk-intelligence", icon: AlertTriangle },
  { label: "Social Intelligence", to: "/social-intelligence", icon: BarChart3 },
  { label: "AI Copilot", to: "/ai-copilot", icon: Bot },
  { label: "Alerts", to: "/alerts", icon: Bell },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Import Data", to: "/import-data", icon: FileUp, badge: true },
  {
    label: "Data Management",
    to: "/data-management",
    icon: Database,
    roles: ["STATE_ADMIN", "DATA_ENGINEER", "AUDITOR"] as KavachRole[],
  },
];

const legacyNavItems = [
  { label: "InsightFlow Dashboard", to: "/insightflow-dashboard", icon: Sparkles },
  { label: "Data Table", to: "/data", icon: Table2 },
  { label: "Upload", to: "/upload", icon: Upload },
  { label: "PDF Intelligence", to: "/pdf", icon: FileText },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "AI Chat", to: "/chat", icon: MessageSquare },
  { label: "Agentic AI", to: "/agentic", icon: Sparkles },
  { label: "Data Science", to: "/agentic-data-science", icon: BrainCircuit },
];

function isActivePath(currentPath: string, itemPath: string) {
  if (itemPath === "/dashboard") return currentPath === "/" || currentPath === "/dashboard";
  if (itemPath === "/pdf") return currentPath === "/pdf" || currentPath === "/pdf-upload";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export default function AppSidebar() {
  const location = useLocation();
  const { isDemoSession, logout, user } = useAuth();
  const { hasCustomData, importedCount, lastImportAt } = useImportData();
  const visibleKavachItems = kavachNavItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.roleCode))
  );

  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-[#0F172A] text-white">
      {/* Logo */}
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0891B2] shadow-lg shadow-blue-500/30">
          <Shield className="size-5" />
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">KAVACH AI</div>
          <div className="text-xs text-slate-300">Karnataka Crime Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        {/* ── Command Centre ── */}
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Command Centre
        </p>

        {visibleKavachItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);
          const showBadge = item.badge && hasCustomData;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                active
                  ? "bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#15803D] px-1.5 text-[10px] font-bold text-white animate-pulse">
                  {importedCount > 999 ? "999+" : importedCount}
                </span>
              )}
              {item.to === "/import-data" && !hasCustomData && (
                <span className="flex size-2 rounded-full bg-[#0891B2]" />
              )}
            </NavLink>
          );
        })}

        {/* ── Legacy ── */}
        <div className="my-4 border-t border-white/10" />
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Legacy
        </p>

        {legacyNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-300"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {/* Custom data indicator */}
        {hasCustomData && (
          <div className="flex items-center gap-2 rounded-lg bg-[#15803D]/20 border border-[#15803D]/30 px-3 py-2">
            <span className="flex size-2 shrink-0 rounded-full bg-[#15803D] animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#4ade80]">CUSTOM DATA ACTIVE</p>
              <p className="text-[10px] text-slate-400 truncate">
                {importedCount.toLocaleString()} records · {lastImportAt ? new Date(lastImportAt).toLocaleTimeString() : ""}
              </p>
            </div>
          </div>
        )}

        {isDemoSession && (
          <div className="rounded-md bg-amber-400/15 px-2 py-1 text-[11px] font-semibold text-amber-200">
            DEMO DATA MODE
          </div>
        )}
        <p className="truncate px-2 text-xs font-semibold text-slate-200">{user?.displayName}</p>
        <p className="truncate px-2 text-[11px] text-slate-400">{user?.roleCode.replaceAll("_", " ")}</p>
        {!isDemoSession && (
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}
