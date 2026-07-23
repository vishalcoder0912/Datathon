import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, relative, dirname, basename, extname, join } from "path";
import { createInterface } from "readline";

const ROOT = resolve(import.meta.dirname, ".");
const REPORTS_DIR = resolve(ROOT, "reports/qa-reports");
const REPORT_FILE = resolve(REPORTS_DIR, "qa-report.json");
const HTML_REPORT_FILE = resolve(REPORTS_DIR, "qa-report.html");

if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const EXCLUDE_DIRS = new Set(["node_modules", ".git", "coverage", "reports", "logs", "exports", "dist", ".tmp_schema_trained_patch"]);

let testCache = null;

function getSourceFiles(baseDir) {
  const files = [];
  function walk(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (!EXCLUDE_DIRS.has(entry.name)) walk(full);
        } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
          files.push(full);
        }
      }
    } catch { }
  }
  walk(baseDir);
  return files;
}

function getTestFiles(files) {
  return files.filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f));
}

function getSourceWithoutTests(files) {
  const testFiles = new Set(getTestFiles(files));
  const tests = new Set();
  for (const tf of testFiles) {
    const base = tf.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "");
    tests.add(base);
  }
  return files.filter(f => {
    if (testFiles.has(f)) return false;
    if (f.includes("__tests__")) return false;
    const base = f.replace(/\.(ts|tsx|js|jsx)$/, "");
    return !tests.has(base);
  });
}

function runWithTimeout(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: opts.cwd || ROOT,
      timeout: opts.timeout || 120000,
      encoding: "utf-8",
      stdio: "pipe",
      ...opts,
    });
    return { stdout: out?.trim() || "", stderr: "", exitCode: 0 };
  } catch (e) {
    return {
      stdout: e.stdout?.toString()?.trim() || "",
      stderr: e.stderr?.toString()?.trim() || e.message,
      exitCode: e.status ?? 1,
    };
  }
}

async function runVitest(testDir, label) {
  const res = runWithTimeout(`npx vitest run --reporter json --outputFile "${REPORTS_DIR}/vitest-${label}.json"`, {
    cwd: testDir,
    timeout: 180000,
  });

  const resultsFile = resolve(REPORTS_DIR, `vitest-${label}.json`);
  let summary = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], files: [] };
  if (existsSync(resultsFile)) {
    try {
      const raw = readFileSync(resultsFile, "utf-8");
      const data = JSON.parse(raw);
      const testResults = data.testResults || data;
      if (Array.isArray(testResults)) {
        for (const tr of testResults) {
          summary.total += tr.assertionResults?.length || 0;
          summary.passed += tr.assertionResults?.filter(a => a.status === "passed").length || 0;
          summary.failed += tr.assertionResults?.filter(a => a.status === "failed").length || 0;
          summary.skipped += tr.assertionResults?.filter(a => a.status === "skipped" || a.status === "pending").length || 0;
          summary.files.push(tr.name || tr.file || "unknown");
          if (tr.assertionResults) summary.tests.push(...tr.assertionResults);
        }
      } else {
        summary.total = data.numTotalTests || 0;
        summary.passed = data.numPassedTests || 0;
        summary.failed = data.numFailedTests || 0;
        summary.skipped = (data.numPendingTests || 0) + (data.numSkippedTests || 0);
        summary.files = (data.testResults || []).map(r => r.name || r.file);
        summary.tests = data.testResults || [];
      }
    } catch { }
  }

  const exitOk = res.exitCode === 0 || summary.failed === 0;
  return {
    label,
    exitCode: res.exitCode,
    ok: exitOk,
    summary,
    raw: res,
  };
}

