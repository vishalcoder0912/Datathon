import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSafeSchemaPacket,
  callSchemaOnlyLLMPlanner,
  executeChartPlan,
  validateChartPlan,
} from "../schema-only-dashboard-engine.js";

describe("schema-only dashboard engine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dataset = {
    id: "dataset-1",
    name: "Sensitive Upload",
    rowCount: 3,
    columns: [
      { name: "email", type: "string" },
      { name: "full_name", type: "string" },
      { name: "api_token", type: "string" },
      { name: "department", type: "string" },
      { name: "sales", type: "number" },
    ],
    rows: [
      {
        email: "alice@example.com",
        full_name: "Alice Secret",
        api_token: "sk_live_SECRET_TOKEN_123456789", // audit-ignore: secret-leak
        department: "Sales",
        sales: 100,
      },
      {
        email: "bob@example.com",
        full_name: "Bob Hidden",
        api_token: "sk_live_SECRET_TOKEN_987654321", // audit-ignore: secret-leak
        department: "Support",
        sales: 200,
      },
      {
        email: "carol@example.com",
        full_name: "Carol Private",
        api_token: "sk_live_SECRET_TOKEN_555555555", // audit-ignore: secret-leak
        department: "Sales",
        sales: 50,
      },
    ],
  };

  it("sends only the safe schema packet to the LLM", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requestBody = String(init?.body || "");
      return {
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              action: "GENERATE_CHART",
              chart: {
                type: "bar",
                xKey: "department",
                yKey: "sales",
                aggregation: "sum",
                title: "Sales by Department",
              },
            }),
          },
        }),
      };
    }));

    const schemaPacket = await buildSafeSchemaPacket(dataset);
    await callSchemaOnlyLLMPlanner(schemaPacket, "create a chart");

    expect(requestBody).toContain("Safe schema packet");
    expect(requestBody).not.toContain('"rows"');
    expect(requestBody).not.toContain("alice@example.com");
    expect(requestBody).not.toContain("Alice Secret");
    expect(requestBody).not.toContain("sk_live_SECRET_TOKEN");
    expect(schemaPacket.columns.find((column) => column.name === "email")?.allowedForAI).toBe(false);
    expect(schemaPacket.columns.find((column) => column.name === "api_token")?.topValues).toEqual([]);
  });

  it("validates and executes chart plans locally", async () => {
    const schemaPacket = await buildSafeSchemaPacket(dataset);
    const plan = {
      type: "bar",
      xKey: "department",
      yKey: "sales",
      aggregation: "sum",
      limit: 10,
      title: "Sales by Department",
    };

    expect(validateChartPlan(schemaPacket, plan)).toEqual({ ok: true });
    const chart = executeChartPlan(dataset, plan);

    expect(chart.data).toEqual([
      { department: "Sales", sales: 150 },
      { department: "Support", sales: 200 },
    ].sort((left, right) => right.sales - left.sales));
  });
});
