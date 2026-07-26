import { buildSchemaProfile } from './apps/backend/src/services/ai-analyst/schema-fingerprint.js';
import { runDashboardCommand } from './apps/backend/src/services/ai-analyst/schema-trained-ai-service.js';

const salaryDataset = {
  id: "test-local",
  name: "Salary Small",
  columns: ["country", "salary_usd", "experience"],
  rows: [
    { country: "India", salary_usd: 50000, experience: 2 },
    { country: "USA", salary_usd: 90000, experience: 5 },
    { country: "India", salary_usd: 65000, experience: 3 },
  ],
};

const query = "Show salary by country";

const profile = buildSchemaProfile(salaryDataset);

// Let's import localCommand from schema-trained-ai-service.js
// Wait! localCommand is not exported, so let's replicate the logic:
const lower = query.toLowerCase();
const metric = profile.columns.find((column) => ["money_metric", "score_metric", "continuous_metric", "count_metric"].includes(column.role)) || null;
const category = profile.columns.find((column) => ["category", "location", "target", "numeric_category"].includes(column.role)) || null;

console.log("METRIC:", metric?.name, "CATEGORY:", category?.name);

import { parseCustomChartQuery } from './apps/backend/src/services/agentic-dashboard/custom-chart-query-parser.js';

// Since localCommand uses parseCustomChartQuery or custom parser logic:
const parsed = parseCustomChartQuery(query, profile);
console.log("PARSED BY CUSTOM PARSER:", JSON.stringify(parsed, null, 2));




