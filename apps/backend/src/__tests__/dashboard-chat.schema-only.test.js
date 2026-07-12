import { describe, expect, it } from "vitest";
import { runDashboardCommand } from "../services/ai-analyst/schema-trained-ai-service.js";
import { calculateChartData, calculateKPI } from "../services/analytics/local-calculation-engine.js";

const dashboardDataset = {
  id: "train_export",
  name: "train_export",
  columns: [
    "experience",
    "country",
    "education",
    "languages",
    "frameworks",
    "company_size",
    "salary_usd",
    "secret_name",
    "secret_code",
  ],
  rows: [
    {
      experience: 5,
      country: "USA",
      education: "Masters",
      languages: "English",
      frameworks: "React",
      company_size: "Large",
      salary_usd: 112299,
      secret_name: "vishal",
      secret_code: "raw-row-marker",
    },
    { experience: 3, country: "USA", education: "Bachelors", languages: "English", frameworks: "Node", company_size: "Mid", salary_usd: 87701 },
    { experience: 7, country: "UK", education: "Masters", languages: "English", frameworks: "Django", company_size: "Large", salary_usd: 95000 },
    { experience: 4, country: "Canada", education: "Bachelors", languages: "English,French", frameworks: "React", company_size: "Mid", salary_usd: 82000 },
    { experience: 8, country: "Germany", education: "Masters", languages: "German", frameworks: "Spring", company_size: "Large", salary_usd: 99000 },
    { experience: 6, country: "France", education: "Masters", languages: "French", frameworks: "Vue", company_size: "Mid", salary_usd: 91000 },
    { experience: 9, country: "Japan", education: "PhD", languages: "Japanese", frameworks: "Ruby", company_size: "Large", salary_usd: 105000 },
    { experience: 5, country: "Australia", education: "Bachelors", languages: "English", frameworks: "Angular", company_size: "Small", salary_usd: 88000 },
    { experience: 4, country: "Singapore", education: "Masters", languages: "English", frameworks: "React", company_size: "Mid", salary_usd: 97000 },
  ],
};

async function command(query, options = {}) {
  return runDashboardCommand({
    dataset: dashboardDataset,
    query,
    currentDashboard: options.currentDashboard || {},
    useLlm: false,
    requireOllamaValidation: false,
  });
}

describe("dashboard chat schema-only commands", () => {
  it("keeps dashboard AI command payload schema-only and excludes raw rows", async () => {
    const result = await command("add a KPI of USA");
    const payloadText = JSON.stringify(result);

    expect(result.schemaOnly).toBe(true);
    expect(result).not.toHaveProperty("rows");
    expect(result).not.toHaveProperty("data");
    expect(payloadText).not.toContain("112299");
    expect(payloadText).not.toContain("vishal");
    expect(payloadText).not.toContain("raw-row-marker");
    expect(result.kpiSpec).toMatchObject({
      metric: "salary_usd",
      filters: [{ column: "country", operator: "equals", value: "USA" }],
    });
  });

  it("creates a filtered USA salary KPI instead of a duplicate generic KPI", async () => {
    const result = await command("add a KPI of USA", {
      currentDashboard: {
        kpis: [{ title: "Avg Salary Usd", metric: "salary_usd", aggregation: "avg", filters: [] }],
      },
    });

    expect(result.action).toBe("GENERATE_KPI");
    expect(result.kpiSpec.metric).toBe("salary_usd");
    expect(result.kpiSpec.aggregation).toBe("avg");
    expect(result.kpiSpec.filters).toEqual([{ column: "country", operator: "equals", value: "USA" }]);
    expect(result.kpiSpec.title).toBe("Avg Salary Usd - USA");
    expect(result.kpiSpec.title).not.toBe("Avg Salary Usd");

    const calculated = calculateKPI(dashboardDataset, result.kpiSpec);
    expect(calculated.value).toBe(100000);
    expect(calculated.rowsProcessed).toBe(2);
  });

  it("normalizes UK country aliases for filtered KPIs", async () => {
    const result = await command("add a KPI of uk");

    expect(result.kpiSpec.filters[0]).toEqual({ column: "country", operator: "equals", value: "UK" });
    expect(result.kpiSpec.title).toMatch(/UK/i);
  });

  it("creates median salary KPI from command", async () => {
    const result = await command("Add a KPI for median Salary Usd");

    expect(result.action).toBe("GENERATE_KPI");
    expect(result.kpiSpec.metric).toBe("salary_usd");
    expect(result.kpiSpec.aggregation).toBe("median");
    expect(result.kpiSpec.title).toMatch(/Median Salary Usd/i);
    expect(result.kpiSpec.filters).toEqual([]);
  });

  it("creates all-country comparison chart without stale dashboard filters", async () => {
    const result = await command("Compare Salary Usd by Country", {
      currentDashboard: { filters: { country: "Australia" } },
    });

    expect(result.action).toBe("GENERATE_CHART");
    expect(result.chartSpec).toMatchObject({
      type: "bar",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
      filters: [],
      calculationSource: "AVG(salary_usd) grouped by country",
    });

    const chartData = calculateChartData(dashboardDataset, result.chartSpec);
    expect(chartData.data.length).toBeGreaterThan(1);
  });

  it("creates top 5 country by salary as a sorted horizontal bar chart", async () => {
    const result = await command("Show top 5 Country by Salary Usd");

    expect(result.action).toBe("GENERATE_CHART");
    expect(result.chartSpec).toMatchObject({
      type: "horizontal_bar",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
      limit: 5,
      sort: { by: "value", direction: "desc" },
    });
    expect(result.chartSpec.title).toBe("Top 5 Countries by Avg Salary Usd");
  });

  it("asks for clarification for unknown category values instead of creating fake KPIs", async () => {
    const result = await command("add a KPI of mars");

    expect(result.action).toBe("ANSWER");
    expect(result.needsClarification).toBe(true);
    expect(result.message).toMatch(/could not find/i);
    expect(result.message).toMatch(/USA/);
  });

  it("routes filter commands by known category value", async () => {
    const result = await command("filter to Canada");

    expect(result.action).toBe("FILTER");
    expect(result.filters).toEqual({ country: "Canada" });
  });

  it("does not invent trends when no date column exists", async () => {
    const result = await command("Explain the trend");

    expect(result.action).toBe("ANSWER");
    expect(result.message).toMatch(/No date\/time column exists/i);
  });

  it("rejects unsafe unknown schema fields", async () => {
    await expect(command("create chart of salary by password")).rejects.toThrow(/password.*does not exist/i);
  });
});
