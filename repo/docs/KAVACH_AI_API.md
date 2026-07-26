# KAVACH AI API Reference

Base path: `/api`. All KAVACH endpoints return the existing success envelope with `data`; list responses add `pagination` (`page`, `pageSize`, `total`, `totalPages`). In PostgreSQL mode they require an access token and apply role plus geographic scope. `file-demo` is a documented local fallback only.

## Authentication

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Intelligence endpoints

Existing dashboard, trend, hotspot, anomaly, network, person-link, risk, correlation, alert, Copilot, report, and schema-map routes remain under `/api/kavach/*`.

New persistent routes include:

- `GET /api/kavach/police-stations`, `/:stationId`, `/:stationId/trends`, `/:stationId/hotspots`
- `GET /api/kavach/cases`, `/:crimeNo`, `/:crimeNo/network`, `/:crimeNo/similar-mo`
- `GET /api/kavach/data-quality/summary`, `/data-quality/issues`; `PATCH /data-quality/issues/:issueId`
- `POST /api/kavach/imports`; `GET /imports/:importId`, `/imports/:importId/errors`; `POST /imports/:importId/commit`
- `GET /api/kavach/models`, `/models/runs`, `/audit`
- `POST /api/kavach/reports`; `GET /reports/:reportId`, `/reports/:reportId/download`
- `GET /api/kavach/alerts/stream` (authenticated Server-Sent Events)

Supported query filters: `page`, `pageSize`, `dateFrom`, `dateTo`, `districtId`, `stationId`, `crimeHeadId`, `crimeSubHeadId`, `status`, `severity`, and `daypart`.

The Copilot endpoint executes only allow-listed analytical tools after validation and authorization. It never accepts model-generated SQL. Full tool behavior is documented in [COPILOT_ARCHITECTURE.md](COPILOT_ARCHITECTURE.md).

PDF reports are generated locally with PDFKit, include the synthetic-data/human-review disclaimer, and are only downloadable through the scoped report endpoint.
