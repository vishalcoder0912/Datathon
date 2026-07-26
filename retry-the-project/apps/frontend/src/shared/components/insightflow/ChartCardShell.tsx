import type { ReactNode } from "react";
import { MoreHorizontal, Sparkles } from "lucide-react";

type ChartCardShellProps = {
  title: string;
  subtitle: string;
  metricUsed?: string;
  calculationSource?: string;
  chartType?: string;
  isNew?: boolean;
  children: ReactNode;
};

export function ChartCardShell({
  title,
  subtitle,
  metricUsed,
  calculationSource,
  chartType = "bar",
  isNew,
  children,
}: ChartCardShellProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 p-4">
        <div>
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            Explain
          </button>

          <select
            defaultValue={chartType}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none"
          >
            <option value="bar">bar</option>
            <option value="line">line</option>
            <option value="donut">donut</option>
            <option value="histogram">histogram</option>
            <option value="horizontal">horizontal</option>
          </select>

          <button className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:bg-slate-50">
            <MoreHorizontal className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="min-h-[280px] px-4 pb-4">{children}</div>

      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>Metric Used: {metricUsed ?? "auto"}</span>
        <span>Calculation Source: {calculationSource ?? "schema-safe local calculation"}</span>
      </div>

      {isNew ? (
        <div className="px-4 pb-3 text-xs font-semibold text-emerald-600">
          New - Added by AI
        </div>
      ) : null}
    </section>
  );
}
