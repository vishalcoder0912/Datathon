export const AGENTIC_MASTER_TRAINING_PACK = [
  {
    domain: "sales",
    intent: "Find revenue growth, profit performance, product winners, regional contribution, and weak segments.",
    schemas: [
      ["order_id", "order_date", "product", "category", "region", "sales", "profit", "quantity", "customer_id"],
      ["date", "sku", "brand", "channel", "revenue", "cost", "margin", "units_sold"],
      ["invoice_id", "customer", "city", "country", "amount", "discount", "net_sales", "created_at"],
    ],
    kpis: [
      { title: "Total Revenue", formula: "SUM(revenue|sales|amount|net_sales)", priority: 1 },
      { title: "Total Profit", formula: "SUM(profit|margin)", priority: 2 },
      { title: "Profit Margin", formula: "SUM(profit) / SUM(revenue)", priority: 3 },
      { title: "Average Order Value", formula: "SUM(revenue) / COUNT(order_id)", priority: 4 },
      { title: "Revenue Growth", formula: "PERIOD_GROWTH(revenue, date)", priority: 5 },
    ],
    charts: [
      { title: "Revenue Trend", type: "line", rule: "date + revenue" },
      { title: "Revenue by Region", type: "bar", rule: "geo/category + revenue" },
      { title: "Top Products by Revenue", type: "bar", rule: "product + revenue" },
      { title: "Profit Margin by Category", type: "bar", rule: "category + margin" },
    ],
    insights: [
      "Identify top revenue drivers.",
      "Compare revenue and profit, not only sales volume.",
      "Detect regions with high revenue but low margin.",
      "Detect products with discount dependency.",
    ],
  },

  {
    domain: "hr_salary",
    intent: "Explain compensation structure, salary fairness, experience impact, department gap, and geo salary difference.",
    schemas: [
      ["employee_id", "name", "department", "role", "salary", "experience", "education", "country"],
      ["emp_id", "team", "salary_usd", "performance_score", "joining_date", "gender", "location"],
      ["candidate_id", "job_title", "skills", "years_experience", "expected_salary", "offered_salary"],
    ],
    kpis: [
      { title: "Average Salary", formula: "AVG(salary|salary_usd|offered_salary)", priority: 1 },
      { title: "Median Salary", formula: "MEDIAN(salary)", priority: 2 },
      { title: "Highest Salary", formula: "MAX(salary)", priority: 3 },
      { title: "Salary Spread", formula: "MAX(salary) - MIN(salary)", priority: 4 },
      { title: "Average Experience", formula: "AVG(experience|years_experience)", priority: 5 },
    ],
    charts: [
      { title: "Salary by Department", type: "bar", rule: "department + salary" },
      { title: "Salary by Experience", type: "scatter", rule: "experience + salary" },
      { title: "Salary by Country", type: "geo", rule: "country + salary" },
      { title: "Education vs Salary", type: "bar", rule: "education + salary" },
    ],
    insights: [
      "Use median salary because salary has outliers.",
      "Compare salary by experience before judging fairness.",
      "Use geo map if country/location exists.",
      "Find departments with salary imbalance.",
    ],
  },

  {
    domain: "ecommerce",
    intent: "Find revenue, order quality, customer behavior, returns, discount impact, product performance, and checkout health.",
    schemas: [
      ["order_id", "customer_id", "product", "category", "order_date", "revenue", "discount", "return_status"],
      ["cart_id", "user_id", "cart_value", "payment_method", "payment_status", "delivery_status", "created_at"],
      ["product_id", "price", "stock", "rating", "reviews", "orders", "returns"],
    ],
    kpis: [
      { title: "Total Revenue", formula: "SUM(revenue|cart_value|price)", priority: 1 },
      { title: "Total Orders", formula: "COUNT(order_id)", priority: 2 },
      { title: "Average Order Value", formula: "SUM(revenue) / COUNT(order_id)", priority: 3 },
      { title: "Return Rate", formula: "COUNT(return_status=returned) / COUNT(order_id)", priority: 4 },
      { title: "Payment Success Rate", formula: "COUNT(payment_status=success) / COUNT(payment_status)", priority: 5 },
    ],
    charts: [
      { title: "Revenue Trend", type: "line", rule: "date + revenue" },
      { title: "Top Products", type: "bar", rule: "product + revenue" },
      { title: "Return Rate by Category", type: "bar", rule: "category + returns" },
      { title: "Payment Status Breakdown", type: "donut", rule: "payment_status + count" },
    ],
    insights: [
      "AOV matters more than only total orders.",
      "High revenue with high returns is risky.",
      "Discount-heavy products may reduce margin.",
      "Payment failure rate directly affects conversion.",
    ],
  },

  {
    domain: "finance",
    intent: "Track revenue, expenses, profit, budget variance, margin, cost centers, and financial risks.",
    schemas: [
      ["date", "department", "revenue", "expense", "profit", "budget", "actual"],
      ["transaction_id", "transaction_type", "amount", "cost_center", "month", "variance"],
      ["account", "debit", "credit", "balance", "category", "posted_date"],
    ],
    kpis: [
      { title: "Total Revenue", formula: "SUM(revenue|credit)", priority: 1 },
      { title: "Total Expense", formula: "SUM(expense|debit)", priority: 2 },
      { title: "Net Profit", formula: "SUM(revenue) - SUM(expense)", priority: 3 },
      { title: "Budget Variance", formula: "SUM(actual) - SUM(budget)", priority: 4 },
      { title: "Profit Margin", formula: "SUM(profit) / SUM(revenue)", priority: 5 },
    ],
    charts: [
      { title: "Revenue vs Expense", type: "line", rule: "date + revenue + expense" },
      { title: "Budget vs Actual", type: "bar", rule: "budget + actual" },
      { title: "Cost by Cost Center", type: "bar", rule: "cost_center + expense" },
      { title: "Profit Trend", type: "area", rule: "date + profit" },
    ],
    insights: [
      "Financial dashboards must compare actual vs budget.",
      "Profit is more important than revenue alone.",
      "Expense spikes should be flagged.",
      "Cost centers should be ranked by spend.",
    ],
  },

  {
    domain: "marketing",
    intent: "Measure campaign efficiency, not only campaign volume.",
    schemas: [
      ["campaign", "channel", "spend", "clicks", "impressions", "conversions", "revenue"],
      ["ad_id", "date", "ctr", "cpc", "cpa", "roas", "leads"],
      ["source", "medium", "sessions", "bounce_rate", "conversion_rate", "cost"],
    ],
    kpis: [
      { title: "ROAS", formula: "SUM(revenue) / SUM(spend)", priority: 1 },
      { title: "Conversion Rate", formula: "SUM(conversions) / SUM(clicks)", priority: 2 },
      { title: "CTR", formula: "SUM(clicks) / SUM(impressions)", priority: 3 },
      { title: "CPA", formula: "SUM(spend) / SUM(conversions)", priority: 4 },
      { title: "Total Spend", formula: "SUM(spend)", priority: 5 },
    ],
    charts: [
      { title: "ROAS by Channel", type: "bar", rule: "channel + roas" },
      { title: "Spend vs Revenue", type: "scatter", rule: "spend + revenue" },
      { title: "Conversions Trend", type: "line", rule: "date + conversions" },
      { title: "CTR by Campaign", type: "bar", rule: "campaign + ctr" },
    ],
    insights: [
      "A campaign with high spend but low ROAS is inefficient.",
      "Clicks without conversions are weak traffic.",
      "CPA should be minimized.",
      "Channel comparison should prioritize efficiency metrics.",
    ],
  },

  {
    domain: "inventory_supply_chain",
    intent: "Detect stock risk, warehouse imbalance, supplier delay, product movement, and reorder needs.",
    schemas: [
      ["product_id", "product", "warehouse", "stock", "reorder_level", "sold_units", "supplier"],
      ["shipment_id", "carrier", "shipment_date", "delivery_date", "delay_days", "shipping_cost"],
      ["sku", "opening_stock", "closing_stock", "received_qty", "issued_qty", "location"],
    ],
    kpis: [
      { title: "Total Stock", formula: "SUM(stock|closing_stock)", priority: 1 },
      { title: "Low Stock Items", formula: "COUNT(stock < reorder_level)", priority: 2 },
      { title: "Inventory Turnover", formula: "SUM(sold_units) / AVG(stock)", priority: 3 },
      { title: "Average Delay", formula: "AVG(delay_days)", priority: 4 },
      { title: "Shipping Cost", formula: "SUM(shipping_cost)", priority: 5 },
    ],
    charts: [
      { title: "Stock by Warehouse", type: "bar", rule: "warehouse + stock" },
      { title: "Low Stock Products", type: "bar", rule: "product + stock" },
      { title: "Supplier Delay", type: "bar", rule: "supplier + delay_days" },
      { title: "Stock Movement", type: "line", rule: "date + stock" },
    ],
    insights: [
      "Low stock should be flagged before stockout.",
      "High stock with low sales means overstock.",
      "Supplier delay affects reorder planning.",
      "Warehouse imbalance should be visible.",
    ],
  },

  {
    domain: "banking_fraud",
    intent: "Detect risky transactions, fraud signals, customer segments, and abnormal amounts.",
    schemas: [
      ["transaction_id", "customer_id", "amount", "merchant", "country", "transaction_time", "is_fraud"],
      ["account_id", "balance", "withdrawal", "deposit", "risk_score", "location"],
      ["card_id", "merchant_category", "amount", "status", "device_id", "ip_country"],
    ],
    kpis: [
      { title: "Total Transaction Value", formula: "SUM(amount)", priority: 1 },
      { title: "Fraud Rate", formula: "COUNT(is_fraud=true) / COUNT(transaction_id)", priority: 2 },
      { title: "Average Transaction Amount", formula: "AVG(amount)", priority: 3 },
      { title: "High Risk Transactions", formula: "COUNT(risk_score > threshold)", priority: 4 },
    ],
    charts: [
      { title: "Fraud by Country", type: "geo", rule: "country + fraud_rate" },
      { title: "Amount Distribution", type: "histogram", rule: "amount" },
      { title: "Risk Score by Merchant", type: "bar", rule: "merchant + risk_score" },
      { title: "Transactions Over Time", type: "line", rule: "transaction_time + amount" },
    ],
    insights: [
      "Fraud analysis must focus on rates, not only counts.",
      "Outlier amounts should be highlighted.",
      "Geo-risk patterns are important.",
      "Merchant/device/country combinations can indicate suspicious behavior.",
    ],
  },

  {
    domain: "healthcare_operations",
    intent: "Analyze patient flow, appointment efficiency, diagnosis volume, hospital cost, and service quality.",
    schemas: [
      ["patient_id", "department", "doctor", "appointment_date", "wait_time", "cost", "diagnosis"],
      ["hospital", "city", "admissions", "discharges", "readmissions", "mortality_rate"],
      ["claim_id", "patient_age", "procedure", "claim_amount", "insurance_status"],
    ],
    kpis: [
      { title: "Total Patients", formula: "COUNT(patient_id)", priority: 1 },
      { title: "Average Wait Time", formula: "AVG(wait_time)", priority: 2 },
      { title: "Total Cost", formula: "SUM(cost|claim_amount)", priority: 3 },
      { title: "Readmission Rate", formula: "SUM(readmissions) / SUM(admissions)", priority: 4 },
    ],
    charts: [
      { title: "Patients by Department", type: "bar", rule: "department + patient_count" },
      { title: "Wait Time by Doctor", type: "bar", rule: "doctor + wait_time" },
      { title: "Hospital Map", type: "geo", rule: "city + admissions" },
      { title: "Cost Distribution", type: "histogram", rule: "cost" },
    ],
    insights: [
      "Operational healthcare analysis should focus on flow, wait time, readmission, and cost.",
      "Avoid clinical diagnosis advice.",
      "Flag high wait time and high readmission departments.",
    ],
  },

  {
    domain: "education",
    intent: "Understand student performance, attendance, course outcomes, risk students, and institutional quality.",
    schemas: [
      ["student_id", "course", "marks", "attendance", "grade", "semester", "department"],
      ["school", "city", "students", "pass_rate", "dropout_rate", "teacher_count"],
      ["exam_date", "subject", "score", "rank", "category", "gender"],
    ],
    kpis: [
      { title: "Average Marks", formula: "AVG(marks|score)", priority: 1 },
      { title: "Pass Rate", formula: "AVG(pass_rate)", priority: 2 },
      { title: "Average Attendance", formula: "AVG(attendance)", priority: 3 },
      { title: "Dropout Rate", formula: "AVG(dropout_rate)", priority: 4 },
    ],
    charts: [
      { title: "Marks by Course", type: "bar", rule: "course + marks" },
      { title: "Attendance vs Marks", type: "scatter", rule: "attendance + marks" },
      { title: "Pass Rate by School", type: "bar", rule: "school + pass_rate" },
      { title: "Performance Trend", type: "line", rule: "semester + marks" },
    ],
    insights: [
      "Attendance vs marks is often a key relationship.",
      "Course-level performance helps academic decisions.",
      "Dropout rate should be treated as risk.",
    ],
  },
];
