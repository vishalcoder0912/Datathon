import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const memoryPath = path.join(process.cwd(), "data", "schema-rag-memory.excel.test.json");
process.env.SCHEMA_RAG_MEMORY_PATH = memoryPath;
process.env.DISABLE_OLLAMA_EMBEDDINGS = "1";

let excelAnalystSeedDatasets;
let trainExcelAnalystRagSeeds;

beforeAll(async () => {
  const excelRagTraining = await import("../../scripts/train-excel-analyst-rag.js");
  excelAnalystSeedDatasets = excelRagTraining.excelAnalystSeedDatasets;
  trainExcelAnalystRagSeeds = excelRagTraining.trainExcelAnalystRagSeeds;
});

function resetMemoryFile() {
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  fs.writeFileSync(memoryPath, "[]", "utf8");
}

describe("Excel RAG training seeds", () => {
  beforeEach(resetMemoryFile);
  afterEach(resetMemoryFile);

  it("defines at least 8 strong Excel analyst examples", () => {
    expect(excelAnalystSeedDatasets.length).toBeGreaterThanOrEqual(8);
    for (const seed of excelAnalystSeedDatasets) {
      expect(seed.dataset.rows.length).toBeGreaterThan(0);
      expect(seed.acceptedDashboardPlan.kpis.length).toBeGreaterThan(0);
      expect(seed.acceptedDashboardPlan.charts.length).toBeGreaterThan(0);
    }
  });

  it("trains schema RAG memory with excellent excel-analyst-seed entries", async () => {
    const result = await trainExcelAnalystRagSeeds({ useOllama: false });
    const saved = JSON.parse(fs.readFileSync(memoryPath, "utf8"));

    expect(result.count).toBeGreaterThanOrEqual(8);
    expect(saved).toHaveLength(result.count);
    expect(saved.every((entry) => entry.source === "excel-analyst-seed")).toBe(true);
    expect(saved.every((entry) => entry.rating === "excellent")).toBe(true);
    expect(saved.every((entry) => !entry.rows && !entry.rawRows)).toBe(true);
  });
});
