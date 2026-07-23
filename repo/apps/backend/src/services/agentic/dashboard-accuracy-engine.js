/**
 * @file dashboard-accuracy-engine.js
 * @description Dashboard Accuracy Engine
 *
 * Ensures KPI and custom chart generation are 100% schema-accurate.
 *
 * Design notes:
 * - Intentionally built on top of the existing schema-dashboard-engine.js conventions.
 *   Column roles use 'metric' | 'dimension' | 'date' | 'key' — matching enrichSchemaPacket().
 * - Does NOT replace schema-dashboard-engine.js or dashboard-ai-agent.js.
 *   Import this engine when you need validated, programmatic chart/KPI construction
 *   (e.g. from the agentic orchestrator or the /api/agentic/analyze endpoint).
 * - Every public method is synchronous except DashboardBuilder.buildDashboard().
 *
 * Key Goals:
 *   1. 100% schema compliance — no invalid column references
 *   2. Type safety — correct aggregations for column types
 *   3. Custom chart generation — unlimited chart combinations
 *   4. KPI accuracy — computed from actual row data, never invented
 *   5. Domain awareness — understands data semantics and relationships
 */

import { randomUUID } from 'node:crypto';

// ============================================================================
// CONSTANTS — kept in sync with schema-dashboard-engine.js
// ============================================================================

const VALID_CHART_TYPES = new Set([
  'bar', 'line', 'area', 'pie', 'scatter', 'histogram', 'table', 'heatmap',
]);

const VALID_AGGREGATIONS = new Set([
  'sum', 'avg', 'average', 'count', 'min', 'max', 'median',
]);

// Normalise role name to one of: 'metric' | 'dimension' | 'date' | 'key'
// This matches what enrichSchemaPacket() in schema-dashboard-engine.js produces.
const ROLE_NORMALISATION = {
  metric:    'metric',
  measure:   'metric',   // alias — the new agentic framework uses 'measure'
  dimension: 'dimension',
  date:      'date',
  time:      'date',     // alias
  key:       'key',
  id:        'key',      // alias
  unique:    'key',      // alias
};

// ============================================================================
// PART 1: ENHANCED SCHEMA
// ============================================================================

/**
 * Wraps a raw schema profile (from schema-detector or schema-normalizer) and
 * enriches it with computed metadata.
 *
 * Compatible with schemas produced by:
 *   - schema-packet-builder.js  → buildSchemaPacketAsync()
 *   - schema-normalizer.js      → SchemaNormalizer.normalize()
 *   - schema-detector.js        → schemaDetector.analyzeDataset()
 */
export class EnhancedSchema {
  /**
   * @param {object} rawSchema
   * @param {Array}  rawSchema.columns
   * @param {string} [rawSchema.name]
   * @param {number} [rawSchema.rowCount]
   */
  constructor(rawSchema) {
    if (!rawSchema || !Array.isArray(rawSchema.columns)) {
      throw new TypeError('EnhancedSchema requires a schema object with a columns array');
    }

    this.name       = rawSchema.name     ?? 'Dataset';
    this.rowCount   = rawSchema.rowCount ?? 0;
    this.columns    = this._normaliseColumns(rawSchema.columns);
    this.columnCount = this.columns.length;

    // Typed views
    this.metrics    = this.columns.filter(c => c.role === 'metric');
    this.dimensions = this.columns.filter(c => c.role === 'dimension');
    this.dates      = this.columns.filter(c => c.role === 'date');
    this.keys       = this.columns.filter(c => c.role === 'key');

    // Build a normalised-name → column lookup for O(1) resolution
    this._index = new Map();
    for (const col of this.columns) {
      this._index.set(this._normaliseKey(col.name), col);
    }
  }

  // ── Column normalisation ─────────────────────────────────────────────────

  /**
   * Normalise each raw column to a consistent shape.
   * @private
   */
  _normaliseColumns(rawColumns) {
    return rawColumns.map(col => {
      const type    = this._inferType(col);
      const rawRole = col.role ?? col.chartType ?? '';
      const role    = ROLE_NORMALISATION[rawRole.toLowerCase()] ?? this._inferRole(col, type);

      return {
        name:          col.name,
        type,
        role,
        cardinality:   col.cardinality    ?? 0,
        nullCount:     col.nullCount      ?? 0,
        domain:        col.domain         ?? col.domainTag ?? this._inferDomain(col),
        aggregatable:  type === 'numeric' || (type === 'date' && role === 'date'),
        sortable:      type !== 'text',
      };
    });
  }

