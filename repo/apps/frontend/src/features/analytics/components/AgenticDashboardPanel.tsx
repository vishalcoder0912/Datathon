import { BarChart3, Grid } from "lucide-react";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

const safeArray = (arr: unknown) => (Array.isArray(arr) ? arr : []);
const safeText = (txt: unknown, fallback = "-") =>
  typeof txt === "string" || typeof txt === "number" ? String(txt) : fallback;

interface AgenticDashboardPanelProps {
  kpis: Record<string, unknown>[];
  charts: Record<string, unknown>[];
}

export default function AgenticDashboardPanel({ kpis, charts }: AgenticDashboardPanelProps) {
  return (
    <div className="space-y-6">
      {/* Deterministic KPIs Grid */}
      <div className={CARD}>
        <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
          <Grid className="size-4 text-purple-400" />
          Dashboard Preview
        </h3>
        <p className="text-slate-400 text-[11px] mt-1">
          These metrics are calculated mathematically using local query aggregation tools.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {safeArray(kpis).map((kpi: Record<string, unknown>, idx: number) => {
            const colors = [
              "border-blue-500/20 bg-blue-500/5",
              "border-purple-500/20 bg-purple-500/5",
              "border-cyan-500/20 bg-cyan-500/5",
              "border-amber-500/20 bg-amber-500/5",
            ];
            return (
              <div key={idx} className={`rounded-xl border p-4 shadow-sm ${colors[idx % colors.length]}`}>
                <p className="text-xs text-slate-450 truncate font-semibold capitalize">
                  {safeText(kpi.label || kpi.id).replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-xl font-bold text-white">
                  {safeText(
                    kpi.value ?? "N/A"
                  )}
                </p>
                <span className="text-[10px] text-slate-500 block mt-1 font-mono uppercase">
                  Agg: {safeText(kpi.type)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Suggestions */}
      <div className={CARD}>
        <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
          <BarChart3 className="size-4 text-sky-400" />
          Recommended Chart Configurations
        </h3>

        <div className="mt-4 space-y-4">
          {safeArray(charts).map((chart: Record<string, unknown>, idx: number) => (
            <div
              key={idx}
              className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row md:items-start md:justify-between gap-4 hover:bg-slate-950/60 transition"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider text-sky-400 uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/25">
                    {safeText(chart.type)}
                  </span>
                  <h4 className="font-bold text-slate-100 text-sm capitalize">
                    {safeText(chart.title)}
                  </h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  {safeText(chart.reason)}
                </p>
              </div>

              <div className="text-xs font-mono text-slate-500 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-900 shrink-0">
                <div>X-Axis: <span className="text-slate-300 font-bold">{safeText(chart.x)}</span></div>
                <div className="mt-1">Y-Axis: <span className="text-slate-300 font-bold">{safeText(chart.y)}</span></div>
                <div className="mt-1">Agg: <span className="text-slate-400 font-semibold">{safeText(chart.aggregation)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
