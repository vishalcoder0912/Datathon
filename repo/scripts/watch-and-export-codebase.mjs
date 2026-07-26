import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPORT_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'export-full-codebase-one-file.js');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'PROJECT_FULL_CODEBASE_ONE_FILE.md');

const DEBOUNCE_MS = 2000;
const POLL_INTERVAL_MS = 5000;

const INCLUDED_EXTENSIONS = new Set([
  '.bat', '.cjs', '.css', '.html', '.js', '.jsx', '.json',
  '.md', '.mjs', '.ps1', '.py', '.scss', '.sh', '.ts', '.tsx', '.yaml', '.yml',
]);

const IGNORED_DIRECTORIES = new Set([
  '.agents', '.claude', '.cursor', '.firebase', '.git', '.next',
  '.pytest_cache', '.tmp_schema_trained_patch', '.vscode', '.windsurf',
  'build', 'coverage', 'data', 'dist', 'dist-ssr', 'exports', 'logs',
  'node_modules', 'playwright-report', 'reports', 'uploads',
]);

let debounceTimer = null;
let exportsInProgress = false;
let pendingExport = false;

function isValidChange(absolutePath) {
  const ext = path.extname(absolutePath).toLowerCase();
  const fileName = path.basename(absolutePath);
  const dirName = path.dirname(absolutePath);

  if (fileName.startsWith('.')) return false;
  if (fileName === 'PROJECT_FULL_CODEBASE_ONE_FILE.md') return false;

  if (!INCLUDED_EXTENSIONS.has(ext) && !['.env.example', 'Modelfile', 'Dockerfile', '.gitignore'].includes(fileName)) {
    return false;
  }

  const relative = path.relative(PROJECT_ROOT, absolutePath);
  const parts = relative.split(path.sep);

  for (const part of parts.slice(0, -1)) {
    if (IGNORED_DIRECTORIES.has(part)) return false;
  }

  return true;
}

async function runExport() {
  if (exportsInProgress) {
    pendingExport = true;
    return;
  }

  exportsInProgress = true;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn('node', [EXPORT_SCRIPT], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          const stats = fs.statSync(OUTPUT_FILE);
          const ts = new Date().toLocaleTimeString();
          console.log(`[${ts}] Codebase regenerated | ${stdout.trim()} | ${(stats.size / 1024).toFixed(1)} KB | ${stats.size > 0 ? (fs.readFileSync(OUTPUT_FILE, 'utf8').split('\n').length.toLocaleString()) : 0} lines`);
          resolve();
        } else {
          console.error(`Export failed (exit ${code}): ${stderr}`);
          reject(new Error(stderr));
        }
      });

      child.on('error', reject);
    });
  } catch (err) {
    console.error('Export error:', err.message);
  } finally {
    exportsInProgress = false;

    if (pendingExport) {
      pendingExport = false;
      setImmediate(() => runExport());
    }
  }
}

function onFileChange(eventType, fileName) {
  if (!fileName) return;

  const absolutePath = path.resolve(PROJECT_ROOT, fileName);

  if (!isValidChange(absolutePath)) return;

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    const relative = path.relative(PROJECT_ROOT, absolutePath);
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] Change detected: ${relative}`);
    runExport();
  }, DEBOUNCE_MS);
}

async function startWatcher() {
  console.log('='.repeat(60));
  console.log('  InsightFlow Codebase Watcher');
  console.log('='.repeat(60));
  console.log(`  Root: ${PROJECT_ROOT}`);
  console.log(`  Output: ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
  console.log(`  Watch extensions: ${[...INCLUDED_EXTENSIONS].join(', ')}`);
  console.log(`  Debounce: ${DEBOUNCE_MS}ms`);
  console.log(`  Poll fallback: ${POLL_INTERVAL_MS}ms`);
  console.log('-'.repeat(60));
  console.log('  Watching for changes... (Ctrl+C to stop)');
  console.log(`  Initial export runs now...`);
  console.log('-'.repeat(60));

  await runExport();

  try {
    const watcher = fs.watch(PROJECT_ROOT, { recursive: true });
    watcher.on('change', onFileChange);
    watcher.on('error', (err) => {
      console.error('Watcher error:', err.message);
      startPollingFallback();
    });

    process.on('SIGINT', () => {
      console.log('\nWatcher stopped.');
      watcher.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      watcher.close();
      process.exit(0);
    });

    console.log('Using native fs.watch (recursive)');
  } catch (err) {
    console.warn(`fs.watch recursive not available: ${err.message}`);
    console.warn('Falling back to polling mode...');
    startPollingFallback();
  }
}

function startPollingFallback() {
  const fileCache = new Map();
  let initialScanDone = false;

  async function scanAndExport() {
    const changedFiles = [];

    async function walk(dir) {
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (!isValidChange(fullPath)) continue;

          let mtime;
          try {
            const stat = await fsp.stat(fullPath);
            mtime = stat.mtimeMs;
          } catch {
            continue;
          }

          const cached = fileCache.get(fullPath);
          if (cached !== mtime) {
            fileCache.set(fullPath, mtime);
            if (initialScanDone) {
              changedFiles.push(path.relative(PROJECT_ROOT, fullPath));
            }
          }
        }
      }
    }

    await walk(PROJECT_ROOT);

    if (initialScanDone && changedFiles.length > 0) {
      const ts = new Date().toLocaleTimeString();
      console.log(`[${ts}] Changes detected (${changedFiles.length} file(s))`);
      if (changedFiles.length <= 3) {
        changedFiles.forEach((f) => console.log(`  - ${f}`));
      } else {
        changedFiles.slice(0, 3).forEach((f) => console.log(`  - ${f}`));
        console.log(`  ... and ${changedFiles.length - 3} more`);
      }
      await runExport();
    }

    initialScanDone = true;
  }

  scanAndExport();
  setInterval(scanAndExport, POLL_INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\nPolling watcher stopped.');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}

startWatcher();
