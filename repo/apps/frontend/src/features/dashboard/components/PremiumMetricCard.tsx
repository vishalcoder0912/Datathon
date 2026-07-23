import { BarChart3, BadgeCheck, Gauge, Landmark, Maximize2, Rows3 } from "lucide-react";
import type { PremiumKpi } from "@/features/dashboard/types/premiumDashboardTypes";

const iconMap = {
  rows: Rows3,
  average: BarChart3,
  median: Gauge,
  max: Maximize2,
  segments: Landmark,
  quality: BadgeCheck,
};

export function PremiumMetricCard({ kpi, featured = false }: { kpi: PremiumKpi; featured?: boolean }) {
  const Icon = iconMap[kpi.icon || "average"];

  return (
    <article
      className={`group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md ${
        featured ? "min-h-[136px]" : "min-h-[118px] 2xl:col-span-2"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-100 bg-violet-50 text-violet-600">
          <Icon className={featured ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
        </div>
        {kpi.delta && (
          <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {kpi.delta}
          </span>
        )}
      </div>
      <p className="mt-4 break-words text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{kpi.title}</p>
      <p className={`mt-1 break-words font-black tracking-tight text-slate-950 ${featured ? "text-3xl" : "text-2xl"}`}>{kpi.value}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{kpi.subtitle}</p>
    </article>
  );
}
