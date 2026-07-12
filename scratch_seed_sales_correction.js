import { saveLearningCorrection } from "./apps/backend/src/services/ai-analyst/self-learning-memory.js";

const correction = {
  domain: "sales_analytics",
  userQuestion: "Analyze any sales dataset like a real business/data analyst.",
  wrongAnswer: "Fallback generic analytics layout",
  correctAnswer: "KPIs: Total Revenue, Total Orders, Units Sold, Average Order Value, Total Profit, Profit Margin. Charts: Revenue Trend, Revenue by Region, Top Products by Revenue, Revenue by Category, Profit by Product, Quantity Sold by Product.",
  schemaColumns: [
    "revenue", "sales", "amount", "total_price", "net_sales", "profit", "quantity", "qty", "units",
    "date", "region", "country", "city", "product", "category", "customer", "sales_channel", "payment_method", "sales_rep"
  ],
  rule: `Sales Analytics rules:
Primary metrics: revenue, sales, amount, total_price, net_sales, profit, quantity, orders.
Dimensions: date, region, country, city, product, category, customer, sales_channel, payment_method, sales_rep.
KPIs:
- Total Revenue: sum of revenue/sales/amount
- Total Orders: count of order_id/invoice_id/transaction_id
- Units Sold: sum of quantity
- Average Order Value: total_revenue / total_orders
- Total Profit: sum of profit/margin_amount
- Profit Margin: total_profit / total_revenue * 100
Charts:
- Revenue Trend: line chart of revenue vs date (required)
- Revenue by Region: bar chart of revenue vs region/country
- Top Products: bar chart of revenue vs product (limit 10)
- Revenue by Category: bar chart of revenue vs category
- Profit by Product: bar chart of profit vs product
- Quantity Sold by Product: bar chart of quantity vs product
Analyst Thinking: Identify revenue, date, product, region, customer, category. Prefer revenue/profit KPIs over random metrics. Do not use ID columns as metrics. Reject useless charts.`
};

try {
  const result = saveLearningCorrection(correction);
  console.log("SUCCESS! Seeded Sales Analytics learning correction:", result);
} catch (error) {
  console.error("FAILED to seed Sales Analytics learning correction:", error);
}
