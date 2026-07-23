# KAVACH AI local deployment

This prototype is designed for a local, government-controlled or evaluation environment. Do not deploy the synthetic demo as an internet-facing investigative system.

## Required services

- PostgreSQL 16 + PostGIS through `infra/docker-compose.yml`
- Node backend on port 3001
- React/Vite frontend on port 5173
- Optional FastAPI analytics service on port 5000
- Optional local Ollama on port 11434

## Configuration

Copy `.env.example` to `.env`. For a local authenticated demo, set unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `SEED_ADMIN_PASSWORD` values. Keep `.env`, database volumes, report outputs, and model files out of source control.

Set `CORS_ALLOWED_ORIGINS` to an explicit frontend origin. Do not use `*` while credentials are enabled.

## Start and validate

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:migrate-demo
npm run dev:full
```

Validation endpoints:

```bash
curl http://localhost:3001/api/health
curl http://localhost:5000/health
```

## Production boundary

Production deployment requires an approved network design, TLS termination, secret manager, least-privilege database role, security review, legal approval, monitoring, backups, disaster recovery, and a formal process for model validation and human review. Managed public demo hosting is out of scope.
