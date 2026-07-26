import { describe, expect, it } from "vitest";
import { handleSchemaTrainedAIRoutes } from "../routes/schema-trained-ai.routes.js";
import { makeReq, makeRes, salaryDataset } from "./test-helpers.js";

async function callRoute(pathname, body) {
  const response = makeRes();
  const handled = await handleSchemaTrainedAIRoutes(makeReq("POST", body), response, pathname);
  return { handled, response, payload: response.json() };
}

describe("schema-trained AI routes", () => {
  it("generates a schema-only dashboard plan without raw rows or chart data", async () => {
    const { handled, payload } = await callRoute("/api/datasets/test-local/schema-dashboard", {
      ...salaryDataset,
      useLlm: false,
    });

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data.schemaOnly).toBe(true);
    expect(payload.data.profile).toBeTruthy();
    expect(payload.data.dashboard.kpis).toBeInstanceOf(Array);
    expect(payload.data.dashboard.charts).toBeInstanceOf(Array);
    for (const chart of payload.data.dashboard.charts) {
      expect(chart).not.toHaveProperty("data");
    }
    expect(JSON.stringify(payload)).not.toContain("\"rows\"");
  });

  it("routes a valid dashboard command to a safe chart spec", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/dashboard-command", {
      ...salaryDataset,
      query: "show average salary_usd by country as bar chart",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      action: "GENERATE_CHART",
      schemaOnly: true,
    });
    expect(payload.data.chartSpec).not.toHaveProperty("data");
    expect(payload.data.chartSpec.xKey).toBe("country");
  });

  it("handles invalid scatter conversion safely by returning a chart spec", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/dashboard-command", {
      ...salaryDataset,
      query: "convert country pie chart to scatter",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data.action).toBe("GENERATE_CHART");
  });

  it("routes dashboard repair requests to FIX_DASHBOARD", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/dashboard-command", {
      ...salaryDataset,
      query: "fix dashboard",
      currentDashboard: {
        charts: [
          {
            type: "bar",
            title: "Broken",
            xKey: "missing_column",
            yKey: "salary_usd",
            aggregation: "avg",
          },
        ],
      },
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data.action).toBe("FIX_DASHBOARD");
    expect(payload.data.schemaOnly).toBe(true);
  });

  it("answers schema chat like an analyst without fake KPI values or raw row packet", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/schema-chat", {
      ...salaryDataset,
      query: "Explain this dataset",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data.assistantMessage.content).toContain("workforce compensation dataset");
    expect(payload.data.assistantMessage.content).toContain("The most useful fields appear to be");
    expect(payload.data.assistantMessage.content).toContain("Recommended Starting Point");
    expect(payload.data.assistantMessage.content).not.toContain("3 rows");
    expect(payload.data.assistantMessage.content).not.toContain("detected domain");
    expect(payload.data.assistantMessage.content).not.toContain("Confidence Score");
    expect(payload.data.assistantMessage.schemaOnly).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("\"rows\"");
  });

  it("answers Excel analyst chat with local calculations", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/excel-chat", {
      ...salaryDataset,
      query: "Compare average salary by country",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data.assistantMessage.schemaOnly).toBe(true);
    expect(payload.data.analysis.provider).toBe("excel-analyst-rag");
    expect(payload.data.analysis.calculation.ok).toBe(true);
    expect(payload.data.analysis.calculation.result).toEqual([
      { name: "USA", value: 90000, count: 1 },
      { name: "India", value: 57500, count: 2 },
    ]);
  });
});
