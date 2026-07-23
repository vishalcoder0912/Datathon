import { describe, expect, it } from "vitest";
import { schemaProfileToRagText, sanitizeDashboardPlanForRag } from "../services/ai-analyst/schema-rag-memory-builder.js";
import { buildSchemaProfile } from "../services/ai-analyst/schema-profiler.js";

describe("RAG Schema Context Retrieval Safety", () => {
  it("schemaProfileToRagText converts schema profile to text containing only metadata, not raw rows", () => {
    const dataset = {
      name: "Sensitive Salaries",
      columns: ["country", "salary_usd", "secret_note"],
      rows: [
        { country: "India", salary_usd: 50000, secret_note: "SECRET_PASSWORD_123" },
        { country: "USA", salary_usd: 100000, secret_note: "safe_value" }
      ]
    };

    const profile = buildSchemaProfile(dataset);
    const ragText = schemaProfileToRagText(profile);

    expect(ragText).toContain("Domain:");
    expect(ragText).toContain("Signature:");
    expect(ragText).toContain("country");
    expect(ragText).toContain("salary_usd");
    expect(ragText).toContain("secret_note");
    
    // Crucial: The actual row data and sensitive contents MUST NOT be in the RAG text
    expect(ragText).not.toContain("SECRET_PASSWORD_123");
    expect(ragText).not.toContain("India");
    expect(ragText).not.toContain("50000");
  });

  it("sanitizeDashboardPlanForRag strips unsafe data elements from plans", () => {
    const plan = {
      kpis: [
        { title: "Total salary", metric: "salary_usd", value: 150000, data: [50000, 100000] }
      ],
      charts: [
        { type: "bar", title: "Salaries", xKey: "country", yKey: "salary_usd", data: [{ country: "India", salary_usd: 50000 }] }
      ]
    };

    const profile = {
      columns: [
        { name: "country", type: "string" },
        { name: "salary_usd", type: "number" }
      ]
    };

    const safePlan = sanitizeDashboardPlanForRag(plan, profile);

    // Assert that the raw data/value arrays are fully stripped
    expect(safePlan.kpis[0].value).toBeUndefined();
    expect(safePlan.kpis[0].data).toBeUndefined();
    expect(safePlan.charts[0].data).toBeUndefined();

    // Verify metadata remains intact
    expect(safePlan.kpis[0].title).toBe("Total salary");
    expect(safePlan.charts[0].type).toBe("bar");
  });
});
