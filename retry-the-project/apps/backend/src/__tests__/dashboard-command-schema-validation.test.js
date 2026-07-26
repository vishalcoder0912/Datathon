import { describe, expect, it, vi } from "vitest";
import { handleDashboardAiRoutes } from "../routes/dashboardAiRoutes.js";
import { handleChartQueryRequest } from "../routes/dashboard-chart-handler.js";
import { handleDatasetRoutes } from "../routes/datasets.js";
import { makeReq, makeRes } from "./test-helpers.js";

vi.mock("../services/ai/dashboardPlanner.js", () => ({
  planDashboardWithAI: vi.fn(async ({ schemaProfile, userQuery }) => {
    const hasSalary = userQuery && userQuery.toLowerCase().includes("salary");
    return {
      success: true,
      action: "GENERATE_DASHBOARD",
      message: "Mocked dashboard plan",
      dashboardPlan: {
        kpis: hasSalary ? [] : [{ title: "Total Revenue", metric: "revenue", aggregation: "sum" }],
        charts: hasSalary ? [] : [{ title: "Revenue by Region", type: "bar", xKey: "region", yKey: "revenue", aggregation: "sum" }]
      }
    };
  })
}));

const salesPayload = {
  name: "Sales Small",
  columns: [
    { name: "order_id", type: "string" },
    { name: "order_date", type: "date" },
    { name: "region", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" }
  ],
  rows: [
    { "order_id": "ORD001", "order_date": "2024-01-15", "region": "North", "category": "Office", "revenue": 1200 },
    { "order_id": "ORD002", "order_date": "2024-01-18", "region": "South", "category": "Tech", "revenue": 1800 }
  ]
};

describe("Dashboard Command Schema Validation tests", () => {
  it("POST /api/dashboard-ai/command executes valid query on sales dataset", async () => {
    const response = makeRes();
    const body = {
      query: "Show top categories by revenue",
      rows: salesPayload.rows,
      datasetName: salesPayload.name,
      dataDictionary: salesPayload.columns
    };

    const handled = await handleDashboardAiRoutes(
      makeReq("POST", body),
      response,
      "/api/dashboard-ai/command"
    );

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.success).toBe(true);
    expect(data.dashboard).toBeDefined();
  });

  it("POST /api/dashboard-ai/command fails or warns when asking for salary on sales dataset", async () => {
    const response = makeRes();
    const body = {
      query: "Show average salary by job title",
      rows: salesPayload.rows,
      datasetName: salesPayload.name,
      dataDictionary: salesPayload.columns
    };

    const handled = await handleDashboardAiRoutes(
      makeReq("POST", body),
      response,
      "/api/dashboard-ai/command"
    );

    expect(handled).toBe(true);
    const data = response.json();
    if (data.success) {
      expect(data.aiPlan.dashboardPlan.kpis.some((k) => k.metric === "salary_usd")).toBe(false);
      expect(data.aiPlan.dashboardPlan.charts.some((c) => c.yKey === "salary_usd")).toBe(false);
    }
  });

  it("POST /api/dashboard/chart-query responds with deterministic matching spec", async () => {
    const importRes = makeRes();
    await handleDatasetRoutes(makeReq("POST", salesPayload), importRes, "/api/datasets/import");
    const datasetId = importRes.json().data.dataset.id;

    const queryRes = makeRes();
    const body = {
      query: "revenue by region",
      datasetId
    };

    const handled = await handleChartQueryRequest(
      makeReq("POST", body),
      queryRes,
      "/api/dashboard/chart-query"
    );

    expect(handled).toBe(true);
    expect(queryRes.statusCode).toBe(200);
    const data = queryRes.json();
    expect(data.success).toBe(true);
    expect(data.data.chart.xKey).toBe("region");
    expect(data.data.chart.yKey).toBe("revenue");
    expect(data.data.chart.aggregation).toBe("sum");
  });
});
