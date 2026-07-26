import { trainSchemaRagMemoryFromDataset } from "../src/services/ai-analyst/schema-rag-retriever.js";

function example(name, domain, schema, rows, kpis, charts, rejected = []) {
  return {
    dataset: { name, columns: schema, rows },
    domain,
    expertThinkingNotes: `Senior analyst pattern for ${domain}: prioritize decision KPIs, trend when date exists, segment/ranking views, and reject noisy identifiers or unsupported ratios.`,
    acceptedDashboardPlan: { domain, kpis, charts },
    rejectedKpisCharts: rejected,
    qualityRules: [
      "Never calculate values in RAG.",
      "Skip KPI if required columns are missing.",
      "Do not chart IDs.",
      "Do not use pie/donut above 8 categories.",
      "Use local deterministic calculation for values and series.",
    ],
    rating: "excellent",
    source: "senior-analyst-seed",
  };
}

const schemas = {
  sales: ["order_date", "region", "sales_rep", "revenue", "profit", "order_id"],
  ecommerce: ["order_date", "order_id", "customer_id", "product_category", "gmv", "quantity", "country"],
  finance: ["transaction_date", "category", "income", "expense", "account_id"],
  salary: ["employee_id", "country", "department", "experience_years", "salary_usd"],
  education: ["student_id", "subject", "marks", "result", "exam_date"],
  marketing: ["date", "campaign", "channel", "impressions", "clicks", "spend", "conversions"],
  inventory: ["sku", "category", "stock", "unit_cost", "warehouse", "last_sold_date"],
  survey: ["response_id", "segment", "question", "rating", "sentiment", "submitted_date"],
};

const rows = {
  sales: [{ order_date: "2026-01-01", region: "West", sales_rep: "Asha", revenue: 1200, profit: 330, order_id: "O1" }],
  ecommerce: [{ order_date: "2026-01-01", order_id: "O1", customer_id: "C1", product_category: "Shoes", gmv: 240, quantity: 2, country: "India" }],
  finance: [{ transaction_date: "2026-01-01", category: "Cloud", income: 5000, expense: 1200, account_id: "A1" }],
  salary: [{ employee_id: "E1", country: "US", department: "Engineering", experience_years: 8, salary_usd: 160000 }],
  education: [{ student_id: "S1", subject: "Math", marks: 88, result: "Pass", exam_date: "2026-02-01" }],
  marketing: [{ date: "2026-01-01", campaign: "Launch", channel: "Search", impressions: 10000, clicks: 740, spend: 900, conversions: 80 }],
  inventory: [{ sku: "SKU1", category: "Parts", stock: 4, unit_cost: 25, warehouse: "North", last_sold_date: "2026-01-05" }],
  survey: [{ response_id: "R1", segment: "Enterprise", question: "NPS", rating: 9, sentiment: "Positive", submitted_date: "2026-01-03" }],
};

