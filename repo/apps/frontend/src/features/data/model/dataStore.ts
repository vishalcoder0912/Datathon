import {
  toNumber,
  toLabel,
  normalizeText,
  normalizeGenderLabel,
  normalizeBoardLabel,
  normalizeDimensionLabel,
  humanize,
  pickPreferredColumn,
  metricAggregationForColumn,
  sortLabels,
  isMeaningfulValue,
  getMinimumGroupCount,
  filterGroupedEntries,
  groupMetricByDimension,
  countRowsByDimension,
  prepareDatasetForAnalytics as prepareDatasetForAnalyticsShared,
  generateDemoDataset,
  buildDatasetSchema,
  MONTHS_CONST as MONTHS,
  PREFERRED_NUMERIC_COLUMNS_CONST as PREFERRED_NUMERIC_COLUMNS,
  PREFERRED_DIMENSION_COLUMNS_CONST as PREFERRED_DIMENSION_COLUMNS,
  NON_ADDITIVE_METRIC_HINTS_CONST as NON_ADDITIVE_METRIC_HINTS,
  BRANCH_MINIMUM_GROUP_COUNT_CONST as BRANCH_MINIMUM_GROUP_COUNT,
} from "@insightflow/shared-analytics";

export interface DataColumn {
  name: string;
  type:
    | "string"
    | "number"
    | "date"
    | "datetime"
    | "currency"
    | "percentage"
    | "category"
    | "text"
    | "boolean"
    | "country"
    | "city"
    | "latitude"
    | "longitude";
  sample: string[];
}

export type DatasetCellValue = string | number | boolean | null;

export interface DatasetRow extends Record<string, DatasetCellValue> {
  __rowId?: number;
}

export type ChartDatum = Record<string, string | number>;

export interface Dataset {
  id: string;
  name: string;
  columns: DataColumn[];
  rows: DatasetRow[];
  uploadedAt: Date;
  rowCount: number;
  sourceType?: string;
  fileName?: string | null;
}

export interface DatasetAnalysis {
  dataType: string;
  dataTypeLabel: string;
  chartRecommendations: ChartConfig[];
  kpis?: KPI[];
  memory?: {
    usedPreviousPattern: boolean;
    similarity: number;
    domain: string;
    columnSignature: string;
  };
  insights: Array<{
    type: string;
    title: string;
    message: string;
    [key: string]: unknown;
  }>;
  aiInsights?: unknown;
}