function runLint() {
  const res = runWithTimeout("npx eslint apps/frontend/src --format json", { timeout: 120000 });
  let issues = [];
  if (res.stdout) {
    try {
      issues = JSON.parse(res.stdout);
    } catch {
      issues = [{ filePath: "eslint", messages: [{ message: res.stderr || "Parse error", severity: 2 }] }];
    }
  }
  const errorCount = issues.reduce((s, f) => s + f.messages?.filter(m => m.severity === 2).length, 0);
  const warnCount = issues.reduce((s, f) => s + f.messages?.filter(m => m.severity === 1).length, 0);
  return { ok: errorCount === 0, errorCount, warnCount, issues };
}

function runTypeCheck() {
  const res = runWithTimeout("npx tsc --noEmit", { cwd: resolve(ROOT, "apps/frontend"), timeout: 120000 });
  const errors = (res.stderr || res.stdout || "").split("\n").filter(l => l.includes("error TS"));
  return { ok: errors.length === 0, errors: errors.length, details: res };
}

function analyzeCodeQuality(files) {
  const report = { totalFiles: files.length, totalLines: 0, totalFunctions: 0, totalImports: 0 };

  const funcPattern = /\b(function\s+\w+|=>\s*\{|async\s+function|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|class\s+\w+)/g;
  const importPattern = /\b(import|require)\s/g;

  for (const f of files) {
    try {
      const content = readFileSync(f, "utf-8");
      const lines = content.split("\n").length;
      report.totalLines += lines;
      report.totalFunctions += (content.match(funcPattern) || []).length;
      report.totalImports += (content.match(importPattern) || []).length;
    } catch { }
  }
  return report;
}

function getLineCoverage(files) {
  const covered = {};
  for (const f of files) {
    const dir = dirname(f);
    const base = basename(f).replace(/\.(ts|tsx|js|jsx)$/, "");
    const testPatterns = [
      resolve(dir, `${base}.test.ts`), resolve(dir, `${base}.test.tsx`),
      resolve(dir, `${base}.test.js`), resolve(dir, `${base}.test.jsx`),
      resolve(dir, `${base}.spec.ts`), resolve(dir, `${base}.spec.tsx`),
      resolve(dir, `${base}.spec.js`), resolve(dir, `${base}.spec.jsx`),
    ];
    const hasTest = testPatterns.some(p => existsSync(p));

    let sourceLines = 0;
    try {
      sourceLines = readFileSync(f, "utf-8").split("\n").length;
    } catch { sourceLines = 0; }

    covered[f] = { hasTest, sourceLines, tested: hasTest };
  }
  return covered;
}

function matchTestVariant(sourceFile) {
  const dir = dirname(sourceFile);
  const base = basename(sourceFile).replace(/\.(ts|tsx|js|jsx)$/, "");
  const exts = [".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.tsx", ".spec.js"];
  return exts.map(e => resolve(dir, base + e)).find(p => existsSync(p));
}

async function runAllTests() {
  const now = Date.now();

  // Collect all source files
  const allSource = [
    ...getSourceFiles(resolve(ROOT, "apps/frontend/src")),
    ...getSourceFiles(resolve(ROOT, "apps/backend/src")),
    ...getSourceFiles(resolve(ROOT, "packages")),
  ].filter(f => !f.includes("node_modules") && !f.includes(".git"));

  // Separate test files and source files
  const allTestFiles = new Set(getTestFiles(allSource));

  // File-by-file analysis — include ALL source files
  const fileAnalysis = [];
  const seen = new Set();
  for (const f of allSource) {
    const rel = relative(ROOT, f);
    if (seen.has(rel)) continue;
    seen.add(rel);
    const isTest = allTestFiles.has(f) || f.includes("__tests__");
    const testFile = isTest ? null : matchTestVariant(f);
    let lines = 0;
    try { lines = readFileSync(f, "utf-8").split("\n").length; } catch { }
    fileAnalysis.push({
      file: rel,
      lines,
      hasTest: isTest || !!testFile,
      testFile: testFile ? relative(ROOT, testFile) : null,
      isTestFile: isTest,
      isInTestDir: f.includes("__tests__"),
    });
  }

  // Analyze code quality
  const quality = analyzeCodeQuality(allSource);

  // Run vitest frontend
  const feResult = await runVitest(resolve(ROOT, "apps/frontend"), "frontend");
  const beResult = await runVitest(resolve(ROOT, "apps/backend"), "backend");

  // Run lint
  const lintResult = runLint();
  const tsResult = runTypeCheck();

  // Calculate coverage percentage (source files only, not test files)
  const sourceFilesOnly = fileAnalysis.filter(f => !f.isTestFile);
  const sourceFilesWithTests = sourceFilesOnly.filter(f => f.hasTest).length;
  const totalSourceFiles = sourceFilesOnly.length;
  const coveragePct = totalSourceFiles > 0 ? Math.round((sourceFilesWithTests / totalSourceFiles) * 10000) / 100 : 0;

  const totalLines = allSource.reduce((s, f) => {
    try { return s + readFileSync(f, "utf-8").split("\n").length; } catch { return s; }
  }, 0);

  // Untested files (source files only)
  const untested = sourceFilesOnly.filter(f => !f.hasTest);

  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - now,
    summary: {
      totalFiles: totalSourceFiles,
      totalLines,
      totalTestFiles: fileAnalysis.filter(f => f.isTestFile).length,
      filesWithTests: sourceFilesWithTests,
      filesWithoutTests: untested.length,
      testCoveragePct: coveragePct,
      totalFunctions: quality.totalFunctions,
      totalImports: quality.totalImports,
    },
    tests: {
      frontend: {
        ok: feResult.ok,
        total: feResult.summary.total,
        passed: feResult.summary.passed,
        failed: feResult.summary.failed,
        skipped: feResult.summary.skipped,
        files: feResult.summary.files,
      },
      backend: {
        ok: beResult.ok,
        total: beResult.summary.total,
        passed: beResult.summary.passed,
        failed: beResult.summary.failed,
        skipped: beResult.summary.skipped,
        files: beResult.summary.files,
      },
    },
    quality: {
      lint: lintResult,
      typescript: tsResult,
    },
    coverage: {
      pct: coveragePct,
      filesWithTests: sourceFilesWithTests,
      totalFiles: totalSourceFiles,
    },
    untestedFiles: untested.map(f => ({ file: f.file, lines: f.lines })),
    files: fileAnalysis.sort((a, b) => a.file.localeCompare(b.file)),
  };

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  generateHtmlReport(report);
  testCache = report;
  return report;
}

