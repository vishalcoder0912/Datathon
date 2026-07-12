import { callOllamaJson } from "./ollamaClient.js";
import { getModelForTask } from "../../config/model-router.js";
import { aiProviderRouter } from "../ai-providers/ai-router.js";

const DASHBOARD_MODEL = getModelForTask("dashboard_planner");

const dashboardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "schemaOnly", "message", "dashboardPlan"],
  properties: {
    action: {
      type: "string",
      enum: [
        "BUILD_DASHBOARD",
        "GENERATE_CHART",
        "MODIFY_CHART",
        "DELETE_CHART",
        "GENERATE_KPI",
        "FILTER",
        "CLEAR_FILTERS",
        "ANSWER",
      ],
    },
    schemaOnly: { type: "boolean" },
    message: { type: "string" },
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
                  "line",
                  "area",
                  "pie",
                  "donut",
                  "histogram",
                  "scatter",
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
      },
    },
  },
};

function compactSchema(schemaProfile) {
  return {
    datasetName: schemaProfile.datasetName,
    rowCount: schemaProfile.rowCount,
    columnCount: schemaProfile.columnCount,
    columns: schemaProfile.columns.map((column) => ({
      name: column.name,
      type: column.type,
      role: column.role,
      description: column.description || "",
      uniqueCount: column.uniqueCount || 0,
      missingPct: column.missingPct || 0,
      topValues: Array.isArray(column.topValues)
        ? column.topValues.slice(0, 8)
        : [],
      stats: column.stats || null,
    })),
  };
}

function getColumns(schemaProfile) {
  return new Set(schemaProfile.columns.map((column) => column.name));
}

function fallbackDashboardPlan(schemaProfile) {
  const metrics = schemaProfile.columns.filter((column) => column.role === "metric");
  const dimensions = schemaProfile.columns.filter((column) => column.role === "dimension");
  const dates = schemaProfile.columns.filter((column) => column.role === "date");

  const metric = metrics[0];
  const metric2 = metrics[1];
  const dimension = dimensions[0];
  const dimension2 = dimensions[1];
  const date = dates[0];

  const kpis = [
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

  const charts = [];

  if (dimension && metric) {
    charts.push({
      id: "chart-main-bar",
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
      limit: 8,
    });
  }

  if (dimension) {
    charts.push({
      id: "chart-donut",
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
      id: "chart-second-category",
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
          type: "select",
        })),
        ...dates.slice(0, 1).map((column) => ({
          key: column.name,
          label: column.name,
          type: "dateRange",
        })),
      ],
    },
  };
}

function validatePlan(plan, schemaProfile) {
  const columnSet = getColumns(schemaProfile);

  const safeKpis = (plan.dashboardPlan?.kpis || [])
    .filter((kpi) => !kpi.metric || columnSet.has(kpi.metric))
    .slice(0, 6);

  const safeCharts = (plan.dashboardPlan?.charts || [])
    .filter((chart) => columnSet.has(chart.xKey))
    .filter((chart) => !chart.yKey || columnSet.has(chart.yKey))
    .map((chart, index) => ({
      ...chart,
      id: chart.id || `chart-${index + 1}`,
      limit: chart.limit || 10,
    }))
    .slice(0, 7);

  const safeFilters = (plan.dashboardPlan?.filters || [])
    .filter((filter) => columnSet.has(filter.key))
    .slice(0, 6);

  const validated = {
    action: plan.action || "BUILD_DASHBOARD",
    schemaOnly: true,
    message: plan.message || "Dashboard plan generated.",
    dashboardPlan: {
      kpis: safeKpis,
      charts: safeCharts,
      filters: safeFilters,
    },
  };

  if (!validated.dashboardPlan.kpis.length || !validated.dashboardPlan.charts.length) {
    return fallbackDashboardPlan(schemaProfile);
  }

  return validated;
}

export async function planDashboardWithAI({
  schemaProfile,
  userQuery = "Generate a complete dashboard with KPIs, filters, and 7 useful charts.",
  currentDashboard = null,
}) {
  try {
    const compact = compactSchema(schemaProfile);
    const result = await aiProviderRouter.runAITask({
      taskType: "dashboard_planner",
      schemaPacket: compact,
      userQuery,
      dashboardState: currentDashboard || {}
    });

    if (result.success) {
      const actions = result.actions || [];
      const dashboardPlan = {
        kpis: actions.filter(a => a.action === 'create_kpi').map((k, index) => ({
          id: k.id || `kpi-${index}`,
          title: k.title,
          metric: k.metric,
          aggregation: k.aggregation || 'sum',
          format: k.format || 'number'
        })),
        charts: actions.filter(a => a.action === 'create_chart' || a.action === 'create_chart_spec').map((c, index) => ({
          id: c.id || `chart-${index}`,
          type: c.chart_type || c.type || 'bar',
          title: c.title,
          xKey: c.xKey || c.x,
          yKey: c.yKey || c.y,
          aggregation: c.aggregation || 'count',
          limit: c.limit || 10
        })),
        filters: actions.filter(a => a.action === 'create_filter').map((f) => ({
          key: f.column || f.field,
          label: f.column || f.field,
          type: 'select'
        }))
      };

      const finalResult = {
        action: actions.length ? 'BUILD_DASHBOARD' : 'ANSWER',
        schemaOnly: true,
        message: result.natural_response || 'Dashboard generated.',
        dashboardPlan
      };

      return validatePlan(finalResult, schemaProfile);
    }
    
    return fallbackDashboardPlan(schemaProfile);
  } catch (error) {
    console.error('[dashboardPlanner] runAITask failed:', error);
    return fallbackDashboardPlan(schemaProfile);
  }
}
