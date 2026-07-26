// Shared Analytics Library
// Common functions used by both frontend and backend for data processing and analytics

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PREFERRED_NUMERIC_COLUMNS = [
  "salary_usd",
  "salary",
  "compensation",
  "income",
  "pay",
  "revenue",
  "sales",
  "amount",
  "units_sold",
  "units",
  "profit_margin",
  "customer_rating",
];
const PREFERRED_DIMENSION_COLUMNS = ["month", "date", "category", "region", "segment", "country", "education", "company_size"];
const NON_ADDITIVE_METRIC_HINTS = ["margin", "rate", "ratio", "percent", "percentage", "rating", "score", "mark", "marks", "grade", "gpa", "cgpa"];
const BRANCH_MINIMUM_GROUP_COUNT = 2;

/**
 * Convert a value to a number if possible
 * @param {any} value - The value to convert
 * @returns {number|null} - The converted number or null
 */
export const toNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

/**
 * Infer the type of a column from sample values
 * @param {any[]} values - Array of sample values
 * @returns {string} - The inferred type: "number", "date", or "string"
 */
export const inferType = (values) => {
  const sample = values.filter(Boolean).slice(0, 20);
  if (sample.length === 0) return "string";
  if (sample.every((value) => !Number.isNaN(Number(value)))) return "number";
  if (sample.every((value) => !Number.isNaN(Date.parse(value)))) return "date";
  return "string";
};

/**
 * Normalize column definitions from raw data
 * @param {Object[]} rows - Dataset rows
 * @param {Object[]} providedColumns - Optional pre-defined columns
 * @returns {Object[]} - Normalized column definitions
 */
export const normalizeColumns = (rows, providedColumns = []) => {
  if (providedColumns.length > 0) {
    return providedColumns.map((column) => ({
      name: column.name,
      type: column.type || inferType(rows.slice(0, 20).map((row) => String(row[column.name] ?? ""))),
      sample: Array.isArray(column.sample) ? column.sample.map((value) => String(value)) : [],
    }));
  }

  const fields = Object.keys(rows[0] || {});
  return fields.map((name) => ({
    name,
    type: inferType(rows.slice(0, 20).map((row) => String(row[name] ?? ""))),
    sample: rows.slice(0, 3).map((row) => String(row[name] ?? "")),
  }));
};

/**
 * Humanize a string by converting snake_case or camelCase to Title Case
 * @param {string} value - The string to humanize
 * @returns {string} - Humanized string
 */
export const humanize = (value) =>
  value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

/**
 * Pick a preferred column from a list based on preferred names
 * @param {Object[]} columns - Array of column definitions
 * @param {string[]} preferredNames - Array of preferred column names
 * @returns {Object|null} - The matched column or the first column
 */
export const pickPreferredColumn = (columns, preferredNames) => {
  for (const name of preferredNames) {
    const found = columns.find((column) => column.name === name);
    if (found) return found;
  }

  return columns[0];
};

/**
 * Determine the appropriate aggregation for a metric column
 * @param {string} columnName - The column name
 * @returns {string} - "average" or "sum"
 */
export const metricAggregationForColumn = (columnName) =>
  NON_ADDITIVE_METRIC_HINTS.some((hint) => columnName.toLowerCase().includes(hint)) ? "average" : "sum";

/**
 * Sort labels based on their type (months, dates, or alphabetical)
 * @param {string[]} labels - Array of labels to sort
 * @param {string} columnType - The column type
 * @returns {string[]} - Sorted labels
 */
export const sortLabels = (labels, columnType) => {
  const uniqueLabels = [...new Set(labels)];
  const monthIndex = new Map(MONTHS.map((month, index) => [month.toLowerCase(), index]));

  if (uniqueLabels.length > 0 && uniqueLabels.every((label) => monthIndex.has(String(label).toLowerCase()))) {
    return [...uniqueLabels].sort(
      (left, right) => (monthIndex.get(String(left).toLowerCase()) ?? 99) - (monthIndex.get(String(right).toLowerCase()) ?? 99),
    );
  }

  if (columnType === "date") {
    return [...uniqueLabels].sort((left, right) => Date.parse(left) - Date.parse(right));
  }

  return [...uniqueLabels].sort((left, right) => String(left).localeCompare(String(right)));
};

