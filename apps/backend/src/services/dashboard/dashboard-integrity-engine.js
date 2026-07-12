import { randomUUID } from "node:crypto";

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isMissing(value) {
  return value === null || value === undefined || value === "";
}

export function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "")
    .replace(/[,$₹%\s]/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateLike(value) {
  if (value instanceof Date) return true;
  if (typeof value !== "string") return false;
  if (!/\d/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function isPositiveLabel(value) {
  if (typeof value === "number") return value === 1;

  const text = String(value ?? "").toLowerCase().trim();

  return ["1", "yes", "true", "positive", "depressed", "high"].includes(text);
}

export function cleanRows(rows = []) {
  return rows.filter((row) => {
    const keys = Object.keys(row || {}).map(normalizeName);
    const source = String(row?._sourceFile || row?.source || "").toLowerCase();

    const dictionaryShape =
      keys.includes("column") &&
      keys.includes("type") &&
      keys.includes("description");

    return !source.includes("dictionary") && !dictionaryShape;
  });
}

export function inferColumns(rows = []) {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row || {})))].filter(
    (name) => !String(name).startsWith("__")
  );

  return names.map((name) => {
    const values = rows.map((row) => row[name]);
    const present = values.filter((value) => !isMissing(value)).slice(0, 250);

    let type = "string";

    if (present.length) {
      const numericCount = present.filter((value) => safeNumber(value) !== null).length;
      const dateCount = present.filter(isDateLike).length;

      if (numericCount / present.length >= 0.8) type = "number";
      else if (dateCount / present.length >= 0.8) type = "date";
    }

    return {
      name,
      normalizedName: normalizeName(name),
      type,
      role: type === "number" ? "metric" : type === "date" ? "date" : "dimension",
      uniqueCount: new Set(values.filter((value) => !isMissing(value)).map(String)).size,
      nullCount: values.filter(isMissing).length,
    };
  });
}

function findColumn(columns, aliases = [], role = null) {
  const normalizedAliases = aliases.map(normalizeName).filter(Boolean);

  const scored = columns
    .map((column) => {
      let score = 0;

      for (const alias of normalizedAliases) {
        if (column.normalizedName === alias) score += 20;
        else if (column.normalizedName.includes(alias)) score += 10;
        else if (alias.includes(column.normalizedName)) score += 4;
      }

      if (role && column.role === role) score += 2;

      return { column, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored[0]) return scored[0].column;
  if (role) return columns.find((column) => column.role === role) || null;

  return null;
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function aggregate(values = [], aggregation = "count") {
  const present = values.filter((value) => !isMissing(value));

  if (aggregation === "count") return present.length;

  const numbers = present.map(safeNumber).filter((value) => value !== null);

  if (!numbers.length) return 0;

  if (aggregation === "sum") return numbers.reduce((a, b) => a + b, 0);
  if (aggregation === "avg") return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupAggregate(rows, xKey, yKey, aggregation = "count", limit = 12) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(aggregation === "count" ? label : row[yKey]);
  }

  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [aggregation === "count" ? "count" : yKey]: round(aggregate(values, aggregation)),
    }))
    .sort((a, b) => Number(Object.values(b).at(-1)) - Number(Object.values(a).at(-1)))
    .slice(0, limit);
}

function groupPositiveRate(rows, xKey, yKey, limit = 12) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row[yKey]);
  }

  return [...groups.entries()]
    .map(([label, values]) => {
      const positives = values.filter(isPositiveLabel).length;
      const rate = values.length ? (positives / values.length) * 100 : 0;

      return {
        [xKey]: label,
        rate: round(rate),
      };
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}

function histogram(rows, key, bins = 7) {
  const values = rows
    .map((row) => safeNumber(row[key]))
    .filter((value) => value !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: String(min), count: values.length }];
  }

  const step = (max - min) / bins;

  const buckets = Array.from({ length: bins }, (_, index) => ({
    start: min + index * step,
    end: index === bins - 1 ? max : min + (index + 1) * step,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), bins - 1);
    buckets[index].count += 1;
  }

  return buckets.map((bucket) => ({
    range: `${Math.round(bucket.start)}-${Math.round(bucket.end)}`,
    count: bucket.count,
  }));
}

function scatter(rows, xKey, yKey, limit = 300) {
  return rows
    .map((row) => ({
      [xKey]: safeNumber(row[xKey]),
      [yKey]: safeNumber(row[yKey]),
    }))
    .filter((row) => row[xKey] !== null && row[yKey] !== null)
    .slice(0, limit);
}

