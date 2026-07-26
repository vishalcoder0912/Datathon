#!/usr/bin/env node

import {
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
} from "../src/services/ai-analyst/schema-rag-retriever.js";

const salesDataset = {
  id: "demo-sales-schema",
  name: "Demo Sales Memory",
  columns: [
    { name: "region", type: "string", role: "category" },
    { name: "revenue", type: "number", role: "metric" },
    { name: "profit", type: "number", role: "metric" },
    { name: "order_date", type: "date", role: "date" },
  ],
  rows: [
    { region: "North", revenue: 1200, profit: 300, order_date: "2026-01-01" },
    { region: "South", revenue: 900, profit: 180, order_date: "2026-01-02" },
  ],
};

const salesDashboardPlan = {
  kpis: [
    { title: "Total Revenue", metric: "revenue", aggregation: "sum", format: "currency" },
    { title: "Total Profit", metric: "profit", aggregation: "sum", format: "currency" },
  ],
  charts: [
    { title: "Revenue by Region", type: "bar", xKey: "region", yKey: "revenue", aggregation: "sum" },
    { title: "Profit Trend", type: "line", xKey: "order_date", yKey: "profit", aggregation: "sum" },
  ],
};

const similarSchemaProfile = {
  datasetName: "Demo Similar Sales Query",
  domain: "sales",
  signature: "demo-similar-sales-query",
  rowCount: 0,
  columnCount: 4,
  columns: [
    { name: "market", type: "string", role: "category" },
    { name: "sales_amount", type: "number", role: "metric" },
    { name: "margin", type: "number", role: "metric" },
    { name: "date", type: "date", role: "date" },
  ],
};

const trained = await trainSchemaRagMemoryFromDataset({
  dataset: salesDataset,
  acceptedDashboardPlan: salesDashboardPlan,
  rating: "excellent",
  notes: "Qdrant schema RAG demo sales pattern.",
  source: "qdrant-demo",
  useOllama: true,
});

console.log("Trained memory:", trained.entry.id);

const retrieved = await retrieveSchemaRagMemories(similarSchemaProfile, {
  limit: 5,
  threshold: 0.55,
  useOllama: true,
});

console.log("Mode:", retrieved.mode || retrieved.stats?.mode || "json");
console.log("Matches:", retrieved.matches.map((match) => ({
  id: match.entry.id,
  datasetName: match.entry.datasetName || match.entry.name,
  score: match.score,
  charts: match.entry.dashboardPlan?.charts?.map((chart) => chart.title) || [],
})));
