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

export type DashboardTheme = "dark" | "light";

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

export interface DashboardFilters {
  [key: string]: unknown;
  dateStart?: string;
  dateEnd?: string;
  conditions?: Array<{
    id: string;
    column: string;
    operator: string;
    value: string;
  }>;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  xKey: string;
  yKey: string;
  aggregation: Exclude<Aggregation, "count_unique" | "top_by_avg">;
  intent?: ChartIntent;
  limit?: number;
  filters?: Array<{
    column: string;
    operator?: string;
    value: string | number | boolean;
  }>;
  sort?: {
    by: string;
    direction: "asc" | "desc";
  };
  calculationSource?: string;
}

export interface KpiConfig extends KpiSpec {
  id: string;
  value: string;
  rawValue?: number | string;
}

export interface DashboardState {
  filters: DashboardFilters;
  charts: ChartConfig[];
  extraKpis: KpiConfig[];
  theme: DashboardTheme;
  selectedChartId?: string;
}

export interface SchemaColumn {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "unknown";
  role?: "category" | "metric" | "date" | "id" | "location" | "boolean" | "text";
  description?: string;
  uniqueValues?: string[];
}

export interface DashboardSchema {
  columns: SchemaColumn[];
  rowCount: number;
  dictionary?: Record<string, string>;
}

export interface DashboardCommand {
  action:
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "ADD_KPI"
    | "GENERATE_KPI"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "ANSWER"
    | "FIX_DASHBOARD";
  message: string;
  chartSpec?: ChartSpec;
  kpiSpec?: KpiSpec;
  filters?: Record<string, string>;
  schemaOnly: true;
  model?: string;
  provider?: string;
}

// ─── InsightFlow Enhanced Types ──────────────────────────────

export interface InsightFlowScore {
  total: number;
  kpiRelevance: number;
  chartDiversity: number;
  geoRelevance: number;
  businessUsefulness: number;
  filterUsefulness: number;
  passed: boolean;
}

export interface InsightFlowInsights {
  executive: string;
  analyst: string;
  story: string;
}

export interface InsightFlowGeoLocation {
  name: string;
  metricValue: number;
  recordCount: number;
  rank: number;
  formattedValue: string;
  highlight: "high" | "medium" | "low";
  contributionPct: number;
}

export interface InsightFlowGeo {
  enabled: boolean;
  field: string;
  metricField: string;
  mapType: "marker" | "choropleth" | "regional" | "single" | "none";
  locations: InsightFlowGeoLocation[];
  totalLocations: number;
  topLocation: InsightFlowGeoLocation | null;
  totalRecords: number;
  globalAverage: number;
  mostCommonCategory: string;
  recommendation: string;
}

export interface InsightFlowFilter {
  key: string;
  label: string;
  type: "date" | "geo" | "category" | "business";
  values: string[];
  priority: number;
}

export interface InsightFlowResult {
  valid: boolean;
  dashboardType: string;
  datasetType: string;
  qualityScore: InsightFlowScore;
  kpis: Array<{
    id: string;
    title: string;
    value: string;
    rawValue: number | string;
    subtitle: string;
    metric: string;
    aggregation: string;
    format: "number" | "currency" | "percent" | "text";
    businessValue: string;
    domain: string;
  }>;
  charts: Array<{
    id: string;
    type: ChartType;
    title: string;
    subtitle: string;
    xKey: string;
    yKey: string;
    aggregation: string;
    intent: ChartIntent;
    data: Array<Record<string, string | number>>;
    businessValue: string;
    warning?: string;
  }>;
  geoIntelligence: InsightFlowGeo;
  filters: InsightFlowFilter[];
  insights: InsightFlowInsights;
}
