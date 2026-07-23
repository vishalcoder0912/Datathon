import { serviceUrls } from "../../config/serviceUrls.js";
import { findColumn } from "./schema-profiler.js";
import { assertNoRawRowsInString } from "../ai/llm-payload-sanitizer.js";

function deterministicCommand(schema, command) {
  const text = String(command || "").toLowerCase();

  if (/clear filters|reset filters|remove filter/.test(text)) {
    return {
      action: "CLEAR_FILTERS",
      message: "All filters cleared.",
    };
  }

  if (/remove|delete/.test(text) && /chart|graph|visual/.test(text)) {
    return {
      action: "DELETE_CHART",
      message: "Removed chart.",
    };
  }

  const filterMatch = String(command).match(
    /(?:filter|where|show only)\s+([\w\s_-]+)\s*(?:=|is|:)\s*["']?([^"']+)["']?/i
  );

  if (filterMatch) {
    const column = findColumn(schema, [filterMatch[1]], "dimension");

    if (column) {
      return {
        action: "FILTER",
        filters: {
          [column.name]: filterMatch[2].trim(),
        },
        message: `Applied filter ${column.name} = ${filterMatch[2].trim()}`,
      };
    }
  }

  if (/kpi|summary|card/.test(text)) {
    return {
      action: "ADD_KPI",
      message: "Added KPI summary.",
    };
  }

  return null;
}

async function callLlmForPlan(schema, command) {
  const baseUrl = serviceUrls.ollama;
  const model = process.env.OLLAMA_MODEL || "llama3.2:latest";

  try {
    assertNoRawRowsInString(JSON.stringify({ schema, command }));
  } catch (error) {
    console.error(`[command-router BLOCKED] ${error.message}`);
    throw new Error(`Blocked unsafe LLM payload: ${error.message}`);
  }

  const prompt = `
You are a schema-only AI analyst. You never receive raw dataset rows. You plan and explain using schema, metadata, and deterministic aggregate results only. Never ask for or rely on raw rows.
You are an AI data analyst planner.
You do not calculate KPI values.
You do not create chart data.
You only return JSON dashboard actions.

Allowed legacy actions:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, FILTER, CLEAR_FILTERS, ADD_KPI, ANSWER

Allowed structured intents:
add_chart, remove_chart, update_chart, add_kpi, filter, explain, answer

Allowed chart types:
bar, line, pie, area, histogram, scatter

Allowed aggregations:
count, sum, avg, min, max, median

Use only columns from schema.

Return JSON only:
{
  "intent": "add_chart",
  "answer": "I added a revenue by region chart.",
  "reason": "Region is a dimension and sales is a measure.",
  "action": "GENERATE_CHART",
  "message": "short message",
  "chartSpec": {
    "title": "",
    "type": "bar",
    "dimension": "",
    "metric": "",
    "aggregation": "avg",
    "limit": 10
  },
  "filters": {}
}

User command:
${command}

Schema:
${JSON.stringify(schema.safePacket)}
`;

  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      options: {
        temperature: OLLAMA_OPTIONS.temperature,
        num_ctx: OLLAMA_OPTIONS.num_ctx,
        num_predict: OLLAMA_OPTIONS.num_predict,
      },
      keep_alive: OLLAMA_OPTIONS.keep_alive,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed with ${response.status}`);
  }

  const data = await response.json();
  const content = data.message?.content || "{}";

  return JSON.parse(content);
}

export async function routeAnalystCommand({ schema, command }) {
  const deterministic = deterministicCommand(schema, command);

  if (deterministic) {
    return {
      ...deterministic,
      structured: toStructuredCommand(deterministic),
    };
  }

  try {
    const plan = await callLlmForPlan(schema, command);

    return {
      action: String(plan.action || "ANSWER").toUpperCase(),
      message: plan.message || "Done.",
      chartSpec: plan.chartSpec || plan.chart || null,
      filters: plan.filters || {},
      structured: toStructuredCommand(plan),
    };
  } catch {
    const fallback = {
      action: "GENERATE_CHART",
      message: "Created a chart using local fallback rules.",
      chartSpec: {
        title: "Auto Generated Chart",
        type: command.toLowerCase().includes("pie") ? "pie" : "bar",
        xRole: "dimension",
        yRole: "metric",
        aggregation: command.toLowerCase().includes("average") ? "avg" : "sum",
        limit: 10,
      },
    };
    return {
      ...fallback,
      structured: toStructuredCommand(fallback),
    };
  }
}
