import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MEMORY_FILE = path.resolve("data", "ai-analyst-memory.json");

function ensureFile() {
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });

  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify([], null, 2));
  }
}

function readMemory() {
  ensureFile();

  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeMemory(memory) {
  ensureFile();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

function similarity(a = "", b = "") {
  const setA = new Set(a.split("|").filter(Boolean));
  const setB = new Set(b.split("|").filter(Boolean));

  if (!setA.size || !setB.size) return 0;

  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;

  return intersection / union;
}

export function findMemoryMatch({ domain, columnSignature }) {
  const memory = readMemory();

  const best = memory
    .filter((item) => item.domain === domain)
    .map((item) => ({
      ...item,
      similarity: similarity(item.columnSignature, columnSignature),
    }))
    .sort((a, b) => b.similarity - a.similarity)[0];

  if (!best || best.similarity < 0.65) return null;

  return best;
}

export function saveAnalystMemory({ domain, columnSignature, kpis, charts }) {
  const memory = readMemory();

  const existing = memory.find(
    (item) => item.domain === domain && item.columnSignature === columnSignature
  );

  const item = {
    id: existing?.id || randomUUID(),
    domain,
    columnSignature,
    kpiTemplates: kpis.map((kpi) => ({
      title: kpi.title,
      metric: kpi.metric,
      aggregation: kpi.aggregation,
    })),
    chartTemplates: charts.map((chart) => ({
      title: chart.title,
      type: chart.type,
      xKey: chart.xKey,
      yKey: chart.yKey,
      aggregation: chart.aggregation,
    })),
    usageCount: existing ? existing.usageCount + 1 : 1,
    createdAt: existing?.createdAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };

  const next = existing
    ? memory.map((entry) => (entry.id === existing.id ? item : entry))
    : [...memory, item];

  writeMemory(next);

  return item;
}
