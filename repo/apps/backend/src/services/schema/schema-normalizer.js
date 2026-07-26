/**
 * @file schema-normalizer.js
 * @description Schema Normalizer — standardises raw datasets into unified SchemaProfile objects.
 *
 * Wraps the existing schema-detector.js to add:
 *  - Domain classification  (ecommerce, finance, healthcare, education, generic)
 *  - Column role inference  (key, time, measure, dimension, unique)
 *  - Column domain tagging  (temporal, product, customer, financial, categorical)
 *  - Quality scoring        (0-100)
 *  - Metric suggestions     (top-10 auto-suggested metric names)
 */

import { schemaDetector } from '../schema-detector.js';

// ---------------------------------------------------------------------------
// Domain keyword maps
// ---------------------------------------------------------------------------

const DOMAIN_PATTERNS = [
  { domain: 'ecommerce',  pattern: /product|order|customer|sale|invoice|cart|sku|ean/i },
  { domain: 'finance',    pattern: /transaction|account|balance|loan|credit|debit|interest|ledger/i },
  { domain: 'healthcare', pattern: /patient|diagnosis|medicine|hospital|treatment|icd|prescription/i },
  { domain: 'education',  pattern: /student|grade|course|enrollment|gpa|subject|class/i },
  { domain: 'logistics',  pattern: /shipment|delivery|carrier|tracking|warehouse|freight/i },
  { domain: 'hr',         pattern: /employee|salary|department|hire|payroll|leave|attendance/i },
];

// ---------------------------------------------------------------------------
// SchemaNormalizer
// ---------------------------------------------------------------------------