export interface KPI {
  title: string;
  value: string;
  change?: number;
  trend?: "up" | "down" | "stable";
  status?: "good" | "warning" | "critical";
  insight?: string;
  sparkline?: number[];
  icon: string;
  businessKpi?: boolean;
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area" | "scatter" | "radar" | "composed" | "histogram" | "heatmap";
  title: string;
  xKey: string;
  yKey: string;
  zKey?: string;
  xLabel?: string;
  yLabel?: string;
  category?: string;
  id?: string;
  data: ChartDatum[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  chart?: ChartConfig;
  insights?: string[];
  timestamp: Date;
  usedAI?: boolean;
  model?: string;
  confidence?: number;
  intent?: string;
  reason?: string;
  metadata?: {
    durationMs?: number;
    dataQualityScore?: number;
  };
}

export interface AnalyticsHealthSummary {
  integrity: {
    totalRows: number;
    analyticsRows: number;
    removedEmptyRows: number;
    invalidNumericValues: number;
  };
  risk: {
    level: "HIGH" | "LOW";
    metricName: string | null;
    average: number | null;
    threshold: number | null;
    rule: string;
  };
  branchCoverage: {
    totalGroups: number;
    includedGroups: number;
    excludedGroups: number;
    minimumGroupCount: number;
  };
}

type MetricAggregation = "sum" | "average";

const pickPrimaryMetric = (columns: DataColumn[]) => pickPreferredColumn(columns, PREFERRED_NUMERIC_COLUMNS);

const pickSecondaryMetric = (columns: DataColumn[], primaryMetric?: DataColumn) => {
  const remaining = columns.filter((column) => column.name !== primaryMetric?.name);
  if (remaining.length === 0) {
    return undefined;
  }

  const additiveMetrics = remaining.filter((column) => metricAggregationForColumn(column.name) === "sum");
  if (additiveMetrics.length > 0) {
    return pickPreferredColumn(additiveMetrics, PREFERRED_NUMERIC_COLUMNS);
  }

  return remaining[0];
};

const getNumericColumns = (data: Dataset) => 
  data.columns.filter((column) => column.type === "number" && !column.name.toLowerCase().includes('row') && !column.name.toLowerCase().includes('id'));
const getDimensionColumns = (data: Dataset) => 
  data.columns.filter((column) => column.type !== "number" || column.name.toLowerCase().includes('experience'));

const logAverageValidation = ({
  metricName,
  dimensionName,
  includedValues,
  skippedInvalidValues,
  skippedEmptyLabels,
  groupCount,
}: {
  metricName: string;
  dimensionName: string;
  includedValues: number;
  skippedInvalidValues: number;
  skippedEmptyLabels: number;
  groupCount: number;
}) => {
  console.info("[analytics] average validation", {
    metric: metricName,
    dimension: dimensionName,
    formula: "sum(values) / count(values)",
    includedValues,
    skippedInvalidValues,
    skippedEmptyLabels,
    groupCount,
  });
};

const prepareDatasetForAnalytics = (data: Dataset) => {
  const numericColumns = getNumericColumns(data);
  const sanitizedRows: DatasetRow[] = [];
  let removedEmptyRows = 0;
  let invalidNumericValues = 0;

  data.rows.forEach((row) => {
    const hasMeaningfulField = data.columns.some((column) => isMeaningfulValue(row[column.name]));
    if (!hasMeaningfulField) {
      removedEmptyRows += 1;
      return;
    }

    const nextRow: DatasetRow = { ...row };
    numericColumns.forEach((column) => {
      const rawValue = row[column.name];
      const numericValue = toNumber(rawValue);

      if (numericValue == null) {
        if (isMeaningfulValue(rawValue)) {
          invalidNumericValues += 1;
        }
        nextRow[column.name] = null;
        return;
      }

      nextRow[column.name] = numericValue;
    });

    sanitizedRows.push(nextRow);
  });

  if (removedEmptyRows > 0 || invalidNumericValues > 0) {
    console.info("[analytics] integrity validation", {
      totalRows: data.rows.length,
      analyticsRows: sanitizedRows.length,
      removedEmptyRows,
      invalidNumericValues,
    });
  }

  return {
    dataset: {
      ...data,
      rows: sanitizedRows,
      rowCount: sanitizedRows.length,
    },
    integrity: {
      totalRows: data.rows.length,
      analyticsRows: sanitizedRows.length,
      removedEmptyRows,
      invalidNumericValues,
    },
  };
};

export interface DataQualityIssue {
  type: 'duplicate' | 'outlier' | 'missing' | 'invalid' | 'inconsistent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  column?: string;
  rowIndex?: number;
  message: string;
  count: number;
  affectedValues?: string[];
}

export interface DataQualityReport {
  totalRows: number;
  issues: DataQualityIssue[];
  summary: {
    duplicates: number;
    outliers: number;
    missingValues: number;
    invalidValues: number;
    totalIssues: number;
    qualityScore: number;
  };
  columnStats: Array<{
    name: string;
    type: string;
    missing: number;
    outliers: number;
    invalid: number;
  }>;
}

export function analyzeDataQuality(data: Dataset): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  const columnStats: DataQualityReport['columnStats'] = [];
  let duplicates = 0;
  let missingValues = 0;
  let invalidValues = 0;
  let outliers = 0;

  const rowSignatures = new Map<string, number[]>();
  data.rows.forEach((row, idx) => {
    const signature = data.columns.map(col => String(row[col.name] ?? '')).join('|');
    if (!rowSignatures.has(signature)) {
      rowSignatures.set(signature, []);
    }
    rowSignatures.get(signature)!.push(idx);
  });

