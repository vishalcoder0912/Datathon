/**
 * @file tools.js
 * @description Built-in tool catalog — every tool available to the Tool Router Agent.
 *
 * Each entry in BUILTIN_TOOLS describes a tool's:
 *  - Metadata (id, name, category)
 *  - Input requirements (column roles it needs)
 *  - Output types (what metrics/results it produces)
 *  - Agent preference (which agents are most likely to select this tool)
 *  - Cost estimation function (helps the router avoid expensive tools on large datasets)
 *
 * Add new tools by appending entries here — no changes to core agent code required.
 */

// ---------------------------------------------------------------------------
// Tool categories
// ---------------------------------------------------------------------------
export const TOOL_CATEGORIES = Object.freeze({
  STATISTICAL:  'statistical',
  ML:           'ml',
  TEXT:         'text',
  TIME_SERIES:  'time_series',
  AGGREGATION:  'aggregation',
});

// ---------------------------------------------------------------------------
// Column role constants (match schema-normalizer output)
// ---------------------------------------------------------------------------
export const COLUMN_ROLES = Object.freeze({
  MEASURE:   'measure',
  DIMENSION: 'dimension',
  TIME:      'time',
  KEY:       'key',
  UNIQUE:    'unique',
});

// ---------------------------------------------------------------------------
// BUILTIN_TOOLS
// ---------------------------------------------------------------------------

