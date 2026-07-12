# Agentic AI Analytics Salary Stress Audit

Generated: 2026-05-30T08:32:57.421Z

Backend: http://127.0.0.1:3001

## Dataset Inputs

| File | Path | Rows | Columns |
| --- | --- | ---: | ---: |
| train.csv | c:\Users\VISHAL\OneDrive\Documents\Downloads\SD_salary\train.csv | 40000 | 7 |
| test.csv | c:\Users\VISHAL\OneDrive\Documents\Downloads\SD_salary\test.csv | 10000 | 7 |
| data_dictionary.csv | c:\Users\VISHAL\OneDrive\Documents\Downloads\SD_salary\data_dictionary.csv | 7 | 3 |

## Final Verdict

| Category | Result |
| --- | --- |
| Multi-Dataset Support | FAIL |
| Dataset Update Support | FAIL |
| Agentic Architecture | FAIL |
| Dashboard Guardian | FAIL |
| RAG Readiness | FAIL |
| LLM Training Readiness | FAIL |
| Deterministic Analytics | FAIL |
| Production Readiness | FAIL |
| Architecture Score | 0 |

## Prompt Verdict A-J

| Item | Result |
| --- | --- |
| A. Multi-Dataset Support | FAIL |
| B. Dataset Update Support | FAIL |
| C. Agentic Architecture | FAIL |
| D. Dashboard Guardian | FAIL |
| E. RAG Readiness | FAIL |
| F. LLM Training Readiness | FAIL |
| G. Deterministic Analytics | FAIL |
| H. Production Readiness | FAIL |
| I. Architecture Score | 0/100 |

J. What must be built next:

- Add a real merge-plan response with mergeable, confidence, joinKeys, and schemaDifferences.
- Add dataset-level append/replace APIs.
- Persist dataset versions and expose version history.
- Return rowsAdded, rowsRemoved, schemaChanged, and dashboardRegenerated after updates.
- Extend orchestration audit to include analytics_engine and final_explanation steps.
- Add explicit export jobs for schema-memory.json, rag-memory.json, dataset-fingerprints.json, and analytics-playbooks.json.
- Add/export a JSONL fine-tuning dataset with at least 50 distinct schema-aware records.
- apps/backend/src/routes/datasets.js: add append, replace, and version-history routes.
- apps/backend/src/database/dataset-repository.js: persist dataset versions, schema fingerprints, and update metadata.
- apps/backend/src/services/data-merger.js: expose evidence-based merge plan instead of only normalizing rows.
- apps/backend/src/services/ai-analyst: add explicit memory/fingerprint/playbook export service.
- apps/backend/scripts/export-schema-training-jsonl.js: ensure at least 50 schema-aware fine-tuning records are generated/exported.

## Deterministic Analytics Baseline

- Train rows: 40000
- Train columns: 7
- Salary average: 131834.441525
- Salary min/max: 12024 / 277554
- Experience/salary correlation: 0.7724927105564574
- Duplicate rows: 0

## Dataset Registration: FAIL

- PASS: Backend dataset list is readable before upload
- PASS: All three CSVs import successfully
- PASS: Each upload returns a datasetId
- PASS: Dataset IDs are unique
- PASS: Dataset count increased
- PASS: Datasets can be retrieved after upload
- PASS: Stored metadata includes row and column counts
- FAIL: Import response includes generated schema profile/dashboard analysis

## Schema Understanding: FAIL

- FAIL: Schema understanding endpoint executes
- PASS: Schema dashboard/profile endpoint executes
- PASS: Columns are inventoried
- PASS: Columns are not all treated as strings
- PASS: Measures are detected
- PASS: Dimensions are detected
- PASS: Target/salary column is recognized as analytic metric
- PASS: Data dictionary descriptions are used

## Multi-Dataset Reasoning: FAIL

