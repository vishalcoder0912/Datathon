export const DOMAIN_TRAINING_SEEDS = [
  {
    domain: "sales",
    schema: ["date", "product", "category", "region", "sales", "profit", "quantity", "customer_id"],
    kpis: [
      "Total Revenue",
      "Total Profit",
      "Average Order Value",
      "Profit Margin",
      "Total Orders",
      "Top Product",
    ],
    charts: [
      "Revenue Trend",
      "Revenue by Region",
      "Profit by Product",
      "Category Sales Share",
      "Monthly Growth",
    ],
    analystThinking:
      "For sales data, prioritize revenue, profit, growth trend, product performance, and regional contribution.",
  },
  {
    domain: "hr_salary",
    schema: ["employee_id", "department", "country", "experience", "education", "salary", "joining_date"],
    kpis: [
      "Average Salary",
      "Median Salary",
      "Highest Salary",
      "Employees Count",
      "Salary by Department",
    ],
    charts: [
      "Average Salary by Department",
      "Salary by Country",
      "Salary by Experience",
      "Education vs Salary",
    ],
    analystThinking:
      "For HR salary data, compare compensation by role, department, country, education, and experience.",
  },
  {
    domain: "ecommerce",
    schema: ["order_id", "customer_id", "product", "category", "order_date", "revenue", "discount", "returns"],
    kpis: [
      "Total Revenue",
      "Total Orders",
      "Average Order Value",
      "Return Rate",
      "Discount Impact",
    ],
    charts: [
      "Revenue Trend",
      "Top Products",
      "Revenue by Category",
      "Returns by Product",
      "Customer Purchase Frequency",
    ],
    analystThinking:
      "For ecommerce data, focus on revenue, AOV, repeat customers, returns, discounts, and product performance.",
  },
  {
    domain: "finance",
    schema: ["date", "revenue", "expense", "profit", "budget", "department", "cost_center"],
    kpis: [
      "Total Revenue",
      "Total Expense",
      "Net Profit",
      "Profit Margin",
      "Budget Variance",
    ],
    charts: [
      "Revenue vs Expense Trend",
      "Profit by Department",
      "Budget vs Actual",
      "Cost Center Breakdown",
    ],
    analystThinking:
      "For finance data, focus on profitability, cost control, budget variance, and margin analysis.",
  },
  {
    domain: "marketing",
    schema: ["campaign", "channel", "spend", "clicks", "impressions", "conversions", "revenue"],
    kpis: [
      "ROAS",
      "Conversion Rate",
      "Cost Per Click",
      "Cost Per Acquisition",
      "Total Spend",
    ],
    charts: [
      "ROAS by Channel",
      "Conversions by Campaign",
      "Spend vs Revenue",
      "CTR by Channel",
    ],
    analystThinking:
      "For marketing data, prioritize spend efficiency, ROAS, conversion rate, CAC, and channel performance.",
  },
  {
    domain: "inventory",
    schema: ["product_id", "product", "stock", "warehouse", "reorder_level", "sold_units", "supplier"],
    kpis: [
      "Total Stock",
      "Low Stock Items",
      "Stockout Risk",
      "Inventory Turnover",
      "Top Moving Products",
    ],
    charts: [
      "Stock by Warehouse",
      "Low Stock Products",
      "Sales vs Stock",
      "Supplier Inventory Share",
    ],
    analystThinking:
      "For inventory data, detect low stock, fast-moving items, stockout risk, and warehouse distribution.",
  },
  {
    domain: "geo_analytics",
    schema: ["country", "state", "city", "latitude", "longitude", "sales", "users", "revenue"],
    kpis: [
      "Countries Covered",
      "Top Country",
      "Top City",
      "Geo Revenue",
      "Regional Share",
    ],
    charts: [
      "World Map",
      "Country Heatmap",
      "City Bubble Map",
      "Revenue by Country",
    ],
    analystThinking:
      "For geo data, prioritize location distribution, country performance, regional concentration, and map visualization.",
  },
  {
    domain: "time_series",
    schema: ["date", "timestamp", "value", "sales", "traffic", "users", "revenue"],
    kpis: [
      "Current Value",
      "Growth Rate",
      "Moving Average",
      "Peak Value",
      "Trend Direction",
    ],
    charts: [
      "Time Trend",
      "Monthly Growth",
      "Seasonality",
      "Forecast Line",
      "Rolling Average",
    ],
    analystThinking:
      "For time series data, focus on trend, growth, seasonality, anomalies, and forecast direction.",
  },
];
