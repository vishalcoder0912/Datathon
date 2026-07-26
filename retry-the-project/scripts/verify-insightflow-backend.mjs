#!/usr/bin/env node

/**
 * InsightFlow Backend Verification Test
 *
 * Run:
 *   node scripts/verify-insightflow-backend.mjs
 *
 * Optional:
 *   BACKEND_URL=http://127.0.0.1:3001 node scripts/verify-insightflow-backend.mjs
 */

import os from "node:os";
import { execSync } from "node:child_process";

const BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:3001";

const results = [];
let importedDatasetId = null;

function nowMs() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function safeJsonString(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getNodeVersion() {
  try {
    return execSync("node --version", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getNpmVersion() {
  try {
    return execSync("npm --version", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function request(method, path, body = undefined) {
  const url = `${BASE_URL}${path}`;
  const started = nowMs();

  const options = {
    method,
    headers: {
      Accept: "application/json",
    },
  };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  let text = "";
  let json = null;

  try {
    response = await fetch(url, options);
    text = await response.text();

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text,
      json,
      ms: nowMs() - started,
      url,
      method,
      path,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      text: "",
      json: null,
      ms: nowMs() - started,
      url,
      method,
      path,
      error: error.message,
    };
  }
}

function pass(name, meta = {}) {
  results.push({
    status: "PASS",
    name,
    ...meta,
  });

  console.log(`✅ ${name}`);
}

function fail(name, meta = {}) {
  results.push({
    status: "FAIL",
    name,
    ...meta,
  });

  console.log(`❌ ${name}`);

  if (meta.route) console.log(`   Route: ${meta.route}`);
  if (meta.expected) console.log(`   Expected: ${meta.expected}`);
  if (meta.actual !== undefined) console.log(`   Actual: ${safeJsonString(meta.actual).slice(0, 900)}`);
  if (meta.suggestion) console.log(`   Fix: ${meta.suggestion}`);
}

function assertCheck(condition, name, meta = {}) {
  if (condition) {
    pass(name, meta);
  } else {
    fail(name, meta);
  }
}

function hasJson(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") || response.json !== null;
}

function hasErrorMessage(json) {
  return Boolean(json && (json.error || json.message));
}

function getCacheObject(json) {
  if (!json || typeof json !== "object") return null;

  if (json.cache && typeof json.cache === "object") return json.cache;
  if (json.data && typeof json.data === "object") return json.data;
  if (json.stats && typeof json.stats === "object") return json.stats;

  return null;
}

function validateCacheObject(cache) {
  return Boolean(
    cache &&
      Object.prototype.hasOwnProperty.call(cache, "totalCached") &&
      Object.prototype.hasOwnProperty.call(cache, "totalHits") &&
      Object.prototype.hasOwnProperty.call(cache, "hitRate") &&
      Object.prototype.hasOwnProperty.call(cache, "savedAPICalls") &&
      Object.prototype.hasOwnProperty.call(cache, "estimatedCostSaved")
  );
}

async function section(title) {
  console.log("");
  console.log("═".repeat(60));
  console.log(title);
  console.log("═".repeat(60));
}

async function testRootAndHealth() {
  await section("1. ROOT INDEX & HEALTH CHECK");

  const root = await request("GET", "/");
  assertCheck(root.status === 200, "GET / returns 200", {
    route: "GET /",
    expected: "200",
    actual: root.status,
  });

  assertCheck(hasJson(root), "Root returns JSON", {
    route: "GET /",
    expected: "application/json response",
    actual: root.text,
  });

  assertCheck(Boolean(root.json?.name), "Root has name field", {
    route: "GET /",
    expected: "body.name exists",
    actual: root.json,
  });

  const health = await request("GET", "/api/health");

  assertCheck(health.status === 200, "GET /api/health returns 200", {
    route: "GET /api/health",
    expected: "200",
    actual: health.status,
  });

  assertCheck(hasJson(health), "Health returns JSON", {
    route: "GET /api/health",
    expected: "application/json response",
    actual: health.text,
  });

  const status = String(health.json?.status || health.json?.health || "").toLowerCase();

  assertCheck(
    status.includes("healthy") || status.includes("ok") || status.includes("ready"),
    "Health status is healthy/ok",
    {
      route: "GET /api/health",
      expected: "status healthy/ok/ready",
      actual: health.json,
    }
  );
}

async function testDemoDataset() {
  await section("2. DEMO DATASET LOADING");

  const demo = await request("POST", "/api/datasets/demo");

  assertCheck(demo.status === 201, "POST /api/datasets/demo returns 201", {
    route: "POST /api/datasets/demo",
    expected: "201",
    actual: demo.status,
  });

  assertCheck(Boolean(demo.json?.dataset), "Demo returns dataset", {
    route: "POST /api/datasets/demo",
    expected: "body.dataset exists",
    actual: demo.json,
  });

  assertCheck(Boolean(demo.json?.dataset?.id), "Demo dataset has id", {
    route: "POST /api/datasets/demo",
    expected: "body.dataset.id exists",
    actual: demo.json?.dataset,
  });

  assertCheck(Array.isArray(demo.json?.dataset?.rows), "Demo dataset has rows", {
    route: "POST /api/datasets/demo",
    expected: "dataset.rows array",
    actual: demo.json?.dataset,
  });

  assertCheck(Array.isArray(demo.json?.dataset?.columns), "Demo dataset has columns", {
    route: "POST /api/datasets/demo",
    expected: "dataset.columns array",
    actual: demo.json?.dataset,
  });

  assertCheck(Array.isArray(demo.json?.chatMessages), "Demo has chatMessages array", {
    route: "POST /api/datasets/demo",
    expected: "body.chatMessages array",
    actual: demo.json,
  });
}

async function testImportDataset() {
  await section("3. DATASET IMPORT");

  const payload = {
    name: "QA Salary Dataset",
    columns: [
      { name: "name", type: "string", role: "dimension" },
      { name: "department", type: "string", role: "dimension" },
      { name: "salary", type: "number", role: "metric" },
      { name: "experience", type: "number", role: "metric" },
    ],
    rows: [
      { name: "A", department: "Engineering", salary: 50000, experience: 2 },
      { name: "B", department: "Sales", salary: 60000, experience: 3 },
      { name: "C", department: "Engineering", salary: 70000, experience: 5 },
    ],
  };

  const imported = await request("POST", "/api/datasets/import", payload);

  assertCheck(imported.status === 201, "POST /api/datasets/import returns 201", {
    route: "POST /api/datasets/import",
    expected: "201",
    actual: imported.status,
  });

  assertCheck(Boolean(imported.json?.dataset?.id), "Import returns dataset id", {
    route: "POST /api/datasets/import",
    expected: "body.dataset.id exists",
    actual: imported.json,
  });

  assertCheck(imported.json?.dataset?.name === "QA Salary Dataset", "Import dataset has correct name", {
    route: "POST /api/datasets/import",
    expected: "dataset.name === QA Salary Dataset",
    actual: imported.json?.dataset?.name,
  });

  assertCheck(imported.json?.dataset?.rows?.length === 3, "Import preserves row count", {
    route: "POST /api/datasets/import",
    expected: "dataset.rows.length === 3",
    actual: imported.json?.dataset?.rows?.length,
  });

  assertCheck(imported.json?.dataset?.columns?.length === 4, "Import preserves column count", {
    route: "POST /api/datasets/import",
    expected: "dataset.columns.length === 4",
    actual: imported.json?.dataset?.columns?.length,
  });

  assertCheck(Array.isArray(imported.json?.chatMessages), "Import returns chatMessages array", {
    route: "POST /api/datasets/import",
    expected: "body.chatMessages is array",
    actual: imported.json,
  });

  importedDatasetId = imported.json?.dataset?.id;

  const emptyImport = await request("POST", "/api/datasets/import", {
    name: "Empty Dataset",
    columns: [],
    rows: [],
  });

  assertCheck(emptyImport.status === 400, "Empty import returns 400", {
    route: "POST /api/datasets/import",
    expected: "400",
    actual: emptyImport.status,
  });

  assertCheck(hasErrorMessage(emptyImport.json), "Empty import has error message", {
    route: "POST /api/datasets/import",
    expected: "JSON error/message",
    actual: emptyImport.json,
  });
}

async function testSchema() {
  await section("4. DATASET SCHEMA");

  const schema = await request("GET", `/api/datasets/${importedDatasetId}/schema`);

  assertCheck(schema.status === 200, "GET schema returns 200", {
    route: `GET /api/datasets/${importedDatasetId}/schema`,
    expected: "200",
    actual: schema.status,
  });

  assertCheck(Boolean(schema.json?.schema), "Schema has schema field", {
    route: `GET /api/datasets/${importedDatasetId}/schema`,
    expected: "body.schema exists",
    actual: schema.json,
  });

  assertCheck(schema.json?.schema?.rowCount === 3, "Schema has correct rowCount", {
    route: `GET /api/datasets/${importedDatasetId}/schema`,
    expected: "rowCount === 3",
    actual: schema.json?.schema?.rowCount,
  });

  assertCheck(schema.json?.schema?.columnCount === 4, "Schema has correct columnCount", {
    route: `GET /api/datasets/${importedDatasetId}/schema`,
    expected: "columnCount === 4",
    actual: schema.json?.schema?.columnCount,
  });

  const columns = schema.json?.schema?.columns || [];
  const columnsValid =
    Array.isArray(columns) &&
    columns.length > 0 &&
    columns.every((column) => column.name && column.type && column.role);

  assertCheck(columnsValid, "Every schema column has name/type/role", {
    route: `GET /api/datasets/${importedDatasetId}/schema`,
    expected: "all columns contain name, type, role",
    actual: columns,
  });

  const fake = await request("GET", "/api/datasets/fake-id/schema");

  assertCheck(fake.status === 404, "Non-existent dataset schema returns 404", {
    route: "GET /api/datasets/fake-id/schema",
    expected: "404",
    actual: fake.status,
  });
}

async function testRowPatch() {
  await section("5. ROW PATCHING");

  const patch = await request("PATCH", `/api/datasets/${importedDatasetId}/rows/1`, {
    column: "salary",
    value: 99999,
  });

  assertCheck(patch.status === 200, "PATCH row returns 200", {
    route: `PATCH /api/datasets/${importedDatasetId}/rows/1`,
    expected: "200",
    actual: patch.status,
  });

  const updatedRow = patch.json?.dataset?.rows?.find((row) => Number(row.__rowId) === 1);

  assertCheck(updatedRow?.salary === 99999, "Updated row has new value", {
    route: `PATCH /api/datasets/${importedDatasetId}/rows/1`,
    expected: "row.salary === 99999",
    actual: updatedRow,
  });

  const missingColumn = await request("PATCH", `/api/datasets/${importedDatasetId}/rows/1`, {
    value: 123,
  });

  assertCheck(missingColumn.status === 400, "Patch without column returns 400", {
    route: `PATCH /api/datasets/${importedDatasetId}/rows/1`,
    expected: "400",
    actual: missingColumn.status,
  });

  const missingRow = await request("PATCH", `/api/datasets/${importedDatasetId}/rows/9999`, {
    column: "salary",
    value: 123,
  });

  assertCheck(missingRow.status === 404, "Patch non-existent row returns 404", {
    route: `PATCH /api/datasets/${importedDatasetId}/rows/9999`,
    expected: "404",
    actual: missingRow.status,
  });
}

async function testChatAndPersistence() {
  await section("6. CHAT AND CHAT PERSISTENCE");

  const hello = await request("POST", `/api/datasets/${importedDatasetId}/chat`, {
    query: "hello",
  });

  assertCheck(hello.status === 200, "Greeting returns 200", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "200",
    actual: hello.status,
  });

  assertCheck(hello.json?.userMessage?.role === "user", "Greeting has userMessage", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "userMessage.role === user",
    actual: hello.json,
  });

  assertCheck(hello.json?.assistantMessage?.role === "assistant", "Greeting has assistantMessage", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "assistantMessage.role === assistant",
    actual: hello.json,
  });

  assertCheck(Boolean(hello.json?.assistantMessage?.content), "Assistant content is non-empty", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "assistantMessage.content exists",
    actual: hello.json?.assistantMessage,
  });

  const state = await request("GET", "/api/state");

  assertCheck(state.status === 200, "GET /api/state after chat returns 200", {
    route: "GET /api/state",
    expected: "200",
    actual: state.status,
  });

  assertCheck(Array.isArray(state.json?.chatMessages), "State has chatMessages array", {
    route: "GET /api/state",
    expected: "chatMessages array",
    actual: state.json,
  });

  assertCheck(state.json?.chatMessages?.length > 0, "Chat messages are persisted", {
    route: "GET /api/state",
    expected: "chatMessages.length > 0 after chat",
    actual: state.json,
    suggestion:
      "In chat route, save messages to store.chatMessages and set store.lastChatDatasetId/currentDatasetId to the chatted dataset id.",
  });

  const hasUser = state.json?.chatMessages?.some((message) => message.role === "user");
  const hasAssistant = state.json?.chatMessages?.some((message) => message.role === "assistant");

  assertCheck(Boolean(hasUser), "Persisted messages include user message", {
    route: "GET /api/state",
    expected: "at least one user message",
    actual: state.json?.chatMessages,
  });

  assertCheck(Boolean(hasAssistant), "Persisted messages include assistant message", {
    route: "GET /api/state",
    expected: "at least one assistant message",
    actual: state.json?.chatMessages,
  });

  const empty = await request("POST", `/api/datasets/${importedDatasetId}/chat`, {
    query: "",
  });

  assertCheck(empty.status === 400, "Empty query returns 400", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "400",
    actual: empty.status,
  });
}

async function testCache() {
  await section("7. CACHE ROUTES");

  const first = await request("POST", `/api/datasets/${importedDatasetId}/chat`, {
    query: "count by department",
  });

  const second = await request("POST", `/api/datasets/${importedDatasetId}/chat`, {
    query: "count by department",
  });

  assertCheck(first.status === 200, "First cacheable query returns 200", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "200",
    actual: first.status,
  });

  assertCheck(second.status === 200, "Repeated cacheable query returns 200", {
    route: `POST /api/datasets/${importedDatasetId}/chat`,
    expected: "200",
    actual: second.status,
  });

  const globalStats = await request("GET", "/api/cache/stats");
  const globalCache = getCacheObject(globalStats.json);

  assertCheck(globalStats.status === 200, "GET /api/cache/stats returns 200", {
    route: "GET /api/cache/stats",
    expected: "200",
    actual: globalStats.status,
  });

  assertCheck(globalStats.json?.success === true, "Cache stats has success true", {
    route: "GET /api/cache/stats",
    expected: "success === true",
    actual: globalStats.json,
  });

  assertCheck(validateCacheObject(globalCache), "Cache stats has data object", {
    route: "GET /api/cache/stats",
    expected:
      "body.cache or body.data or body.stats with totalCached,totalHits,hitRate,savedAPICalls,estimatedCostSaved",
    actual: globalStats.json,
    suggestion:
      "Return { success: true, cache, data: cache, stats: cache } from /api/cache/stats.",
  });

  const datasetStats = await request("GET", `/api/datasets/${importedDatasetId}/cache/stats`);
  const datasetCache = getCacheObject(datasetStats.json);

  assertCheck(datasetStats.status === 200, "Dataset cache stats returns 200", {
    route: `GET /api/datasets/${importedDatasetId}/cache/stats`,
    expected: "200",
    actual: datasetStats.status,
    suggestion:
      "Add GET /api/datasets/:datasetId/cache/stats before final route fallback.",
  });

  assertCheck(datasetStats.json?.datasetId === importedDatasetId, "Dataset cache has datasetId", {
    route: `GET /api/datasets/${importedDatasetId}/cache/stats`,
    expected: `datasetId === ${importedDatasetId}`,
    actual: datasetStats.json,
  });

  assertCheck(validateCacheObject(datasetCache), "Dataset cache has cache object", {
    route: `GET /api/datasets/${importedDatasetId}/cache/stats`,
    expected: "cache/data/stats object with cache fields",
    actual: datasetStats.json,
  });

  const clear = await request("POST", `/api/datasets/${importedDatasetId}/cache/clear`);

  assertCheck(clear.status === 200, "Clear cache returns 200", {
    route: `POST /api/datasets/${importedDatasetId}/cache/clear`,
    expected: "200",
    actual: clear.status,
    suggestion:
      "Add POST /api/datasets/:datasetId/cache/clear that clears keys prefixed with datasetId.",
  });

  assertCheck(clear.json?.success === true, "Clear cache has success true", {
    route: `POST /api/datasets/${importedDatasetId}/cache/clear`,
    expected: "success === true",
    actual: clear.json,
  });

  assertCheck(Boolean(clear.json?.message), "Clear cache has success message", {
    route: `POST /api/datasets/${importedDatasetId}/cache/clear`,
    expected: "body.message exists",
    actual: clear.json,
  });
}

