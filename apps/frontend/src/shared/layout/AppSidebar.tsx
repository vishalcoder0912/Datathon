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
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

const kavachNavItems = [
  { label: "Dashboard", to: "/dashboard", icon: Shield },
  { label: "Geo Intelligence", to: "/geo-intelligence", icon: Map },
  { label: "Trend Intelligence", to: "/trend-intelligence", icon: TrendingUp },
  { label: "Network Intelligence", to: "/network-intelligence", icon: GitBranch },
  { label: "Offenders", to: "/offenders", icon: Users },
  { label: "Risk Intelligence", to: "/risk-intelligence", icon: AlertTriangle },
  { label: "Social Intelligence", to: "/social-intelligence", icon: BarChart3 },
  { label: "AI Copilot", to: "/ai-copilot", icon: Bot },
  { label: "Alerts", to: "/alerts", icon: Bell },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Data Management", to: "/data-management", icon: Database },
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

  return (
    <aside className="sticky top-0 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-[#0F172A] text-white">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0891B2] shadow-lg shadow-blue-500/30">
          <Shield className="size-5" />
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">KAVACH AI</div>
          <div className="text-xs text-slate-300">Karnataka Crime Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Command Centre
        </p>

        {kavachNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all",
                active
                  ? "bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}

        <div className="my-4 border-t border-white/10" />
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
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
                "flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium transition-all",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-300",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
