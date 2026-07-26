# Security and RBAC

KAVACH AI uses local PostgreSQL-backed accounts only. Passwords use bcrypt; access tokens are short-lived signed JWTs; refresh tokens are rotated, hashed in the database, and delivered as HTTP-only cookies. Passwords, raw tokens, and identity hashes are never logged or returned.

## Roles

| Role | Intended scope |
| --- | --- |
| `STATE_ADMIN` | all districts, user management, audit access |
| `SCRB_ANALYST` | state aggregate intelligence with masking |
| `DISTRICT_OFFICER` | assigned district |
| `STATION_OFFICER` | assigned station |
| `INVESTIGATOR` | assigned cases |
| `EVALUATOR` | synthetic read-only, masked identities |
| `AUDITOR` | audit/report metadata |
| `DATA_ENGINEER` | imports and data-quality workflow |

Authorization applies both permission and district/station/case scope. The frontend hides inapplicable navigation, but the backend is the enforcement point.

## Controls

- Zod validation at HTTP boundaries and parameterized SQL.
- Request IDs, structured sanitised errors, body/upload limits, filename/file-type validation, rate limiting, and an explicit CORS allowlist.
- Masked serializers for evaluator and aggregate roles; raw contact data, addresses, DOBs, hashes, and victim/complainant details are excluded from dashboard APIs.
- Audited login/logout/failure, sensitive views, network requests, report operations, imports, corrections, reviews, and role changes.

Set `CORS_ALLOWED_ORIGINS` explicitly and use strong non-default JWT secrets outside a local demo.
