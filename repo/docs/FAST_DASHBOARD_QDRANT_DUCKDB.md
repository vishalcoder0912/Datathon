# Fast Dashboard, Qdrant, and DuckDB Runbook

## Start Services

```bash
docker compose -f docker-compose.qdrant.yml up -d
ollama serve
ollama pull qwen3:8b
ollama pull qwen3:4b
ollama pull llama3.2:3b
ollama pull nomic-embed-text:latest
```

```bash
cd apps/ml-service
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd apps/backend
npm install
npm run dev
```

## Generate 1M Row Test Dataset

```bash
cd apps/ml-service
python scripts/generate_1m_test_dataset.py
```

The script prints the absolute or relative Parquet path.

## Test ML Fast Dashboard

```bash
curl -X POST http://127.0.0.1:8000/fast-dashboard \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "ABSOLUTE_PATH_TO_TEST_PARQUET",
    "metric_priority": ["revenue", "profit", "sales"],
    "group_limit": 10
  }'
```

Expected shape:

```json
{
  "engine": "duckdb",
  "cacheHit": false,
  "rowCount": 1000000,
  "selectedMetric": "revenue",
  "selectedDimension": "region",
  "kpis": {
    "rowCount": 1000000,
    "mainMetric": "revenue",
    "mainMetricTotal": 2599500000,
    "mainMetricAverage": 2599.5
  },
  "charts": [
    {
      "title": "Top region by revenue",
      "type": "bar",
      "data": []
    }
  ],
  "warnings": [],
  "durationMs": 1234
}
```

Run the same request again and `cacheHit` should be `true`.

## Backend Large Dataset Policy

Datasets with `rowCount >= LARGE_DATASET_ROW_THRESHOLD` use:

```text
Node backend -> ML service /fast-dashboard -> DuckDB/Polars deterministic calculation
```

Datasets below the threshold keep the existing local JS/schema dashboard path.

## Safety Rules

- LLMs do not calculate KPI or chart values.
- LLMs must receive schema and computed facts only.
- Qdrant is used only for schema memory, similar schema retrieval, KPI/chart patterns, semantic matching, and future document chunks.
- Qdrant is not used for totals, averages, financial values, or row-level analytics.
- AirLLM is disabled by default and is not part of the dashboard calculation path.
