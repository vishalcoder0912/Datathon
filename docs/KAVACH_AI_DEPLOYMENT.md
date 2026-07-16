# KAVACH AI — Deployment Guide

**Version:** 1.0.0  
**Last Updated:** July 2026

---

## 1. Local Development Setup

### Prerequisites
- Node.js 18+ (tested with Node 18, 20, 22)
- npm 9+
- Git

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd repo

# Install all dependencies (workspaces)
npm install

# Generate demo data
npm run seed:kavach

# Start development servers
npm run dev
```

This starts three processes concurrently:
- **Backend:** http://localhost:3001 (Node.js HTTP server)
- **Frontend:** http://localhost:5173 (Vite dev server)
- **ML Service:** http://localhost:5000 (Python, optional)

### Individual Commands

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Build frontend for production
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
PORT=3001
HOST=localhost
NODE_ENV=development
DATA_DIR=./data

# KAVACH AI specific
KAVACH_DATA_DIR=./data/demo
KAVACH_AI_TITLE=KAVACH AI
KAVACH_PLATFORM_TITLE=Karnataka Crime Intelligence Command Centre
```

## 3. Build Instructions

```bash
# Production build
npm run build

# The built frontend is in apps/frontend/dist/
# Serve with the backend or any static file server
```

## 4. Docker

A Dockerfile is not included in the prototype. To containerize:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY data/ data/
RUN npm install
RUN npm run build
EXPOSE 3001
CMD ["node", "apps/backend/src/index.js"]
```

## 5. Production Considerations

| Consideration | Recommendation |
|---|---|
| **Database** | Replace in-memory CSV/JSON with PostgreSQL or TimescaleDB |
| **Authentication** | Add OAuth 2.0 with JWT tokens |
| **Authorization** | Implement RBAC (analyst, investigator, admin) |
| **AI Copilot** | Replace pattern-matching with LLM integration (Gemini/GPT) |
| **Real-time** | Add WebSocket or SSE for live alert updates |
| **Caching** | Add Redis for API response caching |
| **Scaling** | Use PM2 cluster mode or container orchestration |
| **Monitoring** | Add structured logging, metrics, and health checks |
| **HTTPS** | Configure TLS termination at reverse proxy |
| **Rate Limiting** | Add rate limiting middleware |
| **Data Persistence** | Replace in-memory storage with PostgreSQL |
| **Testing** | Add integration and E2E tests for all endpoints |

## 3. Build Instructions

```bash
# Production build
npm run build

# Output: apps/frontend/dist/
# Serve with the backend or any static file server
```

## 4. Docker

A Dockerfile is not included in the prototype. To containerize:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY data/ data/
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/apps/frontend/dist ./public
COPY --from=build /app/apps/backend ./backend
COPY --from=build /app/packages ./packages
COPY --from=build /app/data ./data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3001
CMD ["node", "apps/backend/src/index.js"]
```

## 5. Production Considerations

| Aspect | Prototype | Production |
|---|---|---|
| **Data Storage** | In-memory CSV/JSON | PostgreSQL / TimescaleDB |
| **Authentication** | None | OAuth 2.0 / SSO |
| **AI Copilot** | Pattern-matched | LLM (Gemini / GPT) |
| **Real-time** | Polling | WebSocket / SSE |
| **Deployment** | Single Node.js process | Clustered / Docker / K8s |
| **Monitoring** | Console logs | Prometheus + Grafana |
| **Testing** | Unit tests only | Unit + Integration + E2E |
| **CI/CD** | GitHub Actions | Full pipeline with staging |
| **Data Volume** | 1100 records | Millions of records |
| **Security** | Basic PII masking | Encryption, RBAC, audit logs |

## 6. Known Limitations When Deploying

- **Memory-bound**: All data loaded into RAM; large datasets will exceed available memory
- **No persistence**: Data reloads on every server restart
- **Single-threaded**: Node.js single event loop; CPU-intensive operations block the server
- **No authentication**: All endpoints are publicly accessible
- **No HTTPS**: Use a reverse proxy (nginx, Caddy) for TLS termination
- **Static data**: No live data ingestion pipeline
- **No caching**: Every request recomputes scores and detections
- **No database migrations**: Schema changes require code changes
