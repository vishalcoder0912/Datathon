type ColumnType = "number" | "string" | "date" | "boolean";
type ColumnRole = "metric" | "dimension" | "date" | "id" | "text";

type ChartType =
  | "bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "histogram"
  | "scatter"
  | "heatmap";

type Aggregation =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "count_unique";

export interface SchemaColumn {
  name: string;
  type: ColumnType;
  role: ColumnRole;
  description?: string;
  uniqueCount?: number;
  missingPct?: number;
  topValues?: string[];
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
    median?: number;
  };
}

export interface SchemaProfile {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  domain?: string;
  columns: SchemaColumn[];
}

export interface ChartSpec {
  id?: string;
  type: ChartType;
  title: string;
  xKey: string;
  yKey?: string;
  aggregation: Aggregation;
  limit?: number;
}

export interface KpiSpec {
  id?: string;
  title: string;
  metric?: string;
  aggregation: Aggregation;
  format?: "number" | "currency" | "percent" | "text";
}

export interface DashboardPlan {
  kpis: KpiSpec[];
  charts: ChartSpec[];
  filters: Array<{
    key: string;
    label: string;
    type: "select" | "dateRange" | "numberRange";
  }>;
  executiveSummary?: {
    overview?: string;
    topTrend?: string | null;
    biggestOpportunity?: string | null;
    biggestRisk?: string | null;
    businessRecommendation?: string;
    confidenceScore?: number;
  };
  geoAnalysis?: Array<Record<string, unknown>>;
  insights?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  storyMode?: {
    whatHappened?: string;
    whyItHappened?: string;
    whatWillHappen?: string;
    recommendedAction?: string;
  };
  confidenceScore?: number;
}

export interface MasterPlannerResponse {
  action: "BUILD_DASHBOARD" | "MODIFY_DASHBOARD" | "ANSWER";
  schemaOnly: true;
  message: string;
  dashboardPlan?: DashboardPlan;
}

import { serviceUrls } from "../../config/serviceUrls.js";
import { assertNoRawRowsInString } from "./llm-payload-sanitizer.js";

const OLLAMA_BASE_URL = serviceUrls.ollama;

const MASTER_MODEL =
  process.env.DASHBOARD_MASTER_MODEL || "insightflow-master";

const dashboardPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "schemaOnly", "message", "dashboardPlan"],
  properties: {
    action: {
      type: "string",
      enum: ["BUILD_DASHBOARD", "MODIFY_DASHBOARD", "ANSWER"],
    },
    schemaOnly: {
      type: "boolean",
    },
    message: {
      type: "string",
    },
    dashboardPlan: {
      type: "object",
      additionalProperties: false,
      required: ["kpis", "charts", "filters"],
      properties: {
        kpis: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "aggregation"],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              metric: { type: "string" },
              aggregation: {
                type: "string",
                enum: [
                  "count",
                  "sum",
                  "avg",
                  "min",
                  "max",
                  "median",
                  "count_unique",
                ],
              },
              format: {
                type: "string",
                enum: ["number", "currency", "percent", "text"],
              },
            },
          },
        },
        charts: {
          type: "array",
          maxItems: 7,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "title", "xKey", "aggregation"],
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "bar",
                  "horizontalBar",
                  "line",
                  "area",
                  "pie",
                  "donut",
                  "histogram",
                  "scatter",
                  "heatmap",
                ],
              },
              title: { type: "string" },
              xKey: { type: "string" },
              yKey: { type: "string" },
              aggregation: {
                type: "string",
                enum: [
                  "count",
                  "sum",
                  "avg",
                  "min",
                  "max",
                  "median",
                  "count_unique",
                ],
              },
              limit: { type: "number" },
            },
          },
        },
        filters: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label", "type"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              type: {
                type: "string",
                enum: ["select", "dateRange", "numberRange"],
              },
            },
          },
        },
        executiveSummary: {
          type: "object",
          additionalProperties: true,
        },
        geoAnalysis: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        insights: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        recommendations: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        storyMode: {
          type: "object",
          additionalProperties: true,
        },
        confidenceScore: {
          type: "number",
        },
      },
    },
  },
};

