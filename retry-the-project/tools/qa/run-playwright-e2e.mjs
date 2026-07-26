import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const frontendCwd = path.join(root, "apps", "frontend");
const url = "http://127.0.0.1:5173";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isReady() {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await isReady()) return;
    await wait(250);
  }
  throw new Error(`Frontend dev server did not become ready at ${url}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const serverAlreadyRunning = await isReady();
const server = serverAlreadyRunning
  ? null
  : spawn("npx", ["vite", "--host", "127.0.0.1"], {
      cwd: frontendCwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

if (server) {
  server.stdout.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await run("npx", ["playwright", "test", "--config", "playwright.config.ts"], { cwd: root });
} finally {
  if (server?.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  }
}

process.exit(exitCode);