/**
 * Convert a value to a label string
 * @param {any} value - The value to convert
 * @returns {string|null} - The label or null
 */
export const toLabel = (value) => {
  if (value == null) return null;
  const label = String(value).trim();
  return label || null;
};

/**
 * Normalize text for comparison
 * @param {string} value - The text to normalize
 * @returns {string} - Normalized text
 */
export const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Normalize gender labels to standard values
 * @param {string} label - The gender label
 * @returns {string} - Normalized gender label
 */
export const normalizeGenderLabel = (label) => {
  const normalized = normalizeText(label);

  if (["m", "male", "man", "boy"].includes(normalized)) return "Male";
  if (["f", "female", "woman", "girl"].includes(normalized)) return "Female";
  if (["other", "others", "non binary", "nonbinary"].includes(normalized)) return "Other";

  return label;
};

/**
 * Normalize board labels to standard values
 * @param {string} label - The board label
 * @returns {string} - Normalized board label
 */
export const normalizeBoardLabel = (label) => {
  const normalized = normalizeText(label);

  if (normalized === "cbse") return "CBSE";
  if (normalized === "icse") return "ICSE";
  if (normalized === "igcse") return "IGCSE";
  if (normalized === "ib") return "IB";
  if (normalized === "state board" || normalized === "stateboard") return "State Board";

  return label;
};

/**
 * Normalize dimension labels based on column type
 * @param {string} columnName - The column name
 * @param {any} value - The value to normalize
 * @returns {string|null} - Normalized label or null
 */
export const normalizeDimensionLabel = (columnName, value) => {
  const label = toLabel(value);
  if (!label) return null;

  const normalizedColumnName = normalizeText(columnName);
  if (normalizedColumnName.includes("gender")) {
    return normalizeGenderLabel(label);
  }
  if (normalizedColumnName.includes("board")) {
    return normalizeBoardLabel(label);
  }

  return label;
};

/**
 * Check if a value is meaningful (not empty/null)
 * @param {any} value - The value to check
 * @returns {boolean} - Whether the value is meaningful
 */
