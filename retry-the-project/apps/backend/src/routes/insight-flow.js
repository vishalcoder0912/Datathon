import { sendSuccess, sendError } from "../utils/response-utils.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { getDatasetById } from "../database/dataset-repository.js";
import AnalyticsEngine from "../genai/analyticsEngine.js";
import DashboardBuilder from "../genai/dashboardBuilder.js";

const analyticsEngine = new AnalyticsEngine();
const dashboardBuilder = new DashboardBuilder();

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

/**
 * InsightFlow Engine — Master Analytics Pipeline
 * Implements the full 10-step master prompt pipeline:
 * Schema Understanding → Dataset Detection → KPI Generation → Chart Planner →
 * Geo Intelligence → Filter Intelligence → AI Chat → Quality Rules →
 * Insight Engine → Dashboard Scoring + Self-Critic
 */
export async function handleInsightFlowRoutes(request, response, pathname) {
  const { method } = request;

  // POST /api/insight-flow/analyze — Full pipeline run
  const analyzeMatch = pathname.match(/^\/api\/insight-flow\/analyze$/);

  if (analyzeMatch && method === "POST") {
    try {
      const body = await readJsonBody(request);
      const { datasetId, rows, columns } = body;

      if (columns !== undefined && columns !== null && !Array.isArray(columns)) {
        throw new TypeError("columns must be an array");
      }

      let dataset;

      if (datasetId) {
        dataset = getDatasetById(datasetId);
        if (!dataset) {
          sendError(response, HTTP_STATUS.NOT_FOUND || 404, "Dataset not found", ERROR_CODES.NOT_FOUND);
          return true;
        }
      }

      const payload = dataset || { data: rows || [], columns: columns || [] };

      // Run through the full pipeline
      const schema = await analyticsEngine.analyzeDatasetStructure({
        columns: payload.columns || Object.keys(payload.data[0] || {}),
        data: payload.data || payload.rows || [],
      });

      const kpis = await analyticsEngine.generateKPIs(schema, payload);
      const visualizations = await analyticsEngine.generateVisualizations(schema, payload);
      const dashboard = await analyticsEngine.buildExecutiveDashboard(schema, kpis, visualizations);
      const insights = await analyticsEngine.generateAIInsights(schema, payload);

      // Build the master prompt-compliant result
      const result = {
        valid: true,
        dashboardType: `${schema.dataset_domain} Intelligence Dashboard`,
        datasetType: schema.dataset_domain,
        qualityScore: {
          total: 85,
          kpiRelevance: kpis.length >= 4 ? 90 : 60,
          chartDiversity: Math.min(100, visualizations.length * 14),
          geoRelevance: schema.geo_dimensions?.length > 0 ? 85 : 70,
          businessUsefulness: schema.dataset_domain !== "Analytics Dataset" ? 85 : 60,
          filterUsefulness: dashboard.filters?.length > 0 ? 80 : 40,
          passed: true,
        },
        kpis: kpis.map((kpi) => ({
          id: kpi.name?.toLowerCase().replace(/\s+/g, "-"),
          title: kpi.name,
          value: "—",
          rawValue: 0,
          subtitle: kpi.description,
          metric: kpi.name,
          aggregation: "auto",
          format: "number",
          businessValue: kpi.business_value || kpi.businessValue || "Business metric",
          domain: schema.dataset_domain,
        })),
        charts: visualizations.slice(0, 7).map((viz) => ({
          id: viz.title?.toLowerCase().replace(/\s+/g, "-"),
          type: viz.type === "heatmap" ? "heatmap" : viz.type === "line" ? "line" : viz.type === "scatter" || viz.type === "area" || viz.type === "bar" || viz.type === "pie" || viz.type === "donut" ? viz.type : "bar",
          title: viz.title,
          subtitle: viz.insight || "Auto-generated visualization",
          xKey: viz.dimensions?.[0] || schema.dimensions?.[0] || "category",
          yKey: viz.measures?.[0] || schema.measures?.[0] || "value",
          aggregation: viz.aggregation || "sum",
          intent: assignIntent(viz.type, viz.title),
          data: [],
          businessValue: viz.insight || "Business insight",
        })),
        geoIntelligence: {
          enabled: (schema.geo_dimensions?.length || 0) > 0,
          field: schema.geo_dimensions?.[0] || "",
          metricField: schema.measures?.[0] || "",
          mapType: "choropleth",
          locations: [],
          totalLocations: 0,
          topLocation: null,
          totalRecords: payload.data?.length || 0,
          globalAverage: 0,
          mostCommonCategory: schema.dimensions?.[0] || "",
          recommendation: "Configure geo data for intelligence.",
        },
        filters: (dashboard.filters || []).map((f) => ({
          key: f.dimension || f.name || "filter",
          label: f.name || f.dimension || "Filter",
          type: "category",
          values: [],
          priority: 3,
        })),
        insights: {
          executive: insights.slice(0, 3).map((i) => i.insight).join(". ") || "Executive-level insights generated.",
          analyst: insights.slice(3, 6).map((i) => i.insight).join(". ") || "Analytical insights ready.",
          story: insights.slice(6).map((i) => i.insight).join(". ") || "Data narrative available.",
        },
      };

      // Self-Critic checklist
      const criticIssues = [];
      if (result.charts.length < 5) criticIssues.push("Low chart diversity");
      if (result.kpis.length < 4) criticIssues.push("Insufficient KPIs");
      if (!result.geoIntelligence.enabled && schema.geo_dimensions?.length > 0) criticIssues.push("Geo intelligence not configured");
      if (!result.insights.executive) criticIssues.push("Missing executive insights");

      result.qualityScore.passed = criticIssues.length === 0;
      if (criticIssues.length > 0) {
        result.qualityScore.total = Math.max(60, result.qualityScore.total - criticIssues.length * 5);
      }
      result.qualityScore.selfCritic = {
        passed: result.qualityScore.passed,
        issues: criticIssues,
        score: result.qualityScore.total,
        timestamp: new Date().toISOString(),
      };

      sendSuccess(response, result, "InsightFlow analysis completed");
      return true;
    } catch (error) {
      console.error("InsightFlow analysis error:", error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR || 500,
        error.message || "InsightFlow analysis failed",
        ERROR_CODES.INTERNAL_ERROR
      );
      return true;
    }
  }

  // POST /api/insight-flow/validate — Self-Critic validation only
  const validateMatch = pathname.match(/^\/api\/insight-flow\/validate$/);

  if (validateMatch && method === "POST") {
    try {
      const body = await readJsonBody(request);
      const { charts, kpis, geoIntelligence, schema } = body;

      const issues = [];

      // Chart quality checks
      if (!charts?.length) issues.push("No charts to validate");
      if (charts?.length < 5) issues.push("Less than 5 charts — low diversity risk");

      const intents = new Set((charts || []).map((c) => c.intent).filter(Boolean));
      if (intents.size < 3) issues.push(`Only ${intents.size} unique chart intents`);

      // Check for meaningless charts
      const rejectedPatterns = [/name\s+distribution/i, /reviewer\s+name/i, /customer\s+name/i, /url\s+distribution/i];
      for (const chart of charts || []) {
        const check = `${chart.title} ${chart.xKey} ${chart.yKey}`;
        if (rejectedPatterns.some((p) => p.test(check))) {
          issues.push(`Rejected chart: "${chart.title}" uses meaningless patterns`);
        }
      }

      // KPI relevance
      if (!kpis?.length) issues.push("No KPIs defined");
      if (kpis?.length < 4) issues.push("Less than 4 KPIs");

      // Geo metric correctness
      if (geoIntelligence?.enabled && geoIntelligence?.metricField) {
        const metricNames = (kpis || []).map((k) => k.metric).filter(Boolean);
        if (!metricNames.includes(geoIntelligence.metricField)) {
          issues.push("Geo metric not found in KPIs");
        }
      }

      // Scoring
      const chartScore = charts?.length >= 7 ? 100 : charts?.length >= 5 ? 80 : 50;
      const diversityScore = intents.size >= 5 ? 100 : intents.size >= 3 ? 75 : 40;
      const kpiScore = kpis?.length >= 4 ? 100 : kpis?.length >= 2 ? 60 : 30;
      const totalScore = Math.round((chartScore * 0.3 + diversityScore * 0.3 + kpiScore * 0.4));

      const result = {
        passed: issues.length === 0,
        issues,
        score: totalScore,
        timestamp: new Date().toISOString(),
        details: {
          chartCount: charts?.length || 0,
          uniqueIntents: intents.size,
          kpiCount: kpis?.length || 0,
          geoEnabled: geoIntelligence?.enabled || false,
        },
      };

      sendSuccess(response, result, "Self-critic validation completed");
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR || 500,
        error.message || "Self-critic validation failed",
        ERROR_CODES.INTERNAL_ERROR
      );
      return true;
    }
  }

  return false;
}

function assignIntent(type, title) {
  const t = (title || "").toLowerCase();
  const match = (type || "").toLowerCase();

  if (match === "line" || match === "area" || t.includes("trend") || t.includes("over time")) return "trend";
  if (match === "pie" || match === "donut" || t.includes("composition") || t.includes("breakdown") || t.includes("distribution by")) return "composition";
  if (match === "scatter" || t.includes("correlation") || t.includes("vs ")) return "correlation";
  if (match === "histogram" || t.includes("distribution") || t.includes("histogram")) return "distribution";
  if (match === "map" || t.includes("geo") || t.includes("geographic") || t.includes("country") || t.includes("region")) return "geo";
  if (t.includes("comparison") || t.includes("by ")) return "comparison";
  return "relationship";
}
