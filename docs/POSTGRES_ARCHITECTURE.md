# PostgreSQL and PostGIS Architecture

PostgreSQL 16 with PostGIS is KAVACH AI's source of truth. The Node server uses the `pg` pool and parameterized queries; the browser does not connect to PostgreSQL or FastAPI directly.

```text
KAVACH page -> Node REST/SSE -> repository -> PostgreSQL/PostGIS
                                       -> FastAPI only for bounded analytics
```

`infra/docker-compose.yml` starts `postgis/postgis:16-3.4` with a named local volume, UTF-8 initialization, application timezone Asia/Kolkata, and UTC timestamp storage. `apps/backend/src/db/migration-runner.js` uses an advisory lock, checks SHA-256 checksums, records duration in `schema_migrations`, and applies each migration in a transaction.

Spatial columns use SRID 4326. GiST indexes support bounding-box, radius, point-in-district, point-in-station, and cluster queries. The normalized relationship tables and `analytics.v_case_network_edges` replace any paid graph database requirement.

## Modes

- `KAVACH_DATA_SOURCE=postgres` is the default persistent mode.
- `KAVACH_DATA_SOURCE=file-demo` retains the committed synthetic files for local fallback only. The UI labels this mode explicitly.

## Migrations

| Version | Purpose |
| --- | --- |
| 001 | PostgreSQL extensions |
| 002 | normalized reference tables |
| 003 | case/FIR tables |
| 004 | canonical person, locations, MO |
| 005 | analytics, imports, reports, audit |
| 006 | users, refresh tokens, roles |
| 007 | operational, spatial, trigram indexes |
| 008 | frontend-compatible and analytical views |
| 009 | triggers, status history, crime-number functions |
| 010 | safe reference seed data |

Never modify an applied migration. Add a new ordered file instead.
