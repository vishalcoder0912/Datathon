import { makeSchemaOnlyPacket } from "../ai-analyst/schema-fingerprint.js";

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const VALIDATOR_MODELS = [
  process.env.OLLAMA_VALIDATOR_MODEL,
  "llama3.3:70b",
  "deepseek-r1:70b",
  "qwen3:72b",
].filter(Boolean);

function extractJson(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch {}
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

async function callOllamaValidator(prompt, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0, num_ctx: 8192 },
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

function columnNames(schemaProfile = {}) {
  return new Set((schemaProfile.columns || []).map((column) => column.name));
}

function deterministicPreflight({ artifact = {}, schemaProfile = {}, artifactType = "dashboard" }) {
  const names = columnNames(schemaProfile);
  const reasons = [];
  const dashboard = artifact.dashboard || artifact.dashboardPlan || artifact;
  const kpis = artifactType === "kpi" ? [artifact.kpiSpec || artifact].filter(Boolean) : dashboard.kpis || [];
  const charts = artifactType === "chart" ? [artifact.chartSpec || artifact].filter(Boolean) : dashboard.charts || [];

  for (const kpi of kpis) {
    const metric = kpi.metric || kpi.sourceColumn;
    if (!metric) reasons.push(`KPI ${kpi.title || kpi.id || "unknown"} has no metric.`);
    if (metric && metric !== "__row_count__" && !names.has(metric)) {
      reasons.push(`KPI ${kpi.title || metric} references missing metric ${metric}.`);
    }
    if (/efficiency score|ai revenue index|growth score/i.test(kpi.title || "")) {
      reasons.push(`KPI ${kpi.title} looks like a fake metric without a declared calculation.`);
    }
  }

  for (const chart of charts) {
    if (chart.xKey === "__row_index__") reasons.push(`Chart ${chart.title || chart.id} uses row index.`);
    if (chart.xKey && chart.xKey !== "__row_index__" && !names.has(chart.xKey)) {
      reasons.push(`Chart ${chart.title || chart.id} references missing xKey ${chart.xKey}.`);
    }
    if (chart.yKey && !["count", "__count__", "__missingPct__"].includes(chart.yKey) && !names.has(chart.yKey)) {
      reasons.push(`Chart ${chart.title || chart.id} references missing yKey ${chart.yKey}.`);
    }
    if (chart.intent === "trend") {
      const x = (schemaProfile.columns || []).find((column) => column.name === chart.xKey);
      if (!(x?.type === "date" || x?.role === "date" || /date|time|month|year/i.test(x?.name || ""))) {
        reasons.push(`Trend chart ${chart.title || chart.id} does not use a real date column.`);
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

function buildValidationPrompt({ artifact, artifactType, schemaProfile, critic }) {
  return `You are the InsightFlow Ollama Validator. You are the final authority before UI rendering.

Return strict JSON only:
{"verdict":"PASS"|"FAIL","reasons":["..."],"confidence":0-1}

Check:
1. Is every KPI connected to a real schema column or __row_count__?
2. Is every KPI calculation valid for its metric?
3. Is every chart type correct for its fields?
4. Is geo analysis valid only when geo columns exist?
5. Are insights and recommendations supported?
6. Is the response hallucinated?
7. Are there fake metrics, duplicate charts, row-index trends, or unsupported claims?

Artifact type: ${artifactType}

Schema-only profile:
${JSON.stringify(makeSchemaOnlyPacket(schemaProfile), null, 2)}

Dashboard critic:
${JSON.stringify(critic || {}, null, 2)}

Artifact:
${JSON.stringify(artifact, null, 2)}`;
}

export async function runOllamaValidatorAgent({
  artifact,
  artifactType = "dashboard",
  schemaProfile,
  critic,
  requireOllama = process.env.ENABLE_OLLAMA_VALIDATOR === "1",
} = {}) {
  const preflight = deterministicPreflight({ artifact, schemaProfile, artifactType });

  if (!preflight.passed) {
    return {
      verdict: "FAIL",
      passed: false,
      provider: "deterministic-preflight",
      model: "local-governance",
      reasons: preflight.reasons,
      confidence: 1,
    };
  }

  if (!requireOllama) {
    return {
      verdict: "PASS",
      passed: true,
      provider: "deterministic-preflight",
      model: "local-governance",
      reasons: ["Ollama validator not required in this environment; deterministic governance preflight passed."],
      confidence: 0.9,
    };
  }

  const prompt = buildValidationPrompt({ artifact, artifactType, schemaProfile, critic });
  const errors = [];

  for (const model of VALIDATOR_MODELS) {
    try {
      const text = await callOllamaValidator(prompt, model);
      const parsed = extractJson(text);
      const verdict = String(parsed?.verdict || parsed?.result || "").toUpperCase();
      if (verdict === "PASS" || verdict === "FAIL") {
        return {
          verdict,
          passed: verdict === "PASS",
          provider: "ollama-validator",
          model,
          reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
          confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.8,
        };
      }
      errors.push(`${model}: invalid validator JSON`);
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
    }
  }

  return {
    verdict: "FAIL",
    passed: false,
    provider: "ollama-validator",
    model: VALIDATOR_MODELS[0] || "unavailable",
    reasons: ["Ollama validation failed or was unavailable.", ...errors],
    confidence: 1,
  };
}

export function buildGovernanceDecision({ critic, validator, artifactType = "dashboard" }) {
  const criticPassed = !critic || artifactType !== "dashboard" || Boolean(critic?.valid);
  const validatorPassed = Boolean(validator?.passed);

  return {
    status: criticPassed && validatorPassed ? "APPROVED" : "REJECTED",
    critic: critic || null,
    ollamaValidator: validator || null,
    approvedForRender: criticPassed && validatorPassed,
    blockingReasons: [
      ...(criticPassed ? [] : critic?.warnings || critic?.issues?.map((issue) => issue.reason) || ["Dashboard critic failed."]),
      ...(validatorPassed ? [] : validator?.reasons || ["Ollama validator failed."]),
    ],
  };
}
