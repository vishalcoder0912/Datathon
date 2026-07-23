import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, BrainCircuit, Send, Sparkles, Plus, PanelRightClose } from "lucide-react";
import { motion } from "framer-motion";
import type { AgentMessage, AgentReasoningStep, PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

type AvailableColumn = string | { name?: string; key?: string; accessorKey?: string; label?: string; title?: string };

const getColumnName = (column: AvailableColumn) => {
  if (typeof column === "string") return column;
  return column.name || column.key || column.accessorKey || column.label || column.title || "";
};

interface EnhancedAgentPanelProps {
  messages: AgentMessage[];
  reasoning: AgentReasoningStep[];
  loading: boolean;
  onAsk: (query: string) => void;
  charts: PremiumChart[];
  availableColumns: AvailableColumn[];
  onChartCommand?: (command: { action: string; chartId?: string; targetChart?: string; params?: Record<string, unknown> }) => void;
  onCreateChart?: () => void;
  deepResearch?: boolean;
  onDeepResearchChange?: (value: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function EnhancedAgentPanel({
  messages,
  reasoning,
  loading,
  onAsk,
  availableColumns,
  onCreateChart,
  deepResearch = false,
  onDeepResearchChange,
  isCollapsed = false,
  onToggleCollapse,
}: EnhancedAgentPanelProps) {
  const [tab, setTab] = useState<"chat" | "plan">("chat");
  const [query, setQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const columnNames = useMemo(() => availableColumns.map(getColumnName).filter(Boolean), [availableColumns]);

  const examples = useMemo(() => {
    const lowerColumns = columnNames.map((column) => column.toLowerCase());
    const metric = lowerColumns.find((column) => /amount|billing|sales|revenue|salary|price|total|profit/.test(column)) || "metric";
    const category = lowerColumns.find((column) => /gender|blood|condition|category|type|segment|department|product/.test(column)) || "category";
    const hasDate = lowerColumns.some((column) => /date|month|year|time|admission/.test(column));
    return [`Show ${metric} by ${category}`, hasDate ? `Show ${metric} trend over time` : "Show distribution", `Find ${metric} outliers`, "Summarize this dashboard"];
  }, [columnNames]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setQuery("");
  };

  if (isCollapsed) {
    return (
      <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[60px] flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white py-4 shadow-sm xl:flex">
        <button onClick={onToggleCollapse} className="grid size-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-sm" title="Expand panel" type="button"><Bot className="h-5 w-5" /></button>
        <button onClick={onCreateChart} className="grid size-9 place-items-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-700" type="button" title="Add chart"><Plus className="h-4 w-4" /></button>
      </aside>
    );
  }

  return (
    <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] min-h-0 self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:flex xl:flex-col">
      <section className="border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Active</div>
            <h3 className="mt-3 text-base font-black tracking-tight text-slate-950">InsightFlow assistant</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Ask questions, create charts, and review dashboard logic.</p>
          </div>
          {onToggleCollapse && <button type="button" onClick={onToggleCollapse} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Collapse panel"><PanelRightClose className="h-4 w-4" /></button>}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-violet-50 text-violet-700"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></div>
          <div><h3 className="text-sm font-bold text-slate-950">Assistant workspace</h3><p className="text-xs text-slate-500">Chat and plan view</p></div>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
          <button className={`rounded-xl py-2 ${tab === "chat" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} onClick={() => setTab("chat")} type="button">Chat</button>
          <button className={`rounded-xl py-2 ${tab === "plan" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} onClick={() => setTab("plan")} type="button">Plan</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === "chat" ? (
            <div className="space-y-3">
              {messages.map((message) => <div key={message.id} className={`rounded-2xl border p-3 text-xs leading-5 ${message.role === "assistant" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-violet-100 bg-violet-50 text-violet-800"}`}>{message.content}</div>)}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-600">
              {reasoning.map((step, index) => <motion.div key={step.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"><span>{step.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${step.status === "completed" ? "bg-emerald-50 text-emerald-700" : step.status === "running" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"}`}>{step.status}</span></motion.div>)}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-950">Suggested actions</h3>{onCreateChart && <button onClick={onCreateChart} className="inline-flex items-center gap-1 rounded-xl border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700" type="button"><Plus className="h-3 w-3" />Chart</button>}</div>
        <div className="space-y-2">{examples.map((example) => <button key={example} type="button" onClick={() => onAsk(example)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800">{example}</button>)}</div>
      </section>

      <form onSubmit={submit} className="border-t border-slate-100 p-3">
        <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask anything about your data..." className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-300 focus:bg-white" />
        <div className="mt-2 flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-medium text-slate-500"><input type="checkbox" checked={deepResearch} onChange={(event) => onDeepResearchChange?.(event.target.checked)} className="rounded border-slate-300 text-violet-600" />Deep Research</label><button type="submit" disabled={loading} className="ml-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-60">{loading ? <><Sparkles className="h-4 w-4 animate-pulse" />Thinking...</> : <><Send className="h-4 w-4" />Send</>}</button></div>
      </form>
    </aside>
  );
}
