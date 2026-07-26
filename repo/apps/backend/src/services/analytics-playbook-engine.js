import { randomUUID } from "node:crypto";
import { detectDomain } from "./domain-detector.js";
import {
  createColumnSignature,
  findSimilarPlaybook,
  saveAnalyticsMemory,
} from "./analytics-memory-service.js";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function humanize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectColumns(rows = [], dictionary = {}) {
  const first = rows[0] || {};

  return Object.keys(first).map((name) => {
    const values = rows.map((r) => r[name]).filter((v) => v !== null && v !== undefined && v !== "");
    const numericCount = values.filter((v) => safeNumber(v) !== null).length;
    const uniqueCount = new Set(values.map(String)).size;

    let type = "string";
    let role = "dimension";

    if (values.length && numericCount / values.length > 0.75) {
      type = "number";
      role = "metric";
    }

    if (/date|time|month|year|created|updated/i.test(name)) {
      type = "date";
      role = "date";
    }

    if (/id|uuid|email|phone|password|token|secret/i.test(name)) {
      role = "id";
    }

    const meta = dictionary[name] || {};

    return {
      name,
      type: meta.type || type,
      role,
      description: meta.description || "",
      uniqueCount,
      nullCount: rows.length - values.length,
    };
  });
}

function parseDictionary(metadataFiles = []) {
  const dictionary = {};

  for (const file of metadataFiles) {
    for (const row of file.rows || []) {
      const columnName =
        row.column ||
        row.column_name ||
        row.field ||
        row.field_name ||
        row.name ||
        row.Column ||
        row["Column Name"];

      if (!columnName) continue;

      dictionary[String(columnName)] = {
        description:
          row.description ||
          row.Description ||
          row.meaning ||
          row.Meaning ||
          "",
        type: row.type || row.Type || "",
        target:
          String(row.target || row.Target || "").toLowerCase() === "true" ||
          String(row.type || "").toLowerCase() === "target",
      };
    }
  }

  return dictionary;
}

function groupBy(rows, xKey, yKey, aggregation = "sum", limit = 10) {
  const map = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown");
    const value = aggregation === "count" ? 1 : safeNumber(row[yKey]);

    if (aggregation !== "count" && value === null) continue;

    const stat = map.get(label) || {
      sum: 0,
      count: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
    };

    stat.sum += value;
    stat.count += 1;
    stat.min = Math.min(stat.min, value);
    stat.max = Math.max(stat.max, value);

    map.set(label, stat);
  }

  return [...map.entries()]
    .map(([label, stat]) => {
      let value = stat.sum;

      if (aggregation === "avg") value = stat.count ? stat.sum / stat.count : 0;
      if (aggregation === "count") value = stat.count;
      if (aggregation === "min") value = stat.min;
      if (aggregation === "max") value = stat.max;

      return {
        [xKey]: label,
        [yKey === "count" ? "count" : yKey]: Number(value.toFixed(2)),
      };
    })
    .sort((a, b) => {
      const key = yKey === "count" ? "count" : yKey;
      return Number(b[key]) - Number(a[key]);
    })
    .slice(0, limit);
}

function columnExists(rows, key) {
  return !!key && rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], key);
}

function buildChartFromTemplate(rows, template) {
  if (!columnExists(rows, template.xKey)) return null;

  if (template.yKey !== "count" && !columnExists(rows, template.yKey)) {
    return null;
  }

  const aggregation = template.aggregation || "sum";
  const yKey = aggregation === "count" ? "count" : template.yKey;

  return {
    id: randomUUID(),
    type: template.type || "bar",
    title: template.title,
    xKey: template.type === "histogram" ? "range" : template.xKey,
    yKey: template.type === "histogram" ? "count" : yKey,
    aggregation,
    learned: true,
    data:
      template.type === "histogram"
        ? histogram(rows, template.yKey || template.xKey, 10)
        : groupBy(rows, template.xKey, template.yKey, aggregation, 10),
  };
}

function buildKpiFromTemplate(rows, template) {
  if (template.aggregation === "count") {
    return {
      title: template.title || "Total Records",
      value: rows.length.toLocaleString(),
      metric: template.metric || "*",
      aggregation: "count",
      learned: true,
    };
  }

  if (!columnExists(rows, template.metric)) return null;

  const values = rows
    .map((row) => safeNumber(row[template.metric]))
    .filter((value) => value !== null);

  if (!values.length) return null;

  let value = values.reduce((sum, next) => sum + next, 0);

  if (template.aggregation === "avg") value /= values.length;
  if (template.aggregation === "median") value = median(values);
  if (template.aggregation === "min") value = Math.min(...values);
  if (template.aggregation === "max") value = Math.max(...values);

  return {
    title: template.title,
    value: Number(value.toFixed(2)).toLocaleString(),
    metric: template.metric,
    aggregation: template.aggregation,
    learned: true,
  };
}

