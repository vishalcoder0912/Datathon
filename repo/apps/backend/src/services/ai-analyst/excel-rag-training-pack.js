export const excelAnalystPlaybooks = [
  {
    domain: "sales_commerce",
    requiredMetrics: ["revenue", "sales", "amount", "quantity", "profit"],
    usefulDimensions: ["product", "category", "region", "country", "channel", "customer"],
    kpiTemplates: [
      { title: "Total Revenue", metric: "revenue", aggregation: "sum", format: "currency" },
      { title: "Average Order Value", metric: "revenue", aggregation: "avg", format: "currency" },
      { title: "Units Sold", metric: "quantity", aggregation: "sum", format: "number" },
    ],
    chartTemplates: [
      { title: "Revenue Trend", type: "line", xKey: "date", yKey: "revenue", aggregation: "sum" },
      { title: "Revenue by Product", type: "bar", xKey: "product", yKey: "revenue", aggregation: "sum" },
      { title: "Revenue by Region", type: "bar", xKey: "region", yKey: "revenue", aggregation: "sum" },
    ],
    commonUserQuestions: ["top selling product", "month-wise trend", "which region performs best"],
    answerStrategy: "Identify revenue-like metric, group by product or region, calculate locally, then explain drivers.",
    cleaningRules: ["Check missing dates, products, revenue and quantity", "Flag duplicate orders"],
    qualityChecks: ["Missing revenue", "Negative revenue", "Duplicate transaction rows"],
  },
  {
    domain: "workforce_salary",
    requiredMetrics: ["salary_usd", "salary", "experience"],
    usefulDimensions: ["country", "education", "department", "company_size", "languages", "frameworks"],
    kpiTemplates: [
      { title: "Average Salary", metric: "salary_usd", aggregation: "avg", format: "currency" },
      { title: "Median Salary", metric: "salary_usd", aggregation: "median", format: "currency" },
      { title: "Highest Salary", metric: "salary_usd", aggregation: "max", format: "currency" },
    ],
    chartTemplates: [
      { title: "Average Salary by Country", type: "bar", xKey: "country", yKey: "salary_usd", aggregation: "avg" },
      { title: "Salary vs Experience", type: "scatter", xKey: "experience", yKey: "salary_usd", aggregation: "count" },
      { title: "Salary by Education", type: "bar", xKey: "education", yKey: "salary_usd", aggregation: "avg" },
    ],
    commonUserQuestions: ["compare salary by experience", "average salary by country", "what education correlates with highest salary"],
    answerStrategy: "Use salary as the metric, group by requested dimension, use average or median for fair comparisons.",
    cleaningRules: ["Check missing salary and experience", "Flag impossible negative salary", "Standardize education labels"],
    qualityChecks: ["Salary outliers", "Missing education", "Duplicate employee records"],
  },
  {
    domain: "finance",
    requiredMetrics: ["amount", "expense", "income", "budget"],
    usefulDimensions: ["category", "department", "account", "month", "vendor"],
    kpiTemplates: [
      { title: "Total Spend", metric: "amount", aggregation: "sum", format: "currency" },
      { title: "Average Expense", metric: "amount", aggregation: "avg", format: "currency" },
    ],
    chartTemplates: [
      { title: "Spend by Category", type: "bar", xKey: "category", yKey: "amount", aggregation: "sum" },
      { title: "Expense Trend", type: "line", xKey: "date", yKey: "amount", aggregation: "sum" },
    ],
    commonUserQuestions: ["where are we spending most", "month-wise expenses", "find abnormal expenses"],
    answerStrategy: "Calculate spend by category and period, then highlight budget risks and outliers.",
    cleaningRules: ["Check missing amount/category/date", "Standardize vendor names"],
    qualityChecks: ["Duplicate expenses", "Negative amounts", "Outlier spend"],
  },
  {
    domain: "education",
    requiredMetrics: ["marks", "score", "gpa", "attendance"],
    usefulDimensions: ["student", "class", "subject", "gender", "branch"],
    kpiTemplates: [
      { title: "Average Score", metric: "marks", aggregation: "avg", format: "number" },
      { title: "Highest Score", metric: "marks", aggregation: "max", format: "number" },
    ],
    chartTemplates: [
      { title: "Score by Subject", type: "bar", xKey: "subject", yKey: "marks", aggregation: "avg" },
      { title: "Score Distribution", type: "histogram", xKey: "marks", yKey: "marks", aggregation: "count" },
    ],
    commonUserQuestions: ["top students", "average marks by subject", "find low performers"],
    answerStrategy: "Use score-like metric, group by subject/class/student, and report rank or distribution.",
    cleaningRules: ["Check missing marks", "Flag marks outside valid range"],
    qualityChecks: ["Duplicate student rows", "Missing subject", "Invalid scores"],
  },
  {
    domain: "ecommerce",
    requiredMetrics: ["order_value", "units", "discount", "revenue"],
    usefulDimensions: ["category", "city", "customer", "product", "payment_method"],
    kpiTemplates: [
      { title: "Total Order Value", metric: "order_value", aggregation: "sum", format: "currency" },
      { title: "Average Order Value", metric: "order_value", aggregation: "avg", format: "currency" },
    ],
    chartTemplates: [
      { title: "Order Value by Category", type: "bar", xKey: "category", yKey: "order_value", aggregation: "sum" },
      { title: "Order Trend", type: "line", xKey: "order_date", yKey: "order_value", aggregation: "sum" },
    ],
    commonUserQuestions: ["top categories", "best city by order value", "monthly order trend"],
    answerStrategy: "Aggregate order value and units by requested shopping dimension.",
    cleaningRules: ["Check duplicate order ids", "Standardize product/category labels"],
    qualityChecks: ["Missing order value", "Negative units", "Duplicate orders"],
  },
  {
    domain: "inventory",
    requiredMetrics: ["stock", "reorder_level", "units_sold", "inventory_value"],
    usefulDimensions: ["sku", "product", "warehouse", "category", "supplier"],
    kpiTemplates: [
      { title: "Total Stock", metric: "stock", aggregation: "sum", format: "number" },
      { title: "Inventory Value", metric: "inventory_value", aggregation: "sum", format: "currency" },
    ],
    chartTemplates: [
      { title: "Stock by Category", type: "bar", xKey: "category", yKey: "stock", aggregation: "sum" },
      { title: "Stock by Warehouse", type: "bar", xKey: "warehouse", yKey: "stock", aggregation: "sum" },
    ],
    commonUserQuestions: ["low stock products", "inventory by warehouse", "reorder alerts"],
    answerStrategy: "Compare stock with reorder level and group inventory by warehouse/category.",
    cleaningRules: ["Check missing SKU", "Flag negative stock"],
    qualityChecks: ["Duplicate SKU rows", "Missing reorder level", "Negative inventory"],
  },
  {
    domain: "survey",
    requiredMetrics: ["rating", "score", "response_count"],
    usefulDimensions: ["question", "segment", "region", "sentiment", "channel"],
    kpiTemplates: [
      { title: "Average Rating", metric: "rating", aggregation: "avg", format: "number" },
      { title: "Responses", metric: "__row_count__", aggregation: "count", format: "number" },
    ],
    chartTemplates: [
      { title: "Rating by Segment", type: "bar", xKey: "segment", yKey: "rating", aggregation: "avg" },
      { title: "Sentiment Mix", type: "donut", xKey: "sentiment", yKey: "count", aggregation: "count" },
    ],
    commonUserQuestions: ["survey response distribution", "average rating by segment", "find unhappy customers"],
    answerStrategy: "Use rating/score for numeric comparisons and categorical counts for response distribution.",
    cleaningRules: ["Check missing ratings", "Standardize sentiment labels"],
    qualityChecks: ["Duplicate responses", "Blank comments", "Invalid ratings"],
  },
  {
    domain: "generic",
    requiredMetrics: ["value", "amount", "score"],
    usefulDimensions: ["category", "name", "type", "status"],
    kpiTemplates: [
      { title: "Total Records", metric: "__row_count__", aggregation: "count", format: "number" },
      { title: "Average Value", metric: "value", aggregation: "avg", format: "number" },
    ],
    chartTemplates: [
      { title: "Value by Category", type: "bar", xKey: "category", yKey: "value", aggregation: "avg" },
      { title: "Category Distribution", type: "donut", xKey: "category", yKey: "count", aggregation: "count" },
    ],
    commonUserQuestions: ["summarize this data", "top categories", "find data quality issues"],
    answerStrategy: "Pick the strongest numeric metric and category, then calculate a simple summary or grouped result.",
    cleaningRules: ["Check missing values", "Check duplicates", "Flag numeric outliers"],
    qualityChecks: ["Missing values", "Duplicate rows", "Unusual values"],
  },
];

export function findExcelAnalystPlaybook(domain = "generic") {
  return excelAnalystPlaybooks.find((playbook) => playbook.domain === domain) ||
    excelAnalystPlaybooks.find((playbook) => playbook.domain === "generic");
}
