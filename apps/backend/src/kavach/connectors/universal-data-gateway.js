import {randomUUID} from 'node:crypto';
import {getConnectorProvider, scrubConnectorConfig, validateConnectorConfiguration} from './connector-catalog.js';

const memory = {
  sources: new Map(),
  jobs: new Map(),
};

const piiKeyPattern = /(name|phone|mobile|email|address|aadhaar|pan|account|device|imei|ip|passport)/i;

function now() {
  return new Date().toISOString();
}

function inferType(values) {
  const clean = values.filter((value) => value !== null && value !== undefined && value !== '');
  if (clean.length === 0) return 'unknown';
  if (clean.every((value) => typeof value === 'boolean' || ['true', 'false'].includes(String(value).toLowerCase()))) return 'boolean';
  if (clean.every((value) => Number.isFinite(Number(value)))) return 'number';
  if (clean.every((value) => !Number.isNaN(Date.parse(String(value))))) return 'date';
  if (clean.every((value) => typeof value === 'object')) return 'object';
  return 'string';
}

export function inferSchema(rows = []) {
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : [];
  const keys = [...new Set(safeRows.flatMap((row) => Object.keys(row)))];
  return keys.map((key) => {
    const values = safeRows.map((row) => row[key]);
    const nonNull = values.filter((value) => value !== null && value !== undefined && value !== '');
    return {
      sourceField: key,
      inferredType: inferType(values),
      nullable: nonNull.length !== values.length,
      nullPercentage: values.length ? Number((((values.length - nonNull.length) / values.length) * 100).toFixed(2)) : 0,
      uniquePercentage: values.length ? Number(((new Set(nonNull.map(String)).size / values.length) * 100).toFixed(2)) : 0,
      potentialPii: piiKeyPattern.test(key),
      samples: nonNull.slice(0, 3).map((value) => piiKeyPattern.test(key) ? maskValue(value) : value),
    };
  });
}

function maskValue(value) {
  const text = String(value ?? '');
  if (text.length <= 2) return '*'.repeat(text.length);
  return `${text.slice(0, 1)}${'*'.repeat(Math.min(8, text.length - 2))}${text.slice(-1)}`;
}

export function maskPreviewRows(rows = [], limit = 25) {
  return rows.slice(0, Math.min(50, Math.max(1, Number(limit) || 25))).map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, piiKeyPattern.test(key) ? maskValue(value) : value]),
  ));
}

async function database() {
  const module = await import('../../db/pool.js');
  if (!module.isDatabaseConfigured()) return null;
  return module;
}

function canUseEphemeralFallback() {
  return process.env.NODE_ENV !== 'production' && process.env.KAVACH_GATEWAY_EPHEMERAL_FALLBACK !== 'false';
}

async function dbOrFallback(operation, fallback) {
  try {
    const db = await database();
    if (!db) return fallback();
    return await operation(db);
  } catch (error) {
    if (!canUseEphemeralFallback()) throw error;
    return fallback(error);
  }
}

function serializeSource(row) {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    sourceType: row.source_type ?? row.sourceType,
    adapter: row.adapter,
    secretRef: row.secret_ref ?? row.secretRef,
    config: row.config || {},
    status: row.status,
    districtId: row.district_id ?? row.districtId ?? null,
    unitId: row.unit_id ?? row.unitId ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    persistence: row.persistence || 'postgres',
  };
}