async function testSchemaOnlyAiQuery() {
  await section("8. SCHEMA-ONLY AI QUERY");

  const valid = await request("POST", "/api/datasets/schema-ai-query", {
    schema: {
      columns: [
        { name: "department", type: "string", role: "dimension" },
        { name: "salary", type: "number", role: "metric" },
      ],
      rowCount: 3,
      columnCount: 2,
    },
    query: "average salary by department",
  });

  assertCheck(valid.status === 200, "Schema AI query returns 200", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "200",
    actual: valid.status,
  });

  assertCheck(valid.json?.success === true, "Schema AI query has success true", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "success === true",
    actual: valid.json,
  });

  assertCheck(Boolean(valid.json?.sql), "Schema AI query has SQL", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "body.sql exists",
    actual: valid.json,
  });

  assertCheck(Boolean(valid.json?.insight), "Schema AI query has insight", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "body.insight exists",
    actual: valid.json,
  });

  assertCheck(Boolean(valid.json?.explanation), "Schema AI query has explanation", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "body.explanation exists",
    actual: valid.json,
  });

  const responseText = safeJsonString(valid.json);

  assertCheck(!responseText.includes('"rows"'), "Schema AI response does not include raw rows", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "response must not contain rows",
    actual: valid.json,
  });

  const missingSchema = await request("POST", "/api/datasets/schema-ai-query", {
    query: "average salary by department",
  });

  assertCheck(missingSchema.status === 400, "Missing schema returns 400", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "400",
    actual: missingSchema.status,
  });

  assertCheck(hasErrorMessage(missingSchema.json), "Missing schema has JSON error", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "JSON error/message",
    actual: missingSchema.json,
  });

  const missingQuery = await request("POST", "/api/datasets/schema-ai-query", {
    schema: { columns: [] },
  });

  assertCheck(missingQuery.status === 400, "Missing query returns 400", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "400",
    actual: missingQuery.status,
  });

  assertCheck(hasErrorMessage(missingQuery.json), "Missing query has JSON error", {
    route: "POST /api/datasets/schema-ai-query",
    expected: "JSON error/message",
    actual: missingQuery.json,
  });
}

