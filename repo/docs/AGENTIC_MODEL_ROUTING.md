# InsightFlow Agentic Model Routing

Use your installed models as specialized agents instead of one generic model.

| Agent role | Model | Job |
|---|---|---|
| Master planner | `insightflow-master:latest` | Understand user goal, choose tools, plan analysis flow |
| Strict schema analyst | `insightflow-strict-schema-analyst:latest` | Analyze schema only, detect metrics/dimensions/date columns |
| Schema fallback | `strict-schema-analyst:latest` | Backup schema analyst |
| Dashboard guardian | `insightflow-dashboard-guardian:latest` | Validate KPI/chart specs and prevent hallucinated columns |
| Embedding/RAG | `nomic-embed-text:latest` | Future vector retrieval for schemas, docs, examples |
| Code/SQL analyst | `qwen2.5-coder:7b` | SQL, formulas, debugging, generated code |
| General synthesis | `qwen3:8b` | Final explanation and chat answers |
| Friendly fallback | `llama3.2:latest` / `neural-chat:7b` | Lightweight fallback chat |
| Deep cloud reasoner | `minimax-m2.7:cloud` | Optional heavy reasoning when enabled |

## Safe default

Set `AGENTIC_USE_CLOUD_DEEP_REASONER=false` so your local app does not accidentally call the cloud model.

## Endpoints

```txt
GET  /api/agentic-models/config
GET  /api/agentic-models/health
POST /api/agentic-models/datasets/:datasetId/analyze
POST /api/agentic-models/datasets/:datasetId/chat
```

## Route registration

In `apps/backend/src/routes/index.js` add:

```js
import { handleAgenticModelRoutes } from './agentic-models.js';
```

Then near the top of `setupRoutes`, before older AI/dashboard routes:

```js
if (await handleAgenticModelRoutes(request, response, pathname)) {
  return;
}
```

## Test

```bash
node scripts/test-agentic-models.mjs
curl http://localhost:3001/api/agentic-models/health
```