export class UniversalDataGateway {
  async registerSource(payload, scope = {}) {
    const validation = validateConnectorConfiguration(payload.sourceType, payload.config, payload.secretRef);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(' '));
      error.code = 'INVALID_CONNECTOR_CONFIGURATION';
      throw error;
    }

    const id = randomUUID();
    const createdAt = now();
    const source = {
      id,
      name: String(payload.name).trim(),
      provider: validation.definition.provider,
      sourceType: validation.definition.sourceType,
      adapter: validation.definition.adapter,
      secretRef: payload.secretRef || null,
      config: scrubConnectorConfig(payload.config || {}),
      status: 'CONFIGURED',
      districtId: payload.districtId || scope.districtId || null,
      unitId: payload.unitId || scope.unitId || null,
      createdAt,
      updatedAt: createdAt,
    };

    return dbOrFallback(async (db) => {
      const result = await db.query(`
        INSERT INTO kavach_data_source (
          id, name, provider, source_type, adapter, secret_ref, config, status,
          owner_user_id, district_id, unit_id, created_at, updated_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::uuid, $10::integer, $11::integer, NOW(), NOW())
        RETURNING *
      `, [
        source.id,
        source.name,
        source.provider,
        source.sourceType,
        source.adapter,
        source.secretRef,
        JSON.stringify(source.config),
        source.status,
        scope.userId || null,
        source.districtId,
        source.unitId,
      ]);
      return serializeSource(result.rows[0]);
    }, () => {
      const value = {...source, persistence: 'ephemeral'};
      memory.sources.set(source.id, value);
      return value;
    });
  }

  async listSources(scope = {}) {
    return dbOrFallback(async (db) => {
      const values = [];
      const clauses = [];
      if (scope.districtId && !['STATE_ADMIN', 'DATA_ENGINEER', 'SCRB_ANALYST'].includes(scope.roleCode)) {
        values.push(scope.districtId);
        clauses.push(`district_id = $${values.length}::integer`);
      }
      if (scope.unitId && ['STATION_OFFICER', 'INVESTIGATOR'].includes(scope.roleCode)) {
        values.push(scope.unitId);
        clauses.push(`unit_id = $${values.length}::integer`);
      }
      const result = await db.query(`SELECT * FROM kavach_data_source ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY updated_at DESC`, values);
      return result.rows.map(serializeSource);
    }, () => [...memory.sources.values()]);
  }

  async getSource(id) {
    return dbOrFallback(async (db) => {
      const result = await db.query('SELECT * FROM kavach_data_source WHERE id = $1::uuid', [id]);
      return result.rows[0] ? serializeSource(result.rows[0]) : null;
    }, () => memory.sources.get(id) || null);
  }

  async testConnection(source, payload = {}) {
    const validation = validateConnectorConfiguration(source.sourceType, source.config, source.secretRef);
    const definition = getConnectorProvider(source.sourceType);
    const hasInlineRows = Array.isArray(payload.rows) && payload.rows.length > 0;
    return {
      sourceId: source.id,
      status: validation.valid ? 'READY' : 'INVALID',
      adapter: definition?.adapter || source.adapter,
      connectivity: definition?.adapter === 'native' && hasInlineRows ? 'verified' : 'configuration_validated',
      checks: {
        configuration: validation.valid,
        secretReference: definition?.adapter === 'native' || Boolean(source.secretRef),
        sampleData: hasInlineRows,
      },
      errors: validation.errors,
      note: definition?.adapter === 'native'
        ? 'Native file data was validated locally.'
        : 'External connectivity is delegated to the configured Airbyte or custom CDK adapter; KAVACH stores only the secret reference.',
      checkedAt: now(),
    };
  }

  async discoverSchema(source, payload = {}) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const suppliedSchema = Array.isArray(payload.schema) ? payload.schema : [];
    const fields = rows.length ? inferSchema(rows) : suppliedSchema;
    return {
      sourceId: source.id,
      resource: payload.resource || source.config.resource || source.config.path || null,
      status: fields.length ? 'DISCOVERED' : 'ADAPTER_DISCOVERY_REQUIRED',
      fields,
      rowSampleSize: rows.length,
      humanMappingRequired: true,
      discoveredAt: now(),
    };
  }

  async preview(source, payload = {}) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return {
      sourceId: source.id,
      status: rows.length ? 'READY' : 'ADAPTER_PREVIEW_REQUIRED',
      rows: maskPreviewRows(rows, payload.limit),
      returned: Math.min(rows.length, Math.min(50, Math.max(1, Number(payload.limit) || 25))),
      piiMasked: true,
      previewedAt: now(),
    };
  }

  async startSync(source, payload = {}, scope = {}) {
    const job = {
      id: randomUUID(),
      sourceId: source.id,
      resource: payload.resource || null,
      mode: payload.mode || 'incremental',
      status: payload.mappingApproved ? 'READY_TO_IMPORT' : 'MAPPING_REQUIRED',
      recordsDiscovered: Array.isArray(payload.rows) ? payload.rows.length : 0,
      recordsCommitted: 0,
      mappingApproved: Boolean(payload.mappingApproved),
      requestedBy: scope.userId || null,
      createdAt: now(),
      updatedAt: now(),
      error: null,
    };

    return dbOrFallback(async (db) => {
      const result = await db.query(`
        INSERT INTO kavach_ingestion_job (
          id, data_source_id, resource, sync_mode, status, records_discovered,
          records_committed, mapping_approved, requested_by, created_at, updated_at
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::uuid, NOW(), NOW())
        RETURNING *
      `, [job.id, job.sourceId, job.resource, job.mode, job.status, job.recordsDiscovered, 0, job.mappingApproved, job.requestedBy]);
      return this.serializeJob(result.rows[0]);
    }, () => {
      const value = {...job, persistence: 'ephemeral'};
      memory.jobs.set(job.id, value);
      return value;
    });
  }

  async getJob(id) {
    return dbOrFallback(async (db) => {
      const result = await db.query('SELECT * FROM kavach_ingestion_job WHERE id = $1::uuid', [id]);
      return result.rows[0] ? this.serializeJob(result.rows[0]) : null;
    }, () => memory.jobs.get(id) || null);
  }

  serializeJob(row) {
    return {
      id: row.id,
      sourceId: row.data_source_id ?? row.sourceId,
      resource: row.resource,
      mode: row.sync_mode ?? row.mode,
      status: row.status,
      recordsDiscovered: Number(row.records_discovered ?? row.recordsDiscovered ?? 0),
      recordsCommitted: Number(row.records_committed ?? row.recordsCommitted ?? 0),
      mappingApproved: Boolean(row.mapping_approved ?? row.mappingApproved),
      requestedBy: row.requested_by ?? row.requestedBy ?? null,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt,
      error: row.error_message ?? row.error ?? null,
      persistence: row.persistence || 'postgres',
    };
  }
}

export default UniversalDataGateway;
