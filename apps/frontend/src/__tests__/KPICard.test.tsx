import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KPICard from "@/features/dashboard/components/KPICard";

describe("KPICard", () => {
  it("renders the KPI title, value, and change percentage", () => {
    const kpi = {
      id: "kpi-1",
      title: "Average Salary",
      value: "$75,000",
      businessKpi: true,
      icon: "dollar",
      change: 12.5,
      trend: "up" as const,
      metric: "salary_usd",
      aggregation: "avg"
    };

    render(<KPICard kpi={kpi} index={0} />);

    expect(screen.getByText("Average Salary")).toBeInTheDocument();
    expect(screen.getByText("$75,000")).toBeInTheDocument();
    expect(screen.getByText("12.5%")).toBeInTheDocument();
  });

  it("does not render when businessKpi is false/undefined", () => {
    const kpi = {
      id: "kpi-2",
      title: "Hidden KPI",
      value: "100",
      icon: "rows",
      metric: "count",
      aggregation: "count"
    };

    const { container } = render(<KPICard kpi={kpi} index={1} />);
    expect(container.firstChild).toBeNull();
  });
});
