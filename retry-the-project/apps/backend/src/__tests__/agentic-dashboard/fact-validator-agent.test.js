import { describe, expect, it } from "vitest";
import { validateChatAnswer } from "../../services/agentic-dashboard/fact-validator-agent.js";

describe("agentic dashboard fact validator", () => {
  it("guards unavailable business metrics in chat answers", () => {
    const result = validateChatAnswer({
      answer: "Revenue increased across all departments.",
      schemaProfile: {
        columns: [
          { name: "department", title: "Department" },
          { name: "headcount", title: "Headcount" },
        ],
      },
      dashboard: {
        kpis: [{ title: "Total Records", metric: "__row_count__" }],
        charts: [{ title: "Headcount by Department", xKey: "department", yKey: "headcount" }],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.answer).toContain("cannot be determined");
  });
});
