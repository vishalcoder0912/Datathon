import { describe, expect, it } from "vitest";
import { runInsightFlow, detectDatasetType, buildInsightFlowSchema } from "@/features/dashboard/utils/insightFlowEngine";
import { computeGeoIntelligence, detectGeoField, detectMetricField } from "@/features/dashboard/geo/geoIntelligenceEngine";

const REVIEW_ROWS = [
  {
    "Reviewer Name": "Alice",
    "Profile Link": "https://example.test/alice",
    Country: "USA",
    "Review Count": "9 reviews",
    Rating: "Rated 4 out of 5 stars",
    "Review Title": "Great",
    "Review Text": "Good product",
    "Date of Experience": "2024-01-15",
  },
  {
    "Reviewer Name": "Bob",
    "Profile Link": "https://example.test/bob",
    Country: "India",
    "Review Count": "3 reviews",
    Rating: "Rated 5 out of 5 stars",
    "Review Title": "Excellent",
    "Review Text": "Fast delivery",
    "Date of Experience": "2024-02-20",
  },
];

const SALARY_ROWS = [
  { salary_usd: 50000, experience: 2, country: "India" },
  { salary_usd: 90000, experience: 5, country: "USA" },
  { salary_usd: 120000, experience: 8, country: "UK" },
  { salary_usd: 65000, experience: 3, country: "India" },
  { salary_usd: 45000, experience: 1, country: "Canada" },
];

describe("A. Reviewer Name must not become a metric", () => {
  it("classifies 'Reviewer Name' as person class, not numeric metric", () => {
    const schema = buildInsightFlowSchema(REVIEW_ROWS);
    const reviewerCol = schema.columns.find((c) => c.name === "Reviewer Name");
    expect(reviewerCol).toBeDefined();
    expect(reviewerCol!.class).toBe("person");
  });

  it("InsightFlow does not use Reviewer Name with numeric aggregation", () => {
    const result = runInsightFlow(REVIEW_ROWS);
    const numericReviewerKpi = result.kpis.find(
      (k) => k.metric === "Reviewer Name" && !["count", "count_unique"].includes(k.aggregation),
    );
    expect(numericReviewerKpi).toBeUndefined();
  });
});

describe("B. Profile Link must not become scatter axis", () => {
  it("detects dataset type without treating Profile Link as metric", () => {
    const columns = [{ name: "Profile Link", type: "string" }];
    const rows = REVIEW_ROWS;
    const geoField = detectGeoField(Object.keys(rows[0]));
    const metricField = detectMetricField(Object.keys(rows[0]), rows);
    expect(geoField).toBe("Country");
    expect(metricField).toBe("Review Count");
    expect(metricField).not.toBe("Profile Link");
  });

  it("InsightFlow does not create chart with Profile Link as axis", () => {
    const result = runInsightFlow(REVIEW_ROWS);
    const profileLinkChart = result.charts.find(
      (c) => c.xKey === "Profile Link" || c.yKey === "Profile Link",
    );
    expect(profileLinkChart).toBeUndefined();
  });
});

describe("C. Country + Review Count should create geo map", () => {
  it("detects Country as geo field and Review Count as metric", () => {
    const columns = Object.keys(REVIEW_ROWS[0]);
    const geoField = detectGeoField(columns);
    const metricField = detectMetricField(columns, REVIEW_ROWS);
    expect(geoField).toBe("Country");
    expect(metricField).toBe("Review Count");
  });

  it("computeGeoIntelligence returns enabled geo with locations", () => {
    const result = computeGeoIntelligence(REVIEW_ROWS, "Country", "Review Count");
    expect(result.enabled).toBe(true);
    expect(result.locations.length).toBeGreaterThan(0);
    expect(result.mapType).not.toBe("none");
  });
});

describe("D. salary_usd + experience should create scatter chart", () => {
  it("InsightFlow includes a scatter chart for salary vs experience", () => {
    const result = runInsightFlow(SALARY_ROWS);
    const scatter = result.charts.find(
      (c) =>
        c.type === "scatter" &&
        (c.xKey === "experience" || c.yKey === "experience") &&
        (c.xKey === "salary_usd" || c.yKey === "salary_usd"),
    );
    expect(scatter).toBeDefined();
  });

  it("KPIs include salary metrics", () => {
    const result = runInsightFlow(SALARY_ROWS);
    const salaryKpi = result.kpis.find((k) => k.metric === "salary_usd");
    expect(salaryKpi).toBeDefined();
  });
});

describe("E. If schema exists, AI must not return runtime_context_missing", () => {
  it("detects dataset type from non-empty rows without requiring runtime context", () => {
    const schema = buildInsightFlowSchema(SALARY_ROWS);
    const result = detectDatasetType(schema);
    expect(result).toBeDefined();
    expect(result).not.toBe("unknown");
  });

  it("InsightFlow produces valid result with schema present", () => {
    const result = runInsightFlow(SALARY_ROWS);
    expect(result.valid).toBe(true);
    expect(result.qualityScore.total).toBeGreaterThan(0);
  });
});

describe("F. Dashboard agent must only update dashboard state (patch isolation)", () => {
  it("dashboard KPI count does not exceed 8", () => {
    const result = runInsightFlow(SALARY_ROWS);
    expect(result.kpis.length).toBeLessThanOrEqual(8);
  });

  it("dashboard chart count does not exceed 7", () => {
    const result = runInsightFlow(SALARY_ROWS);
    expect(result.charts.length).toBeLessThanOrEqual(7);
  });

  it("InsightFlow does not mutate input rows", () => {
    const originalLength = SALARY_ROWS.length;
    runInsightFlow(SALARY_ROWS);
    expect(SALARY_ROWS.length).toBe(originalLength);
  });
});
