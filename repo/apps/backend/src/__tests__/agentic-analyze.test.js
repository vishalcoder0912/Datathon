import { describe, expect, it, vi, afterEach } from "vitest";
import { handleAgenticApiRoutes } from "../routes/agentic-api.js";
import { makeReq, makeRes } from "./test-helpers.js";

// Mock the orchestrator
vi.mock("../services/agentic-dashboard/unified-dashboard-orchestrator.js", () => ({
  generateUnifiedDashboard: vi.fn(async (dataset, options) => {
    // Assert that the dataset passed to orchestrator has rows and columns
    if (!dataset || !dataset.rows || !dataset.columns) {
      throw new Error("Dataset is empty!");
    }
    return {
      ok: true,
      dashboard: {
        kpis: [{ title: "Total Records", metric: "__row_count__", aggregation: "count" }],
        charts: []
      },
      message: "Generated dashboard action list safely."
    };
  })
}));

describe("Agentic Analyze API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/agentic/analyze loads dataset and outputs correct schema-safe structure", async () => {
    const request = makeReq("POST", {
      goal: "Show average salary by country",
      dataset: {
        name: "Mock Salaries",
        columns: [
          { name: "country", type: "string" },
          { name: "salary_usd", type: "number" }
        ],
        rows: [
          { country: "India", salary_usd: 60000 },
          { country: "USA", salary_usd: 120000 }
        ]
      }
    });

    const response = makeRes();
    const handled = await handleAgenticApiRoutes(request, response, "/api/agentic/analyze");

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.schemaOnly).toBe(true);
    expect(body.data.profile).toBeDefined();
    // Ensure raw rows are not inside the profile returned to frontend
    expect(body.data.profile.rows).toBeUndefined();
    expect(body.data.dashboardAction.response_type).toBe("dashboard_action");
  });
});
