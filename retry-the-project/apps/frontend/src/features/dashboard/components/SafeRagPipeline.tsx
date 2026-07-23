import { CheckCircle2, Clock3, Database, FileInput, Layers3, Network, Sparkles, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { RagPipelineStep } from "@/features/dashboard/types/premiumDashboardTypes";

const icons = [FileInput, Layers3, Network, Database, Sparkles];

const getStatusClass = (status: RagPipelineStep["status"]) =>
  status === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : status === "active"
      ? "bg-violet-50 text-violet-700 border-violet-100"
      : status === "failed"
        ? "bg-rose-50 text-rose-700 border-rose-100"
        : "bg-slate-100 text-slate-500 border-slate-200";

const getStatusLabel = (status: RagPipelineStep["status"]) =>
  status === "completed" ? "Done" : status === "active" ? "Active" : status === "failed" ? "Failed" : status === "pending" ? "Waiting" : "Optional";

const StatusIcon = ({ status }: { status: RagPipelineStep["status"] }) => {
  if (status === "completed") return <CheckCircle2 className="size-3.5" />;
  if (status === "failed") return <XCircle className="size-3.5" />;
  return <Clock3 className="size-3.5" />;
};

const cleanSubtitle = (value: string) =>
  value
    .replace(/nomic-embed-text/i, "Optional embeddings")
    .replace(/Schema RAG/i, "Optional knowledge index")
    .replace(/Local Analytics/i, "Local analysis ready");

export function PremiumRagPipeline({ steps }: { steps: RagPipelineStep[] }) {
  return (
    <section className="col-span-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-black leading-5 text-slate-950">Analysis Pipeline</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Upload, schema review, optional AI retrieval, local insights</p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="size-3.5" /> Ready
        </span>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => {
          const Icon = icons[index] || Database;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-xs font-black leading-5 text-slate-900">{step.title}</p>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusClass(step.status)}`}>
                    <StatusIcon status={step.status} /> {getStatusLabel(step.status)}
                  </span>
                </div>
                <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">{cleanSubtitle(step.subtitle)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
