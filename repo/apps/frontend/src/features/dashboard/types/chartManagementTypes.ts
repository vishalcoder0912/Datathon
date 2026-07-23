// Chart Customization Types
export type ChartType = "bar" | "histogram" | "scatter" | "donut" | "line" | "table";

export type ChartColorMode = "gradient" | "single" | "palette";

export interface ChartCustomizationOptions {
  title?: string;
  subtitle?: string;
  chartType?: ChartType;
  xKey?: string;
  yKey?: string;
  colorMode?: ChartColorMode;
  colors?: string[];
  singleColor?: string;
  showLegend?: boolean;
  legendPosition?: "top" | "right" | "bottom" | "left";
  showGrid?: boolean;
  gridStyle?: "solid" | "dashed";
  showTooltip?: boolean;
  tooltipFormat?: string;
  height?: number;
  width?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisAngle?: number;
  showXAxisLabels?: boolean;
  showYAxisLabels?: boolean;
  aggregation?: "sum" | "avg" | "count" | "min" | "max" | "none";
}

export interface ChartCommand {
  id: string;
  action: "create" | "modify" | "remove" | "duplicate" | "toggle_visibility" | "reorder";
  chartId?: string;
  targetChartId?: string; // For reorder operations
  customization?: ChartCustomizationOptions;
  confidence?: number; // 0-1 confidence score for AI-parsed commands
  originalQuery?: string;
  explanation?: string; // AI explanation of what it will do
}

export interface ChartAction {
  type: "add" | "remove" | "update" | "duplicate" | "toggle";
  chartId: string;
  chartData?: ChartCustomizationOptions & {
    data: Array<Record<string, string | number | null>>;
  };
  previousState?: ChartCustomizationOptions;
  timestamp: number;
}

export interface ChartHistory {
  past: ChartAction[];
  present: ChartAction | null;
  future: ChartAction[];
}

export interface CustomChartBuilderStep {
  step: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  completed: boolean;
}

export interface CustomChartBuilderState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  chartType: ChartType | null;
  xColumn: string | null;
  yColumn: string | null;
  customization: ChartCustomizationOptions;
  preview: Array<Record<string, string | number | null>> | null;
  error: string | null;
}

export interface ChartSuggestion {
  id: string;
  title: string;
  description: string;
  chartType: ChartType;
  xKey: string;
  yKey: string;
  reasoning: string;
  confidence: number;
}

export interface ChartOperationResult {
  success: boolean;
  chartId?: string;
  error?: string;
  message: string;
}