function makeChart({ id, title, type, xKey, yKey, aggregation, data, description }) {
  return {
    id: id || randomUUID(),
    title,
    type,
    xKey,
    yKey,
    aggregation,
    data,
    description,
    correctedBy: "dashboard-integrity-engine",
  };
}

function detectDomain(columns) {
  const names = columns.map((column) => column.normalizedName).join(" ");

  if (
    names.includes("daily_social_media_hours") ||
    names.includes("sleep_hours") ||
    names.includes("stress_level") ||
    names.includes("anxiety_level") ||
    names.includes("addiction_level") ||
    names.includes("depression_label")
  ) {
    return "teen_mental_health";
  }

  if (/salary|experience|education|company_size|framework|language/.test(names)) {
    return "salary_jobs";
  }

  if (/sales|revenue|amount|product|quantity|order/.test(names)) {
    return "sales";
  }

  return "generic";
}

function formatValue(value, suffix = "") {
  if (suffix === "%") return `${round(value)}%`;
  return round(value).toLocaleString();
}

function buildMentalHealthKpis(rows, columns) {
  const age = findColumn(columns, ["age"], "metric");
  const dailySocial = findColumn(columns, ["daily_social_media_hours"], "metric");
  const sleep = findColumn(columns, ["sleep_hours"], "metric");
  const depression = findColumn(columns, ["depression_label"], null);
  const gender = findColumn(columns, ["gender"], "dimension");

  const kpis = [
    {
      id: "kpi-total-records",
      title: "Total Records",
      value: rows.length.toLocaleString(),
      subtitle: "count",
      metric: "*",
      aggregation: "count",
    },
  ];

  if (age) {
    const values = rows.map((row) => row[age.name]);

    kpis.push(
      {
        id: "kpi-average-age",
        title: "Average Age",
        value: formatValue(aggregate(values, "avg")),
        subtitle: "avg",
        metric: age.name,
        aggregation: "avg",
      },
      {
        id: "kpi-median-age",
        title: "Median Age",
        value: formatValue(aggregate(values, "median")),
        subtitle: "median",
        metric: age.name,
        aggregation: "median",
      },
      {
        id: "kpi-highest-age",
        title: "Highest Age",
        value: formatValue(aggregate(values, "max")),
        subtitle: "max",
        metric: age.name,
        aggregation: "max",
      }
    );
  }

  if (gender) {
    const values = rows
      .map((row) => row[gender.name])
      .filter((value) => !isMissing(value));

    kpis.push({
      id: "kpi-gender-categories",
      title: "Gender Categories",
      value: new Set(values.map(String)).size.toLocaleString(),
      subtitle: "unique",
      metric: gender.name,
      aggregation: "unique",
    });
  }

  if (dailySocial) {
    kpis.push({
      id: "kpi-average-social-hours",
      title: "Avg Social Media Hours",
      value: formatValue(aggregate(rows.map((row) => row[dailySocial.name]), "avg")),
      subtitle: "avg",
      metric: dailySocial.name,
      aggregation: "avg",
    });
  }

  if (sleep) {
    kpis.push({
      id: "kpi-average-sleep-hours",
      title: "Avg Sleep Hours",
      value: formatValue(aggregate(rows.map((row) => row[sleep.name]), "avg")),
      subtitle: "avg",
      metric: sleep.name,
      aggregation: "avg",
    });
  }

  if (depression) {
    const positives = rows.filter((row) => isPositiveLabel(row[depression.name])).length;
    const rate = rows.length ? (positives / rows.length) * 100 : 0;

    kpis.push({
      id: "kpi-depression-rate",
      title: "Depression Label Rate",
      value: formatValue(rate, "%"),
      subtitle: "positive label rate",
      metric: depression.name,
      aggregation: "rate",
    });
  }

  return kpis.slice(0, 8);
}

