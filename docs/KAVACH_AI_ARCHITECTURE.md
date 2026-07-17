# KAVACH AI Architecture Reference

This legacy filename is retained for existing links. The authoritative architecture is [POSTGRES_ARCHITECTURE.md](POSTGRES_ARCHITECTURE.md) and [PROJECT_ARCHITECTURE.md](../PROJECT_ARCHITECTURE.md).

The current system is React + TypeScript + TanStack Query/MapLibre/Cytoscape, served by the existing Node.js HTTP API with authentication, RBAC, audit logging, approved-tool Copilot routing, parameterized PostgreSQL/PostGIS access, an optional FastAPI analytics service, and optional local Ollama explanation layer. CSV/JSON data is a deliberate offline `file-demo` fallback only; PostgreSQL is the production-mode source of truth.
