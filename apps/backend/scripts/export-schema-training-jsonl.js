#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { exportTrainingJsonl, getMemoryStats } from "../src/services/ai-analyst/schema-training-store.js";

const output = process.argv[2] || path.resolve(process.cwd(), "data", "schema-dashboard-training.jsonl");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, exportTrainingJsonl());
console.log(`✅ Wrote ${output}`);
console.log(getMemoryStats());
