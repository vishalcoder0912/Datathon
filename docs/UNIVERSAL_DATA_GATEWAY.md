# KAVACH AI Universal Data Gateway

The Universal Data Gateway is the controlled ingestion boundary between external provider data and the canonical KAVACH crime-data model. It does not pretend that a cloud provider can be accessed without credentials, permissions, network routes, schema review, and human approval.

## Implemented API

All routes require an authenticated user with `manage:data` permission.

```text
GET  /api/kavach/data-sources/providers
GET  /api/kavach/data-sources
POST /api/kavach/data-sources
POST /api/kavach/data-sources/:id/test
POST /api/kavach/data-sources/:id/discover
POST /api/kavach/data-sources/:id/preview
POST /api/kavach/data-sources/:id/mappings
POST /api/kavach/data-sources/:id/sync
GET  /api/kavach/ingestion-jobs/:id
```

Supported connector definitions include Amazon S3, Google Cloud Storage, Azure Blob Storage, PostgreSQL, MySQL, MongoDB, REST APIs, SFTP, and native file uploads.

## Credential boundary

The API accepts only a `secretRef`, such as a GCP Secret Manager resource name or a Vault path. Configuration keys matching passwords, tokens, API keys, access keys, private keys, credentials, or connection strings are removed before persistence.

Example source registration:

```json
{
  "name": "SCRB nightly PostgreSQL",
  "sourceType": "POSTGRESQL",
  "secretRef": "projects/kavach/secrets/scrb-postgres/versions/latest",
  "config": {
    "host": "scrb-db.internal",
    "port": 5432,
    "database": "crime_records",
    "schemas": ["public"]
  }
}
```

## Provider adapters

`FILE_UPLOAD` uses the native KAVACH adapter for local schema inference and PII-masked previews. Cloud, database, API, and SFTP connectors are represented as Airbyte or Airbyte CDK adapters. KAVACH tracks source metadata, mappings, and jobs; the external adapter performs provider connectivity and data movement.

Until an Airbyte control-plane adapter is configured, external connection tests report `configuration_validated`, not a fabricated successful network connection.

## Sync safety states

A sync request creates an ingestion job. It does not insert rows into authoritative crime tables merely because data was discovered.

```text
MAPPING_REQUIRED
    -> human reviews source-to-canonical mapping
READY_TO_IMPORT
    -> validation and duplicate/reference checks
RUNNING
    -> controlled commit transaction
COMPLETED | PARTIAL | FAILED
```

A sync can enter `READY_TO_IMPORT` only when it references an approved mapping belonging to the same data source. Domain-table commit workers and Airbyte callbacks should update later states; `records_committed` remains zero until that controlled transaction actually succeeds.

## PostgreSQL migration

Migration `012_universal_data_gateway.sql` creates:

- `kavach_data_source`
- `kavach_schema_mapping`
- `kavach_ingestion_job`

Run:

```bash
npm run db:migrate
npm run test:backend -- data-gateway.test.js
```

For local development without PostgreSQL, the service may use an explicitly non-production ephemeral fallback. Set `KAVACH_GATEWAY_EPHEMERAL_FALLBACK=false` to disable it.
