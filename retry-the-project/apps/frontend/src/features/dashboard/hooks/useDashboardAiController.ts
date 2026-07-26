import { useCallback, useEffect, useMemo, useState } from "react";
import { schemaAiClient } from "@/features/data/api/schemaAiClient";
import type { DashboardCommandResponse, DatasetPayload } from "@/types/dashboard";
import {
  applyFilters,
  buildChartFromSpec,
  buildDefaultCharts,
  buildKpiFromSpec,
  buildKpis,
  cleanDatasetRows,
  type DashboardChart,
  type DashboardKpi,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import { buildRuntimeContext } from "@/features/dashboard/utils/runtimeContextBuilder";
import type { ChartSpec, ChartType, KpiSpec } from "@/features/dashboard/types/dashboardTypes";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "chart" | "kpi" | "action" | "warning";
  model?: string;
  provider?: string;
};

type DashboardSpecs = {
  kpis: KpiSpec[];
  charts: ChartSpec[];
  source?: string;
  domain?: string;
};

type ChartTarget = {
  id?: string;
  title?: string;
  chart?: Partial<ChartSpec>;
};

function chartFromAction(action: NonNullable<DashboardCommandResponse["actions"]>[number]): ChartSpec | null {
  const spec = action.chartSpec as ChartSpec | undefined;
  if (spec?.type && spec?.title && spec?.xKey) return spec;

  const type = (action.chart_type || action.type) as ChartType | undefined;
  const xKey = action.xKey || action.x;
  const yKey = action.yKey || action.y || action.metric || "count";

  if (!type || !action.title || !xKey) return null;

  return {
    type,
    title: action.title,
    xKey,
    yKey,
    aggregation: (action.aggregation || "count") as ChartSpec["aggregation"],
    limit: 10,
  };
}

function kpiFromAction(action: NonNullable<DashboardCommandResponse["actions"]>[number]): KpiSpec | null {
  const spec = action.kpiSpec as KpiSpec | undefined;
  if (spec?.title) return spec;
  if (!action.title) return null;

  return {
    title: action.title,
    metric: action.metric || action.y || "__row_count__",
    aggregation: (action.aggregation || "count") as KpiSpec["aggregation"],
    businessKpi: true,
  };
}

function chartKey(chart: Partial<ChartSpec>) {
  return `${chart.type || ""}:${chart.xKey || ""}:${chart.yKey || ""}:${chart.aggregation || ""}`.toLowerCase();
}

function sameChart(left: Partial<ChartSpec>, right: Partial<ChartSpec>) {
  return chartKey(left) === chartKey(right) || (!!left.title && !!right.title && left.title.toLowerCase() === right.title.toLowerCase());
}

function normalizeTitle(value?: string) {
  return String(value || "").toLowerCase().trim();
}

function titleMatches(chartTitle: string | undefined, targetTitle: string | undefined) {
  const chart = normalizeTitle(chartTitle);
  const target = normalizeTitle(targetTitle);
  return Boolean(chart && target && (chart === target || chart.includes(target) || target.includes(chart)));
}

function chartMatchesTarget(chart: Partial<ChartSpec>, target: ChartTarget) {
  if (target.id && chart.id === target.id) return true;
  if (target.title && titleMatches(chart.title, target.title)) return true;
  if (target.chart && sameChart(chart, target.chart)) return true;
  return false;
}

function getActionTarget(action: NonNullable<DashboardCommandResponse["actions"]>[number]): ChartTarget {
  return {
    id: action.targetId || action.chart_id || action.chartSpec?.id || action.chart?.id,
    title: action.targetTitle || action.title || action.chartSpec?.title || action.chart?.title,
    chart: action.chart || action.chartSpec,
  };
}

function removeChartByTarget(charts: ChartSpec[], target: ChartTarget) {
  if (!target.id && !target.title && !target.chart) return charts.slice(0, -1);
  return charts.filter((chart) => !chartMatchesTarget(chart, target));
}

