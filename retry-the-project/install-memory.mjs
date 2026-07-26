#!/usr/bin/env node
/**
 * Merge schema RAG memory into InsightFlow without storing raw sample values.
 *
 * Usage from repo root:
 *   node install-memory.mjs schema-rag-memory.uploaded-datasets.json
 */
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Pass input memory json path.");

const sourcePath = path.resolve(input);
const targetPath = path.resolve("apps/backend/data/schema-rag-memory.json");

function sanitizeColumn(column = {}) {
  const { topValues, values, samples, examples, rawValues, ...safe } = column;

  return {
    ...safe,
    topValuesCount: Array.isArray(topValues) ? topValues.length : column.topValuesCount || 0,
  };
}

function sanitizePlanItem(item = {}) {
  const { value, values, data, rows, rawRows, sampleRows, calculatedValues, chartData, ...safe } =
    item;
  return safe;
}

function sanitizeEntry(entry = {}) {
  const {
    rows,
    rawRows,
    sampleRows,
    datasetRows,
    fullRows,
    rowData,
    data,
    records,
    table,
    ...safe
  } = entry;

  const columns = Array.isArray(safe.columns) ? safe.columns.map(sanitizeColumn) : [];
  const profileColumns = Array.isArray(safe.schemaProfile?.columns)
    ? safe.schemaProfile.columns.map(sanitizeColumn)
    : columns;

  return {
    ...safe,
    columns,
    schemaProfile: {
      ...(safe.schemaProfile || {}),
      columns: profileColumns,
    },
    dashboardPlan: {
      kpis: Array.isArray(safe.dashboardPlan?.kpis)
        ? safe.dashboardPlan.kpis.map(sanitizePlanItem)
        : [],
      charts: Array.isArray(safe.dashboardPlan?.charts)
        ? safe.dashboardPlan.charts.map(sanitizePlanItem)
        : [],
    },
    updatedAt: new Date().toISOString(),
  };
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!Array.isArray(source)) throw new Error("Input memory JSON must be an array.");

fs.mkdirSync(path.dirname(targetPath), { recursive: true });

let existing = [];
if (fs.existsSync(targetPath)) {
  const parsed = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  existing = Array.isArray(parsed) ? parsed : [];
}

const byKey = new Map();
for (const rawItem of existing) {
  const item = sanitizeEntry(rawItem);
  const key = item.id || `${item.domain || "unknown"}:${item.schemaSignature || item.name}`;
  byKey.set(key, item);
}

for (const rawItem of source) {
  const item = sanitizeEntry(rawItem);
  const key = item.id || `${item.domain || "unknown"}:${item.schemaSignature || item.name}`;
  const previous = byKey.get(key) || {};

  byKey.set(key, {
    ...previous,
    ...item,
    createdAt: previous.createdAt || item.createdAt || new Date().toISOString(),
    examplesSeen: Math.max(Number(previous.examplesSeen || 0), Number(item.examplesSeen || 1), 1),
    updatedAt: new Date().toISOString(),
  });
}

fs.writeFileSync(targetPath, JSON.stringify([...byKey.values()], null, 2), "utf8");
console.log(`Merged ${source.length} entries into ${targetPath}`);