  /**
   * Normalise data type into one of: numeric | date | boolean | text
   * @private
   */
  _inferType(col) {
    const t = String(col.type ?? '').toLowerCase();

    if (['integer', 'number', 'numeric', 'float', 'decimal', 'int', 'double'].includes(t))
      return 'numeric';
    if (['date', 'datetime', 'timestamp', 'time'].includes(t))
      return 'date';
    if (['boolean', 'bool'].includes(t))
      return 'boolean';

    return 'text';
  }

  /**
   * Infer column role when the raw schema doesn't supply one.
   * @private
   */
  _inferRole(col, type) {
    const name = String(col.name ?? '').toLowerCase();

    // Key: ID-like column with high cardinality
    if (/\bid\b|_id$|uuid|guid/.test(name) && (col.cardinality ?? 0) > 50)
      return 'key';

    // Date
    if (type === 'date' || /\b(date|time|datetime|timestamp|created|updated)\b/.test(name))
      return 'date';

    // Numeric → metric or dimension depending on cardinality
    if (type === 'numeric') {
      return (col.cardinality ?? 0) < 100 ? 'dimension' : 'metric';
    }

    return 'dimension';
  }

  /**
   * Infer business domain from column name.
   * @private
   */
  _inferDomain(col) {
    const name = String(col.name ?? '').toLowerCase();

    if (/salary|compensation|wage|pay|income/.test(name))      return 'compensation';
    if (/revenue|sales|invoice|transaction|order|purchase/.test(name)) return 'financial';
    if (/amount|price|cost|profit|fee|total|value/.test(name)) return 'financial';
    if (/product|item|sku|category|type/.test(name))           return 'product';
    if (/customer|user|account|person|name|contact/.test(name)) return 'customer';
    if (/date|time|month|year|quarter|week|day/.test(name))    return 'temporal';
    if (/country|region|city|location|state|address/.test(name)) return 'geographic';
    if (/department|team|group|division|role|position/.test(name)) return 'organization';
    if (/status|stage|phase|flag|active|enabled/.test(name))   return 'status';

    return 'generic';
  }

  /** Produce a normalised string key for fuzzy matching. @private */
  _normaliseKey(name) {
    return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // ── Public lookup API ────────────────────────────────────────────────────

  /**
   * Find a column by name (exact → partial → substring), optionally restricting
   * to a preferred role.
   *
   * @param {string}           name
   * @param {string|string[]}  [preferredRole]  - 'metric', 'dimension', 'date', 'key' or array
   * @returns {object|null}
   */
  findColumn(name, preferredRole = null) {
    if (!name) return null;

    const roles = preferredRole
      ? (Array.isArray(preferredRole) ? preferredRole : [preferredRole])
          .map(r => ROLE_NORMALISATION[r] ?? r)
      : null;

    const roleOk = col => !roles || roles.includes(col.role);
    const nKey   = this._normaliseKey(name);

    // 1. Exact normalised match
    const exact = this._index.get(nKey);
    if (exact && roleOk(exact)) return exact;

    // 2. Any column whose normalised name includes the query
    const partial = this.columns.find(c =>
      roleOk(c) && this._normaliseKey(c.name).includes(nKey)
    );
    if (partial) return partial;

    // 3. Query contains normalised column name
    const superstring = this.columns.find(c =>
      roleOk(c) && nKey.includes(this._normaliseKey(c.name))
    );

    return superstring ?? null;
  }

  /**
   * Validate a column reference.
   *
   * @param {string} columnName
   * @returns {{ valid: boolean, column?: object, error?: string }}
   */
  validateColumn(columnName) {
    if (!columnName) return { valid: false, error: 'Column name is required' };

    const col = this.findColumn(columnName);
    if (!col) {
      const available = this.columns.map(c => `"${c.name}"`).join(', ');
      return {
        valid: false,
        error: `Column "${columnName}" not found. Available: ${available}`,
      };
    }

    return { valid: true, column: col };
  }

  /**
   * Return column sets suited for a particular chart type.
   *
   * @param {string} chartType
   * @returns {{ x: object[], y: object[]|null }}
   */
  getRecommendedColumnsFor(chartType) {
    switch (chartType) {
      case 'scatter':    return { x: this.metrics,    y: this.metrics };
      case 'histogram':  return { x: this.metrics,    y: null };
      case 'line':
      case 'area':       return { x: this.dates.concat(this.dimensions), y: this.metrics };
      case 'pie':        return { x: this.dimensions, y: this.metrics };
      case 'bar':
      default:           return { x: this.dimensions.concat(this.dates), y: this.metrics };
    }
  }
}

// ============================================================================
// PART 2: KPI CALCULATOR
// ============================================================================

/**
 * Computes KPI values directly from row data — never invented.
 * Always validates metric column against the schema before computing.
 */
export class KPICalculator {
  /**
   * @param {EnhancedSchema} schema
   * @param {Array<object>}  rows
   */
  constructor(schema, rows) {
    if (!(schema instanceof EnhancedSchema)) {
      throw new TypeError('KPICalculator requires an EnhancedSchema instance');
    }
    this.schema = schema;
    this.rows   = Array.isArray(rows) ? rows : [];
  }

