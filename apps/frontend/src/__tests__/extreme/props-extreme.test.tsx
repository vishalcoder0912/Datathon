import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import KPICard from "@/features/dashboard/components/KPICard";

describe("KPICard extreme props", () => {
  it("handles null/undefined KPI gracefully", () => {
    const kpi = {
      id: "kpi-null",
      title: null as unknown as string,
      value: null as unknown as string,
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    const { container } = render(<KPICard kpi={kpi} index={0} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("handles very long strings as title", () => {
    const kpi = {
      id: "kpi-long",
      title: "A".repeat(1000),
      value: "$100",
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    render(<KPICard kpi={kpi} index={0} />);
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("handles emoji text in title", () => {
    const kpi = {
      id: "kpi-emoji",
      title: "💰 Revenue 📈 Growth 🚀",
      value: "🔥 $500K 🔥",
      businessKpi: true,
      icon: "dollar",
      change: 50,
      trend: "up" as const,
      metric: "revenue",
      aggregation: "sum",
    };

    render(<KPICard kpi={kpi} index={0} />);
    expect(screen.getByText(/Revenue/)).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("handles HTML injection in title", () => {
    const kpi = {
      id: "kpi-xss",
      title: "<script>alert('xss')</script>Revenue",
      value: "$100",
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    const { container } = render(<KPICard kpi={kpi} index={0} />);
    expect(container.textContent).toContain("Revenue");
    expect(container.textContent).toContain("<script>");
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("handles RTL and Unicode text", () => {
    const kpi = {
      id: "kpi-rtl",
      title: "الإيرادات",
      value: "١٢٣٤٥",
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    render(<KPICard kpi={kpi} index={0} />);
    expect(screen.getByText("الإيرادات")).toBeInTheDocument();
    expect(screen.getByText("١٢٣٤٥")).toBeInTheDocument();
  });

  it("handles negative numbers where positive expected", () => {
    const kpi = {
      id: "kpi-neg",
      title: "Loss",
      value: "-$5,000",
      businessKpi: true,
      icon: "dollar",
      change: -25,
      trend: "down" as const,
      metric: "profit",
      aggregation: "sum",
    };

    render(<KPICard kpi={kpi} index={0} />);
    expect(screen.getByText("-$5,000")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("handles Infinity and NaN in value", () => {
    const kpi = {
      id: "kpi-inf",
      title: "Infinite Growth",
      value: Infinity.toString(),
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    const { container } = render(<KPICard kpi={kpi} index={0} />);
    expect(container.firstChild).not.toBeNull();

    const kpiNan = {
      id: "kpi-nan",
      title: "Undefined",
      value: NaN.toString(),
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    const { container: c2 } = render(<KPICard kpi={kpiNan} index={1} />);
    expect(c2.firstChild).not.toBeNull();
  });

  it("handles deeply nested objects in KPI data", () => {
    const kpi = {
      id: "kpi-deep",
      title: "Deep Data",
      value: "complex",
      businessKpi: true,
      icon: "dollar",
      change: 10,
      trend: "up" as const,
      metric: "revenue",
      aggregation: "sum",
      nested: {
        level1: {
          level2: {
            level3: "deep",
          },
        },
      },
    } as never;

    const { container } = render(<KPICard kpi={kpi as never} index={0} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("handles zero-width characters in text", () => {
    const kpi = {
      id: "kpi-zwc",
      title: "Rev\u200Benue",
      value: "$0",
      businessKpi: true,
      icon: "dollar",
      metric: "revenue",
      aggregation: "sum",
    };

    render(<KPICard kpi={kpi} index={0} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
  });
});

describe("SmartChartCard extreme props", () => {
  it("handles empty data array", async () => {
    const { default: SmartChartCard } = await import("@/features/dashboard/components/SmartChartCard");
    const chart = {
      id: "chart-empty",
      title: "Empty",
      type: "bar" as const,
      xKey: "x",
      yKey: "y",
      aggregation: "count" as const,
      data: [],
    };

    render(<SmartChartCard chart={chart} />);
    expect(screen.getByText(/Not enough data/)).toBeInTheDocument();
  });

  it("handles large data arrays", async () => {
    const { default: SmartChartCard } = await import("@/features/dashboard/components/SmartChartCard");
    const data = Array.from({ length: 1000 }, (_, i) => ({
      category: `item-${i}`,
      value: Math.random() * 1000,
    }));

    const chart = {
      id: "chart-large",
      title: "Large Dataset",
      type: "bar" as const,
      xKey: "category",
      yKey: "value",
      aggregation: "sum" as const,
      data,
    };

    const { container } = render(<SmartChartCard chart={chart} />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe("ErrorBoundary extreme props", () => {
  it("catches errors with deeply nested children", async () => {
    const { ErrorBoundary } = await import("@/shared/components/ErrorBoundary");
    const originalError = console.error;
    console.error = vi.fn();

    function DeepNest({ depth }: { depth: number }) {
      if (depth <= 0) throw new Error("Bottom crash");
      return <DeepNest depth={depth - 1} />;
    }

    render(
      <ErrorBoundary>
        <DeepNest depth={100} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Bottom crash")).toBeInTheDocument();

    console.error = originalError;
  });
});
