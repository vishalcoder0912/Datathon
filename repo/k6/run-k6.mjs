import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = resolve(__dirname, '..', 'reports');

mkdirSync(REPORTS_DIR, { recursive: true });

const K6 = process.platform === 'win32' ? 'k6.exe' : 'k6';

const suites = [
  { name: 'health-check', script: 'health-check.js', vus: '1', extra: '' },
  { name: 'health-check-stress', script: 'health-check.js', vus: '500', extra: '-e DURATION=2m' },
  { name: 'auth-flow', script: 'auth-flow.js', vus: '100', extra: '' },
  { name: 'auth-flow-heavy', script: 'auth-flow.js', vus: '1000', extra: '' },
  { name: 'api-endpoints', script: 'api-endpoints.js', vus: '50', extra: '' },
  { name: 'api-endpoints-heavy', script: 'api-endpoints.js', vus: '500', extra: '' },
  { name: 'ai-endpoints', script: 'ai-endpoints.js', vus: '100', extra: '' },
  { name: 'ai-endpoints-heavy', script: 'ai-endpoints.js', vus: '500', extra: '' },
  { name: 'file-upload', script: 'file-upload.js', vus: '50', extra: '' },
];

const results = [];

for (const suite of suites) {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Running: ${suite.name}`);
  console.log(`═══════════════════════════════════════\n`);

  const cmd = `${K6} run ${suite.extra} -e VU=${suite.vus} --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" ${resolve(__dirname, suite.script)}`;

  try {
    const output = execSync(cmd, {
      cwd: __dirname,
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 600000,
      encoding: 'utf-8',
    });

    results.push({ name: suite.name, status: 'PASS', output: output.trim() });
    console.log(`\n✅ ${suite.name}: PASS`);
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    results.push({ name: suite.name, status: 'FAIL', output: stdout + '\n' + stderr });
    console.log(`\n❌ ${suite.name}: FAIL - ${err.message}`);
  }
}

console.log(`\n═══════════════════════════════════════`);
console.log(`  K6 LOAD TEST SUMMARY`);
console.log(`═══════════════════════════════════════\n`);

let passed = 0;
let failed = 0;

for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${r.name}: ${r.status}`);
  if (r.status === 'PASS') passed++;
  else failed++;
}

const summary = {
  timestamp: new Date().toISOString(),
  total: results.length,
  passed,
  failed,
  results: results.map(r => ({ name: r.name, status: r.status })),
};

writeFileSync(resolve(REPORTS_DIR, 'k6-summary.json'), JSON.stringify(summary, null, 2));
console.log(`\n📊 Report saved to reports/k6-summary.json`);
console.log(`\n✅ Passed: ${passed}/${results.length}`);
if (failed > 0) console.log(`❌ Failed: ${failed}/${results.length}`);
process.exit(failed > 0 ? 1 : 0);
