export const DEEP_AGENTIC_ANALYTICS_TRAINING_PACK = [
  {
    domain: "sales_revenue",
    aliases: ["sales", "orders", "revenue", "retail"],
    schemaPatterns: [
      ["date", "product", "category", "region", "sales", "profit", "quantity"],
      ["order_date", "customer_id", "sku", "revenue", "discount", "margin"],
    ],
    columnRoles: {
      date: "time_dimension",
      product: "product_dimension",
      category: "category_dimension",
      region: "geo_dimension",
      sales: "money_metric",
      revenue: "money_metric",
      profit: "profit_metric",
      quantity: "volume_metric",
    },
    kpis: [
      { title: "Total Revenue", formula: "sum(revenue_or_sales)", priority: 1 },
      { title: "Total Profit", formula: "sum(profit)", priority: 2 },
      { title: "Profit Margin", formula: "sum(profit) / sum(revenue)", priority: 3 },
      { title: "Average Order Value", formula: "sum(revenue) / count(order_id)", priority: 4 },
      { title: "Monthly Growth", formula: "period_over_period_growth(revenue)", priority: 5 },
    ],
    charts: [
      { title: "Revenue Trend", type: "line", xRole: "time_dimension", yRole: "money_metric" },
      { title: "Revenue by Region", type: "bar", xRole: "geo_dimension", yRole: "money_metric" },
      { title: "Profit by Product", type: "bar", xRole: "product_dimension", yRole: "profit_metric" },
      { title: "Category Contribution", type: "pie", xRole: "category_dimension", yRole: "money_metric" },
    ],
    reasoning:
      "Sales analysis must prioritize revenue, profit, margin, trend, regional contribution, and product performance. Avoid useless count-only dashboards when money metrics exist.",
  },

  {
    domain: "hr_workforce_salary",
    aliases: ["hr", "employee", "salary", "workforce", "payroll"],
    schemaPatterns: [
      ["employee_id", "department", "role", "salary", "experience", "education", "country"],
      ["name", "designation", "joining_date", "salary_usd", "performance_score"],
    ],
    columnRoles: {
      salary: "money_metric",
      salary_usd: "money_metric",
      department: "department_dimension",
      experience: "experience_metric",
      education: "education_dimension",
      country: "geo_dimension",
      performance_score: "performance_metric",
    },
    kpis: [
      { title: "Average Salary", formula: "avg(salary)", priority: 1 },
      { title: "Median Salary", formula: "median(salary)", priority: 2 },
      { title: "Highest Salary", formula: "max(salary)", priority: 3 },
      { title: "Employees Count", formula: "count(employee_id)", priority: 4 },
      { title: "Salary Spread", formula: "max(salary) - min(salary)", priority: 5 },
    ],
    charts: [
      { title: "Average Salary by Department", type: "bar", xRole: "department_dimension", yRole: "money_metric" },
      { title: "Salary by Experience", type: "scatter", xRole: "experience_metric", yRole: "money_metric" },
      { title: "Salary by Country", type: "geo", xRole: "geo_dimension", yRole: "money_metric" },
      { title: "Education vs Salary", type: "bar", xRole: "education_dimension", yRole: "money_metric" },
    ],
    reasoning:
      "HR salary analysis should compare salary by department, role, experience, country, education, and performance. Median salary is important because salary data often has outliers.",
  },

  {
    domain: "ecommerce",
    aliases: ["ecommerce", "shop", "cart", "checkout", "orders"],
    schemaPatterns: [
      ["order_id", "customer_id", "product", "category", "order_date", "revenue", "returns"],
      ["user_id", "cart_value", "payment_status", "discount", "delivery_status"],
    ],
    columnRoles: {
      order_id: "order_id",
      customer_id: "customer_id",
      revenue: "money_metric",
      cart_value: "money_metric",
      returns: "return_metric",
      discount: "discount_metric",
      payment_status: "status_dimension",
    },
    kpis: [
      { title: "Total Revenue", formula: "sum(revenue)", priority: 1 },
      { title: "Total Orders", formula: "count(order_id)", priority: 2 },
      { title: "Average Order Value", formula: "sum(revenue) / count(order_id)", priority: 3 },
      { title: "Return Rate", formula: "count(returns) / count(order_id)", priority: 4 },
      { title: "Discount Impact", formula: "avg(discount)", priority: 5 },
    ],
    charts: [
      { title: "Revenue Trend", type: "line", xRole: "time_dimension", yRole: "money_metric" },
      { title: "Top Products", type: "bar", xRole: "product_dimension", yRole: "money_metric" },
      { title: "Returns by Category", type: "bar", xRole: "category_dimension", yRole: "return_metric" },
      { title: "Payment Status Breakdown", type: "pie", xRole: "status_dimension", yRole: "count" },
    ],
    reasoning:
      "E-commerce dashboards must focus on revenue, AOV, orders, returns, discount effect, payment status, and product/category performance.",
  },

  {
    domain: "finance_accounting",
    aliases: ["finance", "accounting", "budget", "expense", "cost"],
    schemaPatterns: [
      ["date", "department", "revenue", "expense", "profit", "budget", "actual"],
      ["cost_center", "amount", "transaction_type", "month", "variance"],
    ],
    columnRoles: {
      revenue: "money_metric",
      expense: "cost_metric",
      profit: "profit_metric",
      budget: "budget_metric",
      actual: "actual_metric",
      variance: "variance_metric",
      cost_center: "cost_center_dimension",
    },
    kpis: [
      { title: "Total Revenue", formula: "sum(revenue)", priority: 1 },
      { title: "Total Expense", formula: "sum(expense)", priority: 2 },
      { title: "Net Profit", formula: "sum(revenue) - sum(expense)", priority: 3 },
      { title: "Budget Variance", formula: "sum(actual) - sum(budget)", priority: 4 },
      { title: "Profit Margin", formula: "sum(profit) / sum(revenue)", priority: 5 },
    ],
    charts: [
      { title: "Revenue vs Expense", type: "line", xRole: "time_dimension", yRole: "money_metric" },
      { title: "Budget vs Actual", type: "bar", xRole: "department_dimension", yRole: "variance_metric" },
      { title: "Cost by Cost Center", type: "bar", xRole: "cost_center_dimension", yRole: "cost_metric" },
    ],
    reasoning:
      "Finance analysis must focus on profitability, expense control, budget variance, and department/cost-center accountability.",
  },

  {
    domain: "marketing_performance",
    aliases: ["marketing", "campaign", "ads", "performance"],
    schemaPatterns: [
      ["campaign", "channel", "spend", "clicks", "impressions", "conversions", "revenue"],
      ["ad_group", "ctr", "cpc", "cpa", "roas", "date"],
    ],
    columnRoles: {
      spend: "cost_metric",
      clicks: "engagement_metric",
      impressions: "reach_metric",
      conversions: "conversion_metric",
      revenue: "money_metric",
      roas: "efficiency_metric",
      campaign: "campaign_dimension",
      channel: "channel_dimension",
    },
    kpis: [
      { title: "ROAS", formula: "sum(revenue) / sum(spend)", priority: 1 },
      { title: "Conversion Rate", formula: "sum(conversions) / sum(clicks)", priority: 2 },
      { title: "CTR", formula: "sum(clicks) / sum(impressions)", priority: 3 },
      { title: "CPA", formula: "sum(spend) / sum(conversions)", priority: 4 },
      { title: "Total Spend", formula: "sum(spend)", priority: 5 },
    ],
    charts: [
      { title: "ROAS by Channel", type: "bar", xRole: "channel_dimension", yRole: "efficiency_metric" },
      { title: "Spend vs Revenue", type: "scatter", xRole: "cost_metric", yRole: "money_metric" },
      { title: "Conversions Trend", type: "line", xRole: "time_dimension", yRole: "conversion_metric" },
    ],
    reasoning:
      "Marketing analytics must judge efficiency, not only volume. ROAS, CPA, conversion rate, CTR, and spend allocation are high-priority.",
  },

  {
    domain: "supply_chain_inventory",
    aliases: ["inventory", "warehouse", "supply", "stock", "logistics"],
    schemaPatterns: [
      ["product_id", "warehouse", "stock", "reorder_level", "sold_units", "supplier"],
      ["shipment_date", "delivery_date", "delay_days", "carrier", "cost"],
    ],
    columnRoles: {
      stock: "stock_metric",
      reorder_level: "threshold_metric",
      sold_units: "volume_metric",
      supplier: "supplier_dimension",
      warehouse: "warehouse_dimension",
      delay_days: "delay_metric",
    },
    kpis: [
      { title: "Total Stock", formula: "sum(stock)", priority: 1 },
      { title: "Low Stock Items", formula: "count(stock < reorder_level)", priority: 2 },
      { title: "Inventory Turnover", formula: "sum(sold_units) / avg(stock)", priority: 3 },
      { title: "Average Delay", formula: "avg(delay_days)", priority: 4 },
    ],
    charts: [
      { title: "Stock by Warehouse", type: "bar", xRole: "warehouse_dimension", yRole: "stock_metric" },
      { title: "Low Stock Products", type: "bar", xRole: "product_dimension", yRole: "stock_metric" },
      { title: "Supplier Performance", type: "bar", xRole: "supplier_dimension", yRole: "delay_metric" },
    ],
    reasoning:
      "Inventory analysis should detect low-stock risk, overstock, supplier issues, warehouse imbalance, and product movement speed.",
  },

  {
    domain: "geo_intelligence",
    aliases: ["geo", "location", "country", "city", "map", "region"],
    schemaPatterns: [
      ["country", "state", "city", "revenue", "users", "orders"],
      ["latitude", "longitude", "location_name", "amount", "category"],
    ],
    columnRoles: {
      country: "geo_country",
      state: "geo_state",
      city: "geo_city",
      latitude: "geo_latitude",
      longitude: "geo_longitude",
      revenue: "money_metric",
      users: "user_metric",
    },
    kpis: [
      { title: "Countries Covered", formula: "count_distinct(country)", priority: 1 },
      { title: "Top Country", formula: "top(country by metric)", priority: 2 },
      { title: "Top City", formula: "top(city by metric)", priority: 3 },
      { title: "Geo Revenue", formula: "sum(revenue)", priority: 4 },
    ],
    charts: [
      { title: "Global Performance Map", type: "geo", xRole: "geo_country", yRole: "money_metric" },
      { title: "City Bubble Map", type: "bubble_map", xRole: "geo_latitude", yRole: "geo_longitude" },
      { title: "Country Ranking", type: "bar", xRole: "geo_country", yRole: "money_metric" },
    ],
    reasoning:
      "Geo analysis must prefer maps when country, city, latitude, or longitude exists. Highlight regions by metric intensity and show tooltips.",
  },

  {
    domain: "time_series_forecasting",
    aliases: ["time", "forecast", "trend", "seasonality"],
    schemaPatterns: [
      ["date", "revenue", "orders", "users"],
      ["timestamp", "value", "metric_name", "category"],
    ],
    columnRoles: {
      date: "time_dimension",
      timestamp: "time_dimension",
      revenue: "money_metric",
      orders: "volume_metric",
      users: "user_metric",
      value: "generic_metric",
    },
    kpis: [
      { title: "Latest Value", formula: "latest(metric)", priority: 1 },
      { title: "Growth Rate", formula: "period_growth(metric)", priority: 2 },
      { title: "Moving Average", formula: "rolling_avg(metric)", priority: 3 },
      { title: "Peak Value", formula: "max(metric)", priority: 4 },
    ],
    charts: [
      { title: "Trend Over Time", type: "line", xRole: "time_dimension", yRole: "generic_metric" },
      { title: "Rolling Average", type: "line", xRole: "time_dimension", yRole: "generic_metric" },
      { title: "Seasonality View", type: "area", xRole: "time_dimension", yRole: "generic_metric" },
    ],
    reasoning:
      "Time-series analysis should prioritize trend, growth rate, seasonality, anomalies, moving average, and forecasting readiness.",
  },
];
