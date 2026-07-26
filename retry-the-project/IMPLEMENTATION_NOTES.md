# InsightFlow AI - Schema-First Implementation Notes

## Overview
This document outlines the schema-first AI analytics implementation for InsightFlow. The upgrade enables the AI to reason from dataset schema (metadata) rather than raw data, providing a more secure and intelligent analytics experience.

---

## Changes Made

### 1. New Backend Service: Schema Packet Builder
**File:** `apps/backend/src/services/schemaPacket.js`

**Purpose:** Build schema packets from dataset rows for AI consumption (NO raw data sent to AI)

**Key Functions:**
- `buildSchemaPacket(rows, datasetName, dataDictionary)` - Creates schema metadata
- `parseDataDictionary(dictRows)` - Parses data dictionary CSV
- `formatSchemaForGemini(schemaPacket)` - Formats schema for Gemini prompt

**Schema Packet Output:**
```json
{
  "dataset_name": "train",
  "rows": 40000,
  "columns": [
    {
      "name": "experience",
      "type": "numeric",
      "min": 0,
      "max": 40,
      "mean": 7.8,
      "median": 5,
      "nullCount": 0,
      "uniqueCount": 41
    },
    {
      "name": "country",
      "type": "categorical",
      "topValues": { "USA": 12000, "India": 7000 },
      "nullCount": 0,
      "uniqueCount": 48
    }
  ]
}
```

---

### 2. New Backend Config: Gemini Prompt
**File:** `apps/backend/src/config/geminiPrompt.js`

**Purpose:** Define schema-first system prompt for Gemini AI

**Key Exports:**
- `INSIGHTFLOW_SYSTEM_PROMPT` - System prompt instructing AI to act as schema-first data analyst
- `GIMPLEMENTATION_NOTES.mdNFIG` - Model config (gemini-1.5-flash, temperature: 0.2, JSON response)
- `INTENT_KEYWORDS` - Intent detection keywords
- `CHART_TYPE_RULES` - Chart type selection rules

**Required JSON Output Format:**
```json
{
  "intent": "aggregation | filter | comparison | distribution | correlation | count | trend | unclear",
  "columns_used": ["column_name"],
  "sql": "SELECT ... FROM dataset_rows ...",
  "insight": "1-2 sentence explanation",
  "chart_type": "bar | line | pie | histogram | scatter | table",
  "confidence": 0.0
}
```

---

### 3. Modified Backend: Analytics Service
**File:** `apps/backend/src/services/analytics-service.js`

**Changes:**
1. Added imports for schemaPacket and geminiPrompt
2. Added dynamic import for GoogleGenerativeAI
3. Added new function: `createSchemaFirstChatResponse(dataset, query)`

**Function: createSchemaFirstChatResponse**
- Builds schema packet (no raw data)
- Calls Gemini with schema-first prompt
- Parses JSON response
- Validates columns exist in schema
- Builds chart from SQL result
- Falls back to local analysis if:
  - No GEMINI_API_KEY configured
  - JSON parsing fails
  - AI returns unclear intent

---

### 4. Modified Backend: Server Routes
**File:** `apps/backend/src/server.js`

**Changes:**
1. Added import for `createSchemaFirstChatResponse`
2. Updated chat route (`POST /api/datasets/:datasetId/chat`) to:
   - Use `createSchemaFirstChatResponse` instead of `createChatResponse`
   - Make the route async

---

### 5. Modified Frontend: Chat Interface
**File:** `apps/frontend/src/features/chat/components/ChatInterface.tsx`

**Changes:**
- Added SQL query display below assistant messages
- Shows generated SQL in a code block with "Generated SQL" label

---

## Setup Instructions

### 1. Configure Environment Variables
Create/edit `.env` file in project root:

```env
# Backend
PORT=3001
GEMINI_API_KEY=your_google_gemini_api_key_here

# Frontend
VITE_API_BASE_URL=http://localhost:3001
```

### 2. Get Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Add it to your `.env` file

### 3. Restart Services
```bash
# Stop any running servers
# Then restart:
npm run dev:all
```

---

## How It Works

### Data Flow

```
User Query → API Route → Build Schema Packet → Call Gemini (with schema only)
    ↓
Gemini Returns JSON → Parse & Validate → Execute SQL Locally → Return Response
    ↓
Frontend Displays: Insight Text + SQL Query + Chart
```

### Security Model
- **Raw data NEVER sent to AI** - only schema metadata
- Schema includes: column names, types, stats, sample values
- AI can only use columns that exist in schema
- Falls back to local analysis if API key missing

### Fallback Behavior
If no GEMINI_API_KEY is configured, the system uses the existing local analysis:
- Schema-based query intent detection
- Local SQL generation
- Local chart building

---

## Testing

### Test Schema Packet
```javascript
import { buildSchemaPacket } from './services/schemaPacket.js';

const rows = [
  { name: "John", age: 30, country: "USA" },
  { name: "Jane", age: 25, country: "UK" }
];

const packet = buildSchemaPacket(rows, "test");
console.log(packet);
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:3001/api/datasets/demo/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "Show average salary by education"}'
```

---

## Files Modified/Created

| File | Status | Description |
|------|--------|-------------|
| `apps/backend/src/services/schemaPacket.js` | NEW | Schema packet builder |
| `apps/backend/src/config/geminiPrompt.js` | NEW | Gemini prompt config |
| `apps/backend/src/services/analytics-service.js` | MODIFIED | Added schema-first chat |
| `apps/backend/src/server.js` | MODIFIED | Updated chat route |
| `apps/frontend/src/features/chat/components/ChatInterface.tsx` | MODIFIED | Added SQL display |
| `.env.example` | UNCHANGED | Already had GEMINI_API_KEY |

---

## Technical Details

### Gemini Configuration
- **Model:** gemini-1.5-flash
- **Temperature:** 0.2 (deterministic output)
- **Response Format:** application/json

### Intent Detection
| Intent | Keywords |
|--------|----------|
| aggregation | average, sum, total, mean, median, min, max |
| filter | filter, where, only, with, having |
| comparison | compare, vs, versus, difference, higher, lower |
| distribution | distribution, spread, range, percentile |
| correlation | correlation, related, relationship |
| count | how many, count, number of, total people |
| trend | trend, over time, monthly, yearly, growth |

### Chart Selection Rules
- Categorical comparison → bar
- Trend over time → line
- Part of whole → pie (for <8 categories)
- Numeric distribution → histogram
- Two numeric relationship → scatter
- Unclear → table

---

## Troubleshooting

### "GEMINI_API_KEY is not configured"
- Add your API key to `.env` file
- Restart the backend server

### "Failed to generate SQL"
- Check that your API key is valid
- Check the dataset has columns that match the query
- Check console for detailed error messages

### Chat not responding
- Ensure backend is running on port 3001
- Check browser console for network errors
- Verify dataset is loaded before sending query

---

## Future Enhancements

1. **DuckDB Integration** - For faster local SQL execution
2. **Firebase Persistence** - Store datasets and query history
3. **Data Dictionary Support** - Auto-detect and merge data_dictionary.csv
4. **Multi-dataset Queries** - Join across datasets
5. **Export Reports** - Generate PDF/CSV reports

---

## Implementation Date
April 19, 2026

## Version
1.0.0 - Schema-First AI Analytics