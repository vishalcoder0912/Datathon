#!/usr/bin/env node

/**
 * Agentic AI Analytics Salary Stress Audit
 *
 * Evidence-only harness for the real salary CSV files. It exercises public
 * backend APIs and writes PASS/FAIL reports without adding missing features.
 *
 * Run:
 *   node scripts/agentic-salary-stress-audit.mjs
 *
 * Optional:
 *   BACKEND_URL=http://127.0.0.1:3001 node scripts/agentic-salary-stress-audit.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Papa from "papaparse";

const ROOT = process.cwd();
const BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:3001";
const REPORT_JSON = path.join(ROOT, "reports", "agentic-salary-stress-audit.json");
const REPORT_MD = path.join(ROOT, "reports", "agentic-salary-stress-audit.md");

const CSV_PATHS = {
  train:
    process.env.SALARY_TRAIN_CSV ||
    "c:\\Users\\VISHAL\\OneDrive\\Documents\\Downloads\\SD_salary\\train.csv",
  test:
    process.env.SALARY_TEST_CSV ||
    "c:\\Users\\VISHAL\\OneDrive\\Documents\\Downloads\\SD_salary\\test.csv",
  dictionary:
    process.env.SALARY_DICTIONARY_CSV ||
    "c:\\Users\\VISHAL\\OneDrive\\Documents\\Downloads\\SD_salary\\data_dictionary.csv",
};

const EXPECTED_AGENT_STEPS = [
  "schema_analysis",
  "master_planning",
  "analytics_engine",
  "dashboard_guardian",
  "final_explanation",
];

const phases = [];
const endpointEvidence = [];
const generatedFiles = [];
const datasets = {};
let parsedFiles = {};
let deterministic = {};
let schemaDashboard = null;

function nowIso() {
  return new Date().toISOString();
}

function durationMs(started) {
  return Number(process.hrtime.bigint() / 1_000_000n) - started;
}

function startTimer() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function normalizeName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^[\ufeff\s]+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(/[,$₹€£%\s]/g, "")
    .trim();
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length) {
    throw new Error(
      `Failed to parse ${filePath}: ${parsed.errors
        .slice(0, 3)
        .map((error) => error.message)
        .join("; ")}`
    );
  }

  return parsed.data.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), value]))
  );
}

function dictionaryMap(rows) {
  return new Map(
    rows.map((row) => [
      normalizeName(row.Column || row.column || row.name),
      {
        type: row.Type || row.type || "",
        description: row.Description || row.description || "",
      },
    ])
  );
}

function inferType(values = [], explicitType = "") {
  const explicit = normalizeName(explicitType);
  if (explicit === "number" || explicit === "numeric" || explicit === "target") return "number";
  if (explicit === "date" || explicit === "datetime") return "date";
  if (explicit === "string" || explicit === "text" || explicit === "category") return "string";

  const present = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (!present.length) return "string";

  const sample = present.slice(0, 500);
  const numeric = sample.filter((value) => safeNumber(value) !== null).length / sample.length;
  const date = sample.filter((value) => Number.isFinite(Date.parse(String(value)))).length / sample.length;

  if (numeric >= 0.8) return "number";
  if (date >= 0.8) return "date";
  return "string";
}

function inferColumns(rows, dict = new Map()) {
  const names = Object.keys(rows[0] || {});
  return names.map((name) => {
    const info = dict.get(normalizeName(name)) || {};
    const values = rows.map((row) => row[name]);
    const type = inferType(values, info.type);

    return {
      name,
      type,
      inferredType: type,
      role: normalizeName(info.type) === "target" ? "target" : type === "number" ? "metric" : type === "date" ? "date" : "dimension",
      description: info.description || "",
      sample: values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "").slice(0, 5),
    };
  });
}

function datasetPayload({ name, fileName, rows, dictRows = [] }) {
  const dict = dictionaryMap(dictRows);
  return {
    name,
    fileName,
    sourceType: "stress-audit",
    columns: inferColumns(rows, dict),
    rows,
    dictionaryRows: dictRows,
  };
}

function summarizeJson(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    if (depth > 1) return { type: "array", length: value.length };
    return {
      type: "array",
      length: value.length,
      sample: value.slice(0, 3).map((item) => summarizeJson(item, depth + 1)),
    };
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      if (["rows", "data", "rawRows", "sampleRows"].includes(key) && Array.isArray(item)) {
        output[key] = { type: "array", length: item.length };
      } else {
        output[key] = depth > 2 ? typeof item : summarizeJson(item, depth + 1);
      }
    }
    return output;
  }
  if (typeof value === "string" && value.length > 300) return `${value.slice(0, 300)}...`;
  return value;
}

async function request(method, route, body) {
  const started = startTimer();
  const entry = {
    method,
    route,
    status: 0,
    ok: false,
    ms: 0,
  };

  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    entry.status = response.status;
    entry.ok = response.ok;
    entry.ms = durationMs(started);
    entry.summary = summarizeJson(json ?? text);
    endpointEvidence.push(entry);
    return { ...entry, json, text };
  } catch (error) {
    entry.ms = durationMs(started);
    entry.error = error.message;
    endpointEvidence.push(entry);
    return { ...entry, json: null, text: "" };
  }
}

function addPhase(id, title, status, checks, evidence = {}, improvements = []) {
  phases.push({
    id,
    title,
    status,
    checks,
    evidence,
    improvements,
  });
}

function metricStats(rows, column) {
  const values = rows.map((row) => safeNumber(row[column])).filter((value) => value !== null);
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  const avg = values.length ? sum / values.length : 0;
  return {
    count: values.length,
    sum,
    avg,
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null,
    median: percentile(sorted, 0.5),
    outliersIqr: countIqrOutliers(sorted),
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function countIqrOutliers(sorted) {
  if (sorted.length < 4) return 0;
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return sorted.filter((value) => value < lower || value > upper).length;
}

function correlation(rows, leftKey, rightKey) {
  const pairs = rows
    .map((row) => [safeNumber(row[leftKey]), safeNumber(row[rightKey])])
    .filter(([left, right]) => left !== null && right !== null);

  if (pairs.length < 2) return null;

  const meanLeft = pairs.reduce((sum, [left]) => sum + left, 0) / pairs.length;
  const meanRight = pairs.reduce((sum, [, right]) => sum + right, 0) / pairs.length;

  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;

  for (const [left, right] of pairs) {
    const leftDelta = left - meanLeft;
    const rightDelta = right - meanRight;
    numerator += leftDelta * rightDelta;
    leftDenominator += leftDelta ** 2;
    rightDenominator += rightDelta ** 2;
  }

  const denominator = Math.sqrt(leftDenominator * rightDenominator);
  return denominator ? numerator / denominator : null;
}

function duplicateCount(rows) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates;
}

function missingValues(rows) {
  const counts = {};
  const names = Object.keys(rows[0] || {});
  for (const name of names) counts[name] = 0;
  for (const row of rows) {
    for (const name of names) {
      if (row[name] === null || row[name] === undefined || String(row[name]).trim() === "") {
        counts[name] += 1;
      }
    }
  }
  return counts;
}

function buildDeterministicAnalytics(rows) {
  return {
    rowCount: rows.length,
    columnCount: Object.keys(rows[0] || {}).length,
    missingValues: missingValues(rows),
    duplicateRows: duplicateCount(rows),
    experience: metricStats(rows, "experience"),
    salary_usd: metricStats(rows, "salary_usd"),
    correlation_experience_salary_usd: correlation(rows, "experience", "salary_usd"),
  };
}

function extractDataset(response) {
  return response.json?.data?.dataset || response.json?.dataset || response.json?.data || null;
}

function extractKpis(response) {
  const analysis = response.json?.data?.analysis || response.json?.analysis || response.json?.data;
  return analysis?.kpis || analysis?.dashboard?.kpis || analysis?.dashboardPlan?.kpis || [];
}

function parseKpiNumber(value) {
  const num = safeNumber(String(value ?? "").replace(/[^\d.,$₹€£%-]/g, ""));
  return num;
}

function closeEnough(actual, expected, tolerance = 0.01) {
  if (actual === null || expected === null || actual === undefined || expected === undefined) return false;
  const allowed = Math.max(tolerance, Math.abs(expected) * 0.005);
  return Math.abs(actual - expected) <= allowed;
}

function validateKnownKpis(kpis, expected) {
  const checks = [];
  for (const kpi of kpis || []) {
    const title = String(kpi.title || kpi.label || kpi.id || "").toLowerCase();
    const value = parseKpiNumber(kpi.value);

    if (/total.*record|row/.test(title)) {
      checks.push({
        kpi: kpi.title || kpi.label,
        expected: expected.rowCount,
        actual: value,
        pass: closeEnough(value, expected.rowCount, 1),
      });
    }
    if (/average.*salary|avg.*salary/.test(title)) {
      checks.push({
        kpi: kpi.title || kpi.label,
        expected: expected.salary_usd.avg,
        actual: value,
        pass: closeEnough(value, expected.salary_usd.avg, 1),
      });
    }
    if (/highest.*salary|max.*salary/.test(title)) {
      checks.push({
        kpi: kpi.title || kpi.label,
        expected: expected.salary_usd.max,
        actual: value,
        pass: closeEnough(value, expected.salary_usd.max, 1),
      });
    }
  }
  return checks;
}

function hasField(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function statusFromChecks(checks, required = null) {
  const failures = checks.filter((check) => !check.pass);
  if (required && !required.every((name) => checks.some((check) => check.name === name && check.pass))) {
    return "FAIL";
  }
  return failures.length ? "FAIL" : "PASS";
}

async function ensureBackendReachable() {
  const health = await request("GET", "/api/health");
  if (!health.ok) {
    throw new Error(
      `Backend is unreachable at ${BASE_URL}. Start it with "npm run dev:backend" before running this audit.`
    );
  }
}

async function loadFiles() {
  parsedFiles = {
    train: parseCsvFile(CSV_PATHS.train),
    test: parseCsvFile(CSV_PATHS.test),
    dictionary: parseCsvFile(CSV_PATHS.dictionary),
  };
  deterministic = buildDeterministicAnalytics(parsedFiles.train);
}

async function phase1DatasetRegistration() {
  const initial = await request("GET", "/api/datasets");
  const initialCount = initial.json?.data?.count ?? initial.json?.data?.datasets?.length ?? 0;

  const payloads = {
    train: datasetPayload({
      name: "salary_train_stress_audit",
      fileName: "train.csv",
      rows: parsedFiles.train,
      dictRows: parsedFiles.dictionary,
    }),
    test: datasetPayload({
      name: "salary_test_stress_audit",
      fileName: "test.csv",
      rows: parsedFiles.test,
      dictRows: parsedFiles.dictionary,
    }),
    dictionary: datasetPayload({
      name: "salary_data_dictionary_stress_audit",
      fileName: "data_dictionary.csv",
      rows: parsedFiles.dictionary,
    }),
  };

  const imports = {};
  for (const [key, payload] of Object.entries(payloads)) {
    imports[key] = await request("POST", "/api/datasets/import", payload);
    datasets[key] = extractDataset(imports[key]);
  }

  const ids = Object.values(datasets).map((dataset) => dataset?.id).filter(Boolean);
  const retrieves = {};
  for (const [key, dataset] of Object.entries(datasets)) {
    retrieves[key] = dataset?.id ? await request("GET", `/api/datasets/${dataset.id}`) : null;
  }
  const final = await request("GET", "/api/datasets");
  const finalCount = final.json?.data?.count ?? final.json?.data?.datasets?.length ?? 0;

  const checks = [
    { name: "Backend dataset list is readable before upload", pass: initial.ok, evidence: { status: initial.status } },
    { name: "All three CSVs import successfully", pass: Object.values(imports).every((res) => res.status === 201), evidence: Object.fromEntries(Object.entries(imports).map(([k, v]) => [k, v.status])) },
    { name: "Each upload returns a datasetId", pass: ids.length === 3, evidence: { ids } },
    { name: "Dataset IDs are unique", pass: new Set(ids).size === 3, evidence: { ids } },
    { name: "Dataset count increased", pass: finalCount >= initialCount + 3, evidence: { initialCount, finalCount } },
    { name: "Datasets can be retrieved after upload", pass: Object.values(retrieves).every((res) => res?.ok), evidence: Object.fromEntries(Object.entries(retrieves).map(([k, v]) => [k, v?.status ?? 0])) },
    {
      name: "Stored metadata includes row and column counts",
      pass:
        datasets.train?.rowCount === parsedFiles.train.length &&
        datasets.test?.rowCount === parsedFiles.test.length &&
        datasets.dictionary?.rowCount === parsedFiles.dictionary.length &&
        datasets.train?.columns?.length === Object.keys(parsedFiles.train[0]).length,
      evidence: {
        train: { rowCount: datasets.train?.rowCount, columnCount: datasets.train?.columns?.length },
        test: { rowCount: datasets.test?.rowCount, columnCount: datasets.test?.columns?.length },
        dictionary: { rowCount: datasets.dictionary?.rowCount, columnCount: datasets.dictionary?.columns?.length },
      },
    },
    {
      name: "Import response includes generated schema profile/dashboard analysis",
      pass: Boolean(imports.train.json?.data?.analysis?.schemaPacket || imports.train.json?.data?.analysis?.columnCount),
      evidence: {
        hasSchemaPacket: Boolean(imports.train.json?.data?.analysis?.schemaPacket),
        analysisKeys: Object.keys(imports.train.json?.data?.analysis || {}),
      },
    },
  ];

  addPhase("phase1", "Dataset Registration", statusFromChecks(checks), checks, {
    trainDatasetId: datasets.train?.id,
    testDatasetId: datasets.test?.id,
    dictionaryDatasetId: datasets.dictionary?.id,
  });

  datasets.trainImportResponse = imports.train;
}

async function phase2SchemaUnderstanding() {
  const dataset = {
    ...datasetPayload({
      name: "salary_train_with_dictionary",
      fileName: "train.csv",
      rows: parsedFiles.train,
      dictRows: parsedFiles.dictionary,
    }),
    id: datasets.train?.id,
  };

  const understand = await request("POST", `/api/datasets/${datasets.train.id}/schema-understand`, { dataset });
  const schemaDashboardRes = await request("POST", `/api/datasets/${datasets.train.id}/schema-dashboard`, {
    dataset,
    useLlm: false,
    useRagEmbedding: false,
  });
  schemaDashboard = schemaDashboardRes.json?.data || null;

  const profile = schemaDashboard?.profile;
  const columns = profile?.columns || [];
  const salary = columns.find((column) => normalizeName(column.name) === "salary_usd");
  const dimensions = columns.filter((column) => ["category", "location", "text", "dimension"].includes(column.role));
  const measures = columns.filter((column) => /metric/.test(column.role) || column.type === "number");

  const checks = [
    { name: "Schema understanding endpoint executes", pass: understand.ok, evidence: { status: understand.status } },
    { name: "Schema dashboard/profile endpoint executes", pass: schemaDashboardRes.ok, evidence: { status: schemaDashboardRes.status } },
    { name: "Columns are inventoried", pass: columns.length === 7, evidence: { count: columns.length, names: columns.map((c) => c.name) } },
    { name: "Columns are not all treated as strings", pass: columns.some((c) => c.type === "number") && columns.some((c) => c.type !== "number"), evidence: columns.map((c) => ({ name: c.name, type: c.type, role: c.role })) },
    { name: "Measures are detected", pass: measures.length >= 2, evidence: measures.map((c) => c.name) },
    { name: "Dimensions are detected", pass: dimensions.length >= 3, evidence: dimensions.map((c) => c.name) },
    { name: "Target/salary column is recognized as analytic metric", pass: Boolean(salary && /metric|target/.test(salary.role)), evidence: salary },
    { name: "Data dictionary descriptions are used", pass: columns.some((c) => c.description), evidence: columns.map((c) => ({ name: c.name, description: c.description })).filter((c) => c.description) },
  ];

  addPhase("phase2", "Schema Understanding", statusFromChecks(checks), checks, {
    outputShape: {
      datasetId: datasets.train.id,
      dimensions: dimensions.map((c) => c.name),
      measures: measures.map((c) => c.name),
      targets: salary ? [salary.name] : [],
      qualityScore: schemaDashboard?.quality?.score ?? null,
    },
  });
}

async function phase3MultiDatasetReasoning() {
  const trainPayload = datasetPayload({
    name: "train.csv",
    fileName: "train.csv",
    rows: parsedFiles.train,
    dictRows: parsedFiles.dictionary,
  });
  const testPayload = datasetPayload({
    name: "test.csv",
    fileName: "test.csv",
    rows: parsedFiles.test,
    dictRows: parsedFiles.dictionary,
  });
  const dictPayload = datasetPayload({
    name: "data_dictionary.csv",
    fileName: "data_dictionary.csv",
    rows: parsedFiles.dictionary,
  });

  const merge = await request("POST", "/api/datasets/merge", {
    datasets: [trainPayload, testPayload, dictPayload],
  });

  const trainColumns = trainPayload.columns.map((column) => normalizeName(column.name));
  const testColumns = testPayload.columns.map((column) => normalizeName(column.name));
  const shared = trainColumns.filter((column) => testColumns.includes(column));
  const schemaDifferences = [
    ...trainColumns.filter((column) => !testColumns.includes(column)).map((column) => ({ onlyIn: "train", column })),
    ...testColumns.filter((column) => !trainColumns.includes(column)).map((column) => ({ onlyIn: "test", column })),
  ];
  const expectedMergePlan = {
    mergeable: schemaDifferences.length === 0,
    confidence: schemaDifferences.length === 0 ? 0.98 : shared.length / Math.max(trainColumns.length, testColumns.length),
    joinKeys: [],
    appendCompatible: schemaDifferences.length === 0,
    schemaDifferences,
  };
  const related = merge.json?.data?.relatedDatasets;
  const outputHasMergePlan =
    hasField(merge.json?.data, "mergeable") ||
    hasField(merge.json?.data, "joinKeys") ||
    hasField(merge.json?.data, "schemaDifferences");

  const checks = [
    { name: "train.csv and test.csv share the same schema", pass: expectedMergePlan.mergeable, evidence: expectedMergePlan },
    { name: "Multi-file endpoint executes", pass: merge.ok, evidence: { status: merge.status } },
    { name: "Endpoint classifies primary/test/dictionary roles", pass: Boolean(related?.primaryDataset && related?.testFiles?.length && related?.metadataFiles?.length), evidence: related },
    {
      name: "Endpoint returns explicit merge plan shape",
      pass: outputHasMergePlan,
      evidence: {
        expectedKeys: ["mergeable", "confidence", "joinKeys", "schemaDifferences"],
        actualKeys: Object.keys(merge.json?.data || {}),
      },
    },
  ];

  addPhase("phase3", "Multi-Dataset Reasoning", statusFromChecks(checks), checks, {
    expectedMergePlan,
    endpointResult: summarizeJson(merge.json?.data),
  }, outputHasMergePlan ? [] : ["Add a real merge-plan response with mergeable, confidence, joinKeys, and schemaDifferences."]);
}

async function phase4DatasetUpdate() {
  const firstRowId = datasets.train?.rows?.[0]?.__rowId;
  const originalValue = datasets.train?.rows?.[0]?.salary_usd;
  const patchedValue = String(Number(safeNumber(originalValue) || 0) + 1);
  const patch = firstRowId
    ? await request("PATCH", `/api/datasets/${datasets.train.id}/rows/${firstRowId}`, {
        column: "salary_usd",
        value: patchedValue,
      })
    : { ok: false, status: 0, json: null };

  const restore = firstRowId
    ? await request("PATCH", `/api/datasets/${datasets.train.id}/rows/${firstRowId}`, {
        column: "salary_usd",
        value: originalValue,
      })
    : { ok: false, status: 0, json: null };

  const replaceProbe = await request("PUT", `/api/datasets/${datasets.train.id}`, {
    rows: parsedFiles.train.slice(0, 3),
    columns: inferColumns(parsedFiles.train.slice(0, 3), dictionaryMap(parsedFiles.dictionary)),
  });
  const appendProbe = await request("POST", `/api/datasets/${datasets.train.id}/rows`, {
    rows: parsedFiles.train.slice(0, 1),
  });
  const versionsProbe = await request("GET", `/api/datasets/${datasets.train.id}/versions`);

  const checks = [
    { name: "Existing row-level PATCH update works", pass: patch.ok && restore.ok, evidence: { patchStatus: patch.status, restoreStatus: restore.status } },
    { name: "Dataset-level replace endpoint exists", pass: replaceProbe.ok, evidence: { status: replaceProbe.status } },
    { name: "Dataset-level append endpoint exists", pass: appendProbe.ok, evidence: { status: appendProbe.status } },
    { name: "Dataset version history endpoint exists", pass: versionsProbe.ok, evidence: { status: versionsProbe.status } },
    { name: "Schema/KPI/dashboard refresh metadata returned for update", pass: false, evidence: { expected: ["rowsAdded", "rowsRemoved", "schemaChanged", "dashboardRegenerated"] } },
  ];

  addPhase("phase4", "Dataset Update Test", "FAIL", checks, {
    outputShape: {
      rowsAdded: null,
      rowsRemoved: null,
      schemaChanged: null,
      dashboardRegenerated: null,
    },
  }, [
    "Add dataset-level append/replace APIs.",
    "Persist dataset versions and expose version history.",
    "Return rowsAdded, rowsRemoved, schemaChanged, and dashboardRegenerated after updates.",
  ]);
}

async function phase5AgentOrchestration() {
  const agentic = await request("POST", `/api/agentic-models/datasets/${datasets.train.id}/analyze`, {
    goal: "Audit salary analytics dashboard for schema-aware deterministic insights.",
  });

  const audit = agentic.json?.data?.audit || [];
  const steps = audit.map((item) => item.step || item.agent);
  const models = new Set(audit.map((item) => item.model).filter(Boolean));
  const expectedMissing = EXPECTED_AGENT_STEPS.filter((step) => !steps.includes(step));

  const checks = [
    { name: "Agentic analysis endpoint executes", pass: agentic.ok, evidence: { status: agentic.status } },
    { name: "Audit trail exists", pass: audit.length > 0, evidence: audit },
    { name: "Schema Agent executes first", pass: steps[0] === "schema_analysis", evidence: { steps } },
    { name: "Master Agent executes after schema", pass: steps.includes("master_planning") && steps.indexOf("master_planning") > steps.indexOf("schema_analysis"), evidence: { steps } },
    { name: "Dashboard Guardian executes", pass: steps.includes("dashboard_guardian"), evidence: { steps } },
    { name: "Full expected agent chain is present", pass: expectedMissing.length === 0, evidence: { expected: EXPECTED_AGENT_STEPS, actual: steps, missing: expectedMissing } },
    { name: "More than one configured model appears in audit", pass: models.size > 1, evidence: { models: [...models] } },
  ];

  addPhase("phase5", "Agent Orchestration Test", statusFromChecks(checks), checks, {
    audit,
  }, expectedMissing.length ? ["Extend orchestration audit to include analytics_engine and final_explanation steps."] : []);
}

async function phase6DeterministicAnalytics() {
  const kpis = extractKpis(datasets.trainImportResponse);
  const kpiChecks = validateKnownKpis(kpis, deterministic);
  const allKnownPass = kpiChecks.length > 0 && kpiChecks.every((check) => check.pass);

  const checks = [
    { name: "Harness computed independent row count", pass: deterministic.rowCount === 40000, evidence: { rowCount: deterministic.rowCount } },
    { name: "Harness computed sum/avg/min/max", pass: deterministic.salary_usd.count === 40000 && deterministic.salary_usd.max !== null, evidence: { salary_usd: deterministic.salary_usd, experience: deterministic.experience } },
    { name: "Harness computed correlation", pass: deterministic.correlation_experience_salary_usd !== null, evidence: { correlation: deterministic.correlation_experience_salary_usd } },
    { name: "Harness computed missing values and outliers", pass: hasField(deterministic.missingValues, "salary_usd") && deterministic.salary_usd.outliersIqr >= 0, evidence: { missingValues: deterministic.missingValues, outliers: { salary_usd: deterministic.salary_usd.outliersIqr, experience: deterministic.experience.outliersIqr } } },
    { name: "Returned KPI values match deterministic calculations when present", pass: allKnownPass, evidence: kpiChecks },
    { name: "No accepted KPI value is only LLM text", pass: allKnownPass, evidence: { checkedKpiCount: kpiChecks.length } },
  ];

  addPhase("phase6", "Deterministic Analytics Test", statusFromChecks(checks), checks, {
    deterministic,
  });
}

async function phase7DashboardGuardian() {
  const invalidDashboard = {
    kpis: [
      { title: "Fake KPI", metric: "not_a_real_salary_column", aggregation: "avg", value: "999999" },
    ],
    charts: [
      { title: "Fake Chart", type: "bar", xKey: "fake_country", yKey: "fake_salary", aggregation: "sum", data: [{ fake_country: "Nowhere", fake_salary: 1 }] },
    ],
  };

  const guardian = await request("POST", `/api/datasets/${datasets.train.id}/dashboard-validate-fix`, {
    currentDashboard: invalidDashboard,
  });
  const data = guardian.json?.data || {};
  const serialized = JSON.stringify(data).toLowerCase();
  const fakeRemoved = !serialized.includes("fake_country") && !serialized.includes("fake_salary") && !serialized.includes("not_a_real_salary_column");

  const checks = [
    { name: "Dashboard guardian endpoint executes", pass: guardian.ok, evidence: { status: guardian.status } },
    { name: "Guardian reports issues, warnings, or corrections", pass: Boolean(data.issues?.length || data.warnings?.length || data.corrections?.length || data.correctedDashboard || data.observations?.length), evidence: summarizeJson(data) },
    { name: "Guardian removes or corrects non-existent chart/KPI columns", pass: fakeRemoved, evidence: summarizeJson(data) },
  ];

  addPhase("phase7", "Dashboard Guardian Test", statusFromChecks(checks), checks, {
    expectedShape: { valid: guardian.ok && fakeRemoved, warnings: data.warnings || data.observations || [], corrections: data.corrections || data.issues || [] },
  });
}

async function phase8RagReadiness() {
  const acceptedDashboardPlan = schemaDashboard?.dashboard || schemaDashboard?.dashboardPlan || {};
  const trainRag = await request("POST", "/api/ai/schema-rag/train", {
    dataset: {
      ...datasetPayload({
        name: "salary_train_stress_audit",
        fileName: "train.csv",
        rows: parsedFiles.train,
        dictRows: parsedFiles.dictionary,
      }),
      id: datasets.train.id,
    },
    acceptedDashboardPlan,
    rating: "good",
    notes: "Stress-audit generated salary dashboard memory.",
    source: "agentic-salary-stress-audit",
    useOllama: false,
  });
  const memory = await request("GET", "/api/ai/schema-rag-memory");

  const stats = memory.json?.data?.stats || {};
  const memoryItems = memory.json?.data?.memory || [];
  const trainedEntry = trainRag.json?.data?.entry;
  const embeddingMeta = trainRag.json?.data?.embedding || {};

  const expectedFiles = [
    "schema-memory.json",
    "rag-memory.json",
    "dataset-fingerprints.json",
    "analytics-playbooks.json",
  ];
  const actualMemoryPath = stats.memoryPath || "apps/backend/data/schema-rag-memory.json";

  const checks = [
    { name: "RAG training endpoint executes", pass: trainRag.ok, evidence: { status: trainRag.status, embedding: embeddingMeta } },
    { name: "RAG memory endpoint executes", pass: memory.ok, evidence: { status: memory.status, stats } },
    { name: "Memory chunks/summaries are generated", pass: Boolean(trainedEntry?.schemaText && trainedEntry?.schemaProfile?.columns?.length), evidence: summarizeJson(trainedEntry) },
    { name: "Embeddings can be generated", pass: Boolean(embeddingMeta.provider && embeddingMeta.model), evidence: embeddingMeta },
    { name: "Reusable memory records exist", pass: Number(stats.count || memoryItems.length || 0) > 0, evidence: { count: stats.count, actualMemoryPath } },
    { name: "Required named memory export files exist", pass: expectedFiles.every((file) => fs.existsSync(path.join(ROOT, "reports", file)) || fs.existsSync(path.join(ROOT, "data", file)) || fs.existsSync(path.join(ROOT, "apps", "backend", "data", file))), evidence: { expectedFiles, actualMemoryPath } },
  ];

  addPhase("phase8", "RAG Training Readiness", statusFromChecks(checks), checks, {
    expectedOutputs: expectedFiles,
    actualMemoryPath,
  }, [
    "Add explicit export jobs for schema-memory.json, rag-memory.json, dataset-fingerprints.json, and analytics-playbooks.json.",
  ]);
}

function makeTrainingExamples(count = 50) {
  const columns = inferColumns(parsedFiles.train, dictionaryMap(parsedFiles.dictionary));
  const schema = {
    datasetName: "salary_train_stress_audit",
    rowCount: parsedFiles.train.length,
    columnCount: columns.length,
    columns: columns.map(({ name, type, role, description }) => ({ name, type, role, description })),
  };
  const intents = [
    "Create a salary analytics dashboard.",
    "Compare salary by country.",
    "Find salary distribution by experience.",
    "Build a dashboard for developer compensation.",
    "Validate a workforce salary dashboard.",
  ];

  return Array.from({ length: count }, (_, index) => ({
    instruction: intents[index % intents.length],
    schema,
    dashboardPlan: schemaDashboard?.dashboard || schemaDashboard?.dashboardPlan || {},
    expectedOutput: {
      schemaOnly: true,
      domain: "workforce_salary",
      requiredColumns: ["experience", "country", "education", "languages", "frameworks", "company_size", "salary_usd"],
    },
  }));
}

async function phase9LlmTrainingReadiness() {
  const examples = makeTrainingExamples(50);
  const trainMemory = await request("POST", "/api/ai/schema-training/train-memory", {
    datasets: examples.map((example, index) => ({
      name: `salary-training-example-${index + 1}`,
      rows: parsedFiles.train.slice(index, index + 200),
      columns: inferColumns(parsedFiles.train.slice(index, index + 200), dictionaryMap(parsedFiles.dictionary)),
      dashboardPlan: example.dashboardPlan,
      rating: "good",
    })),
  });
  const memory = await request("GET", "/api/ai/schema-training-memory");
  const stats = memory.json?.data?.stats || {};
  const memoryItems = memory.json?.data?.memory || [];
  const has50ApiRecords = Number(stats.count || memoryItems.length || 0) >= 50;

  const checks = [
    { name: "Harness can generate at least 50 schema-aware fine-tuning examples", pass: examples.length >= 50, evidence: { count: examples.length, sample: examples[0] } },
    { name: "Training examples use instruction/schema/dashboardPlan/expectedOutput shape", pass: examples.every((item) => item.instruction && item.schema?.columns?.length && item.dashboardPlan && item.expectedOutput), evidence: { sampleKeys: Object.keys(examples[0]) } },
    { name: "Schema training endpoint executes", pass: trainMemory.ok, evidence: { status: trainMemory.status } },
    { name: "Schema training memory endpoint executes", pass: memory.ok, evidence: { status: memory.status, stats } },
    { name: "Persisted training memory has at least 50 examples", pass: has50ApiRecords, evidence: { count: stats.count || memoryItems.length } },
    { name: "Training data is not generic chatbot text", pass: examples.every((item) => item.schema.columns.some((column) => column.name === "salary_usd")), evidence: { checkedExamples: examples.length } },
  ];

  addPhase("phase9", "LLM Training Readiness", statusFromChecks(checks), checks, {
    generatedExamples: examples.length,
    persistedMemoryCount: stats.count || memoryItems.length || 0,
  }, has50ApiRecords ? [] : ["Add/export a JSONL fine-tuning dataset with at least 50 distinct schema-aware records."]);
}

function verdictValue(names) {
  return names.every((name) => phases.find((phase) => phase.title === name)?.status === "PASS") ? "PASS" : "FAIL";
}

function calculateScore(verdicts) {
  const weights = {
    "Multi-Dataset Support": 15,
    "Dataset Update Support": 12,
    "Agentic Architecture": 15,
    "Dashboard Guardian": 12,
    "RAG Readiness": 12,
    "LLM Training Readiness": 10,
    "Deterministic Analytics": 14,
    "Production Readiness": 10,
  };

  return Object.entries(weights).reduce((score, [name, weight]) => score + (verdicts[name] === "PASS" ? weight : 0), 0);
}

function buildVerdicts() {
  const verdicts = {
    "Multi-Dataset Support": verdictValue(["Dataset Registration", "Multi-Dataset Reasoning"]),
    "Dataset Update Support": verdictValue(["Dataset Update Test"]),
    "Agentic Architecture": verdictValue(["Schema Understanding", "Agent Orchestration Test"]),
    "Dashboard Guardian": verdictValue(["Dashboard Guardian Test"]),
    "RAG Readiness": verdictValue(["RAG Training Readiness"]),
    "LLM Training Readiness": verdictValue(["LLM Training Readiness"]),
    "Deterministic Analytics": verdictValue(["Deterministic Analytics Test"]),
  };

  verdicts["Production Readiness"] =
    verdicts["Multi-Dataset Support"] === "PASS" &&
    verdicts["Dataset Update Support"] === "PASS" &&
    verdicts["Agentic Architecture"] === "PASS" &&
    verdicts["Dashboard Guardian"] === "PASS" &&
    verdicts["Deterministic Analytics"] === "PASS"
      ? "PASS"
      : "FAIL";

  verdicts["Architecture Score"] = calculateScore(verdicts);
  return verdicts;
}

function buildLetteredFinalVerdict(verdicts, improvements) {
  return {
    "A. Multi-Dataset Support": verdicts["Multi-Dataset Support"],
    "B. Dataset Update Support": verdicts["Dataset Update Support"],
    "C. Agentic Architecture": verdicts["Agentic Architecture"],
    "D. Dashboard Guardian": verdicts["Dashboard Guardian"],
    "E. RAG Readiness": verdicts["RAG Readiness"],
    "F. LLM Training Readiness": verdicts["LLM Training Readiness"],
    "G. Deterministic Analytics": verdicts["Deterministic Analytics"],
    "H. Production Readiness": verdicts["Production Readiness"],
    "I. Architecture Score": `${verdicts["Architecture Score"]}/100`,
    "J. What must be built next": improvements,
  };
}

function nextBuildItems() {
  const items = new Set();
  for (const phase of phases) {
    for (const item of phase.improvements || []) items.add(item);
  }
  if (phases.find((phase) => phase.title === "Dataset Update Test")?.status === "FAIL") {
    items.add("apps/backend/src/routes/datasets.js: add append, replace, and version-history routes.");
    items.add("apps/backend/src/database/dataset-repository.js: persist dataset versions, schema fingerprints, and update metadata.");
  }
  if (phases.find((phase) => phase.title === "Multi-Dataset Reasoning")?.status === "FAIL") {
    items.add("apps/backend/src/services/data-merger.js: expose evidence-based merge plan instead of only normalizing rows.");
  }
  if (phases.find((phase) => phase.title === "RAG Training Readiness")?.status === "FAIL") {
    items.add("apps/backend/src/services/ai-analyst: add explicit memory/fingerprint/playbook export service.");
  }
  if (phases.find((phase) => phase.title === "LLM Training Readiness")?.status === "FAIL") {
    items.add("apps/backend/scripts/export-schema-training-jsonl.js: ensure at least 50 schema-aware fine-tuning records are generated/exported.");
  }
  return [...items];
}

function writeJsonReport(report) {
  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  generatedFiles.push(REPORT_JSON);
}

function statusIcon(status) {
  return status === "PASS" ? "PASS" : "FAIL";
}

function markdownReport(report) {
  const verdictRows = Object.entries(report.finalVerdict)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const letteredRows = Object.entries(report.finalVerdictLettered)
    .filter(([, value]) => !Array.isArray(value))
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");

  const phaseSections = report.phases
    .map((phase) => {
      const checks = phase.checks
        .map((check) => `- ${check.pass ? "PASS" : "FAIL"}: ${check.name}`)
        .join("\n");
      const improvements = phase.improvements?.length
        ? `\n\nImprovements:\n${phase.improvements.map((item) => `- ${item}`).join("\n")}`
        : "";
      return `## ${phase.title}: ${statusIcon(phase.status)}\n\n${checks}${improvements}`;
    })
    .join("\n\n");

  return `# Agentic AI Analytics Salary Stress Audit

Generated: ${report.generatedAt}

Backend: ${report.backendUrl}

## Dataset Inputs

| File | Path | Rows | Columns |
| --- | --- | ---: | ---: |
| train.csv | ${CSV_PATHS.train} | ${report.datasetInputs.train.rowCount} | ${report.datasetInputs.train.columnCount} |
| test.csv | ${CSV_PATHS.test} | ${report.datasetInputs.test.rowCount} | ${report.datasetInputs.test.columnCount} |
| data_dictionary.csv | ${CSV_PATHS.dictionary} | ${report.datasetInputs.dictionary.rowCount} | ${report.datasetInputs.dictionary.columnCount} |

## Final Verdict

| Category | Result |
| --- | --- |
${verdictRows}

## Prompt Verdict A-J

| Item | Result |
| --- | --- |
${letteredRows}

J. What must be built next:

${report.whatMustBeBuiltNext.map((item) => `- ${item}`).join("\n")}

## Deterministic Analytics Baseline

- Train rows: ${report.deterministic.rowCount}
- Train columns: ${report.deterministic.columnCount}
- Salary average: ${report.deterministic.salary_usd.avg}
- Salary min/max: ${report.deterministic.salary_usd.min} / ${report.deterministic.salary_usd.max}
- Experience/salary correlation: ${report.deterministic.correlation_experience_salary_usd}
- Duplicate rows: ${report.deterministic.duplicateRows}

${phaseSections}

## What Must Be Built Next

${report.whatMustBeBuiltNext.map((item) => `- ${item}`).join("\n")}

## Endpoint Evidence

Full request evidence is available in \`reports/agentic-salary-stress-audit.json\`.
`;
}

function writeMarkdownReport(report) {
  fs.writeFileSync(REPORT_MD, markdownReport(report));
  generatedFiles.push(REPORT_MD);
}

async function run() {
  console.log("Agentic AI Analytics Salary Stress Audit");
  console.log(`Backend: ${BASE_URL}`);

  await loadFiles();
  await ensureBackendReachable();

  console.log("Running phase 1/9: dataset registration");
  await phase1DatasetRegistration();
  console.log("Running phase 2/9: schema understanding");
  await phase2SchemaUnderstanding();
  console.log("Running phase 3/9: multi-dataset reasoning");
  await phase3MultiDatasetReasoning();
  console.log("Running phase 4/9: dataset update");
  await phase4DatasetUpdate();
  console.log("Running phase 5/9: agent orchestration");
  await phase5AgentOrchestration();
  console.log("Running phase 6/9: deterministic analytics");
  await phase6DeterministicAnalytics();
  console.log("Running phase 7/9: dashboard guardian");
  await phase7DashboardGuardian();
  console.log("Running phase 8/9: RAG readiness");
  await phase8RagReadiness();
  console.log("Running phase 9/9: LLM training readiness");
  await phase9LlmTrainingReadiness();

  const finalVerdict = buildVerdicts();
  const whatMustBeBuiltNext = nextBuildItems();
  const report = {
    generatedAt: nowIso(),
    backendUrl: BASE_URL,
    csvPaths: CSV_PATHS,
    datasetInputs: {
      train: { rowCount: parsedFiles.train.length, columnCount: Object.keys(parsedFiles.train[0] || {}).length },
      test: { rowCount: parsedFiles.test.length, columnCount: Object.keys(parsedFiles.test[0] || {}).length },
      dictionary: { rowCount: parsedFiles.dictionary.length, columnCount: Object.keys(parsedFiles.dictionary[0] || {}).length },
    },
    deterministic,
    phases,
    finalVerdict,
    finalVerdictLettered: buildLetteredFinalVerdict(finalVerdict, whatMustBeBuiltNext),
    whatMustBeBuiltNext,
    endpointEvidence,
  };

  writeJsonReport(report);
  writeMarkdownReport(report);

  console.log("");
  console.log("Final Verdict");
  for (const [key, value] of Object.entries(finalVerdict)) {
    console.log(`${key}: ${value}`);
  }
  console.log("");
  console.log(`Wrote ${path.relative(ROOT, REPORT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, REPORT_MD)}`);
}

run().catch((error) => {
  const failedReport = {
    generatedAt: nowIso(),
    backendUrl: BASE_URL,
    csvPaths: CSV_PATHS,
    error: error.message,
    endpointEvidence,
    finalVerdict: {
      "Multi-Dataset Support": "FAIL",
      "Dataset Update Support": "FAIL",
      "Agentic Architecture": "FAIL",
      "Dashboard Guardian": "FAIL",
      "RAG Readiness": "FAIL",
      "LLM Training Readiness": "FAIL",
      "Deterministic Analytics": "FAIL",
      "Production Readiness": "FAIL",
      "Architecture Score": 0,
    },
    finalVerdictLettered: {
      "A. Multi-Dataset Support": "FAIL",
      "B. Dataset Update Support": "FAIL",
      "C. Agentic Architecture": "FAIL",
      "D. Dashboard Guardian": "FAIL",
      "E. RAG Readiness": "FAIL",
      "F. LLM Training Readiness": "FAIL",
      "G. Deterministic Analytics": "FAIL",
      "H. Production Readiness": "FAIL",
      "I. Architecture Score": "0/100",
      "J. What must be built next": ["Start the backend and rerun the audit."],
    },
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(failedReport, null, 2));
  fs.writeFileSync(
    REPORT_MD,
    `# Agentic AI Analytics Salary Stress Audit\n\nGenerated: ${failedReport.generatedAt}\n\nFAIL: ${error.message}\n`
  );
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
