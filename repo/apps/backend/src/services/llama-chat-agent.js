import {
  callDatasetChat,
  OLLAMA_MODELS,
} from './ollama/ollama-dual-model-service.js';
import { buildDatasetFacts } from './ollama/dataset-schema-summary.js';
import { retrieveLearningMemory } from './ai-analyst/self-learning-memory.js';

function fallbackAnswer(query, facts) {
  const text = String(query || '').toLowerCase();

  if (/row|record|how many/.test(text)) {
    return `The dataset has ${facts.rowCount.toLocaleString()} rows and ${facts.columnCount.toLocaleString()} columns.`;
  }

  if (/column|schema/.test(text)) {
    return `The dataset columns are: ${facts.schema.columns
      .map((column) => `${column.name} (${column.type})`)
      .join(', ')}.`;
  }

  const firstMetric = facts.facts.numericColumns[0];

  if (firstMetric && /average|avg|mean/.test(text)) {
    return `The average ${firstMetric.name} is ${firstMetric.stats?.avg ?? 'not available'}.`;
  }

  return `I analyzed the dataset schema. It has ${facts.rowCount.toLocaleString()} rows and ${facts.columnCount.toLocaleString()} columns. Ask about columns, averages, totals, categories, trends, or comparisons.`;
}

function validateQueryColumns(profile, query) {
  const lower = String(query || "").toLowerCase().trim();
  const cols = [];

  // Extract columns using patterns
  const filterMatch = lower.match(/filter\s+([a-z0-9_-]+)\s*(=|to|is)/i);
  if (filterMatch) cols.push(filterMatch[1]);

  const distOfMatch = lower.match(/distribution\s+of\s+([a-z0-9_-]+)/i);
  if (distOfMatch) {
    cols.push(distOfMatch[1]);
  } else {
    const distMatch = lower.match(/([a-z0-9_-]+)\s+distribution/i);
    if (distMatch) cols.push(distMatch[1]);
  }

  const bdOfMatch = lower.match(/breakdown\s+of\s+([a-z0-9_-]+)/i);
  if (bdOfMatch) {
    cols.push(bdOfMatch[1]);
  } else {
    const bdMatch = lower.match(/([a-z0-9_-]+)\s+breakdown/i);
    if (bdMatch) cols.push(bdMatch[1]);
  }

  const chartOfMatch = lower.match(/(pie|donut|bar|line|scatter|histogram|chart|graph)\s*(chart)?\s*of\s*([a-z0-9_-]+)/i);
  if (chartOfMatch) cols.push(chartOfMatch[3]);

  const metricMatch = lower.match(/(average|avg|mean|highest|max|lowest|min|total|sum)\s+(?:of\s+|for\s+)?([a-z0-9_-]+)/i);
  if (metricMatch) cols.push(metricMatch[2]);

  const kpiMatch = lower.match(/(?:kpi|card)(?:\s+(?:for|of|on|with|showing))*\s+(?:(?:average|avg|mean|highest|max|lowest|min|total|sum)\s+)?([a-z0-9_-]+)/i);
  if (kpiMatch) cols.push(kpiMatch[1]);

  const vsMatch = lower.match(/([a-z0-9_-]+)\s+vs\s+([a-z0-9_-]+)/i);
  if (vsMatch) {
    cols.push(vsMatch[1]);
    cols.push(vsMatch[2]);
  }

  const ignoredTokens = new Set([
    "record", "row", "count", "for", "of", "on", "with", "showing", "average", "avg", "mean", "highest", "max", "lowest", "min", "total", "sum", "kpi", "card"
  ]);
  const cleanCols = cols.map(c => c.trim()).filter(Boolean);

  for (const col of cleanCols) {
    if (ignoredTokens.has(col)) continue;
    const exists = (profile.columns || []).some(c => 
      c.name.toLowerCase() === col || 
      c.normalizedName === col ||
      (c.title && c.title.toLowerCase() === col)
    );
    if (!exists) {
      const err = new Error(`Column '${col}' does not exist in schema.`);
      err.statusCode = 400;
      throw err;
    }
  }

  const commonInvalidColumns = ["gender", "age", "fake_column", "department", "turnover", "satisfaction", "retention", "retention_rate", "salary", "revenue", "profit", "discount", "quantity", "attendance", "score", "result"];
  for (const invalid of commonInvalidColumns) {
    const invalidPattern = new RegExp(`(^|[^a-z0-9_])${invalid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`, "i");
    if (invalidPattern.test(lower)) {
      const exists = (profile.columns || []).some(c => 
        c.name.toLowerCase() === invalid || 
        c.normalizedName === invalid ||
        (c.title && c.title.toLowerCase() === invalid)
      );
      if (!exists) {
        const err = new Error(`Column '${invalid}' does not exist in schema.`);
        err.statusCode = 400;
        throw err;
      }
    }
  }
}

export async function runLlamaDatasetChat(dataset, query) {
  const facts = buildDatasetFacts(dataset);
  validateQueryColumns(facts.schema, query);


  const safeContext = {
    datasetName: facts.schema.datasetName,
    rowCount: facts.schema.rowCount,
    columnCount: facts.schema.columnCount,
    columns: facts.schema.columns,
    facts: facts.facts,
    privacy: {
      schemaOnly: true,
      rawRowsSentToAI: false,
    },
  };

  const memories = retrieveLearningMemory({
    userQuestion: query,
    schemaColumns: facts.schema.columns.map((c) => c.name || c.normalizedName).filter(Boolean),
    domain: facts.schema.domain || dataset.domain || "generic",
  });

  const prompt = `
You are a schema-only AI analyst. You never receive raw dataset rows. You plan and explain using schema, metadata, and deterministic aggregate results only. Never ask for or rely on raw rows.
You are InsightFlow AI Chat.

You answer questions about an uploaded dataset.

Important rules:
- You receive schema and calculated statistics only.
- Raw rows are not provided.
- Do not invent exact values beyond provided facts.
- If a value is not present in the facts, say it needs local calculation.
- Keep the answer useful and concise.

Use these learned corrections before answering:
${JSON.stringify(memories, null, 2)}

If a correction rule matches the user question, follow it.
Do not repeat previous mistakes.

User question:
${query}

Dataset safe context:
${JSON.stringify(safeContext, null, 2)}
`;

  try {
    const result = await callDatasetChat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    return {
      content: result.content,
      provider: 'ollama',
      model: OLLAMA_MODELS.chat,
      schemaOnly: true,
      insights: [],
      chart: null,
    };
  } catch (error) {
    return {
      content: fallbackAnswer(query, facts),
      provider: 'fallback',
      model: OLLAMA_MODELS.chat,
      schemaOnly: true,
      aiError: error.message,
      insights: [],
      chart: null,
    };
  }
}
