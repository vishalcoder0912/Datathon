import {randomUUID} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {
  getConnectorProvider,
  scrubConnectorConfig,
  validateConnectorConfiguration,
} from '../kavach/connectors/connector-catalog.js';
import {inferSchema, maskPreviewRows} from '../kavach/connectors/universal-data-gateway.js';

describe('Universal Data Gateway connector catalog', () => {
  it('requires secret references for non-native connectors', () => {
    const result = validateConnectorConfiguration('POSTGRESQL', {
      host: 'db.internal',
      port: 5432,
      database: 'crime_records',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('secretRef');
  });

  it('removes raw credentials from persisted configuration', () => {
    expect(scrubConnectorConfig({
      bucket: 'ksp-imports',
      accessKey: 'should-not-survive',
      password: 'also-remove',
      nested: {apiToken: 'remove-this-too', prefix: 'district/'},
    })).toEqual({bucket: 'ksp-imports', nested: {prefix: 'district/'}});
  });

  it('describes native file upload capabilities', () => {
    const provider = getConnectorProvider('file_upload');
    expect(provider.adapter).toBe('native');
    expect(provider.capabilities).toContain('preview');
  });
});

describe('Universal Data Gateway schema safety', () => {
  const rows = [
    {fir_no: 'FIR-001', district: 'Mysuru', suspect_name: 'Ramesh Kumar', latitude: 12.31},
    {fir_no: 'FIR-002', district: 'Mysuru', suspect_name: 'Suresh Rao', latitude: 12.32},
  ];

  it('infers field types and flags likely PII', () => {
    const schema = inferSchema(rows);
    expect(schema.find((field) => field.sourceField === 'latitude').inferredType).toBe('number');
    expect(schema.find((field) => field.sourceField === 'suspect_name').potentialPii).toBe(true);
  });

  it('masks likely PII in previews', () => {
    const preview = maskPreviewRows(rows, 1);
    expect(preview).toHaveLength(1);
    expect(preview[0].suspect_name).not.toBe('Ramesh Kumar');
    expect(preview[0].district).toBe('Mysuru');
  });
});

describe('Universal Data Gateway mapping workflow', () => {
  it('requires an approved mapping before marking a job ready to import', async () => {
    const {UniversalDataGateway} = await import('../kavach/connectors/universal-data-gateway.js');
    const gateway = new UniversalDataGateway();
    const scope = {userId: randomUUID(), roleCode: 'DATA_ENGINEER'};
    const source = await gateway.registerSource({
      name: `Test upload ${randomUUID()}`,
      sourceType: 'FILE_UPLOAD',
      config: {fileName: 'cases.csv'},
    }, scope);
    const mapping = await gateway.saveMapping(source, {
      fieldMappings: {fir_no: 'Incident.firNumber', district: 'District.name'},
      piiFields: [],
      approved: true,
    }, scope);
    const job = await gateway.startSync(source, {
      rows: [{fir_no: 'FIR-100', district: 'Mysuru'}],
      mappingId: mapping.id,
      mappingApproved: true,
      mode: 'manual',
    }, scope);

    expect(job.status).toBe('READY_TO_IMPORT');
    expect(job.mappingId).toBe(mapping.id);
    expect(job.recordsCommitted).toBe(0);
  });
});
