# 🏗️ InsightFlow Backend - Folder Structure Migration Guide

## 📋 Overview

This guide will help you complete the migration to the new optimized folder structure. The new structure is **already partially implemented** - this guide will help you finish the migration.

## ✅ What's Already Done

The following components are already in place:

### Configuration Layer (`src/config/`)
- ✅ `environment.js` - Environment configuration with validation
- ✅ `constants.js` - Application constants
- ✅ `gemini-config.js` - Gemini-specific configuration

### Core Server (`src/core/`)
- ✅ `server.js` - HTTP server setup with graceful shutdown

### AI Services (`src/services/ai/`)
- ✅ `ai-manager.js` - Master AI orchestrator with fallback chain
- ✅ `providers/ollama-provider.js` - Ollama (Llama 3.2 & NeuralChat 7B)
- ✅ `providers/gemini-provider.js` - Google Gemini
- ✅ `providers/openai-provider.js` - OpenAI GPT-4
- ✅ `providers/anthropic-provider.js` - Anthropic Claude
- ✅ `utils/prompt-templates.js` - Prompt templates
- ✅ `utils/response-parser.js` - Response parsing utilities
- ✅ `utils/token-counter.js` - Token counting utilities

### Routes (`src/routes/`)
- ✅ `index.js` - Main route aggregator
- ✅ `ai.js` - AI provider endpoints
- ✅ `health.js` - Health check endpoints
- ✅ `datasets.js` - Dataset endpoints
- ✅ `chat.js` - Chat endpoints
- ✅ `analytics.js` - Analytics endpoints
- ✅ `export.js` - Export endpoints

### Middleware (`src/middleware/`)
- ✅ `error-handler.js` - Global error handling
- ✅ `cors.js` - CORS configuration
- ✅ `request-logger.js` - Request logging
- ✅ `logger.middleware.js` - Logger middleware
- ✅ `validation.middleware.js` - Input validation
- ✅ `error.middleware.js` - Error middleware

### Utilities (`src/utils/`)
- ✅ `response-utils.js` - Response formatting utilities
- ✅ `helpers.js` - Helper functions
- ✅ `logger.js` - Logging utilities
- ✅ `schema-extractor.js` - Schema extraction utilities

### Entry Point
- ✅ `src/index.js` - New entry point (updated)
- ✅ `package.json` - Updated scripts

## 🔄 What Needs to Be Done

### 1. Move Services to Proper Directories

Services currently in `src/services/` root need to be moved:

#### Analytics Services → `src/services/analytics/`
```bash
# Move analytics-related services
mv src/services/analytics-service.js src/services/analytics/
mv src/services/schema-detector.js src/services/analytics/
mv src/services/predictive-analytics.js src/services/analytics/
mv src/services/schema-ai-service.js src/services/analytics/
mv src/services/schema-packet-builder.js src/services/analytics/
```

#### Data Services → `src/services/data/`
```bash
# Move data processing services
mv src/services/data-merger.js src/services/data/
mv src/services/data-sampling-service.js src/services/data/
mv src/services/data-visualization-service.js src/services/data/
```

#### Export Services → `src/services/export/`
```bash
# Move export services
mv src/services/export-service.js src/services/export/
mv src/services/report-generator.js src/services/export/
```

#### Query Services → `src/services/query/`
```bash
# Move query services
mv src/services/query-cache.js src/services/query/
mv src/services/smart-query-handler.js src/services/query/
```

#### Recommendation Services → `src/services/recommendation/`
```bash
# Move recommendation services
mv src/services/recommendation-engine.js src/services/recommendation/
```

### 2. Remove Old/Duplicate Files

After moving services, remove old AI service files that are now replaced:

```bash
# Remove old AI services (now in src/services/ai/)
rm src/services/ai-analyzer.js
rm src/services/ai-cascade-service.js
rm src/services/ai-data-service.js
rm src/services/gemini-ai-service.js
rm src/services/ollama-ai-service.js
rm src/services/ollama-service.js

# Remove old server.js (replaced by src/core/server.js and src/index.js)
rm src/server.js

# Remove old ai-providers directory (replaced by src/services/ai/providers/)
rm -rf src/services/ai-providers/
```

### 3. Update Import Statements

After moving files, you'll need to update import statements in the moved files:

#### In Analytics Services
```javascript
// OLD:
import { something } from '../database/dataset-repository.js';
import { aiAnalyzer } from '../ai-analyzer.js';

// NEW:
import { something } from '../../database/dataset-repository.js';
import { aiManager } from '../ai/ai-manager.js';
```

#### In Data Services
```javascript
// OLD:
import { schemaDetector } from '../schema-detector.js';

// NEW:
import { schemaDetector } from '../analytics/schema-detector.js';
```

#### In Export Services
```javascript
// OLD:
import { analyticsService } from '../analytics-service.js';

// NEW:
import { analyticsService } from '../analytics/analytics-service.js';
```

### 4. Verify All Imports

Run this command to find all imports that need updating:

```bash
# Find all imports in moved files
grep -r "from '\.\./" src/services/analytics/
grep -r "from '\.\./" src/services/data/
grep -r "from '\.\./" src/services/export/
grep -r "from '\.\./" src/services/query/
grep -r "from '\.\./" src/services/recommendation/
```

## 🧪 Testing the Migration

