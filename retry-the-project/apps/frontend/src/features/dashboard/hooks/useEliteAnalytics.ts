import { useMemo } from "react";
import type { Dataset, KPI } from "@/features/data/model/dataStore";
import { buildAnalyticsDashboard } from "@/features/data/model/analyticsEngine";

export interface EliteAnalyticsResult {
  kpis: KPI[];
  insights: string[];
  predictions: {
    salaryAt10Years: number | null;
    growthRate: number;
  };
  anomalies: {
    outlierCount: number;
    extremeHigh: number;
    extremeLow: number;
  };
  segments: {
    Junior: number;
    Mid: number;
    Senior: number;
  };
  distribution: {
    mean: number;
    median: number;
    skew: number;
  };
  correlation: number | null;
}

export const useEliteAnalytics = (data: Dataset | null): EliteAnalyticsResult => {
  return useMemo(() => {
    if (!data) {
      return {
        kpis: [],
        insights: [],
        predictions: { salaryAt10Years: null, growthRate: 0 },
        anomalies: { outlierCount: 0, extremeHigh: 0, extremeLow: 0 },
        segments: { Junior: 0, Mid: 0, Senior: 0 },
        distribution: { mean: 0, median: 0, skew: 0 },
        correlation: null,
      };
    }

    const analyticsBundle = buildAnalyticsDashboard(data);

    return {
      kpis: analyticsBundle.kpis,
      insights: analyticsBundle.insights,
      predictions: { salaryAt10Years: null, growthRate: 0 },
      anomalies: { outlierCount: 0, extremeHigh: 0, extremeLow: 0 },
      segments: { Junior: 0, Mid: 0, Senior: 0 },
      distribution: { mean: 0, median: 0, skew: 0 },
      correlation: null,
    };
  }, [data]);
};