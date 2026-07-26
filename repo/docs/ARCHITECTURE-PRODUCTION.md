# InsightFlow — Production Architecture

## System Context

InsightFlow is a multi-tenant AI data analytics platform. Users upload datasets (CSV, Excel, PDF), run natural-language analytics, generate dashboards, and get AI-powered intelligence. The system serves law-enforcement KAVACH modules alongside general InsightFlow analytics from a single backend.

```
                    ┌──────────────────────────────────────────────────┐
                    │                   Users                          │
                    │      Browser · Mobile · API Clients              │
                    └────────┬─────────┬──────────┬───────────────────┘
                             │         │          │
                    ┌────────▼─────────▼──────────▼───────────────────┐
                    │                 CDN (CloudFront / Cloudflare)    │
                    │         Static assets · Edge caching            │
                    └────────────────────┬────────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────────────┐
                    │              API Gateway                        │
                    │   Rate limit · Auth · WAF · Request validation  │
                    │   TLS termination · IP allowlist                │
                    └────┬───────────┬──────────┬─────────────────────┘
                         │           │          │
              ┌──────────▼──┐  ┌─────▼──────┐  └──────────┐
              │  Frontend   │  │  Backend   │             │
              │  React SPA  │  │  Hono API  │             │
              │  shadcn/ui  │  │  + Zod     │             │
              └─────────────┘  └─────┬──────┘             │
                                     │                    │
              ┌──────────────────────▼─────────────────────▼──────┐
              │                   Service Mesh                     │
              │            mTLS · Retry · Circuit breaker          │
              └────┬────────────┬───────────┬──────────┬──────────┘
                   │            │           │          │
          ┌────────▼──┐  ┌─────▼──────┐  ┌─▼───────┐  ┌▼──────────┐
          │ PostgreSQL│  │   Redis    │  │  Qdrant  │  │  FastAPI  │
          │ + PostGIS │  │ Cache/Queue│  │ pgvector │  │  ML Service│
          │ + pgvector│  │            │  │ (opt.)   │  │           │
          └───────────┘  └────────────┘  └──────────┘  └───────────┘
```

## Architecture Decisions

### 1. API Gateway — Hono

**Decision**: Replace native `http.createServer` with Hono (6 kB, Zod-native).

**Reasoning**:
- The current 33-route manual router is fragile — each new route requires hand-written URL matching, body parsing, and error handling
- Hono gives us typed middleware chains, built-in Zod validation, streaming responses, and CORS management
- 17x faster than Express on req/s, zero dependencies
- Bun-compatible if we migrate runtimes later

```mermaid
graph LR
    subgraph Current
        A[HTTP Request] --> B[createServer]
        B --> C[manual path matching]
        C --> D[if/else chain]
        D --> E[33 route files]
        E --> F[manual error handler]
    end
    
    subgraph Proposed
        G[HTTP Request] --> H[Hono Router]
        H --> I[Zod Validation]
        I --> J[Middleware Chain]
        J --> K[8 resource modules]
        K --> L[Central error handler]
    end
```

### 2. Authentication — JWT + OAuth2 Bridge

**Decision**: Keep current JWT (jose + bcryptjs) for first-party auth; add OAuth2 Proxy for third-party SSO.

**Reasoning**:
- 17 AI providers means 17 potential API keys in env — these should never touch the frontend
- OAuth2 Proxy (oauth2-proxy/cloudflare-access) sits in front of the gateway, injects `X-Forwarded-User` header
- JWT is service-to-service: backend signs short-lived tokens (15 min), refresh tokens (7 days) stored in httpOnly cookies
- Role-based access: `STATE_ADMIN`, `DATA_ENGINEER`, `AUDITOR`, `ANALYST`

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gateway
    participant O as OAuth2 Proxy
    participant A as Auth Service
    participant DB as PostgreSQL
    
    B->>O: GET /dashboard
    O->>O: Check session cookie
    alt No session
        O->>B: Redirect to IdP
        B->>IdP: Login
        IdP->>O: Callback with code
        O->>O: Exchange for JWT
    end
    O->>B: Set session cookie
    B->>G: Request + session cookie
    G->>A: Validate JWT
    A->>DB: Fetch roles
    A-->>G: {user, roles}
    G->>G: Enforce RBAC
    G->>Backend: Proxy with X-Forwarded-User
