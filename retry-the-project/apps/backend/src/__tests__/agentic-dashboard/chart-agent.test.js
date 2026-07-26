import { describe, expect, it } from "vitest";
import { buildSchemaProfile } from "../../services/ai-analyst/schema-fingerprint.js";
import { runSemanticAgent } from "../../services/agentic-dashboard/semantic-agent.js";
import { runChartAgent } from "../../services/agentic-dashboard/chart-agent.js";
import { DashboardPlanSchema } from "../../services/agentic-dashboard/dashboard-schemas.js";

function chartsFor(dataset) {
  const schemaProfile = buildSchemaProfile(dataset);
  const semanticProfile = runSemanticAgent(schemaProfile);
  return runChartAgent({ schemaProfile, semanticProfile, ontology: { domain: schemaProfile.domain }, kpis: [] });
}

describe("agentic dashboard chart agent", () => {
  it("emits map charts only when geo columns exist", () => {
    const geoCharts = chartsFor({
      name: "Geo Sales",
      columns: ["country", "revenue"],
      rows: [
        { country: "India", revenue: 100 },
        { country: "USA", revenue: 200 },
      ],
    });

    const nonGeoCharts = chartsFor({
      name: "Product Sales",
      columns: ["product", "revenue"],
      rows: [
        { product: "A", revenue: 100 },
        { product: "B", revenue: 200 },
      ],
    });

    expect(geoCharts.some((chart) => chart.intent === "geo" && chart.type === "map")).toBe(true);
    expect(nonGeoCharts.some((chart) => chart.intent === "geo" || chart.type === "map")).toBe(false);
  });

  it("rejects invalid chart intent through Zod", () => {
    const invalidPlan = {
      schemaOnly: true,
      datasetName: "Invalid",
      domain: "generic",
      semanticProfile: {},
      ontology: {},
      kpis: [],
      charts: [
        {
          id: "chart-1",
          type: "bar",
          title: "Bad",
          xKey: "category",
          yKey: "value",
          aggregation: "sum",
          intent: "made_up",
          confidence: 0.8,
        },
      ],
      geo: {},
      insights: [],
      story: {},
      ragMatches: [],
    };

    expect(() => DashboardPlanSchema.parse(invalidPlan)).toThrow();
  });
});
