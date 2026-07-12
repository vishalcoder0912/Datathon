# KAVACH AI — Architecture Document

**Version:** 1.0.0  
**Last Updated:** July 2026

---

## 1. Overall System Architecture

KAVACH AI is a monorepo with three main packages:

```
kavach-ai/
├── apps/
│   ├── frontend/          # React 18 + TypeScript + Vite SPA
│   └── backend/           # Node.js custom HTTP server
├── packages/
│   ├── kavach-domain/     # Shared domain logic (enums, schemas, utils)
│   └── shared-analytics/  # Shared analytics utilities
├── data/demo/             # Synthetic Karnataka crime dataset
├── scripts/               # Seed and utility scripts
└── docs/                  # Documentation
```

## 2. Frontend Architecture

**Stack:** React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Recharts + Radix UI

```
apps/frontend/src/
├── kavach/
│   ├── api/kavachApi.ts          # Axios API client
│   ├── components/GlobalFilters.tsx  # Shared filter bar
│   ├── context/FilterContext.tsx  # Global filter state
│   └── pages/
│       ├── DashboardPage.tsx         # Command dashboard
│       ├── GeoIntelligencePage.tsx    # Map-based geo view
│       ├── TrendIntelligencePage.tsx  # Trends and patterns
│       ├── NetworkIntelligencePage.tsx # Graph visualization
│       ├── OffendersPage.tsx         # Offender list
│       ├── OffenderDetailPage.tsx    # Offender profile
│       ├── RiskIntelligencePage.tsx   # Risk scoring
│       ├── SocialIntelligencePage.tsx # Socioeconomic correlations
│       ├── AICopilotPage.tsx         # AI Copilot chat
│       ├── AlertsPage.tsx            # Alert management
│       ├── ReportsPage.tsx           # Report generation
│       └── DataManagementPage.tsx    # Data reload
├── components/
│   └── GlobalFilters.tsx             # Shared filter bar
├── context/
│   └── FilterContext.tsx             # Global filter state
└── api/
    └── kavachApi.ts                 # Axios API client
```

## 2. Backend Architecture

**Stack:** Node.js custom HTTP server + SQLite (via node:sqlite) + in-memory data

```
apps/backend/src/
├── index.js                    # Entry point
├── server.js                   # HTTP server creation
├── core/server.js              # Server bootstrap
├── routes/
│   ├── index.js                # Route aggregator
│   └── kavach.js               # KAVACH AI route handler (40+ endpoints)
├── kavach/
│   ├── kavach-repository.js    # Data access layer (CSV/JSON loading, filtering, PII masking)
│   └── kavach-services.js      # Business logic (scoring, detection, analysis)
├── utils/response-utils.js     # Response envelope helpers
├── config/constants.js          # HTTP status, error codes, enums
└── middleware/                  # Request logging, CORS
```

## 3. Data Flow Diagram

```
┌─────────────┐     HTTP      ┌───────────────────┐     Axios      ┌──────────────┐
│   Browser   │ ◄──────────► │  Node.js Server   │ ◄────────────► │  React SPA   │
│  (Vite Dev) │   5173/3001   │  (Port 3001)      │    /api/*      │  (Port 5173)  │
└─────────────┘               └────────┬──────────┘                └──────────────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                   │ kavach-  │ │ kavach-  │ │ @kavach/ │
                   │ routes   │ │ services │ │ domain   │
                   └──────────┘ └────┬─────┘ └──────────┘
                                      │
                            ┌─────────┴─────────┐
                            ▼                   ▼
                     ┌────────────┐     ┌──────────────┐
                     │ kavach-   │     │ data/demo/   │
                     │ repository │────►│ *.csv, *.json │
                     └────────────┘     └──────────────┘
```

## 5. Route Structure

| Frontend Route | Page Component | API Endpoint |
|---|---|---|
| `/dashboard` | DashboardPage | `/api/kavach/overview` |
| `/geo-intelligence` | GeoIntelligencePage | `/api/kavach/hotspots`, `/api/kavach/districts` |
| `/trend-intelligence` | TrendIntelligencePage | `/api/kavach/trends/*` |
| `/network-intelligence` | NetworkIntelligencePage | `/api/kavach/network/*` |
| `/offenders` | OffendersPage | `/api/kavach/offenders` |
| `/offenders/:id` | OffenderDetailPage | `/api/kavach/offenders/:id` |
| `/risk-intelligence` | RiskIntelligencePage | `/api/kavach/risk/*` |
| `/social-intelligence` | SocialIntelligencePage | `/api/kavach/correlations/*` |
| `/ai-copilot` | AICopilotPage | `/api/kavach/copilot/*` |
| `/alerts` | AlertsPage | `/api/kavach/alerts` |
| `/reports` | ReportsPage | `/api/kavach/reports` |
| `/data-management` | DataManagementPage | `/api/kavach/data/*` |

## 6. Key Design Decisions

| Decision | Rationale |
|---|---|
| **Monorepo with npm workspaces** | Shared domain types between frontend and backend without publishing |
| **Custom HTTP server (no Express)** | Lighter weight, full control over request pipeline |
| **In-memory data with CSV/JSON loading** | Fast prototyping, no database setup required |
| **PII masking at repository layer** | Single point of control, prevents accidental exposure |
| **Zod schemas in shared package** | Runtime validation shared between frontend and backend |
| **Pattern-matched AI Copilot** | Demonstrates the concept without requiring LLM API keys |
| **Recharts for visualization** | Familiar React charting library with good TypeScript support |
| **Global filter context** | Consistent date/district/crime-type filtering across all views |

## 7. Security Considerations

- **PII Masking**: All person names, phone numbers, vehicle registrations, and addresses are masked at the repository layer using `PIIMask()` before being returned to the API
- **No secrets in code**: API keys are loaded from environment variables only
- **CORS**: Configured per environment; production should restrict origins
- **No SQL injection**: SQLite is read-only for demo data; no user queries are interpolated
- **Input validation**: Zod schemas validate all incoming data shapes

## 8. Prototype vs Production

| Aspect | Prototype | Production |
|---|---|---|
| Data Storage | In-memory CSV/JSON | PostgreSQL / TimescaleDB |
| Authentication | None | OAuth 2.0 / SSO |
| AI Copilot | Pattern-matched | LLM (Gemini / GPT) |
| Real-time | Polling | WebSocket / SSE |
| Deployment | Single Node.js process | Clustered / Docker / K8s |
| Monitoring | Console logs | Prometheus + Grafana |
| Testing | Unit tests only | Unit + Integration + E2E |
| CI/CD | GitHub Actions | Full pipeline with staging |
| Data Volume | 1100 records | Millions of records |
| Security | Basic PII masking | Encryption, RBAC, audit logs |
