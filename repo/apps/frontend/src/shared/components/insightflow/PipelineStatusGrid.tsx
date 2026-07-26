type PipelineStep = {
  label: string;
  status: "completed" | "running" | "queued" | "skipped" | "no";
  progress: number;
};

const statusColor = {
  completed: "text-emerald-600 bg-emerald-500",
  running: "text-violet-600 bg-violet-600",
  queued: "text-slate-500 bg-slate-300",
  skipped: "text-slate-500 bg-slate-300",
  no: "text-slate-500 bg-slate-300",
};

export function PipelineStatusGrid({ steps }: { steps: PipelineStep[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-950">Pipeline Status</h3>
        <span className="text-xs font-semibold text-slate-500">previewing</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <div key={step.label} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">{step.label}</span>
              <span className={statusColor[step.status].split(" ")[0]}>
                {step.status}
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${statusColor[step.status].split(" ")[1]}`}
                style={{ width: `${step.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