### Step 1: Syntax Check
```bash
# Check for syntax errors in new structure
node --check src/index.js
node --check src/core/server.js
node --check src/config/environment.js
node --check src/services/ai/ai-manager.js
```

### Step 2: Import Validation
```bash
# Test that modules can be imported
node -e "import('./src/config/environment.js').then(() => console.log('✅ Config OK'))"
node -e "import('./src/services/ai/ai-manager.js').then(() => console.log('✅ AI Manager OK'))"
node -e "import('./src/core/server.js').then(() => console.log('✅ Server OK'))"
```

### Step 3: Start Server
```bash
# Start the server
npm run dev
```

### Step 4: Test Endpoints
```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test AI status
curl http://localhost:3001/api/ai/status

# Test AI generation
curl -X POST http://localhost:3001/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello, world!"}'
```

## 📁 Final Structure

After migration, your structure should look like this:

```
apps/backend/src/
├── config/
│   ├── environment.js
│   ├── constants.js
│   └── gemini-config.js
├── core/
│   └── server.js
├── database/
│   └── dataset-repository.js
├── services/
│   ├── ai/
│   │   ├── ai-manager.js
│   │   ├── providers/
│   │   │   ├── ollama-provider.js
│   │   │   ├── gemini-provider.js
│   │   │   ├── openai-provider.js
│   │   │   └── anthropic-provider.js
│   │   └── utils/
│   │       ├── prompt-templates.js
│   │       ├── response-parser.js
│   │       └── token-counter.js
│   ├── analytics/
│   │   ├── analytics-service.js
│   │   ├── schema-detector.js
│   │   ├── predictive-analytics.js
│   │   ├── schema-ai-service.js
│   │   └── schema-packet-builder.js
│   ├── data/
│   │   ├── data-merger.js
│   │   ├── data-sampling-service.js
│   │   └── data-visualization-service.js
│   ├── export/
│   │   ├── export-service.js
│   │   └── report-generator.js
│   ├── query/
│   │   ├── query-cache.js
│   │   └── smart-query-handler.js
│   ├── recommendation/
│   │   └── recommendation-engine.js
│   ├── alert-service.js
│   ├── local-database-service.js
│   ├── ml-client.js
│   ├── pipeline-service.js
│   └── qr-upload-service.js
├── routes/
│   ├── index.js
│   ├── ai.js
│   ├── health.js
│   ├── datasets.js
│   ├── chat.js
│   ├── analytics.js
│   └── export.js
├── middleware/
│   ├── error-handler.js
│   ├── cors.js
│   ├── request-logger.js
│   ├── logger.middleware.js
│   ├── validation.middleware.js
│   └── error.middleware.js
├── utils/
│   ├── response-utils.js
│   ├── helpers.js
│   ├── logger.js
│   └── schema-extractor.js
├── genai/
│   ├── analyticsEngine.ts
│   ├── dashboardBuilder.ts
│   └── reportGenerator.ts
├── types/
└── index.js
```

## 🎯 Benefits of New Structure

1. **Clear Organization**: Code is organized by domain/function
2. **Easy to Navigate**: Logical file hierarchy
3. **Scalable**: Easy to add new providers or services
4. **Testable**: Modular design enables unit testing
5. **Maintainable**: Clear separation of concerns
6. **Professional**: Enterprise-grade architecture

## 🚨 Troubleshooting

### Import Errors
```
Error: Cannot find module './services/ai-analyzer.js'
```
**Solution**: Update the import path to use the new structure:
```javascript
import { aiManager } from './services/ai/ai-manager.js';
```

### Server Won't Start
```
Error: EADDRINUSE: address already in use :::3001
```
**Solution**: Kill the existing process:
```bash
npm run kill-port
# or
lsof -ti:3001 | xargs kill -9
```

### Ollama Not Available
```
Error: Ollama service not available
```
**Solution**: Start Ollama:
```bash
ollama serve
ollama pull llama3.2
```

### Configuration Errors
```
Error: Configuration validation failed
```
**Solution**: Check your `.env` file:
```bash
cp .env.example .env
# Edit .env with your settings
```

## 📊 Migration Checklist

- [ ] Move analytics services to `src/services/analytics/`
- [ ] Move data services to `src/services/data/`
- [ ] Move export services to `src/services/export/`
- [ ] Move query services to `src/services/query/`
- [ ] Move recommendation services to `src/services/recommendation/`
- [ ] Update all import statements in moved files
- [ ] Remove old AI service files
- [ ] Remove old `server.js` file
- [ ] Remove old `ai-providers/` directory
- [ ] Test syntax with `node --check`
- [ ] Test imports with `node -e`
- [ ] Start server with `npm run dev`
- [ ] Test health endpoint
- [ ] Test AI status endpoint
- [ ] Test AI generation
- [ ] Verify all features work

## ✅ Success Indicators

You'll know the migration is complete when:

1. ✅ Server starts without errors
2. ✅ All tests pass
3. ✅ `curl http://localhost:3001/api/health` returns 200 OK
4. ✅ `curl http://localhost:3001/api/ai/status` shows available providers
5. ✅ AI generation works with Ollama
6. ✅ All existing features still work
7. ✅ No old files remain in wrong locations

## 🎉 Need Help?

If you encounter issues:

1. Check this guide's troubleshooting section
2. Verify your `.env` configuration
3. Check the logs for specific error messages
4. Test individual components in isolation
5. Review the import paths in your files

Good luck with the migration! 🚀
