import { useCallback, useEffect, useState } from "react";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";
import type {
  ChartCustomizationOptions,
  ChartAction,
  ChartOperationResult,
} from "@/features/dashboard/types/chartManagementTypes";

const chartsMatch = (left: PremiumChart[], right: PremiumChart[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  return left.every((chart, index) => {
    const other = right[index];
    return (
      other &&
      chart.id === other.id &&
      chart.title === other.title &&
      chart.type === other.type &&
      chart.subtitle === other.subtitle &&
      chart.xKey === other.xKey &&
      chart.yKey === other.yKey &&
      chart.data.length === other.data.length
    );
  });
};

const setsMatch = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
};

export function useChartManager(initialCharts: PremiumChart[]) {
  const [charts, setCharts] = useState<PremiumChart[]>(initialCharts);
  const [history, setHistory] = useState<ChartAction[]>([]);
  const [visibleCharts, setVisibleCharts] = useState<Set<string>>(
    new Set(initialCharts.map((c) => c.id))
  );
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);

  useEffect(() => {
    const nextVisibleCharts = new Set(initialCharts.map((chart) => chart.id));

    setCharts((currentCharts) => (chartsMatch(currentCharts, initialCharts) ? currentCharts : initialCharts));
    setVisibleCharts((currentVisibleCharts) =>
      setsMatch(currentVisibleCharts, nextVisibleCharts) ? currentVisibleCharts : nextVisibleCharts,
    );
    setSelectedChartId((currentChartId) => (currentChartId && nextVisibleCharts.has(currentChartId) ? currentChartId : null));
  }, [initialCharts]);

  const saveToHistory = useCallback((action: ChartAction) => {
    setHistory((prev) => [...prev, action]);
  }, []);

  const addChart = useCallback(
    (
      chart: PremiumChart,
      saveToHist = true
    ): ChartOperationResult => {
      try {
        setCharts((prev) => [...prev, chart]);
        setVisibleCharts((prev) => new Set([...prev, chart.id]));
        setSelectedChartId(chart.id);

        if (saveToHist) {
          saveToHistory({
            type: "add",
            chartId: chart.id,
            chartData: {
              ...chart,
              data: chart.data,
            },
            timestamp: Date.now(),
          });
        }

        return {
          success: true,
          chartId: chart.id,
          message: `Chart "${chart.title}" added successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add chart",
          message: "Failed to add chart",
        };
      }
    },
    [saveToHistory]
  );

  const removeChart = useCallback(
    (chartId: string, saveToHist = true): ChartOperationResult => {
      try {
        const chart = charts.find((c) => c.id === chartId);
        if (!chart) {
          return {
            success: false,
            error: "Chart not found",
            message: "Chart not found",
          };
        }

        setCharts((prev) => prev.filter((c) => c.id !== chartId));
        setVisibleCharts((prev) => {
          const next = new Set(prev);
          next.delete(chartId);
          return next;
        });

        if (selectedChartId === chartId) {
          setSelectedChartId(null);
        }

        if (saveToHist) {
          saveToHistory({
            type: "remove",
            chartId,
            previousState: chart,
            timestamp: Date.now(),
          });
        }

        return {
          success: true,
          message: `Chart "${chart.title}" removed successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to remove chart",
          message: "Failed to remove chart",
        };
      }
    },
    [charts, selectedChartId, saveToHistory]
  );

  const updateChart = useCallback(
    (chartId: string, updates: Partial<PremiumChart>, saveToHist = true): ChartOperationResult => {
      try {
        const chartIndex = charts.findIndex((c) => c.id === chartId);
        if (chartIndex === -1) {
          return {
            success: false,
            error: "Chart not found",
            message: "Chart not found",
          };
        }

        const previousState = charts[chartIndex];
        const updatedChart = { ...previousState, ...updates };

        setCharts((prev) => {
          const next = [...prev];
          next[chartIndex] = updatedChart;
          return next;
        });

        if (saveToHist) {
          saveToHistory({
            type: "update",
            chartId,
            chartData: updatedChart,
            previousState,
            timestamp: Date.now(),
          });
        }

        return {
          success: true,
          chartId,
          message: `Chart "${previousState.title}" updated successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update chart",
          message: "Failed to update chart",
        };
      }
    },
    [charts, saveToHistory]
  );

  const duplicateChart = useCallback(
    (chartId: string): ChartOperationResult => {
      try {
        const chart = charts.find((c) => c.id === chartId);
        if (!chart) {
          return {
            success: false,
            error: "Chart not found",
            message: "Chart not found",
          };
        }

        const newChart: PremiumChart = {
          ...chart,
          id: `${chart.id}-copy-${Date.now()}`,
          title: `${chart.title} (Copy)`,
        };

        return addChart(newChart, true);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to duplicate chart",
          message: "Failed to duplicate chart",
        };
      }
    },
    [charts, addChart]
  );

  const toggleChartVisibility = useCallback((chartId: string): ChartOperationResult => {
    try {
      setVisibleCharts((prev) => {
        const next = new Set(prev);
        if (next.has(chartId)) {
          next.delete(chartId);
        } else {
          next.add(chartId);
        }
        return next;
      });

      const chart = charts.find((c) => c.id === chartId);
      return {
        success: true,
        message: `Chart "${chart?.title}" visibility toggled`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle visibility",
        message: "Failed to toggle visibility",
      };
    }
  }, [charts]);

  const reorderCharts = useCallback((chartIds: string[]): ChartOperationResult => {
    try {
      const reorderedCharts = chartIds
        .map((id) => charts.find((c) => c.id === id))
        .filter((chart) => chart !== undefined) as PremiumChart[];

      setCharts(reorderedCharts);
      return {
        success: true,
        message: "Charts reordered successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reorder charts",
        message: "Failed to reorder charts",
      };
    }
  }, [charts]);

  const getChartById = useCallback(
    (chartId: string) => charts.find((c) => c.id === chartId),
    [charts]
  );

  const getVisibleCharts = useCallback(() => {
    return charts.filter((c) => visibleCharts.has(c.id));
  }, [charts, visibleCharts]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    // Implement undo logic based on history
  }, [history]);

  const redo = useCallback(() => {
    // Implement redo logic
  }, []);

  return {
    charts,
    visibleCharts,
    selectedChartId,
    setSelectedChartId,
    history,
    addChart,
    removeChart,
    updateChart,
    duplicateChart,
    toggleChartVisibility,
    reorderCharts,
    getChartById,
    getVisibleCharts,
    undo,
    redo,
  };
}
