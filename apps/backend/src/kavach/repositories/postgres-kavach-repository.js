import { createHash, randomUUID } from 'node:crypto';
import { legacyCopilotTypeForTool, requiresCaseReference, resolveApprovedCopilotIntent } from '../services/copilot-intent-router.js';
import { createKavachPdfReport, persistKavachPdfReport } from '../report-pdf.js';

const FULL_SCOPE_ROLES = new Set(['STATE_ADMIN', 'SCRB_ANALYST', 'DATA_ENGINEER']);
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const HOTSPOT_MINIMUM_INCIDENTS = 5;
const DELAY_REVIEW_THRESHOLD_DAYS = 7;

function asNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePagination(filters = {}) {
  const page = Math.max(1, Math.trunc(asNumber(filters.page, 1)));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(asNumber(filters.pageSize, DEFAULT_PAGE_SIZE))));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function serializePagination(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function daypartCase(column = 'vi.incident_time') {
  return `CASE
    WHEN EXTRACT(HOUR FROM ${column}::time) >= 5 AND EXTRACT(HOUR FROM ${column}::time) < 7 THEN 'DAWN'
    WHEN EXTRACT(HOUR FROM ${column}::time) >= 7 AND EXTRACT(HOUR FROM ${column}::time) < 12 THEN 'MORNING'
    WHEN EXTRACT(HOUR FROM ${column}::time) >= 12 AND EXTRACT(HOUR FROM ${column}::time) < 17 THEN 'AFTERNOON'
    WHEN EXTRACT(HOUR FROM ${column}::time) >= 17 AND EXTRACT(HOUR FROM ${column}::time) < 21 THEN 'EVENING'
    WHEN EXTRACT(HOUR FROM ${column}::time) >= 21 THEN 'NIGHT'
    ELSE 'LATE_NIGHT'
  END`;
}

function severityValue(column = 'vi.severity') {
  return `CASE UPPER(COALESCE(${column}, 'LOW'))
    WHEN 'CRITICAL' THEN 4
    WHEN 'HIGH' THEN 3
    WHEN 'MEDIUM' THEN 2
    ELSE 1
  END`;
}

function rowValue(row, key, fallback = null) {
  return row && row[key] !== undefined && row[key] !== null ? row[key] : fallback;
}

function delaySummary(metric, row, dataSource) {
  const recordCount = Number(row?.recordCount || 0);
  if (recordCount === 0) {
    return {
      status: 'insufficient_data',
      metric,
      recordCount: 0,
      minimumRequired: 1,
      available: 0,
      humanReviewRequired: true,
      limitations: ['No valid timestamp pairs were available for this delay calculation.'],
    };
  }
  return {
    status: 'ok',
    metric,
    recordCount,
    averageDelayDays: Number(Number(row.averageDelayDays || 0).toFixed(2)),
    medianDelayDays: Number(Number(row.medianDelayDays || 0).toFixed(2)),
    delayedCaseCount: Number(row.delayedCaseCount || 0),
    reviewThresholdDays: DELAY_REVIEW_THRESHOLD_DAYS,
    dataSource,
    humanReviewRequired: true,
    limitations: ['Delay metrics describe recorded timestamps only and require human verification.'],
  };
}

function copilotRecordCount(data) {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== 'object') return 0;
  for (const key of ['recordCount', 'total', 'totalIncidents', 'available']) {
    if (Number.isFinite(Number(data[key]))) return Number(data[key]);
  }
  if (Array.isArray(data.alerts)) return data.alerts.length;
  if (Array.isArray(data.data)) return data.data.length;
  if (data.overview && Number.isFinite(Number(data.overview.totalIncidents))) return Number(data.overview.totalIncidents);
  if (data.caseMasterId || data.crimeNo) return 1;
  return 0;
}

/**
 * Postgres query adapter for the KAVACH API. It intentionally exposes only
 * explicitly selected, API-safe columns from the analytics views.
 */
export class PostgresKavachRepository {
  constructor({ queryExecutor = null } = {}) {
    this.mode = 'postgres';
    this.isPostgres = true;
    this.queryExecutor = queryExecutor;
    this.initialized = false;
    this.available = false;
    this.loadError = null;
    this.loaded = false;
    this._initializing = null;
  }

  async _query(text, values = []) {
    if (this.queryExecutor) return this.queryExecutor(text, values);
    const database = await import('../../db/pool.js');
    return database.query(text, values);
  }

  async initialize() {
    if (this._initializing) return this._initializing;
    this._initializing = (async () => {
      try {
        const result = await this._query("SELECT to_regclass('analytics.v_incidents') AS incidents_view");
        this.available = Boolean(result.rows?.[0]?.incidents_view);
        this.loaded = this.available;
        this.initialized = true;
        this.loadError = this.available ? null : 'KAVACH PostgreSQL analytics views are not migrated yet.';
        return this.available;
      } catch (error) {
        this.available = false;
        this.initialized = true;
        this.loadError = 'KAVACH PostgreSQL is unavailable.';
        return false;
      }
    })();
    return this._initializing;
  }

  async loadAll() {
    await this.initialize();
    return this.loaded;
  }

  _conditions(filters = {}, scope = {}, alias = 'vi') {
    const values = [];
    const clauses = [];
    const add = (sql, value) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    const addMany = (sql, list) => {
      values.push(list);
      clauses.push(sql.replace('?', `$${values.length}`));
    };

    if (filters.dateFrom) add(`${alias}.incident_date >= ?::date`, filters.dateFrom);
    if (filters.dateTo) add(`${alias}.incident_date <= ?::date`, filters.dateTo);
    if (filters.date) add(`${alias}.incident_date = ?::date`, filters.date);

    const districtNames = filters.districts || filters.district;
    if (districtNames) {
      const names = Array.isArray(districtNames) ? districtNames : String(districtNames).split(',');
      addMany(`LOWER(${alias}.district) = ANY(?)`, names.map((name) => String(name).trim().toLowerCase()).filter(Boolean));
    }
    if (filters.districtId) add(`${alias}.district_id = ?::integer`, filters.districtId);

    const stations = filters.policeStations || filters.policeStation;
    if (stations) {
      const names = Array.isArray(stations) ? stations : String(stations).split(',');
      addMany(`LOWER(${alias}.police_station) = ANY(?)`, names.map((name) => String(name).trim().toLowerCase()).filter(Boolean));
    }
    if (filters.stationId) add(`${alias}.police_station_id = ?::integer`, filters.stationId);

    const categories = filters.crimeCategories || filters.crimeType;
    if (categories) {
      const names = Array.isArray(categories) ? categories : String(categories).split(',');
      addMany(`LOWER(${alias}.crime_type) = ANY(?)`, names.map((name) => String(name).trim().toLowerCase()).filter(Boolean));
    }
    if (filters.status) add(`UPPER(${alias}.status) = UPPER(?)`, filters.status);
    if (filters.severity) add(`UPPER(${alias}.severity) = UPPER(?)`, filters.severity);
    if (filters.daypart || filters.timeOfDay) add(`(${daypartCase(`${alias}.incident_time`)}) = UPPER(?)`, filters.daypart || filters.timeOfDay);
    if (filters.crimeHeadId) add(`${alias}.case_master_id IN (SELECT case_master_id FROM case_master WHERE crime_major_head_id = ?::integer)`, filters.crimeHeadId);
    if (filters.crimeSubHeadId) add(`${alias}.case_master_id IN (SELECT case_master_id FROM case_master WHERE crime_minor_head_id = ?::integer)`, filters.crimeSubHeadId);

    const role = scope?.roleCode;
    if (scope?.districtId && !FULL_SCOPE_ROLES.has(role)) add(`${alias}.district_id = ?::integer`, scope.districtId);
    if (scope?.unitId && ['STATION_OFFICER', 'INVESTIGATOR'].includes(role)) add(`${alias}.police_station_id = ?::integer`, scope.unitId);

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
  }

  async _rows(text, values = []) {
    const result = await this._query(text, values);
    return result.rows || [];
  }

  async _one(text, values = []) {
    const rows = await this._rows(text, values);
    return rows[0] || null;
  }

  async getIncidents(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    return this._rows(`
      SELECT fir_number, case_master_id, incident_date::text, incident_time::text,
        registered_date::text, district, district_id, police_station, police_station_id,
        crime_type, crime_major_head, crime_sub_head, severity, status,
        latitude, longitude, brief_facts, modus_operandi, court_name, chargesheet_status
      FROM analytics.v_incidents vi
      ${where}
      ORDER BY incident_date DESC NULLS LAST, fir_number
    `, values);
  }

