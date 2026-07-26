# 📋 InsightFlow AI Analytics Platform - Manual QA Checklist

This manual QA checklist provides step-by-step verification protocols to validate the InsightFlow application before major releases.

---

> [!IMPORTANT]
> Ensure all local services (Frontend, Backend, and ML Service) are running and the cache database is cleared before starting the manual QA flow.

## 🛠️ Phase 1: Prerequisites & Environment Check

| Checklist Item | Description | Expected Outcome | Status |
| :--- | :--- | :--- | :---: |
| **Node.js Environment** | Run `node -v` in terminal | Version should be `>= 18.0.0` | [ ] |
| **Python Environment** | Run `python --version` in terminal | Version should be `>= 3.8.0` | [ ] |
| **Git Status Check** | Run `git status` | Working directory should be clean | [ ] |

---

## 🚀 Phase 2: Application Startup & Connectivity

### 1. Launch Services
* Run `npm run dev:all` or individual startup scripts.
* Wait 10 seconds for all ports to spin up.
* Verify the following ports are listening:
  * **Frontend**: `http://localhost:8080` (or configured dev port)
  * **Backend**: `http://localhost:3001`
  * **ML Service**: `http://localhost:5000` (or `http://127.0.0.1:8000` depending on configuration)

### 2. Integration Smoke Test
* Run `npm run test:insightflow-api` or the integration scripts (`.\test-integration.bat`).
* Confirm all 4 connectivity checks (Backend, ML, Frontend, Cache) return `✅ Success`.

---

## 🎨 Phase 3: Frontend Layout & UI Verification

### 1. Navigation Flow
- [ ] Open browser to `http://localhost:8080`
- [ ] Check if the brand logo **InsightFlow** and navigation menu are present.
- [ ] Click through all navigation routes:
  * [ ] **Dashboard** (`/`)
  * [ ] **Upload Dataset** (`/upload`)
  * [ ] **Data Viewer** (`/data`)
  * [ ] **AI Chat Studio** (`/chat` or `/local-chat`)
  * [ ] **ML Center** (`/ml`)
- [ ] Verify that no route triggers a 404 or page crash.

### 2. Dark/Light Theme Switching
- [ ] Toggle theme selector (if present in navbar/sidebar).
- [ ] Verify components render with appropriate high-contrast color scheme (avoid unreadable gray text on gray backgrounds).

---

## 📂 Phase 4: Data Upload & Management

### 1. CSV File Import
- [ ] Go to `/upload` page.
- [ ] Drag or select `sample.csv` (10 rows, 6 columns).
- [ ] Click "Upload & Profile".
- [ ] **Verify**:
  * [ ] Loading spinner/progress bar appears.
  * [ ] Success toast shows: `"Dataset uploaded successfully!"`
  * [ ] File stats display: `Rows: 10`, `Columns: 6`.

### 2. Interactive Data Table
- [ ] Go to `/data` page.
- [ ] Confirm all 10 rows and 6 columns render.
- [ ] Click the **Age** column header once (sort ascending) and twice (sort descending). Verify sorting order.
- [ ] In the search field, type `Engineering`. Confirm that only 4 rows are visible.
- [ ] Clear search and verify all 10 rows return.

---

## 📊 Phase 5: Dashboard Analytics & KPI Calculations

- [ ] Go to `/` (Dashboard).
- [ ] Verify the following cards display correct values:
  * [ ] **Total Rows**: `10`
  * [ ] **Total Columns**: `6`
  * [ ] **Average Age**: `~31.10`
  * [ ] **Average Salary**: `$67,300`
- [ ] Verify that charts (bar, line, or scatter) render without layout overflow.

---

## 🧠 Phase 6: AI Features & Query Caching

### 1. Natural Language Queries
- [ ] Go to `/chat`.
- [ ] Ask: `"What is the average salary by department?"`
- [ ] Confirm the response includes the correct calculations (e.g. Engineering avg, Sales avg).
- [ ] Verify that a bar/donut chart representing this data is automatically generated.

### 2. Caching Verification
- [ ] Run the exact same query again: `"What is the average salary by department?"`
- [ ] Verify that the response is instant (<100ms) and displays a **Cached ⚡** badge.
- [ ] Open the Developer Console (`F12`) and check for cache logs: `[cache] ✅ HIT - Cached result found`.

---

## 🤖 Phase 7: Machine Learning Center (AutoGluon)

### 1. Model Training
- [ ] Navigate to `/ml`.
- [ ] Select `salary` as the target label.
- [ ] Set model type to `Regression`.
- [ ] Click **Train Model**.
- [ ] Verify that the training progress indicator updates correctly.
- [ ] Confirm training completes with an accuracy/score summary and **Feature Importance** chart.

### 2. Inference / Prediction
- [ ] Under the Predict section, input test values (e.g., `Age: 30`, `Experience: 5`, `Department: Engineering`).
- [ ] Click **Predict**.
- [ ] Confirm that a realistic predicted salary (e.g. around `$60,000` to `$70,000`) is returned.

---

## 🛡️ Phase 8: Guardian Policy & Error Resilience

- [ ] Enter a query referencing a non-existent column: `"Show salary for fake_column"`.
- [ ] Confirm the **Dashboard Guardian** intercepts the query and shows a friendly error message without crashing.
- [ ] Simulate network disconnect: Set DevTools to **Offline**, trigger a query, and verify the app displays a graceful recovery/network error alert.
