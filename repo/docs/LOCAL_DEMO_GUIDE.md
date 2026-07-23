# KAVACH AI Local Demo Guide

## 1. Prepare the environment

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env`: set `SEED_ADMIN_PASSWORD`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. Keep `KAVACH_DATA_SOURCE=postgres` and `VITE_AUTH_REQUIRED=true`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r apps/ml-service/requirements.txt
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:migrate-demo
npm run dev:full
```

macOS/Linux use `python3 -m venv .venv` and `source .venv/bin/activate`.

## 2. Validate services

```powershell
curl http://localhost:3001/api/health
curl http://localhost:5000/health
```

Optional local narratives:

```powershell
ollama pull qwen3:4b
```

## 3. Investigation walkthrough

1. Sign in as the local evaluator or administrator.
2. Open Dashboard and select an active alert.
3. Open Geo Intelligence; select a district from the accessible list or map, then a station marker.
4. Inspect scoped hotspots and explainability metadata.
5. Open Network Intelligence, choose a person/case edge, and inspect the evidence drawer.
6. Open a masked repeat-link profile and compare similar MO cases.
7. Generate an intelligence report. The report includes synthetic watermark, data source, filters, model metadata, confidence, and human-review disclaimer.

Reviewed alerts, import records, and cases remain after backend restarts because PostgreSQL persists the data volume.
