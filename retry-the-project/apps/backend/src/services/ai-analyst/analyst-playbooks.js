export const ANALYST_PLAYBOOKS = [
  {
    domain: "sales_analytics",
    label: "Sales Analytics",
    keywords: ["sales", "revenue", "amount", "profit", "order", "customer", "product", "region", "quantity", "units", "date"],
    kpis: [
      { title: "Total Revenue", metricAliases: ["revenue", "sales", "amount"], aggregation: "sum" },
      { title: "Total Orders", metricAliases: ["order_id", "invoice_id", "transaction_id"], aggregation: "count_unique" },
      { title: "Units Sold", metricAliases: ["quantity", "units", "qty"], aggregation: "sum" },
      { title: "Average Order Value", metricAliases: ["revenue", "sales", "amount"], aggregation: "avg" },
      { title: "Total Profit", metricAliases: ["profit", "margin_amount"], aggregation: "sum" },
      { title: "Profit Margin", metricAliases: ["profit_margin", "margin"], aggregation: "avg" }
    ],
    charts: [
      { title: "Revenue Trend", type: "line", xRole: "date", yAliases: ["revenue", "sales", "amount"], aggregation: "sum" },
      { title: "Revenue by Region", type: "bar", xAliases: ["region", "country", "state", "city"], yAliases: ["revenue", "sales", "amount"], aggregation: "sum", limit: 10 },
      { title: "Top Products by Revenue", type: "bar", xAliases: ["product", "item"], yAliases: ["revenue", "sales", "amount"], aggregation: "sum", limit: 10 },
      { title: "Revenue by Category", type: "bar", xAliases: ["category", "subcategory"], yAliases: ["revenue", "sales", "amount"], aggregation: "sum", limit: 10 },
      { title: "Profit by Product", type: "bar", xAliases: ["product", "item"], yAliases: ["profit"], aggregation: "sum", limit: 10 },
      { title: "Orders by Channel", type: "donut", xAliases: ["channel", "source", "sales_channel"], aggregation: "count", limit: 6 }
    ]
  },
  {
    domain: "ecommerce",
    label: "Ecommerce Analytics",
    keywords: ["cart", "checkout", "conversion", "visit", "traffic", "bounce", "funnel", "transaction", "shop", "sku", "online"],
    kpis: [
      { title: "Total Revenue", metricAliases: ["revenue", "sales", "amount"], aggregation: "sum" },
      { title: "Conversion Rate", metricAliases: ["conversion_rate", "conversion"], aggregation: "avg" },
      { title: "Total Purchases", metricAliases: ["purchase_id", "order_id", "transaction_id"], aggregation: "count_unique" },
      { title: "Average Order Value", metricAliases: ["revenue", "sales", "amount"], aggregation: "avg" }
    ],
    charts: [
      { title: "Revenue Trend", type: "line", xRole: "date", yAliases: ["revenue", "sales", "amount"], aggregation: "sum" },
      { title: "Purchases by Product", type: "bar", xAliases: ["product", "item"], yAliases: ["revenue", "sales"], aggregation: "sum", limit: 10 },
      { title: "Traffic by Channel", type: "bar", xAliases: ["channel", "source"], yAliases: ["visits", "traffic", "sessions"], aggregation: "sum", limit: 10 }
    ]
  },
  {
    domain: "finance",
    label: "Financial Analytics",
    keywords: ["expense", "revenue", "asset", "liability", "equity", "income", "financial", "cash", "flow", "tax", "margin"],
    kpis: [
      { title: "Total Revenue", metricAliases: ["revenue", "income"], aggregation: "sum" },
      { title: "Total Expenses", metricAliases: ["expense", "expenses", "cost"], aggregation: "sum" },
      { title: "Net Income", metricAliases: ["net_income", "profit", "net_profit"], aggregation: "sum" },
      { title: "Average ROI", metricAliases: ["roi", "return_on_investment"], aggregation: "avg" }
    ],
    charts: [
      { title: "Revenue Trend", type: "line", xRole: "date", yAliases: ["revenue"], aggregation: "sum" },
      { title: "Expenses by Category", type: "bar", xAliases: ["category", "expense_type"], yAliases: ["expense", "expenses"], aggregation: "sum", limit: 10 }
    ]
  },
  {
    domain: "banking",
    label: "Banking Analytics",
    keywords: ["account", "balance", "deposit", "withdrawal", "loan", "credit", "debit", "transaction_id", "interest", "customer_id"],
    kpis: [
      { title: "Total Balance", metricAliases: ["balance", "amount"], aggregation: "sum" },
      { title: "Avg Transaction Value", metricAliases: ["amount", "transaction_value"], aggregation: "avg" },
      { title: "Active Customers", metricAliases: ["customer_id", "user_id"], aggregation: "count_unique" }
    ],
    charts: [
      { title: "Transactions Trend", type: "line", xRole: "date", yAliases: ["amount"], aggregation: "sum" },
      { title: "Balance by Account Type", type: "bar", xAliases: ["account_type", "type"], yAliases: ["balance"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "marketing",
    label: "Marketing Analytics",
    keywords: ["campaign", "clicks", "impressions", "ctr", "cpc", "roi", "lead", "spend", "ad", "social", "attribution"],
    kpis: [
      { title: "Total Spend", metricAliases: ["spend", "cost", "ad_spend"], aggregation: "sum" },
      { title: "Total Clicks", metricAliases: ["clicks", "click_count"], aggregation: "sum" },
      { title: "Avg CTR", metricAliases: ["ctr", "click_through_rate"], aggregation: "avg" },
      { title: "Avg CPC", metricAliases: ["cpc", "cost_per_click"], aggregation: "avg" }
    ],
    charts: [
      { title: "Clicks Trend", type: "line", xRole: "date", yAliases: ["clicks"], aggregation: "sum" },
      { title: "CTR by Campaign", type: "bar", xAliases: ["campaign", "campaign_name"], yAliases: ["ctr"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "hr",
    label: "HR & Headcount Analytics",
    keywords: ["employee", "attrition", "turnover", "hire", "performance", "department", "headcount", "role", "tenure", "recruit"],
    kpis: [
      { title: "Total Employees", metricAliases: ["employee_id", "employee_count"], aggregation: "count_unique" },
      { title: "Avg Tenure", metricAliases: ["tenure", "years_experience", "years_service"], aggregation: "avg" },
      { title: "Attrition Rate", metricAliases: ["attrition", "turnover_rate"], aggregation: "avg" }
    ],
    charts: [
      { title: "Headcount by Department", type: "bar", xAliases: ["department", "dept"], yAliases: ["employee_id"], aggregation: "count", limit: 10 },
      { title: "Attrition by Department", type: "bar", xAliases: ["department", "dept"], yAliases: ["attrition"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "salary",
    label: "Salary & workforce Analytics",
    keywords: ["salary", "compensation", "salary_usd", "experience", "education", "developer", "engineer"],
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Average Salary", metricAliases: ["salary", "salary_usd", "compensation"], aggregation: "avg" },
      { title: "Median Salary", metricAliases: ["salary", "salary_usd", "compensation"], aggregation: "median" },
      { title: "Highest Salary", metricAliases: ["salary", "salary_usd", "compensation"], aggregation: "max" }
    ],
    charts: [
      { title: "Average Salary by Country", type: "bar", xAliases: ["country", "location", "region"], yAliases: ["salary", "salary_usd", "compensation"], aggregation: "avg", limit: 10 },
      { title: "Salary Distribution", type: "histogram", yAliases: ["salary", "salary_usd", "compensation"], aggregation: "count" },
      { title: "Average Salary by Education", type: "bar", xAliases: ["education", "degree"], yAliases: ["salary", "salary_usd", "compensation"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "education",
    label: "Education Analytics",
    keywords: ["student", "class", "grade", "marks", "score", "attendance", "subject", "teacher"],
    kpis: [
      { title: "Total Students", metricAliases: ["student_id", "student_count"], aggregation: "count_unique" },
      { title: "Average Score", metricAliases: ["score", "marks", "grade"], aggregation: "avg" },
      { title: "Average Attendance", metricAliases: ["attendance"], aggregation: "avg" }
    ],
    charts: [
      { title: "Average Score by Class", type: "bar", xAliases: ["class", "grade_level"], yAliases: ["score", "marks"], aggregation: "avg", limit: 10 },
      { title: "Average Score by Subject", type: "bar", xAliases: ["subject"], yAliases: ["score", "marks"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "healthcare",
    label: "Healthcare Analytics",
    keywords: ["patient", "doctor", "visit", "admission", "readmission", "treatment", "cost", "stay", "diagnosis", "clinic"],
    kpis: [
      { title: "Total Patients", metricAliases: ["patient_id", "patient_count"], aggregation: "count_unique" },
      { title: "Avg Length of Stay", metricAliases: ["stay", "duration", "days_in_hospital"], aggregation: "avg" },
      { title: "Avg Treatment Cost", metricAliases: ["cost", "treatment_cost", "charges"], aggregation: "avg" }
    ],
    charts: [
      { title: "Admissions Trend", type: "line", xRole: "date", yAliases: ["patient_id"], aggregation: "count" },
      { title: "Cost by Diagnosis", type: "bar", xAliases: ["diagnosis", "disease"], yAliases: ["cost", "charges"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "inventory",
    label: "Inventory Analytics",
    keywords: ["stock", "inventory", "warehouse", "reorder", "sku", "units_in_stock", "supply", "storage", "holding_cost"],
    kpis: [
      { title: "Total Stock Value", metricAliases: ["stock_value", "inventory_value"], aggregation: "sum" },
      { title: "Avg Unit Cost", metricAliases: ["unit_cost", "cost_per_unit"], aggregation: "avg" },
      { title: "Reorder Items", metricAliases: ["reorder_level", "reorder"], aggregation: "sum" }
    ],
    charts: [
      { title: "Stock by Product", type: "bar", xAliases: ["product", "item"], yAliases: ["stock", "units_in_stock"], aggregation: "sum", limit: 10 },
      { title: "Stock by Warehouse", type: "bar", xAliases: ["warehouse", "location"], yAliases: ["stock", "units_in_stock"], aggregation: "sum", limit: 10 }
    ]
  },
  {
    domain: "supply_chain",
    label: "Supply Chain Analytics",
    keywords: ["shipping", "delivery", "supplier", "carrier", "transit", "lead_time", "delay", "freight", "logistics"],
    kpis: [
      { title: "Avg Lead Time", metricAliases: ["lead_time", "delivery_days"], aggregation: "avg" },
      { title: "On-Time Delivery Rate", metricAliases: ["on_time", "delivery_rate"], aggregation: "avg" },
      { title: "Total Delay Days", metricAliases: ["delay", "delay_days"], aggregation: "sum" }
    ],
    charts: [
      { title: "Lead Time by Supplier", type: "bar", xAliases: ["supplier", "vendor"], yAliases: ["lead_time"], aggregation: "avg", limit: 10 },
      { title: "Shipping Cost by Carrier", type: "bar", xAliases: ["carrier", "shipping_method"], yAliases: ["shipping_cost", "cost"], aggregation: "avg", limit: 10 }
    ]
  },
  {
    domain: "manufacturing",
    label: "Manufacturing Analytics",
    keywords: ["production", "yield", "defect", "efficiency", "machine", "downtime", "output", "batch", "cycle_time"],
    kpis: [
      { title: "Total Production Output", metricAliases: ["output", "production_output", "quantity"], aggregation: "sum" },
      { title: "Yield Rate", metricAliases: ["yield_rate", "yield"], aggregation: "avg" },
      { title: "Defect Count", metricAliases: ["defects", "defect_count"], aggregation: "sum" }
    ],
    charts: [
      { title: "Production Trend", type: "line", xRole: "date", yAliases: ["output", "quantity"], aggregation: "sum" },
      { title: "Defects by Machine", type: "bar", xAliases: ["machine", "line"], yAliases: ["defects"], aggregation: "sum", limit: 10 }
    ]
  },
  {
    domain: "customer",
    label: "Customer Success Analytics",
    keywords: ["nps", "csat", "churn", "retention", "support", "ticket", "satisfaction", "feedback", "loyalty"],
    kpis: [
      { title: "Avg CSAT Score", metricAliases: ["csat", "customer_satisfaction"], aggregation: "avg" },
      { title: "Avg NPS Score", metricAliases: ["nps", "net_promoter_score"], aggregation: "avg" },
      { title: "Total Support Tickets", metricAliases: ["ticket_id", "support_tickets"], aggregation: "count_unique" }
    ],
    charts: [
      { title: "NPS Trend", type: "line", xRole: "date", yAliases: ["nps"], aggregation: "avg" },
      { title: "Tickets by Category", type: "bar", xAliases: ["category", "issue_type"], yAliases: ["ticket_id"], aggregation: "count", limit: 10 }
    ]
  },
  {
    domain: "website",
    label: "Website Analytics",
    keywords: ["pageview", "sessions", "visitor", "browser", "device", "bounce_rate", "duration", "url", "referrer"],
    kpis: [
      { title: "Total Pageviews", metricAliases: ["pageviews", "views"], aggregation: "sum" },
      { title: "Total Sessions", metricAliases: ["sessions", "visits"], aggregation: "sum" },
      { title: "Avg Bounce Rate", metricAliases: ["bounce_rate", "bounce"], aggregation: "avg" }
    ],
    charts: [
      { title: "Pageviews Trend", type: "line", xRole: "date", yAliases: ["pageviews"], aggregation: "sum" },
      { title: "Visits by Browser", type: "donut", xAliases: ["browser"], yAliases: ["pageviews"], aggregation: "count", limit: 6 }
    ]
  },
  {
    domain: "generic",
    label: "General Data Analytics",
    keywords: [],
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Data Quality Score", aggregation: "quality_score" }
    ],
    charts: [
      { title: "Top Categories", type: "bar", xRole: "dimension", aggregation: "count", limit: 10 },
      { title: "Metric Distribution", type: "histogram", yRole: "metric", aggregation: "count" },
      { title: "Average Metric by Category", type: "bar", xRole: "dimension", yRole: "metric", aggregation: "avg", limit: 10 }
    ]
  }
];

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function detectBestPlaybook(schema) {
  const names = schema.columns.map((column) => column.normalizedName || normalize(column.name)).join(" ");

  const scored = ANALYST_PLAYBOOKS.map((playbook) => {
    let score = 0;

    for (const keyword of playbook.keywords) {
      if (names.includes(normalize(keyword))) score += 2;
    }

    const hasDate = schema.columns.some((column) => column.role === "date");
    const hasMetric = schema.columns.some((column) => column.role === "metric");
    const hasDimension = schema.columns.some((column) => column.role === "dimension");

    if (playbook.domain === "time_series" && hasDate && hasMetric) score += 5;
    if (playbook.domain === "generic" && hasMetric && hasDimension) score += 1;

    return { playbook, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0
    ? scored[0].playbook
    : ANALYST_PLAYBOOKS.find((playbook) => playbook.domain === "generic");
}

export default {
  ANALYST_PLAYBOOKS,
  detectBestPlaybook
};
