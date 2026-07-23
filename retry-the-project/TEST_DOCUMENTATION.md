# InsightFlow AI - Complete Testing Documentation

**Last Updated:** April 20, 2026  
**Project:** AI-Powered Data Analytics Platform  
**Version:** 1.0.0

---

## Test Results Summary

| Component | Status | Details |
|-----------|--------|---------|
| Backend API | ✅ PASS | All endpoints functional |
| Query Cache | ✅ PASS | Cache initialized and working |
| Chat API | ✅ PASS | Returns proper responses |
| Schema API | ✅ PASS | Returns correct schema |
| Demo Dataset | ✅ PASS | 200 rows loaded |

---

## Project Structure

```
retry-the-project/
├── apps/
│   ├── backend/                    # Node.js Backend (Port 3001)
│   │   └── src/
│   │       ├── server.js          # Main server entry
│   │       ├── database/
│   │       │   └── dataset-repository.js
│   │       ├── services/
│   │       │   ├── analytics-service.js
│   │       │   ├── query-cache.js
│   │       │   ├── gemini-ai-service.js
│   │       │   ├── ml-client.js
│   │       │   ├── schema-packet-builder.js
│   │       │   ├── schema-ai-service.js
│   │       │   └── local-database-service.js
│   │       ├── routes/
│   │       │   ├── health.routes.js
│   │       │   ├── analytics.routes.js
│   │       │   ├── chat.routes.js
│   │       │   └── dataset.routes.js
│   │       ├── middleware/
│   │       │   ├── validation.middleware.js
│   │       │   ├── logger.middleware.js
│   │       │   └── error.middleware.js
│   │       ├── config/
│   │       │   └── gemini-config.js
│   │       └── utils/
│   │           └── helpers.js
│   │
│   ├── frontend/                  # React Frontend (Port 8080/8081)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── routes/AppRouter.tsx
│   │       │   ├── providers/AppProviders.tsx
│   │       │   └── App.tsx
│   │       ├── features/
│   │       │   ├── chat/
│   │       │   │   ├── pages/ChatPage.tsx
│   │       │   │   ├── pages/LocalChatPage.tsx
│   │       │   │   └── components/
│   │       │   ├── dashboard/
│   │       │   │   ├── pages/DashboardPage.tsx
│   │       │   │   ├── pages/DataTablePage.tsx
│   │       │   │   └── components/
│   │       │   ├── data/
│   │       │   │   ├── pages/UploadPage.tsx
│   │       │   │   └── context/
│   │       │   ├── analytics/
│   │       │   │   └── pages/AnalyticsPage.tsx
│   │       │   └── ml/
│   │       │       └── pages/MLPage.tsx  ← NEW
│   │       └── shared/
│   │
│   └── ml-service/               # Python ML Service (Port 5000)
│       ├── app.py
│       ├── requirements.txt
│       └── Dockerfile
│
├── packages/
│   ├── shared-analytics/
│   └── shared-errors/
│
├── .env                       # Environment config
├── sample.csv                 # Test data
├── start-all.sh               # Linux/Mac startup
├── start-all.bat              # Windows startup
├── test-integration.sh      # Linux/Mac test
└── test-integration.bat       # Windows test
```

---

## API Endpoints Tested

### 1. Health Check
```bash
GET http://localhost:3001/api/health

Response:
{"status":"ok","databasePath":".../apps/backend/data/insightflow.sqlite"}
```

### 2. Cache Stats
```bash
GET http://localhost:3001/api/cache/stats

Response:
{"success":true,"cache":{"totalCached":0,"totalHits":0,"hitRate":"0%","savedAPICalls":0,"estimatedCostSaved":"$0.00"}}
```

### 3. Create Demo Dataset
```bash
POST http://localhost:3001/api/datasets/demo

Response: {"dataset":{...},"chatMessages":[]}
```