function buildGenericKpis(rows, columns) {
  const metric =
    findColumn(columns, ["sales", "salary", "revenue", "amount", "score", "age"], "metric") ||
    findColumn(columns, [], "metric");

  const dimension = findColumn(columns, [], "dimension");

  const kpis = [
    {
      id: "kpi-total-records",
      title: "Total Records",
      value: rows.length.toLocaleString(),
      subtitle: "count",
      metric: "*",
      aggregation: "count",
    },
  ];

  if (metric) {
    const values = rows.map((row) => row[metric.name]);

    kpis.push(
      {
        id: `kpi-average-${metric.normalizedName}`,
        title: `Average ${metric.name}`,
        value: formatValue(aggregate(values, "avg")),
        subtitle: "avg",
        metric: metric.name,
        aggregation: "avg",
      },
      {
        id: `kpi-median-${metric.normalizedName}`,
        title: `Median ${metric.name}`,
        value: formatValue(aggregate(values, "median")),
        subtitle: "median",
        metric: metric.name,
        aggregation: "median",
      },
      {
        id: `kpi-highest-${metric.normalizedName}`,
        title: `Highest ${metric.name}`,
        value: formatValue(aggregate(values, "max")),
        subtitle: "max",
        metric: metric.name,
        aggregation: "max",
      }
    );
  }

  if (dimension) {
    const values = rows
      .map((row) => row[dimension.name])
      .filter((value) => !isMissing(value));

    kpis.push({
      id: `kpi-unique-${dimension.normalizedName}`,
      title: `${dimension.name} Categories`,
      value: new Set(values.map(String)).size.toLocaleString(),
      subtitle: "unique",
      metric: dimension.name,
      aggregation: "unique",
    });
  }

  return kpis.slice(0, 8);
}

function buildMentalHealthCharts(rows, columns) {
  const age = findColumn(columns, ["age"], "metric");
  const gender = findColumn(columns, ["gender"], "dimension");
  const platform = findColumn(columns, ["platform_usage"], "dimension");
  const social = findColumn(columns, ["daily_social_media_hours"], "metric");
  const sleep = findColumn(columns, ["sleep_hours"], "metric");
  const stress = findColumn(columns, ["stress_level"], "metric");
  const anxiety = findColumn(columns, ["anxiety_level"], "metric");
  const depression = findColumn(columns, ["depression_label"], null);
  const socialInteraction = findColumn(columns, ["social_interaction_level"], "dimension");

  const charts = [];

  if (gender && age) {
    charts.push(
      makeChart({
        id: "chart-average-age-by-gender",
        title: "Average Age by Gender",
        type: "bar",
        xKey: gender.name,
        yKey: age.name,
        aggregation: "avg",
        data: groupAggregate(rows, gender.name, age.name, "avg", 10),
        description: "Categorical comparison. Bar chart is correct for averages.",
      })
    );
  }

  if (age) {
    charts.push(
      makeChart({
        id: "chart-age-distribution",
        title: "Age Distribution",
        type: "histogram",
        xKey: "range",
        yKey: "count",
        aggregation: "count",
        data: histogram(rows, age.name, 7),
        description: "Shows age spread.",
      })
    );
  }

  if (gender) {
    charts.push(
      makeChart({
        id: "chart-records-by-gender",
        title: "Records by Gender",
        type: "pie",
        xKey: gender.name,
        yKey: "count",
        aggregation: "count",
        data: groupAggregate(rows, gender.name, gender.name, "count", 10),
        description: "Gender category share.",
      })
    );
  }

  if (platform && social) {
    charts.push(
      makeChart({
        id: "chart-social-hours-by-platform",
        title: "Average Social Media Hours by Platform",
        type: "bar",
        xKey: platform.name,
        yKey: social.name,
        aggregation: "avg",
        data: groupAggregate(rows, platform.name, social.name, "avg", 10),
        description: "Mental-health specific platform comparison.",
      })
    );
  }

  if (socialInteraction && stress) {
    charts.push(
      makeChart({
        id: "chart-stress-by-social-interaction",
        title: "Average Stress Level by Social Interaction",
        type: "bar",
        xKey: socialInteraction.name,
        yKey: stress.name,
        aggregation: "avg",
        data: groupAggregate(rows, socialInteraction.name, stress.name, "avg", 10),
        description: "Stress by social interaction group.",
      })
    );
  }

  if (social && sleep) {
    charts.push(
      makeChart({
        id: "chart-social-vs-sleep",
        title: "Daily Social Media Hours vs Sleep Hours",
        type: "scatter",
        xKey: social.name,
        yKey: sleep.name,
        aggregation: "raw",
        data: scatter(rows, social.name, sleep.name, 300),
        description: "Relationship between social media and sleep.",
      })
    );
  }

  if (platform && depression) {
    charts.push(
      makeChart({
        id: "chart-depression-rate-by-platform",
        title: "Depression Label Rate by Platform",
        type: "bar",
        xKey: platform.name,
        yKey: "rate",
        aggregation: "rate",
        data: groupPositiveRate(rows, platform.name, depression.name, 10),
        description: "Positive depression label rate by platform.",
      })
    );
  }

  if (socialInteraction && anxiety && charts.length < 7) {
    charts.push(
      makeChart({
        id: "chart-anxiety-by-social-interaction",
        title: "Average Anxiety Level by Social Interaction",
        type: "bar",
        xKey: socialInteraction.name,
        yKey: anxiety.name,
        aggregation: "avg",
        data: groupAggregate(rows, socialInteraction.name, anxiety.name, "avg", 10),
      })
    );
  }

  return charts.slice(0, 7);
}