export const seniorAnalystSeedExamples = [
  example("sales dashboard", "sales", schemas.sales, rows.sales,
    [{ title: "Total Revenue", metric: "revenue", aggregation: "sum" }, { title: "Profit", metric: "profit", aggregation: "sum" }, { title: "Orders", metric: "order_id", aggregation: "count_unique" }],
    [{ title: "Revenue Trend", type: "line", xKey: "order_date", yKey: "revenue", aggregation: "sum" }, { title: "Revenue by Region", type: "bar", xKey: "region", yKey: "revenue", aggregation: "sum" }],
    ["Average order_id", "Pie by order_id"]),
  example("ecommerce dashboard", "ecommerce", schemas.ecommerce, rows.ecommerce,
    [{ title: "GMV", metric: "gmv", aggregation: "sum" }, { title: "Orders", metric: "order_id", aggregation: "count_unique" }, { title: "Units", metric: "quantity", aggregation: "sum" }],
    [{ title: "GMV Trend", type: "line", xKey: "order_date", yKey: "gmv", aggregation: "sum" }, { title: "GMV by Category", type: "bar", xKey: "product_category", yKey: "gmv", aggregation: "sum" }]),
  example("finance dashboard", "finance", schemas.finance, rows.finance,
    [{ title: "Income", metric: "income", aggregation: "sum" }, { title: "Expense", metric: "expense", aggregation: "sum" }],
    [{ title: "Expense by Category", type: "bar", xKey: "category", yKey: "expense", aggregation: "sum" }, { title: "Income Trend", type: "line", xKey: "transaction_date", yKey: "income", aggregation: "sum" }]),
  example("HR salary dashboard", "HR/salary", schemas.salary, rows.salary,
    [{ title: "Average Salary", metric: "salary_usd", aggregation: "avg" }, { title: "Median Salary", metric: "salary_usd", aggregation: "median" }, { title: "Max Salary", metric: "salary_usd", aggregation: "max" }],
    [{ title: "Average Salary by Country", type: "bar", xKey: "country", yKey: "salary_usd", aggregation: "avg" }, { title: "Salary vs Experience", type: "scatter", xKey: "experience_years", yKey: "salary_usd", aggregation: "count" }]),
  example("education dashboard", "education", schemas.education, rows.education,
    [{ title: "Average Marks", metric: "marks", aggregation: "avg" }, { title: "Topper Score", metric: "marks", aggregation: "max" }],
    [{ title: "Marks by Subject", type: "bar", xKey: "subject", yKey: "marks", aggregation: "avg" }, { title: "Marks Distribution", type: "histogram", xKey: "marks", yKey: "count", aggregation: "count" }]),
  example("marketing dashboard", "marketing", schemas.marketing, rows.marketing,
    [{ title: "Impressions", metric: "impressions", aggregation: "sum" }, { title: "Clicks", metric: "clicks", aggregation: "sum" }, { title: "Conversions", metric: "conversions", aggregation: "sum" }],
    [{ title: "Clicks Trend", type: "line", xKey: "date", yKey: "clicks", aggregation: "sum" }, { title: "Spend by Channel", type: "bar", xKey: "channel", yKey: "spend", aggregation: "sum" }]),
  example("inventory dashboard", "inventory", schemas.inventory, rows.inventory,
    [{ title: "Stock Units", metric: "stock", aggregation: "sum" }, { title: "Average Unit Cost", metric: "unit_cost", aggregation: "avg" }],
    [{ title: "Stock by Category", type: "bar", xKey: "category", yKey: "stock", aggregation: "sum" }, { title: "Stock by Warehouse", type: "bar", xKey: "warehouse", yKey: "stock", aggregation: "sum" }]),
  example("survey dashboard", "survey", schemas.survey, rows.survey,
    [{ title: "Average Rating", metric: "rating", aggregation: "avg" }, { title: "Responses", metric: "response_id", aggregation: "count_unique" }],
    [{ title: "Rating by Segment", type: "bar", xKey: "segment", yKey: "rating", aggregation: "avg" }, { title: "Sentiment Share", type: "donut", xKey: "sentiment", yKey: "count", aggregation: "count" }]),
  example("SaaS subscriptions dashboard", "sales", ["date", "customer_id", "plan", "mrr", "arr", "churn_status"], [{ date: "2026-01-01", customer_id: "C1", plan: "Pro", mrr: 99, arr: 1188, churn_status: "Active" }], [{ title: "MRR", metric: "mrr", aggregation: "sum" }, { title: "ARR", metric: "arr", aggregation: "sum" }], [{ title: "MRR Trend", type: "line", xKey: "date", yKey: "mrr", aggregation: "sum" }, { title: "MRR by Plan", type: "bar", xKey: "plan", yKey: "mrr", aggregation: "sum" }]),
  example("support tickets dashboard", "operations", ["created_date", "ticket_id", "priority", "status", "sla_hours", "resolution_hours"], [{ created_date: "2026-01-01", ticket_id: "T1", priority: "High", status: "Closed", sla_hours: 24, resolution_hours: 18 }], [{ title: "Tickets", metric: "ticket_id", aggregation: "count_unique" }, { title: "Average Resolution Hours", metric: "resolution_hours", aggregation: "avg" }], [{ title: "Tickets by Status", type: "bar", xKey: "status", yKey: "count", aggregation: "count" }, { title: "Resolution Trend", type: "line", xKey: "created_date", yKey: "resolution_hours", aggregation: "avg" }]),
  example("logistics dashboard", "operations", ["ship_date", "route", "carrier", "delivery_days", "cost", "shipment_id"], [{ ship_date: "2026-01-01", route: "A-B", carrier: "FastCo", delivery_days: 3, cost: 120, shipment_id: "S1" }], [{ title: "Shipments", metric: "shipment_id", aggregation: "count_unique" }, { title: "Average Delivery Days", metric: "delivery_days", aggregation: "avg" }], [{ title: "Cost by Carrier", type: "bar", xKey: "carrier", yKey: "cost", aggregation: "sum" }, { title: "Delivery Days Distribution", type: "histogram", xKey: "delivery_days", yKey: "count", aggregation: "count" }]),
  example("healthcare generic safe dashboard", "operations", ["visit_date", "department", "patient_id", "wait_minutes", "satisfaction_score"], [{ visit_date: "2026-01-01", department: "OPD", patient_id: "P1", wait_minutes: 20, satisfaction_score: 4 }], [{ title: "Visits", metric: "patient_id", aggregation: "count_unique" }, { title: "Average Wait Minutes", metric: "wait_minutes", aggregation: "avg" }], [{ title: "Wait by Department", type: "bar", xKey: "department", yKey: "wait_minutes", aggregation: "avg" }]),
  example("real estate dashboard", "sales", ["listed_date", "city", "property_type", "price", "sqft", "listing_id"], [{ listed_date: "2026-01-01", city: "Pune", property_type: "Apartment", price: 100000, sqft: 900, listing_id: "L1" }], [{ title: "Average Price", metric: "price", aggregation: "avg" }, { title: "Listings", metric: "listing_id", aggregation: "count_unique" }], [{ title: "Price by City", type: "bar", xKey: "city", yKey: "price", aggregation: "avg" }, { title: "Price vs Sqft", type: "scatter", xKey: "sqft", yKey: "price", aggregation: "count" }]),
  example("banking transactions dashboard", "finance", ["transaction_date", "transaction_id", "merchant_category", "amount", "risk_score", "country"], [{ transaction_date: "2026-01-01", transaction_id: "B1", merchant_category: "Fuel", amount: 80, risk_score: 0.2, country: "US" }], [{ title: "Transaction Amount", metric: "amount", aggregation: "sum" }, { title: "Average Risk Score", metric: "risk_score", aggregation: "avg" }], [{ title: "Amount by Category", type: "bar", xKey: "merchant_category", yKey: "amount", aggregation: "sum" }]),
  example("product analytics dashboard", "operations", ["event_date", "user_id", "feature", "events", "session_minutes"], [{ event_date: "2026-01-01", user_id: "U1", feature: "Search", events: 8, session_minutes: 12 }], [{ title: "Events", metric: "events", aggregation: "sum" }, { title: "Users", metric: "user_id", aggregation: "count_unique" }], [{ title: "Events by Feature", type: "bar", xKey: "feature", yKey: "events", aggregation: "sum" }]),
  example("website analytics dashboard", "marketing", ["date", "page", "sessions", "users", "bounce_rate", "conversions"], [{ date: "2026-01-01", page: "/home", sessions: 1000, users: 780, bounce_rate: 42, conversions: 24 }], [{ title: "Sessions", metric: "sessions", aggregation: "sum" }, { title: "Users", metric: "users", aggregation: "sum" }], [{ title: "Sessions Trend", type: "line", xKey: "date", yKey: "sessions", aggregation: "sum" }]),
  example("social media analytics dashboard", "marketing", ["date", "platform", "posts", "impressions", "engagements"], [{ date: "2026-01-01", platform: "LinkedIn", posts: 2, impressions: 5000, engagements: 230 }], [{ title: "Impressions", metric: "impressions", aggregation: "sum" }, { title: "Engagements", metric: "engagements", aggregation: "sum" }], [{ title: "Engagements by Platform", type: "bar", xKey: "platform", yKey: "engagements", aggregation: "sum" }]),
  example("manufacturing dashboard", "operations", ["date", "line", "units_produced", "defects", "downtime_minutes"], [{ date: "2026-01-01", line: "A", units_produced: 1000, defects: 8, downtime_minutes: 40 }], [{ title: "Units Produced", metric: "units_produced", aggregation: "sum" }, { title: "Defects", metric: "defects", aggregation: "sum" }], [{ title: "Defects by Line", type: "bar", xKey: "line", yKey: "defects", aggregation: "sum" }]),
  example("operations dashboard", "operations", ["date", "team", "tasks_completed", "cycle_time_hours", "status"], [{ date: "2026-01-01", team: "Ops", tasks_completed: 45, cycle_time_hours: 4, status: "Done" }], [{ title: "Tasks Completed", metric: "tasks_completed", aggregation: "sum" }, { title: "Average Cycle Time", metric: "cycle_time_hours", aggregation: "avg" }], [{ title: "Tasks by Team", type: "bar", xKey: "team", yKey: "tasks_completed", aggregation: "sum" }]),
  example("generic messy dataset", "generic", ["row_id", "created_at", "category", "amount", "notes", "unknown_blank"], [{ row_id: "1", created_at: "2026-01-01", category: "A", amount: 10, notes: "ok", unknown_blank: "" }], [{ title: "Total Rows", metric: "__row_count__", aggregation: "count" }, { title: "Average Amount", metric: "amount", aggregation: "avg" }], [{ title: "Amount by Category", type: "bar", xKey: "category", yKey: "amount", aggregation: "avg" }], ["Chart by row_id", "KPI from notes"]),
];

export async function trainSeniorAnalystSeeds(options = {}) {
  const results = [];
  for (const seed of seniorAnalystSeedExamples) {
    results.push(await trainSchemaRagMemoryFromDataset({
      dataset: seed.dataset,
      acceptedDashboardPlan: seed.acceptedDashboardPlan,
      rating: seed.rating,
      notes: JSON.stringify({
        domain: seed.domain,
        expertThinkingNotes: seed.expertThinkingNotes,
        rejectedKpisCharts: seed.rejectedKpisCharts,
        qualityRules: seed.qualityRules,
      }),
      source: seed.source,
      useOllama: options.useOllama ?? false,
    }));
  }
  return {
    trained: results.length,
    examples: seniorAnalystSeedExamples.map((seed) => ({
      datasetName: seed.dataset.name,
      domain: seed.domain,
      rating: seed.rating,
      source: seed.source,
    })),
    stats: results.at(-1)?.stats,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  trainSeniorAnalystSeeds({ useOllama: process.argv.includes("--ollama") })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

