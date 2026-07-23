# 🧪 INSIGHTFLOW - COMPREHENSIVE TESTING DOCUMENTATION

**Last Updated:** April 20, 2026  
**Project:** InsightFlow AI Data Analytics Platform  
**Version:** 1.0.0

---

## TABLE OF CONTENTS

1. [Prerequisites](#phase-1-prerequisites)
2. [Application Startup](#phase-2-application-startup)
3. [Frontend Basic Functionality](#phase-3-frontend-basic-functionality)
4. [Data Upload & Management](#phase-4-data-upload--management)
5. [Dashboard & Analytics](#phase-5-dashboard--analytics)
6. [Query Caching Test](#phase-6-query-caching-test)
7. [AI Features (Gemini)](#phase-7-ai-features-gemini)
8. [ML Features (AutoGluon)](#phase-8-ml-features-autogluon)
9. [Error Handling](#phase-9-error-handling--edge-cases)
10. [Browser Console Verification](#phase-10-browser-console-verification)
11. [Performance Benchmarks](#phase-11-performance-benchmarks)
12. [Complete Checklist](#phase-12-complete-checklist)

---

## PHASE 1: PREREQUISITES

### Prerequisites Check

```bash
# Verify all systems ready
node --version          # Should be 18+
npm --version           # Should be 9+
python3 --version       # Should be 3.8+
git status              # Should be clean
```

### Expected Results

| Check | Expected | Status |
|-------|----------|--------|
| Node.js Version | 18+ | [ ] |
| npm Version | 9+ | [ ] |
| Python Version | 3.8+ | [ ] |
| Git Status | Clean | [ ] |

---

## PHASE 2: APPLICATION STARTUP

### Test 2.1: Start All Services

**Command (Windows PowerShell):**
```powershell
.\start-all.bat
# Wait 10 seconds
```

**Command (macOS/Linux):**
```bash
chmod +x start-all.sh test-integration.sh
./start-all.sh &
sleep 10
```

**Expected Console Output - Terminal 1 (Backend):**
```
[startup] Query cache initialized ✅
[cache] Query cache table initialized ✅
[server] Backend running on port 3001 ✅
[services] All services initialized ✅
[server] Database ready ✅
```

**Expected Console Output - Terminal 2 (Frontend):**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:8080/
➜  press h to show help
```

**Expected Console Output - Terminal 3 (ML Service):**
```
[2026-04-20 12:00:00] [INFO] 🚀 AutoGluon ML Service starting...
[2026-04-20 12:00:01] [INFO] 🚀 Starting ML service on port 5000
 * Running on http://0.0.0.0:5000
```

### Test 2.2: Run Integration Tests

**Test Command:**
```bash
# Windows
.\test-integration.bat

# macOS/Linux
./test-integration.sh
```

**Expected Output:**
```
🧪 Testing InsightFlow Integration...
======================================

[Test 1] Checking Backend...
✅ Backend is running

[Test 2] Checking ML Service...
✅ ML Service is running

[Test 3] Checking Frontend...
✅ Frontend is running

[Test 4] Checking Cache...
✅ Cache system initialized

✅ Integration test complete!
```

### PASS Criteria - Startup

| Criteria | Status |
|----------|--------|
| All three terminals show services running | [ ] |
| No error messages (warnings OK) | [ ] |
| Port 3001, 8080, 5000 all active | [ ] |
| Services don't crash after 10 seconds | [ ] |
| All 4 integration tests pass | [ ] |

---

## PHASE 3: FRONTEND BASIC FUNCTIONALITY

### Test 3.1: Frontend Loads Correctly

**Action:**
1. Open browser to `http://localhost:8080`
2. Press `F12` to open Developer Tools
3. Go to `Console` tab
4. Check for errors (red text)

**Expected Good Console Log:**
```
[app] Initializing InsightFlow...
[store] Zustand store created
[router] Routes configured
[app] Ready!
```

### Test 3.2: Navigation Works

**Navigation Test Sequence:**
| Route | Page | Expected |
|-------|------|----------|
| `/` | Dashboard | Dashboard visible |
| `/upload` | Upload | File input visible |
| `/data` | Data Table | Table visible |
| `/chat` | Chat | Chat interface visible |
| `/local-chat` | Local Chat | Chat interface visible |
| `/analytics` | Analytics | Charts visible |
| `/ml` | ML Training | ML page visible |

### PASS Criteria - Frontend

| Criteria | Status |
|----------|--------|
| Page loads without 404 errors | [ ] |
| Logo/header visible | [ ] |
| Navigation menu visible | [ ] |
| No red error messages in console | [ ] |
| Page title shows "InsightFlow" | [ ] |
| All menu items clickable | [ ] |
| Page content changes appropriately | [ ] |
| URL updates correctly | [ ] |

---

## PHASE 4: DATA UPLOAD & MANAGEMENT

### Test 4.1: Upload Sample CSV File

**Create Sample File (sample.csv):**
```csv
id,name,age,salary,department,experience_years
1,Alice,28,65000,Engineering,3
2,Bob,35,75000,Management,8
3,Charlie,24,50000,Sales,1
4,Diana,32,70000,Engineering,6
5,Eve,29,60000,Sales,4
6,Frank,45,85000,Management,12
7,Grace,26,52000,Engineering,2
8,Henry,38,72000,Sales,10
9,Ivy,31,68000,Engineering,5
10,Jack,33,71000,Management,9
```

**Action:**
1. Navigate to `/upload` page
2. Click "Upload Dataset" button
3. Select `sample.csv`
4. Click "Upload"

**Expected Success Message:**
```
✅ Dataset uploaded successfully!
Name: sample.csv
Rows: 10
Columns: 6
```

### Test 4.2: Data Table Features

**Sorting Test:**
| Action | Expected Result |
|--------|----------------|
| Click "Age" header | Table sorts by age ascending |
| Click again | Table sorts by age descending |
| Click "Salary" header | Table sorts by salary |

**Search/Filter Test:**
| Action | Expected Result |
|--------|----------------|
| Type "Engineering" | Only Engineering rows show (4 rows) |
| Clear search | All 10 rows return |
| Type "28" | Shows rows with Age=28 |

### PASS Criteria - Data Management

| Criteria | Status |
|----------|--------|
| File selection dialog appears | [ ] |
| File uploads without error | [ ] |
| Success message appears | [ ] |
| Data shows in preview | [ ] |
| All 10 rows displayed | [ ] |
| All 6 columns visible | [ ] |
| Sorting works (ascending/descending) | [ ] |
| Search filters data | [ ] |

---

## PHASE 5: DASHBOARD & ANALYTICS

### Test 5.1: Dashboard Metrics

**Expected KPI Values:**
| Metric | Expected Value |
|--------|---------------|
| Total Rows | 10 |
| Total Columns | 6 |
| Average Age | ~31.10 |
| Average Salary | ~$67,300 |
| Min Salary | $50,000 |
| Max Salary | $85,000 |

### PASS Criteria - Dashboard

| Criteria | Status |
|----------|--------|
| Dashboard loads | [ ] |
| KPI cards visible | [ ] |
| Total Rows: 10 | [ ] |
| Total Columns: 6 | [ ] |
| At least one chart visible | [ ] |
| No blank spaces (broken charts) | [ ] |
| Charts render with data | [ ] |

---

## PHASE 6: QUERY CACHING TEST

### Test 6.1: First Query (Cache Miss)

**Action:**
1. Go to `/chat`
2. Type query: `"What is the average salary?"`
3. Submit
4. Note response time

**Expected Console Logs:**
```
[analytics] Checking cache for query: "What is the average salary?"
[cache] ❌ MISS - No cached result
[analytics] Attempting AI analysis
[gemini-ai] Calling Gemini API...
[analytics] ✅ AI analysis successful
```

**Response Time:** ~2-3 seconds

### Test 6.2: Second Query (Cache Hit)

**Action:**
1. Type **EXACT same query**: `"What is the average salary?"`
2. Submit
3. Note response time

**Expected Console Logs:**
```
[analytics] Checking cache for query: "What is the average salary?"
[cache] ✅ HIT - Cached result found (hits: 2)
[cache] ⚡ Retrieved from cache (instant response, $0 cost)
```

**Response Time:** <100ms (INSTANT!)

### Test 6.3: Cache Statistics

**Action:**
1. Open browser to `http://localhost:3001/api/cache/stats`

**Expected Response:**
```json
{
  "success": true,
  "cache": {
    "totalCached": 2,
    "totalHits": 1,
    "hitRate": "33.33%",
    "savedAPICalls": 1,
    "estimatedCostSaved": "$0.00"
  }
}
```

### PASS Criteria - Caching

| Criteria | Status |
|----------|--------|
| First query takes 2-3 seconds | [ ] |
| Console shows "MISS" (cache miss) | [ ] |
| Response appears in 2-3 seconds | [ ] |
| Second query takes <100ms | [ ] |
| Console shows "HIT" (cache hit) | [ ] |
| Cache badge shows | [ ] |
| Cache stats endpoint responds | [ ] |
| Hit count increases | [ ] |

---

## PHASE 7: AI FEATURES (GEMINI)

### Test 7.1: AI Analysis with Different Queries

**Test Sequence:**

| Query | Expected Result | Time |
|-------|----------------|------|
| "Show average salary by department" | SQL joins department groups, Shows bar chart | 2-3s |
| "Who is the oldest employee?" | Returns: "Henry (45 years old)" | 2-3s |
| "How many people have experience > 5 years?" | Returns count and names | 2-3s |
| "What is salary distribution?" | Shows histogram or bar chart | 2-3s |

### Test 7.2: AI Fallback (Without Gemini API Key)

**Action:**
1. Go to `.env` file
2. Comment out or remove `GEMINI_API_KEY`
3. Restart backend
4. Try a query

**Expected Console Logs:**
```
[analytics] ℹ️ Gemini API key not configured, using local analysis
[analytics] Using local fallback analysis
```

**Expected Response:**
```
⚠️ Using local analysis (Gemini unavailable)
[Still provides helpful response using local algorithms]
```

### PASS Criteria - AI Features

| Criteria | Status |
|----------|--------|
| Responds in 2-3 seconds (first time) | [ ] |
| Response is relevant to query | [ ] |
| SQL query shown | [ ] |
| Chart displays (if applicable) | [ ] |
| Confidence score shown | [ ] |
| No error messages | [ ] |
| Fallback without API key works | [ ] |

---

## PHASE 8: ML FEATURES (AUTOGLUCON)

### Test 8.1: Model Training

**Action:**
1. Go to `/ml` page
2. Select "salary" as target column
3. Select "Regression" as problem type
4. Click "Train Model"

**Expected Sequence:**
```
Step 1: Click "Train Model"
  → Progress bar appears
  → Shows "⏳ Training Model..."
  
Step 2: Wait ~60 seconds
  → Progress bar fills (0% → 100%)
  
Step 3: Training completes
  → Shows: "✅ Model trained!"
  → Shows Accuracy: (e.g., 92.45%)
  → Feature Importance chart appears
```

### Test 8.2: Feature Importance Visualization

**Expected Chart:**
```
Bar Chart showing:
  X-axis: Feature names
  Y-axis: Importance percentage
  
Bars should show:
  - experience_years: ~65% (longest bar)
  - age: ~25%
  - department: ~8%
  - name: ~2% (shortest bar)
```

### Test 8.3: Make Predictions

**Action:**
1. Fill in values:
   - age: 30
   - experience_years: 5
   - department: Engineering
   - name: John

2. Click "Predict" button

**Expected Output:**
```
✅ Prediction Result:
salary: $64,523.45

(Or similar reasonable salary prediction)
```

### PASS Criteria - ML Features

| Criteria | Status |
|----------|--------|
| Training button clickable | [ ] |
| Progress bar appears and fills | [ ] |
| Training completes in ~60 seconds | [ ] |
| Accuracy shows as percentage | [ ] |
| Feature importance chart renders | [ ] |
| Prediction appears in <1 second | [ ] |
| Value is in reasonable range | [ ] |
| Classification training works | [ ] |

---

## PHASE 9: ERROR HANDLING & EDGE CASES

### Test 9.1: Empty Query

**Action:**
1. Go to Chat
2. Don't type anything
3. Click Submit

**Expected:** Button disabled OR error message: "Please enter a query"

### Test 9.2: Invalid Data Upload

**Action:**
1. Create invalid file: `invalid.txt` (not CSV)
2. Try to upload

**Expected:** Error message: "Invalid file format"

### Test 9.3: Very Large Query

**Action:**
1. Type extremely long query (>1000 characters)
2. Submit

**Expected:** Truncates gracefully OR error message: "Query too long"

### Test 9.4: Network Error Simulation

**Action:**
1. Go to DevTools > Network
2. Set throttling to "Offline"
3. Try a query
4. Restore network

**Expected:** Shows error: "Network error" OR "Cannot reach server"

### PASS Criteria - Error Handling

| Criteria | Status |
|----------|--------|
| Empty query handled gracefully | [ ] |
| Invalid files rejected | [ ] |
| No crash on large query | [ ] |
| Network errors caught | [ ] |
| Error messages helpful | [ ] |
| Recovery possible | [ ] |

---

## PHASE 10: BROWSER CONSOLE VERIFICATION

### Test 10.1: Check for Errors

**Go to:** DevTools (F12) > Console tab

**✅ Should See:**
```
[app] Initializing InsightFlow...
[store] Zustand store created
[router] Routes configured
[analytics] Checking cache...
[gemini-ai] Calling Gemini...
```

**❌ Should NOT See:**
```
Uncaught TypeError:...
Cannot read properties of undefined...
Module not found...
```

### Test 10.2: Network Tab

**Go to:** DevTools > Network tab

**Expected Requests:**
| Request | Status |
|---------|---------|
| POST /api/datasets/[id]/chat | 200 OK |
| GET /api/cache/stats | 200 OK |
| GET /* (frontend) | 200 OK |

### PASS Criteria - Console

| Criteria | Status |
|----------|--------|
| No red error messages | [ ] |
| Only blue info logs | [ ] |
| No 404 errors | [ ] |
| No 500 errors | [ ] |
| Response times <3 seconds | [ ] |

---

## PHASE 11: PERFORMANCE BENCHMARKS

### Test 11.1: Measure Response Times

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Dashboard load | < 2s | | [ ] |
| Data upload (10 rows) | < 5s | | [ ] |
| First query | 2-3s | | [ ] |
| Second query (cached) | < 200ms | | [ ] |
| ML training start | Instant | | [ ] |
| ML training complete | ~60s | | [ ] |
| ML prediction | < 1s | | [ ] |
| Search filter | < 500ms | | [ ] |
| Pagination | < 500ms | | [ ] |

### PASS Criteria - Performance

| Criteria | Status |
|----------|--------|
| All operations meet targets | [ ] |
| No operation hangs (>30s) | [ ] |
| Cached queries faster | [ ] |

---

## PHASE 12: COMPLETE CHECKLIST

### Frontend Features
- [ ] Home/Dashboard page loads
- [ ] Upload page works
- [ ] Data table displays
- [ ] Chat interface functional
- [ ] Analytics page shows
- [ ] ML page accessible
- [ ] Navigation responsive
- [ ] No visual glitches

### Backend Services
- [ ] Backend starts on port 3001
- [ ] Health check responds
- [ ] Database initialized
- [ ] Cache initialized
- [ ] ML service accessible
- [ ] All routes respond
- [ ] Error handling works

### Data Management
- [ ] CSV upload works
- [ ] Data displays correctly
- [ ] Sorting works
- [ ] Filtering works
- [ ] Pagination works
- [ ] No data corruption

### AI Features
- [ ] Gemini API configured (or fallback works)
- [ ] Schema-first approach works
- [ ] SQL generation correct
- [ ] Chart auto-selection works
- [ ] Confidence scoring shown
- [ ] Multiple query types work

### Caching System
- [ ] Cache initializes
- [ ] First query misses cache
- [ ] Second query hits cache
- [ ] Cache stats endpoint works
- [ ] Hit rates tracked
- [ ] Cost savings shown

### ML Features
- [ ] Model training starts
- [ ] Progress bar shows
- [ ] Training completes
- [ ] Accuracy displays
- [ ] Feature importance shows
- [ ] Predictions work

### Error Handling
- [ ] Invalid input handled
- [ ] Network errors caught
- [ ] No app crashes
- [ ] Error messages helpful
- [ ] Recovery possible

### Performance
- [ ] Dashboard: <2s
- [ ] Queries: 2-3s (first), <200ms (cached)
- [ ] ML train: ~60s
- [ ] Overall: Responsive

---

## FINAL VERIFICATION CHECKLIST

```
╔════════════════════════════════════════════════════════════╗
║        INSIGHTFLOW - COMPLETE TESTING CHECKLIST       ║
╚════════════════════════════════════════════════════════════╝

STARTUP PHASE
□ All services start without errors
□ Backend on 3001, Frontend on 8080, ML on 5000
□ Integration tests pass (4/4)
□ No crashes after 2 minutes

FRONTEND BASIC
□ Page loads and displays
□ No console errors (red)
□ Navigation works (all menu items)
□ UI responsive and clean

DATA MANAGEMENT
□ Can upload CSV
□ Data displays in table
□ All rows and columns visible
□ Sorting works (both directions)
□ Search/filter works
□ Pagination functional

DASHBOARD
□ Dashboard loads
□ KPI cards show correct values
□ Charts render without errors

CACHING SYSTEM
□ First query takes 2-3 seconds
□ Second identical query takes <100ms
□ Cache HIT logged in console
□ Cache stats endpoint works

AI FEATURES
□ Query processing works
□ SQL preview displays
□ Charts auto-generate
□ Fallback works without API key

ML TRAINING
□ Can select target column
□ Can choose regression/classification
□ Training starts shows progress
□ Training completes
□ Accuracy displays
□ Feature importance chart renders

ML PREDICTIONS
□ Can input values
□ Can click Predict
□ Prediction appears
□ Value is reasonable

ERROR HANDLING
□ Empty query handled
□ Invalid file rejected
□ Network errors caught
□ No app crashes
□ Error messages helpful

PERFORMANCE
□ Dashboard: <2s
□ Upload: <5s
□ Query (1st): 2-3s
□ Query (2nd): <200ms
□ ML train: ~60s
□ ML predict: <1s

BROWSER CONSOLE
□ No red error messages
□ Info logs show progress
□ Network requests 200 OK
□ No repeated spam

OVERALL ASSESSMENT
□ All 80+ tests passed
□ Application production-ready
□ Every feature working perfectly

DATE: __________
TESTED BY: __________
```

---

## QUICK TEST (5 MINUTES)

```bash
# 1. Start services
.\start-all.bat
sleep 10

# 2. Run tests
.\test-integration.bat

# 3. Manual verification
# Open http://localhost:8080

# 4. Quick feature test
- Upload CSV sample.csv
- Ask: "What is average salary?"
- Ask same query again (should be instant)
- Go to /ml page
- Train model for salary
- Make prediction
```

---

## HOW TO USE THIS DOCUMENT

1. **Before Testing:** Complete Phase 1 (Prerequisites)
2. **Start Application:** Complete Phase 2 (Startup)
3. **Follow Each Phase:** Test in order from Phase 3-11
4. **Check Off Items:** Use checkbox [ ] as you complete each test
5. **Final Review:** Complete Phase 12 checklist when all phases done

---

## TROUBLESHOOTING

### Common Issues

| Issue | Solution |
|-------|---------|
| Port already in use | Kill process: `netstat -ano \| findstr :3001` then `taskkill /PID <pid> /F` |
| Module not found | Run `npm install` in apps/frontend and apps/backend |
| Cache not working | Restart backend |
| ML service not starting | Install Python dependencies: `pip install -r requirements.txt` |

### Support

- **GitHub Issues:** https://github.com/vishalcoder0912/retry-the-project/issues
- **Documentation:** See docs/ folder

---

**END OF TESTING DOCUMENTATION**