/** @type {ToolDescriptor[]} */
export const BUILTIN_TOOLS = [

  // ── Statistical ──────────────────────────────────────────────────────────

  {
    id:              'tool-summary-stats',
    name:            'Summary Statistics',
    description:     'Compute mean, median, std-dev, min, max, percentiles for numeric columns.',
    category:        TOOL_CATEGORIES.STATISTICAL,
    requires:        [COLUMN_ROLES.MEASURE],
    produces:        ['summary_statistics'],
    agentPreference: ['analytics-planner', 'executor'],
    costEstimate:    (rowCount) => rowCount * 0.00005,  // seconds
    priority:        10,  // Always runs first
  },

  {
    id:              'tool-correlation',
    name:            'Correlation Analysis',
    description:     'Compute Pearson correlation matrix between all numeric columns.',
    category:        TOOL_CATEGORIES.STATISTICAL,
    requires:        [COLUMN_ROLES.MEASURE, COLUMN_ROLES.MEASURE],
    produces:        ['correlation_matrix', 'correlation_insights'],
    agentPreference: ['analytics-planner', 'critic'],
    costEstimate:    (rowCount) => rowCount * 0.0001,
    priority:        8,
  },

  {
    id:              'tool-anomaly',
    name:            'Anomaly Detection',
    description:     'Detect statistical outliers in numeric columns using IQR / Z-score.',
    category:        TOOL_CATEGORIES.STATISTICAL,
    requires:        [COLUMN_ROLES.MEASURE],
    produces:        ['anomalies', 'anomaly_insights'],
    agentPreference: ['critic'],
    costEstimate:    (rowCount) => rowCount * 0.0002,
    priority:        7,
  },

  {
    id:              'tool-distribution',
    name:            'Distribution Analysis',
    description:     'Analyse value distributions, skewness, kurtosis per numeric column.',
    category:        TOOL_CATEGORIES.STATISTICAL,
    requires:        [COLUMN_ROLES.MEASURE],
    produces:        ['distribution_data'],
    agentPreference: ['analytics-planner'],
    costEstimate:    (rowCount) => rowCount * 0.00008,
    priority:        6,
  },

  // ── Aggregation ───────────────────────────────────────────────────────────

  {
    id:              'tool-group-agg',
    name:            'Group Aggregation',
    description:     'Group rows by dimensions and compute sum/avg/count per group.',
    category:        TOOL_CATEGORIES.AGGREGATION,
    requires:        [COLUMN_ROLES.DIMENSION, COLUMN_ROLES.MEASURE],
    produces:        ['group_aggregations', 'top_n_groups'],
    agentPreference: ['analytics-planner', 'executor'],
    costEstimate:    (rowCount) => rowCount * 0.00006,
    priority:        9,
  },

  {
    id:              'tool-top-n',
    name:            'Top-N Ranking',
    description:     'Rank dimension values by a measure and return top / bottom N.',
    category:        TOOL_CATEGORIES.AGGREGATION,
    requires:        [COLUMN_ROLES.DIMENSION, COLUMN_ROLES.MEASURE],
    produces:        ['top_n_ranking'],
    agentPreference: ['analytics-planner'],
    costEstimate:    (rowCount) => rowCount * 0.00004,
    priority:        8,
  },

  // ── Time Series ───────────────────────────────────────────────────────────

  {
    id:              'tool-time-trend',
    name:            'Time Trend Analysis',
    description:     'Aggregate measures over time buckets (day/week/month/quarter/year).',
    category:        TOOL_CATEGORIES.TIME_SERIES,
    requires:        [COLUMN_ROLES.TIME, COLUMN_ROLES.MEASURE],
    produces:        ['time_series', 'trend_direction', 'growth_rate'],
    agentPreference: ['analytics-planner'],
    costEstimate:    (rowCount) => rowCount * 0.00007,
    priority:        9,
  },

  {
    id:              'tool-period-comparison',
    name:            'Period-over-Period Comparison',
    description:     'Compare metric values across time periods (MoM, QoQ, YoY).',
    category:        TOOL_CATEGORIES.TIME_SERIES,
    requires:        [COLUMN_ROLES.TIME, COLUMN_ROLES.MEASURE],
    produces:        ['period_comparison', 'growth_pct'],
    agentPreference: ['analytics-planner'],
    costEstimate:    (rowCount) => rowCount * 0.0001,
    priority:        7,
  },

  // ── ML ────────────────────────────────────────────────────────────────────

  {
    id:              'tool-segmentation',
    name:            'Customer Segmentation (K-Means)',
    description:     'Cluster rows into segments using k-means on numeric features.',
    category:        TOOL_CATEGORIES.ML,
    requires:        [COLUMN_ROLES.MEASURE],
    produces:        ['segments', 'segment_profiles'],
    agentPreference: ['analytics-planner'],
    costEstimate:    (rowCount) => Math.min(rowCount * 0.001, 30),
    priority:        5,
    minRows:         50,  // Don't run on tiny datasets
  },

  {
    id:              'tool-prediction',
    name:            'Trend Prediction (Linear Regression)',
    description:     'Fit a linear trend on a time series and predict future values.',
    category:        TOOL_CATEGORIES.ML,
    requires:        [COLUMN_ROLES.TIME, COLUMN_ROLES.MEASURE],
    produces:        ['predictions', 'forecast'],
    agentPreference: ['analytics-planner'],
    costEstimate:    (rowCount) => rowCount * 0.0005,
    priority:        4,
    minRows:         30,
  },

  // ── Text ──────────────────────────────────────────────────────────────────

  {
    id:              'tool-value-frequency',
    name:            'Value Frequency Analysis',
    description:     'Count occurrences of each unique value in categorical/text columns.',
    category:        TOOL_CATEGORIES.TEXT,
    requires:        [COLUMN_ROLES.DIMENSION],
    produces:        ['value_frequency', 'cardinality_report'],
    agentPreference: ['analytics-planner', 'executor'],
    costEstimate:    (rowCount) => rowCount * 0.00003,
    priority:        8,
  },

];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Find tools that satisfy a set of available column roles.
 *
 * @param {string[]} availableRoles  - e.g. ['measure', 'dimension', 'time']
 * @returns {ToolDescriptor[]}       - Matching tools sorted by priority (desc)
 */
export function findCompatibleTools(availableRoles) {
  const roleSet = new Set(availableRoles);

  return BUILTIN_TOOLS
    .filter(tool =>
      tool.requires.every(requiredRole => roleSet.has(requiredRole))
    )
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Find a single tool by ID.
 *
 * @param {string} toolId
 * @returns {ToolDescriptor|undefined}
 */
export function getToolById(toolId) {
  return BUILTIN_TOOLS.find(t => t.id === toolId);
}

/**
 * Estimate total execution cost for a set of tools.
 *
 * @param {string[]} toolIds
 * @param {number}   rowCount
 * @returns {number}  Estimated seconds
 */
export function estimateTotalCost(toolIds, rowCount) {
  return toolIds.reduce((total, id) => {
    const tool = getToolById(id);
    return total + (tool ? tool.costEstimate(rowCount) : 0);
  }, 0);
}

export default BUILTIN_TOOLS;
