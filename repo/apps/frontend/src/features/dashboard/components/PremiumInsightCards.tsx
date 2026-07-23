import { Sparkles } from "lucide-react";
import type { PremiumInsight } from "@/features/dashboard/types/premiumDashboardTypes";

const toneClass = {
  gold: "border-amber-100 bg-amber-50 text-amber-900",
  cyan: "border-sky-100 bg-sky-50 text-sky-900",
  violet: "border-violet-100 bg-violet-50 text-violet-900",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-900",
};

const cleanInsight = (item: PremiumInsight): PremiumInsight => {
  let title = item.title;
  let message = item.message;
  let action = item.action;

  if (/in-demand skills|skills/i.test(title)) title = "Key Operational Signal";
  if (/explore skills/i.test(action || "")) action = "Review Signal";
  if (/view roadmap/i.test(action || "")) action = "Review Next Steps";
  if (/view details/i.test(action || "")) action = "View Segment";
  if (/view analysis/i.test(action || "")) action = "Review Analysis";

  message = message
    .replace(/skill column/gi, "multi-value column")
    .replace(/skills/gi, "signals")
    .replace(/strongest multi-value signals/gi, "strongest categorical signals")
    .replace(/high-value opportunities/gi, "high-value records and patterns")
    .replace(/opportunities/gi, "patterns");

  if (/correlation \((-?0\.00|0\.00)\)/i.test(message)) {
    message = message.replace(/show .*? correlation \((-?0\.00|0\.00)\)\.?/i, "show no meaningful correlation in the current view.");
  }

  return { ...item, title, message, action };
};

export function PremiumInsightCards({ insights }: { insights: PremiumInsight[] }) {
  const cleanInsights = insights.map(cleanInsight);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950">Insights</h3>
          <p className="text-xs leading-5 text-slate-500">Useful findings from the current dataset view</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {cleanInsights.map((item) => (
          <article key={item.id} className={`flex min-h-[150px] min-w-0 flex-col rounded-2xl border p-4 ${toneClass[item.tone]}`}>
            <h4 className="line-clamp-2 text-sm font-black leading-5">{item.title}</h4>
            <p className="mt-2 flex-1 text-xs leading-5 text-slate-600">{item.message}</p>
            {item.action && (
              <button className="mt-4 w-fit rounded-xl border border-current/20 bg-white/70 px-3 py-1.5 text-[11px] font-bold transition hover:bg-white" type="button">
                {item.action}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