function histogram(rows, key, bucketCount = 10) {
  const values = rows.map((r) => safeNumber(r[key])).filter((v) => v !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / bucketCount || 1;

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start = min + i * step;
    const end = i === bucketCount - 1 ? max : start + step;

    return {
      range: `${Math.round(start)}-${Math.round(end)}`,
      count: 0,
    };
  });

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), bucketCount - 1);
    buckets[index].count += 1;
  }

  return buckets;
}

function median(values) {
  const nums = values.filter((v) => v !== null).sort((a, b) => a - b);
  if (!nums.length) return 0;

  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function topValue(rows, key) {
  const map = new Map();

  for (const row of rows) {
    const value = String(row[key] ?? "").trim();
    if (!value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }

  return [...map.entries()].sort((a, b) => b[1] - a[1])[0] || ["N/A", 0];
}

function buildSalaryKpis(rows, columns) {
  const salaryKey = columns.find((c) => /salary/i.test(c.name))?.name || "salary_usd";
  const values = rows.map((r) => safeNumber(r[salaryKey])).filter((v) => v !== null);

  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? total / values.length : 0;

  const [topCountry] = topValue(rows, "country");
  const [topEducation] = topValue(rows, "education");
  const [topExperience] = topValue(rows, "experience");
  const [topLanguage] = topValue(rows, "languages");
  const [topFramework] = topValue(rows, "frameworks");

  return [
    { title: "Total Records", value: rows.length.toLocaleString(), metric: "*", aggregation: "count", icon: "rows" },
    { title: "Average Salary", value: `$${Math.round(avg).toLocaleString()}`, metric: salaryKey, aggregation: "avg", icon: "salary" },
    { title: "Median Salary", value: `$${Math.round(median(values)).toLocaleString()}`, metric: salaryKey, aggregation: "median", icon: "salary" },
    { title: "Highest Salary", value: `$${Math.max(...values).toLocaleString()}`, metric: salaryKey, aggregation: "max", icon: "salary" },
    { title: "Top Country", value: topCountry, metric: "country", aggregation: "top", icon: "globe" },
    { title: "Top Education", value: topEducation, metric: "education", aggregation: "top", icon: "education" },
    { title: "Common Experience", value: topExperience, metric: "experience", aggregation: "top", icon: "briefcase" },
    { title: "Top Language", value: topLanguage, metric: "languages", aggregation: "top", icon: "code" },
    { title: "Top Framework", value: topFramework, metric: "frameworks", aggregation: "top", icon: "framework" },
  ];
}

function chart(type, title, xKey, yKey, data, aggregation = "sum") {
  return {
    id: randomUUID(),
    type,
    title,
    xKey,
    yKey,
    aggregation,
    data,
  };
}

function buildSalaryCharts(rows) {
  const salary = "salary_usd";

  return [
    chart("bar", "Average Salary by Country", "country", salary, groupBy(rows, "country", salary, "avg", 10), "avg"),
    chart("bar", "Average Salary by Experience", "experience", salary, groupBy(rows, "experience", salary, "avg", 10), "avg"),
    chart("bar", "Average Salary by Education", "education", salary, groupBy(rows, "education", salary, "avg", 10), "avg"),
    chart("bar", "Average Salary by Company Size", "company_size", salary, groupBy(rows, "company_size", salary, "avg", 10), "avg"),
    chart("bar", "Count by Country", "country", "count", groupBy(rows, "country", "count", "count", 10), "count"),
    chart("histogram", "Salary Distribution", salary, salary, histogram(rows, salary, 10), "count"),
    chart("bar", "Top Languages", "languages", "count", groupBy(rows, "languages", "count", "count", 10), "count"),
    chart("bar", "Top Frameworks", "frameworks", "count", groupBy(rows, "frameworks", "count", "count", 10), "count"),
  ];
}

function buildGenericKpis(rows, columns) {
  const metric = columns.find((c) => c.role === "metric");
  const dimension = columns.find((c) => c.role === "dimension");

  const kpis = [
    { title: "Total Records", value: rows.length.toLocaleString(), metric: "*", aggregation: "count", icon: "rows" },
    { title: "Columns", value: columns.length.toLocaleString(), metric: "*", aggregation: "count", icon: "columns" },
  ];

  if (metric) {
    const values = rows.map((r) => safeNumber(r[metric.name])).filter((v) => v !== null);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;

    kpis.push({ title: `Total ${humanize(metric.name)}`, value: total.toFixed(2), metric: metric.name, aggregation: "sum", icon: "metric" });
    kpis.push({ title: `Average ${humanize(metric.name)}`, value: avg.toFixed(2), metric: metric.name, aggregation: "avg", icon: "metric" });
  }

  if (dimension) {
    const [top] = topValue(rows, dimension.name);
    kpis.push({ title: `Top ${humanize(dimension.name)}`, value: top, metric: dimension.name, aggregation: "top", icon: "category" });
  }

  return kpis;
}

function buildGenericCharts(rows, columns) {
  const metric = columns.find((c) => c.role === "metric");
  const dimension = columns.find((c) => c.role === "dimension");
  const date = columns.find((c) => c.role === "date");

  const charts = [];

  if (metric && dimension) {
    charts.push(
      chart(
        "bar",
        `${humanize(metric.name)} by ${humanize(dimension.name)}`,
        dimension.name,
        metric.name,
        groupBy(rows, dimension.name, metric.name, "sum", 10),
        "sum"
      )
    );

    charts.push(
      chart(
        "pie",
        `Count by ${humanize(dimension.name)}`,
        dimension.name,
        "count",
        groupBy(rows, dimension.name, "count", "count", 8),
        "count"
      )
    );
  }

  if (metric) {
    charts.push(
      chart(
        "bar",
        `${humanize(metric.name)} Distribution`,
        "range",
        "count",
        histogram(rows, metric.name, 10),
        "count"
      )
    );
  }

  if (metric && date) {
    charts.push(
      chart(
        "line",
        `${humanize(metric.name)} Trend`,
        date.name,
        metric.name,
        groupBy(rows, date.name, metric.name, "sum", 20),
        "sum"
      )
    );
  }

  return charts;
}

export function buildAnalyticsPlaybook({ dataset, metadataFiles = [], testFiles = [] }) {
  const dictionary = parseDictionary(metadataFiles);
  const rows = dataset.rows || [];
  const columns = detectColumns(rows, dictionary);
  const domainInfo = detectDomain(columns, dictionary);
  const columnSignature = createColumnSignature(columns);
  const rememberedPlaybook = findSimilarPlaybook({
    domain: domainInfo.domain,
    columnSignature,
  });

  let kpis = [];
  let charts = [];

  if (domainInfo.domain === "salary_hr_jobs") {
    kpis = buildSalaryKpis(rows, columns);
    charts = buildSalaryCharts(rows);
  } else {
    kpis = buildGenericKpis(rows, columns);
    charts = buildGenericCharts(rows, columns);
  }

  if (rememberedPlaybook) {
    const learnedCharts = (rememberedPlaybook.chartTemplates || [])
      .map((template) => buildChartFromTemplate(rows, template))
      .filter(Boolean);

    const learnedKpis = (rememberedPlaybook.kpiTemplates || [])
      .map((template) => buildKpiFromTemplate(rows, template))
      .filter(Boolean);

    if (learnedCharts.length) {
      charts = [...learnedCharts, ...charts].slice(0, 8);
    }

    if (learnedKpis.length) {
      kpis = [...learnedKpis, ...kpis].slice(0, 8);
    }
  }

  saveAnalyticsMemory({
    domain: domainInfo.domain,
    columnSignature,
    kpiTemplates: kpis.map((kpi) => ({
      title: kpi.title,
      metric: kpi.metric,
      aggregation: kpi.aggregation,
      dimension: kpi.dimension,
    })),
    chartTemplates: charts.map((chartItem) => ({
      title: chartItem.title,
      type: chartItem.type,
      xKey: chartItem.xKey,
      yKey: chartItem.yKey,
      aggregation: chartItem.aggregation || "sum",
    })),
  });

  return {
    dataType: domainInfo.domain,
    dataTypeLabel: domainInfo.label,
    chartRecommendations: charts,
    kpis,
    memory: {
      usedPreviousPattern: Boolean(rememberedPlaybook),
      similarity: rememberedPlaybook?.similarity || 0,
      domain: domainInfo.domain,
      columnSignature,
    },
    insights: [
      {
        type: "summary",
        title: "Dataset Summary",
        message: `Analyzed ${rows.length.toLocaleString()} rows from ${dataset.fileName || dataset.name}.`,
      },
      {
        type: "metadata",
        title: "Metadata Usage",
        message: metadataFiles.length
          ? `Used ${metadataFiles.map((f) => f.fileName || f.name).join(", ")} as schema metadata.`
          : "No metadata dictionary found.",
      },
      {
        type: "test_data",
        title: "Test Dataset",
        message: testFiles.length
          ? `${testFiles.map((f) => f.fileName || f.name).join(", ")} available for prediction/scoring.`
          : "No test dataset detected.",
      },
    ],
    aiInsights: {
      domain: domainInfo,
      memory: {
        usedPreviousPattern: Boolean(rememberedPlaybook),
        similarity: rememberedPlaybook?.similarity || 0,
        domain: domainInfo.domain,
        columnSignature,
      },
      schemaPacket: {
        rowCount: rows.length,
        columnCount: columns.length,
        columns,
      },
      kpis,
      relatedDatasets: {
        metadataFiles: metadataFiles.map((f) => f.fileName || f.name),
        testFiles: testFiles.map((f) => f.fileName || f.name),
      },
    },
  };
}