export function compactSchema(schemaProfile: SchemaProfile) {
  return {
    datasetName: schemaProfile.datasetName,
    rowCount: schemaProfile.rowCount,
    columnCount: schemaProfile.columnCount,
    domain: schemaProfile.domain || "unknown",
    columns: schemaProfile.columns.map((column) => ({
      name: column.name,
      type: column.type,
      role: column.role,
      description: column.description || "",
      uniqueCount: column.uniqueCount ?? 0,
      missingPct: column.missingPct ?? 0,
      topValues: Array.isArray(column.topValues)
        ? column.topValues.slice(0, 8)
        : [],
      stats: column.stats || null,
    })),
  };
}

function getColumnSet(schemaProfile: SchemaProfile) {
  return new Set(schemaProfile.columns.map((column) => column.name));
}

function getMetricColumns(schemaProfile: SchemaProfile) {
  return schemaProfile.columns.filter((column) => column.role === "metric");
}

function getDimensionColumns(schemaProfile: SchemaProfile) {
  return schemaProfile.columns.filter((column) => column.role === "dimension");
}

function getDateColumns(schemaProfile: SchemaProfile) {
  return schemaProfile.columns.filter((column) => column.role === "date");
}

function removeUnsafeChartData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUnsafeChartData);
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (key.toLowerCase() === "data") continue;
      cleaned[key] = removeUnsafeChartData(item);
    }

    return cleaned;
  }

  return value;
}

function validatePlan(
  response: MasterPlannerResponse,
  schemaProfile: SchemaProfile
): MasterPlannerResponse {
  const columns = getColumnSet(schemaProfile);

  const safeCharts = (response.dashboardPlan?.charts || [])
    .filter((chart) => columns.has(chart.xKey))
    .filter((chart) => !chart.yKey || columns.has(chart.yKey))
    .slice(0, 7)
    .map((chart, index) => ({
      ...chart,
      id: chart.id || `chart-${index + 1}`,
      limit: chart.limit || 10,
    }));

  const safeKpis = (response.dashboardPlan?.kpis || [])
    .filter((kpi) => !kpi.metric || columns.has(kpi.metric))
    .slice(0, 6)
    .map((kpi, index) => ({
      ...kpi,
      id: kpi.id || `kpi-${index + 1}`,
      format: kpi.format || "number",
    }));

  const safeFilters = (response.dashboardPlan?.filters || [])
    .filter((filter) => columns.has(filter.key))
    .slice(0, 6);

  return {
    action: response.action || "BUILD_DASHBOARD",
    schemaOnly: true,
    message: response.message || "Dashboard plan generated.",
    dashboardPlan: {
      kpis: safeKpis,
      charts: safeCharts,
      filters: safeFilters,
      executiveSummary: response.dashboardPlan?.executiveSummary,
      geoAnalysis: response.dashboardPlan?.geoAnalysis || [],
      insights: response.dashboardPlan?.insights || [],
      recommendations: response.dashboardPlan?.recommendations || [],
      storyMode: response.dashboardPlan?.storyMode,
      confidenceScore: response.dashboardPlan?.confidenceScore,
    },
  };
}

