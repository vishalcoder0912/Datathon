import type { Dataset } from "@/features/data/model/dataStore";
import type { ChartSpec, KpiSpec } from "@/features/dashboard/types/dashboardTypes";
import {
  applyFilters,
  average,
  buildChartFromSpec,
  buildDataQualityScore,
  buildDatasetProfile,
  buildDefaultCharts,
  buildKpiFromSpec,
  buildKpis,
  cleanDatasetRows,
  countUnique,
  generateDynamicInsights,
  groupByAggregate,
  median,
  safeNumber,
  sum,
  type DashboardChart,
  type DashboardFilters,
  type DashboardKpi,
  type DataQualityScore,
  type DatasetProfile,
  type InsightCard,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import {
  computeGeoIntelligence,
  detectGeoField,
  detectMetricField,
  type GeoIntelligenceResult,
} from "@/features/dashboard/geo/geoIntelligenceEngine";

const BUSINESS_METRIC_PRIORITY = [
  "revenue",
  "profit",
  "sales",
  "salary_usd",
  "salary",
  "orders",
  "customers",
  "patients",
  "risk_score",
  "amount",
  "price",
  "cost",
  "quantity",
  "score",
];

const GEO_TERMS = [
  "country",
  "country_name",
  "nation",
  "region",
  "state",
  "province",
  "city",
  "territory",
  "market",
  "company_location",
  "location",
];

export type CommandCenterModel = {
  rows: Row[];
  filteredRows: Row[];
  columns: string[];
  profile: DatasetProfile;
  quality: DataQualityScore;
  kpis: DashboardKpi[];
  charts: DashboardChart[];
  insights: InsightCard[];
  geo: GeoIntelligenceResult | null;
  suggestedCommands: string[];
  datasetLabel: string;
  activeFilterCount: number;
};

export type InterpretedCommand = {
  message: string;
  chart?: DashboardChart;
  kpi?: DashboardKpi;
  filters?: DashboardFilters;
  clearFilters?: boolean;
  removeChartId?: string;
  removeKpiId?: string;
  geoRequested?: boolean;
  auditLabel: string;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 2 : 0,
  }).format(value);
}

export function metricFormat(metric?: string): KpiSpec["format"] {
  const name = normalize(metric);
  if (/salary|revenue|sales|profit|income|amount|price|cost|budget|aov/.test(name)) return "currency";
  if (/percent|rate|ratio|margin|discount/.test(name)) return "percent";
  return "number";
}

export function formatMetricValue(value: number, metric?: string) {
  const format = metricFormat(metric);
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: Math.abs(value) >= 100000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) >= 100000 ? 2 : 0,
    }).format(value);
  }
  if (format === "percent") return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return formatCompactNumber(value);
}

export function extractRows(dataset?: Dataset | null): Row[] {
  return cleanDatasetRows(((dataset?.rows || []) as Row[]) || []);
}

function pickByText(columns: string[], text: string) {
  const target = normalize(text);
  if (!target) return undefined;
  return (
    columns.find((column) => normalize(column) === target) ||
    columns.find((column) => target.includes(normalize(column))) ||
    columns.find((column) => normalize(column).includes(target))
  );
}

export function pickBusinessMetric(profile: DatasetProfile, query = "") {
  const columns = profile.numericColumns.map((column) => column.name);
  const fromQuery = columns.find((column) => query && query.toLowerCase().includes(normalize(column).replace(/_/g, " ")));
  if (fromQuery) return fromQuery;

  for (const preferred of BUSINESS_METRIC_PRIORITY) {
    const match = columns.find((column) => normalize(column).includes(normalize(preferred)));
    if (match) return match;
  }

  return profile.primaryMetric?.name || columns[0];
}

export function pickBusinessDimension(profile: DatasetProfile, query = "") {
  const columns = profile.categoryColumns.map((column) => column.name);
  const queryMatch = columns.find((column) => query.toLowerCase().includes(normalize(column).replace(/_/g, " ")));
  if (queryMatch) return queryMatch;

  if (/role|job|position/.test(query.toLowerCase())) {
    return columns.find((column) => /role|job|position|title/.test(normalize(column)));
  }
  if (/country|geo|location/.test(query.toLowerCase())) {
    return columns.find((column) => GEO_TERMS.some((term) => normalize(column).includes(normalize(term))));
  }
  if (/region|market|segment/.test(query.toLowerCase())) {
    return columns.find((column) => /region|market|segment/.test(normalize(column)));
  }
  if (/category|product/.test(query.toLowerCase())) {
    return columns.find((column) => /category|product/.test(normalize(column)));
  }

  return profile.primaryCategory?.name || columns[0];
}

