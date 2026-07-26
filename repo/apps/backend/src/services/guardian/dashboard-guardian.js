/**
 * Dashboard Guardian Validation Service
 *
 * Validates all AI-generated dashboard actions before applying them.
 * Ensures columns exist, types are compatible, and actions are safe.
 * NEVER allows raw data to pass through.
 */

const VALID_CHART_TYPES = new Set(['bar', 'line', 'pie', 'scatter', 'histogram', 'map', 'area', 'donut', 'horizontalBar']);
const VALID_AGGREGATIONS = new Set(['sum', 'avg', 'min', 'max', 'count', 'median', 'count_unique']);
const VALID_ACTIONS = new Set(['create_kpi', 'create_chart', 'edit_chart', 'remove_chart', 'clear_charts', 'create_filter', 'clear_filters', 'update_chart_type']);

function columnExists(schema, columnName) {
  if (!schema || !Array.isArray(schema.columns)) return false;
  return schema.columns.some(c => c.name === columnName);
}

function isNumericColumn(schema, columnName) {
  if (!schema || !Array.isArray(schema.columns)) return false;
  const col = schema.columns.find(c => c.name === columnName);
  return col && (col.type === 'number' || col.type === 'numeric');
}

function isCategoryColumn(schema, columnName) {
  if (!schema || !Array.isArray(schema.columns)) return false;
  const col = schema.columns.find(c => c.name === columnName);
  return col && (col.type === 'category' || col.type === 'string' || col.type === 'categorical');
}

function isDateColumn(schema, columnName) {
  if (!schema || !Array.isArray(schema.columns)) return false;
  const col = schema.columns.find(c => c.name === columnName);
  return col && (col.type === 'date' || /date|time|year|month|day|timestamp/i.test(col.name || ''));
}

function normalizeChartType(type) {
  if (!type) return null;
  const normalized = type.toLowerCase().replace(/[_-]/g, '');
  const typeMap = {
    bar: 'bar', bars: 'bar',
    line: 'line', lines: 'line',
    pie: 'pie',
    scatter: 'scatter', scatterplot: 'scatter',
    histogram: 'histogram',
    map: 'map',
    area: 'line', areas: 'line',
    donut: 'pie', doughnut: 'pie',
    horizontalbar: 'horizontalBar',
    horizontal_bar: 'horizontalBar',
  };
  return typeMap[normalized] || null;
}

function validateKpiAction(action, schema, dashboardState) {
  const { title, metric, aggregation } = action;

  if (!title || typeof title !== 'string') {
    return { valid: false, reason: 'KPI must have a title', suggestion: 'Provide a descriptive title' };
  }

  if (metric === '__row_count__' || metric === '__column_count__') {
    return { valid: true, fixed: { ...action, metric } };
  }

  if (!metric) {
    return { valid: false, reason: 'KPI must specify a metric column', suggestion: 'Use one of the numeric columns in the schema' };
  }

  if (!isNumericColumn(schema, metric)) {
    const available = (schema.numericColumns || schema.columns.filter(c => c.type === 'number' || c.type === 'numeric').map(c => c.name)).slice(0, 5);
    return {
      valid: false,
      reason: `Metric "${metric}" is not numeric or does not exist`,
      suggestion: available.length ? `Use one of: ${available.join(', ')}` : 'No numeric columns available',
    };
  }

  if (aggregation && !VALID_AGGREGATIONS.has(aggregation)) {
    return {
      valid: false,
      reason: `Aggregation "${aggregation}" not supported`,
      suggestion: `Use one of: ${Array.from(VALID_AGGREGATIONS).join(', ')}`,
    };
  }

  if (dashboardState?.kpis && Array.isArray(dashboardState.kpis)) {
    const duplicate = dashboardState.kpis.find(k =>
      k.metric === metric && (k.aggregation || 'avg') === (aggregation || 'avg')
    );
    if (duplicate) {
      return {
        valid: false,
        reason: `KPI for ${metric} (${aggregation || 'avg'}) already exists`,
        suggestion: 'Consider updating the existing KPI instead',
      };
    }
  }

  return { valid: true };
}

