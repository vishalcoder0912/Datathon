#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLECTION = path.join(__dirname, "insightflow-api.postman_collection.json");
const ENVIRONMENT = path.join(__dirname, "insightflow-api.postman_environment.json");
const REPORT_DIR = path.resolve(__dirname, "..", "reports", "newman");

function run() {
  console.log("[newman] Running InsightFlow API collection...\n");

  const args = [
    `npx newman run "${COLLECTION}"`,
    `--environment "${ENVIRONMENT}"`,
    `--reporters cli,htmlextra,json`,
    `--reporter-htmlextra-export "${path.join(REPORT_DIR, "report.html")}"`,
    `--reporter-json-export "${path.join(REPORT_DIR, "report.json")}"`,
    `--delay-request 100`,
    `--timeout 30000`,
    `--bail`,
  ].join(" ");

  try {
    const result = execSync(args, {
      stdio: "inherit",
      cwd: __dirname,
      env: {
        ...process.env,
        FORCE_COLOR: "1",
      },
    });
    console.log("\n[newman] All API tests passed!");
    process.exit(0);
  } catch (err) {
    console.error("\n[newman] API tests failed:", err.message);
    process.exit(1);
  }
}

// Ensure report directory exists
import fs from "fs";
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

run();
