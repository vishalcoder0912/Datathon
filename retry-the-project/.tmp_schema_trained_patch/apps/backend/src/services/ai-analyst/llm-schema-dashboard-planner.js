import { makeSchemaOnlyPacket } from "./schema-fingerprint.js";
import { sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DASHBOARD_MODEL = process.env.DASHBOARD_LLM_MODEL || "neural-chat:7b";
const CHAT_MODEL = process.env.CHAT_LLM_MODEL || "llama3.2";

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

function buildDashboardPrompt(schemaProfile, memoryMatch) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  const memoryHint = memoryMatch?.entry ? {
    matchedDataset: memoryMatch.entry.name,
    matchScore: memoryMatch.score,
    trainedDashboardPlan: memoryMatch.entry.dashboardPlan,
  } : null;

  return `You are InsightFlow's dashboard planning model.

Rules:
- You receive schema metadata only, never raw dataset rows.
- Return strict JSON only. No markdown.
- Do not include chart.data or KPI values.
- Use only column names that exist in the schema.
- Prefer useful business/data analyst KPIs and charts.
- Allowed chart types: bar, line, area, pie, donut, histogram, scatter, radar, composed, heatmap.
- Allowed aggregations: count, sum, avg, min, max, median.

Schema packet:
${JSON.stringify(packet, null, 2)}

Similar trained schema memory:
${JSON.stringify(memoryHint, null, 2)}

Return this exact structure:
{
  "action": "GENERATE_DASHBOARD",
  "message": "short explanation",
  "kpis": [
    {"title":"Total Records","metric":"__row_count__","aggregation":"count","format":"number"}
  ],
  "charts": [
    {"type":"bar","title":"Average Revenue by Region","xKey":"Region","yKey":"Revenue","aggregation":"avg","limit":10}
  ],
  "schemaOnly": true
}`;
}

function buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  return `You are InsightFlow's schema-only dashboard command router.

Rules:
- Return strict JSON only.
- Never include raw data rows or chart.data.
- Use only schema column names.
- If user asks a normal question, return action ANSWER with a short answer.
- If user asks chart/KPI/filter change, return action and spec.

Allowed actions:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, GENERATE_KPI, FILTER, CLEAR_FILTERS, ANSWER

Schema:
${JSON.stringify(packet, null, 2)}

Trained memory:
${JSON.stringify(memoryMatch?.entry?.dashboardPlan || null, null, 2)}

Current dashboard:
${JSON.stringify(currentDashboard || {}, null, 2)}

User command:
${query}

Return example:
{"action":"GENERATE_CHART","message":"Created chart.","chartSpec":{"type":"scatter","title":"Salary vs Experience","xKey":"experience","yKey":"salary_usd","aggregation":"count","limit":500},"schemaOnly":true}`;
}

export async function planDashboardWithOllama(schemaProfile, memoryMatch) {
  try {
    const text = await callOllama({ model: DASHBOARD_MODEL, prompt: buildDashboardPrompt(schemaProfile, memoryMatch) });
    const json = extractJson(text);
    if (!json) return null;

    return {
      source: `ollama:${DASHBOARD_MODEL}`,
      message: json.message || "Dashboard plan generated.",
      kpis: (json.kpis || []).map((item) => sanitizeKpiSpec(item, schemaProfile)).slice(0, 8),
      charts: (json.charts || json.chartSpecs || []).map((item) => sanitizeChartSpec(item, schemaProfile)).slice(0, 10),
      schemaOnly: true,
      model: DASHBOARD_MODEL,
    };
  } catch (error) {
    return {
      source: "ollama-error",
      error: error.message,
      kpis: [],
      charts: [],
      schemaOnly: true,
      model: DASHBOARD_MODEL,
    };
  }
}

export async function planCommandWithOllama({ query, schemaProfile, memoryMatch, currentDashboard }) {
  try {
    const text = await callOllama({ model: DASHBOARD_MODEL, prompt: buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard) });
    const json = extractJson(text);
    if (!json) return null;

    return {
      action: json.action || "ANSWER",
      message: json.message || "Command processed.",
      chartSpec: json.chartSpec ? sanitizeChartSpec(json.chartSpec, schemaProfile) : undefined,
      kpiSpec: json.kpiSpec ? sanitizeKpiSpec(json.kpiSpec, schemaProfile) : undefined,
      filters: json.filters,
      schemaOnly: true,
      provider: "ollama",
      model: DASHBOARD_MODEL,
    };
  } catch (error) {
    return {
      action: "ANSWER",
      message: "I used the local dashboard engine because the LLM planner was unavailable.",
      schemaOnly: true,
      provider: "local",
      model: DASHBOARD_MODEL,
      aiError: error.message,
    };
  }
}

export async function formatChatAnswerWithOllama({ query, schemaProfile, localAnswer }) {
  try {
    const prompt = `You are InsightFlow AI Chat.
Rewrite the local analytics answer in a clear helpful tone.
Do not invent values. Do not ask for raw rows.

Schema only:
${JSON.stringify(makeSchemaOnlyPacket(schemaProfile), null, 2)}

User question: ${query}
Local computed answer: ${localAnswer}

Return only the final answer text.`;
    const text = await callOllama({ model: CHAT_MODEL, prompt, temperature: 0.2 });
    return { answer: text.trim() || localAnswer, model: CHAT_MODEL, provider: "ollama" };
  } catch (error) {
    return { answer: localAnswer, model: CHAT_MODEL, provider: "local", aiError: error.message };
  }
}