function topByAverage(rows: Row[], dimension: string, metric: string) {
  const grouped = groupByAggregate(rows, dimension, metric, "avg", 1)[0];
  if (!grouped) return "-";
  return String(grouped[dimension] ?? "-");
}

function topByCount(rows: Row[], dimension: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = String(row[dimension] ?? "").trim();
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || "-";
}

export function buildCommandKpis(rows: Row[]): DashboardKpi[] {
  const profile = buildDatasetProfile(rows);
  const quality = buildDataQualityScore(rows);
  const metric = pickBusinessMetric(profile);
  const geoField = detectGeoField(profile.columns.map((column) => column.name));
  const roleField = profile.categoryColumns.find((column) => /role|job|position|title/.test(normalize(column.name)))?.name;
  const kpis: DashboardKpi[] = [
    buildKpiFromSpec(rows, {
      title: "Total Records",
      metric: "__row_count__",
      aggregation: "count",
      format: "number",
      businessKpi: true,
    }),
  ];

  if (metric) {
    const format = metricFormat(metric);
    const isSalary = normalize(metric).includes("salary");
    kpis.push(
      buildKpiFromSpec(rows, {
        title: isSalary ? "Average Salary" : `Total ${titleCase(metric)}`,
        metric,
        aggregation: isSalary ? "avg" : "sum",
        format,
        businessKpi: true,
      }),
      buildKpiFromSpec(rows, {
        title: isSalary ? "Median Salary" : `Average ${titleCase(metric)}`,
        metric,
        aggregation: isSalary ? "median" : "avg",
        format,
        businessKpi: true,
      }),
    );
  }

  if (geoField && metric) {
    const value = topByAverage(rows, geoField, metric);
    kpis.push({
      id: `top-location-${geoField}`,
      title: "Top Location",
      metric: geoField,
      aggregation: "top_by_avg",
      format: "text",
      businessKpi: true,
      rawValue: value,
      value,
      subtitle: `By ${titleCase(metric)}`,
      status: "good",
    });
  }

  if (roleField) {
    kpis.push({
      id: `top-role-${roleField}`,
      title: "Top Role",
      metric: roleField,
      aggregation: "count_unique",
      format: "text",
      businessKpi: true,
      rawValue: metric ? topByAverage(rows, roleField, metric) : topByCount(rows, roleField),
      value: metric ? topByAverage(rows, roleField, metric) : topByCount(rows, roleField),
      subtitle: metric ? `By ${titleCase(metric)}` : "Most common segment",
      status: "good",
      source: metric ? `AVG(${metric}) grouped by ${roleField}` : `COUNT grouped by ${roleField}`,
    });
  }

  kpis.push({
    id: "data-quality-score",
    title: "Data Quality Score",
    metric: "__quality_score__",
    aggregation: "avg",
    format: "percent",
    businessKpi: true,
    rawValue: quality.finalScore,
    value: `${Math.round(quality.finalScore)}%`,
    subtitle: `${quality.completeness}% complete`,
    status: quality.finalScore >= 75 ? "good" : "warning",
  });

  return kpis.filter(Boolean).slice(0, 6);
}

