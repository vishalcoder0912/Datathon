import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "apps", "backend", "data", "insightflow.sqlite");

console.log("Database path:", dbPath);
const db = new DatabaseSync(dbPath);

const datasets = db.prepare("SELECT * FROM datasets").all();
console.log("Datasets found:", datasets);

for (const ds of datasets) {
  const countRes = db.prepare("SELECT COUNT(*) as count FROM dataset_rows WHERE dataset_id = ?").get(ds.id);
  console.log(`Dataset ${ds.name} (id: ${ds.id}) has ${countRes.count} rows stored.`);
  
  // Let's sample rows containing France
  const rows = db.prepare("SELECT * FROM dataset_rows WHERE dataset_id = ? LIMIT 100").all(ds.id);
  console.log(`Sampled ${rows.length} rows from dataset ${ds.name}:`);
  let foundFrance = 0;
  for (const row of rows) {
    const data = JSON.parse(row.row_json);
    const country = data.country || data.Country || "";
    if (country.toLowerCase() === "france") {
      console.log(data);
      foundFrance++;
    }
  }
  console.log(`Found ${foundFrance} France rows in first 100 rows.`);
  
  // Get aggregate average salary by country for this dataset
  const allRows = db.prepare("SELECT * FROM dataset_rows WHERE dataset_id = ?").all(ds.id);
  const countrySalaries = {};
  for (const r of allRows) {
    const data = JSON.parse(r.row_json);
    const country = data.country || data.Country || "Unknown";
    const salary = Number(data.salary_usd || data.salary || 0);
    if (!countrySalaries[country]) {
      countrySalaries[country] = { total: 0, count: 0 };
    }
    countrySalaries[country].total += salary;
    countrySalaries[country].count += 1;
  }
  
  console.log("\nAggregated salaries by country:");
  for (const [c, info] of Object.entries(countrySalaries)) {
    console.log(`${c}: Avg=${(info.total / info.count).toFixed(2)}, Count=${info.count}`);
  }
}
