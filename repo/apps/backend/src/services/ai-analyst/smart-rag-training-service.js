import {
  buildSchemaUnderstanding,
} from "./schema-understanding-engine.js";

import {
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
  buildRagDashboardPlan,
} from "./schema-rag-retriever.js";

import {
  buildGuardianDashboardResponse,
} from "./dashboard-quality-guardian.js";

import {
  buildRuleDashboardPlan,
  mergePlans,
} from "./dashboard-plan-engine.js";

import {
  buildSchemaProfile,
  makeSchemaOnlyPacket,
} from "./schema-fingerprint.js";

function compactRagMatch(match) {
  const entry = match.entry || match;

  return {
    id: entry.id,
    name: entry.name,
    domain: entry.domain,
    score: match.score,
    schemaSignature: entry.schemaSignature,
    dashboardPlan: entry.dashboardPlan,
  };
}

export async function buildSmartDashboardTrainingContext(dataset, options = {}) {
  const understanding = buildSchemaUnderstanding(dataset);
  const profile = understanding.profile;

  const rag = await retrieveSchemaRagMemories(profile, {
    threshold: options.ragThreshold ?? 0.55,
    limit: options.ragLimit ?? 5,
    useOllama: options.useOllama !== false,
  });

  const ragPlan = buildRagDashboardPlan(profile, rag.matches);
  const rulePlan = buildRuleDashboardPlan(profile);

  const smartCandidatePlan = {
    source: "schema-understanding-engine",
    domain: understanding.domain.domain,
    kpis: understanding.kpiCandidates,
    charts: understanding.chartCandidates,
  };

  const merged = mergePlans(
    profile,
    ragPlan,
    smartCandidatePlan,
    rulePlan
  );

  const guarded = buildGuardianDashboardResponse(profile, merged, {
    maxCharts: options.maxCharts ?? 7,
    maxKpis: options.maxKpis ?? 8,
  });

  return {
    schemaOnly: true,
    profile: makeSchemaOnlyPacket(profile),
    understanding: {
      domain: understanding.domain,
      roles: understanding.roles,
      userExplanation: understanding.userExplanation,
      kpiCandidates: understanding.kpiCandidates,
      chartCandidates: understanding.chartCandidates,
    },
    rag: {
      used: rag.used,
      matches: rag.matches.map(compactRagMatch),
      query: rag.query,
      stats: rag.stats,
    },
    dashboard: guarded.dashboard,
    quality: {
      score: guarded.qualityScore,
      health: guarded.dashboardHealth,
      warnings: guarded.warnings,
      fixes: guarded.fixes,
    },
  };
}

export async function trainSmartRagFromApprovedDashboard({
  dataset,
  dashboardPlan,
  rating = "good",
  notes = "",
  source = "smart-user-feedback",
  useOllama,
} = {}) {
  const profile = buildSchemaProfile(dataset);
  const understanding = buildSchemaUnderstanding(profile);

  const result = await trainSchemaRagMemoryFromDataset({
    dataset,
    schemaProfile: profile,
    acceptedDashboardPlan: dashboardPlan,
    rating,
    notes: [
      notes,
      understanding.userExplanation,
      `Detected domain: ${understanding.domain.domain}`,
      `Primary metric: ${understanding.roles.primaryMetric?.name || "none"}`,
      `Primary category: ${understanding.roles.primaryCategory?.name || "none"}`,
    ]
      .filter(Boolean)
      .join("\n"),
    source,
    useOllama,
  });

  return {
    ...result,
    understanding: {
      domain: understanding.domain,
      userExplanation: understanding.userExplanation,
    },
  };
}

export async function explainDatasetSchemaForUser(dataset) {
  const understanding = buildSchemaUnderstanding(dataset);

  return {
    schemaOnly: true,
    profile: makeSchemaOnlyPacket(understanding.profile),
    explanation: understanding.userExplanation,
    domain: understanding.domain,
    roles: understanding.roles,
    recommendedKpis: understanding.kpiCandidates.slice(0, 6),
    recommendedCharts: understanding.chartCandidates.slice(0, 7),
  };
}
