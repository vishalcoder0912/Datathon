import { z } from "zod";
import { buildSchemaProfile, makeSchemaOnlyPacket } from "../ai-analyst/schema-fingerprint.js";
import { findBestSchemaMatch } from "../ai-analyst/schema-training-store.js";
import { retrieveSchemaRagMemories } from "../ai-analyst/schema-rag-retriever.js";
import { buildSalaryDashboardPlan } from "../ai-analyst/salary-dashboard-engine.js";
import { runSemanticAgent } from "./semantic-agent.js";
import { runOntologyAgent } from "./ontology-agent.js";
import { runBusinessDomainAgent } from "./business-domain-agent.js";
import { runKpiAgent } from "./kpi-agent.js";
import { runChartAgent } from "./chart-agent.js";
import { runGeoAgent } from "./geo-agent.js";
import { runInsightAgent } from "./insight-agent.js";
import { runStoryAgent } from "./story-agent.js";
import { runDashboardCriticAgent } from "./dashboard-critic-agent.js";
import { runOllamaValidatorAgent, buildGovernanceDecision } from "./ollama-validator-agent.js";
import { DashboardPlanSchema } from "./dashboard-schemas.js";

function emptyBlockedDashboard(dashboard = {}) {
  return {
    ...dashboard,
    kpis: [],
    charts: [],
    geo: { enabled: false, reason: "Blocked by AI governance.", maps: [] },
    insights: [],
  };
}

function buildCompatibilityData({ critic, validator, governance, profile, semanticProfile, ontology, businessDomain, rag, matchResult, options }) {
  const dashboard = critic.cleanedPlan;
  const renderDashboard = governance.approvedForRender ? dashboard : emptyBlockedDashboard(dashboard);
  return {
    success: governance.approvedForRender,
    schemaOnly: true,
    profile: makeSchemaOnlyPacket(profile),
    understanding: {
      domain: ontology,
      userExplanation: `Detected ${ontology.domain || profile.domain} analytics schema with ${profile.columnCount} columns.`,
      primaryMetric: semanticProfile.numericColumns?.[0] || null,
      primaryCategory: semanticProfile.categoricalColumns?.[0] || null,
      recommendedKpis: dashboard.kpis || [],
      recommendedCharts: dashboard.charts || [],
    },
    businessDomain,
    match: matchResult.best
      ? {
          dataset: matchResult.best.entry.name,
          domain: matchResult.best.entry.domain,
          score: matchResult.best.score,
        }
      : null,
    candidates: matchResult.candidates.map((candidate) => ({
      dataset: candidate.entry.name,
      domain: candidate.entry.domain,
      score: candidate.score,
    })),
    rag: {
      used: rag.used,
      threshold: rag.threshold,
      query: rag.query,
      matches: (rag.matches || []).map((match) => ({
        id: match.entry?.id,
        name: match.entry?.name,
        domain: match.entry?.domain,
        score: match.score,
      })),
      stats: rag.stats,
    },
    dashboard: renderDashboard,
    dashboardPlan: renderDashboard,
    title: dashboard.title || datasetTitleFromPlan(dashboard),
    subtitle: dashboard.subtitle || null,
    dashboardType: dashboard.dashboardType || dashboard.domain || ontology.domain || profile.domain,
    executiveSummary: renderDashboard.story?.summary || null,
    geoAnalysis: renderDashboard.geo?.enabled ? renderDashboard.geo.maps : [],
    insights: renderDashboard.insights || [],
    recommendations: [],
    storyMode: dashboard.story || null,
    confidenceScore: critic.qualityScore / 100,
    dashboardHealth: governance.approvedForRender ? "healthy" : "blocked",
    provider: rag.used ? "unified-orchestrator+rag" : "unified-orchestrator",
    model: "deterministic-schema-agents",
    quality: {
      score: critic.qualityScore,
      health: governance.approvedForRender ? "healthy" : "blocked",
      warnings: critic.warnings,
      fixes: critic.issues,
    },
    governance,
    ollamaValidator: validator,
    approvedForRender: governance.approvedForRender,
    llm: options.useLlm === false ? null : { source: "disabled-as-dashboard-engine", model: "deterministic" },
  };
}

