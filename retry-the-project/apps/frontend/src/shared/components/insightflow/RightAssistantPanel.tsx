import { Send, Sparkles } from "lucide-react";

type RightAssistantPanelProps = {
  title?: string;
  subtitle?: string;
  suggestions?: string[];
  recentActions?: string[];
};

export function RightAssistantPanel({
  title = "InsightFlow AI",
  subtitle = "AI can control dashboard layout and insights.",
  suggestions = [
    "Compare Salary Usd by Country",
    "Show top 5 Country by Salary Usd",
    "Add a KPI for median Salary Usd",
    "Run Geo Intelligence",
    "Explain the trend",
  ],
  recentActions = [],
}: RightAssistantPanelProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-50 p-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-950">{title}</h3>
              <p className="line-clamp-1 text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
            Active
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-violet-600">InsightFlow AI</p>
            <p className="mt-2 text-sm text-slate-600">
              I can control dashboard layout, metrics, charts, filters, and Geo Intelligence.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Ask InsightFlow AI..."
            />
            <button className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 p-2 text-white shadow">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-950">Suggested actions</h3>
          <button className="text-xs font-semibold text-blue-600">View all</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <button
              key={item}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-violet-50 hover:text-violet-700"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-bold text-slate-950">Recent actions</h3>
        {recentActions.length ? (
          <div className="mt-3 space-y-2">
            {recentActions.map((action) => (
              <p key={action} className="text-sm text-slate-600">{action}</p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No AI actions yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-black text-emerald-500">100%</p>
        <p className="text-sm font-bold text-slate-950">Schema confidence</p>
        <p className="text-xs text-slate-500">Based on data quality and field compatibility.</p>
      </section>
    </aside>
  );
}
