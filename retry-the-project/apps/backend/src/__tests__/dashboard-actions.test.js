import { describe, expect, it } from "vitest";
import { parseCustomChartQuery } from "../services/agentic-dashboard/custom-chart-query-parser.js";
import { buildSchemaProfile } from "../services/ai-analyst/schema-profiler.js";

describe("Custom Dashboard Actions Parser", () => {
  const dataset = {
    name: "Employee Dataset",
    columns: ["country", "salary_usd", "experience"],
    rows: [
      { country: "India", salary_usd: 60000, experience: 3 },
      { country: "USA", salary_usd: 120000, experience: 8 }
    ]
  };

  const schemaProfile = buildSchemaProfile(dataset);

  it("Show average salary_usd by country", () => {
    const action = parseCustomChartQuery("Show average salary_usd by country", schemaProfile);
    expect(action).toBeDefined();
    expect(action.action).toBe("create_chart");
    expect(action.chart_type).toBe("bar");
    expect(action.x).toBe("country");
    expect(action.y).toBe("salary_usd");
    expect(action.aggregation).toBe("avg");
  });

  it("Create pie chart of country", () => {
    const action = parseCustomChartQuery("Create pie chart of country", schemaProfile);
    expect(action).toBeDefined();
    expect(action.action).toBe("create_chart");
    expect(action.chart_type).toBe("pie"); // canonical type is pie
    expect(action.x).toBe("country");
    expect(action.y).toBe("count");
    expect(action.aggregation).toBe("count");
  });

  it("Show salary_usd distribution", () => {
    const action = parseCustomChartQuery("Show salary_usd distribution", schemaProfile);
    expect(action).toBeDefined();
    expect(action.action).toBe("create_chart");
    expect(action.chart_type).toBe("histogram");
    expect(action.x).toBe("salary_usd");
  });

  it("Add KPI for highest salary_usd", () => {
    const action = parseCustomChartQuery("total salary_usd", schemaProfile);
    expect(action).toBeDefined();
    expect(action.action).toBe("create_kpi");
    expect(action.metric).toBe("salary_usd");
    expect(action.aggregation).toBe("sum");
  });

  it("Show experience vs salary_usd", () => {
    const action = parseCustomChartQuery("Show experience vs salary_usd", schemaProfile);
    expect(action).toBeDefined();
    expect(action.action).toBe("create_chart");
    expect(action.chart_type).toBe("scatter");
    expect(action.x).toBe("experience");
    expect(action.y).toBe("salary_usd");
  });

  it("Filter country = USA", () => {
    const action = parseCustomChartQuery("Filter country = USA", schemaProfile);
    expect(action).toBeDefined();
    expect(action.action).toBe("filter");
    expect(action.filters.country).toBe("USA");
  });

  it("Gender pie chart", () => {
    // 1. When gender column exists:
    const datasetWithGender = {
      name: "Gender Dataset",
      columns: ["gender"],
      rows: [{ gender: "male" }, { gender: "female" }]
    };
    const profileWithGender = buildSchemaProfile(datasetWithGender);
    const action = parseCustomChartQuery("Create pie chart of gender", profileWithGender);
    expect(action).toBeDefined();
    expect(action.action).toBe("create_chart");
    expect(action.chart_type).toBe("pie");
    expect(action.x).toBe("gender");

    // 2. When gender column does not exist:
    const actionNoGender = parseCustomChartQuery("Create pie chart of gender", schemaProfile);
    expect(actionNoGender).toBeNull(); // Should fall back to AI
  });
});
