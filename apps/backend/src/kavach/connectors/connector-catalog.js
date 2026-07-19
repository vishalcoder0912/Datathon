const catalog = Object.freeze([
  {
    provider: 'AWS',
    sourceType: 'S3',
    label: 'Amazon S3',
    adapter: 'airbyte',
    requiredConfig: ['bucket'],
    optionalConfig: ['prefix', 'region', 'format'],
    capabilities: ['test', 'discover', 'preview', 'incremental_sync'],
  },
  {
    provider: 'GCP',
    sourceType: 'GCS',
    label: 'Google Cloud Storage',
    adapter: 'airbyte',
    requiredConfig: ['bucket'],
    optionalConfig: ['prefix', 'projectId', 'format'],
    capabilities: ['test', 'discover', 'preview', 'incremental_sync'],
  },
  {
    provider: 'AZURE',
    sourceType: 'BLOB_STORAGE',
    label: 'Azure Blob Storage',
    adapter: 'airbyte',
    requiredConfig: ['container'],
    optionalConfig: ['prefix', 'accountName', 'format'],
    capabilities: ['test', 'discover', 'preview', 'incremental_sync'],
  },
  {
    provider: 'DATABASE',
    sourceType: 'POSTGRESQL',
    label: 'PostgreSQL',
    adapter: 'airbyte',
    requiredConfig: ['host', 'port', 'database'],
    optionalConfig: ['schemas', 'sslMode'],
    capabilities: ['test', 'discover', 'preview', 'incremental_sync'],
  },
  {
    provider: 'DATABASE',
    sourceType: 'MYSQL',
    label: 'MySQL',
    adapter: 'airbyte',
    requiredConfig: ['host', 'port', 'database'],
    optionalConfig: ['schemas', 'sslMode'],
    capabilities: ['test', 'discover', 'preview', 'incremental_sync'],
  },
  {
    provider: 'DATABASE',
    sourceType: 'MONGODB',
    label: 'MongoDB',
    adapter: 'airbyte',
    requiredConfig: ['host', 'database'],
    optionalConfig: ['collections', 'replicaSet'],
    capabilities: ['test', 'discover', 'preview', 'incremental_sync'],
  },
  {
    provider: 'API',
    sourceType: 'REST',
    label: 'REST API',
    adapter: 'airbyte-cdk',
    requiredConfig: ['baseUrl'],
    optionalConfig: ['resourcePath', 'pagination', 'recordsPath'],
    capabilities: ['test', 'discover', 'preview', 'scheduled_sync'],
  },
  {
    provider: 'TRANSFER',
    sourceType: 'SFTP',
    label: 'Secure SFTP',
    adapter: 'airbyte-cdk',
    requiredConfig: ['host', 'port', 'path'],
    optionalConfig: ['format', 'filePattern'],
    capabilities: ['test', 'discover', 'preview', 'scheduled_sync'],
  },
  {
    provider: 'FILE',
    sourceType: 'FILE_UPLOAD',
    label: 'CSV / Excel / JSON upload',
    adapter: 'native',
    requiredConfig: [],
    optionalConfig: ['fileName', 'format'],
    capabilities: ['test', 'discover', 'preview', 'manual_sync'],
  },
]);

const secretKeyPattern = /(password|secret|token|credential|private.?key|connection.?string|access.?key|api.?key)/i;

export function listConnectorProviders() {
  return catalog.map((item) => ({...item}));
}

export function getConnectorProvider(sourceType) {
  return catalog.find((item) => item.sourceType === String(sourceType || '').toUpperCase()) || null;
}

export function scrubConnectorConfig(config = {}) {
  return Object.fromEntries(Object.entries(config).filter(([key]) => !secretKeyPattern.test(key)));
}

export function validateConnectorConfiguration(sourceType, config = {}, secretRef = null) {
  const definition = getConnectorProvider(sourceType);
  if (!definition) {
    return {valid: false, errors: [`Unsupported source type: ${sourceType}`], definition: null};
  }

  const errors = definition.requiredConfig
    .filter((key) => config[key] === undefined || config[key] === null || String(config[key]).trim() === '')
    .map((key) => `Missing required configuration field: ${key}`);

  if (definition.adapter !== 'native' && !secretRef) {
    errors.push('A secretRef is required. Raw provider credentials are never stored in KAVACH.');
  }

  return {valid: errors.length === 0, errors, definition};
}

export const CONNECTOR_SOURCE_TYPES = Object.freeze(catalog.map((item) => item.sourceType));
