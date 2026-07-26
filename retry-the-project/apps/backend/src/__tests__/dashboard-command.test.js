import { describe, expect, it } from "vitest";
import { runDashboardCommand } from "../services/ai-analyst/schema-trained-ai-service.js";
import { salaryDataset } from "./test-helpers.js";

describe("dashboard command service", () => {
  it("creates schema-only KPI commands without local KPI values", async () => {
    const result = await runDashboardCommand({
      dataset: salaryDataset,
      query: "add KPI for highest salary_usd",
      useLlm: false,
    });

    expect(result.action).toBe("GENERATE_KPI");
    expect(result.kpiSpec).toMatchObject({ metric: "salary_usd", aggregation: "max" });
    expect(result.kpiSpec).not.toHaveProperty("value");
    expect(result.schemaOnly).toBe(true);
  });

  it("blocks raw data and hallucinated missing-data requests before provider routing", async () => {
    const rawRows = await runDashboardCommand({
      dataset: salaryDataset,
      query: "Show all 40,000 records",
      useLlm: true,
    });

    expect(rawRows.action).toBe("ANSWER");
    expect(rawRows.approvedForRender).toBe(false);
    expect(rawRows.message).toMatch(/cannot expose raw rows/i);

    const missingData = await runDashboardCommand({
      dataset: salaryDataset,
      query: "Assume missing data and continue",
      useLlm: true,
    });

    expect(missingData.action).toBe("ANSWER");
    expect(missingData.approvedForRender).toBe(false);
    expect(missingData.message).toMatch(/cannot assume missing data/i);
  });

  it("returns target metadata for delete chart commands and explicit delete-all actions", async () => {
    const deleteOne = await runDashboardCommand({
      dataset: salaryDataset,
      query: "Remove Average Salary by Country chart",
      useLlm: false,
    });

    expect(deleteOne.response_type).toBe("dashboard_action");
    expect(deleteOne.actions[0]).toMatchObject({
      action: "delete_chart",
      targetTitle: "Average Salary by Country",
    });

    const deleteAll = await runDashboardCommand({
      dataset: salaryDataset,
      query: "Delete all charts",
      useLlm: false,
    });

    expect(deleteAll.response_type).toBe("dashboard_action");
    expect(deleteAll.actions[0]).toMatchObject({ action: "delete_all_charts" });
  });
});
