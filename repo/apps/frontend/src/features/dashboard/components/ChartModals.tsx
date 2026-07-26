import { X } from "lucide-react";
import { PremiumChartCustomizer } from "./PremiumChartCustomizer";
import { CustomChartBuilder } from "./CustomChartBuilder";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

type ModalType = "customize" | "build" | null;

interface ChartModalsProps {
  modalType: ModalType;
  selectedChart: PremiumChart | null;
  availableColumns: string[];
  data: Array<Record<string, unknown>>;
  onCustomize: (updates: Partial<PremiumChart>) => void;
  onCreateChart: (chart: PremiumChart) => void;
  onClose: () => void;
}

export function ChartModals({
  modalType,
  selectedChart,
  availableColumns,
  data,
  onCustomize,
  onCreateChart,
  onClose,
}: ChartModalsProps) {
  if (!modalType) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-lg p-2 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          type="button"
          title="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {modalType === "customize" && selectedChart && (
          <PremiumChartCustomizer
            chart={selectedChart}
            availableColumns={availableColumns}
            onApply={(updates) => {
              onCustomize(updates);
              onClose();
            }}
            onCancel={onClose}
          />
        )}

        {modalType === "build" && (
          <CustomChartBuilder
            availableColumns={availableColumns}
            data={data}
            onCreateChart={(chart) => {
              onCreateChart(chart);
              onClose();
            }}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
