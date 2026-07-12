import { pathToFileURL } from "node:url";
import { trainSchemaRagMemoryFromDataset } from "../src/services/ai-analyst/schema-rag-retriever.js";

export const excelAnalystSeedDatasets = [
  {
    name: "Excel Sales Analyst Seed",
    dataset: {
      name: "Sales Excel Dataset",
      rows: [
        { date: "2026-01-01", product: "Laptop", region: "North", revenue: 120000, quantity: 4 },
        { date: "2026-01-02", product: "Phone", region: "South", revenue: 80000, quantity: 8 },
        { date: "2026-02-01", product: "Laptop", region: "North", revenue: 150000, quantity: 5 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Total Revenue", metric: "revenue", aggregation: "sum", format: "currency" },
        { title: "Average Revenue", metric: "revenue", aggregation: "avg", format: "currency" },
        { title: "Total Quantity", metric: "quantity", aggregation: "sum", format: "number" },
      ],
      charts: [
        { title: "Revenue by Product", type: "bar", xKey: "product", yKey: "revenue", aggregation: "sum" },
        { title: "Revenue by Region", type: "bar", xKey: "region", yKey: "revenue", aggregation: "sum" },
        { title: "Revenue Trend", type: "line", xKey: "date", yKey: "revenue", aggregation: "sum" },
      ],
    },
  },
  {
    name: "Excel Salary Analyst Seed",
    dataset: {
      name: "Salary Excel Dataset",
      rows: [
        { country: "India", experience: 2, education: "Bachelors", salary_usd: 50000 },
        { country: "USA", experience: 5, education: "Masters", salary_usd: 90000 },
        { country: "India", experience: 3, education: "Masters", salary_usd: 65000 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Average Salary", metric: "salary_usd", aggregation: "avg", format: "currency" },
        { title: "Median Salary", metric: "salary_usd", aggregation: "median", format: "currency" },
        { title: "Highest Salary", metric: "salary_usd", aggregation: "max", format: "currency" },
      ],
      charts: [
        { title: "Average Salary by Country", type: "bar", xKey: "country", yKey: "salary_usd", aggregation: "avg" },
        { title: "Salary by Experience", type: "scatter", xKey: "experience", yKey: "salary_usd", aggregation: "count" },
        { title: "Salary by Education", type: "bar", xKey: "education", yKey: "salary_usd", aggregation: "avg" },
      ],
    },
  },
  {
    name: "Excel Ecommerce Analyst Seed",
    dataset: {
      name: "Ecommerce Orders",
      rows: [
        { order_date: "2026-01-10", category: "Chocolate", customer_city: "Mumbai", order_value: 2500, units: 5 },
        { order_date: "2026-01-11", category: "Gift Box", customer_city: "Delhi", order_value: 4200, units: 3 },
        { order_date: "2026-02-03", category: "Chocolate", customer_city: "Mumbai", order_value: 3100, units: 6 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Total Order Value", metric: "order_value", aggregation: "sum", format: "currency" },
        { title: "Average Order Value", metric: "order_value", aggregation: "avg", format: "currency" },
        { title: "Total Units", metric: "units", aggregation: "sum", format: "number" },
      ],
      charts: [
        { title: "Order Value by Category", type: "bar", xKey: "category", yKey: "order_value", aggregation: "sum" },
        { title: "Order Value by City", type: "bar", xKey: "customer_city", yKey: "order_value", aggregation: "sum" },
        { title: "Order Trend", type: "line", xKey: "order_date", yKey: "order_value", aggregation: "sum" },
      ],
    },
  },
  {
    name: "Excel Inventory Analyst Seed",
    dataset: {
      name: "Inventory Dataset",
      rows: [
        { sku: "A-100", product: "Cocoa Box", warehouse: "Mumbai", category: "Food", stock: 120, reorder_level: 50, inventory_value: 24000 },
        { sku: "B-200", product: "Gift Wrap", warehouse: "Delhi", category: "Packaging", stock: 30, reorder_level: 40, inventory_value: 4500 },
        { sku: "C-300", product: "Truffle Box", warehouse: "Mumbai", category: "Food", stock: 75, reorder_level: 35, inventory_value: 37500 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Total Stock", metric: "stock", aggregation: "sum", format: "number" },
        { title: "Inventory Value", metric: "inventory_value", aggregation: "sum", format: "currency" },
      ],
      charts: [
        { title: "Stock by Category", type: "bar", xKey: "category", yKey: "stock", aggregation: "sum" },
        { title: "Inventory Value by Warehouse", type: "bar", xKey: "warehouse", yKey: "inventory_value", aggregation: "sum" },
      ],
    },
  },
  {
    name: "Excel Student Marks Analyst Seed",
    dataset: {
      name: "Student Marks Dataset",
      rows: [
        { student: "Asha", subject: "Math", class: "10A", marks: 92, attendance: 96 },
        { student: "Ravi", subject: "Math", class: "10A", marks: 74, attendance: 88 },
        { student: "Neha", subject: "Science", class: "10B", marks: 85, attendance: 91 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Average Marks", metric: "marks", aggregation: "avg", format: "number" },
        { title: "Highest Marks", metric: "marks", aggregation: "max", format: "number" },
      ],
      charts: [
        { title: "Average Marks by Subject", type: "bar", xKey: "subject", yKey: "marks", aggregation: "avg" },
        { title: "Marks Distribution", type: "histogram", xKey: "marks", yKey: "marks", aggregation: "count" },
      ],
    },
  },
  {
    name: "Excel Finance Expenses Analyst Seed",
    dataset: {
      name: "Finance Expenses Dataset",
      rows: [
        { date: "2026-01-01", category: "Travel", department: "Sales", vendor: "Airline", amount: 45000 },
        { date: "2026-01-08", category: "Software", department: "Engineering", vendor: "SaaS", amount: 80000 },
        { date: "2026-02-02", category: "Travel", department: "Sales", vendor: "Hotel", amount: 35000 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Total Spend", metric: "amount", aggregation: "sum", format: "currency" },
        { title: "Average Expense", metric: "amount", aggregation: "avg", format: "currency" },
      ],
      charts: [
        { title: "Spend by Category", type: "bar", xKey: "category", yKey: "amount", aggregation: "sum" },
        { title: "Spend by Department", type: "bar", xKey: "department", yKey: "amount", aggregation: "sum" },
        { title: "Expense Trend", type: "line", xKey: "date", yKey: "amount", aggregation: "sum" },
      ],
    },
  },
  {
    name: "Excel Marketing Campaign Analyst Seed",
    dataset: {
      name: "Marketing Campaign Dataset",
      rows: [
        { campaign: "Search", channel: "Google", region: "North", spend: 50000, clicks: 8000, conversions: 320 },
        { campaign: "Social", channel: "Instagram", region: "West", spend: 30000, clicks: 12000, conversions: 280 },
        { campaign: "Email", channel: "CRM", region: "South", spend: 12000, clicks: 5000, conversions: 450 },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Total Spend", metric: "spend", aggregation: "sum", format: "currency" },
        { title: "Total Conversions", metric: "conversions", aggregation: "sum", format: "number" },
        { title: "Total Clicks", metric: "clicks", aggregation: "sum", format: "number" },
      ],
      charts: [
        { title: "Conversions by Campaign", type: "bar", xKey: "campaign", yKey: "conversions", aggregation: "sum" },
        { title: "Spend by Channel", type: "bar", xKey: "channel", yKey: "spend", aggregation: "sum" },
      ],
    },
  },
  {
    name: "Excel Survey Response Analyst Seed",
    dataset: {
      name: "Survey Response Dataset",
      rows: [
        { respondent_id: "R1", segment: "Enterprise", region: "North", rating: 5, sentiment: "Positive" },
        { respondent_id: "R2", segment: "SMB", region: "South", rating: 3, sentiment: "Neutral" },
        { respondent_id: "R3", segment: "Enterprise", region: "North", rating: 4, sentiment: "Positive" },
      ],
    },
    acceptedDashboardPlan: {
      kpis: [
        { title: "Responses", metric: "__row_count__", aggregation: "count", format: "number" },
        { title: "Average Rating", metric: "rating", aggregation: "avg", format: "number" },
      ],
      charts: [
        { title: "Average Rating by Segment", type: "bar", xKey: "segment", yKey: "rating", aggregation: "avg" },
        { title: "Sentiment Mix", type: "donut", xKey: "sentiment", yKey: "count", aggregation: "count" },
      ],
    },
  },
];

export async function trainExcelAnalystRagSeeds({ useOllama = true, log = false } = {}) {
  const trained = [];

  for (const seed of excelAnalystSeedDatasets) {
    const result = await trainSchemaRagMemoryFromDataset({
      dataset: seed.dataset,
      acceptedDashboardPlan: seed.acceptedDashboardPlan,
      rating: "excellent",
      notes: `${seed.name}: Excel analyst approved dashboard pattern.`,
      source: "excel-analyst-seed",
      useOllama,
    });

    trained.push({
      name: seed.name,
      id: result.entry?.id,
      domain: result.entry?.domain,
      stats: result.stats,
    });

    if (log) {
      console.log(`Trained: ${seed.name}`);
      console.log(result.entry?.id);
    }
  }

  return {
    trained,
    count: trained.length,
  };
}

async function main() {
  const result = await trainExcelAnalystRagSeeds({ useOllama: true, log: true });
  console.log(`Excel Analyst RAG training complete. Seeds trained: ${result.count}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Excel Analyst RAG training failed:", error);
    process.exit(1);
  });
}
