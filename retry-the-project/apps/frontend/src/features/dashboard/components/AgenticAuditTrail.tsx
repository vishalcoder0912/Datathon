type AuditStep = {
  agent: string;
  model?: string;
  action: string;
  status?: string;
};

export function AgenticAuditTrail({ steps = [] }: { steps?: AuditStep[] }) {
  if (!steps.length) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">Agent Audit Trail</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {steps.length} steps
        </span>
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={`${step.agent}-${index}`} className="rounded-md border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {index + 1}. {step.agent}
                </p>
                <p className="text-sm text-slate-600">{step.action}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{step.model || "deterministic-tool"}</p>
                <p className="uppercase">{step.status || "success"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
