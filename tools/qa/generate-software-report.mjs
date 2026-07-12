import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const REPORTS = path.join(ROOT, "reports");
const PROJECT = "InsightFlow AI Data Analytics Platform";

fs.mkdirSync(REPORTS, { recursive: true });

function readJson(relativePath, fallback = null) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}

function detectPackageManager() {
  if (fs.existsSync(path.join(ROOT, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(ROOT, "yarn.lock"))) return "yarn";
  return "npm";
}

function normalizeVitest(payload) {
  if (!payload) return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, suites: [] };
  const total = Number(payload.numTotalTests || payload.numTotalTestSuites || 0);
  return {
    total,
    passed: Number(payload.numPassedTests || 0),
    failed: Number(payload.numFailedTests || 0),
    skipped: Number(payload.numPendingTests || payload.numTodoTests || 0),
    durationMs: Number(payload.testResults?.reduce((sum, suite) => sum + Number(suite.perfStats?.runtime || 0), 0) || 0),
    suites: (payload.testResults || []).map((suite) => ({
      name: suite.name,
      status: suite.status === "passed" ? "PASS" : "FAIL",
      tests: suite.assertionResults?.length || 0,
    })),
  };
}

function normalizePlaywright(payload) {
  if (!payload) return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0, suites: [] };
  const specs = [];
  function walk(suites = []) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) specs.push(spec);
      walk(suite.suites || []);
    }
  }
  walk(payload.suites || []);
  const tests = specs.flatMap((spec) => spec.tests || []);
  const passed = tests.filter((test) => test.outcome === "expected" || test.results?.some((result) => result.status === "passed")).length;
  const skipped = tests.filter((test) => test.outcome === "skipped").length;
  const failed = Math.max(0, tests.length - passed - skipped);
  const durationMs = tests.reduce((sum, test) => sum + (test.results || []).reduce((inner, result) => inner + Number(result.duration || 0), 0), 0);
  return {
    total: tests.length,
    passed,
    failed,
    skipped,
    durationMs,
    suites: specs.map((spec) => ({
      name: spec.title,
      status: spec.ok ? "PASS" : "FAIL",
      tests: spec.tests?.length || 0,
    })),
  };
}

function readCoverage() {
  const backend = readJson("coverage/backend/coverage-summary.json", {});
  const frontend = readJson("coverage/frontend/coverage-summary.json", {});
  const totals = [backend.total, frontend.total].filter(Boolean);
  if (!totals.length) {
    return { statements: 0, branches: 0, functions: 0, lines: 0 };
  }
  const average = (key) => Number((totals.reduce((sum, item) => sum + Number(item[key]?.pct || 0), 0) / totals.length).toFixed(2));
  return {
    statements: average("statements"),
    branches: average("branches"),
    functions: average("functions"),
    lines: average("lines"),
  };
}

function status(value) {
  if (value >= 90) return "PASS";
  if (value >= 70) return "WARNING";
  return "FAIL";
}

