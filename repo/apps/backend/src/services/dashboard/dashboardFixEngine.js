import { generateSchemaProfile } from "./schemaProfiler.js";
import { planDashboardWithAI } from "../ai/dashboardPlanner.js";
import { buildDashboardFromPlan } from "./dashboardAnalytics.js";

export async function validateAndFixDashboard({
  rows = [],
  dataDictionary = [],
  datasetName = "Uploaded Dataset",
  currentDashboard = {},
}) {
  const schemaProfile = generateSchemaProfile({
    rows,
    dataDictionary,
    datasetName,
  });

  const issues = [];

  if (!currentDashboard?.kpis?.length) {
    issues.push({
      type: "missing_kpis",
      message: "Dashboard has no KPI cards.",
    });
  }

  if (!currentDashboard?.charts?.length) {
    issues.push({
      type: "missing_charts",
      message: "Dashboard has no charts.",
    });
  }

  const hasChartDataFromAI = (currentDashboard?.charts || []).some((chart) =>
    Array.isArray(chart?.data)
  );

  if (hasChartDataFromAI) {
    issues.push({
      type: "unsafe_chart_data",
      message:
        "Dashboard contained chart data. It was regenerated locally from chart specs.",
    });
  }

  const aiPlan = await planDashboardWithAI({
    schemaProfile,
    userQuery:
      "Validate and regenerate a correct dashboard. Use schema only. Create useful KPIs and up to 7 charts.",
    currentDashboard: {
      kpis: currentDashboard.kpis || [],
      charts: (currentDashboard.charts || []).map((chart) => ({
        id: chart.id,
        type: chart.type,
        title: chart.title,
        xKey: chart.xKey,
        yKey: chart.yKey,
        aggregation: chart.aggregation,
      })),
      filters: currentDashboard.filters || {},
    },
  });

  const correctedDashboard = buildDashboardFromPlan({
    rows,
    filters: currentDashboard.filters || {},
    dashboardPlan: aiPlan.dashboardPlan,
  });

  return {
    action: "FIX_DASHBOARD",
    message: "Dashboard validated and regenerated from schema + local data.",
    schemaOnly: false,
    provider: "local-integrity-engine",
    issues,
    observations: [
      `Rows used locally: ${correctedDashboard.rows.length}`,
      `KPIs generated: ${correctedDashboard.kpis.length}`,
      `Charts generated: ${correctedDashboard.charts.length}`,
      "LLM did not receive raw rows.",
    ],
    correctedDashboard,
  };
}
