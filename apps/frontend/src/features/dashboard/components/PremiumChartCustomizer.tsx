import { useState } from "react";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";
import type {
  ChartType,
  ChartColorMode,
  ChartCustomizationOptions,
} from "@/features/dashboard/types/chartManagementTypes";

const chartTypes: ChartType[] = ["bar", "line", "scatter", "donut", "histogram", "table"];
const colorModes: ChartColorMode[] = ["gradient", "single", "palette"];
const legendPositions = ["top", "right", "bottom", "left"] as const;
const aggregationOptions = ["none", "sum", "avg", "count", "min", "max"] as const;

interface PremiumChartCustomizerProps {
  chart: PremiumChart;
  availableColumns: string[];
  onApply: (updates: Partial<PremiumChart>) => void;
  onCancel: () => void;
}

export function PremiumChartCustomizer({
  chart,
  availableColumns,
  onApply,
  onCancel,
}: PremiumChartCustomizerProps) {
  const [customization, setCustomization] = useState<ChartCustomizationOptions>({
    title: chart.title,
    subtitle: chart.subtitle,
    chartType: chart.type as ChartType,
    xKey: chart.xKey,
    yKey: chart.yKey,
    colorMode: "gradient",
    showLegend: true,
    legendPosition: "right",
    showGrid: true,
    gridStyle: "solid",
    showTooltip: true,
    xAxisAngle: -8,
    showXAxisLabels: true,
    showYAxisLabels: true,
    aggregation: "none",
  });

  const [previewMode, setPreviewMode] = useState(false);

  const handleApply = () => {
    onApply({
      title: customization.title || chart.title,
      subtitle: customization.subtitle,
      type: customization.chartType || (chart.type as ChartType),
      xKey: customization.xKey || chart.xKey,
      yKey: customization.yKey || chart.yKey,
    });
  };

  return (
    <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/80 p-6">
      <h2 className="mb-6 text-lg font-bold text-white">Customize Chart</h2>

      {/* Basic Information */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Chart Title
          </label>
          <input
            type="text"
            value={customization.title || ""}
            onChange={(e) =>
              setCustomization({ ...customization, title: e.target.value })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white outline-none focus:border-violet-400/50"
            placeholder="Enter chart title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Subtitle
          </label>
          <input
            type="text"
            value={customization.subtitle || ""}
            onChange={(e) =>
              setCustomization({ ...customization, subtitle: e.target.value })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white outline-none focus:border-violet-400/50"
            placeholder="Enter subtitle (optional)"
          />
        </div>
      </div>

      {/* Chart Type */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Chart Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {chartTypes.map((type) => (
            <button
              key={type}
              onClick={() =>
                setCustomization({ ...customization, chartType: type })
              }
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                customization.chartType === type
                  ? "border-violet-400 bg-violet-500/20 text-violet-200"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"
              }`}
              type="button"
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Data Configuration */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            X-Axis Column
          </label>
          <select
            value={customization.xKey || ""}
            onChange={(e) =>
              setCustomization({ ...customization, xKey: e.target.value })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white outline-none focus:border-violet-400/50"
          >
            <option value="">Select column</option>
            {availableColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Y-Axis Column
          </label>
          <select
            value={customization.yKey || ""}
            onChange={(e) =>
              setCustomization({ ...customization, yKey: e.target.value })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white outline-none focus:border-violet-400/50"
          >
            <option value="">Select column</option>
            {availableColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Aggregation Method
          </label>
          <select
            value={customization.aggregation || "none"}
            onChange={(e) =>
              setCustomization({
                ...customization,
                aggregation: e.target.value as typeof aggregationOptions[number],
              })
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-white outline-none focus:border-violet-400/50"
          >
            {aggregationOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Display Options */}
      <div className="mb-6 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.showLegend}
            onChange={(e) =>
              setCustomization({ ...customization, showLegend: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-900/70"
          />
          <span className="text-sm text-slate-300">Show Legend</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.showGrid}
            onChange={(e) =>
              setCustomization({ ...customization, showGrid: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-900/70"
          />
          <span className="text-sm text-slate-300">Show Grid</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.showTooltip}
            onChange={(e) =>
              setCustomization({ ...customization, showTooltip: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-900/70"
          />
          <span className="text-sm text-slate-300">Show Tooltip on Hover</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.showXAxisLabels}
            onChange={(e) =>
              setCustomization({ ...customization, showXAxisLabels: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-900/70"
          />
          <span className="text-sm text-slate-300">Show X-Axis Labels</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customization.showYAxisLabels}
            onChange={(e) =>
              setCustomization({ ...customization, showYAxisLabels: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-700 bg-slate-900/70"
          />
          <span className="text-sm text-slate-300">Show Y-Axis Labels</span>
        </label>
      </div>

      {/* Color Customization */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Color Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {colorModes.map((mode) => (
            <button
              key={mode}
              onClick={() =>
                setCustomization({ ...customization, colorMode: mode })
              }
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                customization.colorMode === mode
                  ? "border-violet-400 bg-violet-500/20 text-violet-200"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"
              }`}
              type="button"
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 border-t border-slate-800 pt-6">
        <button
          onClick={handleApply}
          className="flex-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
          type="button"
        >
          Apply Changes
        </button>
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