async function testMlRoutes() {
  await section("9. ML COMPATIBILITY ENDPOINTS");

  const health = await request("GET", "/api/ml/health");

  assertCheck(health.status === 200, "ML health endpoint exists", {
    route: "GET /api/ml/health",
    expected: "200",
    actual: health.status,
  });

  assertCheck(health.json?.success === true && Boolean(health.json?.status), "ML health has success/status", {
    route: "GET /api/ml/health",
    expected: "success true and status exists",
    actual: health.json,
  });

  const models = await request("GET", "/api/ml/models/list");

  assertCheck(models.status === 200, "ML models list endpoint exists", {
    route: "GET /api/ml/models/list",
    expected: "200",
    actual: models.status,
  });

  assertCheck(models.json?.success === true && Array.isArray(models.json?.models), "ML models list has models array", {
    route: "GET /api/ml/models/list",
    expected: "success true and models array",
    actual: models.json,
  });

  const train = await request("POST", `/api/datasets/${importedDatasetId}/ml/train`, {
    targetColumn: "salary",
    problemType: "regression",
  });

  assertCheck(train.status === 200, "ML train endpoint exists", {
    route: `POST /api/datasets/${importedDatasetId}/ml/train`,
    expected: "200",
    actual: train.status,
    suggestion:
      "Add POST /api/datasets/:datasetId/ml/train and return {success:true,datasetId,model/modelId}.",
  });

  assertCheck(train.json?.success === true, "ML train has success true", {
    route: `POST /api/datasets/${importedDatasetId}/ml/train`,
    expected: "success === true",
    actual: train.json,
  });

  assertCheck(Boolean(train.json?.model || train.json?.modelId), "ML train returns model or modelId", {
    route: `POST /api/datasets/${importedDatasetId}/ml/train`,
    expected: "body.model or body.modelId exists",
    actual: train.json,
  });

  assertCheck(train.json?.datasetId === importedDatasetId, "ML train returns datasetId", {
    route: `POST /api/datasets/${importedDatasetId}/ml/train`,
    expected: `datasetId === ${importedDatasetId}`,
    actual: train.json,
  });

  const predict = await request("POST", `/api/datasets/${importedDatasetId}/ml/predict`, {
    inputData: {
      department: "Engineering",
      experience: 4,
    },
  });

  assertCheck(predict.status === 200, "ML predict endpoint exists", {
    route: `POST /api/datasets/${importedDatasetId}/ml/predict`,
    expected: "200",
    actual: predict.status,
    suggestion:
      "Add POST /api/datasets/:datasetId/ml/predict and return {success:true,predictions/prediction}.",
  });

  assertCheck(predict.json?.success === true, "ML predict has success true", {
    route: `POST /api/datasets/${importedDatasetId}/ml/predict`,
    expected: "success === true",
    actual: predict.json,
  });

  assertCheck(Boolean(predict.json?.predictions || predict.json?.prediction !== undefined), "ML predict returns prediction", {
    route: `POST /api/datasets/${importedDatasetId}/ml/predict`,
    expected: "body.predictions or body.prediction exists",
    actual: predict.json,
  });

  const badPredict = await request("POST", `/api/datasets/${importedDatasetId}/ml/predict`, {});

  assertCheck(badPredict.status === 400, "ML predict without data returns 400", {
    route: `POST /api/datasets/${importedDatasetId}/ml/predict`,
    expected: "400",
    actual: badPredict.status,
  });

  assertCheck(hasErrorMessage(badPredict.json), "ML predict without data has JSON error", {
    route: `POST /api/datasets/${importedDatasetId}/ml/predict`,
    expected: "JSON error/message",
    actual: badPredict.json,
  });

  const importance = await request("GET", `/api/datasets/${importedDatasetId}/ml/feature-importance`);

  assertCheck(importance.status === 200, "ML feature importance endpoint exists", {
    route: `GET /api/datasets/${importedDatasetId}/ml/feature-importance`,
    expected: "200",
    actual: importance.status,
    suggestion:
      "Add GET /api/datasets/:datasetId/ml/feature-importance and return {success:true,featureImportance/features}.",
  });

  assertCheck(importance.json?.success === true, "ML feature importance has success true", {
    route: `GET /api/datasets/${importedDatasetId}/ml/feature-importance`,
    expected: "success === true",
    actual: importance.json,
  });

  assertCheck(Boolean(importance.json?.featureImportance || importance.json?.features), "ML feature importance returns data", {
    route: `GET /api/datasets/${importedDatasetId}/ml/feature-importance`,
    expected: "body.featureImportance or body.features exists",
    actual: importance.json,
  });
}