function buildGenericSevenCharts(rows, columns) {
  const metrics = columns.filter((column) => column.role === "metric");
  const dimensions = columns.filter((column) => column.role === "dimension");
  const dates = columns.filter((column) => column.role === "date");

  const metric = metrics[0];
  const secondMetric = metrics[1];
  const dimension = dimensions[0];
  const secondDimension = dimensions[1];
  const date = dates[0];

  const charts = [];

  if (dimension && metric) {
    charts.push(
      makeChart({
        title: `Average ${metric.name} by ${dimension.name}`,
        type: "bar",
        xKey: dimension.name,
        yKey: metric.name,
        aggregation: "avg",
        data: groupAggregate(rows, dimension.name, metric.name, "avg", 10),
      })
    );
  }

  if (metric) {
    charts.push(
      makeChart({
        title: `${metric.name} Distribution`,
        type: "histogram",
        xKey: "range",
        yKey: "count",
        aggregation: "count",
        data: histogram(rows, metric.name, 7),
      })
    );
  }

  if (dimension) {
    charts.push(
      makeChart({
        title: `Records by ${dimension.name}`,
        type: "pie",
        xKey: dimension.name,
        yKey: "count",
        aggregation: "count",
        data: groupAggregate(rows, dimension.name, dimension.name, "count", 10),
      })
    );
  }

  if (secondDimension && metric) {
    charts.push(
      makeChart({
        title: `Average ${metric.name} by ${secondDimension.name}`,
        type: "bar",
        xKey: secondDimension.name,
        yKey: metric.name,
        aggregation: "avg",
        data: groupAggregate(rows, secondDimension.name, metric.name, "avg", 10),
      })
    );
  }

  if (dimension && secondMetric) {
    charts.push(
      makeChart({
        title: `Total ${secondMetric.name} by ${dimension.name}`,
        type: "bar",
        xKey: dimension.name,
        yKey: secondMetric.name,
        aggregation: "sum",
        data: groupAggregate(rows, dimension.name, secondMetric.name, "sum", 10),
      })
    );
  }

  if (metric && secondMetric) {
    charts.push(
      makeChart({
        title: `${metric.name} vs ${secondMetric.name}`,
        type: "scatter",
        xKey: metric.name,
        yKey: secondMetric.name,
        aggregation: "raw",
        data: scatter(rows, metric.name, secondMetric.name, 300),
      })
    );
  }

  if (date && metric) {
    const groups = new Map();

    for (const row of rows) {
      const dateValue = new Date(row[date.name]);
      if (!Number.isFinite(dateValue.getTime())) continue;

      const label = dateValue.toISOString().slice(0, 10);

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row[metric.name]);
    }

    charts.push(
      makeChart({
        title: `${metric.name} Trend`,
        type: "line",
        xKey: date.name,
        yKey: metric.name,
        aggregation: "sum",
        data: [...groups.entries()]
          .map(([label, values]) => ({
            [date.name]: label,
            [metric.name]: round(aggregate(values, "sum")),
          }))
          .sort((a, b) => String(a[date.name]).localeCompare(String(b[date.name]))),
      })
    );
  }

  for (const dim of dimensions) {
    if (charts.length >= 7) break;

    charts.push(
      makeChart({
        title: `Top ${dim.name}`,
        type: "bar",
        xKey: dim.name,
        yKey: "count",
        aggregation: "count",
        data: groupAggregate(rows, dim.name, dim.name, "count", 10),
      })
    );
  }

  while (charts.length < 7) {
    charts.push(
      makeChart({
        title: `Rows Overview ${charts.length + 1}`,
        type: "bar",
        xKey: "bucket",
        yKey: "count",
        aggregation: "count",
        data: [{ bucket: "All Rows", count: rows.length }],
      })
    );
  }

  return charts.slice(0, 7);
}

function buildCorrectDashboard(dataset) {
  const rows = cleanRows(dataset.rows || []);
  const columns = inferColumns(rows);
  const domain = detectDomain(columns);

  const kpis =
    domain === "teen_mental_health"
      ? buildMentalHealthKpis(rows, columns)
      : buildGenericKpis(rows, columns);

  const charts =
    domain === "teen_mental_health"
      ? buildMentalHealthCharts(rows, columns)
      : buildGenericSevenCharts(rows, columns);

  return {
    domain,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    kpis,
    charts,
  };
}

