import { describe, expect, it } from "vitest";
import { INTENTS } from "../services/ai-analyst/excel-analyst-brain.js";
import {
  correlation,
  dataQuality,
  executeExcelAnalysis,
  outliers,
} from "../services/ai-analyst/excel-calculation-engine.js";
import { buildSchemaProfile } from "../services/ai-analyst/schema-fingerprint.js";

const salesRows = [
  { month: "2026-01-01", product: "Laptop", category: "Electronics", amount: 100, revenue: 1000 },
  { month: "2026-01-10", product: "Phone", category: "Electronics", amount: 80, revenue: 800 },
  { month: "2026-02-01", product: "Laptop", category: "Electronics", amount: 140, revenue: 1400 },
  { month: "2026-02-05", product: "Chair", category: "Furniture", amount: 70, revenue: 700 },
];

describe("Excel calculation engine", () => {
  it("calculates top product by revenue locally", () => {
    const calculation = executeExcelAnalysis({
      rows: salesRows,
      plan: {
        executionPlan: {
          intent: INTENTS.TOP_N,
          metric: "revenue",
          dimension: "product",
          aggregation: "sum",
          limit: 1,
        },
      },
    });

    expect(calculation.ok).toBe(true);
    expect(calculation.result[0]).toMatchObject({ name: "Laptop", value: 2400, count: 2 });
  });

  it("calculates average salary by country", () => {
    const rows = [
      { country: "India", salary_usd: 50000 },
      { country: "USA", salary_usd: 90000 },
      { country: "India", salary_usd: 65000 },
    ];

    const calculation = executeExcelAnalysis({
      rows,
      plan: {
        executionPlan: {
          intent: INTENTS.PIVOT,
          metric: "salary_usd",
          dimension: "country",
          aggregation: "avg",
        },
      },
    });

    expect(calculation.result).toEqual([
      { name: "USA", value: 90000, count: 1 },
      { name: "India", value: 57500, count: 2 },
    ]);
  });

  it("detects missing values and duplicate rows", () => {
    const rows = [
      { country: "India", salary_usd: 50000 },
      { country: "India", salary_usd: 50000 },
      { country: "", salary_usd: null },
    ];
    const profile = buildSchemaProfile({ name: "quality", rows });

    const result = dataQuality(rows, profile);

    expect(result.duplicateRows).toBe(1);
    expect(result.missing.find((item) => item.column === "country").missingCount).toBe(1);
    expect(result.missing.find((item) => item.column === "salary_usd").missingCount).toBe(1);
  });

  it("calculates trend by month", () => {
    const calculation = executeExcelAnalysis({
      rows: salesRows,
      plan: {
        executionPlan: {
          intent: INTENTS.TREND,
          metric: "revenue",
          dateColumn: "month",
          aggregation: "sum",
        },
      },
    });

    expect(calculation.result).toEqual([
      { period: "2026-01", value: 1800, count: 2 },
      { period: "2026-02", value: 2100, count: 2 },
    ]);
  });

  it("returns top 5 categories", () => {
    const rows = [
      { category: "A", amount: 5 },
      { category: "B", amount: 20 },
      { category: "C", amount: 10 },
      { category: "D", amount: 9 },
      { category: "E", amount: 8 },
      { category: "F", amount: 7 },
    ];

    const calculation = executeExcelAnalysis({
      rows,
      plan: {
        executionPlan: {
          intent: INTENTS.TOP_N,
          metric: "amount",
          dimension: "category",
          aggregation: "sum",
          limit: 5,
        },
      },
    });

    expect(calculation.result).toHaveLength(5);
    expect(calculation.result[0].name).toBe("B");
  });

  it("calculates correlation between experience and salary", () => {
    const rows = [
      { experience: 1, salary_usd: 40000 },
      { experience: 2, salary_usd: 50000 },
      { experience: 3, salary_usd: 60000 },
      { experience: 4, salary_usd: 70000 },
    ];

    expect(correlation(rows, "experience", "salary_usd")).toBeCloseTo(1, 5);
  });

  it("detects outliers in amount column", () => {
    const rows = [
      { amount: 10 },
      { amount: 11 },
      { amount: 9 },
      { amount: 10 },
      { amount: 1000 },
    ];

    const result = outliers(rows, "amount");

    expect(result[0].value).toBe(1000);
  });

  it("returns a safe warning for an empty dataset", () => {
    const calculation = executeExcelAnalysis({
      rows: [],
      plan: { executionPlan: { intent: INTENTS.SUMMARY, metric: "amount" } },
    });

    expect(calculation.ok).toBe(false);
    expect(calculation.warning).toContain("no rows");
  });
});
