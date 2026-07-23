import { describe, expect, it } from "vitest";
import { buildSchemaProfile } from "../../services/ai-analyst/schema-fingerprint.js";
import { runSemanticAgent } from "../../services/agentic-dashboard/semantic-agent.js";
import { runKpiAgent } from "../../services/agentic-dashboard/kpi-agent.js";

function kpisFor(dataset) {
  const schemaProfile = buildSchemaProfile(dataset);
  const semanticProfile = runSemanticAgent(schemaProfile);
  return runKpiAgent({ schemaProfile, semanticProfile, ontology: { domain: schemaProfile.domain } });
}

describe("agentic dashboard KPI agent", () => {
  it("keeps salary datasets focused on salary KPIs", () => {
    const kpis = kpisFor({
      name: "Salary",
      columns: ["country", "salary_usd", "experience_years"],
      rows: [
        { country: "India", salary_usd: 50000, experience_years: 2 },
        { country: "USA", salary_usd: 90000, experience_years: 5 },
      ],
    });

    expect(kpis.some((kpi) => /revenue|profit|order/i.test(kpi.title))).toBe(false);
    expect(kpis.filter((kpi) => kpi.sourceColumn === "salary_usd").map((kpi) => kpi.aggregation)).toEqual([
      "avg",
      "median",
      "max",
    ]);
  });

  it("only creates sales KPIs for columns that exist", () => {
    const kpis = kpisFor({
      name: "Sales",
      columns: ["region", "revenue", "orders"],
      rows: [
        { region: "North", revenue: 100, orders: 2 },
        { region: "South", revenue: 250, orders: 5 },
      ],
    });

    expect(kpis.some((kpi) => /revenue/i.test(kpi.title))).toBe(true);
    expect(kpis.some((kpi) => /orders/i.test(kpi.title))).toBe(true);
    expect(kpis.some((kpi) => /profit/i.test(kpi.title))).toBe(false);
  });

  it("does not invent revenue KPIs for healthcare schemas", () => {
    const kpis = kpisFor({
      name: "Healthcare",
      columns: ["patient_id", "diagnosis", "age"],
      rows: [
        { patient_id: "p1", diagnosis: "A", age: 42 },
        { patient_id: "p2", diagnosis: "B", age: 51 },
      ],
    });

    expect(kpis.some((kpi) => /revenue|sales|profit/i.test(kpi.title))).toBe(false);
  });

  it("does not create fake metric KPIs when no numeric columns exist", () => {
    const kpis = kpisFor({
      name: "Text Only",
      columns: ["name", "department"],
      rows: [
        { name: "A", department: "Ops" },
        { name: "B", department: "Sales" },
      ],
    });

    expect(kpis.every((kpi) => kpi.metric === "__row_count__" || kpi.aggregation === "count_unique")).toBe(true);
    expect(kpis.some((kpi) => /^Average|^Maximum/.test(kpi.title))).toBe(false);
  });
});
