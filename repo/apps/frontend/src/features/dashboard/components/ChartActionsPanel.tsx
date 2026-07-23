import { Copy, Edit2, Eye, EyeOff, Trash2 } from "lucide-react";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

interface ChartActionsPanelProps {
  chart: PremiumChart;
  isVisible: boolean;
  isSelected: boolean;
  onEdit: (chartId: string) => void;
  onRemove: (chartId: string) => void;
  onDuplicate: (chartId: string) => void;
  onToggleVisibility: (chartId: string) => void;
  onSelect: (chartId: string) => void;
}

export function ChartActionsPanel({
  chart,
  isVisible,
  isSelected,
  onEdit,
  onRemove,
  onDuplicate,
  onToggleVisibility,
  onSelect,
}: ChartActionsPanelProps) {
  const handleRemoveClick = () => {
    if (window.confirm(`Are you sure you want to remove "${chart.title}"?`)) {
      onRemove(chart.id);
    }
  };

  return (
    <div
      className={`absolute top-3 right-3 flex gap-1 rounded-lg border bg-slate-900/80 p-2 opacity-0 transition-opacity group-hover:opacity-100 ${
        isSelected
          ? "border-violet-400/50 opacity-100"
          : "border-slate-700/50 hover:border-slate-600"
      }`}
    >
      <button
        onClick={() => onSelect(chart.id)}
        title={isSelected ? "Deselect" : "Select"}
        className={`rounded-lg p-1.5 transition-colors ${
          isSelected
            ? "bg-violet-500/30 text-violet-300"
            : "hover:bg-slate-800 text-slate-400 hover:text-white"
        }`}
        type="button"
      >
        <div
          className={`h-3 w-3 rounded-sm border-2 ${
            isSelected
              ? "border-violet-400 bg-violet-400"
              : "border-slate-500"
          }`}
        />
      </button>

      <button
        onClick={() => onEdit(chart.id)}
        title="Edit chart"
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        type="button"
      >
        <Edit2 className="h-4 w-4" />
      </button>

      <button
        onClick={() => onDuplicate(chart.id)}
        title="Duplicate chart"
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        type="button"
      >
        <Copy className="h-4 w-4" />
      </button>

      <button
        onClick={() => onToggleVisibility(chart.id)}
        title={isVisible ? "Hide chart" : "Show chart"}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        type="button"
      >
        {isVisible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </button>

      <button
        onClick={handleRemoveClick}
        title="Remove chart"
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