async function testAiServices() {
  await section("10. AI DATA SERVICES");

  const profile = await request("GET", `/api/datasets/${importedDatasetId}/ai/profile`);
  assertCheck(profile.status === 200 && profile.json?.success === true && profile.json?.profile, "AI profile works", {
    route: `GET /api/datasets/${importedDatasetId}/ai/profile`,
    expected: "200 success profile",
    actual: profile.json,
  });

  const anomalies = await request("GET", `/api/datasets/${importedDatasetId}/ai/anomalies`);
  assertCheck(anomalies.status === 200 && anomalies.json?.success === true, "AI anomalies works", {
    route: `GET /api/datasets/${importedDatasetId}/ai/anomalies`,
    expected: "200 success",
    actual: anomalies.json,
  });

  const relationships = await request("GET", `/api/datasets/${importedDatasetId}/ai/relationships`);
  assertCheck(relationships.status === 200 && relationships.json?.success === true, "AI relationships works", {
    route: `GET /api/datasets/${importedDatasetId}/ai/relationships`,
    expected: "200 success",
    actual: relationships.json,
  });

  const cleaning = await request("GET", `/api/datasets/${importedDatasetId}/ai/cleaning`);
  assertCheck(cleaning.status === 200 && cleaning.json?.success === true, "AI cleaning works", {
    route: `GET /api/datasets/${importedDatasetId}/ai/cleaning`,
    expected: "200 success",
    actual: cleaning.json,
  });

  const suggestions = await request("GET", `/api/datasets/${importedDatasetId}/ai/suggestions`);
  assertCheck(suggestions.status === 200 && suggestions.json?.success === true, "AI suggestions works", {
    route: `GET /api/datasets/${importedDatasetId}/ai/suggestions`,
    expected: "200 success",
    actual: suggestions.json,
  });

  const narrative = await request("POST", `/api/datasets/${importedDatasetId}/ai/narrative`, {
    style: "executive",
  });

  assertCheck(narrative.status === 200 && narrative.json?.success === true, "AI narrative works", {
    route: `POST /api/datasets/${importedDatasetId}/ai/narrative`,
    expected: "200 success",
    actual: narrative.json,
  });
}

