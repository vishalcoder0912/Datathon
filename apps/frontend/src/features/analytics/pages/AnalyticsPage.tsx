import { Fragment, useMemo, useState } from "react";
import {
  Bookmark,
  Brain,
  CheckCircle2,
  Download,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useData } from "@/features/data/context/useData";
import {
  buildCommandCenterModel,
  formatMetricValue,
  pickBusinessDimension,
  pickBusinessMetric,
  titleCase,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import {
  applyFilters,
  average,
  buildChartFromSpec,
  buildCorrelationMatrix,
  exportDashboardToJson,
  groupByAggregate,
  safeNumber,
  type DashboardFilters,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function detectAnomalies(rows: Row[], metric?: string) {
  if (!metric) return [];
  const values: Array<{ index: number; value: number; row: Row }> = [];
  rows.forEach((row, index) => {
    const value = safeNumber(row[metric]);
    if (value !== null) values.push({ index, value, row });
  });
  if (values.length < 4) return [];
  const mean = average(values.map((entry) => entry.value));
  const variance = values.reduce((total, entry) => total + (entry.value - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (!stddev) return [];
  return values
    .map((entry) => ({ ...entry, z: (entry.value - mean) / stddev }))
    .filter((entry) => Math.abs(entry.z) > 2)
    .sort((left, right) => Math.abs(right.z) - Math.abs(left.z))
    .slice(0, 8);
}

function CorrelationHeatmap({ rows }: { rows: Row[] }) {
  const cells = buildCorrelationMatrix(rows);
  const xLabels = Array.from(new Set(cells.map((cell) => String(cell.x)))).slice(0, 6);
  const yLabels = Array.from(new Set(cells.map((cell) => String(cell.y)))).slice(0, 6);
  const cellMap = useMemo(
    () => new Map(cells.map((cell) => [`${String(cell.x)}::${String(cell.y)}`, Number(cell.value || 0)])),
    [cells],
  );

  if (!cells.length) {
    return <div className="grid min-h-[260px] place-items-center text-sm text-[#64748B]">At least two numeric columns are required for correlations.</div>;
  }

  return (
    <div className="overflow-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${xLabels.length}, minmax(90px, 1fr))` }}>
        <div />
        {xLabels.map((label) => <div key={label} className="truncate p-2 text-center text-xs font-semibold text-[#64748B]">{label}</div>)}
        {yLabels.map((rowLabel) => (
          <Fragment key={rowLabel}>
            <div key={`${rowLabel}-label`} className="truncate p-2 text-xs font-semibold text-[#334155]">{rowLabel}</div>
            {xLabels.map((columnLabel) => {
              const value = cellMap.get(`${columnLabel}::${rowLabel}`) || 0;
              const positive = value >= 0;
              const color = positive
                ? `rgba(37,99,235,${0.12 + Math.abs(value) * 0.68})`
                : `rgba(239,68,68,${0.12 + Math.abs(value) * 0.68})`;
              return (
                <div key={`${rowLabel}-${columnLabel}`} className="rounded-lg p-3 text-center text-xs font-bold text-[#0F172A]" style={{ background: color }}>
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

export default function AnalyticsPage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [filters, setFilters] = useState<DashboardFilters>({});
  const baseModel = useMemo(() => buildCommandCenterModel(dataset), [dataset]);
  const metric = pickBusinessMetric(baseModel.profile);
  const dimension = pickBusinessDimension(baseModel.profile);
  const filteredRows = useMemo(() => applyFilters(baseModel.rows, filters), [baseModel.rows, filters]);
  const model = useMemo(() => buildCommandCenterModel(dataset, filters), [dataset, filters]);
  const anomalies = useMemo(() => detectAnomalies(filteredRows, metric), [filteredRows, metric]);

  const trendChart = useMemo(() => {
    if (!metric || !model.profile.dateColumn) return null;
    return buildChartFromSpec(filteredRows, {
      type: "area",
      title: `Trend Decomposition & Forecast (${titleCase(metric)})`,
      xKey: model.profile.dateColumn.name,
      yKey: metric,
      aggregation: metric.includes("salary") ? "avg" : "sum",
      intent: "trend",
      limit: 24,
    });
  }, [filteredRows, metric, model.profile.dateColumn]);

  const anomalyChart = useMemo(() => {
    if (!metric) return null;
    return buildChartFromSpec(filteredRows.map((row, index) => ({ ...row, __row_index__: index + 1 })), {
      type: "line",
      title: `Anomaly Detection (${titleCase(metric)})`,
      xKey: model.profile.dateColumn?.name || "__row_index__",
      yKey: metric,
      aggregation: "avg",
      intent: "trend",
      limit: 40,
    });
  }, [filteredRows, metric, model.profile.dateColumn]);

  const segmentChart = useMemo(() => {
    if (!metric || !dimension) return null;
    return buildChartFromSpec(filteredRows, {
      type: "donut",
      title: `Segmentation Analysis (${titleCase(metric)})`,
      xKey: dimension,
      yKey: metric,
      aggregation: metric.includes("salary") ? "avg" : "sum",
      intent: "segment_comparison",
      limit: 8,
    });
  }, [dimension, filteredRows, metric]);

  const strongest = useMemo(() => {
    const correlations = buildCorrelationMatrix(filteredRows);
    return correlations.reduce<(typeof correlations)[number] | undefined>((best, cell) => {
      if (cell.x === cell.y) return best;
      if (!best) return cell;
      return Math.abs(Number(cell.value)) > Math.abs(Number(best.value)) ? cell : best;
    }, undefined);
  }, [filteredRows]);

  if (isHydrating) return <StatusPanel title="Loading analytics" message="Preparing advanced analysis." />;
  if (apiError) return <StatusPanel title="Analytics unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  if (!dataset) return <StatusPanel title="No dataset loaded" message="Upload a dataset before running advanced analytics." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;

  const summaryCards = [
    ["Correlations Found", buildCorrelationMatrix(filteredRows).filter((cell) => cell.x !== cell.y && Math.abs(Number(cell.value)) > 0.35).length, "Strong and moderate pairs", TrendingUp],
    ["Anomalies Detected", anomalies.length, metric ? `Z-score on ${titleCase(metric)}` : "No metric", ShieldCheck],
    ["Strongest Driver", strongest ? String(strongest.x) : "-", strongest ? `vs ${strongest.y}: ${Number(strongest.value).toFixed(2)}` : "Need two metrics", Target],
    ["Forecast Confidence", `${Math.round(model.quality.finalScore)}%`, "Based on data quality", Brain],
    ["Data Health", `${Math.round(model.quality.finalScore)}%`, `${model.quality.completeness}% complete`, CheckCircle2],
  ] as const;

  function exportReport() {
    downloadFile(
      `${dataset.name || "advanced-analytics"}.json`,
      exportDashboardToJson({ datasetName: dataset.name, filters, kpis: model.kpis, charts: model.charts }),
      "application/json;charset=utf-8",
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-1 size-8 text-[#7C3AED]" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Advanced Analytics</h1>
              <p className="mt-1 text-sm text-[#64748B]">Explore correlations, trends, anomalies, and performance drivers from your real dataset.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
              <Play className="mr-2 inline size-4" />
              Run Analysis
            </button>
            <button type="button" onClick={exportReport} className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-bold text-[#334155] shadow-sm">
              <Download className="mr-2 inline size-4" />
              Export
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(([title, value, subtitle, Icon]) => (
            <div key={title} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#64748B]">{title}</p>
                  <p className="mt-2 text-2xl font-bold text-[#0F172A]">{String(value)}</p>
                  <p className="mt-2 text-xs text-[#64748B]">{subtitle}</p>
                </div>
                <div className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
                  <Icon className="size-5" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[#334155]">Metric</span>
          <select aria-label="Select analytics metric" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] shadow-sm">
            {model.profile.numericColumns.map((column) => <option key={column.name}>{column.name}</option>)}
          </select>
          {dimension && (
            <>
              <span className="text-sm font-semibold text-[#334155]">Segment</span>
              <select
                value={String(filters[dimension] || "")}
                aria-label="Select analytics segment"
                onChange={(event) => setFilters((current) => ({ ...current, [dimension]: event.target.value || undefined }))}
                className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] shadow-sm"
              >
                <option value="">All Segments</option>
                {groupByAggregate(baseModel.rows, dimension, metric || dimension, metric ? "avg" : "count", 50).map((row) => (
                  <option key={String(row[dimension])} value={String(row[dimension])}>{String(row[dimension])}</option>
                ))}
              </select>
            </>
          )}
          <button type="button" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155] shadow-sm">
            <Bookmark className="mr-2 inline size-4" />
            Save View
          </button>
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="grid gap-5 xl:grid-cols-2">
            <section className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-[#0F172A]">Correlation Heatmap</h2>
                <span className="text-xs text-[#64748B]">Pearson correlation</span>
              </div>
              <CorrelationHeatmap rows={filteredRows} />
            </section>
            {anomalyChart && <SmartChartCard chart={anomalyChart} />}
            {segmentChart && <SmartChartCard chart={segmentChart} />}
            {trendChart && <SmartChartCard chart={trendChart} />}
          </main>

          <aside className="space-y-4">
            <section className={`${CARD} p-5`}>
              <h2 className="flex items-center gap-2 font-bold text-[#0F172A]">
                <Sparkles className="size-5 text-[#7C3AED]" />
                AI Findings & Recommendations
              </h2>
              <div className="mt-4 space-y-3">
                {model.insights.map((insight) => (
                  <div key={insight.id} className="rounded-2xl border border-[#E2E8F0] p-4">
                    <p className="font-bold text-[#0F172A]">{insight.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#64748B]">{insight.description}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className={`${CARD} p-5`}>
              <h3 className="font-bold text-[#0F172A]">Impact Summary</h3>
              <p className="mt-4 text-sm text-[#64748B]">Primary metric</p>
              <p className="mt-1 text-3xl font-bold text-[#22C55E]">
                {metric ? formatMetricValue(average(filteredRows.map((row) => safeNumber(row[metric])).filter((value): value is number => value !== null)), metric) : "-"}
              </p>
              <p className="mt-2 text-sm text-[#64748B]">Average based on current filters.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
