import crypto from "node:crypto";
import { findColumn, safeNumber } from "./schema-profiler.js";

const BLOCKED_MAIN_KPI_TITLES = new Set([
  "attributes / columns",
  "numeric columns",
  "categorical columns",
  "missing values",
  "data quality score",
]);

function aggregate(values = [], aggregation = "count") {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");

  if (aggregation === "count") return present.length;
  if (aggregation === "count_unique") {
    return new Set(present.map((v) => String(v).trim().toLowerCase())).size;
  }

  const numbers = present.map(safeNumber).filter((v) => v !== null && Number.isFinite(v));
  if (!numbers.length) return null;

  if (aggregation === "sum") return numbers.reduce((a, b) => a + b, 0);
  if (aggregation === "avg") return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);

  if (aggregation === "median") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  if (aggregation === "p75") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.75) - 1;
    return sorted[Math.max(0, index)];
  }

  if (aggregation === "p25") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.25) - 1;
    return sorted[Math.max(0, index)];
  }

  return null;
}

function hasColumn(schema, name) {
  return schema.columns?.some((col) => col.name === name);
}

function isBlockedMainKpi(title) {
  return BLOCKED_MAIN_KPI_TITLES.has(String(title || "").trim().toLowerCase());
}

function makeKpi({ title, metric, aggregation, value, format = "number" }) {
  return {
    id: crypto.randomUUID(),
    title,
    metric,
    aggregation,
    rawValue: value,
    value: formatValue(value, format),
    format,
    businessKpi: true,
  };
}

function formatValue(value, format = "number") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";

  if (format === "currency") {
    return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  if (format === "percent") {
    return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }

  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function topGroupByAverage(rows, groupKey, metricKey) {
  const groups = new Map();

  rows.forEach((row) => {
    const group = row?.[groupKey];
    const metric = safeNumber(row?.[metricKey]);
    if (group === null || group === undefined || group === "" || metric === null) return;

    const key = String(group).trim();
    const current = groups.get(key) || { total: 0, count: 0 };
    current.total += metric;
    current.count += 1;
    groups.set(key, current);
  });

  return [...groups.entries()]
    .map(([name, stats]) => ({ name, average: stats.total / stats.count }))
    .sort((left, right) => right.average - left.average)[0]?.name || null;
}

export function buildSalaryBusinessKpis(rows, schema) {
  const required = ["salary_usd", "experience", "country"];
  const hasSalarySchema = required.every((col) => hasColumn(schema, col));

  if (!hasSalarySchema) return null;

  const salaryValues = rows.map((row) => row.salary_usd);
  const experienceValues = rows.map((row) => row.experience);
  const countries = rows.map((row) => row.country);
  const topPayingCountry = topGroupByAverage(rows, "country", "salary_usd");

  return [
    makeKpi({
      title: "Total Records",
      metric: "__row_count__",
      aggregation: "count",
      value: rows.length,
    }),
    makeKpi({
      title: "Average Salary",
      metric: "salary_usd",
      aggregation: "avg",
      value: aggregate(salaryValues, "avg"),
      format: "currency",
    }),
    makeKpi({
      title: "Median Salary",
      metric: "salary_usd",
      aggregation: "median",
      value: aggregate(salaryValues, "median"),
      format: "currency",
    }),
    makeKpi({
      title: "Highest Salary",
      metric: "salary_usd",
      aggregation: "max",
      value: aggregate(salaryValues, "max"),
      format: "currency",
    }),
    makeKpi({
      title: "Average Experience",
      metric: "experience",
      aggregation: "avg",
      value: aggregate(experienceValues, "avg"),
    }),
    makeKpi({
      title: "Countries",
      metric: "country",
      aggregation: "count_unique",
      value: aggregate(countries, "count_unique"),
    }),
    {
      id: crypto.randomUUID(),
      title: "Top Paying Country",
      metric: "country",
      aggregation: "top_by_avg",
      rawValue: topPayingCountry,
      value: topPayingCountry || "N/A",
      format: "text",
      businessKpi: true,
    },
  ];
}

function formatMetricValue(metricName, value, aggregation) {
  const name = String(metricName || "").toLowerCase();

  if (aggregation === "count_unique") {
    return Math.round(value).toLocaleString();
  }

  if (/salary|revenue|sales|amount|price|cost|profit|income|compensation/.test(name)) {
    return formatValue(value, "currency");
  }

  if (/rate|percent|margin|attendance/.test(name)) {
    return formatValue(value, "percent");
  }

  return formatValue(value, "number");
}

function buildKpiFromTemplate(rows, schema, template) {
  if (isBlockedMainKpi(template.title) || template.aggregation === "quality_score") {
    return null;
  }

  if (template.aggregation === "count") {
    return {
      id: crypto.randomUUID(),
      title: template.title,
      value: rows.length.toLocaleString(),
      rawValue: rows.length,
      metric: "__row_count__",
      aggregation: "count",
      businessKpi: true,
    };
  }

  if (template.aggregation === "count_unique") {
    const col =
      findColumn(schema, template.metricAliases || [], "dimension") ||
      findColumn(schema, template.metricAliases || [], "category") ||
      findColumn(schema, template.metricAliases || [], "location");

    if (!col) return null;

    const uniqueCount = aggregate(rows.map((row) => row[col.name]), "count_unique");

    return {
      id: crypto.randomUUID(),
      title: template.title,
      value: uniqueCount.toLocaleString(),
      rawValue: uniqueCount,
      metric: col.name,
      aggregation: "count_unique",
      businessKpi: true,
    };
  }

  const metric =
    findColumn(schema, template.metricAliases || [], "metric") ||
    (template.metricRole ? findColumn(schema, [], template.metricRole) : null) ||
    findColumn(schema, [], "metric");

  if (!metric) return null;

  const value = aggregate(
    rows.map((row) => row[metric.name]),
    template.aggregation
  );

  return {
    id: crypto.randomUUID(),
    title: template.title,
    value: formatMetricValue(metric.name, value, template.aggregation),
    rawValue: value,
    metric: metric.name,
    aggregation: template.aggregation,
    businessKpi: true,
  };
}

export function buildAutoKpis({ dataset, schema, playbook, memoryMatch }) {
  const rows = dataset.rows || [];
  const salaryKpis = buildSalaryBusinessKpis(rows, schema);
  if (salaryKpis) return salaryKpis;

  const baseKpis = (playbook.kpis || [])
    .map((template) => buildKpiFromTemplate(rows, schema, template))
    .filter(Boolean);

  const learnedKpis = (memoryMatch?.kpiTemplates || [])
    .map((template) =>
      buildKpiFromTemplate(rows, schema, {
        title: template.title,
        metricAliases: [template.metric],
        aggregation: template.aggregation,
      })
    )
    .filter(Boolean);

  const merged = [...learnedKpis, ...baseKpis];
  const seen = new Set();

  return merged
    .filter((kpi) => {
      if (!kpi.businessKpi || isBlockedMainKpi(kpi.title)) return false;
      if (seen.has(kpi.title)) return false;
      seen.add(kpi.title);
      return true;
    })
    .slice(0, 8);
}
