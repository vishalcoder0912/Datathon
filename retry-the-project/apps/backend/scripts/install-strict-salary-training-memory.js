#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const memoryPath = path.resolve(process.cwd(), "data", "schema-training-memory.json");
const strictPath = path.resolve(process.cwd(), "data", "schema-training-memory.salary-strict.json");

if (!fs.existsSync(strictPath)) {
  console.error(`Missing ${strictPath}`);
  process.exit(1);
}

const strictEntries = JSON.parse(fs.readFileSync(strictPath, "utf8"));
const current = fs.existsSync(memoryPath)
  ? JSON.parse(fs.readFileSync(memoryPath, "utf8"))
  : [];

const byId = new Map(current.map((entry) => [entry.id, entry]));

for (const entry of strictEntries) {
  byId.set(entry.id, {
    ...byId.get(entry.id),
    ...entry,
    updatedAt: new Date().toISOString(),
  });
}

fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
fs.writeFileSync(memoryPath, JSON.stringify([...byId.values()], null, 2));

console.log(`✅ Installed strict schema dashboard memory: ${strictEntries.map((item) => item.name).join(", ")}`);
console.log(`✅ Memory file: ${memoryPath}`);