function replaceChartByTarget(charts: ChartSpec[], target: ChartTarget, next: ChartSpec) {
  let replaced = false;
  const updated = charts.map((chart) => {
    if (!chartMatchesTarget(chart, target)) return chart;
    replaced = true;
    return { ...chart, ...next };
  });

  return replaced ? updated : upsertChart(charts, next);
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function upsertChart(charts: ChartSpec[], next: ChartSpec) {
  const normalized = { ...next, id: next.id || makeId() };
  const index = charts.findIndex((chart) => sameChart(chart, normalized) || (!!normalized.id && chart.id === normalized.id));
  if (index === -1) return [...charts, normalized];
  return charts.map((chart, chartIndex) => (chartIndex === index ? { ...chart, ...normalized } : chart));
}

function upsertKpi(kpis: KpiSpec[], next: KpiSpec) {
  const normalized = { ...next, id: next.id || makeId() };
  const title = normalizeTitle(normalized.title);
  const index = kpis.findIndex((kpi) => (!!normalized.id && kpi.id === normalized.id) || normalizeTitle(kpi.title) === title);
  if (index === -1) return [...kpis, normalized];
  return kpis.map((kpi, kpiIndex) => (kpiIndex === index ? { ...kpi, ...normalized } : kpi));
}

function normalizeFilters(filters: DashboardCommandResponse["filters"] = {}) {
  if (Array.isArray(filters)) {
    return filters.reduce<Record<string, string>>((acc, filter) => {
      const key = filter.key || filter.column;
      if (key && filter.value !== undefined && filter.value !== null && String(filter.value).trim()) {
        acc[key] = String(filter.value);
      }
      return acc;
    }, {});
  }

  return Object.fromEntries(
    Object.entries(filters || {})
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
      .map(([key, value]) => [key, String(value)]),
  );
}

function blockedDashboardPrompt(query: string) {
  const text = query.toLowerCase();
  if (/(change|fake|override|tamper|manipulate).{0,30}(kpi|metric|number|value)/i.test(query)) {
    return "I cannot tamper with dashboard values. I can create schema-safe specs, but KPI and chart values are calculated from the local rows.";
  }
  if (/(show|send|dump|expose).{0,30}(raw rows|raw data|all rows|source rows|internal schema)/i.test(query)) {
    return "I cannot expose raw rows or internal schema through dashboard chat. I can summarize trends, build charts, or apply filters locally.";
  }
  if (text.includes("ignore schema") || text.includes("bypass guardian")) {
    return "Schema Guardian blocked that request. Dashboard actions must use available columns and local calculations.";
  }
  return null;
}

function localFallbackAnswer(query: string, rows: Array<Record<string, unknown>>) {
  const rowCount = rows.length.toLocaleString();
  if (/explain|summary|describe|overview/i.test(query)) {
    return `This dashboard is based on ${rowCount} local rows. Values are calculated in the browser from the current filtered dataset.`;
  }
  return "I could not reach the schema AI service, so no dashboard action was applied. Existing local KPIs and charts remain calculated from the dataset.";
}

function topLevelActionToActions(command: DashboardCommandResponse): NonNullable<DashboardCommandResponse["actions"]> {
  if (command.actions?.length) return command.actions;

  if (command.action === "GENERATE_CHART" || command.action === "MODIFY_CHART") {
    return [{
      action: command.action === "MODIFY_CHART" ? "modify_chart" : "create_chart",
      chartSpec: command.chartSpec,
      title: command.chartSpec?.title,
      type: command.chartSpec?.type,
      xKey: command.chartSpec?.xKey,
      yKey: command.chartSpec?.yKey,
      aggregation: command.chartSpec?.aggregation,
    }];
  }

  if (command.action === "GENERATE_KPI") {
    return [{
      action: "create_kpi",
      kpiSpec: command.kpiSpec,
      title: command.kpiSpec?.title,
      metric: command.kpiSpec?.metric,
      aggregation: command.kpiSpec?.aggregation,
    }];
  }

  if (command.action === "DELETE_CHART") {
    return [{
      action: "delete_chart",
      targetId: command.targetId,
      targetTitle: command.targetTitle,
      chartSpec: command.chartSpec,
    }];
  }

  if (command.action === "FILTER") {
    return [{ action: "filter", filters: command.filters }];
  }

  if (command.action === "CLEAR_FILTERS") {
    return [{ action: "clear_filters" }];
  }

  return [];
}

export function useDashboardAiController(
  payload: DatasetPayload,
  initialDashboard?: { kpis?: KpiSpec[]; charts?: ChartSpec[]; source?: string; domain?: string },
  filters: Record<string, string> = {},
  setFilters?: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  rows: Array<Record<string, unknown>> = [],
  useLlm = false,
) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: "assistant",
      content: "Dashboard AI Guardian is ready. I use schema-only AI specs and calculate values locally.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardHealth, setDashboardHealth] = useState<DashboardCommandResponse["dashboardHealth"]>();
  const [dashboardSpecs, setDashboardSpecs] = useState<DashboardSpecs>({
    kpis: initialDashboard?.kpis || [],
    charts: initialDashboard?.charts || [],
    source: initialDashboard?.source,
    domain: initialDashboard?.domain,
  });
  const [manualCharts, setManualCharts] = useState<ChartSpec[]>([]);
  const [manualKpis, setManualKpis] = useState<KpiSpec[]>([]);
  const [chartsCleared, setChartsCleared] = useState(false);
  const updateFilters = useMemo(() => setFilters || (() => undefined), [setFilters]);

  useEffect(() => {
    if (!initialDashboard?.kpis?.length && !initialDashboard?.charts?.length) return;
    setDashboardSpecs({
      kpis: initialDashboard.kpis || [],
      charts: initialDashboard.charts || [],
      source: initialDashboard.source,
      domain: initialDashboard.domain,
    });
  }, [initialDashboard?.charts, initialDashboard?.domain, initialDashboard?.kpis, initialDashboard?.source]);

  const allSpecs = useMemo<DashboardSpecs>(() => ({
    ...dashboardSpecs,
    kpis: [...(dashboardSpecs.kpis || []), ...manualKpis],
    charts: [...(dashboardSpecs.charts || []), ...manualCharts],
  }), [dashboardSpecs, manualKpis, manualCharts]);

  const columns = useMemo(() => {
    const cols = payload.columns || [];
    return cols.map((c) => (typeof c === "string" ? c : (c as { name?: string; key?: string }).name || (c as { name?: string; key?: string }).key || "")).filter(Boolean);
  }, [payload.columns]);

  const runtimeContext = useMemo(() => buildRuntimeContext({
    datasetName: payload.name,
    rows: rows as Row[],
    columns,
    filters,
    currentDashboardState: {
      kpis: allSpecs?.kpis || [],
      charts: allSpecs?.charts || [],
      filters: Object.entries(filters).filter(([k]) => k !== "conditions").map(([k, v]) => ({ key: k, value: v })),
    },
  }), [payload.name, rows, columns, filters, allSpecs]);

  const payloadWithContext = useMemo<DatasetPayload>(() => ({
    ...payload,
    runtimeContext: runtimeContext as Record<string, unknown>,
  }), [payload, runtimeContext]);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const rendered = useMemo(() => {
    const kpiSpecs = allSpecs.kpis.length ? allSpecs.kpis : [];
    const chartSpecs = allSpecs.charts.length ? allSpecs.charts : [];

    return {
      rows: filteredRows,
      kpis: kpiSpecs.length ? kpiSpecs.map((spec) => buildKpiFromSpec(filteredRows, spec)) : buildKpis(filteredRows),
      charts: chartSpecs.length
        ? chartSpecs.map((spec) => buildChartFromSpec(filteredRows, spec)).slice(0, 10)
        : chartsCleared
          ? []
          : buildDefaultCharts(filteredRows),
    };
  }, [allSpecs, chartsCleared, filteredRows]);

  const pushAssistant = useCallback((content: string, options: Partial<Message> = {}) => {
    setMessages((current) => [...current, { id: makeId(), role: "assistant", content, ...options }]);
  }, []);

  const applyCommand = useCallback((command: DashboardCommandResponse) => {
    if (command.dashboardHealth) setDashboardHealth(command.dashboardHealth);
    if (command.provider) localStorage.setItem("last_selected_provider", command.provider);
    if (command.model) localStorage.setItem("last_selected_model", command.model);
    const actions = command.actions || [];
    let shouldClearFilters = false;
    const nextFilters: Record<string, string> = {};
    let createdCharts = 0;
    let createdKpis = 0;
    let modifiedCharts = 0;
    let deletedCharts = 0;

    for (const action of actions) {
      const actionName = (action.action || action.name || "").toLowerCase();

      if (["create_chart", "add_chart", "generate_chart", "create_chart_from_action"].includes(actionName)) {
        const chart = chartFromAction(action);
        if (!chart) continue;
        setChartsCleared(false);
        setDashboardSpecs((current) => ({ ...current, charts: [...current.charts, chart] }));
        setManualCharts((current) => upsertChart(current, chart).slice(-10));
        createdCharts += 1;
        continue;
      }

      if (["modify_chart", "update_chart", "update_chart_type", "convert_chart_type"].includes(actionName)) {
          const chart = chartFromAction(action);
          if (!chart) continue;
          const target = getActionTarget(action);
          const existsInDashboard = dashboardSpecs.charts.some((item) => chartMatchesTarget(item, target) || sameChart(item, chart));
          setChartsCleared(false);
          setDashboardSpecs((current) => ({ ...current, charts: replaceChartByTarget(current.charts, target, chart) }));
          setManualCharts((current) => current.some((item) => chartMatchesTarget(item, target) || sameChart(item, chart)) || !existsInDashboard
            ? replaceChartByTarget(current, target, chart).slice(-10)
            : current);
          modifiedCharts += 1;
          continue;
        }

        if (["create_kpi", "add_kpi", "generate_kpi"].includes(actionName)) {
          const kpi = kpiFromAction(action);
          if (!kpi) continue;
          setManualKpis((current) => upsertKpi(current, kpi).slice(-8));
          createdKpis += 1;
          continue;
        }

        if (["filter", "add_filter", "apply_filter"].includes(actionName) && action.filters) {
          Object.assign(nextFilters, normalizeFilters(action.filters as DashboardCommandResponse["filters"]));
          continue;
        }

        if (["clear_filters", "reset_filters"].includes(actionName)) {
          shouldClearFilters = true;
          continue;
        }

        if (["clear_charts", "remove_all_charts", "delete_all_charts"].includes(actionName)) {
          setChartsCleared(true);
          setManualCharts([]);
          setDashboardSpecs((current) => ({ ...current, charts: [] }));
          deletedCharts += 1;
          continue;
        }

        if (["delete_chart", "remove_chart"].includes(actionName)) {
          const target = getActionTarget(action);
          setManualCharts((current) => removeChartByTarget(current, target));
          setDashboardSpecs((current) => ({ ...current, charts: removeChartByTarget(current.charts, target) }));
          deletedCharts += 1;
        }
      }

    if ((command.action === "GENERATE_DASHBOARD" || command.action === "FIX_DASHBOARD") && (command.dashboard || command.dashboardPlan)) {
      const dashboard = command.dashboard || command.dashboardPlan;
      setDashboardSpecs({
        kpis: (dashboard?.kpis || []) as KpiSpec[],
        charts: (dashboard?.charts || []) as ChartSpec[],
        source: dashboard?.source,
        domain: dashboard?.domain,
      });
      setManualCharts([]);
      setManualKpis([]);
      setChartsCleared(false);
    }

    if (shouldClearFilters) updateFilters({});
    if (Object.keys(nextFilters).length) updateFilters((current) => ({ ...current, ...nextFilters }));

    pushAssistant(command.natural_response || command.message || "Applied schema-safe dashboard actions.", {
      type: command.schema_safe === false ? "warning" : "action",
      model: command.model,
      provider: command.provider,
    });

    if (!createdCharts && !modifiedCharts && !createdKpis && !deletedCharts && !Object.keys(nextFilters).length && !shouldClearFilters) {
      pushAssistant("I prepared the action, but there was no valid schema-safe chart, KPI, or filter to apply.", { type: "warning" });
    }
  }, [dashboardSpecs.charts, pushAssistant, updateFilters]);

  const runCommand = useCallback(async (query: string) => {
    const text = query.trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { id: makeId(), role: "user", content: text }]);

    try {
      const blockedMessage = blockedDashboardPrompt(text);
      if (blockedMessage) {
        pushAssistant(blockedMessage, { type: "warning", provider: "schema-guardian" });
        return;
      }

      const datasetId = payload.id || payload.name || "local-dataset";
      const response = await schemaAiClient.sendDashboardCommand(
        datasetId,
        text,
        { kpis: allSpecs.kpis, charts: allSpecs.charts, filters },
        {
          ...payloadWithContext,
          id: datasetId,
          rows: cleanDatasetRows(rows as Row[]),
        },
        { useLlm },
      );
      applyCommand({ ...response, actions: topLevelActionToActions(response) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Schema chat failed.";
      setError(message);
      pushAssistant(`${localFallbackAnswer(text, rows)} Debug: ${message}`, { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [allSpecs, applyCommand, filters, loading, payload, payloadWithContext, pushAssistant, rows, useLlm]);

  const askChat = useCallback(async (query: string) => {
    const text = query.trim();
    if (!text || loading) return "";

    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { id: makeId(), role: "user", content: text }]);

    try {
      const datasetId = payload.id || payload.name || "local-dataset";
      const response = await schemaAiClient.sendSchemaChat(
        datasetId,
        text,
        {
          ...payloadWithContext,
          id: datasetId,
          rows: cleanDatasetRows(rows as Row[]),
        },
        { useLlm },
      );
      const content = response.assistantMessage?.content || localFallbackAnswer(text, rows);
      pushAssistant(content, {
        type: "text",
        model: response.assistantMessage?.model,
        provider: response.assistantMessage?.provider,
      });
      return content;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Schema chat failed.";
      setError(message);
      const fallback = `${localFallbackAnswer(text, rows)} Debug: ${message}`;
      pushAssistant(fallback, { type: "warning" });
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [loading, payload, payloadWithContext, pushAssistant, rows, useLlm]);

  const convertChart = useCallback((chartId: string, type: ChartType) => {
    setDashboardSpecs((current) => ({
      ...current,
      charts: current.charts.map((chart) => chart.id === chartId ? { ...chart, type } : chart),
    }));
    setManualCharts((current) => current.map((chart) => chart.id === chartId ? { ...chart, type } : chart));
  }, []);

  return {
    loading,
    error,
    messages,
    filters,
    setFilters,
    filteredRows,
    kpis: rendered.kpis as DashboardKpi[],
    charts: rendered.charts as DashboardChart[],
    dashboardSpecs: allSpecs,
    dashboardHealth,
    runCommand,
    askChat,
    applyCommand,
    convertChart,
  };
}