function datasetTitleFromPlan(dashboard = {}) {
  if (dashboard.dashboardType === "salary_analytics") return "Salary Analytics Dashboard";
  return dashboard.datasetName || "Analytics Dashboard";
}

export async function generateUnifiedDashboard(dataset, options = {}) {
  z.object({}).parse({});

  if (!dataset || (!Array.isArray(dataset.rows) && !Array.isArray(dataset.columns))) {
    throw new Error("Dataset rows or columns are required.");
  }

  const schemaProfile = buildSchemaProfile(dataset);
  const matchResult = findBestSchemaMatch(schemaProfile, {
    threshold: options.threshold ?? 0.35,
  });

  const rag = await retrieveSchemaRagMemories(schemaProfile, {
    threshold: options.ragThreshold ?? 0.55,
    limit: options.ragLimit ?? 5,
    useOllama: options.useRagEmbedding !== false,
  });

  const semanticProfile = runSemanticAgent(schemaProfile);
  const ontology = runOntologyAgent(semanticProfile, rag.matches || []);
  const businessDomain = runBusinessDomainAgent({ semanticProfile, ontology });
  const salaryPlan = buildSalaryDashboardPlan(schemaProfile);
  const kpis = salaryPlan
    ? salaryPlan.kpis.map((kpi) => ({
        ...kpi,
        sourceColumn: kpi.metric?.startsWith("__") ? null : kpi.metric,
        confidence: 1,
      }))
    : runKpiAgent({ schemaProfile, semanticProfile, ontology });
  const charts = salaryPlan
    ? salaryPlan.charts.map((chart) => ({
        id: `${chart.type}-${chart.xKey}-${chart.yKey}`.replace(/[^a-z0-9_-]/gi, "-").toLowerCase(),
        confidence: 1,
        ...chart,
      }))
    : runChartAgent({ schemaProfile, semanticProfile, ontology, kpis });
  const geo = runGeoAgent({ schemaProfile: { ...schemaProfile, rows: dataset.rows || [] }, semanticProfile, ontology });
  const insights = runInsightAgent({ schemaProfile, semanticProfile, kpis, charts, geo });
  const story = runStoryAgent({ schemaProfile, kpis, charts, geo, insights });

  const draftPlan = {
    schemaOnly: true,
    datasetName: schemaProfile.datasetName,
    title: salaryPlan?.title,
    subtitle: salaryPlan?.subtitle,
    dashboardType: salaryPlan?.dashboardType,
    domain: salaryPlan?.dashboardType || businessDomain.domain || ontology.domain,
    businessDomain,
    semanticProfile,
    ontology: salaryPlan ? { ...ontology, domain: salaryPlan.dashboardType, primaryMetric: salaryPlan.primaryMetric } : ontology,
    kpis,
    charts,
    geo: salaryPlan?.geoAnalysis ? { enabled: true, ...salaryPlan.geoAnalysis } : geo,
    insights,
    story,
    ragMatches: rag.matches || [],
  };

  const validatedPlan = DashboardPlanSchema.parse(draftPlan);
  const critic = runDashboardCriticAgent(validatedPlan);
  const validator = await runOllamaValidatorAgent({
    artifact: critic.cleanedPlan,
    artifactType: "dashboard",
    schemaProfile,
    critic,
    requireOllama: options.requireOllamaValidation ?? options.useOllamaValidator ?? (process.env.ENABLE_OLLAMA_VALIDATOR === "1"),
  });
  const governance = buildGovernanceDecision({ critic, validator, artifactType: "dashboard" });
  const data = buildCompatibilityData({ critic, validator, governance, profile: schemaProfile, semanticProfile, ontology, businessDomain, rag, matchResult, options });

  return {
    ok: governance.approvedForRender,
    success: governance.approvedForRender,
    schemaOnly: true,
    profile: schemaProfile,
    dashboard: data.dashboard,
    dashboardPlan: data.dashboardPlan,
    critic,
    ollamaValidator: validator,
    governance,
    message: critic.valid
      ? governance.approvedForRender
        ? "Schema-aware dashboard generated and approved."
        : "Dashboard blocked by AI governance."
      : "Dashboard generated with warnings and blocked by critic.",
    data,
  };
}
