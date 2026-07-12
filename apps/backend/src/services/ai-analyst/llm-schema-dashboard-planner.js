import { makeSchemaOnlyPacket } from "./schema-fingerprint.js";
import { critiqueDashboard, sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";
import { findAnalystTrainingForDomain } from "./analyst-training-memory.js";
import { assertNoRawRowsInString } from "../ai/llm-payload-sanitizer.js";

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
function getDashboardModel() {
  return process.env.DASHBOARD_LLM_MODEL || "qwen3:4b";
}

function getChatModel() {
  return process.env.CHAT_LLM_MODEL || "llama3.2";
}

const INSIGHTFLOW_DASHBOARD_SYSTEM_PROMPT = `You are a schema-only AI analyst. You never receive raw dataset rows. You plan and explain using schema, metadata, and deterministic aggregate results only. Never ask for or rely on raw rows.
You are Dashboard AI Copilot, a schema-aware analytics assistant.

Core mission:
Convert user requests into dashboard actions, insights, visualizations, filters, calculations, and code updates.

You do not analyze raw datasets directly.

You only use:
1. Dataset schema.
2. Dataset metadata and summary statistics.
3. Existing dashboard configuration.
4. KPI definitions.
5. User query.

Raw records must never be sent to the LLM.

Primary rule:
- Understand the user's intent.
- Generate only the outputs needed to satisfy the request.
- Do not generate unnecessary charts.
- Do not generate unnecessary KPIs.
- Do not regenerate the whole dashboard unless explicitly requested.

Intent classification:
- INSIGHT: what drives salary, which country pays highest, show trends.
- FILTER: show only USA, filter by PhD, experience above 10 years.
- CHART: create bar chart, add heatmap, show salary distribution.
- KPI: show highest salary, add average salary KPI.
- DASHBOARD_UPDATE: improve dashboard, rearrange layout, add missing charts.
- CODE_GENERATION: generate React code, generate Recharts component, generate ECharts config, generate AG Grid table.

Chart selection engine:
- Categorical + numeric -> bar chart.
- Time + numeric -> line chart.
- Distribution -> histogram.
- Part-to-whole -> pie or donut.
- Correlation -> scatter plot.
- Geographic -> map or geo ranking.
- Hierarchical -> treemap.
- Multiple metrics -> heatmap.

Schema validation:
- Validate every requested field before producing an action.
- If a requested field does not exist, return {"error":"Field not found"}.
- Never invent columns.
- Never invent relationships.
- Never invent calculations.

Dashboard update rules:
- Analyze missing KPIs, missing filters, missing visualizations, layout problems, and redundant charts.
- Only modify affected components.
- Preserve existing dashboard state.

Insight rules:
- Focus only on important findings.
- Rank insights by impact.
- Generate executive insight, analyst insight, and recommended action.
- Limit to the top 5 insights.
- Avoid generic observations.
- Do not claim exact findings unless the supplied dataset summary or profile statistics support them.

Code generation rules:
- If code is requested, generate production-ready code.
- Supported targets: React, TypeScript, Recharts, ECharts, AG Grid, Material UI, Tailwind, Firebase.
- Return {"component_name":"","code":""}.
- Code must compile without modification.

Dashboard manipulation rules:
- You may create charts, remove charts, update charts, change filters, update KPIs, reorder layout, and generate dashboard code.
- You may not access raw rows, access private data, invent metrics, or invent schema.

Response format:
- Always return structured JSON only.
- For a chart request, return fields such as {"action":"create_chart","chart_type":"bar","x":"country","y":"salary_usd","aggregation":"avg"}.
- For a filter request, return fields such as {"action":"apply_filter","field":"country","operator":"equals","value":"USA"}.
- For a code request, return fields such as {"action":"generate_code","framework":"react","library":"recharts"}.

Optimization layer:
Before responding, ask internally:
1. Is this requested?
2. Is it supported by schema?
3. Is it useful?
4. Is there a simpler visualization?
5. Can existing charts be reused?

Golden rule:
User query + schema + dashboard state -> intent detection -> schema validation -> action planning -> dashboard update -> structured output.

Nothing else.`;

function extractJson(text = "") {
  const trimmed = String(text).trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }

  return null;
}

