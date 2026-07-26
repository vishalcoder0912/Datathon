const DEFAULT_LARGE_DATASET_ROW_THRESHOLD = 50_000;

function largeDatasetThreshold() {
  const value = Number(process.env.LARGE_DATASET_ROW_THRESHOLD || DEFAULT_LARGE_DATASET_ROW_THRESHOLD);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LARGE_DATASET_ROW_THRESHOLD;
}

export function chooseAnalyticsExecutionPolicy(dataset = {}) {
  const rowCount = Number(
    dataset.rowCount ||
    dataset.totalRows ||
    dataset.rows?.length ||
    dataset.metadata?.rowCount ||
    0
  );

  if (rowCount >= largeDatasetThreshold()) {
    return {
      mode: "fast-analytics-service",
      engine: process.env.FAST_ANALYTICS_ENGINE || "duckdb",
      reason: "Large dataset detected. Use Python ML service with DuckDB.",
      allowLLMRawRows: false,
      allowFrontendRawRows: false,
      maxPreviewRows: 1000,
      rowCount,
      threshold: largeDatasetThreshold(),
    };
  }

  return {
    mode: "local-js",
    engine: "node",
    reason: "Small/medium dataset can use existing local calculation.",
    allowLLMRawRows: false,
    allowFrontendRawRows: true,
    maxPreviewRows: 5000,
    rowCount,
    threshold: largeDatasetThreshold(),
  };
}

export function shouldUseFastAnalytics(dataset = {}) {
  return chooseAnalyticsExecutionPolicy(dataset).mode === "fast-analytics-service";
}

export default {
  chooseAnalyticsExecutionPolicy,
  shouldUseFastAnalytics,
};
