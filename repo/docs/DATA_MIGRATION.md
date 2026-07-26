# Synthetic Demo Data Migration

`npm run db:migrate-demo` executes `scripts/migrate-kavach-demo-to-postgres.mjs`. It reads only the committed synthetic files in `data/demo` and runs one database transaction.

The migration creates/upserts districts, police stations, FIR cases, canonical people, case roles, accused/victim records, PostGIS locations, MO records, and district socioeconomic indicators. It preserves each original synthetic FIR in `case_master.source_record_id`; a compliant synthetic `crime_no` is generated through the database function.

`source_record_map` makes the process idempotent. A second run updates mapped records rather than creating duplicate people/cases. The script writes a local report at `reports/demo-data-migration-report.json` with source counts, inserted/updated/skipped counts, invalid rows, generated identifiers, and foreign-key failures. That report is intentionally ignored by Git.

## Validation behavior

The importer rejects or records invalid rows rather than silently dropping them. Checks include timestamps, numeric coordinates, required district/station references, age bounds, case statuses, gender mapping, crime-number format, and foreign keys. Interactive CSV/XLSX imports use the same validate-preview-commit pattern through the backend endpoints.

No real police data, raw government identifiers, or raw mobile numbers are required or written by the demo migration.
