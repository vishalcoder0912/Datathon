import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileJson, Share2, Trash2, Plus, Sparkles, X, RefreshCw, UploadCloud, Table2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import { ChartErrorBoundary } from "@/features/dashboard/components/ChartErrorBoundary";
import { EnhancedAgentPanel } from "@/features/dashboard/components/EnhancedAgentPanel";
import { PremiumDataPreview } from "@/features/dashboard/components/PremiumDataPreview";
import { PremiumInsightCards } from "@/features/dashboard/components/PremiumInsightCards";
import { PremiumMetricCard } from "@/features/dashboard/components/PremiumMetricCard";
import { PremiumRagPipeline } from "@/features/dashboard/components/PremiumRagPipeline";
import { ChartModals } from "@/features/dashboard/components/ChartModals";
import { usePremiumAgenticDashboard } from "@/features/dashboard/hooks/usePremiumAgenticDashboard";
import { useChartManager } from "@/features/dashboard/hooks/useChartManager";
import { buildDashboardChartFromCommand } from "@/features/dashboard/utils/dashboardCustomChart";
import { generateDynamicQuestionSuggestions } from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import { hasResolvableGeoValue } from "@/features/dashboard/utils/geoResolver";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";
import GlobalGeoIntelligence from "@/features/dashboard/components/GlobalGeoIntelligence";
import { titleCase } from "@/features/dashboard/utils/commandCenterAnalytics";
import { getUniqueValues } from "@/features/dashboard/utils/dashboardAnalytics";

const PremiumChartCard = lazy(() => import("@/features/dashboard/components/PremiumChartCard"));
const EMPTY_CHARTS: PremiumChart[] = [];

type ActiveDataset = NonNullable<ReturnType<typeof useData>["dataset"]>;

const isMappableGeoColumn = (column: { name: string; type?: string }) => {
  const normalized = column.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (["country", "city", "latitude", "longitude"].includes(column.type || "")) return true;
  if (/^(country|nation|city|state|province|territory|location|geo_location)$/.test(normalized)) return true;
  if (normalized.includes("country") || normalized.includes("city")) return true;
  if (normalized.includes("latitude") || normalized === "lat") return true;
  if (normalized.includes("longitude") || ["lng", "lon", "long"].includes(normalized)) return true;
  if (normalized.includes("state") || normalized.includes("province") || normalized.includes("territory")) return true;
  return false;
};

const hasMappableDatasetValues = (dataset: ActiveDataset) => {
  const candidateColumns = dataset.columns.filter((column) => !/id|phone|zip|postal|code|pin|date|time|month|year|url|link|amount|billing|age|room|doctor|name/i.test(column.name));
  return candidateColumns.some((column) => {
    const values = Array.from(new Set(dataset.rows.slice(0, 300).map((row) => String(row[column.name] ?? "").trim()).filter(Boolean))).slice(0, 90);
    if (!values.length) return false;
    const hits = values.filter(hasResolvableGeoValue).length;
    const ratio = hits / values.length;
    return (hits >= 2 && ratio >= 0.35) || ratio >= 0.75;
  });
};

const hasHealthcareLocationSchema = (dataset: ActiveDataset) => dataset.columns.some((column) => /hospital|facility|clinic|medical_center|medical_centre|address/i.test(column.name));

const cardClass = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
const softButton = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700";

