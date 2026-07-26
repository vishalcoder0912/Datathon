import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChartManager } from "@/features/dashboard/hooks/useChartManager";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

const makeChart = (): PremiumChart => ({
  id: "chart-1",
  title: "Revenue",
  type: "bar",
  data: [{ label: "A", value: 1 }],
  xKey: "label",
  yKey: "value",
});

describe("useChartManager", () => {
  it("does not loop when rerendered with a new empty chart array", () => {
    const { result, rerender } = renderHook(({ charts }) => useChartManager(charts), {
      initialProps: { charts: [] as PremiumChart[] },
    });

    rerender({ charts: [] });

    expect(result.current.charts).toEqual([]);
    expect(result.current.getVisibleCharts()).toEqual([]);
  });

  it("keeps equivalent chart input stable across rerenders", () => {
    const { result, rerender } = renderHook(({ charts }) => useChartManager(charts), {
      initialProps: { charts: [makeChart()] },
    });

    rerender({ charts: [makeChart()] });

    expect(result.current.charts).toHaveLength(1);
    expect(result.current.getVisibleCharts()[0]?.id).toBe("chart-1");
  });
});
