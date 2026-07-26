import { AGENTIC_MASTER_TRAINING_PACK } from "./agentic-master-training-pack.js";
import { buildSchemaRagMemoryEntry } from "../schema-rag-memory-builder.js";
import { upsertSchemaRagMemory } from "../schema-rag-store.js";
import { embedText } from "../schema-rag-embeddings.js";

function normalizeName(name = "") {
  return String(name).trim().toLowerCase();
}

function inferRole(columnName = "") {
  const name = normalizeName(columnName);

  if (/date|time|month|year|created|posted|timestamp/.test(name)) return "time_dimension";
  if (/country|state|city|region|location|lat|lng|longitude|latitude/.test(name)) return "geo_dimension";
  if (/revenue|sales|salary|amount|price|cost|expense|profit|margin|budget|actual|balance/.test(name)) return "money_metric";
  if (/quantity|units|orders|clicks|impressions|conversions|stock|patients|students/.test(name)) return "volume_metric";
  if (/rate|ratio|ctr|cpa|roas|score|risk/.test(name)) return "rate_metric";
  if (/id|uuid|code/.test(name)) return "identifier";
  if (/product|category|department|channel|campaign|supplier|merchant|course|doctor/.test(name)) return "business_dimension";

  return "category_dimension";
}

function inferType(columnName = "") {
  const role = inferRole(columnName);

  if (role === "time_dimension") return "date";
  if (role.includes("metric")) return "number";
  return "category";
}

function makeProfile(domain, schema, index) {
  const columns = schema.map((name) => ({
    name,
    normalizedName: normalizeName(name),
    title: name.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()),
    type: inferType(name),
    role: inferRole(name),
    missingPct: 0,
    uniqueCount: inferRole(name) === "identifier" ? 5000 : 12,
    topValues: [],
    stats: inferType(name) === "number"
      ? { min: 0, max: 100000, mean: 5000, median: 3000 }
      : undefined,
  }));

  return {
    datasetName: `${domain}_master_seed_${index + 1}`,
    rowCount: 10000,
    columnCount: columns.length,
    domain,
    signature: `${domain}_master_${index + 1}`,
    columns,
  };
}

function buildPlan(seed) {
  return {
    domain: seed.domain,
    intent: seed.intent,
    kpis: seed.kpis.map((kpi) => ({
      title: kpi.title,
      formula: kpi.formula,
      priority: kpi.priority,
      aggregation: kpi.formula.includes("AVG") ? "avg" : kpi.formula.includes("COUNT") ? "count" : "sum",
      reason: `Important for ${seed.domain}: ${seed.intent}`,
    })),
    charts: seed.charts.map((chart, index) => ({
      id: `${seed.domain}_chart_${index + 1}`,
      title: chart.title,
      type: chart.type,
      rule: chart.rule,
      priority: "high",
      reason: `Best chart for ${chart.rule}`,
    })),
    insights: seed.insights.map((text, index) => ({
      id: `${seed.domain}_insight_${index + 1}`,
      title: `Analyst Rule ${index + 1}`,
      description: text,
      severity: index === 0 ? "high" : "medium",
    })),
    agenticQuestions: [
      `What is the biggest driver in ${seed.domain}?`,
      `Which segment should be improved first?`,
      `Where is the biggest risk or opportunity?`,
      `Which KPI changed the most?`,
    ],
  };
}

function buildRagText(seed, profile, plan) {
  return `
DOMAIN: ${seed.domain}
INTENT: ${seed.intent}
COLUMNS:
${profile.columns.map((c) => `- ${c.name} | ${c.type} | ${c.role}`).join("\n")}

KPI RULES:
${plan.kpis.map((k) => `- ${k.title}: ${k.formula}`).join("\n")}

CHART RULES:
${plan.charts.map((c) => `- ${c.title}: ${c.type}, ${c.rule}`).join("\n")}

ANALYST INSIGHTS:
${seed.insights.map((i) => `- ${i}`).join("\n")}
`.trim();
}

export async function trainAgenticMasterPack() {
  const trained = [];

  for (const seed of AGENTIC_MASTER_TRAINING_PACK) {
    for (let i = 0; i < seed.schemas.length; i += 1) {
      const profile = makeProfile(seed.domain, seed.schemas[i], i);
      const dashboardPlan = buildPlan(seed);
      const schemaText = buildRagText(seed, profile, dashboardPlan);
      const embedding = await embedText(schemaText);

      const entry = buildSchemaRagMemoryEntry({
        dataset: {
          id: `agentic-master-${seed.domain}-${i + 1}`,
          name: `${seed.domain}_master_training_${i + 1}`,
        },
        schemaProfile: profile,
        dashboardPlan,
        source: "agentic-master-training-pack",
        rating: "excellent",
        notes: seed.intent,
        embedding,
      });

      await upsertSchemaRagMemory(entry);

      trained.push({
        domain: seed.domain,
        schema: profile.columns.map((c) => c.name),
        kpis: dashboardPlan.kpis.length,
        charts: dashboardPlan.charts.length,
        insights: dashboardPlan.insights.length,
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
