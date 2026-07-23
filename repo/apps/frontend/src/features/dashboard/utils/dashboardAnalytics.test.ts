import { describe, expect, it } from "vitest";
import {
  applyFilters,
  buildChartFromSpec,
  buildDatasetProfile,
  buildDefaultCharts,
  buildKpiFromSpec,
  cleanDatasetRows,
} from "./dashboardAnalytics";

const rows = [
  { country: "India", education: "Bachelors", salary_usd: 100, experience: 2, languages: "Rust, JavaScript", frameworks: "React, Vue" },
  { country: "India", education: "Masters", salary_usd: 200, experience: 4, languages: "Rust, Python", frameworks: "React" },
  { country: "USA", education: "Masters", salary_usd: 300, experience: 6, languages: "JavaScript", frameworks: "Django, React" },
  { column: "salary_usd", type: "number", description: "dictionary row", _sourceFile: "data_dictionary.csv" },
];

describe("dashboardAnalytics", () => {
  it("removes dictionary rows and calculates KPI values locally", () => {
    const clean = cleanDatasetRows(rows);

    expect(clean.length).toBe(3);
    expect(buildKpiFromSpec(clean, { title: "Total Rows", metric: "__row_count__", aggregation: "count" }).rawValue).toBe(3);
    expect(buildKpiFromSpec(clean, { title: "Median Salary", metric: "salary_usd", aggregation: "median" }).rawValue).toBe(200);
    expect(buildKpiFromSpec(clean, { title: "Highest Salary", metric: "salary_usd", aggregation: "max" }).rawValue).toBe(300);
    expect(buildKpiFromSpec(clean, { title: "Countries", metric: "country", aggregation: "count_unique" }).rawValue).toBe(2);
  });

  it("calculates average salary by country correctly", () => {
    const chart = buildChartFromSpec(cleanDatasetRows(rows), {
      title: "Average Salary by Country",
      type: "bar",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
      limit: 10,
    });

    expect(chart.data.find((item) => item.country === "India")?.salary_usd).toBe(150);
    expect(chart.data.find((item) => item.country === "USA")?.salary_usd).toBe(300);
  });

  it("builds histogram and scatter chart data", () => {
    const clean = cleanDatasetRows(rows);
    const histogram = buildChartFromSpec(clean, {
      title: "Salary Distribution",
      type: "histogram",
      xKey: "salary_usd",
      yKey: "salary_usd",
      aggregation: "count",
      limit: 4,
    });
    const scatter = buildChartFromSpec(clean, {
      title: "Salary vs Experience",
      type: "scatter",
      xKey: "experience",
      yKey: "salary_usd",
      aggregation: "count",
      limit: 10,
    });

    expect(histogram.data.reduce((sum, item) => sum + Number(item.count || 0), 0)).toBe(3);
    expect(scatter.data).toHaveLength(3);
  });

  it("splits multi-value languages and frameworks", () => {
    const clean = cleanDatasetRows(rows);
    const languages = buildChartFromSpec(clean, {
      title: "Average Salary by Language",
      type: "bar",
      xKey: "languages",
      yKey: "salary_usd",
      aggregation: "avg",
      splitValues: true,
      limit: 10,
    });
    const frameworks = buildChartFromSpec(clean, {
      title: "Average Salary by Framework",
      type: "bar",
      xKey: "frameworks",
      yKey: "salary_usd",
      aggregation: "avg",
      splitValues: true,
      limit: 10,
    });

    expect(languages.data.find((item) => item.languages === "Rust")?.salary_usd).toBe(150);
    expect(languages.data.find((item) => item.languages === "JavaScript")?.salary_usd).toBe(200);
    expect(frameworks.data.find((item) => item.frameworks === "React")?.salary_usd).toBe(200);
  });

  it("filters rows before chart calculation", () => {
    const filtered = applyFilters(cleanDatasetRows(rows), { country: "India" });
    const chart = buildChartFromSpec(filtered, {
      title: "Average Salary by Country",
      type: "bar",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
      limit: 10,
    });

    expect(filtered.length).toBe(2);
    expect(chart.data).toHaveLength(1);
    expect(chart.data[0].salary_usd).toBe(150);
  });

  it("keeps sales metrics numeric in small datasets", () => {
    const salesRows = [
      { month: "Jan", category: "Electronics", region: "North", revenue: 1200, units_sold: 12, profit_margin: 24 },
      { month: "Feb", category: "Furniture", region: "South", revenue: 850, units_sold: 8, profit_margin: 18 },
      { month: "Mar", category: "Electronics", region: "West", revenue: 1500, units_sold: 15, profit_margin: 30 },
      { month: "Apr", category: "Office", region: "North", revenue: 620, units_sold: 7, profit_margin: 16 },
      { month: "May", category: "Furniture", region: "East", revenue: 930, units_sold: 9, profit_margin: 21 },
    ];

    const profile = buildDatasetProfile(salesRows);
    const charts = buildDefaultCharts(salesRows);

    expect(profile.numericColumns.map((column) => column.name)).toEqual([
      "revenue",
      "units_sold",
      "profit_margin",
    ]);
    expect(profile.primaryMetric?.name).toBe("revenue");
    expect(profile.primaryCategory?.name).toBe("category");
    expect(charts.some((chart) => chart.title === "Average Revenue by Category")).toBe(true);
  });
});
