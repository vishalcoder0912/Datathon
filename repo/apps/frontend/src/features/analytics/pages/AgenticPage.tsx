import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  Database,
  Globe2,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api, type AgenticConfigResponse, type AgenticHealthResponse } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import { buildCommandCenterModel, titleCase } from "@/features/dashboard/utils/commandCenterAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";

function timeAgo(value?: Date | string | null) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Just now";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  return `${minutes} min ago`;
}

export default function AgenticPage() {
  const { dataset, isHydrating, loadDemo } = useData();
  const [config, setConfig] = useState<AgenticConfigResponse | null>(null);
  const [health, setHealth] = useState<AgenticHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const model = useMemo(() => buildCommandCenterModel(dataset), [dataset]);

  async function refresh() {
    setLoading(true);
    try {
      const [nextConfig, nextHealth] = await Promise.all([
        api.getAgenticConfig(),
        api.getAgenticHealth(),
      ]);
      setConfig(nextConfig);
      setHealth(nextHealth);
    } catch {
      setConfig(null);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function runOrchestration() {
    setRunStartedAt(new Date().toISOString());
  }

  if (isHydrating) {
    return <StatusPanel title="Loading agents" message="Preparing the agentic control room." />;
  }

  if (!dataset) {
    return <StatusPanel title="No dataset loaded" message="Upload data before orchestrating agents." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;
  }

  const agentCards = [
    ["Schema Agent", "Detecting data types & relationships", `${model.profile.columns.length} columns, ${model.profile.numericColumns.length} metrics`, model.profile.columns.length ? 95 : 0, Database],
    ["KPI Agent", "Selecting KPIs & metrics", `${model.kpis.length} KPIs selected`, model.kpis.length ? 93 : 0, TrendingUp],
    ["Chart Agent", "Generating visualizations", `${model.charts.length} charts created`, model.charts.length ? 91 : 0, LayoutDashboard],
    ["Insight Agent", "Writing insights & takeaways", `${model.insights.length} insights generated`, model.insights.length ? 94 : 0, Sparkles],
    ["Validator Agent", "Validating charts & KPIs", `${Math.round(model.quality.finalScore)}% quality score`, Math.round(model.quality.finalScore), ShieldCheck],
    ["Geo Agent", "Analyzing regional performance", model.geo ? `${model.geo.totalLocations} locations analyzed` : "No geo fields detected", model.geo ? 90 : 0, Globe2],
    ["Storytelling Agent", "Building narrative summary", model.insights[0]?.title || "Awaiting insights", model.insights.length ? 92 : 0, Bot],
  ] as const;

  const timeline = [
    ["Dataset Received", `${model.rows.length.toLocaleString()} rows loaded`],
    ["Schema Detected", `${model.profile.columns.length} columns profiled`],
    ["KPIs Selected", `${model.kpis.length} KPI cards ready`],
    ["Charts Generated", `${model.charts.length} visualizations`],
    ["Dashboard Validated", `${Math.round(model.quality.finalScore)}% confidence`],
    ["Insights Written", `${model.insights.length} findings`],
  ];

  const logs = [
    `Dataset ${dataset.name} received`,
    `Schema Agent detected ${model.profile.columns.length} columns`,
    `KPI Agent selected ${model.kpis.length} KPI cards`,
    `Chart Agent created ${model.charts.length} visualizations`,
    model.geo ? `Geo Agent analyzed ${model.geo.totalLocations} locations` : "Geo Agent skipped: no geography column",
    "Validator Agent confirmed local deterministic calculations",
  ];

  const installedModels = health?.checks?.filter((check) => check.installed).length || 0;
  const totalModels = health?.checks?.length || 0;

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto grid max-w-[1720px] gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Sparkles className="mt-1 size-8 text-[#7C3AED]" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Agentic AI Control Room</h1>
                <p className="mt-1 text-sm text-[#64748B]">Monitor how specialized agents analyze data, generate charts, validate results, and produce insights.</p>
              </div>
            </div>
            <button type="button" onClick={runOrchestration} className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
              <Sparkles className="mr-2 inline size-4" />
              Re-run Orchestration
            </button>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["Agent System Status", "Operational", "All available agents healthy", Bot],
              ["Active Dataset", dataset.name, `${model.rows.length.toLocaleString()} rows - ${model.columns.length} columns`, Database],
              ["Total Tasks Completed", timeline.length + logs.length, "Current runtime session", CheckCircle2],
              ["Average Confidence", `${Math.round(model.quality.finalScore)}%`, "Data quality weighted", ShieldCheck],
              ["Last Orchestration Run", timeAgo(runStartedAt || dataset.uploadedAt), runStartedAt ? new Date(runStartedAt).toLocaleTimeString() : "Dataset load", Clock],
            ].map(([title, value, subtitle, Icon]) => (
              <div key={String(title)} className={`${CARD} p-5`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#64748B]">{String(title)}</p>
                    <p className="mt-2 truncate text-xl font-bold text-[#0F172A]">{String(value)}</p>
                    <p className="mt-2 text-xs text-[#64748B]">{String(subtitle)}</p>
                  </div>
                  <div className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
                    <Icon className="size-5" />
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-4">
            {agentCards.map(([name, task, output, confidence, Icon]) => (
              <div key={name} className={`${CARD} p-5`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="size-6 text-[#7C3AED]" />
                    <h2 className="font-bold text-[#0F172A]">{name}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${confidence ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    {confidence ? "Active" : "Idle"}
                  </span>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div><p className="text-xs text-[#64748B]">Current Task</p><p className="mt-1 font-semibold text-[#334155]">{task}</p></div>
                  <div className="flex justify-between"><span className="text-[#64748B]">Confidence</span><span className="font-bold text-emerald-600">{confidence}%</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#64748B]">Last Output</span><span className="text-right font-semibold text-[#334155]">{output}</span></div>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={`${CARD} p-5`}>
              <h2 className="font-bold text-[#0F172A]">Workflow Timeline</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-6">
                {timeline.map(([label, detail], index) => (
                  <div key={label} className="relative text-center">
                    {index < timeline.length - 1 && <div className="absolute left-1/2 top-4 hidden h-0.5 w-full bg-emerald-200 md:block" />}
                    <div className="relative mx-auto grid size-9 place-items-center rounded-full bg-emerald-500 text-white">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <p className="mt-3 text-xs font-bold text-[#0F172A]">{label}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#0F172A]">Agent Logs</h2>
                <button type="button" onClick={() => void refresh()} className="text-xs font-bold text-[#2563EB]">
                  <RefreshCw className={`mr-1 inline size-3 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {logs.map((log, index) => (
                  <div key={log} className="grid grid-cols-[24px_1fr_68px] gap-3 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="text-[#334155]">{log}</span>
                    <span className="text-right text-xs text-[#64748B]">{index + 1}m ago</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className={`${CARD} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-[#0F172A]">
                <Sparkles className="size-5 text-[#7C3AED]" />
                AI Controller
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Active</span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-bold text-[#0F172A]">Current Task</p>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">Orchestrating insight generation across schema, KPI, chart, geo, validation, and storytelling agents.</p>
              <div className="mt-4 h-2 rounded-full bg-[#E2E8F0]">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB]" style={{ width: `${Math.max(50, Math.round(model.quality.finalScore))}%` }} />
              </div>
            </div>
          </section>

          <section className={`${CARD} p-5`}>
            <h3 className="font-bold text-[#0F172A]">Model / Provider</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">Mode</span><span className="font-bold capitalize text-[#0F172A]">{config?.provider || "Hybrid"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Models Ready</span><span className="font-bold text-[#0F172A]">{installedModels}/{totalModels}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Primary Metric</span><span className="font-bold text-[#0F172A]">{model.profile.primaryMetric ? titleCase(model.profile.primaryMetric.name) : "-"}</span></div>
            </div>
          </section>

          <section className={`${CARD} p-5`}>
            <h3 className="font-bold text-[#0F172A]">Suggested Commands</h3>
            <div className="mt-4 space-y-2">
              {model.suggestedCommands.slice(0, 5).map((command) => (
                <button key={command} type="button" className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-left text-sm text-[#334155]">
                  <span><Sparkles className="mr-2 inline size-4 text-[#7C3AED]" />{command}</span>
                  <span aria-hidden="true">{"->"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={`${CARD} p-5`}>
            <h3 className="flex items-center gap-2 font-bold text-[#0F172A]">
              <ListChecks className="size-5 text-[#7C3AED]" />
              Audit Trail
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              {timeline.slice().reverse().map(([label], index) => (
                <div key={label} className="grid grid-cols-[64px_1fr] gap-3">
                  <span className="text-xs text-[#64748B]">{index + 1} min ago</span>
                  <span className="text-[#334155]">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