  async listCases(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const { page, pageSize, offset } = normalizePagination(filters);
    const count = await this._one(`SELECT COUNT(*)::integer AS total FROM analytics.v_incidents vi ${where}`, values);
    const pageValues = [...values, pageSize, offset];
    const rows = await this._rows(`
      SELECT fir_number AS "crimeNo", case_master_id AS "caseMasterId", incident_date::text AS "incidentDate",
        incident_time::text AS "incidentTime", registered_date::text AS "registeredDate",
        district, district_id AS "districtId", police_station AS "policeStation",
        police_station_id AS "policeStationId", crime_type AS "crimeType",
        crime_major_head AS "crimeMajorHead", crime_sub_head AS "crimeSubHead",
        severity, status, latitude, longitude, brief_facts AS "briefFacts", modus_operandi AS "modusOperandi"
      FROM analytics.v_incidents vi
      ${where}
      ORDER BY incident_date DESC NULLS LAST, fir_number DESC
      LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}
    `, pageValues);
    return { data: rows, pagination: serializePagination(page, pageSize, Number(count?.total || 0)) };
  }

  async getCaseByCrimeNo(crimeNo, scope = {}) {
    const { where, values } = this._conditions({}, scope);
    values.push(crimeNo);
    const join = where ? `${where} AND vi.fir_number = $${values.length}` : `WHERE vi.fir_number = $${values.length}`;
    const incident = await this._one(`
      SELECT fir_number AS "crimeNo", case_master_id AS "caseMasterId", incident_date::text AS "incidentDate",
        incident_time::text AS "incidentTime", registered_date::text AS "registeredDate", district,
        district_id AS "districtId", police_station AS "policeStation", police_station_id AS "policeStationId",
        crime_type AS "crimeType", crime_major_head AS "crimeMajorHead", crime_sub_head AS "crimeSubHead",
        severity, status, latitude, longitude, brief_facts AS "briefFacts", modus_operandi AS "modusOperandi",
        court_name AS "courtName", chargesheet_status AS "chargesheetStatus"
      FROM analytics.v_incidents vi ${join}
    `, values);
    if (!incident) return null;
    const roles = await this._rows(`
      SELECT ip.person_id AS "personId", ip.role, ip.confidence, ip.is_verified AS "isVerified",
        pm.masked_name AS "maskedName", pm.age_band AS "ageBand", pm.gender_code AS "genderCode"
      FROM analytics.v_incident_persons ip
      LEFT JOIN analytics.v_persons_masked pm ON pm.person_id = ip.person_id
      WHERE ip.case_master_id = $1
      ORDER BY ip.role, ip.person_id
    `, [incident.caseMasterId]);
    const sections = await this._rows(`
      SELECT asa.act_code AS "actCode", asa.section_code AS "sectionCode", ls.section_description AS "sectionDescription"
      FROM act_section_association asa
      LEFT JOIN legal_section ls ON ls.act_code = asa.act_code AND ls.section_code = asa.section_code
      WHERE asa.case_master_id = $1
      ORDER BY asa.act_order_id, asa.section_order_id
    `, [incident.caseMasterId]);
    return { ...incident, persons: roles, legalSections: sections };
  }

  async getOverview(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const row = await this._one(`
      WITH filtered AS (SELECT * FROM analytics.v_incidents vi ${where}),
      categories AS (
        SELECT crime_type, COUNT(*) AS count FROM filtered GROUP BY crime_type ORDER BY count DESC, crime_type LIMIT 1
      ),
      offenders AS (
        SELECT cpr.person_id
        FROM case_person_role cpr
        JOIN filtered f ON f.case_master_id = cpr.case_master_id
        WHERE cpr.role_type = 'ACCUSED'
        GROUP BY cpr.person_id HAVING COUNT(DISTINCT cpr.case_master_id) >= 2
      )
      SELECT COUNT(*)::integer AS "totalIncidents",
        COUNT(*) FILTER (WHERE status = 'UNDER_INVESTIGATION')::integer AS "activeInvestigations",
        COUNT(*) FILTER (WHERE status = 'CLOSED')::integer AS "closedInvestigations",
        COUNT(*) FILTER (WHERE status = 'PENDING')::integer AS pending,
        COUNT(*) FILTER (WHERE status = 'COLD')::integer AS cold,
        COUNT(DISTINCT district_id)::integer AS "districtCount",
        COALESCE((SELECT crime_type FROM categories), 'Unknown') AS "mostCommonCategory",
        (SELECT COUNT(*)::integer FROM offenders) AS "repeatOffenders",
        MIN(incident_date)::text AS "periodStart", MAX(incident_date)::text AS "periodEnd"
      FROM filtered
    `, values);
    const alertScope = this._alertScope(scope);
    const alertCount = await this._one(`SELECT COUNT(*)::integer AS count FROM alert ${alertScope.where} AND status IN ('OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW')`, alertScope.values);
    const total = Number(row?.totalIncidents || 0);
    return {
      totalIncidents: total,
      activeInvestigations: Number(row?.activeInvestigations || 0),
      closedInvestigations: Number(row?.closedInvestigations || 0),
      pending: Number(row?.pending || 0),
      cold: Number(row?.cold || 0),
      highRiskDistricts: 0,
      activeHotspots: 0,
      repeatOffenders: Number(row?.repeatOffenders || 0),
      currentAlerts: Number(alertCount?.count || 0),
      mostCommonCategory: row?.mostCommonCategory || 'Unknown',
      dataQualityScore: 100,
      recordCount: total,
      dataPeriod: { start: row?.periodStart || null, end: row?.periodEnd || null },
      dataSource: 'postgres',
      humanReviewNotice: 'Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.',
    };
  }

  async getAllDistrictSummaries(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    return this._rows(`
      WITH filtered AS (SELECT * FROM analytics.v_incidents vi ${where}),
      category_rank AS (
        SELECT district_id, crime_type, COUNT(*) AS count,
          ROW_NUMBER() OVER (PARTITION BY district_id ORDER BY COUNT(*) DESC, crime_type) AS rank
        FROM filtered GROUP BY district_id, crime_type
      )
      SELECT f.district, f.district_id AS "districtId", COUNT(*)::integer AS "totalIncidents",
        COALESCE(MAX(cr.crime_type) FILTER (WHERE cr.rank = 1), 'Unknown') AS "topCategory",
        ROUND(AVG(${severityValue('f.severity')})::numeric, 2) AS "avgSeverity",
        COUNT(*) FILTER (WHERE f.status IN ('UNDER_INVESTIGATION', 'PENDING'))::integer AS "activeCases",
        COUNT(*) FILTER (WHERE f.status = 'CLOSED')::integer AS "closedCases"
      FROM filtered f
      LEFT JOIN category_rank cr ON cr.district_id = f.district_id
      GROUP BY f.district, f.district_id
      ORDER BY "totalIncidents" DESC, f.district
    `, values);
  }

  async getDistrictAnalysis(district, filters = {}, scope = {}) {
    const result = await this.getAllDistrictSummaries({ ...filters, district }, scope);
    const summary = result.find((row) => row.district?.toLowerCase() === String(district).toLowerCase());
    if (!summary) return null;
    const { where, values } = this._conditions({ ...filters, district }, scope);
    const [categories, statuses, severities, stations, indicator] = await Promise.all([
      this._rows(`SELECT crime_type AS category, COUNT(*)::integer AS count FROM analytics.v_incidents vi ${where} GROUP BY crime_type ORDER BY count DESC`, values),
      this._rows(`SELECT status, COUNT(*)::integer AS count FROM analytics.v_incidents vi ${where} GROUP BY status ORDER BY count DESC`, values),
      this._rows(`SELECT severity, COUNT(*)::integer AS count FROM analytics.v_incidents vi ${where} GROUP BY severity ORDER BY count DESC`, values),
      this._rows(`SELECT police_station AS station, police_station_id AS "stationId", COUNT(*)::integer AS count FROM analytics.v_incidents vi ${where} GROUP BY police_station, police_station_id ORDER BY count DESC`, values),
      this._one(`SELECT * FROM analytics.v_district_indicators WHERE district_id = $1 ORDER BY period_end DESC NULLS LAST LIMIT 1`, [summary.districtId]),
    ]);
    return {
      ...summary,
      district,
      categoryCounts: Object.fromEntries(categories.map((row) => [row.category || 'Unknown', Number(row.count)])),
      statusCounts: Object.fromEntries(statuses.map((row) => [row.status || 'Unknown', Number(row.count)])),
      severityCounts: Object.fromEntries(severities.map((row) => [row.severity || 'LOW', Number(row.count)])),
      stationCounts: Object.fromEntries(stations.map((row) => [row.station || 'Unknown', Number(row.count)])),
      indicators: indicator || null,
      recordCount: summary.totalIncidents,
      dataPeriod: { start: filters.dateFrom || null, end: filters.dateTo || null },
    };
  }

