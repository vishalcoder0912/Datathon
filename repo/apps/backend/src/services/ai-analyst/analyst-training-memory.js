import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..", "..");
const MEMORY_PATH = path.resolve(
  process.env.ANALYST_TRAINING_MEMORY_PATH ||
    path.join(BACKEND_ROOT, "data", "analyst-training-memory.json"),
);

function readMemory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readAnalystTrainingMemory() {
  return readMemory();
}

export function findAnalystTrainingForDomain(domain) {
  const normalized = String(domain || "").toLowerCase();
  return readMemory().find((entry) => {
    const aliases = [entry.domain, ...(entry.aliases || [])].map((item) =>
      String(item || "").toLowerCase(),
    );
    return aliases.includes(normalized);
  }) || null;
}