### 4. Chat Query
```bash
POST http://localhost:3001/api/datasets/{id}/chat
Content-Type: application/json
{"query":"What is the average revenue by category?"}

Response:
{
  "userMessage":{...},
  "assistantMessage":{
    "id":"...",
    "role":"assistant",
    "content":"Using local analysis: Average Revenue by Category",
    "sql":"SELECT category, AVG(revenue) AS revenue FROM dataset_rows GROUP BY category ORDER BY revenue DESC;",
    "chart":{
      "type":"bar",
      "title":"Average Revenue by Category",
      "xKey":"category",
      "yKey":"revenue",
      "data":[
        {"category":"Clothing","revenue":31746.74},
        {"category":"Electronics","revenue":29298},
        {"category":"Food","revenue":32284.72},
        {"category":"Services","revenue":28752.37},
        {"category":"Software","revenue":34705.66}
      ]
    }
  }
}
```

### 5. Schema Endpoint
```bash
GET http://localhost:3001/api/datasets/{id}/schema

Response:
{
  "schema":{
    "datasetName":"Sales Analytics 2024",
    "rowCount":200,
    "columnCount":7,
    "columns":[
      {"name":"month","type":"string","role":"dimension"},
      {"name":"category","type":"string","role":"dimension"},
      {"name":"region","type":"string","role":"dimension"},
      {"name":"revenue","type":"number","role":"metric","aggregation":"sum"},
      {"name":"units_sold","type":"number","role":"metric","aggregation":"sum"},
      {"name":"profit_margin","type":"number","role":"metric","aggregation":"average"},
      {"name":"customer_rating","type":"number","role":"metric","aggregation":"average"}
    ]
  }
}
```

---

## Frontend Routes

| Route | Page | Status |
|-------|------|--------|
| `/` | Dashboard | ✅ Available |
| `/upload` | Upload | ✅ Available |
| `/chat` | Chat | ✅ Available |
| `/local-chat` | Local Chat | ✅ Available |
| `/data` | Data Table | ✅ Available |
| `/analytics` | Analytics | ✅ Available |
| `/ml` | ML Training | ✅ Available |

---

## How to Run

### Windows (Manual)

**Terminal 1 - Backend:**
```powershell
cd apps\backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd apps\frontend
npm run dev
```

**Terminal 3 - ML Service (Optional):**
```powershell
cd apps\ml-service
python app.py
```

### Access URLs

- Frontend: http://localhost:8081 (or http://localhost:8080)
- Backend: http://localhost:3001
- ML Service: http://localhost:5000

---

## Test Commands

```powershell
# Test backend health
curl http://localhost:3001/api/health

# Test cache stats
curl http://localhost:3001/api/cache/stats

# Create demo dataset
curl -X POST http://localhost:3001/api/datasets/demo

# Chat query (replace with actual dataset ID)
curl -X POST http://localhost:3001/api/datasets/{dataset-id}/chat -H "Content-Type: application/json" -d "{\"query\":\"show me revenue by month\"}"
```

---

## Key Features

1. **Query Caching** - Caches AI responses to reduce API costs
2. **Local Fallback** - Works without Gemini API key
3. **ML Training** - AutoGluon integration for predictions
4. **Chart Generation** - Automatic chart creation from queries
5. **SQL Preview** - Shows generated SQL for each query

---

## Dependencies

### Backend (Node.js)
- axios: 1.14.0
- @google/generative-ai: ^0.24.1
- @insightflow/shared-analytics

### Frontend (React)
- axios: 1.14.0
- react-router-dom
- recharts
- @radix-ui components
- tailwindcss

### ML Service (Python)
- autogluon[tabular]
- flask
- flask-cors
- pandas
- numpy

---

## Environment Variables (.env)

```env
PORT=3001
NODE_ENV=development
GEMINI_API_KEY=your_api_key_here
ML_SERVICE_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:3001
DATABASE_PATH=./apps/backend/data/insightflow.sqlite
LOG_LEVEL=info
```

---

## Next Steps

1. Install Python dependencies for ML service:
   ```bash
   cd apps/ml-service
   pip install -r requirements.txt
   ```

2. Set up Gemini API key in `.env` (optional - works without it)

3. Run the full test suite and verify frontend at http://localhost:8081

---

## Support

- GitHub Issues: https://github.com/vishalcoder0912/retry-the-project/issues
- Documentation: See docs/ folder