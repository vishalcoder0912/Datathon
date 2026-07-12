import { Circle, AlertTriangle, ShieldCheck } from "lucide-react";

interface ProviderStatus {
  available: boolean;
  missing_models?: string[];
}

interface ProviderStatusPanelProps {
  gemini: ProviderStatus;
  ollama: ProviderStatus;
  mode: string;
}

export default function ProviderStatusPanel({ gemini, ollama, mode }: ProviderStatusPanelProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <span>AI Provider Router</span>
        <span className="text-violet-400 font-mono">{mode}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-950 p-2 border border-slate-800">
          <Circle className={`size-2.5 ${gemini.available ? "fill-emerald-400 text-emerald-400" : "fill-red-400 text-red-400"}`} />
          <div className="text-[11px]">
            <p className="font-semibold text-slate-200">Gemini Cloud</p>
            <p className="text-slate-400">{gemini.available ? "Available" : "Offline"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-950 p-2 border border-slate-800">
          <Circle className={`size-2.5 ${ollama.available ? "fill-emerald-400 text-emerald-400" : "fill-red-400 text-red-400"}`} />
          <div className="text-[11px]">
            <p className="font-semibold text-slate-200">Ollama Local</p>
            <p className="text-slate-400">{ollama.available ? "Available" : "Offline"}</p>
          </div>
        </div>
      </div>

      {ollama.available && ollama.missing_models && ollama.missing_models.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2.5 text-[11px] text-yellow-200">
          <AlertTriangle className="size-4 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Missing local models:</p>
            <p className="text-slate-400 font-mono mt-0.5">
              {ollama.missing_models.join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
        <ShieldCheck className="size-3.5" />
        <span>Schema-only planning &middot; zero rows sent to LLM</span>
      </div>
    </div>
  );
}
