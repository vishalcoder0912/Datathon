import { describe, expect, it } from "vitest";
import { validateDashboardActions } from "../services/guardian/dashboard-guardian.js";

describe("Dashboard Guardian Validator", () => {
  const schemaPacket = {
    columns: [
      { name: "country", type: "string" },
      { name: "salary_usd", type: "number" },
      { name: "education", type: "string" }
    ],
    numericColumns: ["salary_usd"],
    categoricalColumns: ["country", "education"]
  };

  it("blocks missing columns", () => {
    const actions = [
      { action: "create_chart", chart_type: "bar", x: "country", y: "nonexistent", aggregation: "avg" }
    ];
    const result = validateDashboardActions(schemaPacket, {}, actions);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].reason).toContain("does not exist");
  });

  it("allows valid chart: x=country, y=salary_usd, aggregation=avg, chart_type=bar", () => {
    const actions = [
      { action: "create_chart", chart_type: "bar", x: "country", y: "salary_usd", aggregation: "avg", title: "Avg Salary by Country" }
    ];
    const result = validateDashboardActions(schemaPacket, {}, actions);
    expect(result.valid).toBe(true);
    expect(result.validatedActions.length).toBe(1);
  });

  it("blocks invalid chart: x=country, y=education, aggregation=avg (y must be numeric for avg aggregation)", () => {
    const actions = [
      { action: "create_chart", chart_type: "bar", x: "country", y: "education", aggregation: "avg", title: "Invalid Chart" }
    ];
    const result = validateDashboardActions(schemaPacket, {}, actions);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].reason).toContain("incompatible with columns");
  });

  it("allows clear_charts action", () => {
    const actions = [
      { action: "clear_charts" }
    ];
    const result = validateDashboardActions(schemaPacket, {}, actions);
    expect(result.valid).toBe(true);
    expect(result.validatedActions.length).toBe(1);
    expect(result.validatedActions[0].action).toBe("clear_charts");
  });
});
