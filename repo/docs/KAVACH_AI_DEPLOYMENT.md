# KAVACH AI Deployment Reference

This legacy filename now points to the current local-first deployment model.

KAVACH runs locally with PostgreSQL 16/PostGIS through `infra/docker-compose.yml`, the existing Node.js API, the React frontend, and an optional local FastAPI analytics service. Local Ollama is optional and is never a paid dependency.

Use [LOCAL_DEMO_GUIDE.md](LOCAL_DEMO_GUIDE.md) for exact commands and [DEPLOY.md](../DEPLOY.md) for service configuration, CORS, report storage, and production controls. The old in-memory-only/no-authentication deployment notes no longer describe the application.
