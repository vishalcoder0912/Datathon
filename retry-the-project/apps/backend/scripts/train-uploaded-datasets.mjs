#!/usr/bin/env node
/**
 * Train InsightFlow schema RAG from uploaded CSV datasets.
 *
 * Usage from repo root:
 *   node apps/backend/scripts/train-uploaded-datasets.mjs healthcare_dataset.csv Amazon_Reviews.csv
 */
import fs from "node:fs";
import path from "node:path";
import { buildRuleDashboardPlan } from "../src/services/ai-analyst/dashboard-plan-engine.js";
import { buildSchemaProfile } from "../src/services/ai-analyst/schema-fingerprint.js";
import { trainSchemaRagMemoryFromDataset } from "../src/services/ai-analyst/schema-rag-retriever.js";
import {
  exportTrainingJsonl,
  trainSchemaExample,
} from "../src/services/ai-analyst/schema-training-store.js";

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quote && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quote = !quote;
      continue;
    }

    if (char === "," && !quote) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quote) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => String(header).trim()) || [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function inferColumns(rows) {
  return Object.keys(rows[0] || {}).map((name) => ({ name }));
}

function domainFromFile(file) {
  const lower = path.basename(file).toLowerCase();
  if (lower.includes("health")) return "healthcare";
  if (lower.includes("amazon") || lower.includes("review")) return "ecommerce_reviews";
  return "general_business";
}

async function trainFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) throw new Error(`No rows found in ${filePath}`);

  const dataset = {
    name: path.basename(filePath),
    fileName: path.basename(filePath),
    domainHint: domainFromFile(filePath),
    rows,
    columns: inferColumns(rows),
  };

  const profile = buildSchemaProfile(dataset);
  const dashboardPlan = buildRuleDashboardPlan(profile);

  await trainSchemaRagMemoryFromDataset({
    dataset,
    schemaProfile: profile,
    acceptedDashboardPlan: dashboardPlan,
    rating: "good",
    notes: `Approved dashboard plan for ${dataset.domainHint} dataset.`,
    source: "uploaded-dataset-training",
  });

  trainSchemaExample({
    dataset,
    dashboardPlan,
    notes: `Approved dashboard plan for ${dataset.domainHint} dataset.`,
    source: "uploaded-dataset-training",
  });

  return {
    file: filePath,
    rows: rows.length,
    columns: dataset.columns.length,
    domain: dataset.domainHint,
  };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error(
    "Pass CSV paths: node apps/backend/scripts/train-uploaded-datasets.mjs healthcare_dataset.csv Amazon_Reviews.csv",
  );
  process.exit(1);
}

const results = [];
for (const file of files) {
  results.push(await trainFile(path.resolve(file)));
}

const exported = exportTrainingJsonl();
console.log(JSON.stringify({ ok: true, results, exportedLines: exported.split("\n").length }, null, 2));
