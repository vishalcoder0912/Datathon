import { BarChart3, Copy, Download, Edit3, Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

const palette = ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#6d28d9", "#9333ea"];

const shortTick = (value: unknown) => {
  const text = String(value ?? "");
  return text.length > 12 ? `${text.slice(0, 11)}…` : text;
};

const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  color: "#0f172a",
  boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
};

function ChartBody({ chart }: { chart: PremiumChart }) {
  const xKey = chart.xKey || "label";
  const yKey = chart.yKey || "value";

  if (!Array.isArray(chart.data) || !chart.data.length) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
        <div>
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{chart.title || "Empty chart"}</h3>
          <p className="mt-1 text-xs text-slate-500">No usable chart data yet. Change the field, aggregation, or filter.</p>
        </div>
      </div>
    );
  }

  if (chart.type === "donut") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chart.data} dataKey={yKey} nameKey={xKey} innerRadius={66} outerRadius={96} paddingAngle={3}>
            {chart.data.map((entry, index) => (
              <Cell key={`${String(entry[xKey] ?? entry.label ?? "slice")}-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "scatter") {
    const data = chart.data.length > 150 ? chart.data.filter((_, index) => index % Math.ceil(chart.data.length / 150) === 0) : chart.data;
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 18, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey={chart.xKey || "x"} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis dataKey={chart.yKey || "y"} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#7c3aed" fillOpacity={0.72} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chart.data} margin={{ top: 10, right: 18, bottom: 20, left: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={shortTick} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={yKey} stroke="#7c3aed" strokeWidth={3} dot={{ r: 4, fill: "#7c3aed", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "histogram" || chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chart.data} margin={{ top: 10, right: 18, bottom: 30, left: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={shortTick} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={yKey} radius={[10, 10, 0, 0]} fill="#7c3aed">
            {chart.data.map((entry, index) => (
              <Cell key={`${String(entry[xKey] ?? entry.label ?? "bar")}-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "table") {
    const rows = chart.data.slice(0, 8);
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={`${String(row[xKey] ?? row.label ?? index)}-${index}`}>
                <td className="px-4 py-3 font-semibold text-slate-400">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{String(row[xKey] ?? row.label ?? "Unknown")}</td>
                <td className="px-4 py-3 font-bold text-violet-700">{numberValue(row[yKey] ?? row.value).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      Map charts are available only for real geographic datasets.
    </div>
  );
}

export interface PremiumChartCardProps {
  chart: PremiumChart;
  isVisible?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (chartId: string) => void;
  onRemove?: (chartId: string) => void;
  onDuplicate?: (chartId: string) => void;
  onToggleVisibility?: (chartId: string) => void;
  onReload?: (chartId: string) => void;
}

export default function PremiumChartCard({
  chart,
  isVisible = true,
  isLoading = false,
  error = null,
  onEdit,
  onRemove,
  onDuplicate,
  onToggleVisibility,
  onReload,
}: PremiumChartCardProps) {
  if (isLoading) {
    return <div className="min-h-[360px] animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />;
  }

  if (error) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-3xl border border-rose-100 bg-white p-6 text-center shadow-sm">
        <div>
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-950">Failed to render chart</h4>
          <p className="mt-1 max-w-xs text-xs text-slate-500">{error}</p>
          {onReload && (
            <button onClick={() => onReload(chart.id)} className="mt-4 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white" type="button">
              Retry Load
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`group relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md ${chart.type === "map" ? "xl:col-span-2" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-950">{chart.title}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">{chart.subtitle || chart.type}</p>
        </div>
        <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">{chart.type}</span>
      </div>

      <ChartBody chart={chart} />

      {(onEdit || onRemove || onDuplicate || onToggleVisibility) && (
        <div className="absolute right-4 top-4 flex gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1 opacity-0 shadow-lg shadow-slate-200/70 backdrop-blur transition-opacity group-hover:opacity-100">
          {onEdit && <button onClick={() => onEdit(chart.id)} className="rounded-xl p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700" type="button" title="Edit chart"><Edit3 className="h-3.5 w-3.5" /></button>}
          {onDuplicate && <button onClick={() => onDuplicate(chart.id)} className="rounded-xl p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700" type="button" title="Duplicate chart"><Copy className="h-3.5 w-3.5" /></button>}
          {onToggleVisibility && <button onClick={() => onToggleVisibility(chart.id)} className="rounded-xl p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700" type="button" title="Toggle visibility">{isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>}
          {onRemove && <button onClick={() => onRemove(chart.id)} className="rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" type="button" title="Remove chart"><Trash2 className="h-3.5 w-3.5" /></button>}
          <button className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900" type="button" title="Export chart"><Download className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </motion.section>
  );
}
