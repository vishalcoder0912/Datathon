# KAVACH AI Project Architecture

## Canonical local runtime

```text
apps/frontend (Vite :5173)
  -> /api proxy / configured VITE_API_URL
apps/backend/src/index.js (Node HTTP :3001)
  -> PostgreSQL/PostGIS :5432
  -> apps/ml-service (FastAPI :5000, internal only)
  -> Ollama :11434 (optional, local only)
```

The active KAVACH route layer is `apps/backend/src/routes/kavach.js`; repository selection is controlled by `KAVACH_DATA_SOURCE=postgres|file-demo`. PostgreSQL is the default source of truth. File-demo is restricted to a local fallback.

## Main boundaries

- `apps/frontend/src/kavach`: user-facing command-centre pages, API client, auth-aware queries, maps, and graph components.
- `apps/backend/src/db`: connection pool, transactions, migrations, and parameterized SQL filters.
- `apps/backend/src/kavach`: repositories, services, validators, response mappers, and approved Copilot tools.
- `apps/backend/src/auth` and `middleware`: local authentication, role/scope enforcement, request context, audit, rate limits, and headers.
- `infra/postgres/migrations`: ordered schema evolution.
- `apps/ml-service/app`: internal explainable analytical methods.
- `infra/geo`: committed synthetic district/station demo overlays.

See `docs/POSTGRES_ARCHITECTURE.md` for the data path and `docs/SECURITY_AND_RBAC.md` for access constraints.
