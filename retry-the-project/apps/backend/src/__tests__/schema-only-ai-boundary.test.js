import { describe, expect, it, vi, afterEach } from "vitest";
import {
  sanitizeDatasetForLLM,
  sanitizeAnalyticsResultForLLM,
  assertNoRawRowsInLLMPayload,
  assertNoRawRowsInString,
} from "../services/ai/llm-payload-sanitizer.js";
import { runLlamaDatasetChat } from "../services/llama-chat-agent.js";
import { compactSchema as compactSchemaMaster } from "../services/ai/insightflowMasterPlanner.ts";
import * as ollamaDualModelService from "../services/ollama/ollama-dual-model-service.js";

// Helper mock dataset creators
function createMockDataset(rowCount) {
  const columns = [
    { name: "salary_usd", type: "number", role: "metric", semanticType: "currency" },
    { name: "country", type: "string", role: "dimension", semanticType: "geo_country" },
  ];
  
  const rows = [];
  for (let i = 0; i < Math.min(rowCount, 100); i++) {
    rows.push({ salary_usd: 50000 + i * 1000, country: "USA" });
  }

  return {
    id: "test-dataset-id",
    name: "Test Dataset",
    rowCount,
    columns,
    rows,
    schemaSignature: "test-signature",
    domain: "finance",
    schemaWarnings: [],
  };
}