```

### 3. AI Inference — Unified Provider Gateway

**Decision**: Abstract all 17 AI providers behind a single Hono route with Zod schema, streaming, and queue-backed execution.

**Reasoning**:
- Current ai-router.js does provider selection, response scoring, fallback cascading, and payload sanitization inline — this is correct but blocks the request thread
- Every AI call goes through: validate → enqueue (BullMQ) → route to provider → stream response → score → return
- Streaming via SSE: `/api/ai/chat?stream=true` returns `text/event-stream`, frontend reads with `EventSource`
- Provider priority: `GEMINI → ANTHROPIC → OPENAI → OLLAMA → local NLP` (configurable)

```mermaid
flowchart TD
    A[User Query] --> B{Has API key?}
    B -->|Yes| C[Cloud Provider]
    B -->|No| D[Local Ollama]
    
    C --> E[Provider Selector]
    E --> F{Provider mode}
    F -->|hybrid_best| G[Race Gemini + Ollama]
    F -->|cloud_only| H[Gemini / OpenAI]
    F -->|local_only| I[Ollama only]
    
    G --> J[Score responses]
    J --> K[Pick highest score]
    
    H --> L[Stream response]
    I --> L
    K --> L
    
    L --> M[Guardian check]
    M -->|Pass| N[Return to client]
    M -->|Fail| O[Reject + log]
    
    D --> P{Ollama available?}
    P -->|Yes| Q[Run local model]
    P -->|No| R[Return offline message]
    Q --> L