function generateHtmlReport(report) {
  const { summary, tests, quality, untestedFiles } = report;

  const feBadge = tests.frontend.ok ? "✅" : "❌";
  const beBadge = tests.backend.ok ? "✅" : "❌";
  const lintBadge = quality.lint.ok ? "✅" : "❌";
  const tsBadge = quality.typescript.ok ? "✅" : "❌";
  const coveragePct = summary.testCoveragePct;

  let color = "#22c55e";
  if (coveragePct < 30) color = "#ef4444";
  else if (coveragePct < 60) color = "#f59e0b";

  const untestedRows = untestedFiles.slice(0, 100).map(f =>
    `<tr><td>${f.file}</td><td>${f.lines}</td><td style="color:#ef4444">❌ No test</td></tr>`
  ).join("");

  const fileRows = report.files.slice(0, 500).map(f => {
    const status = f.isTestFile ? "🧪 Test file" : (f.hasTest ? "✅ Tested" : "❌ Untested");
    const color = f.isTestFile ? "#8b5cf6" : (f.hasTest ? "#22c55e" : "#ef4444");
    return `<tr><td>${f.file}</td><td>${f.lines}</td><td style="color:${color}">${status}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>QA Test Report - InsightFlow</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,sans-serif; background:#0f172a; color:#e2e8f0; padding:20px; }
.container { max-width:1400px; margin:0 auto; }
h1 { font-size:24px; font-weight:700; color:#f8fafc; margin-bottom:20px; }
h2 { font-size:18px; font-weight:600; color:#94a3b8; margin:20px 0 10px; }
.header-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
.card { background:#1e293b; border-radius:12px; padding:16px; border:1px solid #334155; }
.card h3 { font-size:14px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
.card .value { font-size:28px; font-weight:700; color:#f8fafc; }
.card .sub { font-size:12px; color:#64748b; margin-top:4px; }
.grid-4 { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
.grid-2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { text-align:left; padding:8px 12px; background:#334155; color:#94a3b8; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; position:sticky; top:0; }
td { padding:8px 12px; border-bottom:1px solid #1e293b; font-family:monospace; }
tr:hover { background:#1e293b; }
.pass { color:#22c55e; }
.fail { color:#ef4444; }
.skip { color:#f59e0b; }
.progress-bar { height:8px; background:#334155; border-radius:4px; overflow:hidden; margin-top:8px; }
.progress-fill { height:100%; background:${color}; border-radius:4px; transition:width .3s; width:${coveragePct}%; }
.coverage-ring { display:flex; align-items:center; gap:16px; }
.coverage-number { font-size:48px; font-weight:700; }
.coverage-label { font-size:14px; color:#94a3b8; }
.coverage-ring .color-dot { width:16px; height:16px; border-radius:50%; background:${color}; }
.footer { margin-top:20px; text-align:center; font-size:12px; color:#475569; border-top:1px solid #1e293b; padding-top:16px; }
.timestamp { font-size:12px; color:#64748b; margin-bottom:16px; }
.tabs { display:flex; gap:4px; margin-bottom:16px; }
.tab { padding:8px 16px; background:#1e293b; border:1px solid #334155; border-radius:8px; cursor:pointer; font-size:13px; color:#94a3b8; }
.tab.active { background:#334155; color:#f8fafc; border-color:#475569; }
.untested-count { color:#ef4444; font-weight:700; }
.coverage-good { color:#22c55e; }
.coverage-warn { color:#f59e0b; }
.coverage-bad { color:#ef4444; }
.scroll-table { max-height:600px; overflow-y:auto; border:1px solid #334155; border-radius:8px; }
</style>
</head>
<body>
<div class="container">
<h1>🧪 InsightFlow — QA Test Report</h1>
<div class="timestamp">Generated: ${report.timestamp} | Duration: ${report.duration}ms</div>

<div class="grid-4">
  <div class="card">
    <h3>Total Files</h3>
    <div class="value">${summary.totalFiles}</div>
    <div class="sub">${summary.totalLines.toLocaleString()} lines of code</div>
  </div>
  <div class="card">
    <h3>Test Files</h3>
    <div class="value">${summary.totalTestFiles}</div>
    <div class="sub">${summary.filesWithTests} source files covered</div>
  </div>
  <div class="card">
    <h3>Code Coverage</h3>
    <div class="coverage-ring">
      <div class="coverage-number ${coveragePct >= 60 ? 'coverage-good' : coveragePct >= 30 ? 'coverage-warn' : 'coverage-bad'}">${coveragePct}%</div>
      <div class="coverage-label">files tested</div>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>
  <div class="card">
    <h3>Untested Files</h3>
    <div class="value untested-count">${summary.filesWithoutTests}</div>
    <div class="sub">out of ${summary.totalFiles} total</div>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <h3>${feBadge} Frontend Tests (vitest)</h3>
    <div style="font-size:24px;font-weight:700">
      <span class="pass">${tests.frontend.passed}</span> /
      <span>${tests.frontend.total}</span>
      <span style="font-size:14px;color:#94a3b8">passed</span>
    </div>
    ${tests.frontend.failed > 0 ? `<div style="color:#ef4444;font-size:14px">${tests.frontend.failed} failed</div>` : ''}
    ${tests.frontend.skipped > 0 ? `<div style="color:#f59e0b;font-size:14px">${tests.frontend.skipped} skipped</div>` : ''}
    <div style="font-size:12px;color:#64748b;margin-top:4px">Files: ${tests.frontend.files.length}</div>
  </div>
  <div class="card">
    <h3>${beBadge} Backend Tests (vitest)</h3>
    <div style="font-size:24px;font-weight:700">
      <span class="pass">${tests.backend.passed}</span> /
      <span>${tests.backend.total}</span>
      <span style="font-size:14px;color:#94a3b8">passed</span>
    </div>
    ${tests.backend.failed > 0 ? `<div style="color:#ef4444;font-size:14px">${tests.backend.failed} failed</div>` : ''}
    ${tests.backend.skipped > 0 ? `<div style="color:#f59e0b;font-size:14px">${tests.backend.skipped} skipped</div>` : ''}
    <div style="font-size:12px;color:#64748b;margin-top:4px">Files: ${tests.backend.files.length}</div>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <h3>${lintBadge} ESLint</h3>
    <div style="font-size:20px;font-weight:700">${quality.lint.errorCount} errors / ${quality.lint.warnCount} warnings</div>
  </div>
  <div class="card">
    <h3>${tsBadge} TypeScript</h3>
    <div style="font-size:20px;font-weight:700">${quality.typescript.errors} errors</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">tsc --noEmit</div>
  </div>
</div>

<h2>📂 File Coverage Report ${summary.filesWithoutTests > 0 ? `<span style="color:#ef4444;font-size:14px;font-weight:400">(${summary.filesWithoutTests} untested)</span>` : ''}</h2>
<div class="card scroll-table">
<table>
<thead><tr><th>File</th><th>Lines</th><th>Status</th></tr></thead>
<tbody>${fileRows}</tbody>
</table>
</div>

${untestedFiles.length > 0 ? `
<h2>⚠️ Untested Files (${untestedFiles.length})</h2>
<div class="card scroll-table" style="max-height:400px">
<table>
<thead><tr><th>File</th><th>Lines</th><th>Status</th></tr></thead>
<tbody>${untestedRows}</tbody>
</table>
</div>` : ''}

<div class="footer">
  InsightFlow QA Tester — Every line matters. Generated at ${report.timestamp}
</div>
</div>
</body>
</html>`;

  writeFileSync(HTML_REPORT_FILE, html);
}

function printReport(report) {
  const { summary, tests, quality, untestedFiles } = report;

  const feStatus = tests.frontend.ok ? "PASS" : "FAIL";
  const beStatus = tests.backend.ok ? "PASS" : "FAIL";
  const lintStatus = quality.lint.ok ? "PASS" : "FAIL";
  const tsStatus = quality.typescript.ok ? "PASS" : "FAIL";

  console.clear();
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║        INSIGHTFLOW — FULL QA TEST REPORT               ║");
  console.log("  ╚══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Generated : ${report.timestamp}`);
  console.log(`  Duration  : ${report.duration}ms`);
  console.log("");

  // Summary
  const covColor = summary.testCoveragePct >= 60 ? "✓" : summary.testCoveragePct >= 30 ? "!" : "✗";
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log("  │  SUMMARY                                               │");
  console.log("  ├─────────────────────────────────────────────────────────┤");
  console.log(`  │  Total Source Files    : ${String(summary.totalFiles).padEnd(10)}    Lines of Code: ${String(summary.totalLines).padEnd(8)} │`);
  console.log(`  │  Test Files            : ${String(summary.totalTestFiles).padEnd(10)}    Functions    : ${String(summary.totalFunctions).padEnd(8)} │`);
  console.log(`  │  Files With Tests      : ${String(summary.filesWithTests).padEnd(10)}    Imports      : ${String(summary.totalImports).padEnd(8)} │`);
  console.log(`  │  Files Without Tests   : ${String(summary.filesWithoutTests).padEnd(10)}                           │`);
  console.log(`  │  ${covColor}  Test Coverage       : ${String(summary.testCoveragePct + "%").padEnd(10)}                           │`);
  console.log("  └─────────────────────────────────────────────────────────┘");
  console.log("");

  // Test results
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log("  │  TEST SUITES                                           │");
  console.log("  ├─────────────────────────────────────────────────────────┤");
  console.log(`  │  ${feStatus}  Frontend (vitest)  : ${String(tests.frontend.passed).padStart(4)}/${String(tests.frontend.total).padEnd(4)} passed  ${tests.frontend.failed > 0 ? tests.frontend.failed + " failed" : ""}  ${tests.frontend.skipped > 0 ? tests.frontend.skipped + " skipped" : ""} │`);
  console.log(`  │  ${beStatus}  Backend  (vitest)  : ${String(tests.backend.passed).padStart(4)}/${String(tests.backend.total).padEnd(4)} passed  ${tests.backend.failed > 0 ? tests.backend.failed + " failed" : ""}  ${tests.backend.skipped > 0 ? tests.backend.skipped + " skipped" : ""} │`);
  console.log(`  │  ${lintStatus}  ESLint            : ${String(quality.lint.errorCount).padStart(4)} errors, ${String(quality.lint.warnCount).padEnd(4)} warnings              │`);
  console.log(`  │  ${tsStatus}  TypeScript        : ${String(quality.typescript.errors).padStart(4)} errors                              │`);
  console.log("  └─────────────────────────────────────────────────────────┘");
  console.log("");

  // Untested files
  if (untestedFiles.length > 0) {
    console.log("  ┌─────────────────────────────────────────────────────────┐");
    console.log(`  │  ⚠️  UNTESTED FILES (${String(untestedFiles.length).padStart(3)})                               │`);
    console.log("  ├─────────────────────────────────────────────────────────┤");
    const show = untestedFiles.slice(0, 25);
    for (const uf of show) {
      const short = uf.file.length > 55 ? "..." + uf.file.slice(-52) : uf.file;
      console.log(`  │  ❌  ${short.padEnd(55)} ${String(uf.lines).padStart(4)}L │`);
    }
    if (untestedFiles.length > 25) {
      console.log(`  │  ... and ${untestedFiles.length - 25} more untested files                   │`);
    }
    console.log("  └─────────────────────────────────────────────────────────┘");
    console.log("");
  }

  // Files with tests
  const testedFiles = report.files.filter(f => f.hasTest && !f.isTestFile);
  if (testedFiles.length > 0) {
    console.log("  ┌─────────────────────────────────────────────────────────┐");
    console.log(`  │  ✅  TESTED  (${String(testedFiles.length).padStart(3)} files)                                  │`);
    console.log("  ├─────────────────────────────────────────────────────────┤");
    const show = testedFiles.slice(0, 20);
    for (const tf of show) {
      const short = tf.file.length > 55 ? "..." + tf.file.slice(-52) : tf.file;
      console.log(`  │  ✅  ${short.padEnd(55)} ${String(tf.lines).padStart(4)}L │`);
    }
    if (testedFiles.length > 20) {
      console.log(`  │  ... and ${testedFiles.length - 20} more tested files                   │`);
    }
    console.log("  └─────────────────────────────────────────────────────────┘");
    console.log("");
  }

  console.log(`  📄  Full reports saved to:`);
  console.log(`      JSON: ${REPORT_FILE}`);
  console.log(`      HTML: ${HTML_REPORT_FILE}`);
  console.log("");
  console.log("  ───────────────────────────────────────────────────────────");
  console.log("  Press [Enter] to re-run all tests and update this report.");
  console.log("  Press [Ctrl+C] to exit.");
  console.log("");
}

async function main() {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║     INSIGHTFLOW QA TESTER — Initializing...             ║");
  console.log("  ╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // First run
  const report = await runAllTests();
  printReport(report);

  // Interactive mode
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", async () => {
    const r = await runAllTests();
    printReport(r);
  });

  rl.on("SIGINT", () => {
    console.log("\n\n  QA Tester exiting. Reports saved in reports/qa-reports/\n");
    process.exit(0);
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
