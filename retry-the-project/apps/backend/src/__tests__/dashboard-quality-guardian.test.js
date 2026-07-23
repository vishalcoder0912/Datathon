import { describe, expect, it } from "vitest";
import {
  assessDashboardHealth,
  enforceDashboardQuality,
  validateChartCombination,
} from "../services/ai-analyst/dashboard-quality-guardian.js";

const salaryProfile = {
  datasetName: "salary.csv",
  rowCount: 40000,
  columnCount: 7,
  domain: "workforce_salary",
  columns: [
    { name: "experience", normalizedName: "experience", type: "number", role: "continuous_metric" },
    { name: "country", normalizedName: "country", type: "category", role: "location" },
    { name: "education", normalizedName: "education", type: "category", role: "category" },
    { name: "languages", normalizedName: "languages", type: "string", role: "category" },
    { name: "frameworks", normalizedName: "frameworks", type: "string", role: "category" },
    { name: "company_size", normalizedName: "company_size", type: "category", role: "category" },
    { name: "salary_usd", normalizedName: "salary_usd", type: "number", role: "money_metric" },
  ],
};

describe("dashboard-quality-guardian", () => {
  it("removes chart.data and fake KPI values from AI plans", () => {
    const dashboard = enforceDashboardQuality(salaryProfile, {
      kpis: [{ title: "Fake Salary", metric: "salary_usd", aggregation: "avg", value: 999999 }],
      charts: [{
        title: "Unsafe AI Chart",
        type: "bar",
        xKey: "country",
        yKey: "salary_usd",
        aggregation: "avg",
        data: [{ country: "India", salary_usd: 1 }],
      }],
    });

    expect(JSON.stringify(dashboard)).not.toContain("999999");
    expect(JSON.stringify(dashboard)).not.toContain("\"data\"");
    expect(dashboard.schemaOnly).toBe(true);
  });

  it("rejects invalid chart combinations and repairs weak dashboard plans", () => {
    const invalid = validateChartCombination(salaryProfile, {
      title: "Country vs Salary",
      type: "scatter",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "count",
    });

    const repaired = enforceDashboardQuality(salaryProfile, {
      charts: [{ title: "Bad Column", type: "bar", xKey: "missing", yKey: "salary_usd", aggregation: "avg" }],
      kpis: [],
    });

    expect(invalid.ok).toBe(false);
    expect(repaired.charts.length).toBe(7);
    expect(repaired.charts.every((chart) => chart.xKey !== "missing")).toBe(true);
  });

  it("supports salary/workforce datasets with schema-only output", () => {
    const dashboard = enforceDashboardQuality(salaryProfile, { kpis: [], charts: [] }, { maxCharts: 7 });
    const health = assessDashboardHealth(salaryProfile, dashboard);

    expect(dashboard.charts.map((chart) => chart.title)).toEqual([
      "Average Salary by Country",
      "Salary Distribution",
      "Salary vs Experience",
      "Average Salary by Education",
      "Average Salary by Company Size",
      "Average Salary by Language",
      "Average Salary by Framework",
    ]);
    expect(dashboard.charts.find((chart) => chart.title === "Average Salary by Language")?.splitValues).toBe(true);
    expect(dashboard.charts.find((chart) => chart.title === "Average Salary by Framework")?.splitValues).toBe(true);
    expect(health.status).toBe("healthy");
    expect(health.score).toBeGreaterThanOrEqual(90);
    expect(dashboard.guardian.unsafeAiDataRemoved).toBe(true);
  });
});
