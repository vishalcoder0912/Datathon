import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BrainCircuit,
  FileText,
  Grid2X2,
  MessageSquare,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: Grid2X2 },
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
    <aside className="sticky top-0 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-[#061A33] text-white">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] shadow-lg shadow-violet-500/30">
          <Sparkles className="size-5" />
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">InsightFlow</div>
          <div className="text-xs text-slate-300">Agentic AI Analytics</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Menu
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all",
                active
                  ? "bg-gradient-to-r from-[#7C3AED] to-[#2563EB] text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
}
