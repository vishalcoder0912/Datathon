# 🎯 InsightFlow Backend - New Optimized Folder Structure

## 📊 Architecture Overview

The backend has been reorganized into a **domain-driven, modular architecture** that separates concerns clearly and enables easy scaling.

## 🏗️ Structure

```
apps/backend/
├── src/
│   ├── config/              # Configuration Layer
│   │   ├── environment.js   # Environment variables & validation
│   │   ├── constants.js     # Application constants
│   │   └── gemini-config.js # Gemini-specific config
│   │
│   ├── core/                # Server Core
│   │   └── server.js        # HTTP server setup & lifecycle
│   │
│   ├── database/            # Data Persistence Layer
│   │   └── dataset-repository.js
│   │
│   ├── services/            # Business Logic Layer
│   │   ├── ai/              # AI & LLM Integration
│   │   │   ├── ai-manager.js           # Master orchestrator
│   │   │   ├── providers/              # AI Provider implementations
│   │   │   │   ├── ollama-provider.js  # Llama 3.2 & NeuralChat 7B
│   │   │   │   ├── gemini-provider.js  # Google Gemini
│   │   │   │   ├── openai-provider.js  # OpenAI GPT-4
│   │   │   │   └── anthropic-provider.js # Anthropic Claude
│   │   │   └── utils/                 # AI utilities
│   │   │       ├── prompt-templates.js
│   │   │       ├── response-parser.js
│   │   │       └── token-counter.js
│   │   │
│   │   ├── analytics/       # Data Analysis & Insights
│   │   │   ├── analytics-service.js
│   │   │   ├── schema-detector.js
│   │   │   ├── predictive-analytics.js
│   │   │   ├── schema-ai-service.js
│   │   │   └── schema-packet-builder.js
│   │   │
│   │   ├── data/            # Data Processing & ETL
│   │   │   ├── data-merger.js
│   │   │   ├── data-sampling-service.js
│   │   │   └── data-visualization-service.js
│   │   │
│   │   ├── export/          # Report & Export Generation
│   │   │   ├── export-service.js
│   │   │   └── report-generator.js
│   │   │
│   │   ├── query/           # Query Processing
│   │   │   ├── query-cache.js
│   │   │   └── smart-query-handler.js
│   │   │
│   │   ├── recommendation/  # Recommendation Engine
│   │   │   └── recommendation-engine.js
│   │   │
│   │   └── [other services]
│   │
│   ├── routes/              # API Route Handlers
│   │   ├── index.js         # Route aggregator
│   │   ├── ai.js            # AI endpoints
│   │   ├── health.js        # Health check
│   │   ├── datasets.js      # Dataset CRUD
│   │   ├── chat.js          # Chat endpoints
│   │   ├── analytics.js     # Analytics endpoints
│   │   └── export.js        # Export endpoints
│   │
│   ├── middleware/          # Request Processing Pipeline
│   │   ├── error-handler.js
│   │   ├── cors.js
│   │   ├── request-logger.js
│   │   ├── logger.middleware.js
│   │   ├── validation.middleware.js
│   │   └── error.middleware.js
│   │
│   ├── utils/              # Shared Utilities
│   │   ├── response-utils.js
│   │   ├── helpers.js
│   │   ├── logger.js
│   │   └── schema-extractor.js
│   │
│   ├── genai/              # GenAI Services (TypeScript)
│   │   ├── analyticsEngine.ts
│   │   ├── dashboardBuilder.ts
│   │   └── reportGenerator.ts
│   │
│   ├── types/              # Type Definitions
│   │
│   └── index.js            # Application Entry Point
│
├── tests/                  # Test Suite
│   ├── unit/
│   └── integration/
│
├── .env                    # Environment configuration
├── .env.example            # Example env file
└── package.json            # Dependencies & scripts
```

## 🎯 Key Components

### 1. Configuration Layer (`src/config/`)

**Purpose**: Centralized configuration management

**Key Files**:
- `environment.js` - Loads and validates environment variables
- `constants.js` - Application-wide constants (HTTP status, error codes, etc.)
- `gemini-config.js` - Gemini-specific configuration

**Usage**:
```javascript
import config from './config/environment.js';

console.log(config.server.port); // 3001
console.log(config.ollama.baseUrl); // http://localhost:11434
```

