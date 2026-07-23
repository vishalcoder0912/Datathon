# Debugging Guide - Permutation & Combination Analysis

> Branch: gen-ai-working

---

## Table of Contents
1. [Error Classification](#error-classification)
2. [Permutation Testing Matrix](#permutation-testing-matrix)
3. [Debug Procedures](#debug-procedures)
4. [Error Code Reference](#error-code-reference)

---

## Error Classification

### Category A: Data Pipeline Errors

| Error Type | File Location | Frequency | Severity |
|------------|---------------|------------|----------|
| CSV Parse | `dataset-repository.js` | High | Critical |
| Schema Inference | `schema-profiler.js` | Medium | High |
| Type Conversion | `data-merger.js` | Medium | Medium |
| Memory Overflow | `dataset-repository.js` | Low | Critical |

### Category B: AI Service Errors

| Error Type | File Location | Frequency | Severity |
|------------|---------------|------------|----------|
| LLM Timeout | `ollamaClient.js` | High | High |
| Invalid Response | `ai-manager.js` | Medium | High |
| Context Overflow | `llm-schema-dashboard-planner.js` | Low | High |
| Model Not Found | `ollama-dual-model-service.js` | Medium | High |

### Category C: UI/UX Errors

| Error Type | File Location | Frequency | Severity |
|------------|---------------|------------|----------|
| Chart Render | `SmartChartCard.tsx` | Low | Low |
| State Management | `DataContext.tsx` | Medium | Medium |
| Route Error | `AppRouter.tsx` | Low | Low |

### Category D: System Errors

| Error Type | File Location | Frequency | Severity |
|------------|---------------|------------|----------|
| Server Startup | `server.js` | Low | Critical |
| Database Connection | `dataset-repository.js` | Low | Critical |
| File System | `qr-file-parser.js` | Low | High |

---

## Permutation Testing Matrix

### 1. Data Upload Permutations

| Input Type | Size | Format | Network | Expected Result |
|------------|------|--------|---------|-----------------|
| CSV | Small | Valid | Fast | Success |
| CSV | Small | Valid | Slow | Success (timeout handled) |
| CSV | Small | Invalid | Fast | Error with message |
| CSV | Large | Valid | Fast | Success (chunked) |
| CSV | Large | Valid | Slow | Partial (resumable) |
| CSV | Large | Invalid | Fast | Error immediate |
| JSON | Small | Valid | Fast | Success |
| JSON | Small | Invalid | Fast | Error with details |
| JSON | Large | Valid | Fast | Success |
| PDF | Any | Valid | Fast | Success |
| PDF | Any | Corrupted | Fast | Error message |

### 2. AI Query Permutations

| Context | Model | Temperature | Max Tokens | Expected |
|---------|-------|-------------|------------|----------|
| Empty | llama3 | 0.7 | 500 | Error/fallback |
| Empty | llama3 | 0.0 | 100 | Error/fallback |
| Small | llama3 | 0.7 | 500 | Success |
| Small | gemma | 0.7 | 500 | Success |
| Large | llama3 | 0.7 | 500 | Truncated response |
| Large | llama3 | 0.0 | 100 | Deterministic |
| Empty | gemma | 0.0 | 100 | Fallback |

### 3. Dashboard Generation Permutations

| Columns | Types | Count | Chart Types |
|---------|-------|-------|--------------|
| Numeric | All | 1 | Bar, Line |
| Numeric | All | >1 | Multi-bar, Line |
| Categorical | String | 1 | Pie, Bar |
| Categorical | String | >1 | Stacked Bar |
| Mixed | Numeric + String | Any | Combined |
| Date | DateTime | Any | Timeline |
| Empty | - | 0 | Empty state |

### 4. Schema Training Permutations

| Dataset | Columns | Rows | Schema Known | Result |
|---------|---------|------|--------------|--------|
| Valid | 1-5 | <1000 | Yes | Success |
| Valid | 5-20 | >1000 | Yes | Success |
| Valid | >20 | Any | No | Partial |
| Invalid | Any | Any | - | Error |

---

## Debug Procedures

### Procedure 1: CSV Upload Debug

```
1. Check file size: < 50MB
2. Verify encoding: UTF-8
3. Check delimiter: comma, semicolon, tab
4. Verify headers: no special characters
5. Check line endings: \n or \r\n

Debug commands:
- Node: require('csv-parse')
- Browser: FileReader API
- Backend: dataset-repository.js:parseCSV()
```

### Procedure 2: AI Service Debug

```
1. Check Ollama status:
   curl http://localhost:11434/api/tags

2. Check model availability:
   - llama3
   - gemma:2b
   - mistral
   - codellama

3. Check environment variables:
   - OLLAMA_BASE_URL
   - OLLAMA_MODEL
   - OLLAMA_TIMEOUT

4. Check logs:
   - console.log in development
   - logs/ai-service.log in production
```

### Procedure 3: Dashboard Debug

```
1. Check data store:
   - dataStore.getState()
   - Verify columns exist
   - Verify row count > 0

2. Check schema fingerprint:
   - schemaFingerprint.getSchema(datasetId)
   - Verify column types

3. Check chart engine:
   - chartEngine.getChartType(columnTypes)
   - Verify compatible type selected

4. Check KPI engine:
   - kpiEngine.calculate(data, config)
   - Verify no NaN values
```

### Procedure 4: PDF Processing Debug

```
1. Check file validity:
   - File type: application/pdf
   - Not password protected
   - Not corrupted

2. Check extraction:
   - pdf-loader-service.js:loadPdf()
   - pdf-table-extractor.js:extractTables()

3. Check RAG:
   - pdf-rag-chunker.js:chunkDocument()
   - Verify chunk size < 1000
```

### Procedure 5: Schema Training Debug

```
1. Check seed data:
   - schema-training-memory.seed.json
   - Verify JSON format

2. Check training process:
   - train-schema-dashboard-llm.js
   - Verify Ollama is running

3. Check inference:
   - schema-trained-ai-service.js:query()
   - Verify model is loaded
```

---

## Error Code Reference

### Data Errors (Dxxx)

| Code | Message | Action |
|------|---------|--------|
| D001 | Invalid CSV format | Check delimiter and encoding |
| D002 | File too large | Use chunked upload |
| D003 | Missing required columns | Add missing columns |
| D004 | Type conversion failed | Check data types |
| D005 | Memory limit exceeded | Reduce file size |

### AI Errors (Axxx)

| Code | Message | Action |
|------|---------|--------|
| A001 | LLM not responding | Check Ollama service |
| A002 | Model not found | Pull required model |
| A003 | Response timeout | Increase timeout |
| A004 | Invalid response format | Check model output |
| A005 | Context overflow | Reduce input size |

### UI Errors (Uxxx)

| Code | Message | Action |
|------|---------|--------|
| U001 | Chart render failed | Check data validity |
| U002 | State update failed | Check React state |
| U003 | Route not found | Check router config |
| U004 | Component mount failed | Check props |

### System Errors (Sxxx)

| Code | Message | Action |
|------|---------|--------|
| S001 | Server startup failed | Check port availability |
| S002 | Database connection failed | Check database config |
| S003 | File not found | Check file path |
| S004 | Permission denied | Check file permissions |

---

## Permutation Combination Test Cases

### Test Case 1: Upload + Process + Dashboard

```
Input: [File Type, File Size, Network Speed]
       [CSV, 5MB, 100ms]
       [CSV, 50MB, 100ms]
       [CSV, 5MB, 5000ms]
       [JSON, 1MB, 100ms]
       [PDF, 10MB, 100ms]

Expected: All combinations handled gracefully
Actual: ✓ All pass
```

### Test Case 2: Query + LLM + Response

```
Input: [Query Type, Model, Context, Timeout]
       [Simple, llama3, empty, 30s]
       [Simple, llama3, small, 30s]
       [Complex, llama3, large, 60s]
       [Simple, gemma, small, 30s]
       [Complex, gemma, large, 60s]

Expected: Proper fallback on timeout
Actual: ✓ All pass
```

### Test Case 3: Schema + Charts + KPIs

```
Input: [Column Types, Row Count, Chart Selection]
       [numeric(1), 100, bar]
       [numeric(3), 100, multi-bar]
       [categorical(1), 100, pie]
       [categorical(3), 100, stacked]
       [mixed(2,2), 100, combined]
       [date, 100, timeline]

Expected: Appropriate chart selection
Actual: ✓ All pass
```

### Test Case 4: PDF + Extract + RAG

```
Input: [PDF Size, Pages, Table Count, Image Count]
       [1MB, 5, 0, 0]
       [5MB, 20, 2, 5]
       [10MB, 50, 10, 20]
       [Corrupted, -, -, -]

Expected: Proper error handling
Actual: ✓ All pass
```

---

## Quick Debug Commands

```bash
# Check server status
curl http://localhost:3001/api/health

# Check Ollama models
curl http://localhost:11434/api/tags

# Check database
sqlite3 data/insightflow.db ".tables"

# View recent logs
tail -f logs/combined.log

# Run specific test
vitest run src/__tests__/health.test.js

# Test API endpoint
curl -X POST http://localhost:3001/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "context": {}}'
```

---

## Conclusion

This document provides comprehensive debugging information using permutation and combination analysis. All test cases pass successfully with proper error handling implemented across the codebase.

*Last Updated: 2026-05-20*
*Version: 1.0.0*