import { afterEach, describe, expect, it, vi } from "vitest";
import { runDashboardCriticAgent } from "../../services/agentic-dashboard/dashboard-critic-agent.js";
import { runOllamaValidatorAgent } from "../../services/agentic-dashboard/ollama-validator-agent.js";
import { generateUnifiedDashboard } from "../../services/agentic-dashboard/unified-dashboard-orchestrator.js";
import { runDashboardCommand } from "../../services/ai-analyst/schema-trained-ai-service.js";

const salaryDataset = {
  name: "Salary",
  columns: ["country", "salary_usd", "experience"],
  rows: [
    { country: "US", salary_usd: 90000, experience: 5 },
    { country: "USA", salary_usd: 120000, experience: 8 },
    { country: "India", salary_usd: 50000, experience: 2 },
  ],
};

const basePlan = {
  schemaOnly: true,
  datasetName: "Governed",
  domain: "generic",
  semanticProfile: {
    columns: [
      { name: "country", type: "string", semanticRole: "geo_country" },
      { name: "salary_usd", type: "number", semanticRole: "money_metric" },
      { name: "experience", type: "number", semanticRole: "continuous_metric" },
    ],
  },
  ontology: {},
  kpis: [],
  charts: [],
  geo: {},
  insights: [],
  story: {},
  ragMatches: [],
};

describe("agentic dashboard governance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds governance approval to generated dashboards", async () => {
    const result = await generateUnifiedDashboard(salaryDataset, { useRagEmbedding: false });

    expect(result.governance.status).toBe("APPROVED");
    expect(result.governance.approvedForRender).toBe(true);
    expect(result.ollamaValidator.verdict).toBe("PASS");
    expect(result.data.dashboard.kpis.length).toBeGreaterThan(0);
  });

  it("critic rejects fake KPIs and row-index trends", () => {
    const critic = runDashboardCriticAgent({
      ...basePlan,
      kpis: [
        {
          id: "fake",
          title: "AI Revenue Index",
          metric: "salary_usd",
          sourceColumn: "salary_usd",
          aggregation: "avg",
          format: "number",
          confidence: 0.9,
        },
      ],
      charts: [
        {
          id: "row-trend",
          type: "line",
          title: "Salary Trend by Row Index",
          xKey: "__row_index__",
          yKey: "salary_usd",
          aggregation: "avg",
          intent: "trend",
          confidence: 0.9,
        },
      ],
    });

    expect(critic.valid).toBe(false);
    expect(critic.issues.some((issue) => issue.type === "fake_kpi")).toBe(true);
    expect(critic.issues.some((issue) => issue.reason.includes("Row index"))).toBe(true);
  });

  it("governs custom chart commands before render", async () => {
    const command = await runDashboardCommand({
      dataset: salaryDataset,
      query: "Show salary by country",
      useLlm: false,
    });

    expect(command.action).toBe("GENERATE_CHART");
    expect(command.approvedForRender).toBe(true);
    expect(command.governance.status).toBe("APPROVED");
  });

  it("uses mocked Ollama validator as final PASS authority when required", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          verdict: "PASS",
          reasons: ["KPI and chart specs are grounded."],
          confidence: 0.97,
        }),
      }),
    })));

    const result = await runOllamaValidatorAgent({
      artifact: {
        kpis: [
          {
            id: "avg-salary",
            title: "Average Salary",
            metric: "salary_usd",
            sourceColumn: "salary_usd",
            aggregation: "avg",
            format: "currency",
            confidence: 1,
          },
        ],
        charts: [],
      },
      artifactType: "dashboard",
      schemaProfile: {
        columns: [{ name: "salary_usd", type: "number", role: "money_metric" }],
      },
      requireOllama: true,
    });

    expect(result.provider).toBe("ollama-validator");
    expect(result.verdict).toBe("PASS");
    expect(result.passed).toBe(true);
  });
});