### 2. Core Server (`src/core/`)

**Purpose**: HTTP server creation and lifecycle management

**Key Features**:
- Server creation and configuration
- Graceful shutdown handling
- Error handling middleware setup
- Route setup

**Usage**:
```javascript
import { createHttpServer, startServer } from './core/server.js';

const server = createHttpServer();
await startServer(server, 3001);
```

### 3. AI Services (`src/services/ai/`)

**Purpose**: AI provider abstraction and orchestration

**Architecture**:
```
ai/
├── ai-manager.js          # Master orchestrator
├── providers/             # Provider implementations
│   ├── ollama-provider.js # Local LLM (Llama 3.2, NeuralChat 7B)
│   ├── gemini-provider.js # Google Gemini
│   ├── openai-provider.js # OpenAI GPT-4
│   └── anthropic-provider.js # Anthropic Claude
└── utils/                 # Helper utilities
    ├── prompt-templates.js
    ├── response-parser.js
    └── token-counter.js
```

**Key Features**:
- **Automatic Provider Selection**: Chooses best available provider
- **Fallback Chain**: Ollama → Gemini → OpenAI → Anthropic
- **Health Monitoring**: Real-time provider status
- **Unified Interface**: Same API across all providers

**Usage**:
```javascript
import { aiManager } from './services/ai/ai-manager.js';

// Generate response
const response = await aiManager.generateResponse('Analyze this data...');

// Chat
const chatResponse = await aiManager.chat([
  { role: 'user', content: 'Hello!' }
]);

// Get health status
const health = await aiManager.health();
```

### 4. Analytics Services (`src/services/analytics/`)

**Purpose**: Data analysis and insights generation

**Key Services**:
- `analytics-service.js` - Statistical analysis
- `schema-detector.js` - Smart schema detection
- `predictive-analytics.js` - Forecasting and predictions
- `schema-ai-service.js` - AI-powered schema analysis

### 5. Data Services (`src/services/data/`)

**Purpose**: Data processing and transformation

**Key Services**:
- `data-merger.js` - Multi-dataset merging
- `data-sampling-service.js` - Data sampling strategies
- `data-visualization-service.js` - Visualization helpers

### 6. Export Services (`src/services/export/`)

**Purpose**: Report and export generation

**Key Services**:
- `export-service.js` - Export orchestration
- `report-generator.js` - PDF/Excel/Markdown report generation

### 7. Routes (`src/routes/`)

**Purpose**: API endpoint handlers

**Key Routes**:
- `ai.js` - `/api/ai/*` endpoints
- `health.js` - `/api/health` endpoint
- `datasets.js` - `/api/datasets/*` endpoints
- `chat.js` - `/api/datasets/:id/chat` endpoint
- `analytics.js` - `/api/datasets/:id/analyze` endpoint
- `export.js` - `/api/datasets/:id/export` endpoint

### 8. Middleware (`src/middleware/`)

**Purpose**: Request/response processing pipeline

**Key Middleware**:
- `error-handler.js` - Global error handling
- `cors.js` - CORS configuration
- `request-logger.js` - Request logging
- `validation.middleware.js` - Input validation

## 🔄 AI Provider Architecture

### Priority Order
1. **Ollama** (Primary) - Local inference, no API keys, privacy-focused
2. **Gemini** (Fallback 1) - Google's LLM, good performance
3. **OpenAI** (Fallback 2) - GPT-4, industry standard
4. **Anthropic** (Fallback 3) - Claude, excellent reasoning

### Fallback Flow
```
Request → Ollama
           ↓ (failed)
         Gemini
           ↓ (failed)
         OpenAI
           ↓ (failed)
         Anthropic
           ↓ (failed)
         Error: All providers failed
```

### Provider Interface
All providers implement the same interface:

```javascript
class AIProvider {
  async initialize() { /* ... */ }
  async generate(prompt, options) { /* ... */ }
  async chat(messages, options) { /* ... */ }
  async health() { /* ... */ }
  async isAvailable() { /* ... */ }
  getCapabilities() { /* ... */ }
}
```

## 📡 API Endpoints

### Health & Status
```
GET  /                           # Root endpoint
GET  /api/health                 # Health check
GET  /api/ai/status              # AI provider status
GET  /api/ai/models              # Available models
POST /api/ai/test                # Test AI generation
```

