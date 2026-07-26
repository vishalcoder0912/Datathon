import { describe, expect, it, vi } from "vitest";
import { handleInsightFlowRoutes } from "../routes/insight-flow.js";
import { makeReq, makeRes } from "./test-helpers.js";

vi.mock("../genai/analyticsEngine.js", () => {
  return {
    default: class MockAnalyticsEngine {
      async analyzeDatasetStructure(dataset) {
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

const geoSalaryDataset = {
  name: "Salary Small with Country",
  columns: ["job_title", "experience_level", "country", "salary_usd", "remote_ratio", "work_year"],
  rows: [
    { "job_title": "Data Scientist", "experience_level": "Mid", "country": "India", "salary_usd": 50000, "remote_ratio": 100, "work_year": 2024 },
    { "job_title": "ML Engineer", "experience_level": "Senior", "country": "USA", "salary_usd": 90000, "remote_ratio": 50, "work_year": 2024 },
    { "job_title": "Data Analyst", "experience_level": "Entry", "country": "India", "salary_usd": 35000, "remote_ratio": 0, "work_year": 2023 }
  ]
};

const noGeoDataset = {
  name: "No Geo Dataset",
  columns: ["job_title", "experience_level", "salary_usd"],
  rows: [
    { "job_title": "Data Scientist", "experience_level": "Mid", "salary_usd": 50000 },
    { "job_title": "ML Engineer", "experience_level": "Senior", "salary_usd": 90000 }
  ]
};

describe("Geo Intelligence Schema Tests", () => {
  it("detects and ranks locations when a country field exists", async () => {
    const response = makeRes();
    const body = {
      rows: geoSalaryDataset.rows,
      columns: geoSalaryDataset.columns
    };

    const handled = await handleInsightFlowRoutes(
      makeReq("POST", body),
      response,
      "/api/insight-flow/analyze"
    );

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const data = response.json().data;

    expect(data.geoIntelligence).toBeDefined();
    // Verify geo is enabled since we have "country"
    expect(data.geoIntelligence.enabled).toBe(true);
    expect(data.geoIntelligence.field).toBe("country");
  });

  it("gracefully disables geo intelligence when no country or region is present", async () => {
    const response = makeRes();
    const body = {
      rows: noGeoDataset.rows,
      columns: noGeoDataset.columns
    };

    const handled = await handleInsightFlowRoutes(
      makeReq("POST", body),
      response,
      "/api/insight-flow/analyze"
    );

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const data = response.json().data;

    expect(data.geoIntelligence).toBeDefined();
    expect(data.geoIntelligence.enabled).toBe(false);
    expect(data.geoIntelligence.topLocation).toBeNull();
  });
});
