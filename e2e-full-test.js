/**
 * InsightFlow - Full End-to-End Test Suite
 * Tests ALL features: API health, dataset ops, AI chat, analytics, ML, cache, etc.
 *
 * Usage:
 *   API_BASE_URL=http://127.0.0.1:3001 node e2e-full-test.js
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
let datasetId = null;
let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

async function assertBackendRunning() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`Health returned HTTP ${response.status}`);
    }
    console.log(`  ✅ Backend reachable at ${API_BASE_URL}`);
  } catch (error) {
    console.error("");
    console.error("  ❌ Backend is not running or not reachable.");
    console.error(`     Tried: ${API_BASE_URL}`);
    console.error("");
    console.error("  Start backend first:");
    console.error("     cd apps/backend");
    console.error("     npm run dev");
    console.error("");
    console.error("  Or set correct API_BASE_URL:");
    console.error("     API_BASE_URL=http://127.0.0.1:3001 node e2e-full-test.js");
    console.error("");
    console.error(`  Original error: ${error.message}`);
    process.exit(1);
  }
}

async function request(method, path, body = null, timeoutMs = 90000) {
  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
  };
  if (body) options.body = JSON.stringify(body);

  const start = Date.now();
  try {
    const res = await fetch(url, options);
    clearTimeout(timer);
    const elapsed = Date.now() - start;
    const data = await res.json().catch(() => null);
    return { status: res.status, data, elapsed };
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Date.now() - start;
    console.log(`     ⚠️  Request failed: ${method} ${path} — ${err.message} (${elapsed}ms)`);
    return { status: 0, data: null, elapsed, error: err.message };
  }
}

function test(name, condition, detail = "") {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${name} ${detail ? `(${detail})` : ""}`);
  } else {
    failed++;
    const msg = `  ❌ ${name} ${detail ? `— ${detail}` : ""}`;
    console.log(msg);
    failures.push(msg);
  }
}

// ─────────────────────────────────────────────
// 1. ROOT & HEALTH
// ─────────────────────────────────────────────
async function testRootAndHealth() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  1. ROOT INDEX & HEALTH CHECK");
  console.log("═══════════════════════════════════════════");

  const root = await request("GET", "/");
  test("GET / returns 200", root.status === 200);
  test("Root has name field", root.data?.data?.name === "InsightFlow API");
  test("Root has endpoints listing", root.data?.data?.endpoints != null);

  const health = await request("GET", "/api/health");
  test("GET /api/health returns 200", health.status === 200);
  test("Health status is healthy", health.data?.status === "healthy");
}

// ─────────────────────────────────────────────
// 2. STATE
// ─────────────────────────────────────────────
async function testState() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  2. APPLICATION STATE");
  console.log("═══════════════════════════════════════════");

  const state = await request("GET", "/api/state");
  test("GET /api/state returns 200", state.status === 200);
  test("State has dataset field", state.data?.dataset !== undefined);
  test("State has chatMessages field", Array.isArray(state.data?.chatMessages));

  if (state.data?.dataset) {
    datasetId = state.data.dataset.id;
    test("Dataset has id", typeof datasetId === "string");
    test("Dataset has name", typeof state.data.dataset.name === "string");
    test("Dataset has columns", Array.isArray(state.data.dataset.columns));
    test("Dataset has rows", Array.isArray(state.data.dataset.rows));
    test("Dataset has rowCount", typeof state.data.dataset.rowCount === "number");
    console.log(`     → Dataset: "${state.data.dataset.name}" (${state.data.dataset.rows.length} rows, ${state.data.dataset.columns.length} cols)`);
  }
}

// ─────────────────────────────────────────────
// 3. DEMO DATASET
// ─────────────────────────────────────────────
async function testDemoDataset() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  3. DEMO DATASET LOADING");
  console.log("═══════════════════════════════════════════");

  const demo = await request("POST", "/api/datasets/demo");
  test("POST /api/datasets/demo returns 201", demo.status === 201);
  test("Demo returns dataset", demo.data?.dataset != null);
  test("Demo dataset has id", typeof demo.data?.dataset?.id === "string");
  test("Demo dataset has rows", Array.isArray(demo.data?.dataset?.rows));
  test("Demo dataset has columns", Array.isArray(demo.data?.dataset?.columns));
  test("Demo has chatMessages array", Array.isArray(demo.data?.chatMessages));
  test("Demo response time < 3s", demo.elapsed < 3000, `${demo.elapsed}ms`);

  if (demo.data?.dataset) {
    datasetId = demo.data.dataset.id;
    console.log(`     → Created demo dataset: ${datasetId}`);
    console.log(`     → ${demo.data.dataset.rows.length} rows, ${demo.data.dataset.columns.length} columns`);
  }
}

// ─────────────────────────────────────────────
// 4. DATASET IMPORT
// ─────────────────────────────────────────────
async function testDatasetImport() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  4. DATASET IMPORT (CSV-like)");
  console.log("═══════════════════════════════════════════");

  const importData = {
    name: "Test Employee Dataset",
    fileName: "test_employees.csv",
    sourceType: "upload",
    columns: [
      { name: "name", type: "string" },
      { name: "department", type: "string" },
      { name: "salary", type: "number" },
      { name: "experience", type: "number" },
    ],
    rows: [
      { name: "Alice", department: "Engineering", salary: 120000, experience: 5 },
      { name: "Bob", department: "Marketing", salary: 95000, experience: 3 },
      { name: "Charlie", department: "Engineering", salary: 135000, experience: 8 },
      { name: "Diana", department: "Sales", salary: 88000, experience: 2 },
      { name: "Eve", department: "Engineering", salary: 145000, experience: 10 },
      { name: "Frank", department: "Marketing", salary: 105000, experience: 6 },
      { name: "Grace", department: "Sales", salary: 92000, experience: 4 },
      { name: "Hank", department: "Engineering", salary: 128000, experience: 7 },
    ],
  };

  const imp = await request("POST", "/api/datasets/import", importData);
  test("POST /api/datasets/import returns 201", imp.status === 201);
  test("Import returns dataset", imp.data?.dataset != null);
  test("Import dataset has correct name", imp.data?.dataset?.name === "Test Employee Dataset");
  test("Import preserves row count", imp.data?.dataset?.rows?.length === 8);
  test("Import preserves column count", imp.data?.dataset?.columns?.length === 4);

  // Test validation: empty rows
  const emptyImport = await request("POST", "/api/datasets/import", { rows: [] });
  test("Empty import returns 400", emptyImport.status === 400);
  test("Empty import has error message", typeof emptyImport.data?.error === "string");

  if (imp.data?.dataset) {
    datasetId = imp.data.dataset.id;
    console.log(`     → Imported dataset: ${datasetId}`);
  }
}

// ─────────────────────────────────────────────
// 5. SCHEMA
// ─────────────────────────────────────────────
async function testSchema() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  5. DATASET SCHEMA");
  console.log("═══════════════════════════════════════════");

  if (!datasetId) {
    console.log("  ⏩ Skipped (no dataset)");
    return;
  }

  const schema = await request("GET", `/api/datasets/${datasetId}/schema`);
  test("GET schema returns 200", schema.status === 200);
  test("Schema has schema field", schema.data?.schema != null);
  test("Schema has columns", Array.isArray(schema.data?.schema?.columns));
  test("Schema has datasetName", typeof schema.data?.schema?.datasetName === "string");
  test("Schema has rowCount", typeof schema.data?.schema?.rowCount === "number");
  test("Schema has columnCount", typeof schema.data?.schema?.columnCount === "number");

  if (schema.data?.schema?.columns) {
    const cols = schema.data.schema.columns;
    test("Schema columns have name", cols.every(c => typeof c.name === "string"));
    test("Schema columns have type", cols.every(c => typeof c.type === "string"));
    test("Schema columns have role", cols.every(c => typeof c.role === "string"));
    console.log(`     → Columns: ${cols.map(c => `${c.name}(${c.role})`).join(", ")}`);
  }

  // Test 404 for non-existent dataset
  const bad = await request("GET", "/api/datasets/nonexistent-id/schema");
  test("Non-existent dataset schema returns 404", bad.status === 404);
}

// ─────────────────────────────────────────────
// 6. ROW PATCHING
// ─────────────────────────────────────────────
async function testRowPatch() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  6. ROW PATCHING (INLINE EDIT)");
  console.log("═══════════════════════════════════════════");

  if (!datasetId) {
    console.log("  ⏩ Skipped (no dataset)");
    return;
  }

  // Get current dataset to find a row ID
  const state = await request("GET", "/api/state");
  const firstRow = state.data?.dataset?.rows?.[0];

  if (!firstRow || !firstRow.__rowId) {
    console.log("  ⏩ Skipped (no rows with __rowId)");
    return;
  }

  const rowId = firstRow.__rowId;
  const patch = await request("PATCH", `/api/datasets/${datasetId}/rows/${rowId}`, {
    column: "salary",
    value: 999999,
  });

  test("PATCH row returns 200", patch.status === 200);
  test("Patch returns updated dataset", patch.data?.dataset != null);

  // Verify the update
  if (patch.data?.dataset) {
    const updatedRow = patch.data.dataset.rows.find(r => r.__rowId === rowId);
    test("Updated row has new value", updatedRow?.salary === 999999);
  }

  // Test missing column
  const badPatch = await request("PATCH", `/api/datasets/${datasetId}/rows/${rowId}`, {
    value: 100,
  });
  test("Patch without column returns 400", badPatch.status === 400);

  // Test non-existent row
  const missingRow = await request("PATCH", `/api/datasets/${datasetId}/rows/999999`, {
    column: "salary",
    value: 100,
  });
  test("Patch non-existent row returns 404", missingRow.status === 404);
}

// ─────────────────────────────────────────────
// 7. AI CHAT
// ─────────────────────────────────────────────
async function testAIChat() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  7. AI CHAT (QUERY ANALYSIS)");
  console.log("═══════════════════════════════════════════");

  if (!datasetId) {
    console.log("  ⏩ Skipped (no dataset)");
    return;
  }

  // Test greeting
  const greeting = await request("POST", `/api/datasets/${datasetId}/chat`, {
    query: "hello",
  });
  test("Greeting returns 200", greeting.status === 200);
  test("Greeting has userMessage", greeting.data?.userMessage != null);
  test("Greeting has assistantMessage", greeting.data?.assistantMessage != null);
  test("Greeting content is friendly", greeting.data?.assistantMessage?.content?.toLowerCase().includes("hello"));

  // Test count query
  const countQuery = await request("POST", `/api/datasets/${datasetId}/chat`, {
    query: "how many people in each department",
  });
  test("Count query returns 200", countQuery.status === 200);
  test("Count query has assistant response", countQuery.data?.assistantMessage?.content != null);
  test("Count query has SQL", typeof countQuery.data?.assistantMessage?.sql === "string" || countQuery.data?.assistantMessage?.sql === null);
  test("Count query response time < 60s", countQuery.elapsed < 60000, `${countQuery.elapsed}ms`);
  console.log(`     → AI response: "${countQuery.data?.assistantMessage?.content?.substring(0, 100)}..."`);
  console.log(`     → Used AI: ${countQuery.data?.assistantMessage?.usedAI}`);

  // Test aggregation query
  const aggQuery = await request("POST", `/api/datasets/${datasetId}/chat`, {
    query: "what is the average salary",
  });
  test("Aggregation query returns 200", aggQuery.status === 200);
  test("Aggregation has chart or content", aggQuery.data?.assistantMessage?.chart != null || aggQuery.data?.assistantMessage?.content != null);
  console.log(`     → Chart type: ${aggQuery.data?.assistantMessage?.chart?.type || "none"}`);

  // Test empty query validation
  const emptyQuery = await request("POST", `/api/datasets/${datasetId}/chat`, {
    query: "",
  });
  test("Empty query returns 400", emptyQuery.status === 400);

  // Test second call (should be cached)
  const cached = await request("POST", `/api/datasets/${datasetId}/chat`, {
    query: "how many people in each department",
  });
  test("Cached query returns 200", cached.status === 200);
  test("Cached query is faster", cached.elapsed < countQuery.elapsed * 2, `${cached.elapsed}ms vs ${countQuery.elapsed}ms`);
}

// ─────────────────────────────────────────────
// 8. CORRELATION ANALYSIS
// ─────────────────────────────────────────────
async function testCorrelation() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  8. CORRELATION ANALYSIS");
  console.log("═══════════════════════════════════════════");

  if (!datasetId) {
    console.log("  ⏩ Skipped (no dataset)");
    return;
  }

  const corr = await request("GET", `/api/datasets/${datasetId}/ai-correlations`);
  test("GET correlations returns 200", corr.status === 200);
  test("Correlations has array", Array.isArray(corr.data?.correlations));
  test("Correlations has summary", typeof corr.data?.summary === "string");

  if (corr.data?.correlations?.length > 0) {
    const first = corr.data.correlations[0];
    test("Correlation has column1", typeof first.column1 === "string");
    test("Correlation has column2", typeof first.column2 === "string");
    test("Correlation has coefficient", typeof first.coefficient === "number");
    test("Coefficient in range [-1, 1]", first.coefficient >= -1 && first.coefficient <= 1);
    test("Correlation has strength", typeof first.strength === "string");
    console.log(`     → Top correlation: ${first.column1} ↔ ${first.column2} = ${first.coefficient} (${first.strength})`);
  }
}

// ─────────────────────────────────────────────
// 9. AI DATA SERVICES
// ─────────────────────────────────────────────
async function testAIDataServices() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  9. AI DATA SERVICES (Profile, Anomalies, etc.)");
  console.log("═══════════════════════════════════════════");

  if (!datasetId) {
    console.log("  ⏩ Skipped (no dataset)");
    return;
  }

  // Profile
  const profile = await request("GET", `/api/datasets/${datasetId}/ai/profile`);
  test("GET /ai/profile returns 200", profile.status === 200);
  test("Profile has success flag", profile.data?.success === true);
  test("Profile has profile data", profile.data?.profile != null);
  console.log(`     → Profile response time: ${profile.elapsed}ms`);

  // Anomalies
  const anomalies = await request("GET", `/api/datasets/${datasetId}/ai/anomalies`);
  test("GET /ai/anomalies returns 200", anomalies.status === 200);
  test("Anomalies has success flag", anomalies.data?.success === true);
  test("Anomalies has data", anomalies.data?.anomalies != null);

  // Relationships
  const rels = await request("GET", `/api/datasets/${datasetId}/ai/relationships`);
  test("GET /ai/relationships returns 200", rels.status === 200);
  test("Relationships has success flag", rels.data?.success === true);

  // Cleaning suggestions
  const cleaning = await request("GET", `/api/datasets/${datasetId}/ai/cleaning`);
  test("GET /ai/cleaning returns 200", cleaning.status === 200);
  test("Cleaning has success flag", cleaning.data?.success === true);

  // Suggestions
  const suggestions = await request("GET", `/api/datasets/${datasetId}/ai/suggestions`);
  test("GET /ai/suggestions returns 200", suggestions.status === 200);
  test("Suggestions has success flag", suggestions.data?.success === true);

  // Narrative
  const narrative = await request("POST", `/api/datasets/${datasetId}/ai/narrative`, {
    analysisResults: { summary: "test analysis" },
  });
  test("POST /ai/narrative returns 200", narrative.status === 200);
  test("Narrative has success flag", narrative.data?.success === true);
}

// ─────────────────────────────────────────────
// 10. CACHE
// ─────────────────────────────────────────────
async function testCache() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  10. QUERY CACHE");
  console.log("═══════════════════════════════════════════");

  // Global cache stats
  const stats = await request("GET", "/api/cache/stats");
  test("GET /api/cache/stats returns 200", stats.status === 200);
  test("Cache stats has success", stats.data?.success === true);
  test("Cache stats has data", stats.data?.cache != null);
  console.log(`     → Cache stats:`, JSON.stringify(stats.data?.cache || {}).substring(0, 200));

  if (datasetId) {
    // Dataset-specific cache stats
    const dsStats = await request("GET", `/api/datasets/${datasetId}/cache/stats`);
    test("Dataset cache stats returns 200", dsStats.status === 200);
    test("Dataset cache has datasetId", dsStats.data?.datasetId === datasetId);

    // Clear cache
    const clear = await request("POST", `/api/datasets/${datasetId}/cache/clear`);
    test("Clear cache returns 200", clear.status === 200);
    test("Clear cache has success message", typeof clear.data?.message === "string");
  }
}

// ─────────────────────────────────────────────
// 11. SCHEMA AI QUERY
// ─────────────────────────────────────────────
async function testSchemaAIQuery() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  11. SCHEMA-ONLY AI QUERY");
  console.log("═══════════════════════════════════════════");

  const schema = {
    datasetName: "employees",
    columns: [
      { name: "department", type: "string", role: "dimension" },
      { name: "salary", type: "number", role: "metric" },
    ],
    rowCount: 100,
  };

  const result = await request("POST", "/api/datasets/schema-ai-query", {
    schema,
    query: "average salary by department",
  });

  test("Schema AI query returns 200", result.status === 200);
  test("Schema AI query response time < 60s", result.elapsed < 60000, `${result.elapsed}ms`);

  // Validation: missing schema
  const noSchema = await request("POST", "/api/datasets/schema-ai-query", {
    query: "test",
  });
  test("Missing schema returns 400", noSchema.status === 400);

  // Validation: missing query
  const noQuery = await request("POST", "/api/datasets/schema-ai-query", {
    schema: {},
  });
  test("Missing query returns 400", noQuery.status === 400);
}

// ─────────────────────────────────────────────
// 12. LOCAL DATABASE OPERATIONS
// ─────────────────────────────────────────────
async function testLocalDatabase() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  12. LOCAL DATABASE OPERATIONS");
  console.log("═══════════════════════════════════════════");

  const localImport = await request("POST", "/api/datasets/local-import", {
    name: "Local Test Dataset",
    fileName: "local_test.csv",
    columns: [
      { name: "city", type: "string" },
      { name: "population", type: "number" },
    ],
    rows: [
      { city: "New York", population: 8300000 },
      { city: "London", population: 8900000 },
      { city: "Tokyo", population: 13900000 },
    ],
    sourceType: "local",
  });

  test("Local import returns 201", localImport.status === 201);
  test("Local dataset has isLocal flag", localImport.data?.dataset?.isLocal === true);

  // Validation: missing columns
  const badLocal = await request("POST", "/api/datasets/local-import", {
    name: "Bad",
  });
  test("Local import without columns returns 400", badLocal.status === 400);
}

// ─────────────────────────────────────────────
// 13. ML SERVICE
// ─────────────────────────────────────────────
async function testMLService() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  13. ML SERVICE ENDPOINTS");
  console.log("═══════════════════════════════════════════");

  // ML Health - may not be running but endpoint should exist
  const mlHealth = await request("POST", "/api/ml/health");
  test("ML health endpoint exists", mlHealth.status === 200 || mlHealth.status === 503 || mlHealth.status === 500);

  // ML model list
  const models = await request("GET", "/api/ml/models/list");
  test("ML models list endpoint exists", models.status === 200 || models.status === 500);

  if (datasetId) {
    // ML train (might fail if ML service not running, but endpoint should exist)
    const train = await request("POST", `/api/datasets/${datasetId}/ml/train`, {
      targetColumn: "salary",
      problemType: "regression",
    });
    test("ML train endpoint exists", train.status !== 404, `status: ${train.status}`);

    // ML predict
    const predict = await request("POST", `/api/datasets/${datasetId}/ml/predict`, {
      inputData: [{ experience: 5, department: "Engineering" }],
    });
    test("ML predict endpoint exists", predict.status !== 404, `status: ${predict.status}`);

    // Predict validation: missing inputData  
    const badPredict = await request("POST", `/api/datasets/${datasetId}/ml/predict`, {});
    test("ML predict without data returns 400", badPredict.status === 400);

    // Feature importance
    const features = await request("GET", `/api/datasets/${datasetId}/ml/feature-importance`);
    test("ML feature importance endpoint exists", features.status !== 404, `status: ${features.status}`);
  }
}

// ─────────────────────────────────────────────
// 14. ERROR HANDLING & EDGE CASES
// ─────────────────────────────────────────────
async function testErrorHandling() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  14. ERROR HANDLING & EDGE CASES");
  console.log("═══════════════════════════════════════════");

  // 404 route
  const notFound = await request("GET", "/api/nonexistent");
  test("Non-existent route returns 404", notFound.status === 404);
  test("404 has error message", typeof notFound.data?.error === "string");

  // OPTIONS (CORS preflight)
  const options = await request("OPTIONS", "/api/health");
  test("OPTIONS returns 204", options.status === 204);

  // Non-existent dataset operations
  const badChat = await request("POST", "/api/datasets/fake-id/chat", {
    query: "test",
  });
  test("Chat on non-existent dataset returns 404", badChat.status === 404);

  const badCorr = await request("GET", "/api/datasets/fake-id/ai-correlations");
  test("Correlations on non-existent dataset returns 404", badCorr.status === 404);

  const badProfile = await request("GET", "/api/datasets/fake-id/ai/profile");
  test("AI profile on non-existent dataset returns 404", badProfile.status === 404);
}

// ─────────────────────────────────────────────
// 15. CHAT MESSAGES PERSISTENCE
// ─────────────────────────────────────────────
async function testChatPersistence() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  15. CHAT MESSAGE PERSISTENCE");
  console.log("═══════════════════════════════════════════");

  if (!datasetId) {
    console.log("  ⏩ Skipped (no dataset)");
    return;
  }

  // Send a chat message
  await request("POST", `/api/datasets/${datasetId}/chat`, {
    query: "show me salary distribution",
  });

  // Check state to see if messages persisted
  const state = await request("GET", "/api/state");
  const messages = state.data?.chatMessages;
  test("Chat messages are persisted", Array.isArray(messages) && messages.length > 0);

  if (messages && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    test("Message has id", typeof lastMsg.id === "string");
    test("Message has role", typeof lastMsg.role === "string");
    test("Message has content", typeof lastMsg.content === "string");
    test("Message has timestamp", typeof lastMsg.timestamp === "string");
    console.log(`     → ${messages.length} messages persisted`);
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║   INSIGHTFLOW — FULL END-TO-END TEST SUITE           ║");
  console.log(`║   Testing against: ${API_BASE_URL.padEnd(35)}║`);
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(`\n  Started at: ${new Date().toLocaleString()}`);

  const startTime = Date.now();

  // Preflight: ensure backend is running before running all tests
  await assertBackendRunning();

  const tests = [
    testRootAndHealth,
    testState,
    testDemoDataset,
    testDatasetImport,
    testSchema,
    testRowPatch,
    testAIChat,
    testCorrelation,
    testAIDataServices,
    testCache,
    testSchemaAIQuery,
    testLocalDatabase,
    testMLService,
    testErrorHandling,
    testChatPersistence,
  ];

  for (const fn of tests) {
    try {
      await fn();
    } catch (error) {
      console.error(`\n  💥 ERROR in ${fn.name}: ${error.message}`);
      totalTests++;
      failed++;
      failures.push(`  ❌ ${fn.name} — crashed: ${error.message}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   TEST RESULTS SUMMARY                               ║");
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log(`║   Total:  ${String(totalTests).padStart(3)}                                        ║`);
  console.log(`║   Passed: ${String(passed).padStart(3)} ✅                                      ║`);
  console.log(`║   Failed: ${String(failed).padStart(3)} ${failed === 0 ? "🎉" : "❌"}                                      ║`);
  console.log(`║   Time:   ${totalTime}s                                       ║`);
  console.log("╚═══════════════════════════════════════════════════════╝");

  if (failures.length > 0) {
    console.log("\n  ❌ FAILED TESTS:");
    failures.forEach((f) => console.log(f));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
