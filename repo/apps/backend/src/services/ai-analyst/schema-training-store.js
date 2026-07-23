import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildSchemaProfile, makeSchemaOnlyPacket, schemaSimilarity } from "./schema-fingerprint.js";
import { buildRuleDashboardPlan, templatePlanForStorage } from "./dashboard-plan-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..", "..");
const MEMORY_PATH = path.resolve(
  process.env.SCHEMA_TRAINING_MEMORY_PATH || path.join(BACKEND_ROOT, "data", "schema-training-memory.json"),
);

function ensureMemoryFile() {
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
  if (!fs.existsSync(MEMORY_PATH)) {
    const seedPath = path.join(path.dirname(MEMORY_PATH), "schema-training-memory.seed.json");
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, MEMORY_PATH);
    } else {
      fs.writeFileSync(MEMORY_PATH, JSON.stringify([], null, 2));
    }
  }
}

export function readSchemaTrainingMemory() {
  ensureMemoryFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSchemaTrainingMemory(memory) {
  ensureMemoryFile();
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
}

export function findBestSchemaMatch(profile, options = {}) {
  const threshold = options.threshold ?? 0.35;
  const memory = readSchemaTrainingMemory();

  const scored = memory
    .map((entry) => ({ entry, score: schemaSimilarity(profile, entry.schemaProfile) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || null;
  if (!best || best.score < threshold) return { best: null, candidates: scored.slice(0, 5) };
  return { best, candidates: scored.slice(0, 5) };
}

export function trainSchemaExample({ dataset, dashboardPlan, rating = "good", notes = "", source = "manual" }) {
  const profile = buildSchemaProfile(dataset);
  const plan = dashboardPlan?.charts?.length || dashboardPlan?.kpis?.length ? dashboardPlan : buildRuleDashboardPlan(profile);
  const storedPlan = templatePlanForStorage(plan, profile);

  const memory = readSchemaTrainingMemory();
  const existingIndex = memory.findIndex((entry) => entry.schemaProfile.signature === profile.signature);

  const entry = {
    id: existingIndex >= 0 ? memory[existingIndex].id : randomUUID(),
    name: dataset.name || dataset.fileName || profile.datasetName,
    domain: profile.domain,
    source,
    rating,
    notes,
    schemaProfile: makeSchemaOnlyPacket(profile),
    dashboardPlan: storedPlan,
    examplesSeen: existingIndex >= 0 ? (memory[existingIndex].examplesSeen || 1) + 1 : 1,
    updatedAt: new Date().toISOString(),
    createdAt: existingIndex >= 0 ? memory[existingIndex].createdAt : new Date().toISOString(),
  };

  if (existingIndex >= 0) memory[existingIndex] = entry;
  else memory.push(entry);

  writeSchemaTrainingMemory(memory);
  return entry;
}

export function trainManySchemaExamples(examples = []) {
  return examples.map((example) => trainSchemaExample(example));
}

export function exportTrainingJsonl() {
  const memory = readSchemaTrainingMemory();
  return memory
    .map((entry) => JSON.stringify({
      messages: [
        {
          role: "system",
          content: "You are InsightFlow Schema Analyst. Return strict JSON dashboard plans only. Never include raw data rows."
        },
        {
          role: "user",
          content: `Create a dashboard plan for this schema only:\n${JSON.stringify(entry.schemaProfile)}`
        },
        {
          role: "assistant",
          content: JSON.stringify({
            action: "GENERATE_DASHBOARD",
            domain: entry.domain,
            kpis: entry.dashboardPlan.kpis,
            charts: entry.dashboardPlan.charts,
            schemaOnly: true
          })
        }
      ]
    }))
    .join("\n");
}

export function getMemoryStats() {
  const memory = readSchemaTrainingMemory();
  const domains = memory.reduce((acc, entry) => {
    acc[entry.domain] = (acc[entry.domain] || 0) + 1;
    return acc;
  }, {});

  return {
    count: memory.length,
    domains,
    memoryPath: MEMORY_PATH,
  };
}
