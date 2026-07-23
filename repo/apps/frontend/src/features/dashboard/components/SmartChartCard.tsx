import { Fragment, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, MoreHorizontal, Trash2, Copy, AlertCircle, Edit3, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ChartType } from "@/features/dashboard/types/dashboardTypes";
import type { DashboardChart } from "@/features/dashboard/utils/dashboardAnalytics";

const COLORS = ["#7C3AED", "#2563EB", "#06B6D4", "#22C55E", "#F59E0B", "#EF4444"];
const VALUE_KEY_CANDIDATES = ["value", "count", "average", "sum", "total", "metricValue"];
const LABEL_KEY_CANDIDATES = ["name", "range", "label", "category"];

type Props = {
  chart: DashboardChart;
  availableTypes?: ChartType[];
  onTypeChange?: (type: ChartType) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
};

function downloadTextFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadSvgOrPng(root: HTMLDivElement | null, fileName: string, kind: "svg" | "png") {
  const svg = root?.querySelector("svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(svg);

  if (kind === "svg") {
    downloadTextFile(`${fileName}.svg`, svgText, "image/svg+xml;charset=utf-8");
    return;
  }

  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to render chart image."));
    image.src = encoded;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(svg.clientWidth, 900);
  canvas.height = Math.max(svg.clientHeight, 520);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.png`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function HeatmapChart({ data }: { data: Array<Record<string, string | number>> }) {
  const xLabels = Array.from(new Set(data.map((item) => String(item.x))));
  const yLabels = Array.from(new Set(data.map((item) => String(item.y))));

  const getColor = (value: number) => {
    const opacity = Math.min(Math.abs(value), 1);
    return value >= 0
      ? `rgba(37, 99, 235, ${0.12 + opacity * 0.68})`
      : `rgba(239, 68, 68, ${0.12 + opacity * 0.68})`;
  };

  return (
    <div className="grid gap-2">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `120px repeat(${xLabels.length}, minmax(0, 1fr))` }}
      >
        <div />
        {xLabels.map((label) => (
          <div key={label} className="truncate px-1 text-center text-xs text-slate-500">
            {label}
          </div>
        ))}
        {yLabels.map((rowLabel) => (
          <Fragment key={rowLabel}>
            <div key={`${rowLabel}-label`} className="truncate px-1 py-2 text-xs text-slate-600">
              {rowLabel}
            </div>
            {xLabels.map((columnLabel) => {
              const cell = data.find(
                (item) => String(item.x) === columnLabel && String(item.y) === rowLabel,
              );
              const value = Number(cell?.value ?? 0);

              return (
                <div
                  key={`${rowLabel}-${columnLabel}`}
                  className="flex h-12 items-center justify-center rounded-xl border text-xs font-medium text-gray-900"
                  style={{ background: getColor(value) }}
                  title={`${rowLabel} x ${columnLabel}: ${value}`}
                >
                  {value.toFixed(2)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function hasNumericValue(data: Array<Record<string, string | number>>, key?: string) {
  if (!key) return false;
  return data.some((entry) => Number.isFinite(Number(entry[key])));
}

function hasAnyValue(data: Array<Record<string, string | number>>, key?: string) {
  if (!key) return false;
  return data.some((entry) => entry[key] !== undefined && entry[key] !== null && String(entry[key]).trim() !== "");
}

function pickFirstKey(data: Array<Record<string, string | number>>, keys: string[], predicate = hasAnyValue) {
  return keys.find((key) => predicate(data, key));
}

export default function SmartChartCard({
  chart,
  availableTypes = [
    "bar",
    "horizontalBar",
    "line",
    "area",
    "pie",
    "donut",
    "histogram",
    "scatter",
    "radar",
    "composed",
    "heatmap",
  ],
  onTypeChange,
  onRemove,
  onDuplicate,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const empty = !chart.data?.length;
  const normalizedType = chart.type === "horizontal_bar" ? "horizontalBar" : chart.type;
  const isHorizontalBar = normalizedType === "horizontalBar";
  const isCountChart = chart.aggregation === "count" || chart.yKey === "count" || normalizedType === "histogram";
  const renderXKey =
    normalizedType === "histogram"
      ? pickFirstKey(chart.data, ["range", "name", chart.xKey]) || chart.xKey
      : hasAnyValue(chart.data, chart.xKey)
        ? chart.xKey
        : pickFirstKey(chart.data, LABEL_KEY_CANDIDATES) || chart.xKey;
  const renderYKey =
    hasNumericValue(chart.data, chart.yKey)
      ? chart.yKey
      : pickFirstKey(
          chart.data,
          isCountChart ? ["count", "value", chart.yKey, ...VALUE_KEY_CANDIDATES] : ["value", chart.yKey, ...VALUE_KEY_CANDIDATES],
          hasNumericValue,
        ) || chart.yKey;

  const pieData = useMemo(
    () =>
      chart.data.map((entry, index) => ({
        ...entry,
        fill: COLORS[index % COLORS.length],
      })),
    [chart.data],
  );

  const fileName = chart.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[#0F172A]">{chart.title}</h3>
          <p className="truncate text-xs text-gray-500">
            {chart.subtitle || `${chart.aggregation.toUpperCase()} - ${chart.xKey} / ${chart.yKey}`}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button type="button" className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] shadow-sm">
            <Sparkles className="mr-1 inline size-3.5 text-[#7C3AED]" />
            Explain
          </button>
          <select
            value={chart.type}
            onChange={(event) => onTypeChange?.(event.target.value as ChartType)}
            className="max-w-24 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] outline-none shadow-sm"
            aria-label="Edit chart type"
          >
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {type === "horizontalBar" ? "horizontal bar" : type}
              </option>
            ))}
          </select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-xl border border-[#E2E8F0] bg-white text-[#334155] shadow-sm hover:bg-gray-50"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border bg-white text-gray-700 shadow-md">
              <DropdownMenuItem onClick={() => downloadSvgOrPng(rootRef.current, fileName, "png")}>
                <Download className="mr-2 size-4" />
                Download PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadSvgOrPng(rootRef.current, fileName, "svg")}>
                <Download className="mr-2 size-4" />
                Download SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 size-4" />
                Duplicate chart
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit3 className="mr-2 size-4" />
                Edit chart
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-700">
                <Trash2 className="mr-2 size-4" />
                Remove chart
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {chart.warning && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="size-4" />
          {chart.warning}
        </div>
      )}

      {empty ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed bg-gray-50 text-sm text-gray-400">
          Not enough data to render this chart.
        </div>
      ) : chart.type === "heatmap" ? (
        <div className="min-h-[300px] overflow-auto rounded-2xl bg-gray-50 p-2">
          <HeatmapChart data={chart.data} />
        </div>
      ) : (
        <div ref={rootRef} className="min-h-[300px]">
          <ResponsiveContainer width="100%" height={300}>
            {normalizedType === "line" ? (
              <LineChart data={chart.data} margin={{ top: 8, right: 18, bottom: 18, left: 8 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey={renderXKey} stroke="#9ca3af" fontSize={11} interval="preserveStartEnd" minTickGap={10} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey={renderYKey} stroke="#7C3AED" strokeWidth={3} dot={false} />
              </LineChart>
            ) : normalizedType === "area" ? (
              <AreaChart data={chart.data} margin={{ top: 8, right: 18, bottom: 18, left: 8 }}>
                <defs>
                  <linearGradient id={`${chart.id}-gradient`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey={renderXKey} stroke="#9ca3af" fontSize={11} interval="preserveStartEnd" minTickGap={10} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey={renderYKey}
                  stroke="#7C3AED"
                  fill={`url(#${chart.id}-gradient)`}
                  strokeWidth={2.5}
                />
              </AreaChart>
            ) : normalizedType === "pie" || normalizedType === "donut" ? (
              <PieChart margin={{ top: 8, right: 8, bottom: 20, left: 8 }}>
                <Pie
                  data={pieData}
                  dataKey={renderYKey}
                  nameKey={renderXKey}
                  innerRadius={normalizedType === "donut" ? 58 : 0}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`${entry[renderXKey]}-${index}`} fill={entry.fill as string} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : normalizedType === "scatter" ? (
              <ScatterChart margin={{ top: 8, right: 18, bottom: 18, left: 12 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey={renderXKey} stroke="#9ca3af" fontSize={11} type="number" />
                <YAxis dataKey={renderYKey} stroke="#9ca3af" fontSize={11} type="number" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={chart.data} fill="#06B6D4" />
              </ScatterChart>
            ) : normalizedType === "radar" ? (
              <RadarChart data={chart.data}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey={renderXKey} stroke="#6b7280" />
                <PolarRadiusAxis stroke="#9ca3af" />
                <Radar dataKey={renderYKey} stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.35} />
                <Tooltip />
              </RadarChart>
            ) : normalizedType === "composed" ? (
              <ComposedChart data={chart.data} margin={{ top: 8, right: 18, bottom: 18, left: 8 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey={renderXKey} stroke="#9ca3af" fontSize={11} interval="preserveStartEnd" minTickGap={10} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip />
                <Bar dataKey={renderYKey} fill="#2563EB" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey={renderYKey} stroke="#7C3AED" strokeWidth={2} />
              </ComposedChart>
            ) : (
              <BarChart
                data={chart.data}
                layout={isHorizontalBar ? "vertical" : "horizontal"}
                margin={isHorizontalBar ? { top: 6, right: 18, bottom: 12, left: 12 } : { top: 8, right: 14, bottom: 18, left: 4 }}
              >
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis
                  type={isHorizontalBar ? "number" : "category"}
                  dataKey={isHorizontalBar ? undefined : renderXKey}
                  stroke="#9ca3af"
                  fontSize={11}
                  interval="preserveStartEnd"
                  minTickGap={10}
                />
                <YAxis
                  type={isHorizontalBar ? "category" : "number"}
                  dataKey={isHorizontalBar ? renderXKey : undefined}
                  stroke="#9ca3af"
                  fontSize={11}
                  width={isHorizontalBar ? 118 : 34}
                />
                <Tooltip />
                <Bar dataKey={renderYKey} fill="#7C3AED" radius={isHorizontalBar ? [0, 6, 6, 0] : [6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B]">
        <span>
          Metric Used: <span className="font-semibold text-[#334155]">{chart.metricUsed || chart.yKey}</span>
        </span>
        <span>
          Calculation Source: <span className="font-mono text-[11px] text-[#334155]">{chart.calculationSource || `${chart.aggregation}(${chart.yKey}) by ${chart.xKey}`}</span>
        </span>
        {chart.createdBy === "ai" && (
          <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-600">New - Added by AI</span>
        )}
      </div>
    </div>
  );
}