export default function PremiumAgenticDashboardPage() {
  const navigate = useNavigate();
  const { dataset, deleteDataset, isHydrating, loadDemo } = useData();
  const { dashboard, messages, loading, error, deepResearch, setDeepResearch, runPrompt } = usePremiumAgenticDashboard(dataset);
  const [chartsReady, setChartsReady] = useState(false);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("Overview");
  const [dashboardMode, setDashboardMode] = useState<"Executive" | "Analyst" | "Story" | "Agentic Mode">("Agentic Mode");
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const dashboardCharts = dashboard?.charts ?? EMPTY_CHARTS;
  const chartManager = useChartManager(dashboardCharts);
  const [modalType, setModalType] = useState<"customize" | "build" | null>(null);

  const hasMappableGeoColumn = useMemo(() => {
    if (!dataset) return false;
    return Boolean(dataset.columns.some(isMappableGeoColumn)) || hasMappableDatasetValues(dataset);
  }, [dataset]);

  const hasGeoAnalysisPanel = useMemo(() => {
    if (!dataset) return false;
    return hasMappableGeoColumn || hasHealthcareLocationSchema(dataset);
  }, [dataset, hasMappableGeoColumn]);

  const hasDateColumn = useMemo(
    () => Boolean(dataset?.columns.some((column) => /date|month|year|time|created|updated|timestamp/i.test(column.name) || column.type === "date" || column.type === "datetime")),
    [dataset?.columns],
  );

  const analyticsTabs = useMemo(
    () => ["Overview", "Correlations", "Ranking", "Distribution", ...(hasDateColumn ? ["Trends"] : []), "Outliers", ...(hasGeoAnalysisPanel ? ["Geo Analysis"] : [])],
    [hasDateColumn, hasGeoAnalysisPanel],
  );

  const promptChips = useMemo(() => generateDynamicQuestionSuggestions(dataset || undefined, 4), [dataset]);
  const columnNames = useMemo(() => dataset?.columns.map((column) => column.name).filter(Boolean) || [], [dataset?.columns]);

  const primaryCategory = useMemo(() => {
    if (!dataset?.columns.length) return null;
    const categoryColumn = dataset.columns.find((column) => /category|type|segment|department|region|state|city|blood/i.test(column.name) && !/salary|amount|score|usd|revenue|profit/i.test(column.name));
    return categoryColumn?.name || null;
  }, [dataset]);

  const filteredRows = useMemo(() => {
    if (!dataset?.rows) return [];
    return Object.entries(filters).reduce((rows, [key, value]) => {
      if (!value) return rows;
      return rows.filter((row) => String(row[key] ?? "") === value);
    }, dataset.rows);
  }, [dataset?.rows, filters]);

  const tabCharts = chartManager.getVisibleCharts().filter((chart) => {
    const title = `${chart.title} ${chart.type} ${chart.subtitle || ""}`.toLowerCase();
    if (activeAnalyticsTab === "Overview") return true;
    if (activeAnalyticsTab === "Correlations") return title.includes("correlation") || title.includes("vs") || chart.type === "scatter";
    if (activeAnalyticsTab === "Ranking") return !title.includes("outlier") && (title.includes("top") || title.includes("ranking") || chart.type === "table");
    if (activeAnalyticsTab === "Distribution") return title.includes("distribution") || chart.type === "histogram" || chart.type === "donut";
    if (activeAnalyticsTab === "Trends") return title.includes("trend") || chart.type === "line" || title.includes("date") || title.includes("month");
    if (activeAnalyticsTab === "Outliers") return title.includes("outlier") || title.includes("anomaly");
    if (activeAnalyticsTab === "Geo Analysis") return hasGeoAnalysisPanel && (chart.type === "map" || title.includes("geo") || title.includes("country") || title.includes("city") || title.includes("location"));
    return true;
  });

  useEffect(() => setActiveAnalyticsTab((currentTab) => (analyticsTabs.includes(currentTab) ? currentTab : "Overview")), [analyticsTabs]);
  useEffect(() => {
    setChartsReady(false);
    const timer = window.setTimeout(() => setChartsReady(true), 80);
    return () => window.clearTimeout(timer);
  }, [dataset?.id]);

  const clearFilters = useCallback(() => setFilters({}), []);
  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const downloadDataset = async (format: "csv" | "json") => {
    if (!dataset?.id) return;
    const blob = await api.exportDataset(dataset.id, format);
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${dataset.name || "dataset"}.${format}`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleChartCommand = (command: { action: string; chartId?: string; params?: Record<string, unknown> }) => {
    switch (command.action) {
      case "create": {
        const chart = buildDashboardChartFromCommand(dataset, command.params || {});
        if (chart) {
          chartManager.addChart(chart);
          setActiveAnalyticsTab("Overview");
        } else setModalType("build");
        break;
      }
      case "remove":
        if (command.chartId) chartManager.removeChart(command.chartId);
        break;
      case "modify": {
        if (!command.chartId) break;
        const chart = chartManager.getChartById(command.chartId);
        if (!chart) break;
        const updatedChart = buildDashboardChartFromCommand(dataset, command.params || {}, chart);
        if (updatedChart) chartManager.updateChart(command.chartId, updatedChart);
        else {
          chartManager.setSelectedChartId(command.chartId);
          setModalType("customize");
        }
        break;
      }
      case "duplicate":
        if (command.chartId) chartManager.duplicateChart(command.chartId);
        break;
      case "toggle_visibility":
      case "toggle":
        if (command.chartId) chartManager.toggleChartVisibility(command.chartId);
        break;
    }
  };

  const handleCustomizeChart = (updates: Partial<PremiumChart>) => {
    if (chartManager.selectedChartId) chartManager.updateChart(chartManager.selectedChartId, updates);
  };

  const activeFilterEntries = Object.entries(filters).filter(([, value]) => value);

  if (isHydrating) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7fb] p-6 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-700"><RefreshCw className="h-6 w-6 animate-spin" /></div>
          <h1 className="text-xl font-black tracking-tight">Preparing dashboard</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">Loading the active dataset and analytics workspace.</p>
        </section>
      </main>
    );
  }

  if (!dataset || !dashboard) {
    return (
      <main className="min-h-screen bg-[#f6f7fb] p-6 text-slate-900">
        <section className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"><Sparkles className="size-3.5" />Agentic analytics workspace</div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">No dataset loaded</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Upload a CSV, Excel workbook, or JSON file to generate KPIs, charts, geo intelligence, insights, and an AI assistant grounded in your data.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/upload")} className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"><UploadCloud className="h-4 w-4" />Upload Dataset</button>
              <button type="button" onClick={() => void loadDemo()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Table2 className="h-4 w-4" />Load Demo</button>
            </div>
          </div>
          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">Supported inputs</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              {["CSV files with headers", "Excel .xlsx workbooks", "JSON row collections", "Columns for country, city, state, latitude, or longitude"].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{item}</div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
              <div>market,revenue</div>
              <div>India,61000</div>
              <div>USA,52000</div>
              <div>Germany,47000</div>
            </div>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <div className={`grid gap-5 p-5 transition-all duration-300 ${aiPanelCollapsed ? "xl:grid-cols-[minmax(0,1fr)_60px]" : "xl:grid-cols-[minmax(0,1fr)_340px]"}`}>
        <section className="min-w-0 space-y-5">
          <header className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Agentic Analytics</span>
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Live dataset</span>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{dataset.name}</h1>
                <p className="mt-1 text-sm text-slate-500">Last updated {new Date(dashboard.generatedAt || Date.now()).toLocaleTimeString()} · {dataset.rows.length.toLocaleString()} rows · {dataset.columns.length} columns</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => runPrompt("Analyze dashboard")} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm"><Sparkles className="h-4 w-4" />Run Analysis</button>
                <button className={softButton} type="button" aria-label="Share" onClick={() => navigator.clipboard?.writeText(`Dataset: ${dataset.name}\nRows: ${dataset.rows.length.toLocaleString()}`)}><Share2 className="h-4 w-4" />Share</button>
                <button onClick={() => downloadDataset("csv")} className={softButton} type="button" aria-label="Export CSV"><Download className="h-4 w-4" />Export</button>
                <button onClick={() => downloadDataset("json")} className={softButton} type="button" aria-label="Export JSON"><FileJson className="h-4 w-4" />JSON</button>
                <button onClick={deleteDataset} className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" type="button" aria-label="Delete dataset"><Trash2 className="h-4 w-4" />Delete</button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              {["Executive", "Analyst", "Story", "Agentic Mode"].map((tab) => (
                <button key={tab} onClick={() => setDashboardMode(tab as typeof dashboardMode)} className={`rounded-xl px-4 py-2 ${dashboardMode === tab ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`} type="button">
                  {tab}{tab === "Agentic Mode" && <span className="ml-2 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] text-violet-700">BETA</span>}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {promptChips.map((chip) => <button key={chip} onClick={() => runPrompt(chip)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700" type="button">{chip}</button>)}
            </div>
          </header>

          <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {primaryCategory && (
              <select value={filters[primaryCategory] || ""} onChange={(event) => setFilter(primaryCategory, event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-violet-300" aria-label={`Filter by ${primaryCategory}`}>
                <option value="">All {titleCase(primaryCategory)}</option>
                {getUniqueValues(dataset.rows as Record<string, unknown>[], primaryCategory, 50).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            )}
            {activeFilterEntries.map(([key, value]) => <span key={key} className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><Sparkles className="size-3" />{titleCase(key)}: {String(value)}<button type="button" onClick={() => setFilter(key, "")} aria-label={`Clear ${key} filter`}><X className="size-3.5" /></button></span>)}
            <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50" aria-label="Reset filters"><RefreshCw className="mr-1.5 inline size-3.5" />Reset</button>
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-950">Dashboard overview</h2>
                <p className="text-xs text-slate-500">Ready · {filteredRows.length.toLocaleString()} rows · {dataset.columns.length} columns · {dataset.sourceType || "CSV"}</p>
              </div>
              <div className="grid size-16 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-center"><div><p className="text-lg font-black text-emerald-700">{dashboard.qualityScore}</p><p className="text-[10px] font-bold text-emerald-600">/100</p></div></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">{dashboard.kpis.slice(0, 3).map((kpi) => <PremiumMetricCard key={kpi.id} kpi={kpi} featured />)}</div>
            {dashboard.kpis.length > 3 && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{dashboard.kpis.slice(3).map((kpi) => <PremiumMetricCard key={kpi.id} kpi={kpi} featured={false} />)}</div>}
          </section>

          {error && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}

          <section className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                {analyticsTabs.map((tab) => <button key={tab} onClick={() => setActiveAnalyticsTab(tab)} className={`rounded-xl px-3 py-2 transition ${activeAnalyticsTab === tab ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"}`} type="button">{tab}</button>)}
              </div>
              <button onClick={() => setModalType("build")} className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700" type="button"><Plus className="h-4 w-4" />Add Chart</button>
            </div>
            {chartsReady ? (
              <Suspense fallback={<div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">{tabCharts.slice(0, 3).map((chart) => <div key={chart.id} className="h-[330px] animate-pulse rounded-3xl border border-slate-200 bg-slate-50" />)}</div>}>
                {activeAnalyticsTab === "Geo Analysis" && hasGeoAnalysisPanel && dataset?.rows?.length ? <GlobalGeoIntelligence rows={filteredRows} columns={dataset.columns} /> : (
                  <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {tabCharts.map((chart) => <ChartErrorBoundary key={chart.id} fallbackTitle={chart.title}><PremiumChartCard chart={chart} isVisible={chartManager.visibleCharts.has(chart.id)} onEdit={(chartId) => { chartManager.setSelectedChartId(chartId); setModalType("customize"); }} onRemove={chartManager.removeChart} onDuplicate={chartManager.duplicateChart} onToggleVisibility={chartManager.toggleChartVisibility} /></ChartErrorBoundary>)}
                    {tabCharts.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No {activeAnalyticsTab} chart found yet. Click <span className="font-bold text-violet-700">Add Chart</span> to create one.</div>}
                  </div>
                )}
              </Suspense>
            ) : <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">{tabCharts.slice(0, 3).map((chart) => <div key={chart.id} className="h-[330px] animate-pulse rounded-3xl border border-slate-200 bg-slate-50" />)}</div>}
          </section>

          {hasGeoAnalysisPanel && activeAnalyticsTab !== "Geo Analysis" && (
            <section className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-slate-950">Geo Intelligence</h2>
                  <p className="mt-1 text-sm text-slate-500">{hasMappableGeoColumn ? "Real location data is available. Open the animated map to click countries, markers, and view real aggregated rows." : "Healthcare location entities were detected, but this dataset needs City, State, Country, Latitude, or Longitude before a real map can plot records."}</p>
                </div>
                <button type="button" onClick={() => setActiveAnalyticsTab("Geo Analysis")} className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-700">
                  {hasMappableGeoColumn ? "Open Animated Map" : "View Map Requirements"}
                </button>
              </div>
            </section>
          )}

          <PremiumInsightCards insights={dashboard.insights} />
          <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><PremiumRagPipeline steps={dashboard.ragPipeline} /><PremiumDataPreview dataset={dataset} onViewFullTable={() => navigate("/data")} onDownload={() => downloadDataset("csv")} /></div>
        </section>

        <EnhancedAgentPanel messages={messages} reasoning={dashboard.reasoning} loading={loading} onAsk={runPrompt} charts={chartManager.getVisibleCharts()} availableColumns={columnNames} onChartCommand={handleChartCommand} onCreateChart={() => setModalType("build")} deepResearch={deepResearch} onDeepResearchChange={setDeepResearch} isCollapsed={aiPanelCollapsed} onToggleCollapse={() => setAiPanelCollapsed(!aiPanelCollapsed)} />

        <ChartModals modalType={modalType} selectedChart={chartManager.selectedChartId ? chartManager.getChartById(chartManager.selectedChartId) || null : null} availableColumns={columnNames} data={dataset.rows} onCustomize={handleCustomizeChart} onCreateChart={chartManager.addChart} onClose={() => { setModalType(null); chartManager.setSelectedChartId(null); }} />
      </div>
    </main>
  );
}