```

### 4. Vector Database — pgvector

**Decision**: Use pgvector on PostgreSQL instead of a separate Qdrant cluster.

**Reasoning**:
- Current setup already has PostgreSQL + PostGIS — adding pgvector is `CREATE EXTENSION vector;` — no new infrastructure
- Qdrant is optional and currently defaults to disabled with JSON fallback, meaning vector search is not reliable in production today
- pgvector gives us: ACID-compliant vectors, same backup/restore as the rest of data, no network hop, PostGIS + vector in one query for geo-similarity
- HNSW index for approximate nearest neighbor search at <50 ms recall at 100k vectors
- Separate Qdrant cluster only justified at >1M vectors — unnecessary at current scale

```mermaid
erDiagram
    DATASET {
        uuid id PK
        text name
        text source_type
        timestamp created_at
    }
    
    SCHEMA_MEMORY {
        uuid id PK
        uuid dataset_id FK
        vector embedding 1536
        text field_name
        text field_type
    }
    
    PDF_CHUNK {
        uuid id PK
        uuid dataset_id FK
        vector embedding 1536
        text content
        int chunk_index
        text page_ref
    }
    
    DATASET ||--o{ SCHEMA_MEMORY : has
    DATASET ||--o{ PDF_CHUNK : has
```

### 5. Embedding Pipeline

**Decision**: Async document processing pipeline with BullMQ.

**Reasoning**:
- PDF upload → chunk → embed → store should never block the upload response
- BullMQ + Redis gives retry with exponential backoff, dead-letter queue for failed embeddings, progress tracking
- Embedding model: `nomic-embed-text` via Ollama (local) or `text-embedding-3-small` via OpenAI (cloud)
- Chunking strategy: recursive character split, 512 tokens with 128 token overlap

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant Q as Redis/BullMQ
    participant W as Worker
    participant E as Embedding Service
    participant V as pgvector
    
    C->>G: POST /api/datasets/import (CSV)
    G->>G: Validate + store rows
    G->>Q: Enqueue schema_embedding job
    G-->>C: 202 Accepted {jobId}
    
    C->>G: GET /api/jobs/:jobId/status
    G-->>C: {status: "pending"}
    
    Q->>W: Dequeue job
    W->>W: Build schema packet
    W->>E: embed(schema_packet)
    E-->>W: vector[1536]
    W->>V: INSERT INTO schema_memory
    V-->>W: OK
    W->>Q: Mark job complete
    
    C->>G: GET /api/jobs/:jobId/status
    G-->>C: {status: "completed"}
```

### 6. Model Serving

**Decision**: Two-tier model serving — cloud APIs for latency-sensitive, local Ollama/vLLM for offline/air-gapped.

**Reasoning**:
- Cloud (Gemini, OpenAI, Anthropic): zero GPU cost, best accuracy, pay-per-token, <2 s TTFT
- Local (Ollama): air-gapped KAVACH deployments, no data leaves premises, runs on CPU/GPU
- Fine-tuned models: served via vLLM with LoRA adapters, OpenAI-compatible API endpoint
- Model routing uses task-type mapping from current model-router.js but adds circuit-breaker pattern

```mermaid
graph TD
    subgraph Cloud Tier
        G1[Gemini 1.5 Pro]
        G2[OpenAI GPT-4o]
        G3[Anthropic Claude]
    end
    
    subgraph Local Tier
        L1[Ollama qwen3:8b]
        L2[vLLM fine-tuned]
        L3[Ollama nomic-embed]
    end
    
    subgraph Router Logic
        R{Task type?}
        R -->|Dashboard planning| G1
        R -->|Chat| G2
        R -->|Security review| G3
        R -->|JSON validation| L1
        R -->|Embedding| L3
        R -->|Fine-tuned inference| L2
    end
    
    subgraph Circuit Breaker
        C1[Track errors per provider]
        C2[Open circuit at 50% errors]
        C3[Fallback to next tier]
        C4[Half-open after 30s]
    end
    
    Router --> C1 --> C2 --> C3 --> C4
```

### 7. Cache — Redis

**Decision**: Redis for three distinct concerns: BullMQ queue, response cache, session store.

**Reasoning**:
- AI responses are deterministic for identical schema+query pairs — cache TTL 5 min saves 40-60% of AI costs
- BullMQ needs Redis for job persistence
- Session store moves from memory to Redis — survives restarts, scales across pods
- Redis Stack includes RedisJSON and RediSearch for structured caching

```mermaid
flowchart LR
    subgraph Redis Use Cases
        A[BullMQ Queue] --> B[AI job queue]
        A --> C[Embedding queue]
        A --> D[PDF processing queue]
        
        E[Cache Layer] --> F[AI response cache]
        E --> G[Schema query cache]
        E --> H[Rate limit counters]
        
        I[Session Store] --> J[Auth sessions]
        I --> K[Rate limit state]
        I --> L[Job status]
    end
    
    M[Redis Sentinel] --> N[Primary]
    M --> O[Replica]
    M --> P[Replica]
```

### 8. Database — PostgreSQL 16 + PostGIS + pgvector

**Decision**: Single PostgreSQL instance with extensions.

**Reasoning**:
- Already using `postgis/postgis:16-3.4` — add `pgvector` via `CREATE EXTENSION vector`
- Connection pooling via PgBouncer (sidecar) — handles burst traffic without overwhelming PG
- Read replicas for analytics queries — dashboard queries go to replica, writes go to primary
- Partitioning: `datasets` partitioned by `created_at` month, `schema_memory` by `dataset_id` hash

```mermaid
graph TD
    subgraph PostgreSQL Cluster
        P[Primary - writes]
        R1[Replica - reads]
        R2[Replica - analytics]
        
        P -->|Streaming replication| R1
        P -->|Streaming replication| R2
    end
    
    subgraph Connection Pooling
        B[PgBouncer primary]
        B2[PgBouncer replica]
    end
    
    subgraph Extensions
        E1[PostGIS 3.4]
        E2[pgvector 0.7]
        E3[pg_stat_statements]
    end
    
    API[API Service] -->|Write| B
    API -->|Read| B2
    B --> P
    B2 --> R1
    B2 --> R2
    
    P --> E1
    P --> E2
    R1 --> E1
    R1 --> E2
```

### 9. Monitoring — Prometheus + OpenTelemetry

**Decision**: OpenTelemetry for traces + Prometheus for metrics + Grafana for dashboards.

**Reasoning**:
- AI calls are the most expensive and failure-prone path — need per-provider latency histograms, error rates, token consumption
- OpenTelemetry auto-instruments Hono routes, pg queries, BullMQ jobs, AI provider HTTP calls
- RED metrics: Rate (requests/s), Errors (%), Duration (p50/p95/p99)
- USE metrics for infrastructure: Utilization, Saturation, Errors for CPU, memory, connections

```mermaid
flowchart LR
    subgraph Application
        A[Hono API]
        B[BullMQ Worker]
        C[Python ML]
    end
    
    subgraph Observability
        A -->|OTel SDK| O[OpenTelemetry Collector]
        B -->|OTel SDK| O
        C -->|OTel SDK| O
        
        O --> M[Prometheus]
        O --> T[Tempo - traces]
        O --> L[Loki - logs]
        
        M --> G[Grafana]
        T --> G
        L --> G
    end
    
    subgraph Alerts
        G -->|Alert| N[Alertmanager]
        N -->|Pager| P[PagerDuty]
        N -->|Slack| S[Slack]
    end
```

### 10. Logging — Structured JSON

**Decision**: All services emit newline-delimited JSON to stdout; Loki collects; Grafana dashboards.

**Reasoning**:
- Current backend uses `console.log` with emoji prefixes — unparseable in production
- Structured JSON: `{"level":"info","service":"backend","requestId":"...","duration":42,"provider":"gemini","tokens":1500}`
- Correlation ID (`X-Request-Id`) threads through API Gateway → backend → AI provider → database
- AI audit log (separate PostgreSQL table): every prompt + response + provider used + tokens consumed + latency

### 11. CI/CD — GitHub Actions

**Decision**: Monorepo pipeline with dependency caching, parallel test matrix, and selective deployment.

**Reasoning**:
- npm workspaces monorepo — change in `packages/shared-analytics` should not rebuild `apps/ml-service`
- Turborepo remote caching for build artifacts
- Test matrix: frontend tests (Vitest), backend tests (Vitest), Python tests (pytest), E2E (Playwright)
- Docker images built only on main branch merge
- Zoho Catalyst deploy via Catalyst CLI in final stage

```mermaid
graph LR
    subgraph CI Pipeline
        A[Push / PR] --> B[Install deps]
        B --> C[Lint]
        C --> D[TypeScript check]
        D --> E{Test Matrix}
        E --> F[Frontend tests]
        E --> G[Backend tests]
        E --> H[Python tests]
        E --> I[E2E tests]
    end
    
    subgraph CD Pipeline
        F --> J{Branch?}
        G --> J
        H --> J
        I --> J
        J -->|main| K[Build Docker images]
        J -->|main| L[Push to registry]
        J -->|PR| M[Preview deploy]
        K --> N[Deploy to Catalyst]
        L --> N
        N --> O[Smoke tests]
        O -->|Pass| P[Production]
        O -->|Fail| Q[Rollback]
    end
```

### 12. Docker — Multi-stage builds

```dockerfile
# Frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json ./
RUN npm ci
COPY . .
RUN npm run build

# Backend
FROM node:22-alpine AS backend-build
WORKDIR /app
COPY package.json ./
RUN npm ci --production
COPY . .

# ML Service
FROM python:3.12-slim AS ml-build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Production image
FROM node:22-alpine
RUN apk add --no-cache curl
COPY --from=frontend-build /app/apps/frontend/dist /app/public
COPY --from=backend-build /app/apps/backend /app/backend
COPY --from=ml-build /app/apps/ml-service /app/ml-service
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3001/api/health || exit 1
CMD ["node", "/app/backend/src/index.js"]
```

### 13. Kubernetes / Zoho Catalyst

**Decision**: Design for Catalyst's container platform (Catalyst AppSail) but keep manifests K8s-compatible.

**Reasoning**:
- Catalyst AppSail runs containers — standard Docker images deploy with zero modification
- Catalyst does not provide native K8s API — use Catalyst YAML for deployment, not Helm
- Resource requests/limits, health checks, and environment variables map 1:1
- For non-Catalyst deployments: same Docker images deploy to any K8s cluster

```yaml
# catalyst-appsail.yaml
services:
  - name: insightflow-api
    image: insightflow/api:latest
    port: 3001
    cpu: 1
    memory: 2Gi
    min_instances: 2
    max_instances: 10
    health_check:
      path: /api/health
      interval: 30s
    env:
      - REDIS_URL: redis://redis-service:6379
      - DATABASE_URL: postgresql://...
```

```mermaid
graph TD
    subgraph Zoho Catalyst
        LB[Catalyst Load Balancer] --> A1[API - Pod 1]
        LB --> A2[API - Pod 2]
        LB --> A3[API - Pod N]
        
        A1 --> R[(Redis)]
        A2 --> R
        A3 --> R
        
        A1 --> P[(PostgreSQL)]
        A2 --> P
        A3 --> P
        
        subgraph Autoscaling
            HPA[HPA cpu > 70%] -->|Scale up| A3
            HPA -->|Scale down| A1
        end
    end
    
    subgraph External
        AI[Gemini API]
        OLL[Ollama - on-prem]
    end
    
    A1 --> AI
    A1 --> OLL
```

### 14. Security

| Layer | Control | Implementation |
|---|---|---|
| **Network** | WAF + DDoS | Cloudflare / Catalyst WAF |
| **Transport** | TLS 1.3 | Auto-terminated at gateway |
| **Auth** | JWT + OAuth2 Proxy | jose + oauth2-proxy |
| **API** | Rate limiting | Redis sliding window: 10 rpm/user |
| **Input** | Zod validation | All endpoints validated |
| **AI** | Prompt guard | Payload sanitizer: no raw rows |
| **Secrets** | Vault / env | Never in code, mounted as env |
| **DB** | Encrypted at rest | RDS/Kubernetes secret encryption |
| **Audit** | AI audit log | Every prompt+response stored |
| **CORS** | Origin allowlist | Per-environment strict origins |

```mermaid
flowchart TD
    subgraph Defense Layers
        L1[WAF - DDoS protection]
        L2[TLS 1.3]
        L3[Rate limiter - Redis]
        L4[Auth - JWT validation]
        L5[RBAC - role check]
        L6[Input validation - Zod]
        L7[AI payload sanitizer]
        L8[Output encoding]
    end
    
    I[Internet] --> L1 --> L2 --> L3
    L3 --> L4 --> L5
    L5 --> L6 --> L7 --> L8
    L8 --> APP[Application]
```

### 15. Scaling

| Dimension | Strategy | Trigger |
|---|---|---|
| **API pods** | Horizontal autoscaling | CPU > 70%, memory > 80% |
| **AI queue workers** | Separate worker pool | Queue depth > 100 |
| **Database** | Read replicas | Connection pool > 80% |
| **Vector search** | HNSW index parameters | Recall < 95% at 100k+ vectors |
| **Static assets** | CDN caching | Cache hit rate < 90% |
| **Sessions** | Redis cluster | Memory > 75% |

```mermaid
graph LR
    subgraph Normal Load
        G[Gateway] --> A1[Pod 1]
        G --> A2[Pod 2]
    end
    
    subgraph Peak Load
        G --> A1
        G --> A2
        G --> A3
        G --> A4
        G --> A5
    end
    
    subgraph Queue Scaling
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
    end
    
    A1 --> Q[(BullMQ)]
    A2 --> Q
    A3 --> Q
    A4 --> Q
    A5 --> Q
    Q --> W1
    Q --> W2
    Q --> W3
```

### 16. Backup & Disaster Recovery

**Decision**: PostgreSQL pg_dump + WAL archiving + cross-region recovery.

**Reasoning**:
- PostgreSQL is the single source of truth — losing it loses datasets, schema memory, user data
- pg_dump nightly → compressed → S3-compatible storage (Catalyst Filestore)
- WAL archiving every 5 min → point-in-time recovery to any second
- Redis is ephemeral — RDB snapshots every hour for warm-start after crash

```mermaid
timeline
    title Recovery Point Objectives
    RPO-0 : WAL archive : 5 min
    RPO-1 : pg_dump : 24 hours
    RPO-2 : Redis RDB : 1 hour
    RPO-3 : Docker images : per release
```

| Scenario | RTO | RPO | Recovery Action |
|---|---|---|---|
| Pod crash | <10 s | 0 | K8s/Catalyst restart |
| AZ outage | <5 min | 5 min | Promote replica in secondary AZ |
| DB corruption | <30 min | 24 h | Restore last pg_dump + WAL replay |
| Full region failure | <2 h | 24 h | Cross-region restore from S3 backup |
| Accidental data deletion | <1 h | 5 min | PITR to timestamp before deletion |
| Secrets compromise | <15 min | 0 | Rotate all keys, restart pods |

### 17. Resource Budgets

| Service | CPU | Memory | Storage | Instances (min/max) |
|---|---|---|---|---|
| API Gateway (Hono) | 1 core | 1 GB | — | 2 / 10 |
| BullMQ Worker | 1 core | 2 GB | — | 1 / 5 |
| PostgreSQL | 4 cores | 8 GB | 100 GB SSD | 1 primary + 2 replicas |
| Redis | 2 cores | 4 GB | 20 GB | 1 primary + 2 replicas |
| ML Service (FastAPI) | 2 cores | 4 GB | — | 1 / 3 |
| Qdrant (optional) | 2 cores | 4 GB | 50 GB SSD | 1 / 2 |

Monthly cost estimate (Zoho Catalyst / equivalent cloud): **$200-400/mo** at low load, **$800-1500/mo** at production scale with 17 AI provider API costs separate.

### 18. Deployment Architecture Diagram — Full System

```mermaid
graph TB
    subgraph "Edge"
        CDN[Cloudflare CDN]
        WAF[Web Application Firewall]
    end
    
    subgraph "Zoho Catalyst / Kubernetes"
        subgraph "Gateway Layer"
            LB[Load Balancer]
            RT[Rate Limiter]
            OA[OAuth2 Proxy]
        end
        
        subgraph "Application Layer"
            API1[Hono API - Pod 1]
            API2[Hono API - Pod 2]
            API3[Hono API - Pod N]
        end
        
        subgraph "Background Workers"
            W1[BullMQ Worker - AI]
            W2[BullMQ Worker - Embeddings]
            W3[BullMQ Worker - PDF]
        end
        
        subgraph "ML Layer"
            ML[FastAPI ML Service]
        end
        
        subgraph "Data Layer"
            PG[(PostgreSQL + PostGIS + pgvector)]
            PG_R[(PostgreSQL Read Replica)]
            RD[(Redis Cluster)]
        end
        
        subgraph "Observability"
            PR[Prometheus]
            GR[Grafana]
            LO[Loki]
            OT[OpenTelemetry Collector]
        end
    end
    
    subgraph "AI Providers"
        GM[Gemini API]
        OP[OpenAI API]
        AN[Anthropic API]
        OL[Ollama - On Premise / Air-Gapped]
    end
    
    subgraph "Storage"
        S3[Object Storage - Backups]
        REG[Container Registry]
    end
    
    USER[Browser] --> CDN --> WAF --> LB
    LB --> RT --> OA
    OA --> API1
    OA --> API2
    OA --> API3
    
    API1 --> PG
    API1 --> RD
    API1 --> ML
    API1 --> GM
    API1 --> OP
    API1 --> AN
    API1 --> OL
    
    API1 --> W1
    API1 --> W2
    API1 --> W3
    
    W1 --> GM
    W1 --> OP
    W1 --> AN
    W1 --> OL
    W1 --> PG
    W1 --> RD
    
    W2 --> PG
    W2 --> OL
    
    PG --> PG_R
    API1 --> PG_R
    
    API1 --> OT --> PR
    API1 --> OT --> LO
    PR --> GR
    LO --> GR
    
    PG --> S3
    REG --> API1
```

## Migration Path

```
Week 1     Week 2     Week 3     Week 4     Week 5
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ Hono     │ BullMQ   │ pgvector │ Redis    │ Monitoring│
│ framework│ queue    │ migration│ cache    │ & logging │
│ Zod      │ workers  │          │ sessions │          │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ 33 → 8   │ Async AI │ Vector   │ AI resp. │ OTel +   │
│ route    │ calls    │ search   │ cache    │ Grafana  │
│ modules  │          │          │          │ dashboards│
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

Each week is deployable independently. No big-bang migration.

## Key Metrics to Track

| Metric | Target | Why |
|---|---|---|
| AI p95 latency | <5 s | Users wait for AI responses |
| AI success rate | >99% | Provider fallbacks must work |
| Vector search p95 | <100 ms | Dashboard queries read vectors |
| API error rate | <0.1% | Production SLA |
| Cache hit rate | >40% | Reduces AI costs |
| DB connection pool | <80% utilization | Prevents connection exhaustion |
| Queue backlog | <100 jobs | AI workers must keep up |
| p99 response time | <500 ms (non-AI) | General API responsiveness |