function fallbackPlan(schemaProfile: SchemaProfile): MasterPlannerResponse {
  const metrics = getMetricColumns(schemaProfile);
  const dimensions = getDimensionColumns(schemaProfile);
  const dates = getDateColumns(schemaProfile);

  const metric = metrics[0];
  const metric2 = metrics[1];
  const dimension = dimensions[0];
  const dimension2 = dimensions[1];
  const date = dates[0];

  const kpis: KpiSpec[] = [
    {
      id: "kpi-total-records",
      title: "Total Records",
      aggregation: "count",
      format: "number",
    },
  ];

  if (metric) {
    kpis.push(
      {
        id: "kpi-average",
        title: `Average ${metric.name}`,
        metric: metric.name,
        aggregation: "avg",
        format: "number",
      },
      {
        id: "kpi-highest",
        title: `Highest ${metric.name}`,
        metric: metric.name,
        aggregation: "max",
        format: "number",
      }
    );
  }

  if (dimension) {
    kpis.push({
      id: "kpi-unique-dimension",
      title: `Unique ${dimension.name}`,
      metric: dimension.name,
      aggregation: "count_unique",
      format: "number",
    });
  }

  const charts: ChartSpec[] = [];

  if (dimension && metric) {
    charts.push({
      id: "chart-metric-by-dimension",
      type: "bar",
      title: `Average ${metric.name} by ${dimension.name}`,
      xKey: dimension.name,
      yKey: metric.name,
      aggregation: "avg",
      limit: 10,
    });
  }

  if (metric) {
    charts.push({
      id: "chart-distribution",
      type: "histogram",
      title: `${metric.name} Distribution`,
      xKey: metric.name,
      yKey: metric.name,
      aggregation: "count",
      limit: 10,
    });
  }

  if (dimension) {
    charts.push({
      id: "chart-category-share",
      type: "donut",
      title: `Records by ${dimension.name}`,
      xKey: dimension.name,
      aggregation: "count",
      limit: 8,
    });
  }

  if (date && metric) {
    charts.push({
      id: "chart-trend",
      type: "line",
      title: `${metric.name} Trend`,
      xKey: date.name,
      yKey: metric.name,
      aggregation: "sum",
      limit: 30,
    });
  }

  if (dimension2 && metric) {
    charts.push({
      id: "chart-second-dimension",
      type: "bar",
      title: `Average ${metric.name} by ${dimension2.name}`,
      xKey: dimension2.name,
      yKey: metric.name,
      aggregation: "avg",
      limit: 10,
    });
  }

  if (metric && metric2) {
    charts.push({
      id: "chart-scatter",
      type: "scatter",
      title: `${metric.name} vs ${metric2.name}`,
      xKey: metric.name,
      yKey: metric2.name,
      aggregation: "count",
      limit: 200,
    });
  }

  for (const dim of dimensions) {
    if (charts.length >= 7) break;

    charts.push({
      id: `chart-top-${dim.name}`,
      type: "bar",
      title: `Top ${dim.name}`,
      xKey: dim.name,
      aggregation: "count",
      limit: 10,
    });
  }

  return {
    action: "BUILD_DASHBOARD",
    schemaOnly: true,
    message: "Dashboard generated using local fallback rules.",
    dashboardPlan: {
      kpis: kpis.slice(0, 6),
      charts: charts.slice(0, 7),
      filters: [
        ...dimensions.slice(0, 4).map((column) => ({
          key: column.name,
          label: column.name,
          type: "select" as const,
        })),
        ...dates.slice(0, 1).map((column) => ({
          key: column.name,
          label: column.name,
          type: "dateRange" as const,
        })),
      ],
    },
  };
}

export async function generateMasterDashboardPlan({
  schemaProfile,
  userGoal = "Generate a complete dashboard with KPIs, filters, and 7 useful charts.",
}: {
  schemaProfile: SchemaProfile;
  userGoal?: string;
}): Promise<MasterPlannerResponse> {
  const schemaOnlyPacket = compactSchema(schemaProfile);

  // Assert no raw rows are sent to LLM
  try {
    assertNoRawRowsInString(JSON.stringify({ schemaOnlyPacket, userGoal }));
  } catch (error) {
    console.error(`[insightflowMasterPlanner BLOCKED] ${error.message}`);
    return fallbackPlan(schemaProfile);
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MASTER_MODEL,
        stream: false,
        keep_alive: "2m",
        format: dashboardPlanSchema,
        options: {
          temperature: 0.05,
          num_ctx: 4096,
          num_predict: 1200,
        },
        messages: [
          {
            role: "system",
            content:
              "You are a schema-only AI analyst. You never receive raw dataset rows. You plan and explain using schema, metadata, and deterministic aggregate results only. Never ask for or rely on raw rows. You are InsightFlow AI, a Chief Data Analyst, RAG-aware Schema Engine, and dashboard architect. You do not see raw rows. Return strict JSON only. Never include chart.data, KPI values, fake numbers, sample records, or raw rows. Use only schema columns. Infer business KPIs, charts, executive summary, geo analysis only when location fields exist, AI insights, recommendations, story mode, and confidence from schema semantics.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                userGoal,
                schemaOnly: true,
                schemaProfile: schemaOnlyPacket,
              },
              null,
              2
            ),
          },
        ],
      }),
    });

    if (!response.ok) {
      return fallbackPlan(schemaProfile);
    }

    const payload = await response.json();
    const content = payload?.message?.content || "{}";

    const parsed = JSON.parse(content);
    const cleaned = removeUnsafeChartData(parsed) as MasterPlannerResponse;

    return validatePlan(cleaned, schemaProfile);
  } catch {
    return fallbackPlan(schemaProfile);
  }
}
