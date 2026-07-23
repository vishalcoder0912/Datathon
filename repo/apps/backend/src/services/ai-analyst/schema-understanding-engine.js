import {
  buildSchemaProfile,
  normalizeColumnName,
} from "./schema-fingerprint.js";

const MONEY_HINTS = [
  "salary",
  "revenue",
  "sales",
  "amount",
  "price",
  "cost",
  "profit",
  "income",
  "spend",
  "budget",
  "value",
  "gmv",
  "arr",
  "mrr",
];

const PEOPLE_HINTS = [
  "employee",
  "developer",
  "experience",
  "education",
  "department",
  "company",
  "role",
  "job",
  "salary",
  "skills",
  "language",
  "framework",
];

const COMMERCE_HINTS = [
  "customer",
  "product",
  "order",
  "sales",
  "revenue",
  "amount",
  "quantity",
  "region",
  "country",
  "market",
];

const HEALTH_HINTS = [
  "stress",
  "anxiety",
  "depression",
  "sleep",
  "health",
  "screen",
  "social",
  "addiction",
  "wellness",
];

const EDUCATION_HINTS = [
  "student",
  "marks",
  "grade",
  "attendance",
  "course",
  "exam",
  "gpa",
  "school",
  "college",
];

function includesAny(text, hints) {
  return hints.some((hint) => text.includes(hint));
}

function normalize(value = "") {
  return normalizeColumnName(value);
}

