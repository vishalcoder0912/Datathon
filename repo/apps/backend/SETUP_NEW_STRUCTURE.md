# 🏗️ InsightFlow - New Folder Structure Setup

## 📋 Current Status

The new folder structure has been **partially implemented**. Here's what's in place:

```
apps/backend/src/
├── config/
│   ├── environment.js       ✅ (Centralized config)
│   ├── constants.js         ✅
│   └── gemini-config.js     ✅
├── core/
│   └── server.js            ✅ (HTTP server setup)
├── database/
│   └── (existing files)
├── services/
│   ├── ai/
│   │   ├── ai-manager.js    ✅ (Master AI orchestrator)
│   │   ├── providers/
│   │   │   ├── ollama-provider.js    ✅
│   │   │   ├── gemini-provider.js   ✅
│   │   │   ├── openai-provider.js   ✅
│   │   │   └── anthropic-provider.js ✅
│   │   └── utils/
│   ├── analytics/          ✅ (schema-detector, analytics-service, etc.)
│   ├── data/               ✅ (data-merger, data-sampling-service)
│   ├── export/             ✅ (report-generator)
│   ├── query/              ✅
│   ├── recommendation/    ✅
│   ├── visualization/     ✅
│   └── alert-service.js    ✅
├── routes/
│   ├── index.js           ✅ (Route aggregator)
│   ├── ai.js              ✅
│   ├── analytics.js       ✅
│   ├── chat.js            ✅
│   ├── datasets.js        ✅
│   ├── export.js          ✅
│   └── health.js          ✅
├── middleware/
│   ├── error-handler.js   ✅
│   ├── cors.js            ✅
│   └── request-logger.js  ✅
├── utils/
│   ├── response-utils.js  ✅
│   └── (other utilities)
├── index.js               ✅ (New entry point)
├── server.js              ⚠️ (Legacy - to be removed)
└── types/
```

## ✅ What's Working

1. **AI Provider System** - Full fallback chain: Ollama → Gemini → OpenAI → Anthropic
2. **Configuration** - Centralized in `config/environment.js`
3. **Modular Routes** - Organized in `routes/`
4. **Services** - Reorganized by domain (ai, analytics, data, export, etc.)

## 🔧 To Use the New Structure

### 1. Update package.json scripts

Update `apps/backend/package.json`:

```json
{
  "scripts": {
    "dev": "node src/index.js",
    "dev:watch": "node --watch src/index.js",
    "start": "node src/index.js"
  }
}
```

### 2. Start the Server

```bash
cd apps/backend
npm run dev
```

### 3. Test the Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# AI status
curl http://localhost:3001/api/ai/status

# Test AI generation
curl -X POST http://localhost:3001/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello!"}'
```

## 📊 AI Provider Configuration

### Environment Variables (.env)

```env
# Primary - Ollama (Local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_CHAT_MODEL=neural-chat:7b

# Fallback 1 - Google Gemini
GOOGLE_API_KEY=your_key_here

# Fallback 2 - OpenAI
OPENAI_API_KEY=your_key_here

# Fallback 3 - Anthropic Claude
ANTHROPIC_API_KEY=your_key_here

# Provider Priority
AI_PROVIDER_PRIORITY=ollama,gemini,openai,anthropic
ENABLE_AI_FALLBACK=true
```

## 🧪 Testing Checklist

- [ ] Server starts: `npm run dev`
- [ ] Health check: `curl http://localhost:3001/api/health`
- [ ] AI status: `curl http://localhost:3001/api/ai/status`
- [ ] Ollama working: Check provider status
- [ ] Fallback works: Disable Ollama and test

## 🧹 Cleanup (When Ready)

Once the new structure is verified working, remove legacy files:

```bash
# Remove old server file (keep backup first)
cp src/server.js src/server.js.bak
rm src/server.js

# Remove old service files that have been migrated
rm -f src/services/ai-analyzer.js
rm -f src/services/ai-cascade-service.js
rm -f src/services/ollama-ai-service.js
rm -f src/services/gemini-ai-service.js
rm -f src/services/ollama-service.js
```

## 📚 Documentation

- **FOLDER_STRUCTURE.md** - Detailed architecture explanation
- **API Endpoints** - See `routes/index.js` for available endpoints

## ✅ Success Indicators

- Server logs show: "✅ InsightFlow API running on http://localhost:3001"
- `/api/health` responds with status
- `/api/ai/status` shows available providers
- Ollama shows as active provider when running

## 🚨 Troubleshooting

### Port already in use
```bash
lsof -ti:3001 | xargs kill -9
# Or change PORT in .env
```

### Ollama not available
```bash
# Ensure Ollama is running
ollama serve

# Pull models
ollama pull llama3.2
ollama pull neural-chat:7b

# Test connection
curl http://localhost:11434/api/tags
```

### Import errors
- Check relative paths in imports
- Ensure all files have `.js` extensions
- Verify node_modules is installed

## 🎯 Next Steps

1. ✅ Structure already implemented
2. ✅ Test the new entry point (`npm run dev`)
3. ✅ Verify all endpoints work
4. 🧹 Clean up legacy files when ready