async function testErrorHandling() {
  await section("11. ERROR HANDLING & OPTIONS");

  const notFound = await request("GET", "/api/nonexistent");

  assertCheck(notFound.status === 404, "Non-existent route returns 404", {
    route: "GET /api/nonexistent",
    expected: "404",
    actual: notFound.status,
  });

  assertCheck(hasErrorMessage(notFound.json), "404 has JSON error message", {
    route: "GET /api/nonexistent",
    expected: "JSON error/message",
    actual: notFound.text,
  });

  const options = await request("OPTIONS", "/api/health");

  assertCheck(options.status === 204, "OPTIONS returns 204", {
    route: "OPTIONS /api/health",
    expected: "204",
    actual: options.status,
  });

  const allowOrigin = options.headers.get("access-control-allow-origin");
  const allowMethods = options.headers.get("access-control-allow-methods");

  assertCheck(Boolean(allowOrigin), "OPTIONS has CORS origin header", {
    route: "OPTIONS /api/health",
    expected: "Access-Control-Allow-Origin exists",
    actual: Object.fromEntries(options.headers.entries()),
  });

  assertCheck(Boolean(allowMethods), "OPTIONS has CORS methods header", {
    route: "OPTIONS /api/health",
    expected: "Access-Control-Allow-Methods exists",
    actual: Object.fromEntries(options.headers.entries()),
  });

  const fakeChat = await request("POST", "/api/datasets/fake-id/chat", {
    query: "hello",
  });

  assertCheck(fakeChat.status === 404, "Chat on non-existent dataset returns 404", {
    route: "POST /api/datasets/fake-id/chat",
    expected: "404",
    actual: fakeChat.status,
  });

  const fakeCorr = await request("GET", "/api/datasets/fake-id/ai-correlations");

  assertCheck(fakeCorr.status === 404, "Correlations on non-existent dataset returns 404", {
    route: "GET /api/datasets/fake-id/ai-correlations",
    expected: "404",
    actual: fakeCorr.status,
  });

  const fakeProfile = await request("GET", "/api/datasets/fake-id/ai/profile");

  assertCheck(fakeProfile.status === 404, "AI profile on non-existent dataset returns 404", {
    route: "GET /api/datasets/fake-id/ai/profile",
    expected: "404",
    actual: fakeProfile.status,
  });
}

