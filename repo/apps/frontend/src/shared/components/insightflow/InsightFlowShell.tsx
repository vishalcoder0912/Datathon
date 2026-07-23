import type { ReactNode } from "react";
import AppSidebar from "@/shared/layout/AppSidebar";
import { TopCommandBar } from "@/shared/components/insightflow/TopCommandBar";

export function InsightFlowShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <AppSidebar />
      <div className="min-h-screen pl-60">
        <TopCommandBar />
        <main className="px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