function validateChartAction(action, schema, dashboardState) {
  const { chart_type, x, y, aggregation, title } = action;

  const normalizedType = normalizeChartType(chart_type);
  if (!normalizedType) {
    return {
      valid: false,
      reason: `Chart type "${chart_type}" not supported`,
      suggestion: `Use one of: ${Array.from(VALID_CHART_TYPES).join(', ')}`,
    };
  }

  if (x && !columnExists(schema, x)) {
    const available = schema.columns.slice(0, 5).map(c => c.name);
    return {
      valid: false,
      reason: `Column "${x}" does not exist`,
      suggestion: `Available columns: ${available.join(', ')}`,
    };
  }

  if (y && y !== 'count' && !columnExists(schema, y)) {
    const available = schema.columns.slice(0, 5).map(c => c.name);
    return {
      valid: false,
      reason: `Column "${y}" does not exist`,
      suggestion: `Available columns: ${available.join(', ')}`,
    };
  }

  const typeRules = {
    bar: () => x && (isCategoryColumn(schema, x) || isDateColumn(schema, x)) && (!y || y === 'count' || isNumericColumn(schema, y)),
    horizontalBar: () => x && isCategoryColumn(schema, x) && (!y || y === 'count' || isNumericColumn(schema, y)),
    line: () => x && isDateColumn(schema, x) && (!y || y === 'count' || isNumericColumn(schema, y)),
    pie: () => x && isCategoryColumn(schema, x),
    scatter: () => x && y && isNumericColumn(schema, x) && isNumericColumn(schema, y),
    histogram: () => y && isNumericColumn(schema, y),
    map: () => schema.semanticRoles?.geography?.includes(x) || isCategoryColumn(schema, x),
    area: () => x && isDateColumn(schema, x) && (!y || y === 'count' || isNumericColumn(schema, y)),
    donut: () => x && isCategoryColumn(schema, x),
  };

  const ruleFn = typeRules[normalizedType];
  if (ruleFn && !ruleFn()) {
    return {
      valid: false,
      reason: `Chart type "${normalizedType}" incompatible with columns x="${x || ''}" y="${y || ''}"`,
      suggestion: 'bar/category+numeric, line/date+numeric, scatter/numeric+numeric, pie/category',
    };
  }

  if (dashboardState?.charts && Array.isArray(dashboardState.charts)) {
    const dupCount = dashboardState.charts.filter(c =>
      (c.xKey === x || c.x === x) && (c.yKey === y || c.y === y) && c.type === normalizedType
    ).length;
    if (dupCount >= 3) {
      return {
        valid: false,
        reason: `Too many charts with same dimensions (x="${x}", y="${y}", type="${normalizedType}")`,
        suggestion: 'Consolidate or remove duplicate charts',
      };
    }
  }

  return { valid: true, fixed: { ...action, chart_type: normalizedType } };
}

function validateEditChartAction(action, schema, dashboardState) {
  if (!action.chart_id && !action.title) {
    return {
      valid: false,
      reason: 'Edit action must specify chart_id or title',
      suggestion: 'Provide chart_id of the chart to edit',
    };
  }

  if (action.chart_type && normalizeChartType(action.chart_type)) {
    return validateChartAction(action, schema, dashboardState);
  }

  return { valid: true };
}

function validateFilterAction(action, schema) {
  if (!action.column && !action.field) {
    return {
      valid: false,
      reason: 'Filter must specify a column',
      suggestion: 'Provide the column name to filter on',
    };
  }

  const colName = action.column || action.field;
  if (!columnExists(schema, colName)) {
    return {
      valid: false,
      reason: `Column "${colName}" does not exist`,
      suggestion: 'Use a column that exists in the schema',
    };
  }

  return { valid: true };
}

