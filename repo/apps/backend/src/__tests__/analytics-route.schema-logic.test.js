import { describe, expect, it, vi } from "vitest";
import { handleInsightFlowRoutes } from "../routes/insight-flow.js";
import { handleHealthRoutes } from "../routes/health.js";
import { makeReq, makeRes } from "./test-helpers.js";

vi.mock("../genai/analyticsEngine.js", () => {
  return {
    default: class MockAnalyticsEngine {
      async analyzeDatasetStructure(dataset) {
        if (typeof dataset.columns === "number") {
          throw new TypeError("columns must be an array");
        }
        const columns = dataset.columns || [];
        const isGeo = columns.includes("country") || columns.includes("region");
        return {
          dataset_domain: "Sales Domain",
          fact_entity: "Orders",
          dimensions: columns.filter(c => ["region", "category", "country"].includes(c)),
          measures: columns.filter(c => ["revenue", "profit", "discount", "quantity", "salary_usd"].includes(c)),
          geo_dimensions: isGeo ? (columns.includes("country") ? ["country"] : ["region"]) : [],
          time_columns: columns.filter(c => c.includes("date")),
          recommended_kpis: [],
          recommended_visualizations: []
        };
      }

      async generateKPIs(schema, dataset) {
        return [
          { name: "Total Revenue", description: "Sum of revenue", formula: "SUM(revenue)", business_value: "Overall scale" },
          { name: "Average Profit", description: "Mean profit", formula: "AVG(profit)", business_value: "Efficiency" }
        ];
      }

      async generateVisualizations(schema, dataset) {
        return [
          { type: "bar", title: "Revenue by Region", dimensions: ["region"], measures: ["revenue"], aggregation: "SUM", insight: "Show sales" }
        ];
      }

      async buildExecutiveDashboard(schema, kpis, visualizations) {
        return {
          title: "Executive Overview",
          domain: schema.dataset_domain,
          layout: { sections: ["Overview"] },
          filters: [{ name: "Region Filter", type: "category", dimension: "region" }]
        };
      }

      async generateAIInsights(schema, dataset) {
        return [
          { type: "trend", insight: "Sales trend is upward", data_points: {}, business_impact: "Positive growth" }
        ];
      }
    }
  };
});

const salesDataset = {
  name: "Sales Small",
  columns: ["order_id", "order_date", "region", "category", "revenue", "profit", "discount", "quantity"],
  rows: [
    { "order_id": "ORD001", "order_date": "2024-01-15", "region": "North", "category": "Office", "revenue": 1200, "profit": 300, "discount": 0.05, "quantity": 12 },
    { "order_id": "ORD002", "order_date": "2024-01-18", "region": "South", "category": "Tech", "revenue": 1800, "profit": 450, "discount": 0.10, "quantity": 18 },
    { "order_id": "ORD003", "order_date": "2024-02-05", "region": "North", "category": "Tech", "revenue": 900, "profit": 180, "discount": 0.00, "quantity": 9 }
  ]
};

describe("InsightFlow Analytics routes", () => {
  it("GET /api/health responds with active status", async () => {
    const response = makeRes();
    const handled = await handleHealthRoutes(makeReq("GET"), response, "/api/health");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("healthy");
  });

  it("POST /api/insight-flow/analyze returns logically correct shape for sales dataset", async () => {
    const response = makeRes();
    const body = {
      rows: salesDataset.rows,
      columns: salesDataset.columns,
    };
    const handled = await handleInsightFlowRoutes(makeReq("POST", body), response, "/api/insight-flow/analyze");
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);

    const data = response.json();
    expect(data.success).toBe(true);
    expect(data.data.valid).toBe(true);
    expect(data.data.kpis).toBeDefined();
    expect(data.data.charts).toBeDefined();
    expect(data.data.qualityScore).toBeDefined();

    expect(data.data.kpis.length).toBeGreaterThan(0);
    expect(data.data.charts.length).toBeGreaterThan(0);
  });

  it("POST /api/insight-flow/validate performs self-critic check", async () => {
    const response = makeRes();
    const validationPayload = {
      charts: [
        { title: "Revenue by Region", type: "bar", xKey: "region", yKey: "revenue", intent: "comparison" }
      ],
      kpis: [
        { title: "Total Revenue", metric: "revenue", aggregation: "sum" }
      ],
      geoIntelligence: { enabled: true, metricField: "revenue" },
      schema: { columns: salesDataset.columns }
    };

    const handled = await handleInsightFlowRoutes(
      makeReq("POST", validationPayload),
      response,
      "/api/insight-flow/validate"
    );

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.success).toBe(true);
    expect(data.data.score).toBeDefined();
    expect(data.data.passed).toBeDefined();
  });

  it("returns clean error shapes and never exposes raw stack traces", async () => {
    const response = makeRes();
    // Pass columns as a non-iterable number, causing analyzeDatasetStructure to throw TypeError
    const handled = await handleInsightFlowRoutes(
      makeReq("POST", { rows: salesDataset.rows, columns: 123 }),
      response,
      "/api/insight-flow/analyze"
    );

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(500);
    const data = response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
    expect(data.error.message).toBeDefined();
    expect(data.error.stack).toBeUndefined(); // Stack trace should not be exposed
  });
});
