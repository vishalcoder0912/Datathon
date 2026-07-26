import { describe, expect, it } from "vitest";
import { handleDatasetRoutes } from "../routes/datasets.js";
import { handleAnalyticsRoutes } from "../routes/analytics.js";
import { makeReq, makeRes } from "./test-helpers.js";

const salesPayload = {
  name: "Sales Small Integration Test",
  fileName: "sales-small.json",
  sourceType: "upload",
  columns: [
    { name: "order_id", type: "string" },
    { name: "order_date", type: "date" },
    { name: "region", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" },
    { name: "profit", type: "number" },
    { name: "discount", type: "number" },
    { name: "quantity", type: "number" }
  ],
  rows: [
    { "order_id": "ORD001", "order_date": "2024-01-15", "region": "North", "category": "Office", "revenue": 1200, "profit": 300, "discount": 0.05, "quantity": 12 },
    { "order_id": "ORD002", "order_date": "2024-01-18", "region": "South", "category": "Tech", "revenue": 1800, "profit": 450, "discount": 0.10, "quantity": 18 },
    { "order_id": "ORD003", "order_date": "2024-02-05", "region": "North", "category": "Tech", "revenue": 900, "profit": 180, "discount": 0.00, "quantity": 9 },
    { "order_id": "ORD004", "order_date": "2024-02-12", "region": "East", "category": "Furniture", "revenue": 2500, "profit": 500, "discount": 0.15, "quantity": 5 },
    { "order_id": "ORD005", "order_date": "2024-02-28", "region": "West", "category": "Office", "revenue": 600, "profit": 150, "discount": 0.02, "quantity": 6 }
  ]
};

const invalidPayload = {
  name: "Invalid Mixed Integration Test",
  fileName: "invalid-mixed.json",
  sourceType: "upload",
  columns: [
    { name: "country", type: "string" },
    { name: "salary_usd", type: "number" },
    { name: "experience", type: "number" }
  ],
  rows: [
    { "country": "India", "salary_usd": 50000, "experience": 2 },
    { "country": "USA", "salary_usd": 90000, "experience": 5 },
    { "country": "India", "salary_usd": 65000, "experience": 3 },
    { "country": "", "salary_usd": "", "experience": "not-a-number" },
    {},
    { "country": "Canada", "salary_usd": "100k", "experience": -5 }
  ]
};

describe("Analytics Schema and Integrity tests", () => {
  it("imports sales dataset, fetches schema and validates fields", async () => {
    const importRes = makeRes();
    const importHandled = await handleDatasetRoutes(
      makeReq("POST", salesPayload),
      importRes,
      "/api/datasets/import"
    );
    expect(importHandled).toBe(true);
    expect(importRes.statusCode).toBe(201);
    const importData = importRes.json();
    const datasetId = importData.data.dataset.id;
    expect(datasetId).toBeDefined();

    // Verify row and column counts
    expect(importData.data.dataset.rows.length).toBe(salesPayload.rows.length);

    // Fetch schema and verify column detection
    const schemaRes = makeRes();
    const schemaHandled = await handleAnalyticsRoutes(
      makeReq("GET"),
      schemaRes,
      `/api/datasets/${datasetId}/schema`
    );
    expect(schemaHandled).toBe(true);
    expect(schemaRes.statusCode).toBe(200);
    const schemaData = schemaRes.json().data.schema;

    const numericCols = schemaData.columns.filter(c => c.type === "numeric").map(c => c.name);
    const categoryCols = schemaData.columns.filter(c => c.type === "categorical").map(c => c.name);

    expect(numericCols).toContain("revenue");
    expect(numericCols).toContain("profit");
    expect(categoryCols).toContain("category");
    expect(categoryCols).toContain("region");
  });

  it("profiles calculations against real dataset rows", async () => {
    const importRes = makeRes();
    await handleDatasetRoutes(makeReq("POST", salesPayload), importRes, "/api/datasets/import");
    const datasetId = importRes.json().data.dataset.id;

    const profileRes = makeRes();
    const profileHandled = await handleAnalyticsRoutes(
      makeReq("GET"),
      profileRes,
      `/api/datasets/${datasetId}/ai/profile`
    );
    expect(profileHandled).toBe(true);
    expect(profileRes.statusCode).toBe(200);
    const profile = profileRes.json().data.profile;

    expect(profile.rowCount).toBe(salesPayload.rows.length);
    const revCol = profile.columns.find((c) => c.name === "revenue");
    expect(["number", "numeric", "int64", "double"]).toContain(revCol.type);
  });

  it("verifies correlation rules", async () => {
    const importRes = makeRes();
    await handleDatasetRoutes(makeReq("POST", salesPayload), importRes, "/api/datasets/import");
    const datasetId = importRes.json().data.dataset.id;

    const correlationsRes = makeRes();
    const correlationsHandled = await handleAnalyticsRoutes(
      makeReq("GET"),
      correlationsRes,
      `/api/datasets/${datasetId}/ai-correlations`
    );
    expect(correlationsHandled).toBe(true);
    expect(correlationsRes.statusCode).toBe(200);
    const data = correlationsRes.json().data;

    expect(data.correlations).toBeDefined();
    expect(data.correlations.strongPairs).toBeDefined();

    // Only numeric fields should be present in correlations
    data.correlations.strongPairs.forEach((c) => {
      const col1 = c.column1 || c.columnA;
      const col2 = c.column2 || c.columnB;
      expect(["revenue", "profit", "discount", "quantity"]).toContain(col1);
      expect(["revenue", "profit", "discount", "quantity"]).toContain(col2);
      expect(c.coefficient).toBeGreaterThanOrEqual(-1);
      expect(c.coefficient).toBeLessThanOrEqual(1);
    });
  });

  it("verifies statistical anomalies", async () => {
    const importRes = makeRes();
    await handleDatasetRoutes(makeReq("POST", salesPayload), importRes, "/api/datasets/import");
    const datasetId = importRes.json().data.dataset.id;

    const anomaliesRes = makeRes();
    const anomaliesHandled = await handleAnalyticsRoutes(
      makeReq("GET"),
      anomaliesRes,
      `/api/datasets/${datasetId}/ai/anomalies`
    );
    expect(anomaliesHandled).toBe(true);
    expect(anomaliesRes.statusCode).toBe(200);
    const data = anomaliesRes.json().data.anomalies;
    expect(data.anomalies).toBeDefined();
  });

  it("verifies cleaning endpoint on invalid/mixed dataset", async () => {
    const importRes = makeRes();
    await handleDatasetRoutes(makeReq("POST", invalidPayload), importRes, "/api/datasets/import");
    const datasetId = importRes.json().data.dataset.id;

    const cleaningRes = makeRes();
    const cleaningHandled = await handleAnalyticsRoutes(
      makeReq("GET"),
      cleaningRes,
      `/api/datasets/${datasetId}/ai/cleaning`
    );
    expect(cleaningHandled).toBe(true);
    expect(cleaningRes.statusCode).toBe(200);
    const suggestions = cleaningRes.json().data.suggestions;

    expect(suggestions).toBeDefined();
    const countryIssue = suggestions.find((s) => s.column === "country" && s.issue === "missing_values");
    expect(countryIssue).toBeDefined();
  });
});
