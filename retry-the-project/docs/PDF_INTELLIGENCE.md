# PDF Intelligence

## Environment

```bash
PDF_INTELLIGENCE_ENABLED=true
PDF_OCR_ENABLED=true
PDF_OCR_ENGINE=tesseract
PDF_RENDER_DPI=250
PDF_MAX_PAGES=200
PDF_INTELLIGENCE_TIMEOUT_MS=60000
PDF_CHUNK_SIZE=1200
PDF_CHUNK_OVERLAP=150
QDRANT_PDF_CHUNKS_COLLECTION=insightflow_pdf_chunks
QDRANT_PDF_TABLES_COLLECTION=insightflow_pdf_tables
```

## Install

```bash
cd apps/ml-service
pip install -r requirements.txt
```

Install the native Tesseract binary separately and make sure `tesseract` is on `PATH`.

## Run

```bash
docker compose -f docker-compose.qdrant.yml up -d
ollama serve
ollama pull nomic-embed-text:latest
ollama pull qwen3:8b
npm run dev
```

## Test ML Service

```bash
curl http://127.0.0.1:8000/pdf-intelligence/health
curl -X POST http://127.0.0.1:8000/pdf-intelligence/analyze \
  -H "Content-Type: application/json" \
  -d "{\"file_path\":\"ABSOLUTE_PATH_TO_FILE.pdf\",\"ocr_enabled\":true,\"extract_tables\":true}"
```

## Test Backend

```bash
curl -X POST http://127.0.0.1:3001/api/pdf-intelligence/analyze \
  -H "Content-Type: application/json" \
  -d "{\"filePath\":\"ABSOLUTE_PATH_TO_FILE.pdf\",\"ocrEnabled\":true,\"extractTables\":true}"

curl -X POST http://127.0.0.1:3001/api/pdf-intelligence/DOCUMENT_ID/query \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"What are the key figures in this PDF?\"}"

curl -X POST http://127.0.0.1:3001/api/pdf-intelligence/DOCUMENT_ID/convert-table-to-dataset \
  -H "Content-Type: application/json" \
  -d "{\"tableId\":\"TABLE_ID\"}"
```

The LLM only receives retrieved chunks and computed/extracted facts. It does not read full PDFs or calculate dashboard values.

