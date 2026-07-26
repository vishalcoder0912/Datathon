# InsightFlow Testing Prompts for Open-Source Collaboration

This document is a repo-accurate testing guide for `retry-the-project`. It is intended for contributors who want to validate the current InsightFlow app manually and through API checks before opening issues or pull requests.

## Table Of Contents

1. [Quick Start](#quick-start)
2. [Setup And Prerequisites](#setup-and-prerequisites)
3. [Run The App](#run-the-app)
4. [Backend API Testing](#backend-api-testing)
5. [Frontend Testing](#frontend-testing)
6. [Feature Testing](#feature-testing)
7. [Performance Testing](#performance-testing)
8. [Error Handling Testing](#error-handling-testing)
9. [Integration Testing](#integration-testing)
10. [Troubleshooting](#troubleshooting)
11. [Contribution Notes](#contribution-notes)

## Quick Start

### Test 1: 5-minute smoke test

From the repo root:

```bash
npm install
```

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:frontend
```

Terminal 3:

```bash
curl http://localhost:3001/api/health
curl http://localhost:8080
```

Manual browser check:

1. Open `http://localhost:8080`
2. Confirm the dashboard loads
3. Click through `Dashboard`, `Data Table`, `Upload`, `Analytics`, and `AI Chat`
4. Confirm there are no blocking console errors

Expected result: the app loads, navigation works, and the backend health endpoint responds with HTTP `200`.

## Setup And Prerequisites

### Prompt 1: verify the environment

```bash
node --version
npm --version
python --version
```

Expected:

- Node.js `18+`
- npm `9+`
- Python `3.8+` for ML service testing

Clone and install:

```bash
git clone https://github.com/Vishal-Mernstack/retry-the-project
cd retry-the-project
npm install
```

### Prompt 2: configure environment variables

This repo already includes `.env.example`. Copy it to `.env` and adjust only if needed.

Minimal local configuration:

```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=
ML_SERVICE_URL=http://localhost:5000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
VITE_API_BASE_URL=http://localhost:3001
DATABASE_PATH=./apps/backend/data/insightflow.sqlite
LOG_LEVEL=info
```

Notes:

- `GEMINI_API_KEY` can be left empty. The backend supports local fallback behavior.
- The frontend Vite dev server runs on port `8080`.
- The backend runs on port `3001`.
- The ML service is optional and defaults to port `5000`.

## Run The App

### Prompt 3: start services

From the repo root:

```bash
npm run dev:backend
```

In a second terminal:

```bash
npm run dev:frontend
```

Optional ML service:

```bash
cd apps/ml-service
pip install -r requirements.txt
python app.py
```

Alternative combined command from the repo root:

```bash
npm run dev:all
```

Note: `dev:all` uses a shell background operator and is less portable on Windows PowerShell than running frontend and backend in separate terminals.

## Backend API Testing

### Prompt 4: test the backend health and state endpoints

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/state
```

Expected:

- `/api/health` returns `status: "ok"`
- `/api/state` returns the current dataset and chat messages

Test status: `[ ] PASS [ ] FAIL`

### Prompt 5: create the demo dataset

```bash
curl -X POST http://localhost:3001/api/datasets/demo
```

Expected response includes:

- `dataset.id`
- `dataset.name`
- `dataset.rowCount`
- `dataset.columns`

Save the dataset ID:

```text
DATASET_ID=<value from response>
```

Test status: `[ ] PASS [ ] FAIL`

### Prompt 6: import a sample dataset

Sample payload:

```json
{
  "name": "sample-employees",
  "rows": [
    { "id": 1, "name": "Alice", "age": 28, "salary": 65000, "department": "Engineering", "experience_years": 3 },
    { "id": 2, "name": "Bob", "age": 35, "salary": 75000, "department": "Management", "experience_years": 8 },
    { "id": 3, "name": "Charlie", "age": 24, "salary": 50000, "department": "Sales", "experience_years": 1 },
    { "id": 4, "name": "Diana", "age": 32, "salary": 70000, "department": "Engineering", "experience_years": 6 },
    { "id": 5, "name": "Eve", "age": 29, "salary": 60000, "department": "Sales", "experience_years": 4 },
    { "id": 6, "name": "Frank", "age": 45, "salary": 85000, "department": "Management", "experience_years": 12 },
    { "id": 7, "name": "Grace", "age": 26, "salary": 52000, "department": "Engineering", "experience_years": 2 },
    { "id": 8, "name": "Henry", "age": 38, "salary": 72000, "department": "Sales", "experience_years": 10 },
    { "id": 9, "name": "Ivy", "age": 31, "salary": 68000, "department": "Engineering", "experience_years": 5 },
    { "id": 10, "name": "Jack", "age": 33, "salary": 71000, "department": "Management", "experience_years": 9 }
  ],
  "columns": [
    { "name": "id", "type": "number" },
    { "name": "name", "type": "string" },
    { "name": "age", "type": "number" },
    { "name": "salary", "type": "number" },
    { "name": "department", "type": "string" },
    { "name": "experience_years", "type": "number" }
  ]
}
```

Request:

```bash
curl -X POST http://localhost:3001/api/datasets/import \
  -H "Content-Type: application/json" \
  -d @sample-payload.json
```

Expected:

- HTTP `201`
- dataset created successfully
- returned `dataset.id` can be used in later tests

Test status: `[ ] PASS [ ] FAIL`

### Prompt 7: test the schema endpoint

```bash
curl http://localhost:3001/api/datasets/$DATASET_ID/schema
```

Expected:

- `schema.datasetName`
- `schema.rowCount`
- `schema.columnCount`
- `schema.columns`

Test status: `[ ] PASS [ ] FAIL`

### Prompt 8: test the chat endpoint with a cache miss

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"What is the average salary?\"}"
```

Expected:

- `userMessage`
- `assistantMessage.content`
- `assistantMessage.sql`
- `assistantMessage.chart`
- `assistantMessage.insights`
- `assistantMessage.usedAI`

Test status: `[ ] PASS [ ] FAIL`
Response time: `_____`

### Prompt 9: repeat the same query to check query caching

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"What is the average salary?\"}"
```

Then inspect cache stats:

```bash
curl http://localhost:3001/api/cache/stats
curl http://localhost:3001/api/datasets/$DATASET_ID/cache/stats
```

Expected:

- cache stats show non-zero cached entries after repeated queries
- hit counters increase
- repeated request should be measurably faster than the first one

Note: the current chat response shape does not guarantee a `cacheHit` flag in the response body. Use the cache stats endpoints to confirm behavior.

Test status: `[ ] PASS [ ] FAIL`

### Prompt 10: test multiple analytics prompts

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"Show average salary by department\"}"

curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"How many employees are in each department?\"}"

curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"Who has the highest salary?\"}"

curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"Show experience distribution\"}"
```

Record:

| Query | Status | Time | Notes |
| --- | --- | --- | --- |
| Average salary by department | [ ] | ___ | ___ |
| Employee count by department | [ ] | ___ | ___ |
| Highest salary | [ ] | ___ | ___ |
| Experience distribution | [ ] | ___ | ___ |

### Prompt 11: test correlation analysis

```bash
curl http://localhost:3001/api/datasets/$DATASET_ID/ai-correlations
```

Expected:

- `correlations`
- `summary`
- optional metadata such as `hasGemini`

Test status: `[ ] PASS [ ] FAIL`

### Prompt 12: test AI helper endpoints

These routes exist in the backend and are useful for broader analytics validation:

```bash
curl http://localhost:3001/api/datasets/$DATASET_ID/ai/profile
curl http://localhost:3001/api/datasets/$DATASET_ID/ai/anomalies
curl http://localhost:3001/api/datasets/$DATASET_ID/ai/relationships
curl http://localhost:3001/api/datasets/$DATASET_ID/ai/cleaning
curl http://localhost:3001/api/datasets/$DATASET_ID/ai/suggestions
curl http://localhost:3001/api/datasets/$DATASET_ID/ai/advanced-charts
curl http://localhost:3001/api/datasets/$DATASET_ID/stats
```

Expected:

- each endpoint responds with HTTP `200`
- payload shape matches the endpoint purpose
- no server crash or malformed JSON

## Frontend Testing

### Prompt 13: test primary navigation

Open `http://localhost:8080`.

Verify these routes manually:

- `/` -> Dashboard
- `/data` -> Data Table
- `/upload` -> Upload
- `/analytics` -> Analytics
- `/analytics/profile` -> Profile
- `/analytics/anomalies` -> Anomalies
- `/analytics/relationships` -> Relations
- `/analytics/cleaning` -> Cleaning
- `/analytics/export` -> Export
- `/chat` -> AI Chat

Checklist:

| Page | Loads | No Console Errors | Navigation Works |
| --- | --- | --- | --- |
| Dashboard | [ ] | [ ] | [ ] |
| Data Table | [ ] | [ ] | [ ] |
| Upload | [ ] | [ ] | [ ] |
| Analytics | [ ] | [ ] | [ ] |
| Profile | [ ] | [ ] | [ ] |
| Anomalies | [ ] | [ ] | [ ] |
| Relations | [ ] | [ ] | [ ] |
| Cleaning | [ ] | [ ] | [ ] |
| Export | [ ] | [ ] | [ ] |
| AI Chat | [ ] | [ ] | [ ] |

### Prompt 14: test file upload

Manual steps:

1. Open `http://localhost:8080/upload`
2. Upload `sample.csv` or another small CSV
3. Confirm the success state is visible
4. Confirm the dataset becomes available in the app

Expected:

- upload flow completes
- imported dataset is visible in downstream pages
- no blocking runtime errors

Test status: `[ ] PASS [ ] FAIL`

### Prompt 15: test the data table page

Open `http://localhost:8080/data`.

Manual checks:

- sorting works on at least one numeric column
- searching or filtering narrows visible rows
- table renders expected row count for the test dataset
- editing, if exposed by the UI, persists without crashing

Record:

| Feature | Status | Notes |
| --- | --- | --- |
| Sorting | [ ] | ___ |
| Search/filter | [ ] | ___ |
| Row rendering | [ ] | ___ |
| Inline edit | [ ] | ___ |

### Prompt 16: test the dashboard

Open `http://localhost:8080/`.

Verify:

- KPI cards render
- charts render without blank panels
- values are consistent with the loaded dataset
- no layout breakage on desktop and narrow viewport

Test status: `[ ] PASS [ ] FAIL`

### Prompt 17: test the chat interface

Open `http://localhost:8080/chat`.

Try:

1. `What is the average salary?`
2. `Show average salary by department`
3. Repeat the first query again

Expected:

- your message appears immediately
- assistant response renders
- SQL is visible when generated
- chart appears when applicable
- repeated queries are faster after caching warms up

Test status: `[ ] PASS [ ] FAIL`

## Feature Testing

### Prompt 18: test analysis query types

Use either the chat UI or the chat API.

Prompts:

- `What is the average salary?`
- `Show salary distribution`
- `Compare salary by department`
- `Who makes more than 70000?`
- `Group employees by department`

Expected:

- aggregation prompts return aggregate values
- distribution prompts return chartable outputs
- comparison prompts group by category
- filtering prompts isolate matching rows
- SQL and insights remain relevant to the prompt

Status: `[ ] All working [ ] Some issues [ ] Failures`

### Prompt 19: test export features

The backend supports export endpoints:

```bash
curl -OJ http://localhost:3001/api/datasets/$DATASET_ID/export/json
curl -OJ http://localhost:3001/api/datasets/$DATASET_ID/export/csv
curl -OJ http://localhost:3001/api/datasets/$DATASET_ID/export/md
```

Expected:

- file download starts
- content type is correct
- generated output is not empty

Test status: `[ ] PASS [ ] FAIL`

### Prompt 20: test sampling endpoints

```bash
curl "http://localhost:3001/api/datasets/$DATASET_ID/sample/random?size=5"
curl "http://localhost:3001/api/datasets/$DATASET_ID/sample/stratified?size=5"
curl "http://localhost:3001/api/datasets/$DATASET_ID/sample/clustered?size=5"
```

Expected:

- each endpoint returns `success: true`
- `sampleSize` is less than or equal to requested size
- rows array is returned

### Prompt 21: test local dataset endpoints if using local mode

These are optional and relevant only if you are testing local database mode:

```bash
curl -X POST http://localhost:3001/api/datasets/local-import \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"local-sample\",\"columns\":[{\"name\":\"id\",\"type\":\"number\"}],\"rows\":[{\"id\":1}]}"
```

Then:

```bash
curl "http://localhost:3001/api/datasets/$DATASET_ID/local-data?page=0&limit=100"
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/local-query \
  -H "Content-Type: application/json" \
  -d "{\"sql\":\"SELECT * FROM dataset LIMIT 10\"}"
```

Expected:

- import succeeds
- local data endpoint returns rows
- local SQL query is validated and executed

## Performance Testing

### Prompt 22: measure key response times

Examples:

```bash
curl http://localhost:3001/api/state
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"What is the average salary?\"}"
curl http://localhost:3001/api/cache/stats
```

Suggested targets:

| Operation | Target |
| --- | --- |
| State endpoint | < 1s |
| First chat query | < 5s local fallback |
| Repeated chat query | faster than first request |
| Dashboard initial render | no obvious blocking delay |

If you want timing numbers:

- PowerShell: use `Measure-Command { Invoke-WebRequest ... }`
- macOS/Linux: prefix with `time`

### Prompt 23: sequential load test

PowerShell:

```powershell
1..10 | ForEach-Object {
  Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/datasets/$env:DATASET_ID/chat" `
    -ContentType "application/json" `
    -Body (@{ query = "Query number $_" } | ConvertTo-Json)
}
```

Bash:

```bash
for i in $(seq 1 10); do
  curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"Query number $i\"}"
done
```

Expected:

- no crash
- all requests complete
- no major memory or stability regression

## Error Handling Testing

### Prompt 24: empty query

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"\"}"
```

Expected:

- HTTP `400`
- error message indicates query is required or empty

### Prompt 25: invalid dataset ID

```bash
curl http://localhost:3001/api/datasets/invalid-id-xyz/schema
curl http://localhost:3001/api/datasets/invalid-id-xyz/ai-correlations
```

Expected:

- HTTP `404`
- helpful error payload

### Prompt 26: malformed JSON

```bash
curl -X POST http://localhost:3001/api/datasets/import \
  -H "Content-Type: application/json" \
  -d "{bad json}"
```

Expected:

- HTTP `400` or `500` with a clear parse error
- no server crash

### Prompt 27: unsupported export format

```bash
curl http://localhost:3001/api/datasets/$DATASET_ID/export/xml
```

Expected:

- HTTP `400`
- error explains supported formats: `json`, `csv`, `md`

### Prompt 28: invalid local SQL

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/local-query \
  -H "Content-Type: application/json" \
  -d "{\"sql\":\"DROP TABLE dataset\"}"
```

Expected:

- validation failure
- unsafe SQL is rejected

### Prompt 29: offline frontend behavior

Manual browser test:

1. Open DevTools
2. Switch network to `Offline`
3. Trigger a page action that calls the API
4. Restore network

Expected:

- visible error state
- UI remains usable
- action can be retried once connectivity returns

## Integration Testing

### Prompt 30: end-to-end contributor journey

1. Start backend and frontend
2. Load demo dataset or import CSV
3. Verify dashboard and data table
4. Ask a chat question
5. Repeat the same question
6. Open analytics pages
7. Export one result
8. If ML service is running, test training and prediction

Overall status: `[ ] PASS [ ] FAIL`

### Prompt 31: ML workflow, if enabled

Backend-side ML routes currently available:

- `GET /api/ml/models/list`
- `POST /api/datasets/:datasetId/ml/train`
- `POST /api/datasets/:datasetId/ml/predict`
- `GET /api/datasets/:datasetId/ml/feature-importance`
- `DELETE /api/datasets/:datasetId/ml/model`

Suggested training request:

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/ml/train \
  -H "Content-Type: application/json" \
  -d "{\"targetColumn\":\"salary\",\"problemType\":\"regression\"}"
```

Prediction request:

```bash
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/ml/predict \
  -H "Content-Type: application/json" \
  -d "{\"inputData\":{\"age\":30,\"experience_years\":5,\"department\":\"Engineering\"}}"
```

Feature importance:

```bash
curl http://localhost:3001/api/datasets/$DATASET_ID/ml/feature-importance
```

Expected:

- training succeeds when ML service is running
- prediction returns values
- importance endpoint responds after a model exists

### Prompt 32: cross-browser checks

Recommended browsers:

- Chrome
- Edge
- Firefox
- Safari if available

For each browser, verify:

- app loads
- sidebar navigation works
- charts render
- upload works
- chat works
- no major layout issues

## Troubleshooting

### Prompt 33: backend will not start

Windows:

```powershell
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

macOS/Linux:

```bash
lsof -i :3001
kill -9 <pid>
```

Then retry:

```bash
npm run dev:backend
```

### Prompt 34: frontend will not load

```bash
curl http://localhost:8080
npm run build:frontend
npm run dev:frontend
```

If dependencies are broken:

```bash
npm install
```

### Prompt 35: no AI responses or only fallback responses

Check:

- `.env` has a valid `GEMINI_API_KEY` if you expect Gemini-backed responses
- Ollama is available if you are testing local model integration
- backend logs do not show provider failures

Optional local model setup:

```bash
ollama pull mistral
ollama serve
```

### Prompt 36: cache appears inactive

```bash
curl http://localhost:3001/api/cache/stats
curl http://localhost:3001/api/datasets/$DATASET_ID/cache/stats
curl -X POST http://localhost:3001/api/datasets/$DATASET_ID/cache/clear
```

Check that:

- the exact same query text is repeated
- the same dataset ID is used
- cache totals increase after repeated requests

### Prompt 37: ML service issues

```bash
cd apps/ml-service
pip install -r requirements.txt
python app.py
```

Health check:

```bash
curl http://localhost:5000/api/ml/health
```

If AutoGluon is unavailable, the service falls back to a baseline predictor. That is acceptable for development validation.

## Contribution Notes

### Prompt 38: report an issue cleanly

Include:

- exact reproduction steps
- expected behavior
- actual behavior
- screenshots or logs when relevant
- OS, Node, npm, and Python versions

Issue URL:

`https://github.com/Vishal-Mernstack/retry-the-project/issues/new`

Suggested title prefixes:

- `[BUG]`
- `[FEATURE]`
- `[DOCS]`
- `[TEST]`

### Prompt 39: pre-PR validation

Before opening a PR, contributors should ideally confirm:

- `npm install` completes
- frontend starts with `npm run dev:frontend`
- backend starts with `npm run dev:backend`
- core API smoke tests pass
- dashboard, upload, data table, analytics, and chat all load
- changed behavior is documented if the PR alters test expectations

## Final Checklist

```text
[ ] Node.js 18+ available
[ ] npm install completed
[ ] .env configured
[ ] Backend started on 3001
[ ] Frontend started on 8080
[ ] Health endpoint responds
[ ] State endpoint responds
[ ] Demo dataset works
[ ] Dataset import works
[ ] Schema endpoint works
[ ] Chat endpoint works
[ ] Cache stats increase on repeated queries
[ ] Correlation endpoint works
[ ] Dashboard loads
[ ] Data table loads
[ ] Upload works
[ ] Analytics pages load
[ ] Chat UI works
[ ] Export endpoints work
[ ] Error cases are handled cleanly
[ ] ML workflow validated or marked not tested
```

Support links:

- Issues: `https://github.com/Vishal-Mernstack/retry-the-project/issues`
- Main repo: `https://github.com/Vishal-Mernstack/retry-the-project`
