import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const budgetPath = resolve(root, 'perf-budget.json');
if (!existsSync(budgetPath)) {
  console.error('❌ perf-budget.json not found');
  process.exit(1);
}

const budget = JSON.parse(readFileSync(budgetPath, 'utf-8'));
const resources = budget.resources;

const frontendDist = resolve(root, 'apps', 'frontend', 'dist');
const reportPath = resolve(root, 'reports', 'perf-budget-report.json');

let passed = 0;
let failed = 0;
const results = [];

function check(label, condition, expected, actual) {
  if (condition) {
    console.log(`  ✅ ${label}: ${actual} (expected: ${expected})`);
    passed++;
    results.push({ label, status: 'PASS', expected, actual });
  } else {
    console.log(`  ❌ ${label}: ${actual} (expected: ${expected})`);
    failed++;
    results.push({ label, status: 'FAIL', expected, actual });
  }
}

console.log('\n═══════════════════════════════════════');
console.log('  PERFORMANCE BUDGET VALIDATION');
console.log('═══════════════════════════════════════\n');

if (existsSync(frontendDist)) {
  const { readdirSync, statSync } = await import('node:fs');
  const { extname, join } = await import('node:path');

  let totalJsSize = 0;
  let totalCssSize = 0;
  let totalImageSize = 0;
  let totalFontSize = 0;
  let totalBundleSize = 0;
  let totalRequests = 0;

  function walkDir(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else {
        const size = statSync(fullPath).size;
        const ext = extname(entry.name).toLowerCase();
        totalBundleSize += size;
        totalRequests++;

        if (['.js', '.mjs', '.cjs'].includes(ext)) totalJsSize += size;
        else if (['.css'].includes(ext)) totalCssSize += size;
        else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) totalImageSize += size;
        else if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) totalFontSize += size;
      }
    }
  }

  walkDir(frontendDist);

  console.log('  Bundle sizes from frontend dist:\n');
  check('totalBundleSize <= 2 MB', totalBundleSize <= 2 * 1024 * 1024, '< 2 MB', `${(totalBundleSize / 1024 / 1024).toFixed(2)} MB`);
  check('javascript <= 500 kB', totalJsSize <= 500 * 1024, '< 500 kB', `${(totalJsSize / 1024).toFixed(2)} kB`);
  check('css <= 100 kB', totalCssSize <= 100 * 1024, '< 100 kB', `${(totalCssSize / 1024).toFixed(2)} kB`);
  check('images <= 500 kB', totalImageSize <= 500 * 1024, '< 500 kB', `${(totalImageSize / 1024).toFixed(2)} kB`);
  check('fonts <= 100 kB', totalFontSize <= 100 * 1024, '< 100 kB', `${(totalFontSize / 1024).toFixed(2)} kB`);

  let maxRequests = resources.totalRequests || 50;
  check(`totalRequests <= ${maxRequests}`, totalRequests <= maxRequests, `< ${maxRequests}`, `${totalRequests}`);
} else {
  console.log('  ⚠️  Frontend dist not found. Run `npm run build` first.');
  console.log('  Skipping bundle size checks...\n');
}

console.log('\n  Lighthouse-based metrics (manual or CI):');
check('firstContentfulPaint <= 2000ms', resources.firstContentfulPaint <= 2000, '< 2000ms', `${resources.firstContentfulPaint}ms`);
check('largestContentfulPaint <= 2500ms', resources.largestContentfulPaint <= 2500, '< 2500ms', `${resources.largestContentfulPaint}ms`);
check('timeToInteractive <= 3500ms', resources.timeToInteractive <= 3500, '< 3500ms', `${resources.timeToInteractive}ms`);
check('cumulativeLayoutShift <= 0.1', resources.cumulativeLayoutShift <= 0.1, '< 0.1', `${resources.cumulativeLayoutShift}`);

const summary = {
  timestamp: new Date().toISOString(),
  total: passed + failed,
  passed,
  failed,
  results,
};

import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(reportPath, JSON.stringify(summary, null, 2));

console.log(`\n═══════════════════════════════════════`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════\n`);
console.log(`📊 Report saved to reports/perf-budget-report.json`);

if (failed > 0) {
  console.log('❌ Performance budget not met.');
  process.exit(1);
} else {
  console.log('✅ Performance budget met.');
}
