import { describe, expect, it } from "vitest";
import { calculateChartData } from "../services/analytics/local-calculation-engine.js";
import { handleRemoveChartRequest } from "../routes/dashboard-chart-handler.js";
import { makeReq, makeRes } from "./test-helpers.js";

describe("Chart Engine & Route Handler", () => {
  const dataset = {
    columns: ["country", "salary_usd", "experience", "education"],
    rows: [
      { country: "India", salary_usd: 50000, experience: 2, education: "Bachelors" },
      { country: "USA", salary_usd: 120000, experience: 8, education: "Masters" },
      { country: "India", salary_usd: 60000, experience: 3, education: "Bachelors" },
      { country: "USA", salary_usd: 100000, experience: 5, education: "Bachelors" },
      { country: "UK", salary_usd: 80000, experience: 4, education: "Doctorate" }
    ]
  };

  it("calculates average salary by country", () => {
    const config = { x: "country", y: "salary_usd", aggregation: "avg", chart_type: "bar" };
    const res = calculateChartData(dataset, config);

    expect(res.data.length).toBe(3);
    const india = res.data.find(d => d.country === "India");
    const usa = res.data.find(d => d.country === "USA");
    expect(india.salary_usd).toBe(55000);
    expect(usa.salary_usd).toBe(110000);
  });

  it("calculates count by education", () => {
    const config = { x: "education", aggregation: "count", chart_type: "pie" };
    const res = calculateChartData(dataset, config);

    expect(res.data.length).toBe(3);
    const bachelors = res.data.find(d => d.education === "Bachelors");
    expect(bachelors.count).toBe(3);
  });

  it("calculates experience vs salary_usd (scatter plot elements)", () => {
    const config = { x: "experience", y: "salary_usd", aggregation: "avg", chart_type: "scatter" };
    const res = calculateChartData(dataset, config);

    expect(res.data.length).toBe(5); // 5 unique combinations or coordinates
  });

  it("supports limiting and sorting (top 10 countries by salary)", () => {
    const config = { x: "country", y: "salary_usd", aggregation: "avg", chart_type: "bar", limit: 2, sortByValue: true };
    const res = calculateChartData(dataset, config);

    expect(res.data.length).toBe(2);
    // sorted desc: USA (110k) first, UK (80k) second
    expect(res.data[0].country).toBe("USA");
    expect(res.data[1].country).toBe("UK");
  });

  it("POST /api/dashboard/remove-chart returns success with chartId", async () => {
    const request = makeReq("POST", { chartId: "chart-123" });
    const response = makeRes();
    const handled = await handleRemoveChartRequest(request, response, "/api/dashboard/remove-chart");

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
    expect(response.json().data.removedChartId).toBe("chart-123");
  });
});
