import { describe, expect, it } from "vitest";
import { interpretCommand } from "@/features/dashboard/utils/commandCenterAnalytics";

const rows = [
  { country: "India", salary_usd: 50000, experience: 2 },
  { country: "USA", salary_usd: 90000, experience: 5 },
  { country: "India", salary_usd: 65000, experience: 3 },
  { country: "Canada", salary_usd: 120000, experience: 8 },
];

describe("ChatInterface local command options", () => {
  it("turns a bare numeric threshold into a useful default prompt instruction", () => {
    const command = interpretCommand("75000", rows);

    expect(command).toMatchObject({
      auditLabel: "Answered dataset question",
    });
    expect(command?.message).toContain("I can create charts, KPIs");
  });

  it("maps generic chart options to a schema-aware chart", () => {
    const command = interpretCommand("Generate Chart", rows);

    expect(command.chart).toBeDefined();
    expect(command.chart).toMatchObject({
      type: "horizontalBar",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
    });
  });

  it("answers general summary/explanation prompts locally", () => {
    const command = interpretCommand("Explain data quality", rows);

    expect(command).toMatchObject({
      auditLabel: "Generated explanation",
    });
    expect(command?.message).toContain("Salary Usd averages");
    expect(command?.message).toContain("across 4 records");
  });
});
