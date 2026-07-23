import { AlertCircle, TrendingUp } from "lucide-react";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

const safeArray = (arr: unknown) => (Array.isArray(arr) ? arr : []);
const safeText = (txt: unknown, fallback = "-") =>
  typeof txt === "string" || typeof txt === "number" ? String(txt) : fallback;

interface AgenticRiskPanelProps {
  risks: Record<string, unknown>[];
  insights: Record<string, unknown>[];
}

export default function AgenticRiskPanel({ risks, insights }: AgenticRiskPanelProps) {
  const items = safeArray(risks.length > 0 ? risks : insights);
  if (items.length === 0) return null;

  return (
    <div className={CARD}>
      <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
        <TrendingUp className="size-4 text-emerald-400" />
        Risks & Insights
      </h3>
      <div className="mt-4 space-y-3 text-xs text-slate-350">
        {items.map((risk: Record<string, unknown>, idx: number) => (
          <div key={idx} className="flex items-start gap-2">
            <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{safeText(risk.message || risk.risk || risk.text || risk)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
