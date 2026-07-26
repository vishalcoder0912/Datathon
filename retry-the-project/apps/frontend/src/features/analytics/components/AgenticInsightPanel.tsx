import { Brain } from "lucide-react";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

interface AgenticInsightPanelProps {
  insights: Record<string, unknown>;
  analysisResult: Record<string, unknown>;
}

export default function AgenticInsightPanel({ insights, analysisResult }: AgenticInsightPanelProps) {
  const dashboard = (analysisResult.dashboard ?? {}) as Record<string, unknown>;
  const schemaAnalysis = (analysisResult.schemaAnalysis ?? {}) as Record<string, unknown>;

  const text = (insights.finalExplanation as string) ||
    (insights.dashboardGoal as string) ||
    (dashboard.finalExplanation as string) ||
    (schemaAnalysis.dashboardGoal as string) ||
    "Agentic planning completed successfully. The dashboard has been structured using deterministic layout specs.";

  return (
    <div className={`${CARD} bg-gradient-to-b from-blue-900/10 to-slate-900/60`}>
      <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
        <Brain className="size-4 text-blue-400" />
        AI Insights
      </h3>
      <p className="text-slate-300 text-sm mt-3 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}
