import { Activity, AlertCircle, CheckCircle2, Cpu } from "lucide-react";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

const safeArray = (arr: unknown) => (Array.isArray(arr) ? arr : []);
const safeText = (txt: unknown, fallback = "-") =>
  typeof txt === "string" || typeof txt === "number" ? String(txt) : fallback;

interface AgenticAuditPanelProps {
  audit: Record<string, unknown>[];
}

export default function AgenticAuditPanel({ audit }: AgenticAuditPanelProps) {
  return (
    <div className={CARD}>
      <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
        <Activity className="size-4 text-violet-400" />
        Audit Logs
      </h3>
      <div className="mt-4 space-y-3.5">
        {safeArray(audit).map((step: Record<string, unknown>, idx: number) => (
          <div
            key={idx}
            className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-950/60 transition"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono block">
                Orchestrator Step
              </span>
              <h4 className="font-bold text-white text-sm capitalize">
                {safeText(step.step).replace(/_/g, " ")}
              </h4>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                <Cpu className="size-3.5 text-slate-500" />
                {safeText(step.model)}
              </div>
            </div>

            <div className="flex items-center gap-2 md:text-right md:flex-col md:items-end">
              <span
                className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                  step.status === "ok"
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                }`}
              >
                {step.status === "ok" ? (
                  <>
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    Completed
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3 text-amber-400" />
                    Fallback Triggered
                  </>
                )}
              </span>
              {step.error && (
                <span className="text-[10px] text-red-300 truncate max-w-[200px]">
                  {safeText(step.error)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
