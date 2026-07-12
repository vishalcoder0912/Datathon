import { buildSchemaRagMemoryEntry } from "../schema-rag-memory-builder.js";
import { upsertSchemaRagMemory } from "../schema-rag-store.js";
import { embedText } from "../schema-rag-embeddings.js";
import { DEEP_AGENTIC_ANALYTICS_TRAINING_PACK } from "./deep-agentic-analytics-training-pack.js";

function inferTypeFromRole(role = "") {
  const r = role.toLowerCase();

  if (r.includes("time")) return "date";
  if (
    r.includes("metric") ||
    r.includes("money") ||
    r.includes("cost") ||
    r.includes("profit") ||
    r.includes("volume") ||
    r.includes("latitude") ||
    r.includes("longitude")
  ) {
    return "number";
  }

  return "category";
}

function makeColumn(name, role) {
  return {
    name,
    normalizedName: name.toLowerCase(),
    title: name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase()),
    type: inferTypeFromRole(role),
    role,
    missingPct: 0,
    uniqueCount: role.includes("metric") ? 0 : 8,
    topValues: [],
  };
}

function buildProfile(seed, schemaPattern, index) {
  const columns = schemaPattern.map((name) => {
    const role =
      seed.columnRoles[name] ||
      seed.columnRoles[name.toLowerCase()] ||
      "category_dimension";

    return makeColumn(name, role);
  });

  return {
    datasetName: `${seed.domain}_training_${index + 1}`,
    rowCount: 5000,
    columnCount: columns.length,
    domain: seed.domain,
    signature: `${seed.domain}_${index + 1}`,
    columns,
  };
}

function buildDashboardPlan(seed) {
  return {
    domain: seed.domain,
    kpis: seed.kpis.map((kpi) => ({
      title: kpi.title,
      formula: kpi.formula,
      priority: kpi.priority,
      aggregation: guessAggregation(kpi.formula),
      analystReason: seed.reasoning,
    })),
    charts: seed.charts.map((chart, index) => ({
      id: `${seed.domain}_chart_${index + 1}`,
      title: chart.title,
      type: chart.type,
      xRole: chart.xRole,
      yRole: chart.yRole,
      priority: "high",
      analystReason: seed.reasoning,
    })),
    insights: [
      {
        type: "analyst_reasoning",
        title: "Business Meaning",
        description: seed.reasoning,
      },
    ],
    recommendedQuestions: [
      `What is driving performance in ${seed.domain}?`,
      `Which segment has the highest impact in ${seed.domain}?`,
      `What should I improve first in ${seed.domain}?`,
    ],
  };
}

function guessAggregation(formula = "") {
  const f = formula.toLowerCase();
  if (f.includes("avg")) return "avg";
  if (f.includes("median")) return "median";
  if (f.includes("max")) return "max";
  if (f.includes("count")) return "count";
  return "sum";
}

function buildEmbeddingText(seed, profile, plan) {
  return [
    `Domain: ${seed.domain}`,
    `Aliases: ${seed.aliases.join(", ")}`,
    `Columns: ${profile.columns.map((c) => `${c.name}:${c.role}:${c.type}`).join(" | ")}`,
    `KPIs: ${plan.kpis.map((k) => `${k.title}=${k.formula}`).join(" | ")}`,
    `Charts: ${plan.charts.map((c) => `${c.title}:${c.type}:${c.xRole}->${c.yRole}`).join(" | ")}`,
    `Analyst reasoning: ${seed.reasoning}`,
  ].join("\n");
}

export async function trainDeepAgenticAnalytics() {
  const results = [];

  for (const seed of DEEP_AGENTIC_ANALYTICS_TRAINING_PACK) {
    for (let i = 0; i < seed.schemaPatterns.length; i += 1) {
      const profile = buildProfile(seed, seed.schemaPatterns[i], i);
      const dashboardPlan = buildDashboardPlan(seed);
      const embeddingText = buildEmbeddingText(seed, profile, dashboardPlan);
      const embedding = await embedText(embeddingText);

      const entry = buildSchemaRagMemoryEntry({
        dataset: {
          id: `deep-agentic-${seed.domain}-${i + 1}`,
          name: `${seed.domain}_agentic_seed_${i + 1}`,
        },
        schemaProfile: profile,
        dashboardPlan,
        source: "deep-agentic-training-pack",
        rating: "excellent",
        notes: seed.reasoning,
        embedding,
      });

      await upsertSchemaRagMemory(entry);

      results.push({
        domain: seed.domain,
        schema: profile.columns.map((c) => c.name),
        kpis: dashboardPlan.kpis.length,
        charts: dashboardPlan.charts.length,
      });
    }
  }

  return {
    success: true,
    trainedExamples: results.length,
    domains: [...new Set(results.map((r) => r.domain))],
    results,
  };
}
