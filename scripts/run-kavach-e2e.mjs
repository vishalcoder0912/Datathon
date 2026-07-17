import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const frontendDirectory = resolve(repositoryRoot, 'apps/frontend');
const viteCli = resolve(repositoryRoot, 'node_modules/vite/bin/vite.js');
const playwrightCli = resolve(repositoryRoot, 'node_modules/@playwright/test/cli.js');
const frontendPort = 45173;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const startupTimeoutMs = 30_000;
const shutdownTimeoutMs = 5_000;

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const waitForServer = async () => {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(frontendUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for the KAVACH E2E frontend at ${frontendUrl}.`);
};

const closeProcessTree = async (child) => {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  if (process.platform === 'win32') {
    await Promise.race([
      new Promise((resolvePromise) => {
      const taskkill = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      taskkill.once('error', resolvePromise);
      taskkill.once('close', resolvePromise);
      }),
      wait(shutdownTimeoutMs),
    ]);
    child.stdout?.unpipe();
    child.stderr?.unpipe();
    child.stdout?.destroy();
    child.stderr?.destroy();
    return;
  }

  child.kill('SIGTERM');
};

const run = async () => {
  const vite = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: frontendDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  vite.stdout.pipe(process.stdout);
  vite.stderr.pipe(process.stderr);

  let exitCode = 1;
  try {
    await waitForServer();
    const playwright = spawn(process.execPath, [playwrightCli, 'test', 'e2e/kavach.spec.ts'], {
      cwd: repositoryRoot,
      env: {...process.env, PLAYWRIGHT_BASE_URL: frontendUrl},
      stdio: 'inherit',
      windowsHide: true,
    });

    exitCode = await new Promise((resolvePromise) => {
      playwright.once('error', () => resolvePromise(1));
      playwright.once('close', (code) => resolvePromise(code ?? 1));
    });
  } finally {
    await closeProcessTree(vite);
  }
  return exitCode;
};

run()
  .then((exitCode) => process.exit(exitCode))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