export function validateAction(action, schema, dashboardState) {
  if (!action || !action.action) {
    return { valid: false, reason: 'Action must have an "action" field', suggestion: null };
  }

  if (!VALID_ACTIONS.has(action.action)) {
    return {
      valid: false,
      reason: `Unknown action type: "${action.action}"`,
      suggestion: `Valid actions: ${Array.from(VALID_ACTIONS).join(', ')}`,
    };
  }

  switch (action.action) {
    case 'create_kpi':
      return validateKpiAction(action, schema, dashboardState);
    case 'create_chart':
      return validateChartAction(action, schema, dashboardState);
    case 'edit_chart':
      return validateEditChartAction(action, schema, dashboardState);
    case 'remove_chart':
      return { valid: true };
    case 'clear_charts':
      return { valid: true };
    case 'create_filter':
      return validateFilterAction(action, schema);
    case 'clear_filters':
      return { valid: true };
    case 'update_chart_type':
      return validateChartAction(
        { ...action, chart_type: action.new_type || action.chart_type },
        schema,
        dashboardState
      );
    default:
      return { valid: false, reason: 'Unknown action', suggestion: null };
  }
}

export function validateDashboardActions(schemaPacket, currentDashboardState, aiActions) {
  const errors = [];
  const warnings = [];
  const validatedActions = [];

  if (!Array.isArray(aiActions)) {
    return {
      valid: false,
      validatedActions: [],
      errors: [{ action: 'root', reason: 'AI response did not return an array of actions', suggestion: null }],
      warnings: [],
      schemaChecks: { columnsVerified: 0, numericColumnsFound: 0, categoricalColumnsFound: 0 },
    };
  }

  for (const action of aiActions) {
    const validation = validateAction(action, schemaPacket, currentDashboardState || {});

    if (!validation.valid) {
      errors.push({
        action: action.action,
        reason: validation.reason,
        suggestion: validation.suggestion,
      });
    } else {
      validatedActions.push(validation.fixed || action);
    }
  }

  if (validatedActions.length === 0) {
    warnings.push('All actions were rejected. Consider providing more specific column/type guidance to the AI.');
  }

  const totalCharts = validatedActions.filter(a => a.action === 'create_chart').length +
    validatedActions.filter(a => a.action === 'create_kpi').length;

  if (totalCharts > 15) {
    warnings.push('Dashboard has too many elements. Keep under 15 total KPIs+charts for readability.');
  }

  return {
    valid: errors.length === 0,
    validatedActions,
    errors,
    warnings,
    schemaChecks: {
      columnsVerified: Array.isArray(schemaPacket?.columns) ? schemaPacket.columns.length : 0,
      numericColumnsFound: Array.isArray(schemaPacket?.numericColumns) ? schemaPacket.numericColumns.length : 0,
      categoricalColumnsFound: Array.isArray(schemaPacket?.categoricalColumns) ? schemaPacket.categoricalColumns.length : 0,
    },
  };
}

export function assessDashboardHealth(schemaPacket, dashboardState) {
  const issues = [];
  const warnings = [];

  const kpis = dashboardState?.kpis || [];
  const charts = dashboardState?.charts || [];

  if (!kpis.length && !charts.length) {
    issues.push({ type: 'empty_dashboard', message: 'Dashboard has no KPIs or charts' });
  }

  for (const kpi of kpis) {
    if (kpi.metric && !isNumericColumn(schemaPacket, kpi.metric)) {
      warnings.push({
        type: 'invalid_kpi_metric',
        message: `KPI "${kpi.title}" references non-numeric metric "${kpi.metric}"`,
      });
    }
  }

  for (const chart of charts) {
    const xCol = chart.xKey || chart.x;
    const yCol = chart.yKey || chart.y;

    if (xCol && !columnExists(schemaPacket, xCol)) {
      warnings.push({
        type: 'invalid_chart_column',
        message: `Chart "${chart.title}" references non-existent X column "${xCol}"`,
      });
    }

    if (yCol && yCol !== 'count' && !columnExists(schemaPacket, yCol)) {
      warnings.push({
        type: 'invalid_chart_column',
        message: `Chart "${chart.title}" references non-existent Y column "${yCol}"`,
      });
    }
  }

  const score = Math.max(0, 100 - issues.length * 25 - warnings.length * 10);

  return {
    status: issues.length ? 'failed' : warnings.length ? 'warning' : 'healthy',
    score,
    issues,
    warnings,
  };
}
