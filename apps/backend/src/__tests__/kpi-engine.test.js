import { describe, expect, it } from "vitest";
import { calculateKPI } from "../services/analytics/local-calculation-engine.js";

describe("Local KPI Calculation Engine", () => {
  const dataset = {
    columns: ["country", "salary_usd"],
    rows: [
      { country: "India", salary_usd: 50000 },
      { country: "USA", salary_usd: 90000 },
      { country: "India", salary_usd: 65000 },
      { country: "USA", salary_usd: 90000 },
      { country: "UK", salary_usd: 80000 }
    ]
  };

  it("calculates avg correctly", () => {
    const res = calculateKPI(dataset, { metric: "salary_usd", aggregation: "avg" });
    expect(res.calculated).toBe(true);
    expect(res.value).toBe(75000); // (50 + 90 + 65 + 90 + 80)/5 = 375/5 = 75
  });

  it("calculates count correctly", () => {
    const res = calculateKPI(dataset, { metric: "salary_usd", aggregation: "count" });
    expect(res.calculated).toBe(true);
    expect(res.value).toBe(5);
  });

  it("calculates max correctly", () => {
    const res = calculateKPI(dataset, { metric: "salary_usd", aggregation: "max" });
    expect(res.calculated).toBe(true);
    expect(res.value).toBe(90000);
  });

  it("calculates min correctly", () => {
    const res = calculateKPI(dataset, { metric: "salary_usd", aggregation: "min" });
    expect(res.calculated).toBe(true);
    expect(res.value).toBe(50000);
  });

  it("calculates median correctly", () => {
    const res = calculateKPI(dataset, { metric: "salary_usd", aggregation: "median" });
    expect(res.calculated).toBe(true);
    expect(res.value).toBe(80000); // sorted: [50, 65, 80, 90, 90] -> middle is 80
  });

  it("calculates count_unique (distinct_count) correctly", () => {
    const res = calculateKPI(dataset, { metric: "salary_usd", aggregation: "count_unique" });
    expect(res.calculated).toBe(true);
    expect(res.value).toBe(4); // unique salaries: 50, 65, 80, 90
  });
});