function parseComparableNumber(value) {
  return safeNumber(String(value ?? "").replace("%", ""));
}

function compareKpis(currentKpis = [], correctKpis = []) {
  const issues = [];
  const currentMap = new Map();

  for (const kpi of currentKpis) {
    currentMap.set(normalizeName(kpi.title || ""), kpi);
  }

  for (const expected of correctKpis) {
    const current = currentMap.get(normalizeName(expected.title || ""));

    if (!current) {
      issues.push({
        type: "missing_kpi",
        severity: "medium",
        message: `Missing KPI: ${expected.title}`,
        fix: expected,
      });
      continue;
    }

    const currentNumber = parseComparableNumber(current.value);
    const expectedNumber = parseComparableNumber(expected.value);

    if (
      currentNumber !== null &&
      expectedNumber !== null &&
      Math.abs(currentNumber - expectedNumber) > 0.05
    ) {
      issues.push({
        type: "incorrect_kpi_value",
        severity: "high",
        message: `KPI "${expected.title}" is incorrect. Current: ${current.value}, expected: ${expected.value}`,
        fix: expected,
      });
    }
  }

  return issues;
}

function compareCharts(currentCharts = [], correctCharts = [], columns = []) {
  const issues = [];
  const columnNames = new Set(columns.map((column) => column.name));

  if (currentCharts.length !== 7) {
    issues.push({
      type: "wrong_chart_count",
      severity: "medium",
      message: `Dashboard should show 7 charts per dataset. Current: ${currentCharts.length}, expected: 7.`,
    });
  }

  for (const chart of currentCharts) {
    if (!chart?.data?.length) {
      issues.push({
        type: "empty_chart",
        severity: "high",
        message: `Chart "${chart?.title || "Untitled"}" has no data.`,
      });
    }

    const xOk =
      ["range", "bucket", "count"].includes(chart?.xKey) ||
      columnNames.has(chart?.xKey);

    const yOk =
      ["count", "missing", "rate"].includes(chart?.yKey) ||
      columnNames.has(chart?.yKey);

    if (!xOk || !yOk) {
      issues.push({
        type: "invalid_chart_schema",
        severity: "high",
        message: `Chart "${chart?.title || "Untitled"}" uses invalid keys x=${chart?.xKey}, y=${chart?.yKey}.`,
      });
    }

    const title = String(chart?.title || "").toLowerCase();

    if (title.includes("age by platform") && chart?.type !== "bar") {
      issues.push({
        type: "bad_chart_type",
        severity: "medium",
        message: "Average age by platform should be a bar chart, not donut/line.",
      });
    }
  }

  return issues;
}

export function validateAndFixDashboard(dataset = {}, currentDashboard = {}) {
  const correct = buildCorrectDashboard(dataset);

  const issues = [
    ...compareKpis(currentDashboard.kpis || [], correct.kpis),
    ...compareCharts(currentDashboard.charts || [], correct.charts, correct.columns),
  ];

  const observations = [];

  if (correct.domain === "teen_mental_health") {
    const rows = cleanRows(dataset.rows || []);
    const depressionColumn = correct.columns.find(
      (column) => column.normalizedName === "depression_label"
    );
    const stressColumn = correct.columns.find(
      (column) => column.normalizedName === "stress_level"
    );

    if (depressionColumn) {
      const positives = rows.filter((row) => isPositiveLabel(row[depressionColumn.name])).length;
      const rate = rows.length ? (positives / rows.length) * 100 : 0;

      observations.push(
        `Depression positive-label rate is ${round(rate)}%. Do not show HIGH risk unless you define a separate risk formula.`
      );
    }

    if (stressColumn) {
      observations.push(
        `Average stress level is ${round(
          aggregate(rows.map((row) => row[stressColumn.name]), "avg")
        )} out of 10.`
      );
    }
  }

  return {
    isCorrect: issues.length === 0,
    issues,
    observations,
    correctedDashboard: {
      dataType: correct.domain,
      rowCount: correct.rowCount,
      columnCount: correct.columnCount,
      kpis: correct.kpis,
      charts: correct.charts,
      chartRecommendations: correct.charts,
    },
    message:
      issues.length === 0
        ? "Dashboard is already correct for the uploaded schema."
        : `Found ${issues.length} dashboard issue(s). Corrected KPIs and 7 charts were regenerated from the dataset.`,
  };
}