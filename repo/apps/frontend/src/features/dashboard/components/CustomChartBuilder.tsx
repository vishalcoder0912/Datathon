import { useState, useMemo } from "react";
import { ChevronRight, BarChart3, LineChart as LineChartIcon, ScatterChart as ScatterIcon } from "lucide-react";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";
import type {
  ChartType,
  CustomChartBuilderState,
} from "@/features/dashboard/types/chartManagementTypes";
import { PremiumChartCustomizer } from "./PremiumChartCustomizer";

const chartTypes: ChartType[] = ["bar", "line", "scatter", "donut", "histogram", "table"];

const chartTypeIcons: Record<ChartType, React.ReactNode> = {
  bar: <BarChart3 className="h-5 w-5" />,
  line: <LineChartIcon className="h-5 w-5" />,
  scatter: <ScatterIcon className="h-5 w-5" />,
  donut: <div className="h-5 w-5 rounded-full border-2 border-current" />,
  histogram: <div className="h-5 w-5 border-l-2 border-r-2 border-b-2 border-current" />,
  table: <div className="h-5 w-5 border border-current" />,
};

interface CustomChartBuilderProps {
  availableColumns: string[];
  data: Array<Record<string, unknown>>;
  onCreateChart: (chart: PremiumChart) => void;
  onCancel: () => void;
}

