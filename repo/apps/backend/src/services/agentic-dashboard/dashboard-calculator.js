import { safeNumber } from "../ai-analyst/schema-fingerprint.js";

function present(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function aggregate(values = [], aggregation = "count") {
  const clean = values.filter(present);
  if (aggregation === "count") return clean.length;
  if (aggregation === "count_unique") return new Set(clean.map((value) => String(value).trim().toLowerCase())).size;

  const numbers = clean.map(safeNumber).filter((value) => value !== null);
  if (!numbers.length) return 0;
  if (aggregation === "sum") return numbers.reduce((sum, value) => sum + value, 0);
  if (aggregation === "avg") return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);
  if (aggregation === "median") {
    const sorted = [...numbers].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return clean.length;
}

export function calculateDashboardValues(dataset = {}, dashboard = {}) {
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  return {
    kpis: (dashboard.kpis || []).map((kpi) => ({
      ...kpi,
      value: kpi.metric === "__row_count__"
        ? rows.length
        : aggregate(rows.map((row) => row[kpi.metric]), kpi.aggregation),
    })),
    charts: (dashboard.charts || []).map((chart) => ({
      ...chart,
      calculated: false,
      data: [],
    })),
  };
}
