import type { DatasetRow } from "@/features/data/model/dataStore";

export type PremiumKpi = {
  id: string;
  title: string;
  value: string;
  rawValue?: number;
  subtitle?: string;
  delta?: string;
  icon?: "rows" | "average" | "median" | "max" | "segments" | "quality";
};

export type PremiumChartDatum = Record<string, string | number | null>;

export type PremiumChart = {
  id: string;
  title: string;
  type: "bar" | "histogram" | "scatter" | "donut" | "line" | "table" | "map";
  subtitle?: string;
  data: PremiumChartDatum[];
  xKey?: string;
  yKey?: string;
  metricOptions?: Array<{ key: string; label: string }>;
};

export type PremiumInsight = {
  id: string;
  title: string;
  message: string;
  tone: "gold" | "cyan" | "violet" | "emerald";
  action?: string;
};

export type AgentReasoningStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
};

export type RagPipelineStep = {
  id: string;
  title: string;
  subtitle: string;
  status: "completed" | "active" | "pending" | "failed" | "skipped";
};

export type DashboardSchemaColumnProfile = {
  name: string;
  declaredType?: string;
  role: "metric" | "dimension" | "date" | "entity" | "geo" | "identifier" | "text" | "ignored";
  semanticType: string;
  nonNullCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  uniqueRatio: number;
  numericCount: number;
  dateCount: number;
  geoCount: number;
  examples: string[];
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
};

export type DashboardSchemaProfile = {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  domain: string;
  qualityScore: number;
  primaryMetric: string | null;
  primaryDimension: string | null;
  primaryDate: string | null;
  primaryEntity: string | null;
  geoColumn: string | null;
  columns: DashboardSchemaColumnProfile[];
  warnings: string[];
};

export type PremiumDashboardModel = {
  generatedAt: string;
  primaryMetric: string | null;
  primaryDimension: string | null;
  rows: DatasetRow[];
  kpis: PremiumKpi[];
  charts: PremiumChart[];
  insights: PremiumInsight[];
  reasoning: AgentReasoningStep[];
  ragPipeline: RagPipelineStep[];
  qualityScore: number;
  aiSummary?: string;
  provider?: string;
  model?: string;
  warnings?: string[];
  schemaProfile?: DashboardSchemaProfile;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
