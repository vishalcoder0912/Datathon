# 📊 INSIGHTFLOW FOLDER STRUCTURE

## Overview
This document describes the optimized folder structure for InsightFlow AI Data Analytics platform, designed for rapid MVP launch (2-3 weeks) with production-ready error handling.

---

## 📁 Complete Folder Structure

```
insightflow/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/                    # App entry points
│   │   │   │   ├── App.tsx
│   │   │   │   ├── AppRouter.tsx       # Routes
│   │   │   │   ├── providers/          # Context + Zustand
│   │   │   │   └── routes/             # Page components
│   │   │   │
│   │   │   ├── features/               # Domain features
│   │   │   │   ├── dashboard/          # Dashboard pages & components
│   │   │   │   ├── upload/             # File upload
│   │   │   │   ├── analytics/          # Analytics pages
│   │   │   │   ├── chat/               # AI chat interface
│   │   │   │   └── data-table/         # Data table views
│   │   │   │
│   │   │   ├── shared/                 # Shared code
│   │   │   │   ├── components/         # UI components
│   │   │   │   ├── hooks/              # Custom hooks
│   │   │   │   ├── utils/              # Utilities
│   │   │   │   └── layout/             # Layout components
│   │   │   │
│   │   │   └── services/               # API client
│   │   │
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── backend/
│       ├── src/
│       │   ├── config/                 # ⭐ Configuration
│       │   │   ├── env.js              # Environment variables
│       │   │   └── gemini.config.js    # AI configuration
│       │   │
│       │   ├── middleware/             # ⭐ Error Handling
│       │   │   ├── error.middleware.js # Global error handling
│       │   │   ├── validation.middleware.js
│       │   │   └── logger.middleware.js
│       │   │
│       │   ├── utils/                  # ⭐ Utilities
│       │   │   ├── helpers.js          # Common helpers
│       │   │   └── validators.js
│       │   │
│       │   ├── database/               # Data layer
│       │   │   ├── connection.js
│       │   │   └── dataset-repository.js
│       │   │
│       │   ├── services/               # ⭐ Core Logic
│       │   │   ├── schema-packet-builder.js  # Schema extraction
│       │   │   ├── gemini-ai-service.js      # AI calls
│       │   │   ├── analytics-service.js      # Analytics
│       │   │   ├── local-database-service.js # Local DB
│       │   │   └── schema-ai-service.js      # Schema AI
│       │   │
│       │   ├── routes/                 # ⭐ API Routes
│       │   │   ├── dataset.routes.js
│       │   │   ├── chat.routes.js
│       │   │   ├── analytics.routes.js
│       │   │   └── health.routes.js
│       │   │
│       │   └── server.js               # Entry point
│       │
│       └── package.json
│
├── packages/
│   ├── shared-analytics/               # Shared analytics code
│   │   └── src/
│   │
│   └── shared-errors/                  # ⭐ Centralized errors
│       └── index.js
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── ERROR-HANDLING.md
│
├── .env.example
├── .env                                # GEMINI_API_KEY here
├── package.json
└── README.md
```

---

## 📂 Key Folders Explained

### `apps/backend/src/config/`
Configuration files for the backend.
- `env.js` - Environment variable handling
- `gemini.config.js` - Gemini AI configuration

### `apps/backend/src/middleware/` ⭐
**Centralized error handling:**
- `error.middleware.js` - Error classes and global handler
- `validation.middleware.js` - Input validation
- `logger.middleware.js` - Request/response logging

### `apps/backend/src/services/` ⭐
Core business logic:
- `schema-packet-builder.js` - Extracts schema from datasets
- `gemini-ai-service.js` - AI-powered analysis
- `analytics-service.js` - Analytics and correlation

### `apps/backend/src/routes/` ⭐
API endpoints:
- `dataset.routes.js` - Dataset CRUD
- `chat.routes.js` - AI chat
- `analytics.routes.js` - Analytics endpoints
- `health.routes.js` - Health checks

### `packages/shared-errors/` ⭐
Centralized error classes used across the app.

---

## 🛠️ File Dependencies (Build Order)

```
1. packages/shared-errors/     (Used by everything)
2. apps/backend/src/config/    (Configuration)
3. apps/backend/src/middleware/ (Error handling)
4. apps/backend/src/utils/     (Helpers)
5. apps/backend/src/services/  (Core logic)
6. apps/backend/src/routes/    (API routes)
7. apps/backend/src/server.js  (Entry point)
```

---

## 🔧 Setting Up

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# Run development
npm run dev:all

# Build for production
npm run build
```

---

## 📝 API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/datasets/current` | Get current dataset |
| POST | `/api/datasets/demo` | Load demo dataset |
| POST | `/api/datasets/import` | Import dataset |
| GET | `/api/datasets/:id/schema` | Get dataset schema |
| POST | `/api/datasets/:id/chat` | Send chat message |
| GET | `/api/datasets/:id/ai-correlations` | Get correlations |

---

## ✅ What's Implemented

| Feature | Status | Location |
|---------|--------|----------|
| Schema extraction | ✅ | `services/schema-packet-builder.js` |
| Gemini AI integration | ✅ | `services/gemini-ai-service.js` |
| Error handling | ✅ | `middleware/error.middleware.js` |
| Input validation | ✅ | `middleware/validation.middleware.js` |
| Request logging | ✅ | `middleware/logger.middleware.js` |
| API routes | ✅ | `routes/*.routes.js` |
| Centralized errors | ✅ | `packages/shared-errors/` |

---

## 🚀 Launch Timeline

| Week | Focus |
|------|-------|
| Week 1 | Setup routes, services, error handling |
| Week 2 | Frontend integration, testing |
| Week 3 | Polish, deployment |

---

*Last Updated: April 2026*
*Version: 2.0*