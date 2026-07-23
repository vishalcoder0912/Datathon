import { GENAI_AGENTIC_DOMAIN_PACK } from "./genai-agentic-domain-pack.js";
import { buildSchemaRagMemoryEntry } from "../schema-rag-memory-builder.js";
import { upsertSchemaRagMemory } from "../schema-rag-store.js";
import { embedText } from "../schema-rag-embeddings.js";

function inferType(name = "") {
  const n = name.toLowerCase();

  if (/date|time|timestamp|month|year/.test(n)) return "date";
  if (
    /price|rent|revenue|cost|amount|rate|score|count|duration|usage|bill|orders|claims|delay|distance|kwh|mwh|minutes|rating|yield|occupancy|churn|profit|margin/.test(n)
  ) {
    return "number";
  }

  return "category";
}

function inferRole(name = "") {
  const n = name.toLowerCase();

  if (/country|city|state|region|location|origin|destination|route/.test(n)) return "geo_dimension";
  if (/date|time|timestamp/.test(n)) return "time_dimension";
  if (/price|rent|revenue|cost|amount|bill|premium|claim/.test(n)) return "money_metric";
  if (/rate|score|rating|churn|fraud|retention|activation|conversion/.test(n)) return "performance_metric";
  if (/id/.test(n)) return "identifier";
  if (/status|type|segment|plan|category|source|device|channel/.test(n)) return "business_dimension";

  return "category_dimension";
}

function buildProfile(seed, schema, index) {
  return {
    datasetName: `${seed.domain}_genai_seed_${index + 1}`,
    rowCount: 25000,
    columnCount: schema.length,
    domain: seed.domain,
    signature: `${seed.domain}_genai_${index + 1}`,
    columns: schema.map((name) => ({
      name,
      normalizedName: name.toLowerCase(),
      title: name.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()),
      type: inferType(name),
      role: inferRole(name),
      missingPct: 0,
      uniqueCount: inferRole(name) === "identifier" ? 25000 : 20,
      topValues: [],
      stats:
        inferType(name) === "number"
          ? { min: 0, max: 100000, mean: 5000, median: 3000 }
          : undefined,
    })),
  };
}

function buildPlan(seed) {
  return {
    domain: seed.domain,
    agentGoal: seed.agentGoal,
    kpis: seed.kpis.map((title, index) => ({
      title,
      priority: index + 1,
      aggregation:
        /average|avg|rate|score|rating|yield/i.test(title) ? "avg" : "sum",
      reason: seed.agentGoal,
    })),
    charts: seed.charts.map((title, index) => ({
      id: `${seed.domain}_chart_${index + 1}`,
      title,
      type: /map|geo/i.test(title)
        ? "geo"
        : /trend|cohort/i.test(title)
          ? "line"
          : /distribution/i.test(title)
            ? "histogram"
            : /breakdown|mix/i.test(title)
              ? "donut"
              : "bar",
      priority: "high",
      reason: `Recommended for ${seed.domain}: ${title}`,
    })),
    insights: [
      {
        title: "Agentic Goal",
        description: seed.agentGoal,
        severity: "high",
      },
    ],
    recommendedQuestions: [
      `What is the biggest opportunity in ${seed.domain}?`,
      `Which segment is underperforming?`,
      `What risk should be fixed first?`,
      `Which KPI should I monitor daily?`,
    ],
  };
}

function buildRagText(seed, profile, plan) {
  return `
DOMAIN: ${seed.domain}
AGENT GOAL: ${seed.agentGoal}
SCHEMA:
${profile.columns.map((c) => `${c.name} | ${c.type} | ${c.role}`).join("\n")}

KPIS:
${plan.kpis.map((k) => `${k.title} | ${k.aggregation} | ${k.reason}`).join("\n")}

CHARTS:
${plan.charts.map((c) => `${c.title} | ${c.type} | ${c.reason}`).join("\n")}

QUESTIONS:
${plan.recommendedQuestions.join("\n")}
`.trim();
}

export async function trainGenAiAgenticDomainPack() {
  const trained = [];

  for (const seed of GENAI_AGENTIC_DOMAIN_PACK) {
    for (let i = 0; i < seed.schemas.length; i += 1) {
      const profile = buildProfile(seed, seed.schemas[i], i);
      const dashboardPlan = buildPlan(seed);
      const ragText = buildRagText(seed, profile, dashboardPlan);
      const embedding = await embedText(ragText);

      const entry = buildSchemaRagMemoryEntry({
        dataset: {
          id: `genai-agentic-${seed.domain}-${i + 1}`,
          name: `${seed.domain}_genai_agentic_training_${i + 1}`,
        },
        schemaProfile: profile,
        dashboardPlan,
        source: "genai-agentic-domain-pack",
        rating: "excellent",
        notes: seed.agentGoal,
        embedding,
      });

      await upsertSchemaRagMemory(entry);

      trained.push({
        domain: seed.domain,
        schema: profile.columns.map((c) => c.name),
        kpis: dashboardPlan.kpis.length,
        charts: dashboardPlan.charts.length,
      });
    }
  }

  return {
    success: true,
    trainedCount: trained.length,
    domains: [...new Set(trained.map((x) => x.domain))],
    trained,
  };
}