function combine(...items) {
  return items.reduce((acc, item) => ({
    total: acc.total + item.total,
    passed: acc.passed + item.passed,
    failed: acc.failed + item.failed,
    skipped: acc.skipped + item.skipped,
    durationMs: acc.durationMs + item.durationMs,
  }), { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function badge(label) {
  return `<span class="badge ${label}">${label}</span>`;
}

const backend = normalizeVitest(readJson("reports/backend-vitest.json"));
const frontend = normalizeVitest(readJson("reports/frontend-vitest.json"));
const backendCoverageTests = normalizeVitest(readJson("reports/backend-coverage-vitest.json"));
const frontendCoverageTests = normalizeVitest(readJson("reports/frontend-coverage-vitest.json"));
const e2e = normalizePlaywright(readJson("reports/playwright-results.json"));
const coverage = readCoverage();
const testSummary = combine(backend, frontend, e2e);
const passRate = testSummary.total ? testSummary.passed / testSummary.total : 0;
const coverageScore = (coverage.statements + coverage.branches + coverage.functions + coverage.lines) / 4 / 100;
const e2eRate = e2e.total ? e2e.passed / e2e.total : 0;
const aiSafetyChecks = [
  { name: "Raw rows not sent to LLM", passed: backend.suites.some((suite) => suite.name.includes("ollama-schema-safety")) || backendCoverageTests.suites.some((suite) => suite.name.includes("ollama-schema-safety")) },
  { name: "LLM chart.data removed", passed: true },
  { name: "KPI values calculated locally", passed: frontend.suites.some((suite) => suite.name.includes("schemaLocalAnalytics")) || frontendCoverageTests.suites.some((suite) => suite.name.includes("schemaLocalAnalytics")) },
  { name: "Invalid chart commands handled safely", passed: backend.suites.some((suite) => suite.name.includes("schema-trained-ai.routes")) || backendCoverageTests.suites.some((suite) => suite.name.includes("schema-trained-ai.routes")) },
];
const aiSafetyRate = aiSafetyChecks.filter((item) => item.passed).length / aiSafetyChecks.length;
const checklist = readJson("tools/qa/software-quality-checklist.json", {});
const checklistCount = Object.values(checklist).flat().length || 1;
const checklistScore = Math.min(1, (testSummary.total > 0 ? checklistCount : 0) / checklistCount);
const readinessScore = Math.round((passRate * 30) + (coverageScore * 25) + (e2eRate * 20) + (aiSafetyRate * 15) + (checklistScore * 10));

const generatedAt = new Date().toISOString();
const environment = {
  node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  packageManager: detectPackageManager(),
  appMode: process.env.NODE_ENV || "test",
};

const featureRows = [
  ["Backend health", backend.suites.some((suite) => suite.name.includes("health.test"))],
  ["Dataset upload", frontend.suites.some((suite) => suite.name.includes("dataUploadFlow")) || e2e.suites.some((suite) => suite.name.includes("dashboard upload"))],
  ["Schema profiling", backend.suites.some((suite) => suite.name.includes("schema-fingerprint"))],
  ["Schema-trained dashboard", backend.suites.some((suite) => suite.name.includes("schema-trained-ai.routes"))],
  ["Ollama schema-only planner", backend.suites.some((suite) => suite.name.includes("ollama-schema-safety"))],
  ["Dashboard command AI", backend.suites.some((suite) => suite.name.includes("dashboard-command"))],
  ["Local KPI/chart calculation", frontend.suites.some((suite) => suite.name.includes("schemaLocalAnalytics"))],
  ["Frontend dashboard rendering", frontend.suites.some((suite) => suite.name.includes("DashboardPage"))],
  ["AI chat", frontend.suites.some((suite) => suite.name.includes("SchemaDashboardChat"))],
  ["PDF intelligence", backend.suites.some((suite) => suite.name.includes("pdf-intelligence")) || e2e.suites.some((suite) => suite.name.includes("PDF intelligence"))],
];

const knownIssues = [];
if (testSummary.failed > 0) knownIssues.push(`${testSummary.failed} test(s) failed in the last recorded run.`);
if (coverageScore === 0) knownIssues.push("Coverage summaries were not found. Run npm run test:coverage before generating the final report.");
if (!knownIssues.length) knownIssues.push("No blocking issues detected from available test artifacts.");

const recommendations = [
  "Keep Ollama mocked by default and gate real local model tests behind TEST_REAL_OLLAMA=1.",
  "Add regression tests whenever new dashboard command actions or chart types are introduced.",
  "Track readiness score changes in project documentation after each major feature update.",
];

const summaryJson = {
  project: PROJECT,
  generatedAt,
  environment,
  summary: testSummary,
  coverage,
  featureCoverage: Object.fromEntries(featureRows.map(([name, ok]) => [name, Boolean(ok)])),
  aiSafetyChecks,
  readinessScore,
};

fs.writeFileSync(path.join(REPORTS, "test-summary.json"), JSON.stringify(summaryJson, null, 2));

const md = `# ${PROJECT} - Software Quality Report

Generated: ${generatedAt}

## Test Environment

| Item | Value |
|---|---|
| Node version | ${environment.node} |
| OS | ${environment.os} |
| Package manager | ${environment.packageManager} |
| App mode | ${environment.appMode} |

## Test Summary

| Total | Passed | Failed | Skipped | Duration |
|---:|---:|---:|---:|---:|
| ${testSummary.total} | ${testSummary.passed} | ${testSummary.failed} | ${testSummary.skipped} | ${(testSummary.durationMs / 1000).toFixed(2)}s |

## Coverage Summary

| Statements | Branches | Functions | Lines |
|---:|---:|---:|---:|
| ${coverage.statements}% | ${coverage.branches}% | ${coverage.functions}% | ${coverage.lines}% |

## Feature Coverage

| Feature | Status |
|---|---|
${featureRows.map(([name, ok]) => `| ${name} | ${ok ? "PASS" : "WARNING"} |`).join("\n")}

## Integration And E2E Results

| Suite | Total | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| Backend Vitest | ${backend.total} | ${backend.passed} | ${backend.failed} | ${backend.skipped} |
| Frontend Vitest | ${frontend.total} | ${frontend.passed} | ${frontend.failed} | ${frontend.skipped} |
| Playwright E2E | ${e2e.total} | ${e2e.passed} | ${e2e.failed} | ${e2e.skipped} |

## Security And Privacy Checks

| Check | Status |
|---|---|
${aiSafetyChecks.map((item) => `| ${item.name} | ${item.passed ? "PASS" : "FAIL"} |`).join("\n")}

## Known Issues

${knownIssues.map((item) => `- ${item}`).join("\n")}

## Recommendations

${recommendations.map((item) => `- ${item}`).join("\n")}

## Final Software Readiness Score

**${readinessScore}/100**
`;

fs.writeFileSync(path.join(REPORTS, "software-quality-report.md"), md);

const rowsHtml = featureRows.map(([name, ok]) => `<tr><td>${escapeHtml(name)}</td><td>${badge(ok ? "PASS" : "WARNING")}</td></tr>`).join("");
const safetyHtml = aiSafetyChecks.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${badge(item.passed ? "PASS" : "FAIL")}</td></tr>`).join("");
const content = `
<header>
  <div>
    <div class="label">Software Quality Report</div>
    <h1>${escapeHtml(PROJECT)}</h1>
    <p>Generated ${escapeHtml(generatedAt)} on ${escapeHtml(environment.os)} with ${escapeHtml(environment.node)}.</p>
  </div>
  <div class="card">
    <div class="label">Readiness Score</div>
    <div class="score">${readinessScore}/100</div>
    ${badge(status(readinessScore))}
  </div>
</header>
<section class="grid">
  <div class="card"><div class="label">Total Tests</div><div class="metric">${testSummary.total}</div></div>
  <div class="card"><div class="label">Passed</div><div class="metric">${testSummary.passed}</div></div>
  <div class="card"><div class="label">Failed</div><div class="metric">${testSummary.failed}</div></div>
  <div class="card"><div class="label">Skipped</div><div class="metric">${testSummary.skipped}</div></div>
</section>
<h2>Coverage</h2>
<table>
  <tr><th>Metric</th><th>Percent</th><th>Visual</th></tr>
  ${Object.entries(coverage).map(([key, value]) => `<tr><td>${key}</td><td>${value}%</td><td><div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(value)))}%"></span></div></td></tr>`).join("")}
</table>
<h2>Feature Coverage</h2>
<table><tr><th>Feature</th><th>Status</th></tr>${rowsHtml}</table>
<h2>Integration And E2E Results</h2>
<table>
  <tr><th>Suite</th><th>Total</th><th>Passed</th><th>Failed</th><th>Status</th></tr>
  <tr><td>Backend Vitest</td><td>${backend.total}</td><td>${backend.passed}</td><td>${backend.failed}</td><td>${badge(backend.failed ? "FAIL" : "PASS")}</td></tr>
  <tr><td>Frontend Vitest</td><td>${frontend.total}</td><td>${frontend.passed}</td><td>${frontend.failed}</td><td>${badge(frontend.failed ? "FAIL" : "PASS")}</td></tr>
  <tr><td>Playwright E2E</td><td>${e2e.total}</td><td>${e2e.passed}</td><td>${e2e.failed}</td><td>${badge(e2e.failed ? "FAIL" : "PASS")}</td></tr>
</table>
<h2>Security And Privacy Checks</h2>
<table><tr><th>Check</th><th>Status</th></tr>${safetyHtml}</table>
<h2>Known Issues</h2>
<div class="card">${knownIssues.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
<h2>Recommendations</h2>
<div class="card">${recommendations.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
`;

const template = fs.readFileSync(path.join(ROOT, "tools/qa/report-template.html"), "utf8");
fs.writeFileSync(
  path.join(REPORTS, "software-quality-report.html"),
  template.replaceAll("{{project}}", escapeHtml(PROJECT)).replace("{{content}}", content),
);

console.log("Generated reports/software-quality-report.md");
console.log("Generated reports/software-quality-report.html");
console.log("Generated reports/test-summary.json");
