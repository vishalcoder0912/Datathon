#!/usr/bin/env node

import {
  trainSchemaRagMemoryFromDataset,
} from "../src/services/ai-analyst/schema-rag-retriever.js";

const seeds = [
  {
    name: "Sales Analytics 2024 Dataset",
    dataset: {
      name: "Sales Analytics 2024",
      columns: [
        { name: "month", type: "string" },
        { name: "category", type: "string" },
        { name: "region", type: "string" },
        { name: "revenue", type: "number" },
        { name: "units_sold", type: "number" },
        { name: "profit_margin", type: "number" },
        { name: "channel", type: "string" },
      ],
      rows: [
        {
          month: "Jan",
          category: "Electronics",
          region: "North",
          revenue: 1200,
          units_sold: 12,
          profit_margin: 24,
          channel: "Online",
        },
        {
          month: "Feb",
          category: "Furniture",
          region: "South",
          revenue: 850,
          units_sold: 8,
          profit_margin: 18,
          channel: "Retail",
        },
        {
          month: "Mar",
          category: "Electronics",
          region: "West",
          revenue: 1500,
          units_sold: 15,
          profit_margin: 30,
          channel: "Online",
        },
        {
          month: "Apr",
          category: "Office",
          region: "North",
          revenue: 620,
          units_sold: 7,
          profit_margin: 16,
          channel: "Partner",
        },
        {
          month: "May",
          category: "Furniture",
          region: "East",
          revenue: 930,
          units_sold: 9,
          profit_margin: 21,
          channel: "Retail",
        },
      ],
    },
    dashboardPlan: {
      kpis: [
        {
          title: "Total Revenue",
          metric: "revenue",
          aggregation: "sum",
          format: "currency",
        },
        {
          title: "Average Revenue",
          metric: "revenue",
          aggregation: "avg",
          format: "currency",
        },
        {
          title: "Units Sold",
          metric: "units_sold",
          aggregation: "sum",
          format: "number",
        },
        {
          title: "Average Profit Margin",
          metric: "profit_margin",
          aggregation: "avg",
          format: "percent",
        },
        {
          title: "Product Categories",
          metric: "category",
          aggregation: "count_unique",
          format: "number",
        },
      ],
      charts: [
        {
          title: "Revenue by Category",
          type: "bar",
          xKey: "category",
          yKey: "revenue",
          aggregation: "sum",
          limit: 10,
        },
        {
          title: "Revenue by Region",
          type: "bar",
          xKey: "region",
          yKey: "revenue",
          aggregation: "sum",
          limit: 10,
        },
        {
          title: "Revenue Trend by Month",
          type: "line",
          xKey: "month",
          yKey: "revenue",
          aggregation: "sum",
          limit: 12,
        },
        {
          title: "Units Sold by Category",
          type: "bar",
          xKey: "category",
          yKey: "units_sold",
          aggregation: "sum",
          limit: 10,
        },
        {
          title: "Average Profit Margin by Category",
          type: "bar",
          xKey: "category",
          yKey: "profit_margin",
          aggregation: "avg",
          limit: 10,
        },
        {
          title: "Category Mix",
          type: "donut",
          xKey: "category",
          yKey: "count",
          aggregation: "count",
          limit: 10,
        },
        {
          title: "Revenue vs Units Sold",
          type: "scatter",
          xKey: "units_sold",
          yKey: "revenue",
          aggregation: "count",
          limit: 200,
        },
      ],
    },
  },
  {
    name: "Developer Salary Workforce Dataset",
    dataset: {
      name: "developer_salary_seed",
      columns: [
        { name: "experience" },
        { name: "country" },
        { name: "education" },
        { name: "languages" },
        { name: "frameworks" },
        { name: "company_size" },
        { name: "salary_usd" },
      ],
      rows: [
        {
          experience: 2,
          country: "India",
          education: "Bachelors",
          languages: "JavaScript, Python",
          frameworks: "React, Django",
          company_size: "51-200",
          salary_usd: 50000,
        },
        {
          experience: 5,
          country: "USA",
          education: "Masters",
          languages: "JavaScript, TypeScript",
          frameworks: "React, Next.js",
          company_size: "1000+",
          salary_usd: 120000,
        },
      ],
    },
    dashboardPlan: {
      kpis: [
        {
          title: "Total Records",
          metric: "__row_count__",
          aggregation: "count",
          format: "number",
        },
        {
          title: "Average Salary",
          metric: "salary_usd",
          aggregation: "avg",
          format: "currency",
        },
        {
          title: "Median Salary",
          metric: "salary_usd",
          aggregation: "median",
          format: "currency",
        },
        {
          title: "Highest Salary",
          metric: "salary_usd",
          aggregation: "max",
          format: "currency",
        },
        {
          title: "Countries",
          metric: "country",
          aggregation: "count_unique",
          format: "number",
        },
      ],
      charts: [
        {
          title: "Average Salary by Country",
          type: "bar",
          xKey: "country",
          yKey: "salary_usd",
          aggregation: "avg",
          limit: 10,
        },
        {
          title: "Salary Distribution",
          type: "histogram",
          xKey: "salary_usd",
          yKey: "salary_usd",
          aggregation: "count",
          limit: 12,
        },
        {
          title: "Salary vs Experience",
          type: "scatter",
          xKey: "experience",
          yKey: "salary_usd",
          aggregation: "count",
          limit: 500,
        },
        {
          title: "Education Distribution",
          type: "donut",
          xKey: "education",
          yKey: "count",
          aggregation: "count",
          limit: 10,
        },
        {
          title: "Average Salary by Language",
          type: "bar",
          xKey: "languages",
          yKey: "salary_usd",
          aggregation: "avg",
          limit: 10,
          splitValues: true,
        },
        {
          title: "Average Salary by Framework",
          type: "bar",
          xKey: "frameworks",
          yKey: "salary_usd",
          aggregation: "avg",
          limit: 10,
          splitValues: true,
        },
      ],
    },
  },
  {
    name: "Sales Commerce Dataset",
    dataset: {
      name: "sales_commerce_seed",
      columns: [
        { name: "Country" },
        { name: "Product" },
        { name: "Amount" },
        { name: "Quantity" },
        { name: "Year" },
      ],
      rows: [
        {
          Country: "India",
          Product: "A",
          Amount: 1000,
          Quantity: 5,
          Year: 2024,
        },
        {
          Country: "USA",
          Product: "B",
          Amount: 2000,
          Quantity: 10,
          Year: 2025,
        },
      ],
    },
    dashboardPlan: {
      kpis: [
        {
          title: "Total Records",
          metric: "__row_count__",
          aggregation: "count",
          format: "number",
        },
        {
          title: "Total Amount",
          metric: "Amount",
          aggregation: "sum",
          format: "currency",
        },
        {
          title: "Average Amount",
          metric: "Amount",
          aggregation: "avg",
          format: "currency",
        },
        {
          title: "Countries",
          metric: "Country",
          aggregation: "count_unique",
          format: "number",
        },
      ],
      charts: [
        {
          title: "Sales Amount by Country",
          type: "bar",
          xKey: "Country",
          yKey: "Amount",
          aggregation: "sum",
          limit: 10,
        },
        {
          title: "Sales Amount by Product",
          type: "bar",
          xKey: "Product",
          yKey: "Amount",
          aggregation: "sum",
          limit: 10,
        },
        {
          title: "Amount Trend by Year",
          type: "line",
          xKey: "Year",
          yKey: "Amount",
          aggregation: "sum",
          limit: 10,
        },
        {
          title: "Product Distribution",
          type: "donut",
          xKey: "Product",
          yKey: "count",
          aggregation: "count",
          limit: 10,
        },
      ],
    },
  },
];

for (const seed of seeds) {
  const result = await trainSchemaRagMemoryFromDataset({
    dataset: seed.dataset,
    acceptedDashboardPlan: seed.dashboardPlan,
    rating: "excellent",
    notes: `Seed training pattern: ${seed.name}`,
    source: "smart-seed-script",
    useOllama: false,
  });

  console.log("Trained:", seed.name);
  console.log("   Domain:", result.entry.domain);
  console.log("   Memory total:", result.stats.total);
}