describe("Strict Schema-Only AI Boundary Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Small dataset with 10 rows
  it("processes a small dataset (10 rows) and sanitizes it to schema-only, omitting raw rows", () => {
    const dataset = createMockDataset(10);
    const sanitized = sanitizeDatasetForLLM(dataset);

    expect(sanitized.datasetId).toBe("test-dataset-id");
    expect(sanitized.rowCount).toBe(10);
    expect(sanitized.columns).toBeDefined();
    expect(sanitized.columns.length).toBe(2);
    
    // Verify schema shape
    expect(sanitized.columns[0]).toEqual({
      name: "salary_usd",
      type: "number",
      role: "metric",
      semanticType: "currency",
      nullable: undefined,
      missingRate: 0,
      cardinality: 0,
      isMetric: true,
      isDimension: false,
      isDate: false,
      isGeo: false,
    });

    // Ensure raw rows/data are completely excluded
    expect(sanitized.rows).toBeUndefined();
    expect(sanitized.data).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain("USA");
  });

  // 2. Large dataset with 1 million rows
  it("processes a large dataset (1,000,000 rows) and sanitizes it to schema-only, omitting raw rows", () => {
    const dataset = createMockDataset(1000000);
    const sanitized = sanitizeDatasetForLLM(dataset);

    expect(sanitized.datasetId).toBe("test-dataset-id");
    expect(sanitized.rowCount).toBe(1000000);
    expect(sanitized.rows).toBeUndefined();
    expect(sanitized.data).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain("USA");
  });

  // 3. Dataset chatbot
  it("verifies the dataset chatbot calculates aggregates locally and forwards only summary facts + schema to the model", async () => {
    const dataset = createMockDataset(10);
    
    const spy = vi.spyOn(ollamaDualModelService, "callDatasetChat").mockResolvedValue({
      content: "Based on the schema, the average salary is $54,500.",
    });

    const result = await runLlamaDatasetChat(dataset, "What is the average salary_usd?");

    expect(result.content).toContain("average salary");
    expect(spy).toHaveBeenCalled();
    
    // Retrieve messages passed to the model
    const messages = spy.mock.calls[0][0];
    const userPrompt = messages[0].content;

    // AI receives only computed averages and schema
    expect(userPrompt).toContain('"avg": 54500'); // Local deterministic engine calculated average
    expect(userPrompt).toContain("salary_usd");
    expect(userPrompt).not.toContain('"rows":'); // No raw rows sent in prompt
  });

  // 4. Dashboard planner
  it("verifies the dashboard planner receives schema-only packet and no raw rows", () => {
    const dataset = createMockDataset(100);
    const schemaProfile = {
      datasetName: dataset.name,
      rowCount: dataset.rowCount,
      columnCount: dataset.columns.length,
      domain: dataset.domain,
      columns: dataset.columns.map(c => ({
        name: c.name,
        type: c.type,
        role: c.role,
        uniqueCount: 2,
        missingPct: 0,
        topValues: [],
        stats: { min: 50000, max: 100000, avg: 75000, median: 75000 }
      })),
    };

    const plannerPayload = compactSchemaMaster(schemaProfile);

    expect(plannerPayload.datasetName).toBe("Test Dataset");
    expect(plannerPayload.rowCount).toBe(100);
    expect(plannerPayload.columns.length).toBe(2);
    expect(plannerPayload.columns[0].stats.avg).toBe(75000);
    expect(plannerPayload.rows).toBeUndefined();
    expect(plannerPayload.data).toBeUndefined();
  });

  // 5. Advanced analytics
  it("verifies advanced analytics sanitizes results to KPIs and aggregates before LLM consumption", () => {
    const rawResult = {
      datasetId: "ds-123",
      rowCount: 5000,
      selectedMetric: "salary_usd",
      kpis: [{ title: "Avg Salary", value: 75000 }],
      charts: [{ title: "Distribution", type: "histogram" }],
      correlations: [{ x: "age", y: "salary_usd", r: 0.85 }],
      anomalies: [{ row_index: 45, value: 500000 }], // safe computed anomalies
      segmentation: [{ segment: "Engineering", avg: 90000 }],
      drivers: [{ field: "experience", impact: 0.7 }],
      forecast: [{ period: "2027", value: 105000 }],
      dataHealth: { qualityScore: 98 },
      warnings: [],
      // internal raw rows (to be stripped)
      rows: [{ age: 25, salary_usd: 75000 }],
      rawData: "some,csv,data",
    };

    const sanitized = sanitizeAnalyticsResultForLLM(rawResult);

    expect(sanitized.datasetId).toBe("ds-123");
    expect(sanitized.selectedMetric).toBe("salary_usd");
    expect(sanitized.kpis[0].value).toBe(75000);
    expect(sanitized.rows).toBeUndefined();
    expect(sanitized.rawData).toBeUndefined();
  });

  // 6. Unsafe payload test
  it("asserts that assertNoRawRowsInLLMPayload throws an error when payload contains row-level data", () => {
    const safePayload = {
      datasetId: "ds-123",
      columns: [{ name: "salary" }],
    };

    expect(assertNoRawRowsInLLMPayload(safePayload)).toBe(true);

    const unsafePayloadWithRows = {
      datasetId: "ds-123",
      columns: [{ name: "salary" }],
      rows: [{ salary: 50000 }],
    };

    expect(() => assertNoRawRowsInLLMPayload(unsafePayloadWithRows)).toThrow(
      "Blocked unsafe LLM payload"
    );

    const unsafePayloadWithData = {
      datasetId: "ds-123",
      data: [{ salary: 50000 }],
    };

    expect(() => assertNoRawRowsInLLMPayload(unsafePayloadWithData)).toThrow(
      "Blocked unsafe LLM payload"
    );
  });

  // 7. Qdrant memory test
  it("verifies that vector DB/Qdrant payloads are sanitized and do not store raw rows", () => {
    const memoryPayload = {
      id: "mem-123",
      metadata: {
        schemaText: "salary_usd (number), country (string)",
        columnMetadata: [{ name: "salary_usd", role: "metric" }],
        dashboardPatterns: ["bar_chart_salary_by_country"],
        // Unsafe keys injected
        rows: [{ salary_usd: 120000 }],
      },
    };

    expect(() => assertNoRawRowsInLLMPayload(memoryPayload)).toThrow(
      "Blocked unsafe LLM payload"
    );

    // After removing raw rows, it passes
    delete memoryPayload.metadata.rows;
    expect(assertNoRawRowsInLLMPayload(memoryPayload)).toBe(true);
  });
});
