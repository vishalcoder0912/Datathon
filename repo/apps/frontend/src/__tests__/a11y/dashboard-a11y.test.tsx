import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import KPICard from "@/features/dashboard/components/KPICard";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import ProviderStatusPanel from "@/features/dashboard/components/ProviderStatusPanel";

describe("KPI Card a11y", () => {
  it("renders with accessible heading hierarchy", () => {
    const kpi = {
      id: "kpi-1",
      title: "Revenue",
      value: "$1.2M",
      businessKpi: true,
      icon: "dollar",
      change: 15.3,
      trend: "up" as const,
      metric: "revenue",
      aggregation: "sum",
    };

    render(<KPICard kpi={kpi} index={0} />);

    const title = screen.getByText("Revenue");
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe("P");

    const value = screen.getByText("$1.2M");
    expect(value).toBeInTheDocument();
  });

  it("renders change indicator with proper label", () => {
    const kpi = {
      id: "kpi-2",
      title: "Users",
      value: "12,500",
      businessKpi: true,
      icon: "star",
      change: -5.2,
      trend: "down" as const,
      metric: "users",
      aggregation: "count",
    };

    render(<KPICard kpi={kpi} index={1} />);

    const changeEl = screen.getByText("5.2%");
    expect(changeEl).toBeInTheDocument();
  });
});

describe("Chart Card a11y", () => {
  it("has accessible chart title and interactive controls", () => {
    const chart = {
      id: "chart-1",
      title: "Sales by Quarter",
      type: "bar" as const,
      xKey: "quarter",
      yKey: "sales",
      aggregation: "sum" as const,
      data: [
        { quarter: "Q1", sales: 100 },
        { quarter: "Q2", sales: 150 },
      ],
    };

    render(
      <SmartChartCard
        chart={chart}
        onTypeChange={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    expect(screen.getByText("Sales by Quarter")).toBeInTheDocument();
    const combobox = screen.getByRole("combobox", { name: /edit chart type/i });
    expect(combobox).toBeInTheDocument();
  });

  it("renders empty state with accessible message", () => {
    const chart = {
      id: "chart-empty",
      title: "Empty Chart",
      type: "bar" as const,
      xKey: "x",
      yKey: "y",
      aggregation: "count" as const,
      data: [],
    };

    render(<SmartChartCard chart={chart} />);

    expect(screen.getByText(/Not enough data/)).toBeInTheDocument();
  });

  it("shows chart warning with accessible alert", () => {
    const chart = {
      id: "chart-warn",
      title: "Warning Chart",
      type: "line" as const,
      xKey: "date",
      yKey: "value",
      aggregation: "avg" as const,
      data: [{ date: "Jan", value: 50 }],
      warning: "Some data points are missing",
    };

    render(<SmartChartCard chart={chart} />);

    expect(screen.getByText("Some data points are missing")).toBeInTheDocument();
  });
});

describe("Provider Status Panel a11y", () => {
  it("renders AI provider status with accessible labels", () => {
    render(
      <ProviderStatusPanel
        gemini={{ available: true }}
        ollama={{ available: true, missing_models: [] }}
        mode="hybrid_best"
      />,
    );

    expect(screen.getByText("Gemini Cloud")).toBeInTheDocument();
    expect(screen.getByText("Ollama Local")).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(2);
  });

  it("shows missing model warnings accessibly", () => {
    render(
      <ProviderStatusPanel
        gemini={{ available: true }}
        ollama={{ available: true, missing_models: ["qwen3:8b"] }}
        mode="hybrid"
      />,
    );

    expect(screen.getByText("Missing local models:")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b")).toBeInTheDocument();
  });
});