  // ── Core computation ─────────────────────────────────────────────────────

  /**
   * Compute a single aggregated value from a validated column.
   *
   * @param {string} columnName
   * @param {'sum'|'avg'|'average'|'count'|'min'|'max'|'median'} aggregation
   * @param {object} [filters={}]   - { columnName: value } equality filters
   * @returns {number}
   */
  compute(columnName, aggregation = 'sum', filters = {}) {
    const agg = aggregation.toLowerCase();

    // Special-case: count total records (no column needed)
    if (agg === 'count' && (!columnName || columnName === '*')) {
      return this._applyFilters(filters).length;
    }

    // Validate column exists
    const validation = this.schema.validateColumn(columnName);
    if (!validation.valid) throw new Error(validation.error);

    const col = validation.column;

    // Numeric aggregations require a numeric column
    if (['sum', 'avg', 'average', 'min', 'max', 'median'].includes(agg) && col.type !== 'numeric') {
      throw new Error(
        `Aggregation "${agg}" requires a numeric column — "${col.name}" is ${col.type}`
      );
    }

    const filteredRows = this._applyFilters(filters);
    const values = filteredRows
      .map(row => {
        const n = Number(row[col.name]);
        return Number.isFinite(n) ? n : null;
      })
      .filter(v => v !== null);

    if (agg === 'count') return filteredRows.length;
    if (!values.length)  return 0;

    switch (agg) {
      case 'sum':                        return values.reduce((a, b) => a + b, 0);
      case 'avg':
      case 'average':                    return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':                        return Math.min(...values);
      case 'max':                        return Math.max(...values);
      case 'median':                     return this._median(values);
      default: throw new Error(`Unknown aggregation: "${aggregation}"`);
    }
  }

  /**
   * Build a full KPI object from a specification.
   *
   * @param {object} spec
   * @param {string}  spec.title
   * @param {string}  spec.metric       - column name (or '*' for count)
   * @param {string}  [spec.aggregation='sum']
   * @param {object}  [spec.filters={}]
   * @param {string}  [spec.icon]
   * @param {string}  [spec.status]
   * @returns {object}
   */
  generateKPI(spec) {
    if (!spec.title) throw new Error('KPI spec requires a title');
    if (!spec.metric) throw new Error('KPI spec requires a metric column name');

    const aggregation = spec.aggregation ?? 'sum';
    const value       = this.compute(spec.metric, aggregation, spec.filters ?? {});

    // Resolve the column for formatting hints (may be null for '*' count)
    const col = spec.metric === '*'
      ? null
      : this.schema.findColumn(spec.metric);

    return {
      id:          randomUUID(),
      title:       spec.title,
      metric:      col?.name ?? spec.metric,
      aggregation,
      value,
      formatted:   this._formatValue(value, col),
      icon:        spec.icon   ?? 'chart-bar',
      status:      spec.status ?? 'default',
    };
  }