export function CustomChartBuilder({
  availableColumns,
  data,
  onCreateChart,
  onCancel,
}: CustomChartBuilderProps) {
  const [state, setState] = useState<CustomChartBuilderState>({
    currentStep: 1,
    chartType: null,
    xColumn: null,
    yColumn: null,
    customization: {
      title: "",
      showLegend: true,
      showGrid: true,
      showTooltip: true,
      aggregation: "none",
    },
    preview: null,
    error: null,
  });

  const columnTypes = useMemo(() => {
    const types: Record<string, "numeric" | "categorical" | "text" | "date"> = {};

    for (const col of availableColumns) {
      const samples = data.slice(0, 100).map((row) => row[col]);
      const numeric = samples.every((s) => !isNaN(Number(s)) && s !== null && s !== "");
      const date = samples.some((s) => !isNaN(Date.parse(String(s))));

      if (numeric) {
        types[col] = "numeric";
      } else if (date) {
        types[col] = "date";
      } else if (samples.every((s) => typeof s === "string" && s.length < 50)) {
        types[col] = "categorical";
      } else {
        types[col] = "text";
      }
    }

    return types;
  }, [availableColumns, data]);

  const generatePreview = useMemo(() => {
    if (!state.chartType || !state.xColumn) return null;

    const previewData: Array<Record<string, string | number | null>> = [];
    const grouped: Record<string, number[]> = {};

    for (const row of data) {
      const key = String(row[state.xColumn]);
      if (!grouped[key]) grouped[key] = [];

      if (state.yColumn) {
        const value = Number(row[state.yColumn]);
        if (!isNaN(value)) {
          grouped[key].push(value);
        }
      } else {
        grouped[key].push(1);
      }
    }

    for (const [key, values] of Object.entries(grouped)) {
      const item: Record<string, string | number | null> = { [state.xColumn || "label"]: key };

      if (state.yColumn) {
        switch (state.customization.aggregation) {
          case "sum":
            item[state.yColumn] = values.reduce((a, b) => a + b, 0);
            break;
          case "avg":
            item[state.yColumn] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case "count":
            item[state.yColumn] = values.length;
            break;
          case "min":
            item[state.yColumn] = Math.min(...values);
            break;
          case "max":
            item[state.yColumn] = Math.max(...values);
            break;
          default:
            item[state.yColumn] = values[0];
        }
      } else {
        item["value"] = values.length;
      }

      previewData.push(item);
    }

    return previewData.slice(0, 10);
  }, [state.chartType, state.xColumn, state.yColumn, state.customization.aggregation, data]);

  const handleChartTypeSelect = (type: ChartType) => {
    setState((prev) => ({
      ...prev,
      chartType: type,
      currentStep: 2,
    }));
  };

  const handleColumnSelect = (column: string, axis: "x" | "y") => {
    setState((prev) => ({
      ...prev,
      [axis === "x" ? "xColumn" : "yColumn"]: column,
      error: null,
    }));
  };

  const handleNext = () => {
    if (state.currentStep === 2) {
      if (!state.xColumn) {
        setState((prev) => ({
          ...prev,
          error: "Please select X-axis column",
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        currentStep: 3,
        error: null,
      }));
    } else if (state.currentStep === 3) {
      setState((prev) => ({
        ...prev,
        currentStep: 4,
        preview: generatePreview,
        error: null,
      }));
    } else if (state.currentStep === 4) {
      setState((prev) => ({
        ...prev,
        currentStep: 5,
        error: null,
      }));
    }
  };

  const handleCreateChart = (customChart: Partial<PremiumChart>) => {
    if (!state.chartType || !state.xColumn) {
      setState((prev) => ({
        ...prev,
        error: "Invalid chart configuration",
      }));
      return;
    }

    const newChart: PremiumChart = {
      id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: state.chartType,
      title: state.customization.title || `${state.chartType} Chart`,
      subtitle: state.customization.subtitle,
      xKey: state.xColumn,
      yKey: state.yColumn || "value",
      data: generatePreview || [],
      ...customChart,
    };

    onCreateChart(newChart);
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      currentStep: (Math.max(1, prev.currentStep - 1)) as 1 | 2 | 3 | 4 | 5,
      error: null,
    }));
  };

  // Step 1: Chart Type Selection
  if (state.currentStep === 1) {
    return (
      <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/80 p-6">
        <h2 className="mb-2 text-lg font-bold text-white">Create Custom Chart</h2>
        <p className="mb-6 text-sm text-slate-400">Step 1 of 4: Select Chart Type</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {chartTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleChartTypeSelect(type)}
              className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-left transition-all hover:border-violet-400/50 hover:bg-slate-900"
              type="button"
            >
              <div className="flex items-center gap-3">
                <div className="text-violet-400">{chartTypeIcons[type]}</div>
                <div>
                  <div className="font-semibold text-white">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </div>
                  <div className="text-xs text-slate-500">Best for comparing data</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Column Selection
  if (state.currentStep === 2) {
    return (
      <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/80 p-6">
        <h2 className="mb-2 text-lg font-bold text-white">Create Custom Chart</h2>
        <p className="mb-6 text-sm text-slate-400">
          Step 2 of 4: Select Data Columns for {state.chartType}
        </p>

        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              X-Axis Column (Required)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableColumns.map((col) => (
                <button
                  key={col}
                  onClick={() => handleColumnSelect(col, "x")}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    state.xColumn === col
                      ? "border-violet-400 bg-violet-500/20 text-violet-200"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                  }`}
                  type="button"
                >
                  <div className="font-medium">{col}</div>
                  <div className="text-xs text-slate-500">
                    {columnTypes[col]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Y-Axis Column (Optional)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleColumnSelect("", "y")}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  !state.yColumn
                    ? "border-violet-400 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                }`}
                type="button"
              >
                <div className="font-medium">None</div>
                <div className="text-xs text-slate-500">Count only</div>
              </button>

              {availableColumns
                .filter((col) => columnTypes[col] === "numeric")
                .map((col) => (
                  <button
                    key={col}
                    onClick={() => handleColumnSelect(col, "y")}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      state.yColumn === col
                        ? "border-violet-400 bg-violet-500/20 text-violet-200"
                        : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                    }`}
                    type="button"
                  >
                    <div className="font-medium">{col}</div>
                    <div className="text-xs text-slate-500">numeric</div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {state.error && (
          <div className="mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            {state.error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            type="button"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
            type="button"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Aggregation Options
  if (state.currentStep === 3) {
    const aggOptions = [
      { name: "none", label: "None / Default", desc: "No aggregation. Shows row-level values." },
      { name: "sum", label: "Sum", desc: "Total sum of all numerical values in group." },
      { name: "avg", label: "Average", desc: "Average mean value of numerical group." },
      { name: "count", label: "Count", desc: "Number of rows matching group." },
      { name: "min", label: "Minimum", desc: "Minimum value in group." },
      { name: "max", label: "Maximum", desc: "Maximum value in group." },
    ];
    return (
      <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/80 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-bold text-white">Create Custom Chart</h2>
        <p className="mb-6 text-sm text-slate-400">Step 3 of 5: Choose Aggregation Method</p>

        <div className="grid gap-3 mb-6">
          {aggOptions.map((agg) => (
            <button
              key={agg.name}
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  customization: {
                    ...prev.customization,
                    aggregation: agg.name as any,
                  },
                }));
              }}
              className={`rounded-lg border p-4 text-left transition ${
                state.customization.aggregation === agg.name
                  ? "border-violet-400 bg-violet-500/20 text-violet-200"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"
              }`}
              type="button"
            >
              <div className="font-semibold text-white">{agg.label}</div>
              <div className="text-xs text-slate-500">{agg.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            type="button"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
            type="button"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Step 4: Configure Titles & Preview Data
  if (state.currentStep === 4) {
    return (
      <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/80 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-bold text-white">Create Custom Chart</h2>
        <p className="mb-6 text-sm text-slate-400">Step 4 of 5: Configure Titles & Preview Data</p>

        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Chart Title</label>
            <input
              type="text"
              value={state.customization.title || ""}
              onChange={(e) => {
                setState((prev) => ({
                  ...prev,
                  customization: {
                    ...prev.customization,
                    title: e.target.value,
                  },
                }));
              }}
              placeholder={`e.g., ${state.yColumn || "Value"} by ${state.xColumn}`}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-white outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Subtitle (Optional)</label>
            <input
              type="text"
              value={state.customization.subtitle || ""}
              onChange={(e) => {
                setState((prev) => ({
                  ...prev,
                  customization: {
                    ...prev.customization,
                    subtitle: e.target.value,
                  },
                }));
              }}
              placeholder="e.g., Aggregated dataset metrics view"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-white outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Computed Preview (First 5 Rows)</p>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              {state.preview && state.preview.length > 0 ? (
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {state.xColumn && <th className="px-2 py-2 text-left">{state.xColumn}</th>}
                        {state.yColumn && <th className="px-2 py-2 text-right">{state.yColumn}</th>}
                        {!state.yColumn && <th className="px-2 py-2 text-right">count</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {state.preview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-800">
                          <td className="px-2 py-2">{String(row[state.xColumn!])}</td>
                          <td className="px-2 py-2 text-right">
                            {state.yColumn
                              ? typeof row[state.yColumn] === "number"
                                ? (row[state.yColumn] as number).toFixed(2)
                                : row[state.yColumn]
                              : row["value"]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No preview rows computed.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            type="button"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
            type="button"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Step 5: Review & Save
  if (state.currentStep === 5) {
    return (
      <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/80 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-bold text-white">Create Custom Chart</h2>
        <p className="mb-6 text-sm text-slate-400">Step 5 of 5: Review & Save</p>

        <div className="mb-6 space-y-3 text-sm">
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <span className="text-slate-300">Chart Type</span>
            <span className="font-semibold text-white uppercase">{state.chartType}</span>
          </div>
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <span className="text-slate-300">X-Axis Column</span>
            <span className="font-semibold text-white">{state.xColumn}</span>
          </div>
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <span className="text-slate-300">Y-Axis Column</span>
            <span className="font-semibold text-white">{state.yColumn || "None (Count only)"}</span>
          </div>
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <span className="text-slate-300">Aggregation</span>
            <span className="font-semibold text-white uppercase">{state.customization.aggregation || "none"}</span>
          </div>
          <div className="flex justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <span className="text-slate-300">Title</span>
            <span className="font-semibold text-cyan-300">{state.customization.title || `${state.chartType} Chart`}</span>
          </div>
        </div>

        {state.error && (
          <div className="mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            {state.error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            type="button"
          >
            Back
          </button>
          <button
            onClick={() => handleCreateChart({})}
            className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
            type="button"
          >
            Save & Add Chart
          </button>
        </div>
      </div>
    );
  }

  return null;
}