  async _trend(filters, scope, expression, key) {
    const { where, values } = this._conditions(filters, scope);
    return this._rows(`
      SELECT bucket AS "${key}", COUNT(*)::integer AS total,
        COALESCE(jsonb_object_agg(category, category_count), '{}'::jsonb) AS categories
      FROM (
        SELECT ${expression} AS bucket, crime_type AS category, COUNT(*)::integer AS category_count
        FROM analytics.v_incidents vi ${where}
        GROUP BY bucket, crime_type
      ) source
      GROUP BY bucket
      ORDER BY bucket
    `, values).then((rows) => rows.map((row) => ({ [key]: row[key], total: Number(row.total), categories: safeJson(row.categories) })));
  }

  async getMonthlyTrends(filters = {}, scope = {}) {
    return this._trend(filters, scope, "TO_CHAR(vi.incident_date, 'YYYY-MM')", 'month');
  }

  async getWeeklyTrends(filters = {}, scope = {}) {
    return this._trend(filters, scope, "TO_CHAR(vi.incident_date, 'IYYY-\"W\"IW')", 'week');
  }

  async getDayOfWeekAnalysis(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      SELECT EXTRACT(DOW FROM incident_date)::integer AS index, TO_CHAR(incident_date, 'FMDay') AS day,
        COUNT(*)::integer AS total
      FROM analytics.v_incidents vi ${where}
      GROUP BY index, day ORDER BY index
    `, values);
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byIndex = new Map(rows.map((row) => [Number(row.index), row]));
    return names.map((day, index) => ({ day, total: Number(byIndex.get(index)?.total || 0), categories: {} }));
  }

  async getHourOfDayAnalysis(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      SELECT EXTRACT(HOUR FROM incident_time::time)::integer AS hour, COUNT(*)::integer AS total
      FROM analytics.v_incidents vi ${where}
      GROUP BY hour ORDER BY hour
    `, values);
    const counts = new Map(rows.map((row) => [Number(row.hour), Number(row.total)]));
    return Array.from({ length: 24 }, (_, hour) => ({ hour, total: counts.get(hour) || 0, categories: {} }));
  }

  async getDaypartAnalysis(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      SELECT ${daypartCase('vi.incident_time')} AS daypart, COUNT(*)::integer AS total
      FROM analytics.v_incidents vi ${where}
      GROUP BY daypart ORDER BY daypart
    `, values);
    const counts = new Map(rows.map((row) => [row.daypart, Number(row.total)]));
    return ['DAWN', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'LATE_NIGHT']
      .map((daypart) => ({ daypart, total: counts.get(daypart) || 0, categories: {} }));
  }

  async getCategoryGrowth(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      WITH filtered AS (SELECT * FROM analytics.v_incidents vi ${where}),
      bounds AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY incident_date) AS midpoint FROM filtered),
      counts AS (
        SELECT crime_type AS category,
          COUNT(*) FILTER (WHERE incident_date <= (SELECT midpoint FROM bounds))::integer AS first_period,
          COUNT(*) FILTER (WHERE incident_date > (SELECT midpoint FROM bounds))::integer AS second_period
        FROM filtered GROUP BY crime_type
      )
      SELECT category AS "category", first_period AS "firstPeriod", second_period AS "secondPeriod",
        CASE WHEN first_period = 0 THEN CASE WHEN second_period > 0 THEN 100 ELSE 0 END
        ELSE ROUND(((second_period - first_period)::numeric / first_period) * 100, 2) END AS change
      FROM counts ORDER BY ABS(CASE WHEN first_period = 0 THEN second_period ELSE second_period - first_period END) DESC
    `, values);
    return rows.map((row) => ({ ...row, change: Number(row.change), direction: Number(row.change) >= 0 ? 'increase' : 'decrease' }));
  }

  async getDistrictComparison(filters = {}, scope = {}) {
    const summaries = await this.getAllDistrictSummaries(filters, scope);
    const total = summaries.reduce((sum, row) => sum + Number(row.totalIncidents || 0), 0);
    return summaries.map((row) => ({ ...row, percentage: total ? Number(((Number(row.totalIncidents) / total) * 100).toFixed(2)) : 0 }));
  }

  async getModusOperandiTrends(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      SELECT COALESCE(modus_operandi, 'Unknown') AS "modusOperandi", COUNT(*)::integer AS count
      FROM analytics.v_incidents vi ${where}
      GROUP BY modus_operandi ORDER BY count DESC, "modusOperandi"
    `, values);
    const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
    return {
      totalMOs: rows.length,
      moDistribution: rows.map((row) => ({ ...row, percentage: total ? Number(((Number(row.count) / total) * 100).toFixed(2)) : 0 })),
      monthlyTrend: [],
    };
  }

  async getCurrentVsPrevious(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const row = await this._one(`
      WITH filtered AS (SELECT * FROM analytics.v_incidents vi ${where}),
      bounds AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY incident_date) AS midpoint FROM filtered)
      SELECT COUNT(*) FILTER (WHERE incident_date > (SELECT midpoint FROM bounds))::integer AS current,
        COUNT(*) FILTER (WHERE incident_date <= (SELECT midpoint FROM bounds))::integer AS previous
      FROM filtered
    `, values);
    const current = Number(row?.current || 0);
    const previous = Number(row?.previous || 0);
    return { current, previous, change: previous ? Number((((current - previous) / previous) * 100).toFixed(2)) : current ? 100 : 0 };
  }

  async getHotspots(filters = {}, scope = {}) {
    const values = [];
    const clauses = ['WHERE 1 = 1'];
    const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
    if (filters.dateFrom) add('AND h.period_start >= date_trunc(\'month\', ?::timestamptz)', filters.dateFrom);
    if (filters.dateTo) add('AND h.period_start <= date_trunc(\'month\', ?::timestamptz)', filters.dateTo);
    if (filters.districtId) add('AND h.district_id = ?::integer', filters.districtId);
    if (filters.stationId) add('AND h.police_station_id = ?::integer', filters.stationId);
    if (filters.district) add('AND LOWER(d.district_name) = LOWER(?)', filters.district);
    if (filters.policeStation) add('AND LOWER(h.police_station) = LOWER(?)', filters.policeStation);
    if (scope?.districtId && !FULL_SCOPE_ROLES.has(scope.roleCode)) add('AND h.district_id = ?::integer', scope.districtId);
    if (scope?.unitId && ['STATION_OFFICER', 'INVESTIGATOR'].includes(scope.roleCode)) add('AND h.police_station_id = ?::integer', scope.unitId);
    if (filters.crimeType) add('AND ? = ANY(h.crime_categories)', filters.crimeType);
    const minimum = Math.max(HOTSPOT_MINIMUM_INCIDENTS, asNumber(filters.minimumIncidents, HOTSPOT_MINIMUM_INCIDENTS));
    values.push(minimum);
    const rows = await this._rows(`
      SELECT encode(digest(h.police_station_id::text || ':' || ST_AsText(h.grid_cell) || ':' || h.period_start::text, 'sha256'), 'hex') AS id,
        d.district_name AS district, h.district_id AS "districtId", h.police_station AS "policeStation",
        h.police_station_id AS "stationId", h.incident_count::integer AS "incidentCount",
        ROUND(LEAST(100, (h.incident_count::numeric / 20) * 100), 2) AS score,
        ROUND(ST_Y(h.centroid)::numeric, 6) AS latitude, ROUND(ST_X(h.centroid)::numeric, 6) AS longitude,
        h.crime_categories AS "crimeCategories", h.period_start::text AS "periodStart",
        ST_AsGeoJSON(h.grid_cell)::jsonb AS boundary
      FROM analytics.v_station_hotspot_aggregation h
      JOIN district d ON d.district_id = h.district_id
      ${clauses.join(' ')}
      AND h.incident_count >= $${values.length}
      ORDER BY score DESC, "incidentCount" DESC, h.period_start DESC
      LIMIT 100
    `, values);
    return rows.map((row) => ({
      id: row.id,
      hotspotId: row.id,
      district: row.district,
      districtId: row.districtId,
      policeStation: row.policeStation,
      stationId: row.stationId,
      centroid: row.latitude === null || row.longitude === null ? null : { latitude: Number(row.latitude), longitude: Number(row.longitude) },
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      incidentCount: Number(row.incidentCount),
      score: Math.min(100, Number(row.score || 0)),
      riskScore: Math.min(100, Number(row.score || 0)),
      boundary: safeJson(row.boundary, null),
      dominantCategory: Array.isArray(row.crimeCategories) ? row.crimeCategories[0] || 'Unknown' : 'Unknown',
      crimeCategories: Array.isArray(row.crimeCategories) ? row.crimeCategories : [],
      avgSeverity: null,
      growthRate: 0,
      trendPercentage: 0,
      baselineCount: null,
      repeatOffenderCount: 0,
      anomalyScore: 0,
      confidence: Math.min(0.95, Number(row.incidentCount) / 20),
      factors: ['Station-level incident concentration'],
      evidence: [`${row.incidentCount} incidents within the active filters.`],
      dataPeriod: { start: row.periodStart || filters.dateFrom || null, end: filters.dateTo || row.periodStart || null },
      algorithm: 'PostGIS grid-cell hotspot aggregation',
      humanReviewRequired: true,
    }));
  }

  async getHotspotById(id, scope = {}) {
    const hotspots = await this.getHotspots({}, scope);
    const normalized = String(id).toLowerCase();
    return hotspots.find((hotspot) => hotspot.id === id || hotspot.district?.toLowerCase().replace(/\s+/g, '-') === normalized) || null;
  }

  async getDistrictHotspots(district, filters = {}, scope = {}) {
    return this.getHotspots({ ...filters, district }, scope);
  }

  async detectAnomalies(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      WITH daily AS (
        SELECT district, district_id, incident_date, COUNT(*)::numeric AS count
        FROM analytics.v_incidents vi ${where}
        GROUP BY district, district_id, incident_date
      ), stats AS (
        SELECT *, AVG(count) OVER (PARTITION BY district_id) AS mean_count,
          STDDEV_POP(count) OVER (PARTITION BY district_id) AS std_count
        FROM daily
      )
      SELECT district, district_id AS "districtId", incident_date::text AS date, count AS value,
        mean_count AS expected,
        CASE WHEN COALESCE(std_count, 0) = 0 THEN 0 ELSE ROUND(((count - mean_count) / std_count)::numeric, 2) END AS "zScore"
      FROM stats
      WHERE ABS(CASE WHEN COALESCE(std_count, 0) = 0 THEN 0 ELSE (count - mean_count) / std_count END) >= 1.5
      ORDER BY ABS(CASE WHEN COALESCE(std_count, 0) = 0 THEN 0 ELSE (count - mean_count) / std_count END) DESC
      LIMIT 100
    `, values);
    return rows.map((row) => ({
      type: 'DISTRICT_ANOMALY',
      ...row,
      value: Number(row.value), expected: Number(row.expected), zScore: Number(row.zScore), threshold: 1.5,
      severity: Math.abs(Number(row.zScore)) >= 2.5 ? 'HIGH' : 'MEDIUM',
      modelName: 'Z_SCORE_BASELINE', modelVersion: 'postgres-1.0.0',
      explanation: 'Incident volume materially differs from the historical district baseline; this is not evidence of criminal activity.',
      humanReviewStatus: 'PENDING_REVIEW',
    }));
  }

  async getNetworkGraph(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const cases = await this._rows(`
      SELECT fir_number, case_master_id, crime_type, district, severity
      FROM analytics.v_incidents vi ${where}
      ORDER BY incident_date DESC NULLS LAST LIMIT 250
    `, values);
    if (!cases.length) return { nodes: [], edges: [] };
    const caseIds = cases.map((row) => row.case_master_id);
    const edges = await this._rows(`
      SELECT source_id AS source, source_type AS "sourceType", target_id AS target, target_type AS "targetType",
        relationship_type AS type, weight, case_master_id AS "caseMasterId", evidence
      FROM analytics.v_case_network_edges
      WHERE case_master_id = ANY($1::bigint[])
      ORDER BY weight DESC NULLS LAST LIMIT 1000
    `, [caseIds]);
    const personIds = [...new Set(edges.flatMap((edge) => [
      edge.sourceType === 'PERSON' ? String(edge.source).replace(/^person:/, '') : null,
      edge.targetType === 'PERSON' ? String(edge.target).replace(/^person:/, '') : null,
    ]).filter(Boolean))];
    const personLabels = personIds.length
      ? await this._rows('SELECT person_id::text AS id, masked_name FROM analytics.v_persons_masked WHERE person_id = ANY($1::uuid[])', [personIds])
      : [];
    const labelsByPerson = new Map(personLabels.map((row) => [`person:${row.id}`, row.masked_name]));
    const nodeMap = new Map();
    for (const incident of cases) {
      const id = `case:${incident.case_master_id}`;
      nodeMap.set(id, { id, type: 'incident', label: incident.fir_number, caseMasterId: incident.case_master_id, crimeType: incident.crime_type, district: incident.district, severity: incident.severity });
    }
    for (const edge of edges) {
      const source = String(edge.source);
      const target = String(edge.target);
      if (!nodeMap.has(source)) nodeMap.set(source, { id: source, type: String(edge.sourceType || 'person').toLowerCase(), label: labelsByPerson.get(source) || source });
      if (!nodeMap.has(target)) nodeMap.set(target, { id: target, type: String(edge.targetType || 'case').toLowerCase(), label: labelsByPerson.get(target) || target });
    }
    return {
      nodes: [...nodeMap.values()],
      edges: edges.map((edge) => ({ source: String(edge.source), target: String(edge.target), type: edge.type, weight: Number(edge.weight || 1), evidence: safeJson(edge.evidence, []) })),
    };
  }

  async _maskedLabel(personId) {
    const normalized = String(personId).replace(/^person:/, '');
    const row = await this._one('SELECT masked_name FROM analytics.v_persons_masked WHERE person_id = $1::uuid', [normalized]);
    return row?.masked_name || `Person ${String(personId).slice(0, 8)}`;
  }

  async getNetworkForPerson(personId, scope = {}) {
    const label = await this._maskedLabel(personId);
    const { where, values } = this._conditions({}, scope);
    values.push(personId);
    const personWhere = where ? `${where} AND ip.person_id = $${values.length}::uuid` : `WHERE ip.person_id = $${values.length}::uuid`;
    const cases = await this._rows(`
      SELECT vi.fir_number, vi.case_master_id, vi.incident_date::text AS incident_date, vi.crime_type, vi.severity, vi.status
      FROM analytics.v_incident_persons ip
      JOIN analytics.v_incidents vi ON vi.case_master_id = ip.case_master_id
      ${personWhere}
      ORDER BY vi.incident_date DESC NULLS LAST
    `, values);
    if (!cases.length) return null;
    const graph = await this.getNetworkGraph({ dateFrom: null }, scope);
    const relevantCaseIds = new Set(cases.map((row) => String(row.case_master_id)));
    const nodeId = `person:${personId}`;
    const edges = graph.edges.filter((edge) => String(edge.source) === nodeId || String(edge.target) === nodeId);
    const nodes = graph.nodes.filter((node) => String(node.id) === nodeId || cases.some((item) => `case:${item.case_master_id}` === String(node.id)));
    return {
      person: { person_id: personId, name: label },
      incidents: cases.map((row) => ({ fir_number: row.fir_number, incident_date: row.incident_date, crime_type: row.crime_type, severity: row.severity, status: row.status })),
      associates: [],
      graph: { nodes, edges, relevantCaseIds: [...relevantCaseIds] },
    };
  }

  async getNetworkForIncident(firNumber, scope = {}) {
    const incident = await this.getCaseByCrimeNo(firNumber, scope);
    if (!incident) return null;
    const links = await this._rows(`
      SELECT ip.person_id AS "personId", ip.role, pm.masked_name AS name
      FROM analytics.v_incident_persons ip
      LEFT JOIN analytics.v_persons_masked pm ON pm.person_id = ip.person_id
      WHERE ip.case_master_id = $1
    `, [incident.caseMasterId]);
    return {
      incident,
      persons: links.map((row) => ({ person_id: row.personId, name: row.name, role: row.role })),
      relatedIncidents: [],
      graph: {
        nodes: [{ id: `case:${incident.caseMasterId}`, type: 'incident', label: firNumber, ego: true }, ...links.map((row) => ({ id: `person:${row.personId}`, type: 'person', label: row.name, role: row.role }))],
        edges: links.map((row) => ({ source: `person:${row.personId}`, target: `case:${incident.caseMasterId}`, type: row.role === 'ACCUSED' ? 'ACCUSED_IN' : `${row.role}_IN` })),
      },
    };
  }

  async findConnectedComponents(filters = {}, scope = {}) {
    const graph = await this.getNetworkGraph(filters, scope);
    const adjacency = new Map();
    for (const edge of graph.edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source).add(edge.target);
      adjacency.get(edge.target).add(edge.source);
    }
    const visited = new Set();
    const components = [];
    for (const start of adjacency.keys()) {
      if (visited.has(start)) continue;
      const queue = [start];
      const members = new Set();
      while (queue.length) {
        const node = queue.shift();
        if (visited.has(node)) continue;
        visited.add(node); members.add(node);
        for (const neighbour of adjacency.get(node) || []) if (!visited.has(neighbour)) queue.push(neighbour);
      }
      if (members.size >= 2) components.push({ size: members.size, nodeIds: [...members] });
    }
    return components.sort((left, right) => right.size - left.size);
  }

  async findCrossDistrictNetworks(filters = {}, scope = {}) {
    const components = await this.findConnectedComponents(filters, scope);
    return components.map((component) => ({ ...component, districts: [], districtCount: 0 })).filter((component) => component.size >= 2);
  }

  async getOffenders(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const { page, pageSize, offset } = normalizePagination(filters);
    const accusedWhere = where ? `${where} AND cpr.role_type = 'ACCUSED'` : `WHERE cpr.role_type = 'ACCUSED'`;
    const multipleCaseLinksOnly = filters.repeatOffender === true || filters.repeatOffender === 'true';
    const repeatHaving = multipleCaseLinksOnly ? 'HAVING COUNT(DISTINCT cpr.case_master_id) >= 2' : '';
    const totalRow = await this._one(`
      SELECT COUNT(*)::integer AS total FROM (
        SELECT cpr.person_id
        FROM case_person_role cpr JOIN analytics.v_incidents vi ON vi.case_master_id = cpr.case_master_id
        ${accusedWhere}
        GROUP BY cpr.person_id
        ${repeatHaving}
      ) people
    `, values);
    const rows = await this._rows(`
      SELECT cpr.person_id AS "personId", pm.masked_name AS name, pm.age_band AS "ageBand", pm.gender_code AS gender,
        COUNT(DISTINCT cpr.case_master_id)::integer AS "incidentCount", MIN(vi.incident_date)::text AS "firstSeen",
        MAX(vi.incident_date)::text AS "lastSeen", COUNT(DISTINCT vi.district_id)::integer AS "districtCount",
        COUNT(DISTINCT vi.police_station_id)::integer AS "stationCount", COUNT(DISTINCT co.person_id)::integer AS "coAccusedCount"
      FROM case_person_role cpr
      JOIN analytics.v_incidents vi ON vi.case_master_id = cpr.case_master_id
      LEFT JOIN analytics.v_persons_masked pm ON pm.person_id = cpr.person_id
      LEFT JOIN case_person_role co ON co.case_master_id = cpr.case_master_id AND co.role_type = 'ACCUSED' AND co.person_id <> cpr.person_id
      ${accusedWhere}
      GROUP BY cpr.person_id, pm.masked_name, pm.age_band, pm.gender_code
      ${repeatHaving}
      ORDER BY "incidentCount" DESC, "lastSeen" DESC NULLS LAST
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, pageSize, offset]);
    const mapped = rows.map((row) => {
      const labels = [];
      if (Number(row.incidentCount) >= 2) labels.push('MULTIPLE_CASE_LINKS');
      if (Number(row.districtCount) > 1) labels.push('CROSS_DISTRICT_LINKS');
      if (Number(row.coAccusedCount) >= 3) labels.push('HIGH_NETWORK_CENTRALITY');
      if (labels.length === 0) labels.push('SINGLE_CASE_LINK');
      return {
        ...row,
        classification: labels[0],
        linkComplexityScore: Math.min(100, Number(row.incidentCount) * 20 + Number(row.districtCount) * 10 + Number(row.coAccusedCount) * 5),
        labels,
        limitation: 'Historical case links are not a prediction of guilt or future conduct.',
      };
    });
    if (filters.page || filters.pageSize) return { data: mapped, pagination: serializePagination(page, pageSize, Number(totalRow?.total || 0)) };
    return mapped;
  }

  async getOffenderDetail(personId, scope = {}) {
    const person = await this._one(`SELECT person_id AS "personId", masked_name AS name, age_band AS "ageBand", gender_code AS gender FROM analytics.v_persons_masked WHERE person_id = $1::uuid`, [personId]);
    if (!person) return null;
    const { where, values } = this._conditions({}, scope);
    values.push(personId);
    const roleWhere = where ? `${where} AND cpr.person_id = $${values.length}::uuid` : `WHERE cpr.person_id = $${values.length}::uuid`;
    const incidents = await this._rows(`
      SELECT vi.fir_number AS "firNumber", vi.incident_date::text AS date, vi.crime_type AS "crimeType", vi.severity, vi.status, vi.district,
        vi.police_station_id AS "stationId", vi.modus_operandi AS "modusOperandi"
      FROM case_person_role cpr JOIN analytics.v_incidents vi ON vi.case_master_id = cpr.case_master_id
      ${roleWhere} AND cpr.role_type = 'ACCUSED'
      ORDER BY vi.incident_date DESC NULLS LAST
    `, values);
    if (incidents.length === 0) return null;
    const categories = Object.fromEntries(incidents.reduce((entries, incident) => {
      entries.set(incident.crimeType || 'Unknown', (entries.get(incident.crimeType || 'Unknown') || 0) + 1); return entries;
    }, new Map()));
    const targetRoleWhere = where ? `${where} AND target_role.person_id = $${values.length}::uuid` : `WHERE target_role.person_id = $${values.length}::uuid`;
    const coAccused = await this._one(`
      SELECT COUNT(DISTINCT other_role.person_id)::integer AS "coAccusedCount"
      FROM case_person_role target_role
      JOIN case_person_role other_role ON other_role.case_master_id = target_role.case_master_id
      JOIN analytics.v_incidents vi ON vi.case_master_id = target_role.case_master_id
      ${targetRoleWhere} AND target_role.role_type = 'ACCUSED' AND other_role.role_type = 'ACCUSED' AND other_role.person_id <> $${values.length}::uuid
    `, values);
    const districtCount = new Set(incidents.map((incident) => incident.district).filter(Boolean)).size;
    const stationCount = new Set(incidents.map((incident) => incident.stationId).filter(Boolean)).size;
    const coAccusedCount = Number(coAccused?.coAccusedCount || 0);
    const labels = [];
    if (incidents.length >= 2) labels.push('MULTIPLE_CASE_LINKS');
    if (districtCount > 1) labels.push('CROSS_DISTRICT_LINKS');
    if (coAccusedCount >= 3) labels.push('HIGH_NETWORK_CENTRALITY');
    if (labels.length === 0) labels.push('SINGLE_CASE_LINK');
    return {
      person: { person_id: person.personId, name: person.name, ageBand: person.ageBand, gender: person.gender },
      incidentCount: incidents.length,
      classification: labels[0],
      districtCount,
      stationCount,
      coAccusedCount,
      firstKnownCaseDate: incidents.at(-1)?.date || null,
      latestKnownCaseDate: incidents.at(0)?.date || null,
      linkComplexityScore: Math.min(100, incidents.length * 20 + districtCount * 10 + coAccusedCount * 5),
      categoryCounts: categories,
      timeline: incidents,
      associates: [],
      incidents,
      commonModusOperandi: [...new Set(incidents.map((incident) => incident.modusOperandi).filter(Boolean))].slice(0, 10),
      labels,
      humanReviewRequired: true,
      limitation: 'Historical case links are not a prediction of guilt or future conduct.',
    };
  }

  async calculateAllDistrictRisks(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const rows = await this._rows(`
      SELECT vi.district, vi.district_id AS "districtId", COALESCE(MAX(p.risk_score), 0)::numeric AS score,
        COALESCE(MAX(p.risk_band), 'LOW') AS band, COALESCE(MAX(p.confidence), 0.5)::numeric AS confidence,
        MAX(p.forecast_end)::text AS "forecastEnd", MAX(p.data_freshness_at)::text AS "dataFreshness"
      FROM analytics.v_incidents vi
      LEFT JOIN prediction p ON p.district_id = vi.district_id AND p.forecast_end >= NOW()
      ${where}
      GROUP BY vi.district, vi.district_id
      ORDER BY score DESC, vi.district
    `, values);
    return rows.map((row) => ({
      district: row.district, districtId: row.districtId, score: Number(row.score || 0), riskScore: Number(row.score || 0),
      band: row.band, riskBand: row.band, confidence: Number(row.confidence || 0.5),
      factors: [], formulaVersion: 'district-risk-1.0.0', modelVersion: 'district-risk-1.0.0',
      forecastHorizon: '7 days', dataFreshness: row.dataFreshness || null, humanReviewRequired: true,
    }));
  }

  async calculateDistrictRiskScore(district, filters = {}, scope = {}) {
    const rows = await this.calculateAllDistrictRisks({ ...filters, district }, scope);
    return rows.find((row) => row.district?.toLowerCase() === String(district).toLowerCase()) || null;
  }

  async getRiskDistribution(filters = {}, scope = {}) {
    const risks = await this.calculateAllDistrictRisks(filters, scope);
    const distribution = risks.reduce((result, risk) => { result[risk.band] = (result[risk.band] || 0) + 1; return result; }, {});
    return { distribution, total: risks.length };
  }

  async calculateCorrelations(filters = {}, scope = {}) {
    const summaries = await this.getAllDistrictSummaries(filters, scope);
    if (summaries.length < 2) return {};
    const indicators = await this._rows('SELECT district_id, literacy_rate, unemployment_rate, poverty_rate, police_presence, urbanization_rate FROM analytics.v_district_indicators');
    const byDistrict = new Map(indicators.map((row) => [Number(row.district_id), row]));
    const pairs = summaries.map((summary) => ({ incidents: Number(summary.totalIncidents), ...byDistrict.get(Number(summary.districtId)) })).filter((row) => row.literacy_rate !== null && row.literacy_rate !== undefined);
    const correlation = (key) => {
      const xs = pairs.map((item) => item.incidents); const ys = pairs.map((item) => Number(item[key]));
      if (xs.length < 2 || ys.some((item) => !Number.isFinite(item))) return null;
      const mx = xs.reduce((sum, value) => sum + value, 0) / xs.length; const my = ys.reduce((sum, value) => sum + value, 0) / ys.length;
      const numerator = xs.reduce((sum, value, index) => sum + ((value - mx) * (ys[index] - my)), 0);
      const denominator = Math.sqrt(xs.reduce((sum, value) => sum + ((value - mx) ** 2), 0) * ys.reduce((sum, value) => sum + ((value - my) ** 2), 0));
      return denominator ? Number((numerator / denominator).toFixed(3)) : null;
    };
    return {
      literacyRate: correlation('literacy_rate'), unemploymentRate: correlation('unemployment_rate'), povertyRate: correlation('poverty_rate'),
      policePresence: correlation('police_presence'), urbanizationRate: correlation('urbanization_rate'),
      disclaimer: 'Correlation does not establish causation.',
    };
  }

  async getCorrelationMatrix(filters = {}, scope = {}) {
    const correlations = await this.calculateCorrelations(filters, scope);
    const metrics = Object.keys(correlations).filter((key) => key !== 'disclaimer');
    return { metrics, correlations, matrix: metrics.map((metric) => metrics.map((inner) => metric === inner ? 1 : correlations[inner] ?? 0)), disclaimer: 'Correlation does not establish causation.' };
  }

  async getRankedCorrelations(filters = {}, scope = {}) {
    const correlations = await this.calculateCorrelations(filters, scope);
    return Object.entries(correlations).filter(([key, value]) => key !== 'disclaimer' && value !== null).map(([metric, value]) => ({ metric, correlation: value, strength: Math.abs(value) >= 0.7 ? 'strong' : Math.abs(value) >= 0.4 ? 'moderate' : 'weak' })).sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation));
  }

  _alertScope(scope = {}) {
    const values = [];
    const clauses = ['WHERE 1 = 1'];
    if (scope?.districtId && !FULL_SCOPE_ROLES.has(scope.roleCode)) { values.push(scope.districtId); clauses.push(`AND district_id = $${values.length}`); }
    if (scope?.unitId && ['STATION_OFFICER', 'INVESTIGATOR'].includes(scope.roleCode)) { values.push(scope.unitId); clauses.push(`AND police_station_id = $${values.length}`); }
    return { where: clauses.join(' '), values };
  }

  async getAlerts(filters = {}, scope = {}) {
    const scoped = this._alertScope(scope); const values = [...scoped.values]; const clauses = [scoped.where];
    const add = (column, value) => { values.push(value); clauses.push(`AND ${column} = $${values.length}`); };
    if (filters.type) add('alert_type', filters.type);
    if (filters.severity) add('severity', filters.severity);
    if (filters.districtId) add('district_id', filters.districtId);
    if (filters.status) add('status', filters.status);
    if (filters.reviewed === true) clauses.push('AND reviewed_at IS NOT NULL');
    if (filters.reviewed === false) clauses.push('AND reviewed_at IS NULL');
    if (filters.fromDate) { values.push(filters.fromDate); clauses.push(`AND detected_at >= $${values.length}::timestamptz`); }
    if (filters.toDate) { values.push(filters.toDate); clauses.push(`AND detected_at <= $${values.length}::timestamptz`); }
    const { page, pageSize, offset } = normalizePagination(filters);
    const total = await this._one(`SELECT COUNT(*)::integer AS total FROM alert ${clauses.join(' ')}`, values);
    const rows = await this._rows(`
      SELECT alert_id AS id, alert_type AS type, severity, title, description, district_id AS "districtId",
        police_station_id AS "stationId", crime_head_id AS "crimeHeadId", status, detected_at AS "detectedAt",
        reviewed_at AS "reviewedAt", evidence, created_at AS "createdAt"
      FROM alert ${clauses.join(' ')} ORDER BY detected_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, pageSize, offset]);
    const mapped = rows.map((row) => ({ ...row, evidence: safeJson(row.evidence, {}), reviewed: Boolean(row.reviewedAt) }));
    return filters.page || filters.pageSize ? { data: mapped, pagination: serializePagination(page, pageSize, Number(total?.total || 0)) } : mapped;
  }

  async getAlertById(id, scope = {}) {
    const scoped = this._alertScope(scope);
    const values = [id, ...scoped.values];
    const scopedWhere = scoped.where.replace('WHERE 1 = 1', '').replace(/\$(\d+)/g, (_, index) => `$${Number(index) + 1}`);
    const row = await this._one(`
      SELECT alert_id AS id, alert_type AS type, severity, title, description, district_id AS "districtId",
        police_station_id AS "stationId", crime_head_id AS "crimeHeadId", status, detected_at AS "detectedAt",
        reviewed_at AS "reviewedAt", evidence, created_at AS "createdAt"
      FROM alert WHERE alert_id = $1::uuid ${scopedWhere}
    `, values);
    return row ? { ...row, evidence: safeJson(row.evidence, {}), reviewed: Boolean(row.reviewedAt) } : null;
  }

  async markAlertReviewed(id, scope = {}) {
    if (!scope?.userId) throw new Error('An authenticated reviewer is required.');
    const scoped = this._alertScope(scope); const values = [id, scope.userId, ...scoped.values];
    const row = await this._one(`
      UPDATE alert SET status = 'ACKNOWLEDGED', reviewed_at = NOW(), reviewed_by = $2::uuid
      WHERE alert_id = $1::uuid ${scoped.where.replace('WHERE 1 = 1', '').replace(/\$(\d+)/g, (_, index) => `$${Number(index) + 2}`)}
      RETURNING alert_id AS id, status, reviewed_at AS "reviewedAt"
    `, values);
    return row ? { ...row, reviewed: true } : null;
  }

  async getPoliceStations(filters = {}, scope = {}) {
    const values = []; const clauses = ['WHERE pu.active = TRUE'];
    if (filters.districtId) { values.push(filters.districtId); clauses.push(`AND pu.district_id = $${values.length}`); }
    if (scope?.districtId && !FULL_SCOPE_ROLES.has(scope.roleCode)) { values.push(scope.districtId); clauses.push(`AND pu.district_id = $${values.length}`); }
    if (scope?.unitId && ['STATION_OFFICER', 'INVESTIGATOR'].includes(scope.roleCode)) { values.push(scope.unitId); clauses.push(`AND pu.unit_id = $${values.length}`); }
    return this._rows(`
      SELECT pu.unit_id AS "stationId", pu.unit_code AS code, pu.unit_name AS "stationName", pu.district_id AS "districtId",
        d.district_name AS "districtName", pu.latitude, pu.longitude,
        (SELECT COUNT(*)::integer FROM case_master cm WHERE cm.police_station_id = pu.unit_id) AS "totalIncidents",
        (SELECT COUNT(*)::integer FROM alert a WHERE a.police_station_id = pu.unit_id AND a.status IN ('OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW')) AS "activeAlerts",
        ST_AsGeoJSON(pu.jurisdiction)::jsonb AS jurisdiction
      FROM police_unit pu
      JOIN district d ON d.district_id = pu.district_id
      JOIN unit_type ut ON ut.unit_type_id = pu.type_id AND ut.operational_level = 'STATION'
      ${clauses.join(' ')} ORDER BY d.district_name, pu.unit_name
    `, values);
  }

  async getPoliceStation(stationId, scope = {}) {
    const stations = await this.getPoliceStations({}, scope);
    const station = stations.find((item) => String(item.stationId) === String(stationId));
    if (!station) return null;
    const overview = await this.getOverview({ stationId }, scope);
    return { ...station, ...overview };
  }

  async getPoliceStationTrends(stationId, filters = {}, scope = {}) {
    return this.getMonthlyTrends({ ...filters, stationId }, scope);
  }

  async getPoliceStationHotspots(stationId, filters = {}, scope = {}) {
    return this.getHotspots({ ...filters, stationId }, scope);
  }

  async getCaseNetwork(crimeNo, scope = {}) { return this.getNetworkForIncident(crimeNo, scope); }

  async getSimilarModusOperandi(crimeNo, scope = {}) {
    const current = await this.getCaseByCrimeNo(crimeNo, scope);
    if (!current) return null;
    const { where, values } = this._conditions({}, scope);
    values.push(crimeNo, current.modusOperandi || '');
    const condition = where ? `${where} AND vi.fir_number <> $${values.length - 1}` : `WHERE vi.fir_number <> $${values.length - 1}`;
    const rows = await this._rows(`
      SELECT vi.fir_number AS "crimeNo", vi.district, vi.incident_date::text AS "incidentDate", vi.crime_type AS "crimeType",
        vi.modus_operandi AS "modusOperandi", similarity(COALESCE(vi.modus_operandi, ''), $${values.length}) AS similarity
      FROM analytics.v_incidents vi ${condition}
      ORDER BY similarity DESC, vi.incident_date DESC NULLS LAST LIMIT 20
    `, values);
    return rows.filter((row) => Number(row.similarity) > 0).map((row) => ({
      ...row, similarityScore: Number(Number(row.similarity).toFixed(2)),
      matchedFeatures: ['modus_operandi'],
      evidence: [`Both cases have similar recorded modus-operandi text: ${row.modusOperandi || 'not specified'}.`],
      algorithm: 'pg_trgm deterministic similarity', humanReviewRequired: true,
    }));
  }

  async getRegistrationDelay(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const row = await this._one(`
      WITH filtered AS (
        SELECT vi.incident_date, vi.registered_date
        FROM analytics.v_incidents vi ${where}
      ), valid AS (
        SELECT (registered_date - incident_date)::numeric AS delay_days
        FROM filtered
        WHERE incident_date IS NOT NULL
          AND registered_date IS NOT NULL
          AND registered_date >= incident_date
      )
      SELECT COUNT(*)::integer AS "recordCount",
        AVG(delay_days)::double precision AS "averageDelayDays",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY delay_days)::double precision AS "medianDelayDays",
        COUNT(*) FILTER (WHERE delay_days > ${DELAY_REVIEW_THRESHOLD_DAYS})::integer AS "delayedCaseCount"
      FROM valid
    `, values);
    return delaySummary('registration_delay', row, 'analytics.v_incidents');
  }

  async getChargesheetDelay(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const row = await this._one(`
      WITH filtered AS (
        SELECT vi.case_master_id, vi.registered_date
        FROM analytics.v_incidents vi ${where}
      ), valid AS (
        SELECT EXTRACT(EPOCH FROM (MIN(cd.chargesheet_at) - (f.registered_date::timestamp AT TIME ZONE 'Asia/Kolkata'))) / 86400.0 AS delay_days
        FROM filtered f
        JOIN chargesheet_details cd ON cd.case_master_id = f.case_master_id
        WHERE f.registered_date IS NOT NULL
          AND cd.chargesheet_at IS NOT NULL
          AND cd.chargesheet_at >= (f.registered_date::timestamp AT TIME ZONE 'Asia/Kolkata')
        GROUP BY f.case_master_id, f.registered_date
      )
      SELECT COUNT(*)::integer AS "recordCount",
        AVG(delay_days)::double precision AS "averageDelayDays",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY delay_days)::double precision AS "medianDelayDays",
        COUNT(*) FILTER (WHERE delay_days > ${DELAY_REVIEW_THRESHOLD_DAYS})::integer AS "delayedCaseCount"
      FROM valid
    `, values);
    return delaySummary('chargesheet_delay', row, 'chargesheet_details');
  }

  async getDataQualitySummary(filters = {}, scope = {}) {
    const { where, values } = this._conditions(filters, scope);
    const cases = await this._one(`
      SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL)::integer AS "missingCoordinates",
        COUNT(*) FILTER (WHERE status IS NULL)::integer AS "missingCaseStatus"
      FROM analytics.v_incidents vi ${where}
    `, values);
    const issues = await this._rows(`SELECT issue_type AS type, severity, COUNT(*)::integer AS count FROM data_quality_issue WHERE status <> 'RESOLVED' GROUP BY issue_type, severity ORDER BY count DESC`);
    const unresolved = issues.reduce((sum, item) => sum + Number(item.count), 0);
    return { overallQualityScore: Math.max(0, 100 - unresolved), totalCases: Number(cases?.total || 0), missingCoordinateCount: Number(cases?.missingCoordinates || 0), missingCaseStatusCount: Number(cases?.missingCaseStatus || 0), unresolvedIssueCount: unresolved, issues };
  }

  async getDataQualityIssues(filters = {}, scope = {}) {
    const values = []; const clauses = ['WHERE 1 = 1'];
    const add = (column, value) => { values.push(value); clauses.push(`AND ${column} = $${values.length}`); };
    if (filters.issueType) add('issue_type', filters.issueType);
    if (filters.severity) add('severity', filters.severity);
    if (filters.status) add('status', filters.status);
    const { page, pageSize, offset } = normalizePagination(filters);
    const total = await this._one(`SELECT COUNT(*)::integer AS total FROM data_quality_issue ${clauses.join(' ')}`, values);
    const rows = await this._rows(`SELECT issue_id AS id, issue_type AS type, severity, table_name AS "tableName", record_id AS "recordId", description, suggested_action AS "suggestedAction", status, detected_at AS "detectedAt", resolved_at AS "resolvedAt" FROM data_quality_issue ${clauses.join(' ')} ORDER BY detected_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    return { data: rows, pagination: serializePagination(page, pageSize, Number(total?.total || 0)) };
  }

  async reviewDataQualityIssue(issueId, updates = {}, scope = {}) {
    const status = updates.status || 'RESOLVED';
    const row = await this._one(`UPDATE data_quality_issue SET status = $2, resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE resolved_at END, resolved_by = $3::uuid WHERE issue_id = $1::uuid RETURNING issue_id AS id, status, resolved_at AS "resolvedAt"`, [issueId, status, scope.userId || null]);
    return row;
  }

  async getModels() { return this._rows(`SELECT model_version_id AS id, model_name AS "modelName", model_type AS "modelType", version, feature_schema AS "featureSchema", parameters, metrics, training_period AS "trainingPeriod", active, created_at AS "createdAt" FROM model_version ORDER BY created_at DESC`); }
  async getModelRuns() { return this._rows(`SELECT model_run_id AS id, model_version_id AS "modelVersionId", started_at AS "startedAt", completed_at AS "completedAt", status, input_filters AS "inputFilters", record_count AS "recordCount", metrics, error_message AS "errorMessage" FROM model_run ORDER BY started_at DESC LIMIT 100`); }

  async getAudit(filters = {}, scope = {}) {
    if (!['STATE_ADMIN', 'AUDITOR'].includes(scope.roleCode)) return { data: [], pagination: serializePagination(1, DEFAULT_PAGE_SIZE, 0) };
    const { page, pageSize, offset } = normalizePagination(filters);
    const values = []; const clauses = ['WHERE 1 = 1'];
    if (filters.action) { values.push(filters.action); clauses.push(`AND action = $${values.length}`); }
    const total = await this._one(`SELECT COUNT(*)::integer AS total FROM audit_log ${clauses.join(' ')}`, values);
    const rows = await this._rows(`SELECT audit_id AS id, user_id AS "userId", action, entity_type AS "entityType", entity_id AS "entityId", request_id AS "requestId", metadata, created_at AS "createdAt" FROM audit_log ${clauses.join(' ')} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    return { data: rows.map((row) => ({ ...row, metadata: safeJson(row.metadata, {}) })), pagination: serializePagination(page, pageSize, Number(total?.total || 0)) };
  }

  async createImport(payload = {}, scope = {}) {
    const importId = randomUUID();
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    const mapping = { ...(payload.mapping || {}), previewRows: Array.isArray(payload.previewRows) ? payload.previewRows.slice(0, 20) : [] };
    const row = await this._one(`INSERT INTO data_import (import_id, filename, source_type, status, total_rows, accepted_rows, rejected_rows, duplicate_rows, started_at, uploaded_by, mapping) VALUES ($1::uuid, $2, $3, 'VALIDATED', $4, $5, $6, $7, NOW(), $8::uuid, $9::jsonb) RETURNING import_id AS id, status, total_rows AS "totalRows", accepted_rows AS "acceptedRows", rejected_rows AS "rejectedRows", duplicate_rows AS "duplicateRows"`, [importId, String(payload.filename || 'upload.csv').slice(0, 255), payload.sourceType || 'CaseMaster', Number(payload.totalRows || payload.rows?.length || 0), Number(payload.acceptedRows || payload.rows?.length || 0), Number(payload.rejectedRows || 0), Number(payload.duplicateRows || 0), scope.userId || null, JSON.stringify(mapping)]);
    if (errors.length) {
      await this._query(`
        INSERT INTO data_import_error (import_id, row_number, column_name, error_code, error_message, raw_value)
        SELECT $1::uuid, entry.row_number, entry.column_name, entry.error_code, entry.error_message, entry.raw_value
        FROM jsonb_to_recordset($2::jsonb) AS entry(row_number integer, column_name varchar, error_code varchar, error_message text, raw_value text)
      `, [importId, JSON.stringify(errors.slice(0, 10_000))]);
    }
    return row;
  }

  async getImport(importId, scope = {}) { return this._one(`SELECT import_id AS id, filename, source_type AS "sourceType", status, total_rows AS "totalRows", accepted_rows AS "acceptedRows", rejected_rows AS "rejectedRows", duplicate_rows AS "duplicateRows", started_at AS "startedAt", completed_at AS "completedAt", mapping FROM data_import WHERE import_id = $1::uuid`, [importId]); }
  async getImportErrors(importId) { return this._rows(`SELECT import_error_id AS id, row_number AS "rowNumber", column_name AS "columnName", error_code AS "errorCode", error_message AS "errorMessage", raw_value AS "rawValue" FROM data_import_error WHERE import_id = $1::uuid ORDER BY row_number LIMIT 500`, [importId]); }
  async commitImport(importId, scope = {}) { return this._one(`UPDATE data_import SET status = 'COMMITTED', completed_at = NOW() WHERE import_id = $1::uuid AND status IN ('VALIDATED', 'PENDING') RETURNING import_id AS id, status, completed_at AS "completedAt"`, [importId]); }

  async processQuery(query, filters = {}, scope = {}) {
    const intent = resolveApprovedCopilotIntent(query, filters);
    const { toolUsed } = intent;
    let data;

    if (requiresCaseReference(toolUsed) && !intent.caseNo) {
      data = {
        status: 'requires_case_reference',
        message: 'Provide a valid crime number in filters.crimeNo or explicitly in the question to use this approved case tool.',
        humanReviewRequired: true,
      };
    } else if (toolUsed === 'findHotspots') data = await this.getHotspots(filters, scope);
    else if (toolUsed === 'getCrimeTrend') data = await this.getMonthlyTrends(filters, scope);
    else if (toolUsed === 'findRepeatOffenders') data = await this.getOffenders(filters, scope);
    else if (toolUsed === 'getHighRiskAreas') data = await this.calculateAllDistrictRisks(filters, scope);
    else if (toolUsed === 'getDataQualitySummary') data = await this.getDataQualitySummary(filters, scope);
    else if (toolUsed === 'compareDistricts') data = await this.getDistrictComparison(filters, scope);
    else if (toolUsed === 'getDistrictSummary') data = filters.district ? await this.getDistrictAnalysis(filters.district, filters, scope) : await this.getAllDistrictSummaries(filters, scope);
    else if (toolUsed === 'getPoliceStationSummary') data = intent.stationId ? await this.getPoliceStation(intent.stationId, scope) : await this.getPoliceStations(filters, scope);
    else if (toolUsed === 'detectCrimeSpike') {
      const alerts = await this.getAlerts(filters, scope);
      const alertRows = Array.isArray(alerts) ? alerts : alerts.data || [];
      data = {
        status: 'ok',
        algorithm: 'persisted rolling-baseline spike alerts',
        alerts: alertRows.filter((alert) => /SPIKE/i.test(String(alert.type || ''))),
        humanReviewRequired: true,
        limitations: ['Only persisted, authorized alerts are returned; an alert is not proof of criminal activity.'],
      };
    } else if (toolUsed === 'getCaseSummary') data = await this.getCaseByCrimeNo(intent.caseNo, scope);
    else if (toolUsed === 'getCaseNetwork' || toolUsed === 'findRelatedCases') data = await this.getCaseNetwork(intent.caseNo, scope);
    else if (toolUsed === 'findSimilarModusOperandi') data = await this.getSimilarModusOperandi(intent.caseNo, scope);
    else if (toolUsed === 'getRegistrationDelay') data = await this.getRegistrationDelay(filters, scope);
    else if (toolUsed === 'getChargesheetDelay') data = await this.getChargesheetDelay(filters, scope);
    else if (toolUsed === 'getOffenderProfile') {
      data = {
        status: 'requires_authorized_profile_route',
        message: 'Use the authorized offender profile route with a scoped person identifier. The Copilot does not infer or search identities.',
        humanReviewRequired: true,
      };
    } else if (toolUsed === 'generateIntelligenceBrief') {
      const overview = await this.getOverview(filters, scope);
      data = {
        status: 'preview_only',
        overview,
        message: 'A deterministic brief preview is available. Generate a persisted report through the authorized reports endpoint.',
        humanReviewRequired: true,
      };
    } else data = await this.getOverview(filters, scope);

    return {
      type: legacyCopilotTypeForTool(toolUsed, intent.matched),
      toolUsed,
      data,
      message: 'Approved analytical tool result generated.',
      filters,
      dataPeriod: { start: filters.dateFrom || null, end: filters.dateTo || null },
      recordCount: copilotRecordCount(data),
      dataSources: ['PostgreSQL/PostGIS'],
      confidence: 0.8,
      limitations: ['Synthetic prototype data', 'Human review is required for all intelligence outputs'],
      followUpSuggestions: this.getSuggestions(),
    };
  }

  getSuggestions() { return ['Show the crime overview', 'Find current hotspots', 'Show monthly crime trends', 'Show district summary', 'Show police station summary', 'Detect a crime spike alert', 'Show case summary for FIR...', 'Find related cases for FIR...', 'Find similar modus operandi for FIR...', 'Show registration delay', 'Show chargesheet delay', 'Generate an intelligence brief']; }

  async generateReport(filters = {}, format = 'html', scope = {}) {
    const overview = await this.getOverview(filters, scope); const reportId = randomUUID();
    const title = 'KAVACH Intelligence Report';
    const reportFormat = format === 'pdf' ? 'pdf' : 'html';
    const verificationHash = createHash('sha256').update(`${reportId}:${JSON.stringify(filters)}:${overview.totalIncidents}`).digest('hex');
    await this._query(`INSERT INTO intelligence_report (report_id, report_type, title, filters, generated_by, generated_at, model_versions, data_period, review_status, verification_hash) VALUES ($1::uuid, 'INTELLIGENCE_BRIEF', $2, $3::jsonb, $4::uuid, NOW(), '[]'::jsonb, $5::jsonb, 'PENDING_REVIEW', $6)`, [reportId, title, JSON.stringify(filters), scope.userId || null, JSON.stringify(overview.dataPeriod), verificationHash]);
    const html = `<!doctype html><html><body><h1>${title}</h1><p>Report ID: ${reportId}</p><p>Total incidents: ${overview.totalIncidents}</p><p>Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.</p></body></html>`;
    if (reportFormat !== 'pdf') {
      return { reportId, html, format: reportFormat, contentType: 'text/html', filename: `kavach-report-${reportId}.html`, verificationHash, overview };
    }

    const pdfBuffer = await createKavachPdfReport({ title, reportId, filters, overview, verificationHash });
    const persisted = await persistKavachPdfReport({ reportId, pdfBuffer });
    await this._query('UPDATE intelligence_report SET report_path = $2 WHERE report_id = $1::uuid', [reportId, persisted.relativePath]);
    return {
      reportId,
      html,
      format: reportFormat,
      contentType: 'application/pdf',
      filename: persisted.fileName,
      downloadUrl: `/api/kavach/reports/${reportId}/download`,
      pdfBase64: pdfBuffer.toString('base64'),
      verificationHash,
      overview,
    };
  }

  async getReport(reportId, scope = {}) {
    const values = [reportId];
    const unrestricted = ['STATE_ADMIN', 'AUDITOR'].includes(scope.roleCode);
    let accessClause = '';
    if (!unrestricted) {
      if (!scope.userId) return null;
      values.push(scope.userId);
      accessClause = ` AND generated_by = $${values.length}::uuid`;
    }
    return this._one(`
      SELECT report_id AS id, report_type AS "reportType", title, filters, generated_at AS "generatedAt",
        model_versions AS "modelVersions", data_period AS "dataPeriod", review_status AS "reviewStatus",
        report_path AS "reportPath", verification_hash AS "verificationHash"
      FROM intelligence_report
      WHERE report_id = $1::uuid${accessClause}
    `, values);
  }
}

export default PostgresKavachRepository;
