import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/features/data/api/dataApi";
import type { Dataset } from "@/features/data/model/dataStore";
import { buildPremiumDashboardModel } from "@/features/dashboard/utils/schemaFirstAnalytics";
import type { AgentMessage } from "@/features/dashboard/types/premiumDashboardTypes";

const starterMessages: AgentMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Hello. Ask me about KPIs, charts, correlations, segments, or recommendations.",
    createdAt: new Date().toISOString(),
  },
];

const randomId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const useBackendAgent = () => import.meta.env.VITE_USE_BACKEND_AGENTIC_AI !== "false";
const agentSampleSize = () => Number(import.meta.env.VITE_AGENTIC_SCHEMA_SAMPLE_SIZE || 7000);

const asNumber = (value: unknown): number | null => {
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoney = (value: number, column = "") =>
  new Intl.NumberFormat("en-US", {
    style: /amount|billing|sales|revenue|salary|income|price|cost|profit|usd|inr/i.test(column) ? "currency" : "decimal",
    currency: "USD",
    maximumFractionDigits: value > 100 ? 0 : 2,
  }).format(value);

const groupAverage = (dataset: Dataset, dimension: string, metric: string) => {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of dataset.rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const value = asNumber(row[metric]);
    if (value === null) continue;
    const bucket = buckets.get(label) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(label, bucket);
  }
  return [...buckets.entries()]
    .map(([label, bucket]) => ({ label, value: bucket.sum / Math.max(bucket.count, 1) }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
};

function buildLocalAgentAnswer(dataset: Dataset, query: string) {
  const dashboard = buildPremiumDashboardModel(dataset);
  const metric = dashboard.primaryMetric;
  const dimension = dashboard.primaryDimension;
  const normalized = query.toLowerCase();

  if (/how many|row count|total records|count rows|count records/i.test(normalized)) {
    return `${dataset.name} has ${dataset.rows.length.toLocaleString()} real uploaded records.`;
  }

  if (metric && /average|avg|mean/i.test(normalized)) {
    const values = dataset.rows.map((row) => asNumber(row[metric])).filter((value): value is number => value !== null);
    const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    return `Average ${metric} is ${formatMoney(avg, metric)} across ${values.length.toLocaleString()} real numeric rows.`;
  }

  if (metric && dimension && /by|group|segment|top|rank|best|highest/i.test(normalized)) {
    const rows = groupAverage(dataset, dimension, metric);
    return `Top ${dimension} by average ${metric}: ${rows.map((row) => `${row.label}: ${formatMoney(row.value, metric)}`).join(", ")}. These values are calculated from real rows.`;
  }

  if (/outlier|anomal/i.test(normalized)) {
    const chart = dashboard.charts.find((item) => item.id === "metric-outliers");
    return chart?.data?.length ? `Top real outliers: ${chart.data.slice(0, 5).map((row) => `${row.label}: ${Number(row.value).toLocaleString()}`).join(", ")}.` : "No reliable numeric outliers were detected.";
  }

  if (/schema|column|profile|role/i.test(normalized)) {
    return `Schema-first analysis detected primary metric ${dashboard.primaryMetric || "not detected"}, primary dimension ${dashboard.primaryDimension || "not detected"}, ${dashboard.kpis.length} KPIs, and ${dashboard.charts.length} real-data charts.`;
  }

  if (/geo|map|city|country|location|hospital/i.test(normalized)) {
    const hasMap = dashboard.charts.some((item) => item.type === "map");
    return hasMap ? "Geo analysis is available from real city, state, country, or coordinate data." : "Hospital names were detected, but a real map needs City, Hospital City, State, Country, Latitude, or Longitude columns.";
  }

  return `Dataset summary: ${dataset.name} has ${dataset.rows.length.toLocaleString()} rows and ${dataset.columns.length} columns. Primary metric: ${dashboard.primaryMetric || "not detected"}. Primary dimension: ${dashboard.primaryDimension || "not detected"}. Data quality: ${dashboard.qualityScore}/100. All KPI and chart values are calculated from real rows.`;
}

function buildDashboardState(dataset: Dataset) {
  const dashboard = buildPremiumDashboardModel(dataset);
  return {
    datasetName: dataset.name,
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    primaryMetric: dashboard.primaryMetric,
    primaryDimension: dashboard.primaryDimension,
    kpis: dashboard.kpis,
    charts: dashboard.charts.map((chart) => ({ id: chart.id, title: chart.title, type: chart.type, xKey: chart.xKey, yKey: chart.yKey })),
    warnings: dashboard.warnings || [],
  };
}

export function usePremiumAgenticDashboard(dataset: Dataset | null) {
  const [messages, setMessages] = useState<AgentMessage[]>(starterMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepResearch, setDeepResearch] = useState(false);

  const dashboard = useMemo(() => (dataset ? buildPremiumDashboardModel(dataset) : null), [dataset]);

  useEffect(() => {
    setMessages(starterMessages);
    setError(null);
  }, [dataset?.id]);

  const runPrompt = useCallback(
    async (prompt: string) => {
      if (!dataset || !prompt.trim()) return;
      const userMessage: AgentMessage = { id: randomId(), role: "user", content: prompt, createdAt: new Date().toISOString() };
      setMessages((current) => [...current, userMessage]);
      setLoading(true);
      setError(null);

      try {
        let answer = "";
        if (useBackendAgent()) {
          try {
            const result = await api.runSchemaOnlyAnalysis(dataset.id, prompt, buildDashboardState(dataset), { sampleSize: agentSampleSize() });
            answer = result.natural_response || result.storyMode?.recommendedAction || "Schema-safe agentic analysis completed.";
          } catch {
            answer = buildLocalAgentAnswer(dataset, prompt);
          }
        } else {
          answer = buildLocalAgentAnswer(dataset, prompt);
        }

        const assistantMessage: AgentMessage = { id: randomId(), role: "assistant", content: answer, createdAt: new Date().toISOString() };
        setMessages((current) => [...current, assistantMessage]);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to analyze the dataset.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [dataset],
  );

  return { dashboard, messages, loading, error, deepResearch, setDeepResearch, runPrompt };
}