export class SchemaNormalizer {
  /**
   * Run the full normalisation pipeline on a dataset.
   *
   * @param {Array<object>} rows                - Array of row objects (parsed CSV/Excel)
   * @param {object}        [metadata={}]       - Optional caller-supplied metadata
   * @param {string}        [metadata.datasetId]
   * @param {string}        [metadata.datasetName]
   * @param {string}        [metadata.forceDomain]  - Override domain detection
   * @returns {SchemaProfile}
   */
  static normalize(rows = [], metadata = {}) {
    if (!Array.isArray(rows)) {
      throw new TypeError('rows must be an Array');
    }

    // Step 1 — low-level type detection via the existing schema-detector
    let rawProfile;
    try {
      rawProfile = schemaDetector.analyzeDataset(rows);
    } catch (err) {
      // Graceful fallback for edge cases (empty file, single row, etc.)
      rawProfile = { columns: [], rowCount: rows.length };
    }

    // Step 2 — domain classification
    const domain = metadata.forceDomain ?? this.detectDomain(rawProfile);

    // Step 3 — enrich each column with role & domain tag
    const normalizedColumns = (rawProfile.columns ?? []).map(col => ({
      ...col,
      role:       this.inferColumnRole(col, rawProfile),
      domainTag:  this.inferColumnDomain(col, domain),
    }));

    // Step 4 — quality score
    const qualityScore = this.calculateQualityScore(normalizedColumns, rows);

    // Step 5 — suggested metrics
    const suggestedMetrics = this.suggestMetrics(normalizedColumns);

    return {
      id:               metadata.datasetId   ?? `schema-${Date.now()}`,
      name:             metadata.datasetName ?? 'Unnamed Dataset',
      domain,
      columns:          normalizedColumns,
      rowCount:         rows.length,
      columnCount:      normalizedColumns.length,
      qualityScore,
      suggestedMetrics,
      normalizedAt:     new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Domain detection
  // -------------------------------------------------------------------------

  /**
   * Classify the dataset's domain from column names.
   *
   * @param {object} rawProfile
   * @returns {string}  one of: ecommerce|finance|healthcare|education|logistics|hr|generic
   */
  static detectDomain(rawProfile) {
    const columnText = (rawProfile.columns ?? [])
      .map(c => c.name)
      .join(' ');

    for (const { domain, pattern } of DOMAIN_PATTERNS) {
      if (pattern.test(columnText)) return domain;
    }

    return 'generic';
  }

  // -------------------------------------------------------------------------
  // Column role inference
  // -------------------------------------------------------------------------

  /**
   * Determine the functional role of a column.
   *
   * Role hierarchy:
   *   key > time > measure > unique > dimension
   *
   * @param {object} column      - Raw column profile from schema-detector
   * @param {object} rawProfile  - The full raw profile (for context)
   * @returns {'key'|'time'|'measure'|'unique'|'dimension'}
   */
  static inferColumnRole(column, rawProfile) {
    const nameLower = (column.name ?? '').toLowerCase();

    // Primary key pattern
    if (/\b(id|uuid|guid|pk)\b/.test(nameLower)) return 'key';

    // Temporal
    if (
      column.type === 'date' ||
      column.type === 'timestamp' ||
      /\b(date|time|datetime|timestamp|created|updated|at)\b/.test(nameLower)
    ) return 'time';

    // Numeric → measure (quantitative)
    if (column.type === 'number' || column.type === 'float' || column.type === 'integer') {
      return 'measure';
    }

    // Very high cardinality string → likely a unique identifier
    const rowCount = rawProfile.rowCount ?? 1;
    if (column.cardinality > rowCount * 0.9) return 'unique';

    // Default — categorical dimension
    return 'dimension';
  }

  // -------------------------------------------------------------------------
  // Column domain tagging
  // -------------------------------------------------------------------------

  /**
   * Attach a semantic domain tag to a column.
   *
   * @param {object} column
   * @param {string} _domain   - Dataset domain (unused for now, reserved for subclassing)
   * @returns {string}
   */
  static inferColumnDomain(column, _domain) {
    const name = (column.name ?? '').toLowerCase();

    if (/\b(date|time|datetime|timestamp|period|month|year|quarter|week)\b/.test(name)) {
      return 'temporal';
    }
    if (/\b(product|item|sku|ean|article)\b/.test(name))   return 'product';
    if (/\b(customer|user|client|member|person)\b/.test(name)) return 'customer';
    if (/\b(amount|price|cost|revenue|sales|profit|fee|total)\b/.test(name)) return 'financial';
    if (/\b(category|type|group|segment|class|tier)\b/.test(name)) return 'categorical';
    if (/\b(country|city|region|state|zip|postal|address)\b/.test(name)) return 'geographic';
    if (/\b(status|stage|phase|flag|active|enabled)\b/.test(name)) return 'status';

    return 'generic';
  }

  // -------------------------------------------------------------------------
  // Quality scoring
  // -------------------------------------------------------------------------

  /**
   * Calculate a data quality score in the range [0, 100].
   *
   * Deductions:
   *  - High null rate per column    (up to -20 per column)
   *  - Zero cardinality columns     (-5 each)
   *  - Single-value columns         (-3 each)
   *  - No numeric columns           (-10)
   *  - No temporal columns          (-5)
   *
   * @param {Array}  normalizedColumns
   * @param {Array}  rows
   * @returns {number}
   */
  static calculateQualityScore(normalizedColumns, rows) {
    let score = 100;
    const rowCount = rows.length || 1;

    for (const col of normalizedColumns) {
      const nullPct = ((col.nullCount ?? 0) / rowCount) * 100;
      if (nullPct > 50) score -= 20;
      else if (nullPct > 20) score -= 10;
      else if (nullPct > 5)  score -= 3;

      if ((col.cardinality ?? 0) === 0) score -= 5;
      if ((col.cardinality ?? 0) === 1) score -= 3;
    }

    const hasMeasures  = normalizedColumns.some(c => c.role === 'measure');
    const hasTemporal  = normalizedColumns.some(c => c.role === 'time');

    if (!hasMeasures) score -= 10;
    if (!hasTemporal) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // -------------------------------------------------------------------------
  // Metric suggestions
  // -------------------------------------------------------------------------

  /**
   * Generate up to 10 suggested metric names based on column roles.
   *
   * @param {Array} normalizedColumns
   * @returns {string[]}
   */
  static suggestMetrics(normalizedColumns) {
    const metrics = [];

    // Count by each dimension
    normalizedColumns
      .filter(c => c.role === 'dimension')
      .forEach(c => metrics.push(`count_by_${c.name}`));

    // Aggregate measures
    normalizedColumns
      .filter(c => c.role === 'measure')
      .forEach(c => {
        metrics.push(
          `sum_${c.name}`,
          `avg_${c.name}`,
          `min_${c.name}`,
          `max_${c.name}`
        );
      });

    // Trend over time for measure+time combos
    const timeCol = normalizedColumns.find(c => c.role === 'time');
    if (timeCol) {
      normalizedColumns
        .filter(c => c.role === 'measure')
        .forEach(c => metrics.push(`trend_${c.name}_over_${timeCol.name}`));
    }

    // Remove duplicates and cap at 10
    return [...new Set(metrics)].slice(0, 10);
  }
}

export default SchemaNormalizer;
