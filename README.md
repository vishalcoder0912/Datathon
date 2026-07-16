# KAVACH AI

**Karnataka AI Visualization & Analytics for Crime Hotspots**

A Datathon 2026 prototype for Challenge 02: AI-Driven Crime Analytics & Visualization Platform. Transforms InsightFlow into the **Karnataka Crime Intelligence Command Centre**.

## Product Overview

KAVACH AI (Karnataka AI Visualization & Analytics for Crime Hotspots) is a crime intelligence platform for Karnataka law enforcement. It provides:

- **Command Dashboard** with real-time KPIs
- **Geo-Intelligence** with district-level crime mapping
- **Trend Intelligence** with multi-dimensional pattern analysis
- **Hotspot Detection** with multi-factor scoring
- **Anomaly Detection** using IQR and Z-score methods
- **Network Intelligence** with criminal network visualization
- **Offender Intelligence** with risk scoring and classification
- **Risk Intelligence** with district-level risk assessment
- **Social Correlations** with socioeconomic indicator analysis
- **AI Copilot** with natural language query processing
- **Automated Alerts** for spikes, delays, and anomalies
- **Report Generation** with HTML crime intelligence reports

## Architecture Summary

```
kavach-ai/
├── apps/
│   ├── frontend/          # React 18 + TypeScript + Vite + Tailwind CSS
│   └── backend/           # Node.js custom HTTP server
├── packages/
│   ├── kavach-domain/     # Shared domain logic (enums, schemas, utils)
│   └── shared-analytics/  # Shared analytics utilities
├── data/demo/             # Synthetic Karnataka crime dataset
├── scripts/               # Seed and utility scripts
└── docs/                  # Documentation
```

## Requirements

- Node.js 18+
- npm 9+

## Installation

```bash
npm install
```

## Development Commands

```bash
# Generate demo data (required before first run)
npm run seed:kavach

# Start all development servers
npm run dev

# Frontend only (port 5173)
npm run dev:frontend

# Backend only (port 3001)
npm run dev:backend

# Build for production
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Seed Command

```bash
npm run seed:kavach
```

Generates synthetic Karnataka crime data:
- 1100 crime incidents across 30 districts
- 80 persons (20 repeat offenders, 2 criminal networks)
- 450+ relationships
- 30 district socioeconomic indicators

## Test Commands

```bash
# Run all frontend tests
npm test

# Run backend tests
npm run test:backend

# Run E2E tests
npm run test:e2e
```

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3001 | Backend server port |
| `HOST` | localhost | Backend host |
| `NODE_ENV` | development | Environment mode |
| `DATA_DIR` | ./data | Data directory |
| `KAVACH_DATA_DIR` | ./data/demo | KAVACH demo data directory |
| `KAVACH_AI_TITLE` | KAVACH AI | Application title |
| `KAVACH_PLATFORM_TITLE` | Karnataka Crime Intelligence Command Centre | Platform title |

## Demo Credentials

No authentication is required. All features are accessible without login.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

### Quick Deploy

1. Push to GitHub
2. Connect to Vercel
3. Deploy `apps/frontend` and `apps/backend` separately

## Known Limitations

- **In-memory data only**: No persistent database; data reloads on server restart
- **No authentication**: All endpoints are unauthenticated
- **Pattern-matched AI Copilot**: Not a real LLM; uses keyword pattern matching
- **Static demo data**: 1100 synthetic incidents; not connected to live feeds
- **Single-process Node.js**: No clustering or load balancing
- **No WebSocket**: Real-time updates not supported
- **No HTTPS**: Development-only HTTP

## Decision-Support Disclaimer

KAVACH AI is a prototype developed for Datathon 2026. It is intended for demonstration and evaluation purposes only. The analytics, risk scores, hotspot detection, and offender classifications are based on synthetic data and simplified statistical models. They should NOT be used as the sole basis for real-world law enforcement decisions, resource allocation, or investigative actions. All outputs require human review and validation before operational use.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Radix UI** - Component library
- **Recharts** - Charts
- **Axios** - HTTP client
- **TanStack Query** - Data fetching

### Backend
- **Node.js** - Runtime
- **node:sqlite** - SQLite-backed dataset and chat persistence

## License

Private project — Datathon 2026