function columnText(column = {}) {
  return [
    column.name,
    column.normalizedName,
    column.title,
    column.type,
    column.role,
    column.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isMeasureMetric(column) {
  return [
    "money_metric",
    "score_metric",
    "rate_metric",
    "count_metric",
    "continuous_metric",
  ].includes(column.role);
}

function isCategory(column) {
  return [
    "location",
    "category",
    "target",
    "numeric_category",
    "date",
  ].includes(column.role) || ["string", "category", "boolean", "date"].includes(column.type);
}

function isDate(column) {
  return column.role === "date" || column.type === "date";
}

function isMoney(column) {
  const text = columnText(column);
  return column.role === "money_metric" || includesAny(text, MONEY_HINTS);
}

function isMultiValue(column) {
  const name = normalize(column.name || column.normalizedName || "");
  return /(language|languages|framework|frameworks|skill|skills|tag|tags|tools|technolog|categories)/.test(name);
}

function confidenceFromMatches(matches, total) {
  if (!total) return 0;
  return Math.min(1, matches / Math.max(3, total));
}

function roundScore(value) {
  return Math.round(Math.min(1, value) * 100) / 100;
}

export function detectSmartDomain(profile) {
  const text = (profile.columns || []).map(columnText).join(" ");
  const total = profile.columns?.length || 1;

  const scores = [
    {
      domain: "workforce_salary",
      score:
        confidenceFromMatches(
          PEOPLE_HINTS.filter((hint) => text.includes(hint)).length,
          total
        ) + (text.includes("salary") ? 0.4 : 0),
    },
    {
      domain: "sales_commerce",
      score:
        confidenceFromMatches(
          COMMERCE_HINTS.filter((hint) => text.includes(hint)).length,
          total
        ) + (includesAny(text, ["sales", "revenue", "amount"]) ? 0.35 : 0),
    },
    {
      domain: "health_wellness",
      score: confidenceFromMatches(
        HEALTH_HINTS.filter((hint) => text.includes(hint)).length,
        total
      ),
    },
    {
      domain: "education",
      score: confidenceFromMatches(
        EDUCATION_HINTS.filter((hint) => text.includes(hint)).length,
        total
      ),
    },
  ].sort((a, b) => b.score - a.score);

  const best = scores[0];

  return {
    domain: best.score >= 0.35 ? best.domain : profile.domain || "general_analytics",
    confidence: roundScore(best.score),
    candidates: scores.map((item) => ({
      domain: item.domain,
      score: roundScore(item.score),
    })),
  };
}

export function identifySchemaRoles(profile) {
  const columns = profile.columns || [];

  const metrics = columns
    .filter(isMeasureMetric)
    .map((column) => ({
      name: column.name,
      title: column.title,
      role: column.role,
      type: column.type,
      priority:
        (isMoney(column) ? 30 : 0) +
        (column.stats ? 10 : 0) +
        (column.uniqueCount > 5 ? 5 : 0),
    }))
    .sort((a, b) => b.priority - a.priority);

  const categories = columns
    .filter(isCategory)
    .map((column) => ({
      name: column.name,
      title: column.title,
      role: column.role,
      type: column.type,
      uniqueCount: column.uniqueCount,
      multiValue: isMultiValue(column),
      priority:
        (column.role === "location" ? 30 : 0) +
        (column.role === "category" ? 20 : 0) +
        (isMultiValue(column) ? 12 : 0) +
        (column.uniqueCount > 1 && column.uniqueCount <= 50 ? 8 : 0),
    }))
    .sort((a, b) => b.priority - a.priority);

  const dates = columns
    .filter(isDate)
    .map((column) => ({
      name: column.name,
      title: column.title,
      role: column.role,
      type: column.type,
    }));

  const ids = columns
    .filter((column) => column.role === "id")
    .map((column) => ({
      name: column.name,
      title: column.title,
      role: column.role,
      type: column.type,
    }));

  return {
    primaryMetric: metrics[0] || null,
    secondaryMetric: metrics[1] || null,
    primaryCategory: categories[0] || null,
    secondaryCategory: categories[1] || null,
    primaryDate: dates[0] || null,
    metrics,
    categories,
    dates,
    ids,
  };
}

export function buildSmartKpiCandidates(profile, roles = identifySchemaRoles(profile)) {
  const kpis = [
    {
      title: "Total Records",
      metric: "__row_count__",
      aggregation: "count",
      format: "number",
      reason: "Shows total dataset size.",
      priority: 100,
    },
  ];

  for (const metric of roles.metrics.slice(0, 4)) {
    const format = metric.role === "money_metric" ? "currency" : "number";

    kpis.push({
      title: `Average ${metric.title || metric.name}`,
      metric: metric.name,
      aggregation: "avg",
      format,
      reason: `Average value of ${metric.name}.`,
      priority: metric.priority + 40,
    });

    kpis.push({
      title: `Median ${metric.title || metric.name}`,
      metric: metric.name,
      aggregation: "median",
      format,
      reason: `Median gives a robust midpoint for ${metric.name}.`,
      priority: metric.priority + 30,
    });

    kpis.push({
      title: `Highest ${metric.title || metric.name}`,
      metric: metric.name,
      aggregation: "max",
      format,
      reason: `Maximum observed ${metric.name}.`,
      priority: metric.priority + 20,
    });
  }

  for (const category of roles.categories.slice(0, 3)) {
    kpis.push({
      title: `Unique ${category.title || category.name}`,
      metric: category.name,
      aggregation: "count_unique",
      format: "number",
      reason: `Counts unique values in ${category.name}.`,
      priority: category.priority + 10,
    });
  }

  return kpis
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
}

export function buildSmartChartCandidates(profile, roles = identifySchemaRoles(profile)) {
  const charts = [];
  const metric = roles.primaryMetric;
  const metric2 = roles.secondaryMetric;
  const category = roles.primaryCategory;
  const category2 = roles.secondaryCategory;
  const date = roles.primaryDate;

  if (metric && category) {
    charts.push({
      title: `Average ${metric.title || metric.name} by ${category.title || category.name}`,
      type: "bar",
      xKey: category.name,
      yKey: metric.name,
      aggregation: "avg",
      limit: 10,
      splitValues: category.multiValue,
      reason: "Compares the main metric across the most useful category.",
      priority: 100,
    });
  }

  if (metric) {
    charts.push({
      title: `${metric.title || metric.name} Distribution`,
      type: "histogram",
      xKey: metric.name,
      yKey: metric.name,
      aggregation: "count",
      bins: 12,
      limit: 12,
      reason: "Shows spread and outliers of the primary metric.",
      priority: 90,
    });
  }

  if (metric && metric2) {
    charts.push({
      title: `${metric.title || metric.name} vs ${metric2.title || metric2.name}`,
      type: "scatter",
      xKey: metric2.name,
      yKey: metric.name,
      aggregation: "count",
      limit: 500,
      reason: "Shows relationship between two numeric metrics.",
      priority: 85,
    });
  }

  if (category) {
    charts.push({
      title: `${category.title || category.name} Distribution`,
      type: "donut",
      xKey: category.name,
      yKey: "count",
      aggregation: "count",
      limit: 10,
      splitValues: category.multiValue,
      reason: "Shows category composition.",
      priority: 80,
    });
  }

  if (metric && category2) {
    charts.push({
      title: `Average ${metric.title || metric.name} by ${category2.title || category2.name}`,
      type: "bar",
      xKey: category2.name,
      yKey: metric.name,
      aggregation: "avg",
      limit: 10,
      splitValues: category2.multiValue,
      reason: "Adds a second category breakdown.",
      priority: 75,
    });
  }

  if (metric && date) {
    charts.push({
      title: `${metric.title || metric.name} Trend`,
      type: "line",
      xKey: date.name,
      yKey: metric.name,
      aggregation: "avg",
      limit: 24,
      reason: "Shows how the primary metric changes over time.",
      priority: 70,
    });
  }

  for (const multi of roles.categories.filter((item) => item.multiValue).slice(0, 2)) {
    if (metric) {
      charts.push({
        title: `Average ${metric.title || metric.name} by ${multi.title || multi.name}`,
        type: "bar",
        xKey: multi.name,
        yKey: metric.name,
        aggregation: "avg",
        limit: 10,
        splitValues: true,
        reason: "Splits multi-value fields like languages/frameworks into separate groups.",
        priority: 78,
      });
    }
  }

  return charts
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
}

export function explainSchemaForUser(profile, understanding) {
  const roles = understanding.roles;
  const importantFields = [
    roles.primaryMetric,
    roles.primaryCategory,
    roles.secondaryCategory,
    roles.primaryDate,
  ].filter(Boolean);
  const fieldLines = importantFields
    .filter((field, index, fields) => fields.findIndex((item) => item.name === field.name) === index)
    .slice(0, 5)
    .map((field) => {
      const name = normalize(field.name);
      if (/salary|income|pay|compensation/.test(name)) return `- ${field.name} -> employee compensation`;
      if (/revenue|sales|profit|amount|billing|cost|price/.test(name)) return `- ${field.name} -> financial performance`;
      if (/country|state|city|region|location/.test(name)) return `- ${field.name} -> geographic distribution`;
      if (/education|degree|qualification/.test(name)) return `- ${field.name} -> qualification level`;
      if (/experience|tenure|seniority|years/.test(name)) return `- ${field.name} -> seniority indicator`;
      if (field.role === "date") return `- ${field.name} -> time trend`;
      if (field.role === "location") return `- ${field.name} -> geographic dimension`;
      if (isMeasureMetric(field)) return `- ${field.name} -> business metric`;
      return `- ${field.name} -> analysis segment`;
    });
  const recommendedCharts = buildSmartChartCandidates(profile, roles)
    .slice(0, 5)
    .map((chart) => `- ${chart.title}`);

  return [
    `This appears to be a ${understanding.domain.domain.replaceAll("_", " ")} analytics dataset that can help compare performance across key segments and uncover patterns worth turning into dashboard views.`,
    "",
    "The most important fields appear to be:",
    ...(fieldLines.length ? fieldLines : ["- The available fields can be used for segment, ranking, and distribution analysis."]),
    "",
    "Based on the schema, this dataset can answer questions such as:",
    roles.primaryMetric && roles.primaryCategory
      ? `1. How does ${roles.primaryMetric.name} vary by ${roles.primaryCategory.name}?`
      : "1. Which segments stand out most?",
    roles.primaryMetric ? `2. What does the ${roles.primaryMetric.name} distribution look like?` : "2. What are the main distribution patterns?",
    roles.secondaryCategory ? `3. Which ${roles.secondaryCategory.name} groups deserve closer attention?` : "3. Are there outliers or unusual groups?",
    roles.primaryDate && roles.primaryMetric ? `4. How does ${roles.primaryMetric.name} change over time?` : "4. What should be tracked in a dashboard?",
    "",
    "I recommend starting with:",
    ...(recommendedCharts.length ? recommendedCharts : ["- Category Breakdown", "- Metric Distribution", "- Top Segment Ranking"]),
  ].join("\n");
}

export function buildSchemaUnderstanding(datasetOrProfile = {}) {
  const profile = datasetOrProfile.columns?.[0]?.role
    ? datasetOrProfile
    : buildSchemaProfile(datasetOrProfile);

  const domain = detectSmartDomain(profile);
  const roles = identifySchemaRoles(profile);
  const kpiCandidates = buildSmartKpiCandidates(profile, roles);
  const chartCandidates = buildSmartChartCandidates(profile, roles);

  return {
    schemaOnly: true,
    profile,
    domain,
    roles,
    kpiCandidates,
    chartCandidates,
    userExplanation: explainSchemaForUser(profile, {
      domain,
      roles,
    }),
  };
}