async function callOllama({ model, prompt, temperature = 0.1 }) {
  try {
    assertNoRawRowsInString(prompt);
  } catch (error) {
    console.error(`[llm-schema-dashboard-planner callOllama BLOCKED] ${error.message}`);
    throw new Error(`Blocked unsafe LLM payload: ${error.message}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_ctx: 8192,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const payload = await response.json();
    return payload.response || "";
  } finally {
    clearTimeout(timer);
  }
}

function safeRagMatchesForPrompt(ragMatches = []) {
  return (ragMatches || []).slice(0, 5).map((match) => {
    const entry = match.entry || match;

    return {
      id: entry.id,
      name: entry.name,
      domain: entry.domain,
      score: match.score,
      schemaSignature: entry.schemaSignature,
      dashboardPlan: entry.dashboardPlan,
      notes: entry.notes,
    };
  });
}

function stripUnsafeSpec(spec = {}) {
  const {
    data,
    rows,
    rawRows,
    sampleRows,
    calculatedValues,
    chartData,
    value,
    values,
    result,
    results,
    ...safe
  } = spec || {};

  return safe;
}

function sanitizeDashboardPlan(plan = {}, schemaProfile) {
  return critiqueDashboard({
    kpis: Array.isArray(plan.kpis)
      ? plan.kpis.map((item) => sanitizeKpiSpec(stripUnsafeSpec(item), schemaProfile)).filter(Boolean)
      : [],
    charts: Array.isArray(plan.charts)
      ? plan.charts.map((item) => sanitizeChartSpec(stripUnsafeSpec(item), schemaProfile)).filter(Boolean)
      : [],
    executiveSummary: plan.executiveSummary && typeof plan.executiveSummary === "object"
      ? plan.executiveSummary
      : undefined,
    geoAnalysis: Array.isArray(plan.geoAnalysis) ? plan.geoAnalysis : [],
    insights: Array.isArray(plan.insights) ? plan.insights : [],
    recommendations: Array.isArray(plan.recommendations) ? plan.recommendations : [],
    storyMode: plan.storyMode && typeof plan.storyMode === "object" ? plan.storyMode : undefined,
    confidenceScore: Number.isFinite(Number(plan.confidenceScore)) ? Number(plan.confidenceScore) : undefined,
  }, schemaProfile);
}

function normalizeDashboardAction(action = {}, schemaProfile) {
  const rawAction = String(action.action || "").toLowerCase();

  if (["create_chart", "add_chart", "generate_chart"].includes(rawAction)) {
    return {
      action: "GENERATE_CHART",
      chartSpec: sanitizeChartSpec(stripUnsafeSpec({
        type: action.chart_type || action.type,
        title: action.title,
        xKey: action.x || action.xKey || action.dimension,
        yKey: action.y || action.yKey || action.metric,
        aggregation: action.aggregation,
        reason: action.reason,
        limit: action.limit,
      }), schemaProfile),
    };
  }

  if (["modify_chart", "update_chart", "update_chart_type", "convert_chart_type"].includes(rawAction)) {
    return {
      action: "MODIFY_CHART",
      target: action.target || action.chart_id || action.title,
      chartSpec: sanitizeChartSpec(stripUnsafeSpec({
        type: action.chart_type || action.type,
        title: action.title,
        xKey: action.x || action.xKey || action.dimension,
        yKey: action.y || action.yKey || action.metric,
        aggregation: action.aggregation,
        reason: action.reason,
        limit: action.limit,
      }), schemaProfile),
    };
  }

  if (["create_kpi", "add_kpi", "generate_kpi"].includes(rawAction)) {
    return {
      action: "GENERATE_KPI",
      kpiSpec: sanitizeKpiSpec(stripUnsafeSpec({
        title: action.title,
        metric: action.metric || action.y,
        aggregation: action.aggregation,
        format: action.format,
        reason: action.reason,
        businessKpi: true,
      }), schemaProfile),
    };
  }

  if (["filter", "add_filter", "apply_filter"].includes(rawAction)) {
    const field = action.field || action.column;
    return {
      action: "FILTER",
      filters: action.filters || (field ? { [field]: action.value } : {}),
    };
  }

  if (["clear_filters", "reset_filters"].includes(rawAction)) {
    return { action: "CLEAR_FILTERS" };
  }

  if (["delete_chart", "remove_chart"].includes(rawAction)) {
    return { action: "DELETE_CHART", target: action.target || action.chart_id || action.title };
  }

  if (["generate_code", "code", "generate_component"].includes(rawAction)) {
    return {
      action: "GENERATE_CODE",
      component_name: action.component_name || action.componentName || "",
      code: action.code || "",
      framework: action.framework,
      library: action.library,
    };
  }

  return { action: "ANSWER" };
}

function normalizeDashboardActionEnvelope(json = {}, schemaProfile) {
  if (json.error) {
    return {
      action: "ANSWER",
      message: String(json.error),
      error: String(json.error),
      schemaOnly: true,
      schema_safe: false,
    };
  }

  if (json.response_type !== "dashboard_action" || !Array.isArray(json.actions)) return null;

  const actions = json.actions
    .map((action) => ({
      ...action,
      ...normalizeDashboardAction(action, schemaProfile),
    }))
    .filter((action) => action.action && action.action !== "ANSWER");

  const primary = actions[0] || { action: "ANSWER" };

  return {
    response_type: "dashboard_action",
    natural_response: json.natural_response || json.message || "I prepared schema-safe dashboard actions.",
    message: json.natural_response || json.message || "I prepared schema-safe dashboard actions.",
    action: primary.action,
    chartSpec: primary.chartSpec,
    kpiSpec: primary.kpiSpec,
    filters: primary.filters,
    actions,
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
    schema_safe: json.schema_safe !== false,
    schemaOnly: true,
  };
}

function buildDashboardPrompt(schemaProfile, memoryMatch, options = {}) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  const analystTraining = findAnalystTrainingForDomain(schemaProfile.domain);

  const legacyMemory = memoryMatch?.entry
    ? {
        matchedDataset: memoryMatch.entry.name,
        matchScore: memoryMatch.score,
        trainedDashboardPlan: memoryMatch.entry.dashboardPlan,
      }
    : null;

  const retrievedRagMemories = safeRagMatchesForPrompt(options.ragMatches);
  const smartUnderstanding = options.schemaUnderstanding || null;

  return `${INSIGHTFLOW_DASHBOARD_SYSTEM_PROMPT}

YOUR JOB:
Understand the dataset schema, infer business meaning, and create the best dashboard plan.

THINK LIKE A SENIOR DATA ANALYST:
Before creating dashboard:
1. Identify the business domain.
2. Find the primary success metric.
3. Find dimensions that explain that metric.
4. Create KPIs useful for decision making.
5. Create charts that answer real business questions.
6. Reject charts that look visual but give no insight.

Never create random charts.
Never use ID columns as metrics.
Never use line chart without date/time.
Never use pie chart for high-cardinality data.
Never invent columns.

VERY IMPORTANT:
You do NOT see raw data rows.
You only see schema metadata, profile stats, role detection, and RAG memory.
You must return dashboard specifications only.
The local analytics engine will calculate real values later.

NEVER RETURN:
- raw rows
- chart.data
- KPI values
- fake numbers
- sample records
- SQL over private rows

ALLOWED OUTPUT:
- action
- message
- kpis
- charts
- executiveSummary
- geoAnalysis
- insights
- recommendations
- storyMode
- confidenceScore
- schemaOnly

ALLOWED CHART TYPES:
bar, horizontalBar, line, area, pie, donut, histogram, scatter, radar, composed, heatmap

ALLOWED AGGREGATIONS:
count, sum, avg, min, max, median, count_unique

DASHBOARD QUALITY RULES:
1. Always include Total Records KPI, but prioritize a meaningful primary business metric when available.
2. Prefer 4 to 6 useful KPIs.
3. Prefer 4 to 8 useful charts.
4. Use bar chart for metric by category.
5. Use histogram for numeric distribution.
6. Use scatter for metric vs metric.
7. Use line chart for metric by date.
8. Use donut/pie only for category distribution.
9. Use count_unique for unique category count.
10. For language/framework/skill/tag columns, add splitValues: true.
11. Use only existing column names from the current schema.
12. If geography exists, include geoAnalysis metadata and at least one regional ranking chart using a supported chart type.
13. Do not output schema profile metrics as KPIs: Attributes / Columns, Numeric Columns, Categorical Columns, Missing Values, or Data Quality Score.
14. Never use __row_index__.
15. Never create line/trend charts unless the schema has a real date/time column.

CURRENT SCHEMA PACKET:
${JSON.stringify(packet, null, 2)}

ANALYST BUSINESS TRAINING MEMORY:
${JSON.stringify(analystTraining, null, 2)}

SMART SCHEMA UNDERSTANDING:
${JSON.stringify(smartUnderstanding, null, 2)}

LEGACY TRAINED MEMORY:
${JSON.stringify(legacyMemory, null, 2)}

RETRIEVED RAG MEMORIES:
${JSON.stringify(retrievedRagMemories, null, 2)}

RETURN STRICT JSON ONLY:
{
  "action": "GENERATE_DASHBOARD",
  "message": "short explanation for the user",
  "domain": "workforce_salary",
  "primaryMetric": "salary_usd",
  "dashboardGoal": "Find salary drivers",
  "businessQuestions": ["Which factors increase salary?"],
  "kpis": [
    {
      "title": "Total Records",
      "metric": "__row_count__",
      "aggregation": "count",
      "format": "number",
      "reason": "Total Records tells the user the dataset size behind salary analysis."
    }
  ],
  "charts": [
    {
      "type": "bar",
      "title": "Average Salary by Country",
      "xKey": "country",
      "yKey": "salary_usd",
      "aggregation": "avg",
      "limit": 10,
      "reason": "Country is a dimension that can explain differences in the main salary metric."
    }
  ],
  "executiveSummary": {
    "overview": "Schema-aware overview without invented values.",
    "topTrend": "Trend to calculate from available date and metric columns, or null.",
    "biggestOpportunity": "Opportunity implied by segment/metric semantics, or null.",
    "biggestRisk": "Risk implied by schema/statistics, or null.",
    "businessRecommendation": "Recommended analytical action.",
    "confidenceScore": 0.85
  },
  "geoAnalysis": [],
  "insights": [],
  "recommendations": [],
  "storyMode": {
    "whatHappened": "What the dashboard should evaluate.",
    "whyItHappened": "Drivers to test from schema relationships.",
    "whatWillHappen": "Forecast intent if date and metric columns exist.",
    "recommendedAction": "Next analytical action."
  },
  "confidenceScore": 0.85,
  "schemaOnly": true
}`;
}

function buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard, options = {}) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  const retrievedRagMemories = safeRagMatchesForPrompt(options.ragMatches);

  return `${INSIGHTFLOW_DASHBOARD_SYSTEM_PROMPT}

You are Schema AI Studio Assistant.

You are InsightFlow's schema-only dashboard command router, but you must sound like a senior BI analyst and dashboard copilot.

Rules:
- Return strict JSON only.
- Never include raw data rows.
- Never include chart.data.
- Never include KPI values.
- Use only schema column names.
- RAG memories are examples only, not real values.
- If user asks a normal question, return action ANSWER with a concise business-focused analyst answer.
- If user asks chart/KPI/filter change, return action and spec.
- Never expose intent labels, confidence scores, internal agents, or planner logic.
- Do not lead with row count, column count, detected domain, or confidence unless specifically asked.
- Before creating anything, consider the current dashboard specs and avoid duplicates.
- If the user asks to edit/convert/sort/recolor/group an existing chart, use MODIFY_CHART instead of GENERATE_CHART when possible.
- If the user asks for a missing field, return {"error":"Field not found"}.
- Always base actions only on existing schema columns and provided column profiles/statistics.
- Avoid fake insights: do not claim a segment is highest, lowest, best, worst, or trending unless that statistic is present.

AI_CAN:
- Create dashboards
- Edit dashboards
- Delete dashboard elements
- Reorder charts
- Resize charts
- Create custom KPIs
- Create calculated metrics
- Create filters
- Create tabs/pages
- Create drilldowns
- Convert chart types
- Explain charts and dashboards
- Recommend visualizations
- Generate executive summaries
- Detect anomalies and trends from available metadata/calculated analytics
- Build complete dashboards automatically
- Understand natural language
- Use dashboard memory
- Avoid duplicate charts
- Auto-select best visualizations
- Validate fields strictly before planning actions

When the user asks to build or modify the dashboard, return this schema-safe action envelope:
{
  "response_type": "dashboard_action",
  "natural_response": "",
  "actions": [
    {
      "action": "create_chart",
      "chart_type": "bar",
      "title": "",
      "x": "",
      "y": "",
      "aggregation": "",
      "reason": ""
    }
  ],
  "warnings": [],
  "schema_safe": true
}

Supported action names:
create_chart, modify_chart, update_chart_type, delete_chart, create_kpi, filter, apply_filter, clear_filters, generate_code

Allowed internal action aliases:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, FILTER, CLEAR_FILTERS, GENERATE_KPI, GENERATE_DASHBOARD, FIX_DASHBOARD, ANSWER

Current schema:
${JSON.stringify(packet, null, 2)}

Legacy trained memory:
${JSON.stringify(memoryMatch?.entry?.dashboardPlan || null, null, 2)}

Retrieved RAG memories:
${JSON.stringify(retrievedRagMemories, null, 2)}

Current dashboard specs:
${JSON.stringify(currentDashboard || {}, null, 2)}

User command:
${query}

Return example:
{"response_type":"dashboard_action","natural_response":"I’ll show salary by experience so you can compare compensation patterns without assuming any result upfront.","actions":[{"action":"create_chart","chart_type":"scatter","title":"Salary vs Experience","x":"experience","y":"salary_usd","aggregation":"count","reason":"Metric-vs-metric relationship view"}],"warnings":[],"schema_safe":true}`;
}

export async function planDashboardWithOllama(schemaProfile, memoryMatch, options = {}) {
  const model = getDashboardModel();
  try {
    const text = await callOllama({
      model,
      prompt: buildDashboardPrompt(schemaProfile, memoryMatch, options),
      temperature: 0.1,
    });
    const json = extractJson(text);
    if (!json) return null;

    return critiqueDashboard({
      source: `ollama:${model}`,
      message: json.message || "Dashboard plan generated.",
      dashboardType: json.dashboardType,
      kpis: (json.kpis || []).map((item) => sanitizeKpiSpec(stripUnsafeSpec(item), schemaProfile)).slice(0, 8),
      charts: (json.charts || json.chartSpecs || []).map((item) => sanitizeChartSpec(stripUnsafeSpec(item), schemaProfile)).slice(0, 10),
      executiveSummary: json.executiveSummary,
      geoAnalysis: Array.isArray(json.geoAnalysis) ? json.geoAnalysis : [],
      insights: Array.isArray(json.insights) ? json.insights : [],
      recommendations: Array.isArray(json.recommendations) ? json.recommendations : [],
      storyMode: json.storyMode,
      confidenceScore: Number.isFinite(Number(json.confidenceScore)) ? Number(json.confidenceScore) : undefined,
      schemaOnly: true,
      model,
    }, schemaProfile);
  } catch (error) {
    return {
      source: "ollama-error",
      error: error.message,
      kpis: [],
      charts: [],
      schemaOnly: true,
      model,
    };
  }
}

export async function planCommandWithOllama({
  query,
  schemaProfile,
  memoryMatch,
  ragMatches = [],
  currentDashboard,
}) {
  const model = getDashboardModel();
  try {
    const text = await callOllama({ model, prompt: buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard, {
      ragMatches,
    }) });
    const json = extractJson(text);
    if (!json) return null;

    const envelope = normalizeDashboardActionEnvelope(json, schemaProfile);
    if (envelope) {
      return {
        ...envelope,
        provider: "ollama",
        model,
      };
    }

    return {
      action: json.action || "ANSWER",
      message: json.message || "Command processed.",
      chartSpec: json.chartSpec ? sanitizeChartSpec(stripUnsafeSpec(json.chartSpec), schemaProfile) : undefined,
      kpiSpec: json.kpiSpec ? sanitizeKpiSpec(stripUnsafeSpec(json.kpiSpec), schemaProfile) : undefined,
      filters: json.filters,
      dashboardPlan: json.dashboardPlan
        ? sanitizeDashboardPlan(json.dashboardPlan, schemaProfile)
        : undefined,
      schemaOnly: true,
      provider: "ollama",
      model,
    };
  } catch (error) {
    return {
      action: "ANSWER",
      message: "I used the local dashboard engine because the LLM planner was unavailable.",
      schemaOnly: true,
      provider: "local",
      model,
      aiError: error.message,
    };
  }
}

export async function formatChatAnswerWithOllama({ query, schemaProfile, localAnswer }) {
  const model = getChatModel();
  try {
    const prompt = `You are Schema AI Studio Assistant.

You are not a schema reporter. You are a senior data analyst, dashboard architect, BI consultant, product analyst, and AI copilot.
You only know the uploaded dataset through schema, semantic mappings, RAG knowledge, dashboard metadata, generated KPIs/charts, insights, geo analysis, executive summaries, calculated metrics, and the user conversation supplied to you.

Grounding rules:
- Never invent information, columns, segments, statistics, or KPI values.
- Never hallucinate values.
- Use only the provided schema-only packet and local computed analytics answer.
- If the requested information is not available, say: "Based on the current schema and available analytics, this information cannot be determined."
- Do not ask for raw rows.
- Keep the response concise, analytical, and business-focused.
- Do not expose intent labels, confidence scores, internal agents, planner logic, or chain of thought.
- Do not lead with row count, column count, detected domain, or confidence unless the user specifically asks.
- Explain the business meaning of important fields, what decisions the data can support, and what dashboard views would be useful.
- If the user asks to create or modify a dashboard element, answer like an analyst applying that dashboard action.

Reasoning Layer, internal only:
1. Identify user intent.
2. Find the relevant KPI.
3. Find related charts.
4. Find related insights.
5. Find related geo information.
6. Find related story summary.
7. Generate the answer.
8. Generate the recommendation.

Prefer these sections when useful:
Summary
Key Fields
What This Can Answer
Recommended Starting Point
Next Step

Never include a section named Confidence Score.

Schema only:
${JSON.stringify(makeSchemaOnlyPacket(schemaProfile), null, 2)}

User question: ${query}
Local computed answer: ${localAnswer}

Return only the final answer text. Do not expose the Reasoning Layer.`;
    const text = await callOllama({ model, prompt, temperature: 0.2 });
    return { answer: text.trim() || localAnswer, model, provider: "ollama" };
  } catch (error) {
    return { answer: localAnswer, model, provider: "local", aiError: error.message };
  }
}
