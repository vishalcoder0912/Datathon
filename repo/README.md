# KAVACH AI

KAVACH AI — Karnataka AI Visualization & Analytics for Crime Hotspots — is a local Datathon 2026 prototype for explainable, aggregated crime-intelligence analysis. It preserves the existing React command-centre experience while adding a PostgreSQL 16 + PostGIS implementation alongside the `file-demo` fallback.

> Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.

No paid API, hosted vector database, map token, or cloud authentication provider is required. The only optional model service is local Ollama.

## Implemented

The list below describes code and configuration present in this repository. It
does not represent completed production or live local-stack verification.

- PostgreSQL/PostGIS migrations, reference data, spatial indexes, database views, and transaction-safe crime-number generation are included as repository artifacts. Live Docker/PostGIS execution is not yet verified in this workspace.
- A synthetic FIR-shaped KAVACH demo migration script with idempotency safeguards is included; its complete run against a live PostgreSQL/PostGIS container remains to be verified.
- PostgreSQL repository mode is implemented, with the existing `file-demo` repository retained as a documented fallback. Live repository queries still require local-stack verification.
- Local JWT authentication, rotating refresh tokens, roles, geographic scope, masking, audit records, and request IDs.
- District/station drill-down, PostGIS spatial filters, MapLibre overlays, explainable hotspots, alerts, risks, anomalies, MO similarity, and NetworkX-compatible graph payloads.
- FastAPI analytics service with deterministic degraded behavior when PostgreSQL or optional embedding models are unavailable.
- Local-Ollama Copilot tool router with deterministic fallback.
- Data-quality monitoring UI and import validation/preview support.

## Partially implemented

- The committed district overlays are illustrative synthetic map boundaries; they are not operational jurisdiction boundaries.
- PDF/HTML report rendering is locally implemented; live PostgreSQL persistence, download authorization, production signing, retention policy, and controlled document storage remain to be verified or completed.
- CSV/XLS/XLSX uploads can be parsed and validated, but source-type mapping review, duplicate/reference validation against the database, and committing rows into KAVACH domain tables are not implemented. The current import commit action records the import status only.
- Kannada labels and routing cover basic UI/query handling, not full multilingual intelligence interpretation.

## Optional

- `ollama pull qwen3:4b` enables narrative Copilot explanations. Supported analytical tool results still work if Ollama is offline.
- `sentence-transformers` can improve MO similarity locally; weighted structured/trigram similarity remains the deterministic baseline.

## Future production work

- Government-controlled deployment, independent security assessment, legal/privacy review, formal model validation, verified KSP source mapping, monitoring, backup/DR, and explicit human-review operations.

## Local quick start

Prerequisites: Docker Desktop/Engine, Node.js 20+ (Node 22+ recommended), Python 3.10+.

The commands below are the intended local setup. Docker/PostgreSQL/PostGIS startup,
migrations, and the demo migration have not been successfully verified in this
workspace, so treat any failure as a setup issue to resolve rather than evidence
that the full stack is ready.

```bash
npm install

# PowerShell
Copy-Item .env.example .env
# Set SEED_ADMIN_PASSWORD in .env before continuing.

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r apps/ml-service/requirements.txt

npm run db:up
npm run db:migrate
npm run db:seed
npm run db:migrate-demo

# Optional — local model only
ollama pull qwen3:4b

npm run dev:full
```

After all services start successfully, open `http://localhost:5173`, then sign in with `SEED_ADMIN_EMAIL` and the password set in `SEED_ADMIN_PASSWORD`. The backend is at `http://localhost:3001`; FastAPI health is at `http://localhost:5000/health`.

On macOS/Linux, use `cp .env.example .env`, `python3 -m venv .venv`, and `source .venv/bin/activate`.

## Useful commands

```bash
npm run db:down
npm run db:reset
npm run lint
npm run test:backend
npm run test:frontend
npm run test:integration
npm run build
npm run test:e2e:kavach
```

`npm run test:integration` performs its live Postgres/PostGIS assertion only when
`DATABASE_URL` is configured; otherwise that test is skipped. The current
Playwright KAVACH investigation test uses mocked API responses, so it does not
verify a running Docker/PostgreSQL deployment.

## Architecture

```text
React + TypeScript + TanStack Query + MapLibre/Cytoscape
                    |
                  REST/SSE
                    v
Existing Node.js HTTP backend — auth, RBAC, audit, approved tools
                    |
             parameterized SQL
                    v
          PostgreSQL 16 + PostGIS
             |                  |
             v                  v
 FastAPI analytics service   local Ollama (optional)
```

The frontend never calls FastAPI or Ollama directly. PostgreSQL is the source of truth in `KAVACH_DATA_SOURCE=postgres` mode.

## Documentation

- [Local demo guide](docs/LOCAL_DEMO_GUIDE.md)
- [PostgreSQL architecture](docs/POSTGRES_ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Data migration](docs/DATA_MIGRATION.md)
- [Security and RBAC](docs/SECURITY_AND_RBAC.md)
- [Analytics methods](docs/ANALYTICS_METHODS.md)
- [Copilot architecture](docs/COPILOT_ARCHITECTURE.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)

## Safety boundary

KAVACH AI does not predict individual guilt, recommend arrest/enforcement, use biometric matching, or use caste, religion, or gender as a predictive feature. Person labels describe case roles and links only; evaluator and aggregate roles receive masked identities.
