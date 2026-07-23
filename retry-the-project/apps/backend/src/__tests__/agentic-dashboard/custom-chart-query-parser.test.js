import { describe, expect, it } from "vitest";
import { buildSchemaProfile } from "../../services/ai-analyst/schema-fingerprint.js";
import {
  parseCustomChartQuery,
  normalizeChartAction,
  categorizeSchemaColumns,
  findColumnMatch,
  detectChartType,
  detectAggregation,
} from "../../services/agentic-dashboard/custom-chart-query-parser.js";

const educationDataset = {
  name: "Education Performance",
  columns: ["student_id", "gender", "marks_10th", "board_name", "attendance_pct"],
  rows: Array.from({ length: 25 }, (_, i) => ({
    student_id: i + 1,
    gender: i % 2 === 0 ? "Male" : "Female",
    marks_10th: 60 + (i * 1.5),
    board_name: i % 3 === 0 ? "CBSE" : i % 3 === 1 ? "ICSE" : "State",
    attendance_pct: 70 + i,
  })),
};

const profile = buildSchemaProfile(educationDataset);

describe("custom-chart-query-parser", () => {
  describe("detectChartType", () => {
    it("detects explicit chart types from query text", () => {
      expect(detectChartType("create a pie chart of board_name")).toBe("pie");
      expect(detectChartType("make horizontal bar of marks")).toBe("horizontal_bar");
      expect(detectChartType("show distribution of marks_10th")).toBe("histogram");
      expect(detectChartType("no chart type specified")).toBeNull();
    });
  });

  describe("detectAggregation", () => {
    it("detects explicit aggregations from query text", () => {
      expect(detectAggregation("average marks_10th")).toBe("avg");
      expect(detectAggregation("sum of marks")).toBe("sum");
      expect(detectAggregation("unique board_name")).toBe("count_unique");
      expect(detectAggregation("median attendance")).toBe("median");
      expect(detectAggregation("just show gender")).toBeNull();
    });
  });

  describe("findColumnMatch", () => {
    it("fuzzy matches columns in schema profile", () => {
      expect(findColumnMatch("gender", profile)).toBe("gender");
      expect(findColumnMatch("marks", profile)).toBe("marks_10th");
      expect(findColumnMatch("board", profile)).toBe("board_name");
      expect(findColumnMatch("attendance", profile)).toBe("attendance_pct");
      expect(findColumnMatch("nonexistent", profile)).toBeNull();
    });
  });

  describe("categorizeSchemaColumns", () => {
    it("correctly categorizes columns into types", () => {
      const categories = categorizeSchemaColumns(profile);
      expect(categories.metrics).toContain("marks_10th");
      expect(categories.metrics).toContain("attendance_pct");
      expect(categories.categories).toContain("gender");
      expect(categories.categories).toContain("board_name");
    });
  });

  describe("normalizeChartAction", () => {
    it("populates both x/xKey and y/yKey consistent formats", () => {
      const action = {
        type: "bar",
        xKey: "gender",
        y: "marks_10th",
        aggregation: "avg",
      };
      const normalized = normalizeChartAction(action);
      expect(normalized.x).toBe("gender");
      expect(normalized.xKey).toBe("gender");
      expect(normalized.y).toBe("marks_10th");
      expect(normalized.yKey).toBe("marks_10th");
      expect(normalized.chart_type).toBe("bar");
    });
  });

  describe("parseCustomChartQuery (Edge Cases)", () => {
    // 1. Pie chart of categorical column
    it("Case 1: parses pie chart of Gender", () => {
      const action = parseCustomChartQuery("Create pie chart of Gender", profile);
      expect(action).toMatchObject({
        action: "create_chart",
        chart_type: "pie",
        x: "gender",
        y: "count",
        aggregation: "count",
      });
    });

    // 2. Bar chart variation
    it("Case 2: parses bar chart of Gender vs board_name", () => {
      const action = parseCustomChartQuery("Show bar chart of board_name vs gender", profile);
      expect(action).toMatchObject({
        action: "create_chart",
        chart_type: "bar",
        x: "board_name",
        y: "gender",
        aggregation: "count",
      });
    });

    // 3. Histogram of numeric column
    it("Case 3: parses histogram of Marks[10th]", () => {
      const action = parseCustomChartQuery("Show Marks[10th] distribution", profile);
      expect(action).toMatchObject({
        action: "create_chart",
        chart_type: "histogram",
        x: "marks_10th",
      });
    });

    // 4. Comparison chart
    it("Case 4: parses relationship of marks[10th] by gender", () => {
      const action = parseCustomChartQuery("How does marks[10th] vary by gender?", profile);
      expect(action).toMatchObject({
        action: "create_chart",
        chart_type: "bar",
        x: "gender",
        y: "marks_10th",
        aggregation: "avg",
      });
    });

    // 5. Explicit average aggregation on numeric column by category
    it("Case 5: parses average marks_10th by gender as bar", () => {
      const action = parseCustomChartQuery("average marks_10th by gender", profile);
      expect(action).toMatchObject({
        action: "create_chart",
        chart_type: "bar",
        x: "gender",
        y: "marks_10th",
        aggregation: "avg",
      });
    });

    // 6. Filter intent
    it("Case 6: parses filter query", () => {
      const action = parseCustomChartQuery("filter gender = Female", profile);
      expect(action).toMatchObject({
        action: "filter",
        filters: { gender: "Female" },
      });
    });

    // 7. KPI sum query
    it("Case 7: parses KPI sum query", () => {
      const action = parseCustomChartQuery("total marks_10th", profile);
      expect(action).toMatchObject({
        action: "create_kpi",
        metric: "marks_10th",
        aggregation: "sum",
      });
    });

    // 8. Scatter chart between two metrics
    it("Case 8: parses scatter plot of marks vs attendance", () => {
      const action = parseCustomChartQuery("scatter marks vs attendance", profile);
      expect(action).toMatchObject({
        action: "create_chart",
        chart_type: "scatter",
        x: "marks_10th",
        y: "attendance_pct",
      });
    });

    // 9. KPI average query
    it("Case 9: parses KPI average query", () => {
      const action = parseCustomChartQuery("average attendance_pct", profile);
      expect(action).toMatchObject({
        action: "create_kpi",
        metric: "attendance_pct",
        aggregation: "avg",
      });
    });

    // 10. Fallback for unresolvable/complex query
    it("Case 10: returns null for unresolvable or generic request to fall back to AI", () => {
      const action = parseCustomChartQuery("Build dashboard automatically", profile);
      expect(action).toBeNull();
    });
  });
});
