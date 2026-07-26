#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

function httpGet(url, timeout = 10000) {
  return new Promise((resolvePromise, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolvePromise({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

const CHECKS = [];

function check(name, fn) {
  CHECKS.push({ name, fn });
}

check('Backend Health', async () => {
  const host = process.env.BACKEND_HOST || process.env.DEPLOY_URL || 'http://localhost:3001';
  const { status, body } = await httpGet(`${host}/health`);
  if (status !== 200) throw new Error(`Backend returned ${status}: ${body.slice(0, 200)}`);
  return { status, detail: body.slice(0, 200) };
});

check('Database Connectivity', async () => {
  const host = process.env.BACKEND_HOST || 'http://localhost:3001';
  const { status, body } = await httpGet(`${host}/api/health/db`);
  if (status !== 200) throw new Error(`DB health check failed: ${status}`);
  const parsed = JSON.parse(body);
  if (!parsed.connected && !parsed.ok && !parsed.status === 'healthy') {
    throw new Error(`DB not connected: ${body.slice(0, 200)}`);
  }
  return { status, detail: 'Database connected' };
});

check('AI Provider Status', async () => {
  const host = process.env.BACKEND_HOST || 'http://localhost:3001';
  const { status, body } = await httpGet(`${host}/api/health/ai`);
  if (status >= 500) throw new Error(`AI provider check failed: ${status}`);
  return { status, detail: body.slice(0, 200) };
});

check('Qdrant Vector DB', async () => {
  const host = process.env.QDRANT_URL || 'http://localhost:6333';
  const { status } = await httpGet(`${host}/healthz`);
  if (status !== 200) throw new Error(`Qdrant returned ${status}`);
  return { status, detail: 'Qdrant healthy' };
});

check('ML Service', async () => {
  const host = process.env.ML_SERVICE_URL || 'http://localhost:5000';
  try {
    const { status, body } = await httpGet(`${host}/health`, 5000);
    if (status !== 200) throw new Error(`ML returned ${status}`);
    return { status, detail: body.slice(0, 200) };
  } catch {
    return { status: 503, detail: 'ML service not available (optional)' };
  }
});

check('Frontend', async () => {
  const host = process.env.FRONTEND_URL || 'http://localhost:80';
  const { status } = await httpGet(host);
  if (status >= 500) throw new Error(`Frontend returned ${status}`);
  return { status, detail: 'Frontend reachable' };
});

async function main() {
  loadEnv();
  const mode = process.argv.includes('--smoke') ? 'smoke' :
               process.argv.includes('--pre-deploy') ? 'pre-deploy' : 'full';
  console.log(`\n=== Health Check (${mode}) ===\n`);
  const results = [];
  let passed = 0;
  let failed = 0;
  for (const c of CHECKS) {
    try {
      const result = await c.fn();
      results.push({ name: c.name, ok: true, ...result });
      console.log(`  ✅ ${c.name}`);
      passed++;
    } catch (err) {
      results.push({ name: c.name, ok: false, error: err.message });
      console.log(`  ❌ ${c.name}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Health check runner failed:', err);
  process.exit(1);
});
