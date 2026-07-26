import { describe, expect, it } from "vitest";
import { generateUnifiedDashboard } from "../../services/agentic-dashboard/unified-dashboard-orchestrator.js";
import { runDashboardCriticAgent } from "../../services/agentic-dashboard/dashboard-critic-agent.js";

describe("unified dashboard orchestrator", () => {
  it("generates a compatible schema-only dashboard response", async () => {
    const result = await generateUnifiedDashboard(
      {
        name: "Salary",
        columns: ["country", "salary_usd", "experience"],
        rows: [
          { country: "India", salary_usd: 50000, experience: 2 },
          { country: "USA", salary_usd: 90000, experience: 5 },
        ],
      },
      { useRagEmbedding: false }
    );

    expect(result.ok).toBe(true);
    expect(result.data.schemaOnly).toBe(true);
    expect(result.data.dashboard.kpis.length).toBeGreaterThan(0);
    expect(result.data.dashboard.charts.every((chart) => chart.intent)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("\"rows\"");
  });

  it("rejects wrong memory KPI specs through the critic", () => {
    const critic = runDashboardCriticAgent({
      schemaOnly: true,
      datasetName: "Healthcare",
      domain: "healthcare",
      semanticProfile: {
        columns: [
          { name: "patient_id", type: "string" },
          { name: "diagnosis", type: "string" },
        ],
      },
      ontology: {},
      kpis: [
        {
          id: "bad-kpi",
          title: "Total Revenue",
          metric: "revenue",
          sourceColumn: "revenue",
          aggregation: "sum",
          format: "currency",
          confidence: 0.9,
        },
      ],
      charts: [],
      geo: {},
      insights: [],
      story: {},
      ragMatches: [],
    });

    expect(critic.valid).toBe(false);
    expect(critic.cleanedPlan.kpis).toEqual([]);
    expect(critic.issues.some((issue) => issue.type === "invalid_kpi")).toBe(true);
  });
});
