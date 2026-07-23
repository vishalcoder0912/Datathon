import { describe, expect, it } from "vitest";
import { buildExcelAnalystPlan, detectExcelIntent, INTENTS } from "../services/ai-analyst/excel-analyst-brain.js";

const salaryDataset = {
  name: "salary-test",
  rows: [
    { country: "India", salary_usd: 50000, experience: 2, education: "Bachelors" },
    { country: "USA", salary_usd: 90000, experience: 5, education: "Masters" },
    { country: "India", salary_usd: 65000, experience: 3, education: "Masters" },
  ],
};

describe("Excel analyst brain", () => {
  it("detects Excel-like intents", () => {
    expect(detectExcelIntent("top selling product")).toBe(INTENTS.TOP_N);
    expect(detectExcelIntent("month-wise trend")).toBe(INTENTS.TREND);
    expect(detectExcelIntent("find outliers")).toBe(INTENTS.OUTLIERS);
    expect(detectExcelIntent("clean this data")).toBe(INTENTS.CLEANING);
  });

  it("builds a structured pivot plan for average salary by country", async () => {
    const plan = await buildExcelAnalystPlan({
      dataset: salaryDataset,
      query: "Compare average salary by country",
      options: { useOllama: false, ragThreshold: 1 },
    });

    expect(plan.schemaOnly).toBe(true);
    expect(plan.intent).toBe(INTENTS.SEGMENT_COMPARISON);
    expect(plan.executionPlan).toMatchObject({
      metric: "salary_usd",
      dimension: "country",
      aggregation: "avg",
    });
    expect(plan.recommendedDashboard.charts).toBeInstanceOf(Array);
  });

  it("builds a correlation plan using experience and salary", async () => {
    const plan = await buildExcelAnalystPlan({
      dataset: salaryDataset,
      query: "correlation between experience and salary",
      options: { useOllama: false, ragThreshold: 1 },
    });

    expect(plan.intent).toBe(INTENTS.CORRELATION);
    expect(plan.executionPlan.metric).toBe("salary_usd");
    expect(plan.executionPlan.dimension).toBe("experience");
  });
});
