/**
 * Local Calculation Engine Service
 *
 * Computes actual KPI and chart values from the dataset locally.
 * No AI involved - pure deterministic data calculation.
 */

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculateMedian(sortedValues) {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

function extractNumericValues(rows, metric) {
  return rows
    .map(row => safeNumber(row[metric]))
    .filter(v => v !== null);
}

function matchesFilter(row, filter) {
  if (!filter || !filter.column) return true;
  const actual = row[filter.column];
  const expected = filter.value;
  const operator = String(filter.operator || 'equals').toLowerCase();
  const actualText = String(actual ?? '').trim().toLowerCase();
  const expectedText = String(expected ?? '').trim().toLowerCase();
  const actualNumber = safeNumber(actual);
  const expectedNumber = safeNumber(expected);

  switch (operator) {
    case 'not_equals':
      return actualText !== expectedText;
    case 'contains':
      return actualText.includes(expectedText);
    case 'gt':
      return actualNumber !== null && expectedNumber !== null && actualNumber > expectedNumber;
    case 'gte':
      return actualNumber !== null && expectedNumber !== null && actualNumber >= expectedNumber;
    case 'lt':
      return actualNumber !== null && expectedNumber !== null && actualNumber < expectedNumber;
    case 'lte':
      return actualNumber !== null && expectedNumber !== null && actualNumber <= expectedNumber;
    case 'equals':
    default:
      return actualText === expectedText;
  }
}

function applyConfigFilters(rows, config = {}) {
  const filters = Array.isArray(config.filters)
    ? config.filters
    : Object.entries(config.filters || {}).map(([column, value]) => ({ column, operator: 'equals', value }));

  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

/**
 * Calculate KPI values from dataset
 */
export function calculateKPI(dataset, kpiConfig) {
  if (!dataset || !Array.isArray(dataset.rows)) {
    return { value: null, calculated: false, reason: 'Invalid dataset' };
  }

  const rows = applyConfigFilters(dataset.rows, kpiConfig);
  const { metric, aggregation } = kpiConfig;
  const aggregationLower = (aggregation || 'avg').toLowerCase();

  if (metric === '__row_count__') {
    return { value: rows.length, calculated: true, rowsProcessed: rows.length };
  }

  if (metric === '__column_count__') {
    return { value: (dataset.columns || []).length, calculated: true };
  }

  const values = extractNumericValues(rows, metric);

  if (values.length === 0) {
    return { value: null, calculated: false, reason: `No numeric values found for "${metric}"` };
  }

  let value;

  switch (aggregationLower) {
    case 'sum':
      value = values.reduce((a, b) => a + b, 0);
      break;
    case 'avg':
    case 'average':
      value = values.reduce((a, b) => a + b, 0) / values.length;
      break;
    case 'min':
      value = Math.min(...values);
      break;
    case 'max':
      value = Math.max(...values);
      break;
    case 'median':
      value = calculateMedian([...values].sort((a, b) => a - b));
      break;
    case 'count':
      value = values.length;
      break;
    case 'count_unique':
      value = new Set(values).size;
      break;
    default:
      return { value: null, calculated: false, reason: `Unknown aggregation: ${aggregation}` };
  }

  return {
    value: Number.isFinite(value) ? Number(value.toFixed(2)) : value,
    calculated: true,
    rowsProcessed: rows.length,
    validValuesFound: values.length,
    missingValuesSkipped: rows.length - values.length,
  };
}

/**
 * Calculate chart data from dataset
 * Returns grouped, aggregated data ready for frontend
 */
export function calculateChartData(dataset, chartConfig) {
  if (!dataset || !Array.isArray(dataset.rows)) {
    return { data: [], rowsProcessed: 0, groupsCreated: 0, groupsShown: 0 };
  }

  const rows = applyConfigFilters(dataset.rows, chartConfig);
  const {
    x,
    y,
    chart_type,
    aggregation = 'count',
    limit = 50,
    sortByValue = true,
  } = chartConfig;

  const xKey = x || chartConfig.xKey;
  const yKey = y || chartConfig.yKey;
  const aggregationLower = (aggregation || 'count').toLowerCase();

  if (!xKey) {
    return { data: [], rowsProcessed: 0, groupsCreated: 0, groupsShown: 0, error: 'No X column specified' };
  }

  const grouped = new Map();

  for (const row of rows) {
    const xVal = row[xKey] !== null && row[xKey] !== undefined ? String(row[xKey]) : 'Unknown';

    if (!grouped.has(xVal)) {
      grouped.set(xVal, { values: [], count: 0, xValue: xVal });
    }

    const group = grouped.get(xVal);
    group.count += 1;

    if (yKey && yKey !== 'count') {
      const numVal = safeNumber(row[yKey]);
      if (numVal !== null) {
        group.values.push(numVal);
      }
    }
  }

  const aggregated = [];

  for (const [xVal, group] of grouped.entries()) {
    const entry = { [xKey]: xVal, count: group.count };

    if (yKey && yKey !== 'count' && group.values.length > 0) {
      const sorted = [...group.values].sort((a, b) => a - b);

      switch (aggregationLower) {
        case 'sum':
          entry[yKey] = group.values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
        case 'average':
          entry[yKey] = group.values.reduce((a, b) => a + b, 0) / group.values.length;
          break;
        case 'min':
          entry[yKey] = Math.min(...group.values);
          break;
        case 'max':
          entry[yKey] = Math.max(...group.values);
          break;
        case 'median':
          entry[yKey] = calculateMedian(sorted);
          break;
        default:
          entry[yKey] = group.values.length;
      }

      if (typeof entry[yKey] === 'number') {
        entry[yKey] = Number(entry[yKey].toFixed(2));
      }
    } else if (yKey && yKey !== 'count') {
      entry[yKey] = 0;
    }

    aggregated.push(entry);
  }

  if (sortByValue) {
    const sortKey = (yKey && yKey !== 'count') ? yKey : 'count';
    aggregated.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));
  }

  const limited = aggregated.slice(0, limit);

  return {
    data: limited,
    rowsProcessed: rows.length,
    groupsCreated: grouped.size,
    groupsShown: limited.length,
    aggregation: aggregationLower,
    totalGroups: grouped.size,
  };
}

/**
 * Calculate multiple KPIs at once
 */
export function calculateKPIs(dataset, kpiConfigs) {
  const results = {};
  for (const config of (kpiConfigs || [])) {
    if (!config.id && !config.title) continue;
    const id = config.id || config.title;
    results[id] = calculateKPI(dataset, config);
  }
  return results;
}

/**
 * Calculate multiple charts at once
 */
export function calculateChartDataBatch(dataset, chartConfigs) {
  const results = {};
  for (const config of (chartConfigs || [])) {
    if (!config.id && !config.title) continue;
    const id = config.id || config.title;
    results[id] = calculateChartData(dataset, config);
  }
  return results;
}

/**
 * Calculate all dashboard data from validated actions
 */
export function calculateDashboardData(dataset, validatedActions) {
  const kpiResults = {};
  const chartResults = {};

  for (const action of (validatedActions || [])) {
    if (action.action === 'create_kpi') {
      const id = action.id || action.title;
      kpiResults[id] = calculateKPI(dataset, action);
    } else if (action.action === 'create_chart') {
      const id = action.id || action.title;
      chartResults[id] = calculateChartData(dataset, action);
    }
  }

  return { kpiResults, chartResults };
}
