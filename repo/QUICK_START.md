# 🚀 Quick Start Guide - InsightFlow Agentic AI Analytics

## ⚡ 5-Minute Setup

### 1. Prerequisites

- Node.js 18+ installed
- npm or yarn
- (Optional) Python 3.8+ for ML service

### 2. Install Dependencies

```bash
cd "c:\Users\VISHAL\Desktop\20-12-2025\All_full_stack_preparation\expo\Agentic ai Data analytics"
npm install
```

### 3. Configure Environment

```bash
# Copy example env
copy .env.example .env

# Edit .env with your API keys (optional)
# Add any of these for AI features:
# GOOGLE_API_KEY=xxx
# OPENAI_API_KEY=xxx
# ANTHROPIC_API_KEY=xxx
```

### 4. Start Services

```bash
# Start all (backend + frontend)
npm run dev

# Or start individually:
npm run dev:backend    # Runs on port 3001
npm run dev:frontend   # Runs on port 5173
```

### 5. Access the App

- **Frontend**: Open http://localhost:5173 in your browser
- **API**: http://localhost:3001

---

## 📊 Common Tasks

### Import Your Data

1. Click "Upload" in the sidebar
2. Select CSV or Excel file
3. System auto-detects schema
4. Click "Import Dataset"

### Analyze with AI

1. Load or import a dataset
2. Click the "💬 Chat" tab
3. Ask questions like:
   - "Show average salary by department"
   - "Find the top 5 products by revenue"
   - "What anomalies exist in the data?"

### Export Results

1. Click "⬇️ Export" tab
2. Choose format: JSON, CSV, or Markdown
3. Download data or analysis

### Use Machine Learning

1. Go to "🤖 ML" section
2. Click "Train Model"
3. Select target column
4. Make predictions on new data

---

## 🧪 Verify Everything Works

### Run Full Test Suite

```bash
npm run test:insightflow-api
```

Expected output: **✅ 91/91 tests passing**

### Quick Health Check

```bash
curl http://localhost:3001/api/health
```

Expected: Status 200 with `"status": "healthy"`

### Load Demo Data

```bash
curl -X POST http://localhost:3001/api/datasets/demo
```

Expected: Returns demo dataset with 100+ rows

---

## 🎯 Available Features

| Feature        | How to Access                                         |
| -------------- | ----------------------------------------------------- |
| **Dashboard**  | Main page - KPIs and charts                           |
| **Data Table** | "📊 Data" tab - Browse/edit data                      |
| **Analytics**  | "📈 Analytics" tab - Profile, anomalies, correlations |
| **Chat**       | "💬 Chat" tab - Ask AI questions                      |
| **Export**     | "⬇️ Export" tab - Download data                       |
| **ML**         | "🤖 ML" tab - Train/predict models                    |
| **Upload**     | "⬆️ Upload" tab - Import CSV/Excel                    |

---

## 🤖 AI Capabilities

The system automatically uses the best available AI model:

1. **Gemini (Google)** - Default if API key configured
2. **Claude (Anthropic)** - Fallback option
3. **GPT-4 (OpenAI)** - Another fallback
4. **Ollama (Local)** - Works offline
5. **Local Analysis** - Always available

### Example Queries

```
"Show me the distribution of customer age"
"Find correlations between price and sales"
"What are the top 10 products by revenue?"
"Detect anomalies in the transaction data"
"Summarize the key insights from this dataset"
```

---

## 📁 Project Structure

```
apps/
├── backend/           # Node.js API (port 3001)
│   └── src/
│       ├── routes/    # 18+ endpoint handlers
│       ├── services/  # Business logic
│       └── config/    # Configuration
├── frontend/          # React UI (port 5173)
│   └── src/
│       ├── features/  # Feature modules
│       └── shared/    # Shared components
└── ml-service/        # Python ML (optional)
```

---

## 🔌 API Reference

### Load Demo Data

```bash
POST http://localhost:3001/api/datasets/demo
```

### Import Dataset

```bash
POST http://localhost:3001/api/datasets/import
Content-Type: application/json

{
  "name": "My Dataset",
  "rows": [
    {"name": "John", "age": 30, "salary": 50000},
    {"name": "Jane", "age": 28, "salary": 55000}
  ]
}
```

### Chat with Data

```bash
POST http://localhost:3001/api/datasets/{datasetId}/chat
Content-Type: application/json

{
  "query": "What is the average age?"
}
```

### Get Analytics

```bash
GET http://localhost:3001/api/datasets/{datasetId}/ai/profile
GET http://localhost:3001/api/datasets/{datasetId}/ai/anomalies
GET http://localhost:3001/api/datasets/{datasetId}/ai-correlations
```

---

## ⚙️ Configuration Options

### Backend Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# AI Providers (optional)
GOOGLE_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OLLAMA_HOST=http://localhost:11434

# Logging
LOG_LEVEL=info
```

### Frontend Configuration

Edit `apps/frontend/vite.config.ts`:

```typescript
const API_BASE_URL = "http://localhost:3001"; // API endpoint
const TIMEOUT = 30000; // Request timeout
```

---

## 🐛 Troubleshooting

### "Cannot find module" errors

```bash
npm install
npm run dev
```

### Port already in use

```bash
# Change port in .env
PORT=3002
```

### API not responding

1. Check backend is running: `npm run dev:backend`
2. Check API health: `curl http://localhost:3001/api/health`
3. Check logs for errors in terminal

### Chat not working

1. Verify dataset is loaded
2. Check AI keys in `.env` are valid (optional)
3. Try local analysis (works without API keys)

### Frontend build slow

This is normal. Bundle is ~1.5MB with all dependencies. First build takes longest.

---

## 📚 Learn More

- **Full Architecture**: See `PROJECT_ARCHITECTURE.md`
- **Implementation Details**: See `IMPLEMENTATION_NOTES.md`
- **Deployment**: See `DEPLOY.md`
- **API Tests**: Run `npm run test:insightflow-api`

---

## ✨ What's Included

✅ **Data Management** - Import, validate, export datasets  
✅ **AI Analysis** - Schema-first queries with Gemini/Claude  
✅ **Machine Learning** - AutoML model training  
✅ **Visualizations** - Interactive charts and dashboards  
✅ **Data Quality** - Anomaly detection and cleaning  
✅ **Chat Interface** - Natural language data exploration  
✅ **Persistence** - SQLite storage with caching  
✅ **Error Handling** - Comprehensive validation and logging

---

## 🎉 You're All Set!

The entire platform is operational with all 91 API tests passing.

**Next Step**: Import a dataset and start analyzing!

---

**Need Help?**

- Check the logs in your terminal
- Run `npm run test:insightflow-api` to verify setup
- Review error messages in browser console
- See documentation files for detailed info
