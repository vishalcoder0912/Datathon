#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REQUIRED_VARS = [
  'CATALYST_EMAIL',
  'CATALYST_PASSWORD',
  'CATALYST_PROJECT_NAME',
];

const DEPLOY_DIR = resolve(ROOT, '.catalyst-deploy');
const BUILD_DIR = resolve(DEPLOY_DIR, 'build');
const FRONTEND_DIST = resolve(ROOT, 'apps', 'frontend', 'dist');

function log(msg, type = 'INFO') {
  console.log(`[${new Date().toISOString()}] [${type}] ${msg}`);
}

function run(cmd, opts = {}) {
  const defaultOpts = { cwd: ROOT, stdio: 'pipe', timeout: 300000, ...opts };
  log(`Running: ${cmd}`);
  try {
    const output = execSync(cmd, defaultOpts).toString().trim();
    if (output) log(output);
    return output;
  } catch (err) {
    log(`Command failed: ${cmd}\n${err.stderr?.toString() || err.message}`, 'ERROR');
    throw err;
  }
}

function validateEnv() {
  log('Validating environment variables...');
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  log('All required env vars present');
}

function preDeployTests() {
  log('Running pre-deploy tests...');
  try {
    run('node scripts/health-check.mjs --pre-deploy');
    log('Pre-deploy tests passed');
  } catch {
    console.error('Pre-deploy tests failed. Aborting deployment.');
    process.exit(1);
  }
}

function buildForDeploy() {
  log('Preparing deployment bundle...');

  if (!existsSync(FRONTEND_DIST)) {
    log('Frontend dist not found, building...');
    run('npm run build:frontend');
  }

  if (existsSync(DEPLOY_DIR)) {
    run(`rm -rf "${DEPLOY_DIR}"`);
  }

  run(`mkdir -p "${BUILD_DIR}"`);

  const deployItems = [
    'apps/backend',
    'packages',
    'package.json',
    'package-lock.json',
    'catalyst.json',
  ];

  for (const item of deployItems) {
    const src = resolve(ROOT, item);
    if (existsSync(src)) {
      run(`cp -r "${src}" "${BUILD_DIR}/"`);
    }
  }

  const catalystPublic = resolve(BUILD_DIR, 'catalyst', 'public');
  run(`mkdir -p "${catalystPublic}"`);
  run(`cp -r "${FRONTEND_DIST}/." "${catalystPublic}/"`);

  const catalystFunc = resolve(BUILD_DIR, 'catalyst', 'functions', 'api');
  run(`mkdir -p "${catalystFunc}"`);
  run(`cp -r "${BUILD_DIR}/apps/backend/." "${catalystFunc}/"`);
  run(`cp "${BUILD_DIR}/package.json" "${catalystFunc}/"`);

  log('Deployment bundle ready');
}

function catalystLogin() {
  log('Logging into Zoho Catalyst...');
  const email = process.env.CATALYST_EMAIL;
  const password = process.env.CATALYST_PASSWORD;

  const loginCmd = `catalyst login --email "${email}" --password "${password}"`;
  try {
    run(loginCmd, { cwd: BUILD_DIR });
    log('Catalyst login successful');
  } catch {
    log('Trying interactive login...', 'WARN');
    log('CATALYST_EMAIL and CATALYST_PASSWORD must be set for non-interactive login', 'ERROR');
    process.exit(1);
  }
}

function catalystDeploy() {
  log('Deploying to Zoho Catalyst...');
  const env = process.env.CATALYST_ENVIRONMENT || 'production';
  const deployCmd = `catalyst deploy --project "${process.env.CATALYST_PROJECT_NAME}" --environment "${env}"`;
  run(deployCmd, { cwd: BUILD_DIR });
  log('Deployment completed');
}

function smokeTest() {
  log('Running post-deploy smoke tests...');
  try {
    run('node scripts/health-check.mjs --smoke');
    log('Smoke tests passed');
  } catch {
    console.error('Smoke tests failed after deployment');
    console.log('Initiating rollback...');
    run('node scripts/rollback.mjs');
    process.exit(1);
  }
}

async function main() {
  log('=== Zoho Catalyst Deployment ===');
  validateEnv();
  preDeployTests();
  buildForDeploy();
  catalystLogin();
  catalystDeploy();
  smokeTest();
  log('=== Deployment completed successfully ===');
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
