import { describe, expect, it, vi } from "vitest";
import { handleChatRoutes } from "../routes/chat.js";
import { makeReq, makeRes } from "./test-helpers.js";

const trainDataset = {
  id: "train_export",
  name: "train_export",
  columns: ["experience", "country", "education", "languages", "frameworks", "company_size", "salary_usd", "secret_note"],
  rows: [
    { experience: 5, country: "USA", education: "Masters", languages: "English", frameworks: "React", company_size: "Large", salary_usd: 155001.85, secret_note: "RAW_SECRET_NEVER_SEND" },
    { experience: 4, country: "Canada", education: "Bachelors", languages: "English", frameworks: "Node", company_size: "Mid", salary_usd: 130000 },
    { experience: 7, country: "UK", education: "Masters", languages: "English", frameworks: "Django", company_size: "Large", salary_usd: 122500 },
    { experience: 3, country: "USA", education: "Bachelors", languages: "English", frameworks: "React", company_size: "Mid", salary_usd: 145000 },
    { experience: 6, country: "Germany", education: "Masters", languages: "German", frameworks: "Spring", company_size: "Large", salary_usd: 118000 },
  ],
};

vi.mock("../database/dataset-repository.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getDatasetById: (id) => (id === "train_export" ? trainDataset : null),
    getChatMessages: () => [],
    saveChatMessage: () => {},
    clearChatMessages: () => {},
  };
});

async function postAnalytics(body) {
  const response = makeRes();
  const handled = await handleChatRoutes(makeReq("POST", body), response, "/api/chat/analytics");
  return { handled, response, payload: response.json() };
}

async function postDashboardAction(body) {
  const response = makeRes();
  const handled = await handleChatRoutes(makeReq("POST", body), response, "/api/dashboard/action");
  return { handled, response, payload: response.json() };
}

function dataOf(payload) {
  return payload.data;
}

describe("POST /api/chat/analytics", () => {
  it("returns greeting without SQL or provider dependency", async () => {
    const { handled, payload } = await postAnalytics({ datasetId: "train_export", message: "hello" });
    const data = dataOf(payload);

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(data.success).toBe(true);
    expect(data.intent).toBe("greeting");
    expect(data.answer).toMatch(/Hi!/);
    expect(data.sql).toBeNull();
    expect(data.safety.rawRowsSentToAI).toBe(false);
  });

  it("compares salary by country with a schema-safe chart", async () => {
    const { payload } = await postAnalytics({ datasetId: "train_export", message: "Compare Salary Usd by Country" });
    const data = dataOf(payload);

    expect(data.intent).toBe("compare_metric_by_dimension");
    expect(data.queryPlan).toMatchObject({ metric: "salary_usd", aggregation: "avg", dimension: "country" });
    expect(data.sql).toMatch(/AVG/);
    expect(data.chart).toMatchObject({ type: "bar", xKey: "label", yKey: "value" });
    expect(data.chart.data[0]).toMatchObject({ label: "USA" });
    expect(data.dashboardAction).toMatchObject({ available: true, type: "ADD_CHART" });
    expect(JSON.stringify(data.aiPayloadPreview)).not.toContain("RAW_SECRET_NEVER_SEND");
    expect(JSON.stringify(data)).not.toContain('"rows":[{"experience"');
  });

  it("creates top 5 salary by country as horizontal bar", async () => {
    const { payload } = await postAnalytics({ datasetId: "train_export", message: "Show top 5 Country by Salary Usd" });
    const data = dataOf(payload);

    expect(data.intent).toBe("top_n");
    expect(data.queryPlan.limit).toBe(5);
    expect(data.chart.type).toBe("horizontal_bar");
  });

  it("creates filtered KPI for USA and normalizes UK", async () => {
    const usa = dataOf((await postAnalytics({ datasetId: "train_export", message: "Add a KPI of USA" })).payload);
    expect(usa.intent).toBe("add_kpi");
    expect(usa.queryPlan.filters).toEqual([{ column: "country", operator: "equals", value: "USA" }]);
    expect(usa.kpi.title).toMatch(/USA/);
    expect(usa.dashboardAction.type).toBe("ADD_KPI");

    const uk = dataOf((await postAnalytics({ datasetId: "train_export", message: "Add a KPI of uk" })).payload);
    expect(uk.queryPlan.filters[0].value).toBe("UK");
  });

  it("does not invent trend without a date column", async () => {
    const { payload } = await postAnalytics({ datasetId: "train_export", message: "Explain the trend" });
    const data = dataOf(payload);

    expect(data.intent).toBe("trend");
    expect(data.answer).toMatch(/No date\/time column is available/i);
    expect(data.result).toBeNull();
  });

  it("returns clarification for unsafe SQL and unknown columns", async () => {
    const { payload } = await postAnalytics({ datasetId: "train_export", message: "select * from dataset" });
    const data = dataOf(payload);

    expect(data.success).toBe(true);
    expect(data.intent).toBe("clarification");
    expect(data.answer).toMatch(/Raw SQL/i);
  });

  it("returns safe JSON when dataset is missing", async () => {
    const { payload } = await postAnalytics({ datasetId: "missing", message: "hello" });
    const data = dataOf(payload);

    expect(payload.success).toBe(true);
    expect(data.success).toBe(false);
    expect(data.errorCode).toBe("SCHEMA_NOT_FOUND");
    expect(data.answer).toMatch(/schema was not found/i);
  });

  it("accepts add-to-dashboard chart actions safely", async () => {
    const { handled, payload } = await postDashboardAction({
      datasetId: "train_export",
      action: {
        type: "ADD_CHART",
        chart: { id: "chart_1", type: "bar", xKey: "label", yKey: "value", data: [] },
      },
    });
    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ success: true, datasetId: "train_export" });
  });
});
