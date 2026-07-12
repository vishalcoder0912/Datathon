import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SchemaTrainingStatus } from "../components/SchemaTrainingStatus";

describe("DashboardGuardianWarning", () => {
  it("renders Guardian warning section when validation fails", () => {
    const result = {
      message: "Plan generated with issues",
      profile: { rowCount: 10, columnCount: 3 },
      dashboardSpec: { kpis: [], charts: [] },
      guardian: {
        valid: false,
        errors: [
          "Column 'salary_usd' is not numeric or does not exist",
          "Chart type 'bar' incompatible with columns"
        ]
      }
    };

    render(<SchemaTrainingStatus loading={false} result={result} />);

    expect(screen.getByText("Guardian warnings:")).toBeInTheDocument();
    expect(screen.getByText("Column 'salary_usd' is not numeric or does not exist")).toBeInTheDocument();
    expect(screen.getByText("Chart type 'bar' incompatible with columns")).toBeInTheDocument();
  });

  it("does not render warnings when validation succeeds", () => {
    const result = {
      message: "Plan generated successfully",
      profile: { rowCount: 10, columnCount: 3 },
      dashboardSpec: { kpis: [], charts: [] },
      guardian: {
        valid: true,
        errors: []
      }
    };

    render(<SchemaTrainingStatus loading={false} result={result} />);

    expect(screen.queryByText("Guardian warnings:")).toBeNull();
  });
});