- PASS: train.csv and test.csv share the same schema
- PASS: Multi-file endpoint executes
- PASS: Endpoint classifies primary/test/dictionary roles
- FAIL: Endpoint returns explicit merge plan shape

Improvements:
- Add a real merge-plan response with mergeable, confidence, joinKeys, and schemaDifferences.

## Dataset Update Test: FAIL

- PASS: Existing row-level PATCH update works
- FAIL: Dataset-level replace endpoint exists
- FAIL: Dataset-level append endpoint exists
- FAIL: Dataset version history endpoint exists
- FAIL: Schema/KPI/dashboard refresh metadata returned for update

Improvements:
- Add dataset-level append/replace APIs.
- Persist dataset versions and expose version history.
- Return rowsAdded, rowsRemoved, schemaChanged, and dashboardRegenerated after updates.

## Agent Orchestration Test: FAIL

- PASS: Agentic analysis endpoint executes
- PASS: Audit trail exists
- PASS: Schema Agent executes first
- PASS: Master Agent executes after schema
- PASS: Dashboard Guardian executes
- FAIL: Full expected agent chain is present
- PASS: More than one configured model appears in audit

Improvements:
- Extend orchestration audit to include analytics_engine and final_explanation steps.

## Deterministic Analytics Test: FAIL

- PASS: Harness computed independent row count
- PASS: Harness computed sum/avg/min/max
- PASS: Harness computed correlation
- PASS: Harness computed missing values and outliers
- FAIL: Returned KPI values match deterministic calculations when present
- FAIL: No accepted KPI value is only LLM text

## Dashboard Guardian Test: FAIL

- PASS: Dashboard guardian endpoint executes
- PASS: Guardian reports issues, warnings, or corrections
- FAIL: Guardian removes or corrects non-existent chart/KPI columns

## RAG Training Readiness: FAIL

- PASS: RAG training endpoint executes
- PASS: RAG memory endpoint executes
- PASS: Memory chunks/summaries are generated
- PASS: Embeddings can be generated
- PASS: Reusable memory records exist
- FAIL: Required named memory export files exist

Improvements:
- Add explicit export jobs for schema-memory.json, rag-memory.json, dataset-fingerprints.json, and analytics-playbooks.json.

## LLM Training Readiness: FAIL

- PASS: Harness can generate at least 50 schema-aware fine-tuning examples
- PASS: Training examples use instruction/schema/dashboardPlan/expectedOutput shape
- PASS: Schema training endpoint executes
- PASS: Schema training memory endpoint executes
- FAIL: Persisted training memory has at least 50 examples
- PASS: Training data is not generic chatbot text

Improvements:
- Add/export a JSONL fine-tuning dataset with at least 50 distinct schema-aware records.

## What Must Be Built Next

- Add a real merge-plan response with mergeable, confidence, joinKeys, and schemaDifferences.
- Add dataset-level append/replace APIs.
- Persist dataset versions and expose version history.
- Return rowsAdded, rowsRemoved, schemaChanged, and dashboardRegenerated after updates.
- Extend orchestration audit to include analytics_engine and final_explanation steps.
- Add explicit export jobs for schema-memory.json, rag-memory.json, dataset-fingerprints.json, and analytics-playbooks.json.
- Add/export a JSONL fine-tuning dataset with at least 50 distinct schema-aware records.
- apps/backend/src/routes/datasets.js: add append, replace, and version-history routes.
- apps/backend/src/database/dataset-repository.js: persist dataset versions, schema fingerprints, and update metadata.
- apps/backend/src/services/data-merger.js: expose evidence-based merge plan instead of only normalizing rows.
- apps/backend/src/services/ai-analyst: add explicit memory/fingerprint/playbook export service.
- apps/backend/scripts/export-schema-training-jsonl.js: ensure at least 50 schema-aware fine-tuning records are generated/exported.

## Endpoint Evidence

Full request evidence is available in `reports/agentic-salary-stress-audit.json`.
