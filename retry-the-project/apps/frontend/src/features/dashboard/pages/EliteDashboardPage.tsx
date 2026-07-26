import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  Database,
  Lightbulb,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import GeoIntelligence from "@/features/dashboard/geo/GeoIntelligence";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useData } from "@/features/data/context/useData";
import { api, ApiError } from "@/features/data/api/dataApi";
import {
  buildCommandCenterModel,
  interpretCommand,
  titleCase,
  type CommandCenterModel,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import type {
  DashboardChart,
  DashboardFilters,
  DashboardKpi,
  Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import type { ChartType } from "@/features/dashboard/types/dashboardTypes";
import {
  buildChartFromSpec,
  buildKpiFromSpec,
  getUniqueValues,
} from "@/features/dashboard/utils/dashboardAnalytics";
import {
  loadDashboardState,
  recordDashboardAction,
  saveDashboardState,
} from "@/features/dashboard/utils/dashboardStateStorage";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";
const KPI_ACCENTS = [
  ["from-blue-50 to-white", "text-[#2563EB]", Database],
  ["from-violet-50 to-white", "text-[#7C3AED]", TrendingUp],
  ["from-cyan-50 to-white", "text-[#06B6D4]", Table2],
  ["from-emerald-50 to-white", "text-[#22C55E]", ShieldCheck],
  ["from-indigo-50 to-white", "text-[#2563EB]", Sparkles],
] as const;
type StoredState = ReturnType<typeof loadDashboardState>;

function formatTime(value?: string) {
  if (!value) return "No AI actions yet";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function KpiCard({ kpi, index }: { kpi: DashboardKpi; index: number }) {
  const [bg, color, Icon] = KPI_ACCENTS[index % KPI_ACCENTS.length];
  const sparkline = kpi.sparkline || [];
  const maxValue = sparkline.length ? Math.max(...sparkline) : 0;
  const minValue = sparkline.length ? Math.min(...sparkline) : 0;
  const range = maxValue - minValue || 1;
  const points = sparkline
    .map((value, pointIndex) => {
      const x = sparkline.length === 1 ? 100 : (pointIndex / Math.max(sparkline.length - 1, 1)) * 100;
      const y = 30 - ((value - minValue) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={`${CARD} min-h-[156px] bg-gradient-to-br ${bg} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#64748B]">{kpi.title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#0F172A]">{kpi.value}</p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            {typeof kpi.change === "number" && (
              <span className={`shrink-0 text-xs font-bold ${kpi.change >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {kpi.change >= 0 ? "+" : ""}{kpi.change}%
              </span>
            )}
            <p className="truncate text-xs text-[#64748B]">{kpi.subtitle}</p>
          </div>
        </div>
        <div className={`grid size-12 place-items-center rounded-2xl bg-white ${color} shadow-sm`}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4 h-8">
        {sparkline.length ? (
          <svg viewBox="0 0 100 34" className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <polyline fill="none" stroke={index % 2 ? "#7C3AED" : "#2563EB"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={points} />
          </svg>
        ) : (
          <p className="truncate text-xs text-[#94A3B8]">{kpi.source || "Calculated from filtered rows"}</p>
        )}
      </div>
    </div>
  );
}

function DashboardAiChatPanel({
  model,
  stored,
  datasetId,
  onRunCommand,
  onPersistMessages,
}: {
  model: CommandCenterModel;
  stored: StoredState;
  datasetId?: string;
  onRunCommand: (command: string, source?: "dashboard" | "agent" | "chat") => Promise<string>;
  onPersistMessages: (messages: NonNullable<StoredState["aiChatMessages"]>) => void;
}) {
  const [input, setInput] = useState("");
  const messages = stored.aiChatMessages?.length
    ? stored.aiChatMessages
    : [
        {
          id: "welcome",
          role: "assistant" as const,
          content: "I can control dashboard layout, metrics, charts, filters, and Geo Intelligence.",
          timestamp: new Date().toISOString(),
        },
      ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    const userMessage = {
      id: crypto.randomUUID?.() || `${Date.now()}-user`,
      role: "user" as const,
      content: text,
      timestamp: new Date().toISOString(),
    };
    onPersistMessages([userMessage, ...(stored.aiChatMessages || [])].slice(0, 16));
    setInput("");
    
    try {
      const response = await onRunCommand(text, "chat");
      const assistantMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}-assistant`,
        role: "assistant" as const,
        content: response,
        timestamp: new Date().toISOString(),
        actionLabel: response.startsWith("I cannot") ? undefined : "Dashboard updated from chat command",
      };
      const latest = loadDashboardState(datasetId);
      onPersistMessages([assistantMessage, ...(latest.aiChatMessages || [])].slice(0, 16));
    } catch (error) {
      // ignore
    }
  }

  async function runSuggestedCommand(command: string) {
    const timestamp = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID?.() || `${Date.now()}-suggested-user`,
      role: "user",
      content: command,
      timestamp,
    };
    onPersistMessages([userMessage, ...(stored.aiChatMessages || [])].slice(0, 16));
    
    try {
      const response = await onRunCommand(command, "agent");
      const assistantMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}-suggested-ai`,
        role: "assistant",
        content: response,
        timestamp,
        actionLabel: "Suggested action applied",
      };
      const latest = loadDashboardState(datasetId);
      onPersistMessages([assistantMessage, ...(latest.aiChatMessages || [])].slice(0, 16));
    } catch (error) {
      // ignore
    }
  }

  return (
    <aside className="space-y-4 2xl:sticky 2xl:top-[104px] 2xl:max-h-[calc(100vh-120px)] 2xl:overflow-auto">
      <section className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[#0F172A]">InsightFlow AI</h2>
              <p className="truncate text-xs text-[#64748B]">AI can control dashboard layout and metrics.</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Active</span>
        </div>

        <div className="max-h-[430px] space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
          {messages.map((message) => (
            <div key={message.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className={`grid size-7 place-items-center rounded-full ${message.role === "assistant" ? "bg-violet-50 text-[#7C3AED]" : "bg-blue-50 text-[#2563EB]"}`}>
                  {message.role === "assistant" ? <Bot className="size-4" /> : <User className="size-4" />}
                </div>
                <span className="text-xs font-bold text-[#0F172A]">{message.role === "assistant" ? "InsightFlow AI" : "You"}</span>
                <span className="text-xs text-[#94A3B8]">{formatTime(message.timestamp)}</span>
              </div>
              <p className="text-sm leading-6 text-[#334155]">{message.content}</p>
              {message.actionLabel && (
                <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  {message.actionLabel}
                </span>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="border-t border-[#E2E8F0] p-4">
          <div className="relative">
            <input
              value={input}
              aria-label="Ask InsightFlow AI"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask: Ask InsightFlow AI..."
              className="h-11 w-full rounded-2xl border border-[#E2E8F0] bg-white pl-4 pr-12 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#7C3AED]"
            />
            <button type="submit" className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white" aria-label="Send dashboard command">
              <Send className="size-4" />
            </button>
          </div>
        </form>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A]">Suggested actions</h3>
          <span className="text-xs font-semibold text-[#2563EB]">View all</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {model.suggestedCommands.map((command) => (
            <button
              key={command}
              type="button"
              onClick={() => runSuggestedCommand(command)}
              className="rounded-full border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:border-violet-200 hover:bg-violet-50"
            >
              {command}
            </button>
          ))}
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A]">Recent actions</h3>
          <span className="text-xs font-semibold text-[#2563EB]">View all</span>
        </div>
        <div className="mt-4 space-y-3">
          {(stored.auditTrail || []).slice(0, 5).map((entry) => (
            <div key={entry.id} className="grid grid-cols-[64px_1fr] gap-3 text-sm">
              <span className="text-xs text-[#64748B]">{formatTime(entry.timestamp)}</span>
              <span className="text-[#334155]">{entry.label}</span>
            </div>
          ))}
          {!(stored.auditTrail || []).length && (
            <p className="text-sm text-[#64748B]">AI dashboard actions will appear here.</p>
          )}
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <span className="text-sm font-bold">{Math.round(model.quality.finalScore)}%</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">Schema confidence</p>
            <p className="text-xs text-[#64748B]">Based on data quality and field compatibility.</p>
          </div>
        </div>
      </section>
    </aside>
  );
}

export default function EliteDashboardPage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [manualCharts, setManualCharts] = useState<DashboardChart[]>([]);
  const [manualKpis, setManualKpis] = useState<DashboardKpi[]>([]);
  const [hiddenCharts, setHiddenCharts] = useState<Set<string>>(new Set());
  const [auditVersion, setAuditVersion] = useState(0);

  useEffect(() => {
    if (!dataset?.id) return;
    const stored = loadDashboardState(dataset.id);
    setFilters(stored.filters);
    setManualCharts(stored.manualCharts);
    setManualKpis(stored.manualKpis);
    setHiddenCharts(new Set());
  }, [dataset?.id]);

  const model = useMemo(
    () => buildCommandCenterModel(dataset, filters, manualCharts, manualKpis),
    [dataset, filters, manualCharts, manualKpis, auditVersion],
  );

  const visibleCharts = model.charts.filter((chart) => !hiddenCharts.has(chart.id));
  const primaryCategory = model.profile.primaryCategory?.name;
  const datasetId = dataset?.id;
  const stored: StoredState = datasetId ? loadDashboardState(datasetId) : { filters: {}, manualCharts: [], manualKpis: [], auditTrail: [], aiChatMessages: [] };

  function persist(next: {
    filters?: DashboardFilters;
    manualCharts?: DashboardChart[];
    manualKpis?: DashboardKpi[];
    label: string;
    geoActive?: boolean;
  }) {
    if (!datasetId) return;
    const latest = loadDashboardState(datasetId);
    const state = {
      ...latest,
      filters: next.filters || filters,
      manualCharts: next.manualCharts || manualCharts,
      manualKpis: next.manualKpis || manualKpis,
      geoActive: next.geoActive || latest.geoActive,
    };
    saveDashboardState(datasetId, state);
    recordDashboardAction(datasetId, next.label, "dashboard", state);
    setAuditVersion((value) => value + 1);
  }

  function persistMessages(messages: NonNullable<StoredState["aiChatMessages"]>) {
    if (!datasetId) return;
    const latest = loadDashboardState(datasetId);
    saveDashboardState(datasetId, {
      ...latest,
      filters,
      manualCharts,
      manualKpis,
      aiChatMessages: messages,
    });
    setAuditVersion((value) => value + 1);
  }

  async function runCommand(command: string, source: "dashboard" | "agent" | "chat" = "dashboard"): Promise<string> {
    if (!datasetId) return "No dataset is loaded. Upload a dataset to activate dashboard control.";
    
    try {
      const response = await api.sendDashboardCommand(
        datasetId,
        command,
        { kpis: manualKpis, charts: manualCharts, filters },
        dataset
      );
      
      const cmd = response.data || response;
      let nextFilters = filters;
      let nextCharts = manualCharts;
      let nextKpis = manualKpis;
      let geoRequested = false;
      
      if (cmd.action === "CLEAR_FILTERS") {
        nextFilters = {};
      } else if (cmd.action === "FILTER" && cmd.filters) {
        nextFilters = { ...filters, ...cmd.filters };
      } else if (cmd.action === "DELETE_CHART" || cmd.action === "REMOVE_CHART") {
        nextCharts = manualCharts.slice(1);
      } else if (cmd.action === "GENERATE_CHART" && (cmd.chartSpec || cmd.chart)) {
        const spec = cmd.chartSpec || cmd.chart;
        const chart = buildChartFromSpec(model.filteredRows, spec);
        nextCharts = [{ ...chart, createdBy: "ai" }, ...manualCharts].slice(0, 8);
      } else if (cmd.action === "GENERATE_KPI" && (cmd.kpiSpec || cmd.kpi)) {
        const spec = cmd.kpiSpec || cmd.kpi;
        const kpi = buildKpiFromSpec(model.filteredRows, spec);
        nextKpis = [{ ...kpi, createdBy: "ai" }, ...manualKpis].slice(0, 8);
      }
      
      setFilters(nextFilters);
      setManualCharts(nextCharts);
      setManualKpis(nextKpis);
      
      const latest = loadDashboardState(datasetId);
      const state = {
        ...latest,
        filters: nextFilters,
        manualCharts: nextCharts,
        manualKpis: nextKpis,
        geoActive: geoRequested || latest.geoActive,
      };
      saveDashboardState(datasetId, state);
      recordDashboardAction(datasetId, cmd.message || `AI Action: ${cmd.action}`, source, state);
      setAuditVersion((value) => value + 1);
      
      return cmd.message;
    } catch (error) {
      console.warn("Backend command failed, using offline fallback", error);
      const result = interpretCommand(command, model.filteredRows.length ? model.filteredRows : model.rows);
      const nextFilters = result.clearFilters ? {} : result.filters ? { ...filters, ...result.filters } : filters;
      const nextCharts = result.removeChartId
        ? manualCharts.slice(1)
        : result.chart
          ? [result.chart, ...manualCharts].slice(0, 8)
          : manualCharts;
      const nextKpis = result.removeKpiId
        ? manualKpis.slice(1)
        : result.kpi
          ? [result.kpi, ...manualKpis].slice(0, 8)
          : manualKpis;
      setFilters(nextFilters);
      setManualCharts(nextCharts);
      setManualKpis(nextKpis);
      if (result.removeChartId && !manualCharts.length && visibleCharts[0]) {
        setHiddenCharts((current) => new Set([...current, visibleCharts[0].id]));
      }
      const latest = loadDashboardState(datasetId);
      const state = {
        ...latest,
        filters: nextFilters,
        manualCharts: nextCharts,
        manualKpis: nextKpis,
        geoActive: result.geoRequested || latest.geoActive,
      };
      saveDashboardState(datasetId, state);
      
      const isValidationError = error instanceof ApiError || (error instanceof Error && error.message.includes("does not exist"));
      const finalMessage = isValidationError ? error.message : result.message;
      const auditLabel = isValidationError ? `Rejected command: ${error.message}` : result.auditLabel;
      
      recordDashboardAction(datasetId, auditLabel, source, state);
      setAuditVersion((value) => value + 1);
      return finalMessage;
    }
  }

  function removeChart(chart: DashboardChart) {
    const nextManual = manualCharts.filter((item) => item.id !== chart.id);
    setManualCharts(nextManual);
    setHiddenCharts((current) => new Set([...current, chart.id]));
    persist({ manualCharts: nextManual, label: `Removed ${chart.title}` });
  }

  function duplicateChart(chart: DashboardChart) {
    const copyId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${chart.id}-copy-${manualCharts.length + 1}`;
    const next = [{ ...chart, id: copyId, title: `${chart.title} Copy` }, ...manualCharts].slice(0, 8);
    setManualCharts(next);
    persist({ manualCharts: next, label: `Duplicated ${chart.title}` });
  }

  function updateChartType(chart: DashboardChart, type: ChartType) {
    const updated = { ...chart, id: chart.id, type, createdBy: chart.createdBy || "ai" };
    const exists = manualCharts.some((item) => item.id === chart.id);
    const next = exists
      ? manualCharts.map((item) => (item.id === chart.id ? updated : item))
      : [updated, ...manualCharts].slice(0, 8);
    setManualCharts(next);
    persist({ manualCharts: next, label: `Changed ${chart.title} to ${type}` });
  }

  if (isHydrating) {
    return <StatusPanel title="Loading dashboard" message="Preparing your analytics command center." />;
  }

  if (apiError) {
    return <StatusPanel title="Dashboard unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  }

  if (!dataset) {
    return (
      <div className="grid min-h-[calc(100vh-84px)] place-items-center bg-[#F6F8FC] p-6">
        <section className="w-full max-w-2xl rounded-3xl border border-[#E2E8F0] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-lg shadow-violet-500/20">
            <Sparkles className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">No dataset loaded</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#64748B]">
            Upload a dataset or load demo data to activate the AI dashboard.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/upload" className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] shadow-sm">
              Upload Dataset
            </Link>
            <button type="button" onClick={() => void loadDemo()} className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20">
              Load Demo Data
            </button>
          </div>
        </section>
      </div>
    );
  }

  const activeFilterEntries = Object.entries(filters).filter(
    ([key, value]) => key !== "conditions" && key !== "dateStart" && key !== "dateEnd" && value,
  );

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-1 text-[#7C3AED]">
              <Sparkles className="size-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">InsightFlow Agentic Dashboard</h1>
                {dataset?.name && (
                  <h2 className="text-xl font-bold text-violet-600 px-3 py-1 rounded-2xl bg-violet-50 border border-violet-100 shadow-sm">{dataset.name}</h2>
                )}
              </div>
              <p className="mt-1 text-sm text-[#64748B]">
                Your AI agent analyzes real uploaded data and controls KPIs, charts, filters, and insights.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm text-[#64748B] shadow-sm">
              <span className="mr-2 inline-block size-2 rounded-full bg-[#22C55E]" />
              Last updated: {formatTime(stored.lastAction?.timestamp)}
            </span>
            <button type="button" onClick={() => runCommand("Explain dashboard")} className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20">
              <Sparkles className="mr-2 inline size-4" />
              Run Analysis
            </button>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-3">
          {primaryCategory && (
            <select
              value={String(filters[primaryCategory] || "")}
              onChange={(event) => {
                const next = { ...filters, [primaryCategory]: event.target.value || undefined };
                setFilters(next);
                persist({ filters: next, label: `Updated filter ${primaryCategory}` });
              }}
              className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-medium text-[#334155] outline-none shadow-sm"
            >
              <option value="">All {titleCase(primaryCategory)}</option>
              {getUniqueValues(model.rows, primaryCategory, 50).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          )}
          {activeFilterEntries.map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-[#2563EB]">
              <Sparkles className="size-3.5 text-[#7C3AED]" />
              {titleCase(key)}: {String(value)}
              <button
                type="button"
                onClick={() => {
                  const next = { ...filters, [key]: undefined };
                  setFilters(next);
                  persist({ filters: next, label: `Cleared filter ${key}` });
                }}
                aria-label={`Clear ${key} filter`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {activeFilterEntries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters({});
                persist({ filters: {}, label: "Cleared all dashboard filters" });
              }}
              className="text-sm font-semibold text-[#2563EB]"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setFilters({});
              persist({ filters: {}, label: "Cleared dashboard filters" });
            }}
            className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] shadow-sm"
          >
            <RefreshCw className="mr-2 inline size-4" />
            Reset
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {model.kpis.map((kpi, index) => (
            <KpiCard key={`${kpi.id}-${index}`} kpi={kpi} index={index} />
          ))}
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="grid gap-4 xl:grid-cols-2">
              {visibleCharts.length ? (
                visibleCharts.slice(0, 6).map((chart) => (
                  <div key={chart.id} className="relative">
                    <SmartChartCard
                      chart={chart}
                      onTypeChange={(type) => updateChartType(chart, type)}
                      onRemove={() => removeChart(chart)}
                      onDuplicate={() => duplicateChart(chart)}
                    />
                  </div>
                ))
              ) : (
                <div className={`${CARD} col-span-full grid min-h-[320px] place-items-center p-10 text-center`}>
                  <div>
                    <Sparkles className="mx-auto size-10 text-[#7C3AED]" />
                    <h2 className="mt-4 text-lg font-bold text-[#0F172A]">No chartable columns found yet</h2>
                    <p className="mt-2 text-sm text-[#64748B]">Upload a dataset with numeric and categorical fields to generate charts.</p>
                  </div>
                </div>
              )}
            </section>

            {model.geo ? (
              <GeoIntelligence
                rows={model.filteredRows}
                columns={model.columns}
                onFilterByCountry={(country) => {
                  if (!model.geo?.geoField) return;
                  const next = { ...filters, [model.geo.geoField]: country || undefined };
                  setFilters(next);
                  persist({ filters: next, label: country ? `Filtered Geo Intelligence to ${country}` : "Cleared Geo Intelligence filter", geoActive: true });
                }}
              />
            ) : (
              <section className={`${CARD} p-5`}>
                <h2 className="font-bold text-[#0F172A]">Geo Intelligence</h2>
                <p className="mt-2 text-sm text-[#64748B]">No geographic field detected in this dataset.</p>
              </section>
            )}

            <section className={`${CARD} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-[#0F172A]">Data-Driven Insights</h2>
                  <p className="text-sm text-[#64748B]">Generated from the current filtered dataset.</p>
                </div>
                <Link to="/chat" className="rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-[#7C3AED]">Open Copilot</Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {model.insights.map((insight) => (
                  <div key={insight.id} className="rounded-2xl border border-[#E2E8F0] p-4">
                    <Lightbulb className="size-5 text-[#7C3AED]" />
                    <p className="mt-3 font-semibold text-[#0F172A]">{insight.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#64748B]">{insight.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
                <div>
                  <h2 className="font-bold text-[#0F172A]">Dataset Preview</h2>
                  <p className="text-sm text-[#64748B]">{model.filteredRows.length.toLocaleString()} filtered rows x {model.columns.length} columns</p>
                </div>
                <Link to="/data" className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-semibold text-[#334155]">
                  <Table2 className="mr-2 inline size-4" />
                  View Table
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                    <tr>
                      {model.columns.slice(0, 7).map((column) => (
                        <th key={column} className="px-5 py-3">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {model.filteredRows.slice(0, 7).map((row) => (
                      <tr key={`${dataset.id}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155]">
                        {model.columns.slice(0, 7).map((column) => (
                          <td key={column} className="max-w-[220px] truncate px-5 py-3">{String((row as Row)[column] ?? "") || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>

          <DashboardAiChatPanel
            model={model}
            stored={stored}
            datasetId={datasetId}
            onRunCommand={runCommand}
            onPersistMessages={persistMessages}
          />
        </div>

        <div className="fixed bottom-5 right-5 hidden items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] shadow-lg lg:flex">
          <CheckCircle2 className="size-4 text-[#22C55E]" />
          Schema-safe local calculations
        </div>
      </div>
    </div>
  );
}