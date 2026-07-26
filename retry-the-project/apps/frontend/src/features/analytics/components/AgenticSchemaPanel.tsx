import { FileText } from "lucide-react";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

const safeArray = (arr: unknown) => (Array.isArray(arr) ? arr : []);
const safeText = (txt: unknown, fallback = "-") =>
  typeof txt === "string" || typeof txt === "number" ? String(txt) : fallback;

interface AgenticSchemaPanelProps {
  schemaProfile: Record<string, unknown> | null;
  columns: Record<string, unknown>[];
}

export default function AgenticSchemaPanel({ schemaProfile, columns }: AgenticSchemaPanelProps) {
  return (
    <div className={CARD}>
      <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
        <FileText className="size-4 text-blue-400" />
        Schema Profile
      </h3>

      {schemaProfile && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 text-center">
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
              <span className="text-xl font-extrabold text-white">
                {safeText(schemaProfile.rowCount)}
              </span>
              <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rows</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
              <span className="text-xl font-extrabold text-white">
                {safeText(schemaProfile.columnCount)}
              </span>
              <p className="text-[10px] text-slate-400 uppercase mt-0.5">Columns</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
              <span className="text-xl font-extrabold text-white">
                {safeArray(schemaProfile.numericColumns).length}
              </span>
              <p className="text-[10px] text-slate-400 uppercase mt-0.5">Measures</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
              <span className="text-xl font-extrabold text-white">
                {safeArray(schemaProfile.categoricalColumns).length + safeArray(schemaProfile.dateColumns).length}
              </span>
              <p className="text-[10px] text-slate-400 uppercase mt-0.5">Dimensions</p>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Column Classifications</h4>

            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs">
                <span className="font-bold text-slate-400 shrink-0 min-w-[70px]">Dimensions:</span>
                <span className="text-slate-200">
                  {[
                    ...safeArray(schemaProfile.categoricalColumns),
                    ...safeArray(schemaProfile.dateColumns),
                  ].join(", ") || "None"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs border-t border-slate-800/60 pt-2">
                <span className="font-bold text-slate-400 shrink-0 min-w-[70px]">Measures:</span>
                <span className="text-slate-200">
                  {safeArray(schemaProfile.numericColumns).join(", ") || "None"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
