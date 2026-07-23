import { randomUUID } from "node:crypto";
import { buildSchemaProfile } from "./schema-profiler.js";
import { buildAutoKpis } from "./kpi-engine.js";
import { buildAutoCharts, buildChartFromCommand } from "./chart-engine.js";
import { detectBestPlaybook } from "./analyst-playbooks.js";
import { findMemoryMatch, saveAnalystMemory } from "./analyst-memory.js";
import { routeAnalystCommand } from "./command-router.js";

function cleanRows(rows = []) {
  return rows.filter((row) => {
    const keys = Object.keys(row || {}).map((key) => key.toLowerCase());
    const source = String(row?._sourceFile || row?.source || "").toLowerCase();

    const looksLikeDictionary =
      keys.includes("column") &&
      keys.includes("type") &&
      keys.includes("description");

    return !source.includes("dictionary") && !looksLikeDictionary;
  });
}

export async function runFullAutoAnalysis(dataset = {}) {
  const rows = cleanRows(dataset.rows || []);

  const cleanedDataset = {
    ...dataset,
    rows,
    rowCount: rows.length,
  };

  const schema = buildSchemaProfile(cleanedDataset);
  const playbook = detectBestPlaybook(schema);
  const memoryMatch = findMemoryMatch({
    domain: playbook.domain,
    columnSignature: schema.columnSignature,
  });

  const kpis = buildAutoKpis({
    dataset: cleanedDataset,
    schema,
    playbook,
    memoryMatch,
  });

  const charts = buildAutoCharts({
    dataset: cleanedDataset,
    schema,
    playbook,
    memoryMatch,
  });

  const analysis = {
    id: randomUUID(),
    dataType: playbook.domain,
    dataTypeLabel: playbook.label,
    rowCount: cleanedDataset.rowCount,
    columnCount: schema.columns.length,
    kpis,
    chartRecommendations: charts,
    insights: [
      {
        type: "summary",
        title: "AI Analyst Summary",
        message: `Detected ${playbook.label}. Generated ${kpis.length} KPIs and ${charts.length} dashboard charts automatically.`,
      },
      {
        type: "privacy",
        title: "Schema-only AI Mode",
        message: "Raw rows are not sent to the LLM. KPI and chart values are calculated locally by the analytics engine.",
      },
    ],
    schemaPacket: schema.safePacket,
    memory: {
      usedPreviousPattern: Boolean(memoryMatch),
      similarity: memoryMatch?.similarity || 0,
      domain: playbook.domain,
      columnSignature: schema.columnSignature,
    },
    privacy: {
      schemaOnly: true,
      rawRowsSentToAI: false,
    },
  };

  saveAnalystMemory({
    domain: playbook.domain,
    columnSignature: schema.columnSignature,
    kpis,
    charts,
  });

  return analysis;
}

export async function runAnalystCommand({
  dataset,
  currentAnalysis,
  command,
  filters = {},
}) {
  const rows = cleanRows(dataset.rows || []);
  const cleanedDataset = {
    ...dataset,
    rows,
    rowCount: rows.length,
  };

  const schema = buildSchemaProfile(cleanedDataset);

  const routed = await routeAnalystCommand({
    schema,
    command,
  });

  if (routed.action === "CLEAR_FILTERS") {
    return {
      action: "CLEAR_FILTERS",
      message: "All filters cleared.",
      structured: routed.structured,
    };
  }

  if (routed.action === "FILTER") {
    return {
      action: "FILTER",
      message: routed.message || "Filter applied.",
      filters: routed.filters || {},
      structured: routed.structured,
    };
  }

  if (routed.action === "DELETE_CHART") {
    return {
      action: "DELETE_CHART",
      message: "Removed the selected chart.",
      structured: routed.structured,
    };
  }

  if (routed.action === "ADD_KPI") {
    const kpis = buildAutoKpis({
      dataset: cleanedDataset,
      schema,
      playbook: detectBestPlaybook(schema),
    });

    return {
      action: "ADD_KPI",
      message: "Added KPI summary.",
      kpis,
      structured: routed.structured,
    };
  }

  if (routed.action === "GENERATE_CHART" || routed.action === "MODIFY_CHART") {
    const chart = buildChartFromCommand({
      dataset: cleanedDataset,
      schema,
      chartSpec: routed.chartSpec,
      filters,
    });

    if (!chart) {
      return {
        action: "ANSWER",
        message: "I could not create a valid chart from this schema.",
        structured: routed.structured,
      };
    }

    return {
      action: routed.action,
      message: routed.message || `Created chart: ${chart.title}`,
      chart,
      structured: routed.structured,
    };
  }

  return {
    action: "ANSWER",
    message:
      routed.message ||
      "I analyzed the schema, but this command does not require a dashboard change.",
    structured: routed.structured,
  };
}