  /**
   * Auto-generate up to 6 sensible KPIs for a dataset.
   * Falls back gracefully when the dataset has few/no numeric columns.
   *
   * @returns {object[]}
   */
  buildDefaultKPIs() {
    const kpis = [];

    // Always: total records
    kpis.push({
      id:          randomUUID(),
      title:       'Total Records',
      metric:      '*',
      aggregation: 'count',
      value:       this.rows.length,
      formatted:   this.rows.length.toLocaleString(),
      icon:        'database',
      status:      'default',
    });

    // Top 3 metric columns → sum + avg
    for (const metric of this.schema.metrics.slice(0, 3)) {
      const total = this.compute(metric.name, 'sum');
      const avg   = this.compute(metric.name, 'avg');

      kpis.push({
        id:          randomUUID(),
        title:       `Total ${_humanize(metric.name)}`,
        metric:      metric.name,
        aggregation: 'sum',
        value:       total,
        formatted:   this._formatValue(total, metric),
        icon:        'chart-bar',
        status:      'default',
      });

      kpis.push({
        id:          randomUUID(),
        title:       `Avg ${_humanize(metric.name)}`,
        metric:      metric.name,
        aggregation: 'avg',
        value:       avg,
        formatted:   this._formatValue(avg, metric),
        icon:        'chart-line',
        status:      'default',
      });
    }

    return kpis.slice(0, 6);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Apply equality filters to rows. @private */
  _applyFilters(filters = {}) {
    const entries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!entries.length) return this.rows;

    return this.rows.filter(row =>
      entries.every(([key, val]) => {
        const col = this.schema.findColumn(key);
        if (!col) return false;
        return String(row[col.name] ?? '').toLowerCase() === String(val).toLowerCase();
      })
    );
  }

  /** Median of an already-validated numeric array. @private */
  _median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Format a number for display based on the column's domain.
   * @private
   */
  _formatValue(value, column) {
    if (typeof value !== 'number') return String(value);

    // Currency domains
    if (column?.domain === 'financial' || column?.domain === 'compensation') {
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
      if (value >= 1_000)     return `$${(value / 1_000).toFixed(1)}K`;
      return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    }

    // Large number compaction
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000)     return `${(value / 1_000).toFixed(1)}K`;

    return value.toFixed(2);
  }
}

// ============================================================================
// PART 3: CUSTOM CHART GENERATOR
// ============================================================================

/**
 * Generates chart data objects that are 100% validated against the schema.
 *
 * All chart objects produced here are wire-compatible with the shape returned by
 * executeChartSpec() in schema-dashboard-engine.js:
 *   { id, type, title, xKey, yKey, data, aggregation, rowCount }
 */
export class CustomChartGenerator {
  /**
   * @param {EnhancedSchema} schema
   * @param {Array<object>}  rows
   */
  constructor(schema, rows) {
    if (!(schema instanceof EnhancedSchema)) {
      throw new TypeError('CustomChartGenerator requires an EnhancedSchema instance');
    }
    this.schema = schema;
    this.rows   = Array.isArray(rows) ? rows : [];
  }

  // ── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate a chart specification before attempting to generate data.
   *
   * @param {object} spec
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateChartSpec(spec) {
    const errors = [];

    if (!VALID_CHART_TYPES.has(spec.type)) {
      errors.push(`Unknown chart type "${spec.type}". Valid: ${[...VALID_CHART_TYPES].join(', ')}`);
    }

    if (spec.aggregation && !VALID_AGGREGATIONS.has(spec.aggregation.toLowerCase())) {
      errors.push(`Unknown aggregation "${spec.aggregation}". Valid: ${[...VALID_AGGREGATIONS].join(', ')}`);
    }

    // Type-specific column requirements
    if (spec.type === 'histogram') {
      const v = spec.xKey ? this.schema.validateColumn(spec.xKey) : { valid: false, error: 'xKey required' };
      if (!v.valid) errors.push(`Histogram: ${v.error}`);
      else if (v.column.type !== 'numeric') errors.push('Histogram requires a numeric column');

    } else if (spec.type === 'scatter') {
      const vx = spec.xKey ? this.schema.validateColumn(spec.xKey) : { valid: false, error: 'xKey required' };
      const vy = spec.yKey ? this.schema.validateColumn(spec.yKey) : { valid: false, error: 'yKey required' };
      if (!vx.valid) errors.push(`Scatter X: ${vx.error}`);
      else if (vx.column.type !== 'numeric') errors.push('Scatter xKey must be numeric');
      if (!vy.valid) errors.push(`Scatter Y: ${vy.error}`);
      else if (vy.column.type !== 'numeric') errors.push('Scatter yKey must be numeric');

    } else {
      // Bar, line, area, pie, table, heatmap
      if (!spec.xKey) {
        errors.push(`xKey is required for "${spec.type}" chart`);
      } else {
        const vx = this.schema.validateColumn(spec.xKey);
        if (!vx.valid) errors.push(`X-axis: ${vx.error}`);
      }

      if (spec.yKey) {
        const vy = this.schema.validateColumn(spec.yKey);
        if (!vy.valid) errors.push(`Y-axis: ${vy.error}`);
        else if (vy.column.type !== 'numeric' && spec.aggregation !== 'count') {
          errors.push(`Y-axis "${spec.yKey}" is not numeric — use aggregation "count" or pick a numeric column`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── Chart generation ─────────────────────────────────────────────────────

  /**
   * Generate a chart object from a spec, or throw a descriptive error.
   *
   * @param {object}  spec
   * @param {string}  spec.type
   * @param {string}  [spec.xKey]
   * @param {string}  [spec.yKey]
   * @param {string}  [spec.aggregation='sum']
   * @param {number}  [spec.limit=10]
   * @param {string}  [spec.title]
   * @param {object}  [spec.filters={}]
   * @returns {object}
   */
  generateChart(spec) {
    const validation = this.validateChartSpec(spec);
    if (!validation.valid) {
      throw new Error(`Invalid chart spec:\n  • ${validation.errors.join('\n  • ')}`);
    }

    const type        = spec.type.toLowerCase();
    const aggregation = (spec.aggregation ?? 'sum').toLowerCase();
    const limit       = Math.min(spec.limit ?? 10, 200);
    const rows        = this._applyFilters(spec.filters ?? {});

    let result;
    switch (type) {
      case 'histogram': result = this._histogram(spec, rows);                    break;
      case 'scatter':   result = this._scatter(spec, rows, limit);               break;
      case 'pie':       result = this._grouped(spec, aggregation, rows, limit);  break;
      default:          result = this._grouped(spec, aggregation, rows, limit);  break;
    }

    return {
      id:          randomUUID(),
      type,
      title:       spec.title ?? this._autoTitle(spec),
      xKey:        result.xKey,
      yKey:        result.yKey,
      data:        result.data,
      aggregation: ['histogram', 'scatter'].includes(type) ? null : aggregation,
      rowCount:    result.data.length,
    };
  }

  // ── Chart type implementations ───────────────────────────────────────────

  /** Grouped chart (bar, line, area, pie). @private */
  _grouped(spec, aggregation, rows, limit) {
    const xCol = this.schema.findColumn(spec.xKey);
    const yCol = spec.yKey ? this.schema.findColumn(spec.yKey) : null;
    const yKey = aggregation === 'count' ? 'count' : (yCol?.name ?? 'count');

    // Group rows by xKey
    const groups = new Map();
    for (const row of rows) {
      const label    = String(row[xCol.name] ?? 'Unknown').trim() || 'Unknown';
      const rawValue = yCol ? Number(row[yCol.name]) : 1;
      const current  = groups.get(label) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };

      if (Number.isFinite(rawValue)) {
        current.sum  += rawValue;
        current.count++;
        current.min   = Math.min(current.min, rawValue);
        current.max   = Math.max(current.max, rawValue);
      }
      groups.set(label, current);
    }

    // Aggregate each group
    let data = [...groups.entries()].map(([label, g]) => {
      let value;
      switch (aggregation) {
        case 'avg':
        case 'average': value = g.count > 0 ? g.sum / g.count : 0; break;
        case 'min':     value = g.min === Infinity  ? 0 : g.min;   break;
        case 'max':     value = g.max === -Infinity ? 0 : g.max;   break;
        case 'count':   value = g.count;                            break;
        default:        value = g.sum;                              break;
      }
      return { [xCol.name]: label, [yKey]: Number(value.toFixed(2)) };
    });

    // Sort: time/date → chronological, others → descending value
    if (spec.type === 'line' || spec.type === 'area') {
      data = data.sort((a, b) => String(a[xCol.name]).localeCompare(String(b[xCol.name])));
    } else {
      data = data.sort((a, b) => Number(b[yKey]) - Number(a[yKey]));
    }

    return { data: data.slice(0, limit), xKey: xCol.name, yKey };
  }

  /** Histogram (numeric distribution). @private */
  _histogram(spec, rows, bins = 10) {
    const col    = this.schema.findColumn(spec.xKey);
    const values = rows.map(r => Number(r[col.name])).filter(v => Number.isFinite(v));

    if (!values.length) return { data: [], xKey: 'range', yKey: 'count' };

    const min     = Math.min(...values);
    const max     = Math.max(...values);
    const binSize = (max - min) / bins || 1;

    const buckets = Array.from({ length: bins }, (_, i) => ({
      range: `${Number((min + i * binSize).toFixed(2))}-${Number((min + (i + 1) * binSize).toFixed(2))}`,
      count: 0,
    }));

    for (const v of values) {
      const idx = Math.min(Math.floor((v - min) / binSize), bins - 1);
      buckets[idx].count++;
    }

    return { data: buckets, xKey: 'range', yKey: 'count' };
  }

  /** Scatter plot (two numeric columns). @private */
  _scatter(spec, rows, limit) {
    const xCol = this.schema.findColumn(spec.xKey);
    const yCol = this.schema.findColumn(spec.yKey);

    const data = rows
      .map(row => ({
        [xCol.name]: Number(row[xCol.name]),
        [yCol.name]: Number(row[yCol.name]),
      }))
      .filter(row => Number.isFinite(row[xCol.name]) && Number.isFinite(row[yCol.name]))
      .slice(0, limit);

    return { data, xKey: xCol.name, yKey: yCol.name };
  }

  /** Apply equality filters to rows. @private */
  _applyFilters(filters = {}) {
    const entries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!entries.length) return this.rows;

    return this.rows.filter(row =>
      entries.every(([key, val]) => {
        const col = this.schema.findColumn(key);
        return col
          ? String(row[col.name] ?? '').toLowerCase() === String(val).toLowerCase()
          : false;
      })
    );
  }

  // ── Recommendations & helpers ────────────────────────────────────────────

  /**
   * Generate up to 6 sensible chart recommendations for a schema.
   *
   * @returns {object[]}  - Array of chart specs (pass each to generateChart())
   */
  getRecommendations() {
    const recs = [];

    // Metric × Dimension → bar
    for (const metric of this.schema.metrics.slice(0, 2)) {
      for (const dim of this.schema.dimensions.slice(0, 2)) {
        recs.push({
          type:        'bar',
          title:       `${_humanize(metric.name)} by ${_humanize(dim.name)}`,
          xKey:        dim.name,
          yKey:        metric.name,
          aggregation: 'sum',
          limit:       10,
        });
      }
    }

    // Metric over Time → line
    const dateCol = this.schema.dates[0];
    for (const metric of this.schema.metrics.slice(0, 1)) {
      if (dateCol) {
        recs.push({
          type:        'line',
          title:       `${_humanize(metric.name)} Over Time`,
          xKey:        dateCol.name,
          yKey:        metric.name,
          aggregation: 'sum',
          limit:       50,
        });
      }
    }

    // Distribution → histogram
    for (const metric of this.schema.metrics.slice(0, 1)) {
      recs.push({
        type:  'histogram',
        title: `Distribution of ${_humanize(metric.name)}`,
        xKey:  metric.name,
      });
    }

    return recs.slice(0, 6);
  }

  /**
   * Auto-generate a descriptive chart title from a spec.
   * @private
   */
  _autoTitle(spec) {
    const type   = spec.type   ? spec.type.charAt(0).toUpperCase() + spec.type.slice(1) : 'Chart';
    const xLabel = spec.xKey   ? _humanize(spec.xKey) : 'X';
    const yLabel = spec.yKey   ? _humanize(spec.yKey) : '';
    return yLabel ? `${type}: ${yLabel} by ${xLabel}` : `${type} of ${xLabel}`;
  }
}

// ============================================================================
// PART 4: DASHBOARD BUILDER
// ============================================================================

/**
 * Assembles a complete dashboard from a schema + rows, optionally accepting
 * custom chart specs and KPI specs from the caller.
 *
 * This is the single entry point used by the agentic orchestrator.
 */
export class DashboardBuilder {
  /**
   * @param {object}         rawSchema  - Schema from schema-normalizer or schema-packet-builder
   * @param {Array<object>}  rows       - Actual dataset rows
   */
  constructor(rawSchema, rows = []) {
    this.schema    = new EnhancedSchema(rawSchema);
    this.rows      = Array.isArray(rows) ? rows : [];
    this.kpis      = new KPICalculator(this.schema, this.rows);
    this.charts    = new CustomChartGenerator(this.schema, this.rows);
  }

  /**
   * Build a complete dashboard object.
   *
   * @param {object}   [opts={}]
   * @param {object[]} [opts.customChartSpecs=[]]  - Additional chart specs
   * @param {object[]} [opts.customKPISpecs=[]]    - Additional KPI specs
   * @param {number}   [opts.maxKPIs=6]
   * @param {number}   [opts.maxCharts=8]
   * @returns {object}
   */
  buildDashboard({
    customChartSpecs = [],
    customKPISpecs   = [],
    maxKPIs          = 6,
    maxCharts        = 8,
  } = {}) {
    // ── KPIs ──
    const defaultKPIs = this.kpis.buildDefaultKPIs();
    const extraKPIs   = customKPISpecs.flatMap(spec => {
      try { return [this.kpis.generateKPI(spec)]; }
      catch (e) {
        console.warn(`[DashboardBuilder] Skipping KPI "${spec.title}": ${e.message}`);
        return [];
      }
    });
    const allKPIs = [...defaultKPIs, ...extraKPIs].slice(0, maxKPIs);

    // ── Charts ──
    const recommendedCharts = this.charts.getRecommendations()
      .slice(0, 2)
      .flatMap(spec => {
        try { return [this.charts.generateChart(spec)]; }
        catch (e) {
          console.warn(`[DashboardBuilder] Skipping recommended chart: ${e.message}`);
          return [];
        }
      });

    const extraCharts = customChartSpecs.flatMap(spec => {
      try { return [this.charts.generateChart(spec)]; }
      catch (e) {
        console.warn(`[DashboardBuilder] Skipping custom chart "${spec.title ?? spec.type}": ${e.message}`);
        return [];
      }
    });

    const allCharts = [...recommendedCharts, ...extraCharts].slice(0, maxCharts);

    // ── Final dashboard ──
    return {
      id:       randomUUID(),
      name:     this.schema.name,
      generatedAt: new Date().toISOString(),

      /** Compact schema summary — safe to send to frontend. */
      schema: {
        columns:    this.schema.columns.map(c => ({
          name:   c.name,
          type:   c.type,
          role:   c.role,
          domain: c.domain,
        })),
        metrics:    this.schema.metrics.map(c => c.name),
        dimensions: this.schema.dimensions.map(c => c.name),
        dates:      this.schema.dates.map(c => c.name),
        keys:       this.schema.keys.map(c => c.name),
      },

      kpis:   allKPIs,
      charts: allCharts,

      summary: {
        totalRecords:    this.rows.length,
        totalColumns:    this.schema.columnCount,
        totalMetrics:    this.schema.metrics.length,
        totalDimensions: this.schema.dimensions.length,
        totalDates:      this.schema.dates.length,
        chartsGenerated: allCharts.length,
        kpisGenerated:   allKPIs.length,
      },
    };
  }
}

// ============================================================================
// SHARED UTILITY (module-private)
// ============================================================================

/**
 * Convert snake_case, camelCase or kebab-case to a human readable title.
 * @param {string} text
 * @returns {string}
 */
function _humanize(text) {
  return String(text ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  EnhancedSchema,
  KPICalculator,
  CustomChartGenerator,
  DashboardBuilder,
};