  rowSignatures.forEach((indices) => {
    if (indices.length > 1) {
      duplicates += indices.length;
      issues.push({
        type: 'duplicate',
        severity: 'medium',
        message: `Found ${indices.length} duplicate rows`,
        count: indices.length,
        affectedValues: indices.slice(0, 5).map(String)
      });
    }
  });

  data.columns.forEach((column) => {
    let colMissing = 0;
    let colInvalid = 0;
    let colOutliers = 0;
    const numericValues: number[] = [];

    data.rows.forEach((row, idx) => {
      const value = row[column.name];
      
      if (value === null || value === undefined || value === '') {
        colMissing++;
      } else if (column.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          colInvalid++;
        } else {
          numericValues.push(num);
        }
      }
    });

    missingValues += colMissing;
    invalidValues += colInvalid;

    if (numericValues.length > 10 && column.type === 'number') {
      const sorted = [...numericValues].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      numericValues.forEach((val) => {
        if (val < lowerBound || val > upperBound) {
          colOutliers++;
        }
      });

      if (colOutliers > 0) {
        outliers += colOutliers;
        issues.push({
          type: 'outlier',
          severity: 'low',
          column: column.name,
          message: `Found ${colOutliers} outlier(s) in ${column.name} (IQR method)`,
          count: colOutliers
        });
      }
    }

    if (colMissing > 0) {
      issues.push({
        type: 'missing',
        severity: colMissing > data.rows.length * 0.5 ? 'critical' : colMissing > data.rows.length * 0.1 ? 'high' : 'low',
        column: column.name,
        message: `${column.name} has ${colMissing} missing values (${((colMissing / data.rows.length) * 100).toFixed(1)}%)`,
        count: colMissing
      });
    }

    if (colInvalid > 0) {
      issues.push({
        type: 'invalid',
        severity: 'high',
        column: column.name,
        message: `${column.name} has ${colInvalid} invalid numeric values`,
        count: colInvalid
      });
    }

    columnStats.push({
      name: column.name,
      type: column.type,
      missing: colMissing,
      outliers: colOutliers,
      invalid: colInvalid
    });
  });

  const totalIssues = duplicates + outliers + missingValues + invalidValues;
  const qualityScore = Math.max(0, Math.min(100, 100 - (totalIssues / data.rows.length) * 100));

  return {
    totalRows: data.rows.length,
    issues,
    summary: {
      duplicates,
      outliers,
      missingValues,
      invalidValues,
      totalIssues,
      qualityScore: Math.round(qualityScore * 10) / 10
    },
    columnStats
  };
}

const calculateAverage = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  }

  return sortedValues[middleIndex];
};

const fixedRiskThresholdForMetric = (metricName: string) => {
  const normalized = metricName.toLowerCase();

  if (normalized.includes("gpa") || normalized.includes("cgpa")) return 6;
  if (normalized.includes("rating")) return 3;
  if (
    normalized.includes("mark")
    || normalized.includes("marks")
    || normalized.includes("score")
    || normalized.includes("grade")
    || normalized.includes("percent")
  ) {
    return 60;
  }

  return null;
};

