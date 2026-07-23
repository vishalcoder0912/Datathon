export type Aggregation =
  | "none"
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "count_unique"
  | "top_by_avg";

export type ChartType =
  | "bar"
  | "horizontal_bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "histogram"
  | "scatter"
  | "radar"
  | "composed"
  | "heatmap"
  | "map"
  | "table";

export type ChartIntent =
  | "trend"
  | "ranking"
  | "distribution"
  | "correlation"
  | "geo"
  | "comparison"
  | "composition"
  | "table"
  | "relationship"
  | "geo_ranking"
  | "segment_comparison"
  | "skill_salary_impact";

export interface SchemaColumn {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "unknown";
  role?: "category" | "metric" | "date" | "id" | "location" | "boolean" | "text";
  description?: string;
  uniqueValues?: string[];
  missingPct?: number;
  uniqueCount?: number;
  sampleValues?: string[];
}

export interface ColumnProfile {
  name: string;
  type: string;
  role: string;
  missingPct: number;
  uniqueCount: number;
  sampleValues: string[];
}

export interface ChartSpec {
  id?: string;
  type: ChartType;
  title: string;
  xKey: string;
  yKey: string;
  aggregation: Exclude<Aggregation, "count_unique" | "top_by_avg">;
  intent?: ChartIntent;
  limit?: number;
  splitValues?: boolean;
  multiValue?: boolean;
  splitDelimiter?: string;
}

export interface ChartConfig extends ChartSpec {
  id: string;
  data: Array<Record<string, string | number>>;
  subtitle?: string;
  warning?: string;
  businessValue?: string;
}

export interface KpiSpec {
  id?: string;
  title: string;
  metric?: string;
  aggregation?: Aggregation;
  format?: "number" | "currency" | "percent" | "text";
  businessKpi?: boolean;
}

export interface KpiConfig extends KpiSpec {
  id: string;
  value: string;
  rawValue?: number | string;
  subtitle?: string;
  insight?: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "date" | "geo" | "category" | "business";
  values: string[];
  priority: number;
}

export interface GeoIntelligenceConfig {
  enabled: boolean;
  field: string;
  metricField: string;
  mapType: "marker" | "choropleth" | "regional" | "single" | "none";
  locations: Array<{
    name: string;
    metricValue: number;
    recordCount: number;
    rank: number;
    formattedValue: string;
    highlight: "high" | "medium" | "low";
    contributionPct: number;
  }>;
  totalLocations: number;
  topLocation: { name: string; metricValue: number } | null;
  totalRecords: number;
  globalAverage: number;
  mostCommonCategory: string;
  recommendation: string;
}

export interface DashboardInsight {
  executive: string;
  analyst: string;
  story: string;
}

export interface DashboardPlan {
  kpis: KpiSpec[];
  charts: ChartSpec[];
  source?: string;
  domain?: string;
  filters?: FilterConfig[];
  geoIntelligence?: GeoIntelligenceConfig;
  insights?: DashboardInsight;
  qualityScore?: {
    total: number;
    passed: boolean;
    kpiRelevance?: number;
    chartDiversity?: number;
    geoRelevance?: number;
    businessUsefulness?: number;
    filterUsefulness?: number;
  };
}

export interface DatasetPayload {
  id?: string;
  name?: string;
  rows?: Array<Record<string, unknown>>;
  columns?: Array<{ name?: string; key?: string; type?: string; role?: string } | string>;
  runtimeContext?: Record<string, unknown>;
  dictionaryRows?: unknown[];
  dataDictionary?: unknown[];
}

export interface DashboardCommandResponse {
  action:
    | "GENERATE_DASHBOARD"
    | "FIX_DASHBOARD"
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "GENERATE_KPI"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "ANSWER";
  message?: string;
  response_type?: "dashboard_action";
  natural_response?: string;
  actions?: DashboardActionItem[];
  warnings?: string[];
  schema_safe?: boolean;
  chartSpec?: ChartSpec;
  kpiSpec?: KpiSpec;
  targetId?: string;
  targetTitle?: string;
}

export interface AiDashboardCommand {
  action: string;
  message?: string;
  chartSpec?: ChartSpec;
  kpiSpec?: KpiSpec;
  filters?: Record<string, unknown> | Array<{ key?: string; column?: string; operator?: string; value?: unknown }>;
  dashboard?: DashboardPlan;
  dashboardPlan?: DashboardPlan;
  provider?: string;
  model?: string;
}

export interface InsightFlowScore {
  total: number;
  kpiRelevance: number;
  chartDiversity: number;
  geoRelevance: number;
  businessUsefulness: number;
  filterUsefulness: number;
  passed: boolean;
}

export interface InsightFlowResult {
  valid: boolean;
  dashboardType: string;
  datasetType: string;
  qualityScore: InsightFlowScore;
  kpis: KpiConfig[];
  charts: ChartConfig[];
  geoIntelligence: GeoIntelligenceConfig;
  filters: FilterConfig[];
  insights: DashboardInsight;
}

export interface SchemaTrainResponse {
  ok: boolean;
  profile: ColumnProfile[] | null;
  dashboardSpec: DashboardPlan | null;
  agentPlan?: unknown;
  agentTools?: string[];
  ontologyMapping?: {
    inferredDomain: string;
    canonicalTerms: string[];
    mapping: Record<string, string>;
  };
  critic?: {
    score: number;
    status: string;
    issues: string[];
    improvements: string[];
  };
  guardian: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  calculatedDashboard?: DashboardPlan;
  memoryRecordId?: string;
  trainingExamplesCount?: number;
  message?: string;
}

export type DashboardDashboardSpecs = {
  kpis: KpiSpec[];
  charts: ChartSpec[];
  source?: string;
  domain?: string;
};
