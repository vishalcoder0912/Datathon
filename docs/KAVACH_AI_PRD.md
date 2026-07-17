# KAVACH AI Product Scope

This file replaces the initial in-memory prototype PRD. The current Datathon 2026 prototype is PostgreSQL/PostGIS-backed and synthetic-data-only.

## Delivered scope

- Persistent normalized FIR-shaped PostgreSQL schema with PostGIS spatial queries.
- Local authentication, RBAC, district/station geographic scope, identity masking, audit trails, and secure imports.
- District and station intelligence, explainable hotspots and spike alerts, anomalies, aggregate geographic risk, case networks, and MO similarity.
- Approved-tool Copilot architecture using optional local Ollama and deterministic fallback.
- HTML/PDF intelligence reports with verification metadata and a human-review disclaimer.

## Explicit safety boundary

The platform does not assign individual risk scores, make guilt conclusions, recommend arrests or enforcement, use biometrics, or use caste, religion, or gender in predictive analytics. Person screens show masked historical case roles and association evidence only.

See [POSTGRES_ARCHITECTURE.md](POSTGRES_ARCHITECTURE.md), [SECURITY_AND_RBAC.md](SECURITY_AND_RBAC.md), and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for the authoritative technical scope and remaining production requirements.