export function buildCommandCharts(rows: Row[]): DashboardChart[] {
  const profile = buildDatasetProfile(rows);
  const metric = pickBusinessMetric(profile);
  const dimension = pickBusinessDimension(profile);
  const geoField = detectGeoField(profile.columns.map((column) => column.name));
  const charts: DashboardChart[] = [];

  const addChart = (spec: ChartSpec) => {
    const chart = buildChartFromSpec(rows, spec);
    if (chart.data.length) charts.push(chart);
  };

  if (metric && profile.dateColumn) {
    addChart({
      type: "area",
      title: `${titleCase(metric)} Trend`,
      xKey: profile.dateColumn.name,
      yKey: metric,
      aggregation: normalize(metric).includes("salary") ? "avg" : "sum",
      intent: "trend",
      limit: 24,
    });
  }

  if (metric && dimension) {
    const isSalaryCountry = normalize(metric).includes("salary") && normalize(dimension) === "country";
    const chartTitle = isSalaryCountry ? "Average Salary by Country" : `${titleCase(metric)} by ${titleCase(dimension)}`;
    addChart({
      type: "bar",
      title: chartTitle,
      xKey: dimension,
      yKey: metric,
      aggregation: normalize(metric).includes("salary") ? "avg" : "sum",
      intent: "ranking",
      limit: 8,
    });
  }

  if (metric && geoField && geoField !== dimension) {
    const isSalaryGeo = normalize(metric).includes("salary") && normalize(geoField) === "country";
    const chartTitle = isSalaryGeo ? "Average Salary by Country" : `${titleCase(metric)} by ${titleCase(geoField)}`;
    addChart({
      type: "bar",
      title: chartTitle,
      xKey: geoField,
      yKey: metric,
      aggregation: normalize(metric).includes("salary") ? "avg" : "sum",
      intent: "geo",
      limit: 8,
    });
  }

  if (dimension) {
    addChart({
      type: "donut",
      title: `Records by ${titleCase(dimension)}`,
      xKey: dimension,
      yKey: "count",
      aggregation: "count",
      intent: "distribution",
      limit: 8,
    });
  }

  if (metric && profile.secondaryMetric) {
    addChart({
      type: "scatter",
      title: `${titleCase(metric)} vs ${titleCase(profile.secondaryMetric.name)}`,
      xKey: profile.secondaryMetric.name,
      yKey: metric,
      aggregation: "avg",
      intent: "relationship",
      limit: 220,
    });
  }

  const fallback = buildDefaultCharts(rows);
  return [...charts, ...fallback]
    .filter((chart, index, list) => {
      const key = `${chart.title}|${chart.type}|${chart.xKey}|${chart.yKey}`;
      return list.findIndex((item) => `${item.title}|${item.type}|${item.xKey}|${item.yKey}` === key) === index;
    })
    .slice(0, 6);
}

export function buildGeoIntelligence(rows: Row[]) {
  const columns = Object.keys(rows[0] || {});
  const geoField = detectGeoField(columns);
  if (!geoField) return null;
  const metric = detectMetricField(columns, rows) || "__count__";
  const result = computeGeoIntelligence(rows, geoField, metric);
  return result.enabled ? result : null;
}

export function buildSuggestedCommands(rows: Row[]) {
  const profile = buildDatasetProfile(rows);
  const metric = pickBusinessMetric(profile);
  const dimension = pickBusinessDimension(profile);
  const geo = detectGeoField(profile.columns.map((column) => column.name));
  const commands = [
    metric && profile.dateColumn ? `Create ${titleCase(metric)} chart by month` : "",
    metric && dimension ? `Compare ${titleCase(metric)} by ${titleCase(dimension)}` : "",
    metric && geo ? `Show top 5 ${titleCase(geo)} by ${titleCase(metric)}` : "",
    metric ? `Add a KPI for median ${titleCase(metric)}` : "",
    geo ? "Run Geo Intelligence" : "",
    "Explain the trend",
  ].filter(Boolean);

  return commands.slice(0, 6);
}

export function buildCommandCenterModel(
  dataset?: Dataset | null,
  filters: DashboardFilters = {},
  manualCharts: DashboardChart[] = [],
  manualKpis: DashboardKpi[] = [],
): CommandCenterModel {
  const rows = extractRows(dataset);
  const filteredRows = applyFilters(rows, filters);
  const profile = buildDatasetProfile(filteredRows);
  const quality = buildDataQualityScore(filteredRows);
  const defaultKpis = buildCommandKpis(filteredRows);
  const defaultCharts = buildCommandCharts(filteredRows);
  const columns = profile.columns.map((column) => column.name);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== "conditions" && value).length + (filters.conditions?.length || 0);

  return {
    rows,
    filteredRows,
    columns,
    profile,
    quality,
    kpis: [...manualKpis, ...defaultKpis].slice(0, 5),
    charts: [...manualCharts, ...defaultCharts]
      .filter((chart, index, list) => {
        const key = `${chart.title}|${chart.type}|${chart.xKey}|${chart.yKey}`;
        return list.findIndex((item) => `${item.title}|${item.type}|${item.xKey}|${item.yKey}` === key) === index;
      })
      .slice(0, 8),
    insights: generateDynamicInsights(filteredRows).slice(0, 4),
    geo: buildGeoIntelligence(filteredRows),
    suggestedCommands: buildSuggestedCommands(filteredRows),
    datasetLabel: dataset?.name || "No dataset loaded",
    activeFilterCount,
  };
}

function detectQueryValue(rows: Row[], columns: string[], query: string) {
  const lower = query.toLowerCase();
  for (const column of columns) {
    const values = Array.from(new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean))).slice(0, 200);
    const match = values.find((value) => lower.includes(value.toLowerCase()));
    if (match) return { column, value: match };
  }
  return null;
}