const dedupeCharts = (charts: ChartConfig[]) => {
  const seen = new Set<string>();

  return charts.filter((chart) => {
    const key = `${chart.title}|${chart.xKey}|${chart.yKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sumColumn = (rows: DatasetRow[], columnName: string) =>
  rows.reduce((total, row) => total + (toNumber(row[columnName]) ?? 0), 0);

const averageColumn = (rows: DatasetRow[], columnName: string) => {
  let total = 0;
  let count = 0;
  let skippedInvalidValues = 0;

  rows.forEach((row) => {
    const value = toNumber(row[columnName]);
    if (value == null) {
      skippedInvalidValues += 1;
      return;
    }

    total += value;
    count += 1;
  });

  console.info("[analytics] average validation", {
    metric: columnName,
    dimension: "all",
    formula: "sum(values) / count(values)",
    includedValues: count,
    skippedInvalidValues,
    skippedEmptyLabels: 0,
    groupCount: count > 0 ? 1 : 0,
  });

  return count > 0 ? total / count : 0;
};


const summarizeMetrics = (rows: DatasetRow[], columns: DataColumn[]) =>
  columns.slice(0, 6).map((column) => ({
    metric: humanize(column.name),
    value: Number(sumColumn(rows, column.name).toFixed(2)),
  }));

const formatMetricValue = (columnName: string, value: number) => {
  const normalized = columnName.toLowerCase();

  if (
    normalized.includes("salary")
    || normalized.includes("compensation")
    || normalized.includes("income")
    || normalized.includes("pay")
    || normalized.includes("revenue")
    || normalized.includes("amount")
    || normalized.includes("sales")
  ) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  if (normalized.includes("margin") || normalized.includes("rate")) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (normalized.includes("rating") || normalized.includes("score")) {
    return value.toFixed(1);
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
};

const iconForMetric = (columnName: string) => {
  const normalized = columnName.toLowerCase();

  if (
    normalized.includes("salary")
    || normalized.includes("compensation")
    || normalized.includes("income")
    || normalized.includes("pay")
    || normalized.includes("revenue")
    || normalized.includes("amount")
    || normalized.includes("sales")
  ) return "dollar";
  if (normalized.includes("unit") || normalized.includes("count") || normalized.includes("order")) return "package";
  if (normalized.includes("margin") || normalized.includes("rate")) return "percent";
  if (normalized.includes("rating") || normalized.includes("score")) return "star";

  return "chart";
};

export const generateDemoData = (): Dataset => {
  const demoData = generateDemoDataset();
  return {
    id: "demo-1",
    ...demoData,
    uploadedAt: new Date(),
  };
};

export const generateDemoKPIs = (data: Dataset): KPI[] => {
  const { dataset: analyticsDataset } = prepareDatasetForAnalytics(data);
  const numericColumns = getNumericColumns(analyticsDataset);
  const dimensionColumns = getDimensionColumns(analyticsDataset);
  const primaryMetric = pickPrimaryMetric(numericColumns);
  const secondaryMetric = pickSecondaryMetric(numericColumns, primaryMetric);
  const rowCount = data.rowCount || data.rows.length;
  const kpis: KPI[] = [
    { title: "Total Records", value: rowCount.toLocaleString(), icon: "rows", businessKpi: true },
  ];

  if (primaryMetric) {
    const total = sumColumn(analyticsDataset.rows, primaryMetric.name);
    kpis.push({
      title: `Total ${humanize(primaryMetric.name)}`,
      value: formatMetricValue(primaryMetric.name, total),
      icon: iconForMetric(primaryMetric.name),
      businessKpi: true,
    });
  }

  if (secondaryMetric) {
    const average = averageColumn(analyticsDataset.rows, secondaryMetric.name);
    kpis.push({
      title: `Avg ${humanize(secondaryMetric.name)}`,
      value: formatMetricValue(secondaryMetric.name, average),
      icon: iconForMetric(secondaryMetric.name),
      businessKpi: true,
    });
  } else if (dimensionColumns[0]) {
    const distinctCount = new Set(
      analyticsDataset.rows
        .map((row) => toLabel(row[dimensionColumns[0].name]))
        .filter((value): value is string => value !== null),
    ).size;

    kpis.push({
      title: `Distinct ${humanize(dimensionColumns[0].name)}`,
      value: distinctCount.toLocaleString(),
      icon: "chart",
      businessKpi: true,
    });
  }

  return kpis.slice(0, 4);
};

export const generateDemoCharts = (data: Dataset): ChartConfig[] => {
  const { dataset: analyticsDataset } = prepareDatasetForAnalytics(data);
  const numericColumns = getNumericColumns(analyticsDataset);
  const dimensionColumns = getDimensionColumns(analyticsDataset);

  if (analyticsDataset.rows.length === 0 || numericColumns.length === 0) {
    return [];
  }

  const primaryMetric = pickPrimaryMetric(numericColumns);
  const secondaryMetric = pickSecondaryMetric(numericColumns, primaryMetric);
  const primaryDimension = pickPreferredColumn(dimensionColumns, PREFERRED_DIMENSION_COLUMNS);
  const secondaryDimension = dimensionColumns.find((column) => column.name !== primaryDimension?.name);
  const tertiaryDimension = dimensionColumns.find(
    (column) => column.name !== primaryDimension?.name && column.name !== secondaryDimension?.name,
  );
  const charts: ChartConfig[] = [];

  if (primaryDimension && primaryMetric) {
    const primaryAggregation = metricAggregationForColumn(primaryMetric.name);
    const series = groupMetricByDimension(analyticsDataset.rows, primaryDimension, primaryMetric, primaryAggregation);
    if (series.length > 0) {
      charts.push({
        type: primaryDimension.name === "month" || primaryDimension.type === "date" ? "area" : "bar",
        title: `${primaryAggregation === "average" ? "Average " : ""}${humanize(primaryMetric.name)} by ${humanize(primaryDimension.name)}`,
        xKey: primaryDimension.name,
        yKey: primaryMetric.name,
        data: series,
      });
    }
  }

  if (secondaryDimension) {
    const shouldUseCountPie = secondaryDimension.name.toLowerCase() === "education";
    const pieMetric = primaryMetric && metricAggregationForColumn(primaryMetric.name) === "sum"
      ? primaryMetric
      : numericColumns.find((column) => metricAggregationForColumn(column.name) === "sum");
    const series = shouldUseCountPie
      ? countRowsByDimension(analyticsDataset.rows, secondaryDimension)
      : pieMetric
      ? groupMetricByDimension(analyticsDataset.rows, secondaryDimension, pieMetric, "sum")
      : countRowsByDimension(analyticsDataset.rows, secondaryDimension);
    if (series.length > 0) {
      charts.push({
        type: series.length <= 6 ? "pie" : "bar",
        title: shouldUseCountPie
          ? `Count by ${humanize(secondaryDimension.name)}`
          : pieMetric
          ? `${humanize(pieMetric.name)} by ${humanize(secondaryDimension.name)}`
          : `Count by ${humanize(secondaryDimension.name)}`,
        xKey: secondaryDimension.name,
        yKey: shouldUseCountPie ? "count" : (pieMetric?.name ?? "count"),
        data: series,
      });
    }
  }

  if (primaryDimension && secondaryMetric) {
    const secondaryAggregation = metricAggregationForColumn(secondaryMetric.name);
    const series = groupMetricByDimension(analyticsDataset.rows, primaryDimension, secondaryMetric, secondaryAggregation);
    if (series.length > 0) {
      charts.push({
        type: primaryDimension.type === "date" ? "line" : "bar",
        title: `${secondaryAggregation === "average" ? "Average " : ""}${humanize(secondaryMetric.name)} by ${humanize(primaryDimension.name)}`,
        xKey: primaryDimension.name,
        yKey: secondaryMetric.name,
        data: series,
      });
    }
  }

  if (secondaryDimension && primaryMetric) {
    const averageSeries = groupMetricByDimension(analyticsDataset.rows, secondaryDimension, primaryMetric, "average");
    if (averageSeries.length > 0) {
      charts.push({
        type: "line",
        title: `Average ${humanize(primaryMetric.name)} by ${humanize(secondaryDimension.name)}`,
        xKey: secondaryDimension.name,
        yKey: primaryMetric.name,
        data: averageSeries,
      });
    }
  }

  if (tertiaryDimension) {
    const countSeries = countRowsByDimension(analyticsDataset.rows, tertiaryDimension);
    if (countSeries.length > 0) {
      charts.push({
        type: countSeries.length <= 6 ? "pie" : "bar",
        title: `Count by ${humanize(tertiaryDimension.name)}`,
        xKey: tertiaryDimension.name,
        yKey: "count",
        data: countSeries,
      });
    }
  }

  if (primaryMetric && secondaryMetric) {
    // Skip scatter chart if it's salary vs experience (handled by analytics engine)
    const isSalaryVsExperience = 
      (normalizeText(primaryMetric.name).includes('salary') && normalizeText(secondaryMetric.name).includes('experience')) ||
      (normalizeText(primaryMetric.name).includes('experience') && normalizeText(secondaryMetric.name).includes('salary'));
    
    if (!isSalaryVsExperience) {
      const scatterData = analyticsDataset.rows
        .map((row) => {
          const x = toNumber(row[secondaryMetric.name]);
          const y = toNumber(row[primaryMetric.name]);
          const label = primaryDimension ? toLabel(row[primaryDimension.name]) : null;

          if (x == null || y == null) return null;

          return {
            [secondaryMetric.name]: x,
            [primaryMetric.name]: y,
            label: label ?? "Value",
          };
        })
        .filter((entry): entry is ChartDatum & { label: string } => entry !== null)
        .slice(0, 250);

      if (scatterData.length > 0) {
        charts.push({
          type: "scatter",
          title: `${humanize(primaryMetric.name)} vs ${humanize(secondaryMetric.name)}`,
          xKey: secondaryMetric.name,
          yKey: primaryMetric.name,
          data: scatterData,
        });
      }
    }
  }

  if (charts.length === 0) {
    const summary = summarizeMetrics(analyticsDataset.rows, numericColumns);
    if (summary.length > 0) {
      charts.push({
        type: "bar",
        title: "Metric Totals",
        xKey: "metric",
        yKey: "value",
        data: summary,
      });
    }
  }

  return dedupeCharts(charts).slice(0, 12);
};

export const generateAnalyticsHealthSummary = (data: Dataset): AnalyticsHealthSummary => {
  const { dataset: analyticsDataset, integrity } = prepareDatasetForAnalytics(data);
  const numericColumns = getNumericColumns(analyticsDataset);
  const branchColumn = analyticsDataset.columns.find((column) => normalizeText(column.name).includes("branch"));
  const riskMetric = numericColumns.find((column) =>
    ["mark", "marks", "score", "grade", "gpa", "cgpa", "rating"].some((hint) => column.name.toLowerCase().includes(hint)),
  ) ?? pickPrimaryMetric(numericColumns);

  const riskValues = riskMetric
    ? analyticsDataset.rows
        .map((row) => toNumber(row[riskMetric.name]))
        .filter((value): value is number => value != null)
    : [];
  const average = riskValues.length > 0 ? Number(calculateAverage(riskValues).toFixed(2)) : null;
  const fixedThreshold = riskMetric ? fixedRiskThresholdForMetric(riskMetric.name) : null;
  const derivedThreshold = riskValues.length > 0 ? Number(calculateMedian(riskValues).toFixed(2)) : null;
  const threshold = fixedThreshold ?? derivedThreshold;
  const rule = riskMetric
    ? fixedThreshold != null
      ? `HIGH if average ${humanize(riskMetric.name)} is below ${fixedThreshold}`
      : `HIGH if average ${humanize(riskMetric.name)} is below the dataset median`
    : "Risk unavailable because no numeric metric was found";
  const level = average != null && threshold != null && average < threshold ? "HIGH" : "LOW";

  let totalGroups = 0;
  let includedGroups = 0;

  if (branchColumn) {
    const branchCounts = new Map<string, number>();
    analyticsDataset.rows.forEach((row) => {
      const label = normalizeDimensionLabel(branchColumn.name, row[branchColumn.name]);
      if (!label) return;
      branchCounts.set(label, (branchCounts.get(label) ?? 0) + 1);
    });

    totalGroups = branchCounts.size;
    includedGroups = [...branchCounts.values()].filter((count) => count >= BRANCH_MINIMUM_GROUP_COUNT).length;
  }

  return {
    integrity,
    risk: {
      level,
      metricName: riskMetric?.name ?? null,
      average,
      threshold,
      rule,
    },
    branchCoverage: {
      totalGroups,
      includedGroups,
      excludedGroups: Math.max(totalGroups - includedGroups, 0),
      minimumGroupCount: BRANCH_MINIMUM_GROUP_COUNT,
    },
  };
};
