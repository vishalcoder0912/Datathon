#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VERSIONS_FILE = resolve(ROOT, '.catalyst-versions.json');

function log(msg, type = 'INFO') {
  console.log(`[${new Date().toISOString()}] [${type}] ${msg}`);
}

function run(cmd, opts = {}) {
  log(`Running: ${cmd}`);
  try {
    return execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 120000, ...opts }).toString().trim();
  } catch (err) {
    log(`Command failed: ${cmd}\n${err.stderr?.toString() || err.message}`, 'ERROR');
    throw err;
  }
}

function getPreviousVersion() {
  if (!existsSync(VERSIONS_FILE)) {
    log('No versions file found. Nothing to roll back to.', 'WARN');
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(VERSIONS_FILE, 'utf-8'));
    return data.previous || null;
  } catch {
    log('Invalid versions file', 'ERROR');
    return null;
  }
}

function catalystLogin() {
  const email = process.env.CATALYST_EMAIL;
  const password = process.env.CATALYST_PASSWORD;
  if (!email || !password) {
    log('CATALYST_EMAIL and CATALYST_PASSWORD required', 'ERROR');
    return false;
  }
  try {
    run(`catalyst login --email "${email}" --password "${password}"`);
    return true;
  } catch {
    log('Catalyst login failed during rollback', 'ERROR');
    return false;
  }
}

function rollbackDeploy() {
  const env = process.env.DEPLOY_ENVIRONMENT || 'production';
  const projectName = process.env.CATALYST_PROJECT_NAME || 'kavach-ai';
  const prevVersion = getPreviousVersion();

  if (prevVersion) {
    log(`Rolling back to version: ${prevVersion}`);
    try {
      run(`catalyst deploy --project "${projectName}" --environment "${env}" --version "${prevVersion}"`);
      log(`Rolled back to version ${prevVersion}`);
      return true;
    } catch (err) {
      log(`Version rollback failed: ${err.message}`, 'ERROR');
    }
  } else {
    log('No previous version recorded, attempting fresh redeploy...', 'WARN');
    try {
      run(`catalyst deploy --project "${projectName}" --environment "${env}"`);
      log('Redeploy completed as rollback');
      return true;
    } catch (err) {
      log(`Redeploy rollback failed: ${err.message}`, 'ERROR');
    }
  }
  return false;
}

function sendNotification(success) {
  const msg = success
    ? `Rollback completed successfully at ${new Date().toISOString()}`
    : `Rollback FAILED at ${new Date().toISOString()} - manual intervention required`;

  log(msg);

  try {
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhook) {
      const payload = JSON.stringify({ text: msg });
      run(`curl -s -X POST -H 'Content-type: application/json' --data '${payload.replace(/'/g, "'\\''")}' '${slackWebhook}'`);
    }
  } catch {
    log('Failed to send notification', 'WARN');
  }
}

async function main() {
  log('=== Rollback Script ===');

  const ok = catalystLogin();
  if (!ok) {
    log('Cannot proceed with rollback without Catalyst login', 'ERROR');
    sendNotification(false);
    process.exit(1);
  }

  const success = rollbackDeploy();
  sendNotification(success);

  if (success) {
    log('Rollback completed');
    process.exit(0);
  } else {
    console.error('Rollback failed. Manual intervention required.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Rollback script crashed:', err);
  process.exit(1);
});
