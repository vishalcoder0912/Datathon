import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MEMORY_FILE = path.resolve("data", "analytics-playbook-memory.json");

function ensureMemoryFile() {
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });

  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify([], null, 2));
  }
}

export function createColumnSignature(columns = []) {
  return columns
    .map((column) => String(column.name || column).toLowerCase().trim())
    .sort()
    .join("|");
}

export function similarityScore(a = "", b = "") {
  const setA = new Set(a.split("|").filter(Boolean));
  const setB = new Set(b.split("|").filter(Boolean));

  if (!setA.size || !setB.size) return 0;

  const intersection = [...setA].filter((value) => setB.has(value)).length;
  const union = new Set([...setA, ...setB]).size;

  return intersection / union;
}

export function loadAnalyticsMemory() {
  ensureMemoryFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findSimilarPlaybook({ domain, columnSignature }) {
  const candidates = loadAnalyticsMemory()
    .filter((item) => item.domain === domain)
    .map((item) => ({
      ...item,
      similarity: similarityScore(item.columnSignature, columnSignature),
    }))
    .sort((left, right) => right.similarity - left.similarity);

  const best = candidates[0];

  if (!best || best.similarity < 0.65) {
    return null;
  }

  return best;
}

export function saveAnalyticsMemory({
  domain,
  columnSignature,
  kpiTemplates,
  chartTemplates,
}) {
  ensureMemoryFile();

  const memory = loadAnalyticsMemory();
  const existing = memory.find(
    (item) => item.domain === domain && item.columnSignature === columnSignature,
  );

  if (existing) {
    existing.kpiTemplates = kpiTemplates;
    existing.chartTemplates = chartTemplates;
    existing.usageCount = Number(existing.usageCount || 0) + 1;
    existing.lastUsedAt = new Date().toISOString();
  } else {
    memory.push({
      id: randomUUID(),
      domain,
      columnSignature,
      kpiTemplates,
      chartTemplates,
      usageCount: 1,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    });
  }

  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}