export const isMeaningfulValue = (value) => {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

/**
 * Get the minimum group count for a dimension (branch-specific)
 * @param {Object} dimensionColumn - The dimension column
 * @returns {number} - The minimum group count
 */
export const getMinimumGroupCount = (dimensionColumn) =>
  normalizeText(dimensionColumn.name).includes("branch") ? BRANCH_MINIMUM_GROUP_COUNT : 1;

/**
 * Filter grouped entries based on minimum group count
 * @param {Array} entries - Grouped entries
 * @param {Object} dimensionColumn - The dimension column
 * @param {Object} metricColumn - The metric column (optional)
 * @returns {Array} - Filtered entries
 */
export const filterGroupedEntries = (entries, dimensionColumn, metricColumn) => {
  const minimumGroupCount = getMinimumGroupCount(dimensionColumn);
  if (minimumGroupCount <= 1) {
    return entries;
  }

  const filteredEntries = entries.filter(([, entry]) => entry.count >= minimumGroupCount);
  const excludedGroups = entries.length - filteredEntries.length;

  if (excludedGroups > 0) {
    console.info("[analytics] group threshold validation", {
      dimension: dimensionColumn.name,
      metric: metricColumn?.name ?? "count",
      minimumGroupCount,
      excludedGroups,
    });
  }

  return filteredEntries;
};

/**
 * Group and aggregate metric values by dimension
 * @param {Object[]} rows - Dataset rows
 * @param {Object} dimensionColumn - The dimension column
 * @param {Object} metricColumn - The metric column
 * @param {string} aggregation - The aggregation method ("sum" or "average")
 * @returns {Object[]} - Aggregated data
 */
export const groupMetricByDimension = (rows, dimensionColumn, metricColumn, aggregation = "sum") => {
  const grouped = new Map();
  let includedValues = 0;
  let skippedInvalidValues = 0;
  let skippedEmptyLabels = 0;

  rows.forEach((row) => {
    const label = normalizeDimensionLabel(dimensionColumn.name, row[dimensionColumn.name]);
    const value = toNumber(row[metricColumn.name]);

    if (!label) {
      skippedEmptyLabels += 1;
      return;
    }

    if (value == null) {
      skippedInvalidValues += 1;
      return;
    }

    const current = grouped.get(label) ?? { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    grouped.set(label, current);
    includedValues += 1;
  });

  const groupedEntries = filterGroupedEntries([...grouped.entries()], dimensionColumn, metricColumn);
  const series = sortLabels(groupedEntries.map(([label]) => label), dimensionColumn.type).map((label) => {
    const entry = grouped.get(label) ?? { sum: 0, count: 0 };
    const value = aggregation === "average" && entry.count > 0 ? entry.sum / entry.count : entry.sum;

    return {
      [dimensionColumn.name]: label,
      [metricColumn.name]: Number(value.toFixed(2)),
    };
  });

  if (aggregation === "average") {
    console.info("[analytics] average validation", {
      metric: metricColumn.name,
      dimension: dimensionColumn.name,
      formula: "sum(values) / count(values)",
      includedValues,
      skippedInvalidValues,
      skippedEmptyLabels,
      groupCount: series.length,
    });
  }

  return series;
};

/**
 * Count rows by dimension
 * @param {Object[]} rows - Dataset rows
 * @param {Object} dimensionColumn - The dimension column
 * @param {string} valueKey - The key for the count value
 * @returns {Object[]} - Counted data
 */
export const countRowsByDimension = (rows, dimensionColumn, valueKey = "count") => {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = normalizeDimensionLabel(dimensionColumn.name, row[dimensionColumn.name]);
    if (!label) return;
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });

  const groupedEntries = filterGroupedEntries(
    [...grouped.entries()].map(([label, count]) => [label, { count }]),
    dimensionColumn,
    null,
  );

  return sortLabels(groupedEntries.map(([label]) => label), dimensionColumn.type).map((label) => ({
    [dimensionColumn.name]: label,
    [valueKey]: grouped.get(label) ?? 0,
  }));
};

/**
 * Count rows matching specific dimension values
 * @param {Object[]} rows - Dataset rows
 * @param {Object} dimensionColumn - The dimension column
 * @param {any[]} matchValues - Values to match
 * @param {string} valueKey - The key for the count value
 * @returns {Object[]} - Counted data
 */
export const countRowsMatchingValues = (rows, dimensionColumn, matchValues, valueKey = "count") => {
  const requestedValues = new Set(matchValues);
  const grouped = new Map(matchValues.map((value) => [value, 0]));

  rows.forEach((row) => {
    const label = normalizeDimensionLabel(dimensionColumn.name, row[dimensionColumn.name]);
    if (!label || !requestedValues.has(label)) return;
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });

  return matchValues.map((value) => ({
    [dimensionColumn.name]: value,
    [valueKey]: grouped.get(value) ?? 0,
  }));
};

/**
 * Prepare dataset for analytics by sanitizing and validating
 * @param {Object} dataset - The dataset object
 * @returns {Object} - Prepared dataset
 */
export const prepareDatasetForAnalytics = (dataset) => {
  const numericColumns = dataset.columns.filter((column) => column.type === "number");
  const sanitizedRows = [];
  let removedEmptyRows = 0;
  let invalidNumericValues = 0;

  dataset.rows.forEach((row) => {
    const hasMeaningfulField = dataset.columns.some((column) => isMeaningfulValue(row[column.name]));
    if (!hasMeaningfulField) {
      removedEmptyRows += 1;
      return;
    }

    const nextRow = { ...row };
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
      totalRows: dataset.rows.length,
      analyticsRows: sanitizedRows.length,
      removedEmptyRows,
      invalidNumericValues,
    });
  }

  return {
    ...dataset,
    rows: sanitizedRows,
    rowCount: sanitizedRows.length,
  };
};