export function interpretCommand(query: string, rows: Row[]): InterpretedCommand {
  const text = query.trim();
  const lower = text.toLowerCase();
  const profile = buildDatasetProfile(rows);
  const columns = profile.columns.map((column) => column.name);

  // Check for invalid columns mentioned in the query
  const stopWords = new Set([
    "show", "average", "avg", "sum", "total", "median", "highest", "max", "min", "lowest", 
    "by", "filter", "only", "where", "chart", "kpi", "value", "records", "count", 
    "trend", "month", "time", "line", "pie", "donut", "share", "composition", 
    "bar", "plot", "graph", "explain", "summary", "summarize", "describe", "why", 
    "insight", "reset", "clear", "filters", "a", "an", "the", "of", "in", "on", "at", "for"
  ]);

  const queryWords = lower.match(/\b[a-z0-9_]+\b/g) || [];
  for (const word of queryWords) {
    if (stopWords.has(word)) continue;
    const exists = columns.some(col => normalize(col) === normalize(word));
    if (!exists) {
      const isColumnCandidate = 
        word.includes("_") || 
        new RegExp(`\\b(average|avg|sum|total|median|highest|max|min|lowest|by|filter|only|where|show|compare|plot|chart|kpi|vs)\\s+${word}\\b`, "i").test(lower) ||
        new RegExp(`\\b${word}\\s+(by|vs|filter|only|where)\\b`, "i").test(lower);
        
      if (isColumnCandidate) {
        return {
          message: `Column '${word}' does not exist in schema.`,
          auditLabel: `Rejected command: invalid column ${word}`,
        };
      }
    }
  }

  const metric =
    pickBusinessMetric(profile, text) ||
    pickByText(columns, lower.match(/(?:salary|revenue|profit|sales|orders|customers|patients|risk score|score|amount)/i)?.[0] || "");
  const dimension = pickBusinessDimension(profile, text);
  const geoField = detectGeoField(columns);
  const availableNumeric = profile.numericColumns.map((column) => column.name).join(", ") || "none";
  const availableCategories = profile.categoryColumns.map((column) => column.name).join(", ") || "none";

  if (/\bsalary\b|salary_usd/.test(lower) && !columns.some((column) => /salary/.test(normalize(column)))) {
    return {
      message: `I cannot create salary analysis because a salary or salary_usd field was not found. Available numeric fields are: ${availableNumeric}.`,
      auditLabel: "Rejected salary command: missing field",
    };
  }

  if (/\brole\b|job title|job_title/.test(lower) && !columns.some((column) => /role|job|position|title/.test(normalize(column)))) {
    return {
      message: `I cannot group by role because a role or job title field was not found. Available category fields are: ${availableCategories}.`,
      auditLabel: "Rejected role command: missing field",
    };
  }

  if (/clear\s+(all\s+)?filters|reset\s+filters|remove\s+filters/.test(lower)) {
    return {
      message: "Cleared all dashboard filters. KPIs, charts, and Geo Intelligence now use the full uploaded dataset.",
      clearFilters: true,
      auditLabel: "Cleared all filters",
    };
  }

  if (/delete|remove/.test(lower) && /chart/.test(lower)) {
    return {
      message: "Removed the most recent AI chart from the dashboard.",
      removeChartId: "__latest__",
      auditLabel: "Removed latest AI chart",
    };
  }

  if (/delete|remove/.test(lower) && /kpi|card/.test(lower)) {
    return {
      message: "Removed the most recent AI KPI from the dashboard.",
      removeKpiId: "__latest__",
      auditLabel: "Removed latest AI KPI",
    };
  }

  if (/filter|only|where/.test(lower)) {
    const detected = detectQueryValue(rows, columns, text);
    if (detected) {
      return {
        message: `Applied filter ${detected.column} = ${detected.value}. All visible dashboard values now recalculate from the filtered dataset.`,
        filters: { [detected.column]: detected.value },
        auditLabel: `Filtered ${detected.column} to ${detected.value}`,
      };
    }
  }

  if (/geo|map|countr|location|region|state|city/.test(lower) && geoField && !/chart|plot|graph/.test(lower)) {
    const geo = buildGeoIntelligence(rows);
    return {
      message: geo
        ? geo.summaryInsight
        : `Geo Intelligence is available from ${geoField}, but not enough metric values were found for ranking.`,
      geoRequested: true,
      auditLabel: "Ran Geo Intelligence",
    };
  }

  if (/kpi|card|median|average|avg|highest|max/.test(lower) && metric && !/chart|graph|plot/.test(lower)) {
    const aggregation = /median/.test(lower) ? "median" : /highest|max/.test(lower) ? "max" : /total|sum/.test(lower) ? "sum" : "avg";
    const isSalary = normalize(metric).includes("salary");
    const kpiTitle = isSalary && aggregation === "max" ? "Highest Salary" : isSalary && aggregation === "avg" ? "Average Salary" : `${titleCase(String(aggregation))} ${titleCase(metric)}`;
    const kpi = buildKpiFromSpec(rows, {
      title: kpiTitle,
      metric,
      aggregation,
      format: metricFormat(metric),
      businessKpi: true,
    });
    return {
      message: `Added ${kpi.title}. The value was calculated locally from ${rows.length.toLocaleString()} rows.`,
      kpi: { ...kpi, createdBy: "ai" } as DashboardKpi,
      auditLabel: `Added KPI ${kpi.title}`,
    };
  }

  if (/trend|month|time|line/.test(lower) && metric && profile.dateColumn) {
    const chart = buildChartFromSpec(rows, {
      type: "line",
      title: `${titleCase(metric)} Trend`,
      xKey: profile.dateColumn.name,
      yKey: metric,
      aggregation: normalize(metric).includes("salary") ? "avg" : "sum",
      intent: "trend",
      limit: 24,
    });
    return {
      message: `Created ${chart.title} from ${profile.dateColumn.name} and ${metric}.`,
      chart: { ...chart, createdBy: "ai" },
      auditLabel: `Created ${chart.title}`,
    };
  }

  if (/pie|donut|share|composition/.test(lower) && dimension) {
    const chart = buildChartFromSpec(rows, {
      type: lower.includes("pie") ? "pie" : "donut",
      title: `Records by ${titleCase(dimension)}`,
      xKey: dimension,
      yKey: "count",
      aggregation: "count",
      intent: "distribution",
      limit: 8,
    });
    return {
      message: `Created ${chart.title}.`,
      chart: { ...chart, createdBy: "ai" },
      auditLabel: `Created ${chart.title}`,
    };
  }

  if ((/chart|compare|top|by|bar|plot|graph/.test(lower) || lower.includes("show ")) && metric && (dimension || geoField)) {
    const xKey = /countr|geo|location|region|state|city/.test(lower) && geoField ? geoField : dimension || geoField!;
    const isSalaryCountry = normalize(metric).includes("salary") && normalize(xKey) === "country";
    const chartTitle = isSalaryCountry ? "Average Salary by Country" : `${titleCase(metric)} by ${titleCase(xKey)}`;
    const chart = buildChartFromSpec(rows, {
      type: /top|bar|compare|by/.test(lower) ? "bar" : "horizontalBar",
      title: chartTitle,
      xKey,
      yKey: metric,
      aggregation: normalize(metric).includes("salary") ? "avg" : "sum",
      intent: geoField === xKey ? "geo" : "ranking",
      limit: /top\s+5/.test(lower) ? 5 : 8,
    });
    return {
      message: `Created ${chart.title}. The chart is grounded in ${chart.xKey} and ${chart.yKey}.`,
      chart: { ...chart, createdBy: "ai" },
      auditLabel: isSalaryCountry ? `Created average salary_usd chart by country` : `Created ${chart.title}`,
    };
  }

  if (/summary|summarize|explain|insight|trend/.test(lower)) {
    const metricValues = metric
      ? rows.map((row) => safeNumber(row[metric])).filter((value): value is number => value !== null)
      : [];
    const avg = metricValues.length ? average(metricValues) : 0;
    const total = metricValues.length ? sum(metricValues) : rows.length;
    const unique = dimension ? countUnique(rows.map((row) => row[dimension])) : 0;
    return {
      message: metric
        ? `${titleCase(metric)} averages ${formatMetricValue(avg, metric)} with total ${formatMetricValue(total, metric)} across ${rows.length.toLocaleString()} records${dimension ? ` and ${unique.toLocaleString()} ${titleCase(dimension)} values` : ""}.`
        : `This dataset contains ${rows.length.toLocaleString()} records and ${profile.columns.length} detected columns.`,
      auditLabel: "Generated explanation",
    };
  }

  return {
    message: `I can create charts, KPIs, filters, summaries, and Geo Intelligence from this schema. Try: ${buildSuggestedCommands(rows)[0] || "create a chart"}.`,
    auditLabel: "Answered dataset question",
  };
}
