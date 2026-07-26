import { describe, expect, it } from "vitest";
import { handleSchemaTrainedAIRoutes } from "../routes/schema-trained-ai.routes.js";
import { generateSeniorAnalystDashboard } from "../services/ai-analyst/schema-trained-ai-service.js";
import { makeReq, makeRes } from "./test-helpers.js";

async function callSeniorRoute(dataset, body = {}) {
  const response = makeRes();
  const handled = await handleSchemaTrainedAIRoutes(
    makeReq("POST", { ...dataset, ...body, useRagEmbedding: false }),
    response,
    `/api/datasets/${dataset.id || "test"}/senior-dashboard`
  );
  return { handled, payload: response.json() };
}

function ecommerceDataset() {
  return {
    id: "ecom",
    name: "Ecommerce Orders",
    columns: ["order_date", "order_id", "customer_id", "product_category", "gmv", "quantity", "country"],
    rows: [
      { order_date: "2026-01-01", order_id: "O1", customer_id: "C1", product_category: "Shoes", gmv: 100, quantity: 1, country: "US" },
      { order_date: "2026-02-01", order_id: "O2", customer_id: "C2", product_category: "Bags", gmv: 200, quantity: 2, country: "IN" },
      { order_date: "2026-02-10", order_id: "O3", customer_id: "C1", product_category: "Shoes", gmv: 50, quantity: 1, country: "US" },
    ],
  };
}

function salaryDataset() {
  return {
    id: "salary",
    name: "Developer Salary",
    columns: ["employee_id", "country", "experience_years", "salary_usd"],
    rows: [
      { employee_id: "E1", country: "US", experience_years: 8, salary_usd: 160000 },
      { employee_id: "E2", country: "IN", experience_years: 4, salary_usd: 70000 },
      { employee_id: "E3", country: "US", experience_years: 5, salary_usd: 110000 },
    ],
  };
}

function financeDataset() {
  return {
    id: "finance",
    name: "Finance Transactions",
    columns: ["transaction_date", "transaction_id", "category", "income", "expense"],
    rows: [
      { transaction_date: "2026-01-01", transaction_id: "T1", category: "Sales", income: 1000, expense: 200 },
      { transaction_date: "2026-01-02", transaction_id: "T2", category: "Cloud", income: 500, expense: 300 },
    ],
  };
}

describe("senior analyst dashboard", () => {
  it("handles a 150-column schema by clustering and ignoring noisy ID columns", async () => {
    const columns = ["row_id", "created_date", "country", "revenue", ...Array.from({ length: 146 }, (_, index) => `extra_metric_${index}`)];
    const rows = Array.from({ length: 20 }, (_, index) => {
      const row = { row_id: `RID-${index}`, created_date: "2026-01-01", country: index % 2 ? "US" : "IN", revenue: 100 + index };
      for (let c = 0; c < 146; c += 1) row[`extra_metric_${c}`] = c + index;
      return row;
    });

    const result = await generateSeniorAnalystDashboard({ dataset: { id: "wide", name: "Wide Sales", columns, rows }, options: { useRagEmbedding: false } });

    expect(result.seniorAnalysisPlan.largeSchema).toBe(true);
    expect(result.seniorAnalysisPlan.semanticClusters).toBeTruthy();
    expect(result.seniorAnalysisPlan.rankedColumns.idColumns).toContain("row_id");
    expect(result.charts.some((chart) => chart.xKey === "row_id" || chart.yKey === "row_id")).toBe(false);
  });

  it("profiles a 100k-row dataset with sampling before planning", async () => {
    const rows = Array.from({ length: 100000 }, (_, index) => ({
      order_date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
      order_id: `O${index}`,
      product_category: index % 2 ? "Shoes" : "Bags",
      gmv: index % 100,
    }));

    const result = await generateSeniorAnalystDashboard({
      dataset: { id: "large", name: "Large Ecommerce", columns: ["order_date", "order_id", "product_category", "gmv"], rows },
      options: { sampleSize: 1000, useRagEmbedding: false },
    });

    expect(result.dataQuality.sampling.strategy).toBe("reservoir+stratified");
    expect(result.dataQuality.sampling.sampleSize).toBeLessThanOrEqual(1000);
    expect(result.KPIs.length).toBeGreaterThan(0);
  });

  it("builds ecommerce KPIs and date trend locally", async () => {
    const { handled, payload } = await callSeniorRoute(ecommerceDataset());

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data.seniorAnalysisPlan.domain).toBe("ecommerce");
    expect(payload.data.KPIs.map((kpi) => kpi.title)).toContain("GMV");
    expect(payload.data.KPIs.find((kpi) => kpi.title === "GMV").value).toBe("$350");
    expect(payload.data.charts.some((chart) => chart.type === "line" && chart.xKey === "order_date")).toBe(true);
  });

  it("builds salary dashboard KPIs without fake values", async () => {
    const { payload } = await callSeniorRoute(salaryDataset());
    const avg = payload.data.KPIs.find((kpi) => kpi.title === "Average Salary");

    expect(payload.data.seniorAnalysisPlan.domain).toBe("HR/salary");
    expect(avg.value).toBe("$113,333");
    expect(JSON.stringify(payload.data.dashboardPlan.kpis || [])).not.toContain("\"value\"");
  });

  it("builds finance profit only when income and expense exist", async () => {
    const { payload } = await callSeniorRoute(financeDataset());
    const titles = payload.data.KPIs.map((kpi) => kpi.title);

    expect(payload.data.seniorAnalysisPlan.domain).toBe("finance");
    expect(titles).toContain("Income");
    expect(titles).toContain("Expense");
    expect(titles).toContain("Profit");
  });

  it("skips missing-column KPIs and falls back to generic safe KPIs", async () => {
    const { payload } = await callSeniorRoute({
      id: "missing",
      name: "Missing Metrics",
      columns: ["category", "notes"],
      rows: [{ category: "A", notes: "ok" }, { category: "B", notes: "" }],
    });

    expect(payload.data.KPIs.map((kpi) => kpi.title)).toContain("Total Rows");
    expect(payload.data.KPIs.some((kpi) => /Revenue|Salary|Profit/.test(kpi.title))).toBe(false);
  });

  it("ignores high-cardinality ID columns and does not use high-cardinality pie charts", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      user_id: `U${index}`,
      category: `Category ${index}`,
      revenue: 10 + index,
    }));
    const result = await generateSeniorAnalystDashboard({
      dataset: { id: "ids", name: "High Cardinality IDs", columns: ["user_id", "category", "revenue"], rows },
      options: { useRagEmbedding: false },
    });

    expect(result.charts.some((chart) => chart.xKey === "user_id")).toBe(false);
    expect(result.charts.some((chart) => ["pie", "donut"].includes(chart.type) && chart.xKey === "category")).toBe(false);
  });

  it("adds geo section only when a location column exists", async () => {
    const withGeo = await generateSeniorAnalystDashboard({ dataset: ecommerceDataset(), options: { useRagEmbedding: false } });
    const withoutGeo = await generateSeniorAnalystDashboard({
      dataset: {
        id: "nogeo",
        name: "No Geo Sales",
        columns: ["order_date", "product_category", "revenue"],
        rows: [{ order_date: "2026-01-01", product_category: "A", revenue: 10 }],
      },
      options: { useRagEmbedding: false },
    });

    expect(withGeo.dashboard.layout).toContain("Geo section");
    expect(withoutGeo.dashboard.layout).not.toContain("Geo section");
  });
});

