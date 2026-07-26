import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSchemaDashboard } from "../services/ai-analyst/schema-trained-ai-service.js";
import { sentinelDataset } from "./test-helpers.js";

describe("Ollama schema-only safety", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends schema only to Ollama and strips malicious chart.data responses", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requestBody = String(init?.body || "");
      return {
        ok: true,
        json: async () => ({
          response: JSON.stringify({
            action: "GENERATE_DASHBOARD",
            message: "Dashboard plan generated",
            schemaOnly: true,
            kpis: [
              { title: "Total Records", metric: "__row_count__", aggregation: "count", format: "number" },
            ],
            charts: [
              {
                type: "bar",
                title: "Unsafe",
                xKey: "country",
                yKey: "salary_usd",
                aggregation: "avg",
                data: [{ country: "India", value: 12345 }],
              },
            ],
          }),
        }),
      };
    }));

    const result = await generateSchemaDashboard(sentinelDataset, { useLlm: true, threshold: 1 });

    // Schema packet contains no full dataset rows or value-bearing profile metadata.
    expect(requestBody).not.toContain("\"rows\"");
    expect(requestBody).not.toContain("SECRET_RAW_ROW_SHOULD_NEVER_REACH_LLM");
    expect(requestBody).not.toContain("\"stats\"");
    expect(requestBody).not.toContain("\"topValues\"");
    expect(requestBody).not.toContain("50000");
    expect(requestBody).not.toContain("90000");
    expect(requestBody).toContain("salary_usd");
    // Dashboard spec has no chart.data from AI
    expect(JSON.stringify(result)).not.toContain("\"data\"");
    expect(result.dashboard.charts.length).toBeGreaterThan(0);
    expect(result.dashboard.charts.every((chart) => !chart.data)).toBe(true);
    expect(result.llm?.source).toBe(`ollama:${process.env.DASHBOARD_LLM_MODEL || "qwen3:4b"}`);
  });

  it("falls back to local dashboard plan when Ollama is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Ollama unavailable");
    }));

    const result = await generateSchemaDashboard(sentinelDataset, { useLlm: true, threshold: 1 });

    expect(result.dashboard.kpis.length).toBeGreaterThan(0);
    expect(result.dashboard.charts.length).toBeGreaterThan(0);
    expect(result.schemaOnly).toBe(true);
    expect(result.llm?.source).toBe("ollama-error");
  });
});