### Dataset Operations
```
POST /api/datasets/import         # Import dataset
GET  /api/datasets/:id            # Get dataset info
POST /api/datasets/:id/chat       # Chat with dataset
GET  /api/datasets/:id/analyze    # AI analysis
GET  /api/datasets/:id/schema     # Get schema
GET  /api/datasets/:id/auto-charts # Auto-generate charts
```

### Analytics
```
GET  /api/analytics/:id/correlations  # Find correlations
POST /api/analytics/:id/predict       # Predictive analysis
```

### Export
```
GET  /api/export/:id/pdf          # Export as PDF
GET  /api/export/:id/excel        # Export as Excel
GET  /api/export/:id/markdown     # Export as Markdown
```

## ⚙️ Configuration

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development
HOST=localhost

# Ollama (Primary - Local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.2
OLLAMA_CHAT_MODEL=neural-chat:7b
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_TOKENS=4096
OLLAMA_TEMPERATURE=0.7

# Google Gemini (Fallback 1)
GOOGLE_API_KEY=your_key_here

# OpenAI (Fallback 2)
OPENAI_API_KEY=your_key_here

# Anthropic (Fallback 3)
ANTHROPIC_API_KEY=your_key_here

# AI Settings
AI_PROVIDER_PRIORITY=ollama,gemini,openai,anthropic
ENABLE_AI_FALLBACK=true
LOCAL_AI_ONLY=false
AI_TIMEOUT_MS=120000
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.7

# Database
DATABASE_PATH=./data/insightflow.db
DATA_DIR=./data

# CORS
CORS_ORIGIN=*
CORS_CREDENTIALS=false

# Logging
LOG_LEVEL=info
VERBOSE_LOGGING=true

# Features
LOCAL_NLP_ENABLED=true
AUTO_CHART_GENERATION=true
CORRELATION_ANALYSIS=true
OUTLIER_DETECTION=true
CHAT_HISTORY_ENABLED=true
SMARTCHART_ENABLED=true
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd apps/backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Ollama (in separate terminal)
```bash
ollama serve
ollama pull llama3.2
ollama pull neural-chat:7b
```

### 4. Start Backend
```bash
npm run dev
```

### 5. Test
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/ai/status
```

## 📈 Benefits

| Aspect | Benefit |
|--------|---------|
| **Scalability** | Easy to add new providers or services |
| **Maintainability** | Clear file hierarchy, easy to find code |
| **Testability** | Modular structure enables unit testing |
| **Performance** | Better tree-shaking in production builds |
| **Debugging** | Clear stack traces and error context |
| **Onboarding** | New developers can understand structure quickly |
| **Flexibility** | Easy to swap implementations (e.g., AI providers) |
| **Encapsulation** | Services are self-contained |

## 🎓 Adding New Features

### Add a New AI Provider

1. Create `src/services/ai/providers/newprovider-provider.js`
2. Implement the provider interface
3. Add to `ai-manager.js` provider list
4. Update `.env` with config
5. Done! Automatic fallback support

### Add a New Service

1. Create in appropriate `src/services/` subdirectory
2. Follow existing patterns
3. Export as default or named export
4. Import in routes as needed

### Add a New Route

1. Create handler in `src/routes/`
2. Import in `src/routes/index.js`
3. Add to route setup function

## ✅ Status

- ✅ Configuration Layer: **COMPLETE**
- ✅ Core Server: **COMPLETE**
- ✅ AI Services: **COMPLETE**
- ✅ Routes: **COMPLETE**
- ✅ Middleware: **COMPLETE**
- ✅ Utilities: **COMPLETE**
- 🟡 Service Migration: **IN PROGRESS**

## 📝 Next Steps

1. Move remaining services to proper directories
2. Update import statements in moved files
3. Remove old/duplicate files
4. Add unit tests
5. Add integration tests
6. Set up CI/CD pipeline

## 📞 Support

If you encounter issues:

1. Check `MIGRATION_GUIDE.md` for detailed instructions
2. Verify your `.env` configuration
3. Check logs for specific error messages
4. Test individual components in isolation

---

**Last Updated**: 2026-05-09
**Version**: 2.0.0
**Status**: Production Ready (after migration completion)
