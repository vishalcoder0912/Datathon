#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trainSchemaExample, exportTrainingJsonl, getMemoryStats } from "../src/services/ai-analyst/schema-training-store.js";
import { buildSchemaProfile } from "../src/services/ai-analyst/schema-fingerprint.js";
import { buildRuleDashboardPlan } from "../src/services/ai-analyst/dashboard-plan-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = process.argv.slice(2);
const exportJsonl = args.includes("--export-jsonl");
const targets = args.filter((arg) => !arg.startsWith("--"));
const defaultDir = path.resolve(process.cwd(), "training-datasets");

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quote && next === '"') { current += '"'; i++; continue; }
    if (char === '"') { quote = !quote; continue; }
    if (char === "," && !quote) { row.push(current); current = ""; continue; }
    if ((char === "\n" || char === "\r") && !quote) {
      if (char === "\r" && next === "\n") i++;
      row.push(current); current = "";
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    current += char;
  }

  if (current || row.length) { row.push(current); rows.push(row); }
  if (!rows.length) return [];

  const headers = rows.shift().map((header) => String(header).trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function walkFiles(inputPath) {
  if (!fs.existsSync(inputPath)) return [];
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return [inputPath];
  return fs.readdirSync(inputPath).flatMap((name) => walkFiles(path.join(inputPath, name)));
}

function inferColumns(rows) {
  return Object.keys(rows[0] || {}).map((name) => ({ name }));
}

function trainCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) return null;

  const dataset = {
    name: path.basename(filePath),
    fileName: path.basename(filePath),
    rows,
    columns: inferColumns(rows),
  };

  const profile = buildSchemaProfile(dataset);
  const dashboardPlan = buildRuleDashboardPlan(profile);
  const entry = trainSchemaExample({ dataset, dashboardPlan, rating: "good", source: "training-script" });
  return { file: filePath, entry: entry.name, domain: entry.domain, signature: entry.schemaProfile.signature };
}

function importSeed() {
  const seedPath = path.resolve(process.cwd(), "data", "schema-training-memory.seed.json");
  const memoryPath = path.resolve(process.cwd(), "data", "schema-training-memory.json");
  if (!fs.existsSync(seedPath) || fs.existsSync(memoryPath)) return false;
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  fs.copyFileSync(seedPath, memoryPath);
  return true;
}

const actualTargets = targets.length ? targets : [defaultDir];
const seeded = importSeed();
if (seeded) console.log("✅ Seed memory copied to data/schema-training-memory.json");

const csvFiles = actualTargets.flatMap(walkFiles).filter((file) => file.toLowerCase().endsWith(".csv"));

if (!csvFiles.length) {
  console.log("ℹ️ No CSV files found. Put datasets in apps/backend/training-datasets or pass a file/folder path.");
} else {
  for (const file of csvFiles) {
    try {
      const result = trainCsv(file);
      if (result) console.log(`✅ Trained ${path.basename(file)} → ${result.domain} (${result.signature})`);
    } catch (error) {
      console.warn(`⚠️ Failed ${file}: ${error.message}`);
    }
  }
}

if (exportJsonl) {
  const output = path.resolve(process.cwd(), "data", "schema-dashboard-training.jsonl");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, exportTrainingJsonl());
  console.log(`✅ Exported JSONL: ${output}`);
}

console.log("📊 Memory stats:", getMemoryStats());