function printFinalReport() {
  const passed = results.filter((item) => item.status === "PASS").length;
  const failed = results.filter((item) => item.status === "FAIL").length;

  console.log("");
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║          INSIGHTFLOW FINAL TEST REPORT               ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Environment:");
  console.log(`- Node: ${getNodeVersion()}`);
  console.log(`- npm: ${getNpmVersion()}`);
  console.log(`- OS: ${os.platform()} ${os.release()}`);
  console.log(`- Backend URL: ${BASE_URL}`);
  console.log("");
  console.log("Automated API Test Summary:");
  console.log(`- Passed: ${passed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Total: ${passed + failed}`);
  console.log("");
  console.log("Critical API Verification:");
  console.log(`- Demo/import dataset: ${statusFor(["Demo returns dataset", "Import returns dataset id"])}`);
  console.log(`- Schema: ${statusFor(["GET schema returns 200"])}`);
  console.log(`- Chat: ${statusFor(["Greeting returns 200"])}`);
  console.log(`- Chat persistence: ${statusFor(["Chat messages are persisted"])}`);
  console.log(`- Cache global stats: ${statusFor(["Cache stats has data object"])}`);
  console.log(`- Dataset cache stats: ${statusFor(["Dataset cache stats returns 200", "Dataset cache has datasetId"])}`);
  console.log(`- Cache clear: ${statusFor(["Clear cache returns 200"])}`);
  console.log(`- Schema-only AI: ${statusFor(["Schema AI query returns 200"])}`);
  console.log(`- ML health: ${statusFor(["ML health endpoint exists"])}`);
  console.log(`- ML train: ${statusFor(["ML train endpoint exists"])}`);
  console.log(`- ML predict: ${statusFor(["ML predict endpoint exists", "ML predict without data returns 400"])}`);
  console.log(`- ML feature importance: ${statusFor(["ML feature importance endpoint exists"])}`);
  console.log(`- Error handling: ${statusFor(["Non-existent route returns 404", "404 has JSON error message"])}`);
  console.log(`- OPTIONS/CORS: ${statusFor(["OPTIONS returns 204", "OPTIONS has CORS origin header"])}`);
  console.log("");
  console.log(`Final Status: ${failed === 0 ? "PASS ✅" : "FAIL ❌"}`);

  if (failed > 0) {
    console.log("");
    console.log("Failed Tests:");
    for (const item of results.filter((result) => result.status === "FAIL")) {
      console.log(`\n- ${item.name}`);
      if (item.route) console.log(`  Route: ${item.route}`);
      if (item.expected) console.log(`  Expected: ${item.expected}`);
      if (item.actual !== undefined) console.log(`  Actual: ${safeJsonString(item.actual).slice(0, 700)}`);
      if (item.suggestion) console.log(`  Minimal patch needed: ${item.suggestion}`);
    }
  }

  process.exitCode = failed === 0 ? 0 : 1;
}

function statusFor(names) {
  const relevant = results.filter((item) => names.includes(item.name));
  if (!relevant.length) return "NOT RUN";
  return relevant.every((item) => item.status === "PASS") ? "PASS" : "FAIL";
}

async function main() {
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║        INSIGHTFLOW BACKEND VERIFICATION TEST         ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(`Testing against: ${BASE_URL}`);

  await testRootAndHealth();
  await testDemoDataset();
  await testImportDataset();

  if (!importedDatasetId) {
    fail("Cannot continue because imported dataset id is missing", {
      route: "POST /api/datasets/import",
      expected: "dataset.id",
      actual: importedDatasetId,
      suggestion: "Fix import route to return top-level { dataset, chatMessages }.",
    });

    printFinalReport();
    return;
  }

  await testSchema();
  await testRowPatch();
  await testChatAndPersistence();
  await testCache();
  await testSchemaOnlyAiQuery();
  await testMlRoutes();
  await testAiServices();
  await testErrorHandling();

  printFinalReport();
}

main().catch((error) => {
  console.error("");
  console.error("Fatal test runner error:");
  console.error(error);
  process.exitCode = 1;
});
