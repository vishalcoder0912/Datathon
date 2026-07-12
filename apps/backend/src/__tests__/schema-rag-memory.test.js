import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const memoryPath = path.join(process.cwd(), "data", "schema-rag-memory.test.json");
process.env.SCHEMA_RAG_MEMORY_PATH = memoryPath;
process.env.DISABLE_OLLAMA_EMBEDDINGS = "1";

const { buildSchemaProfile } = await import("../services/ai-analyst/schema-fingerprint.js");
const {
  buildSchemaRagMemoryEntry,
  schemaProfileToRagText,
} = await import("../services/ai-analyst/schema-rag-memory-builder.js");
const {
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
} = await import("../services/ai-analyst/schema-rag-retriever.js");

const salaryDataset = {
  name: "salary-test.csv",
  columns: [
    { name: "country" },
    { name: "salary_usd" },
    { name: "experience" },
    { name: "education" },
  ],
  rows: [
    {
      country: "India",
      salary_usd: 50000,
      experience: 2,
      education: "Bachelors",
    },
    {
      country: "USA",
      salary_usd: 90000,
      experience: 5,
      education: "Masters",
    },
  ],
};

const dashboardPlan = {
  kpis: [
    {
      title: "Average Salary",
      metric: "salary_usd",
      aggregation: "avg",
      value: 70000,
      data: [70000],
    },
  ],
  charts: [
    {
      title: "Average Salary by Country",
      type: "bar",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
      data: [
        { country: "India", salary_usd: 50000 },
        { country: "USA", salary_usd: 90000 },
      ],
    },
  ],
};

function resetMemoryFile() {
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  fs.writeFileSync(memoryPath, "[]", "utf8");
}

describe("Schema RAG memory", () => {
  beforeEach(resetMemoryFile);
  afterEach(resetMemoryFile);

  it("creates schema text without numeric raw row values", () => {
    const profile = buildSchemaProfile(salaryDataset);
    const text = schemaProfileToRagText(profile);

    expect(text).toContain("salary_usd");
    expect(text).toContain("country");
    expect(text).not.toContain("50000");
    expect(text).not.toContain("90000");
    expect(text).not.toContain("India");
    expect(text).not.toContain("USA");
  });

  it("removes KPI values and chart data from memory entries", () => {
    const profile = buildSchemaProfile(salaryDataset);

    const entry = buildSchemaRagMemoryEntry({
      dataset: salaryDataset,
      schemaProfile: profile,
      dashboardPlan,
      embedding: [0.1, 0.2, 0.3],
    });

    expect(entry.rows).toBeUndefined();
    expect(entry.rawRows).toBeUndefined();
    expect(entry.dashboardPlan.kpis[0].value).toBeUndefined();
    expect(entry.dashboardPlan.kpis[0].data).toBeUndefined();
    expect(entry.dashboardPlan.charts[0].data).toBeUndefined();
    expect(entry.schemaProfile.columns[0].topValues).toBeUndefined();
    expect(entry.schemaProfile.columns[1].stats).toBeUndefined();
    expect(entry.schemaText).not.toContain("India");
    expect(entry.schemaText).not.toContain("50000");
  });

  it("can train and retrieve schema-only RAG memory without Ollama", async () => {
    const trained = await trainSchemaRagMemoryFromDataset({
      dataset: salaryDataset,
      acceptedDashboardPlan: dashboardPlan,
      useOllama: false,
    });

    expect(trained.entry.dashboardPlan.charts.length).toBeGreaterThan(0);
    expect(trained.entry.embedding).toBeUndefined();

    const profile = buildSchemaProfile(salaryDataset);

    const retrieved = await retrieveSchemaRagMemories(profile, {
      threshold: 0,
      limit: 5,
      useOllama: false,
    });

    expect(retrieved.used).toBe(true);
    expect(retrieved.matches.length).toBeGreaterThan(0);
    expect(retrieved.matches[0].entry.embedding).toBeUndefined();
    expect(retrieved.matches[0].entry.dashboardPlan.charts[0].data).toBeUndefined();
  });
});
