import { describe, expect, it } from "vitest";
import {
  applyDashboardFilters,
  calculateChart,
  calculateKpi,
} from "@/features/dashboard/utils/schemaLocalAnalytics";

const rows = [
  { country: "India", salary_usd: 50000, experience: 2 },
  { country: "USA", salary_usd: 90000, experience: 5 },
  { country: "India", salary_usd: 65000, experience: 3 },
  { country: "", salary_usd: null, experience: "" },
];

describe("schema local analytics", () => {
  it("calculates KPI aggregations locally", () => {
    expect(calculateKpi(rows, { title: "Rows", metric: "__row_count__", aggregation: "count" }).value).toBe(4);
    expect(calculateKpi(rows, { title: "Countries", metric: "country", aggregation: "count_unique" }).value).toBe(2);
    expect(calculateKpi(rows, { title: "Salary Sum", metric: "salary_usd", aggregation: "sum" }).value).toBe(205000);
    expect(calculateKpi(rows, { title: "Salary Avg", metric: "salary_usd", aggregation: "avg" }).value).toBeCloseTo(68333.33, 1);
    expect(calculateKpi(rows, { title: "Min", metric: "salary_usd", aggregation: "min" }).value).toBe(50000);
    expect(calculateKpi(rows, { title: "Max", metric: "salary_usd", aggregation: "max" }).value).toBe(90000);
    expect(calculateKpi(rows, { title: "Median", metric: "salary_usd", aggregation: "median" }).value).toBe(65000);
  });

  it("groups, histograms, scatters, and recomputes after filters", () => {
    const indiaRows = applyDashboardFilters(rows, [{ key: "country", value: "India" }]);
    const indiaAverage = calculateKpi(indiaRows, { title: "India Avg", metric: "salary_usd", aggregation: "avg" });
    const countryDistribution = calculateChart(rows, {
      title: "Countries",
      type: "bar",
      xKey: "country",
      yKey: "count",
      aggregation: "count",
    });
    const histogram = calculateChart(rows, {
      title: "Salary Histogram",
      type: "histogram",
      xKey: "salary_usd",
      yKey: "count",
      aggregation: "count",
      limit: 4,
    });
    const scatter = calculateChart(rows, {
      title: "Experience vs Salary",
      type: "scatter",
      xKey: "experience",
      yKey: "salary_usd",
      aggregation: "count",
    });

    expect(indiaAverage.value).toBe(57500);
    expect(countryDistribution.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ country: "India", value: 2 }),
      expect.objectContaining({ country: "USA", value: 1 }),
    ]));
    expect(histogram.data.length).toBeGreaterThan(0);
    expect(scatter.data.every((point) => typeof point.x === "number" && typeof point.y === "number")).toBe(true);
  });
});