/**
 * Generate demo dataset for testing
 * @returns {Object} - Demo dataset
 */
export const generateDemoDataset = () => {
  const categories = ["Electronics", "Clothing", "Food", "Software", "Services"];
  const regions = ["North", "South", "East", "West"];
  const rows = [];

  for (let index = 0; index < 200; index += 1) {
    rows.push({
      month: MONTHS[Math.floor(Math.random() * MONTHS.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      revenue: Math.floor(Math.random() * 50000) + 5000,
      units_sold: Math.floor(Math.random() * 500) + 10,
      profit_margin: Number((Math.random() * 0.4 + 0.1).toFixed(2)),
      customer_rating: Number((Math.random() * 2 + 3).toFixed(1)),
    });
  }

  return {
    name: "Sales Analytics 2024",
    sourceType: "demo",
    fileName: "sales-analytics-2024.json",
    columns: [
      { name: "month", type: "string", sample: MONTHS.slice(0, 3) },
      { name: "category", type: "string", sample: categories.slice(0, 3) },
      { name: "region", type: "string", sample: regions.slice(0, 3) },
      { name: "revenue", type: "number", sample: ["25000", "18000", "32000"] },
      { name: "units_sold", type: "number", sample: ["150", "230", "89"] },
      { name: "profit_margin", type: "number", sample: ["0.25", "0.18", "0.32"] },
      { name: "customer_rating", type: "number", sample: ["4.2", "3.8", "4.7"] },
    ],
    rows,
  };
};

/**
 * Build dataset schema for analysis
 * @param {Object} dataset - The dataset object
 * @returns {Object} - Dataset schema
 */
export const buildDatasetSchema = (dataset) => {
  const numericColumns = dataset.columns.filter((column) => column.type === "number");
  const dimensionColumns = dataset.columns.filter((column) => column.type !== "number");
  const primaryMetric = numericColumns.length > 0 ? pickPreferredColumn(numericColumns, PREFERRED_NUMERIC_COLUMNS) : null;
  const remainingMetrics = numericColumns.filter((column) => column.name !== primaryMetric?.name);
  const secondaryMetric = remainingMetrics.length > 0 ? remainingMetrics[0] : null;
  const primaryDimension = dimensionColumns.length > 0 ? pickPreferredColumn(dimensionColumns, PREFERRED_DIMENSION_COLUMNS) : null;
  const secondaryDimension = dimensionColumns.find((column) => column.name !== primaryDimension?.name) ?? null;

  return {
    datasetName: dataset.name,
    rowCount: dataset.rowCount,
    columnCount: dataset.columns.length,
    columns: dataset.columns.map((column) => ({
      name: column.name,
      type: column.type,
      sample: column.sample ?? [],
      role: column.type === "number" ? "metric" : "dimension",
      aggregation: column.type === "number" ? metricAggregationForColumn(column.name) : null,
    })),
    primaryMetric,
    secondaryMetric,
    primaryDimension,
    secondaryDimension,
  };
};

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param {number[]} x - First array of numbers
 * @param {number[]} y - Second array of numbers
 * @returns {number|null} - Correlation coefficient or null
 */
export const calculatePearsonCorrelation = (x, y) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return null;
  return numerator / denominator;
};

// Export constants for use in other modules
export const MONTHS_CONST = MONTHS;
export const PREFERRED_NUMERIC_COLUMNS_CONST = PREFERRED_NUMERIC_COLUMNS;
export const PREFERRED_DIMENSION_COLUMNS_CONST = PREFERRED_DIMENSION_COLUMNS;
export const NON_ADDITIVE_METRIC_HINTS_CONST = NON_ADDITIVE_METRIC_HINTS;
export const BRANCH_MINIMUM_GROUP_COUNT_CONST = BRANCH_MINIMUM_GROUP_COUNT;
