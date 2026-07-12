import { z } from "zod";

export const KpiSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  metric: z.string(),
  aggregation: z.enum(["count", "sum", "avg", "min", "max", "median", "count_unique", "top_by_avg"]),
  format: z.enum(["number", "currency", "percent", "text"]),
  sourceColumn: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  businessKpi: z.boolean().optional(),
});

export const ChartSchema = z.object({
  id: z.string(),
  type: z.enum([
    "bar",
    "horizontal_bar",
    "horizontalBar",
    "line",
    "area",
    "donut",
    "pie",
    "scatter",
    "histogram",
    "heatmap",
    "map",
    "table",
  ]),
  title: z.string().min(2),
  xKey: z.string().nullable(),
  yKey: z.string().nullable(),
  aggregation: z.enum(["none", "count", "sum", "avg", "min", "max", "median"]),
  intent: z.enum(["trend", "ranking", "distribution", "correlation", "geo", "comparison", "table", "relationship", "geo_ranking", "segment_comparison", "skill_salary_impact"]),
  confidence: z.number().min(0).max(1),
  multiValue: z.boolean().optional(),
  splitValues: z.boolean().optional(),
  splitDelimiter: z.string().optional(),
});

export const DashboardPlanSchema = z.object({
  schemaOnly: z.literal(true),
  datasetName: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  dashboardType: z.string().optional(),
  domain: z.string(),
  businessDomain: z.object({}).passthrough().optional(),
  semanticProfile: z.object({}).passthrough(),
  ontology: z.object({}).passthrough(),
  kpis: z.array(KpiSchema).max(8),
  charts: z.array(ChartSchema).max(10),
  geo: z.object({}).passthrough(),
  insights: z.array(z.object({}).passthrough()),
  story: z.object({}).passthrough(),
  governance: z.object({}).passthrough().optional(),
  ragMatches: z.array(z.any()),
});
