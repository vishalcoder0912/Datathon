import { describe, expect, it, vi } from "vitest";
import { handleDatasetRoutes } from "../routes/datasets.js";
import { makeReq, makeRes } from "./test-helpers.js";

vi.mock("../services/ai-analyst/ai-analyst-orchestrator.js", () => ({
  runFullAutoAnalysis: vi.fn(async () => ({
    insights: [],
    chartRecommendations: []
  }))
}));

describe("Dataset Import API", () => {
  it("POST /api/datasets/import validates input and registers dataset", async () => {
    const request = makeReq("POST", {
      name: "Import Test",
      fileName: "test.csv",
      sourceType: "upload",
      columns: [
        { name: "name", type: "string" },
        { name: "age", type: "number" }
      ],
      rows: [
        { name: "John", age: 30 },
        { name: "Alice", age: 25 }
      ]
    });
    
    const response = makeRes();
    const handled = await handleDatasetRoutes(request, response, "/api/datasets/import");
    
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.dataset.name).toBe("Import Test");
    expect(body.data.dataset.rows).toHaveLength(2);
  });

  it("POST /api/datasets/import returns 400 for missing fields", async () => {
    const request = makeReq("POST", {
      name: "Missing Columns"
    });
    const response = makeRes();
    const handled = await handleDatasetRoutes(request, response, "/api/datasets/import");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(400);
  });

  it("GET /api/datasets lists imported datasets", async () => {
    const response = makeRes();
    const handled = await handleDatasetRoutes(makeReq("GET"), response, "/api/datasets");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.datasets)).toBe(true);
  });
});
