# KAVACH Crime Intelligence Operating System

KAVACH AI now exposes a state-wide Crime Intelligence Operating System layer rather than presenting its capabilities as unrelated dashboard pages. The layer coordinates existing PostgreSQL/PostGIS, knowledge-graph, FastAPI, alert, report, RBAC, audit, data-quality, and visualization capabilities through explicit safety boundaries.

This remains a synthetic Datathon prototype. It is not operational police software, does not predict guilt, and does not recommend arrest or enforcement.

## Officer workspace

```text
/intelligence-os
```

The workspace provides:

- A 15-capability platform map
- Multi-agent responsibility and data-boundary cards
- Natural-language Investigation Copilot
- Relational, PostGIS, graph, repeat-offender, and visualization planning
- Schema Intelligence Engine demonstration
- Data Quality AI demonstration
- Explainable Graph AI
- Spatiotemporal alert-rule evaluation
- Multi-format report planning
- Prediction Sandbox with factor contributions and limitations

## API

All endpoints require authentication. Read-only intelligence functions require `read:intelligence`. Schema and data-quality analysis require `manage:data`. Report planning requires `generate:reports`.

```text
GET  /api/kavach/intelligence-os/capabilities
GET  /api/kavach/intelligence-os/agents
POST /api/kavach/intelligence-os/schema/infer
POST /api/kavach/intelligence-os/data-quality/analyze
POST /api/kavach/intelligence-os/investigate
POST /api/kavach/intelligence-os/graph/explain
POST /api/kavach/intelligence-os/alerts/evaluate
POST /api/kavach/intelligence-os/sandbox/simulate
POST /api/kavach/intelligence-os/reports/plan
```

Every write-like analytical request is audit-recorded. Analytical endpoints return plans, explanations, findings, or bounded simulations. They do not silently modify authoritative crime records.

## Capability implementation map

| Requested capability | KAVACH implementation | Status |
|---|---|---|
| Universal Data Gateway | `/api/kavach/data-sources/*` | Implemented control plane |
| Schema Intelligence Engine | Canonical entity and relationship inference | Implemented |
| Data Quality AI | Alias/date normalization, duplicate FIRs, coordinate and timestamp checks | Implemented |
| Crime Knowledge Graph | Existing intelligence graph plus explicit entity model | Implemented |
| Investigation Copilot | Approved multi-engine investigation planner | Implemented |
| Natural Language Dashboard | Visualization specification returned from officer queries | Implemented |
| Multi-Agent AI | Eight bounded agents with visible inputs and outputs | Implemented |
| Digital Twin of Karnataka | Existing geo-intelligence map and district/station overlays | Prototype |
| Timeline Investigation | Existing evolution timeline endpoint and dashboard playback | Implemented |
| AI Report Generator | PDF, PowerPoint, Excel, HTML, and JSON package planning | Implemented planning layer |
| Explainable AI Panel | Existing risk factors plus OS safety/explanation contracts | Implemented |
| Real-Time Alert Engine | Count/radius/time-window cluster evaluation | Implemented evaluation layer |
| Prediction Sandbox | Aggregate scenario simulation with limitations | Implemented bounded model |
| Explainable Graph AI | Evidence-derived graph reason codes and confidence | Implemented |
| Cloud Connectors | Airbyte/Airbyte-CDK adapter definitions | Adapter-ready |

## Investigation Copilot contract

Example question:

```text
Show all robbery cases linked with a white Swift car within 15 km during the last 6 months involving repeat offenders in Mysuru.
```

The planner extracts:

```text
crime type
location scope
radius
period
vehicle colour and model
repeat-offender requirement
```

It then creates an approved plan for:

```text
parameterized PostgreSQL query
PostGIS ST_DWithin radius filter
authorized graph projection
repeat-offender summary
map + timeline + network + evidence panel
```

The endpoint returns query templates and parameter ordering for transparency. It does not execute arbitrary SQL or model-authored graph queries.

## Multi-agent boundaries

```text
Coordinator Agent
    -> Schema Intelligence Agent
    -> Data Quality Agent
    -> Crime Analysis Agent
    -> Network Agent
    -> Prediction Sandbox Agent
    -> Report Agent
    -> Visualization Agent
```

The Coordinator applies scope and safety policy. Schema processing is schema-first. Raw rows are not sent to an external model by this service. Product calculations remain deterministic unless an explicitly configured analytical service is invoked by the backend.

## Data quality checks

The implemented quality analyzer covers:

- District aliases such as Bangalore, Bengaluru, B'lore, and BLR
- Karnataka historical naming aliases such as Mysore/Mysuru and Belgaum/Belagavi
- Indian date formats such as `01/02/24`, `1 Feb 2024`, and ISO dates
- Duplicate crime or FIR numbers
- Missing crime numbers
- Missing or incomplete coordinates
- Non-numeric coordinates
- Prototype Karnataka boundary violations
- Future incident dates
- Registration dates before incident dates

Corrections remain proposed changes and require human approval.

## Explainable graph contract

Graph relationships return explicit reason codes such as:

```text
SHARED_PHONE
SHARED_VEHICLE
SHARED_ADDRESS
SHARED_INCIDENT
SHARED_ASSOCIATE
SHARED_LOCATION
MO_SIMILARITY
```

A graph edge is an investigative lead. It does not establish guilt, direct contact, or criminal participation.

## Alert engine

The first alert rule implements the requested pattern:

```text
5 incidents
within 2 km
within 2 hours
```

The evaluator returns cluster membership, centroid, severity, reason codes, and planned notification channels. Dashboard and email delivery require configured workers. SMS and WhatsApp require approved provider accounts, credentials, templates, audit policy, and operational authorization.

## Prediction Sandbox

The sandbox accepts aggregate scenario inputs:

```text
baseline risk
patrol change percentage
festival intensity
recent recorded trend
reporting coverage change
```

It returns a bounded score, factor contributions, confidence, and limitations. This is a scenario calculation, not a causal forecast. It must not be used as the sole basis for patrol deployment or enforcement.

## Persistence

Migration `013_crime_intelligence_os.sql` adds durable structures for:

```text
intelligence_query_run
data_quality_analysis_run
intelligence_alert_rule
prediction_sandbox_run
intelligence_report_package
```

The API currently provides the safe analytical and planning layer. Production workers should persist approved runs, execute controlled queries, generate files, deliver notifications, and update workflow states.

## Deployment honesty

The following are not claimed as live merely because the architecture supports them:

- Airbyte control-plane deployment
- Live AWS, Azure, or GCP connectivity
- Neo4j Graph Data Science execution
- SMS or WhatsApp delivery
- Operational evidence storage
- Government signing and retention workflows
- Causal patrol-impact prediction
- Authoritative Karnataka jurisdiction boundaries

Those require infrastructure, credentials, legal approval, data agreements, model validation, and security assessment. Software diagrams remain unable to grant any of those, despite decades of management optimism.

## Verification

```bash
npm run db:migrate
npm run test:backend -- crime-intelligence-os.test.js
npm run test:integration
npm run lint
npm run build
```
