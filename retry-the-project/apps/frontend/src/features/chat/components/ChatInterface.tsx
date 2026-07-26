import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Database,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useData } from "@/features/data/context/useData";
import {
  buildCommandCenterModel,
  interpretCommand,
  titleCase,
  type InterpretedCommand,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import {
  buildDataQualityScore,
  buildDatasetProfile,
  cleanDatasetRows,
  type DashboardChart,
  type DashboardKpi,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import { generateDynamicQuestionSuggestions } from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import {
  loadDashboardState,
  recordDashboardAction,
  saveDashboardState,
} from "@/features/dashboard/utils/dashboardStateStorage";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: DashboardChart;
  kpi?: DashboardKpi;
  table?: Row[];
  action?: InterpretedCommand;
  dashboardAction?: {
    available: boolean;
    type?: "ADD_CHART" | "ADD_KPI" | "APPLY_FILTER" | "CLEAR_FILTER";
    label?: string;
    payload?: {
      chart?: DashboardChart;
      kpi?: DashboardKpi;
      filters?: Array<{ column: string; operator?: string; value: string | number | boolean }>;
    };
  };
  debug?: {
    sql?: string | null;
    queryPlan?: unknown;
    safety?: unknown;
  };
  timestamp: Date;
  loading?: boolean;
  error?: boolean;
};

function makeId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function QuickButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155] shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50"
    >
      <Sparkles className="mr-2 inline size-4 text-[#7C3AED]" />
      {label}
    </button>
  );
}

export default function ChatInterface() {
  const { dataset } = useData();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const stored = dataset?.id ? loadDashboardState(dataset.id) : { filters: {}, manualCharts: [], manualKpis: [] };
  const model = useMemo(
    () => buildCommandCenterModel(dataset, stored.filters, stored.manualCharts, stored.manualKpis),
    [dataset, stored.filters, stored.manualCharts, stored.manualKpis],
  );

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const suggestions = useMemo(() => generateDynamicQuestionSuggestions({ id: dataset?.id, name: dataset?.name, rows, columns: dataset?.columns }, 5), [dataset, rows]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history from the backend on mount or when the dataset changes
  useEffect(() => {
    if (!dataset?.id) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Welcome to AI Data Copilot! Please upload a dataset to start. You can ask general questions here.",
          timestamp: new Date()
        }
      ]);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/datasets/${dataset.id}/chat/history`);
        if (!response.ok) throw new Error("Failed to load history");
        const data = await response.json();
        if (active && data.success && Array.isArray(data.data?.messages)) {
          const mapped = data.data.messages.map((msg: any) => {
            const localResult = msg.role === "assistant" ? interpretCommand(msg.content, model.filteredRows.length ? model.filteredRows : model.rows) : null;
            return {
              id: msg.id || makeId(),
              role: msg.role,
              content: msg.content,
              chart: msg.chart || localResult?.chart || undefined,
              kpi: msg.kpi || localResult?.kpi || undefined,
              table: msg.table || (msg.role === "assistant" && /table|top|anomal/i.test(msg.content) ? model.filteredRows.slice(0, 6) : undefined),
              timestamp: new Date(msg.timestamp)
            };
          });

          // Prepend history messages safely to any newly added messages in the state
          setMessages((prev) => {
            const newMessages = prev.filter((m) => m.id !== "welcome" && !m.loading);
            if (newMessages.length > 0) {
              return [...mapped, ...newMessages];
            }
            return mapped.length > 0 ? mapped : [
              {
                id: "welcome",
                role: "assistant",
                content: `I am ready. Ask questions about the ${dataset.name} dataset, or give commands to create charts or KPIs.`,
                timestamp: new Date()
              }
            ];
          });
        }
      } catch (err) {
        console.warn("Failed to load history:", err);
      }
    };
    void loadHistory();
    return () => { active = false; };
  }, [dataset?.id, model.filteredRows, model.rows]);

  function persistAction(result: InterpretedCommand) {
    if (!dataset?.id) return;
    const current = loadDashboardState(dataset.id);
    const nextState = {
      ...current,
      filters: result.filters ? { ...current.filters, ...result.filters } : current.filters,
      manualCharts: result.chart ? [result.chart, ...current.manualCharts].slice(0, 8) : current.manualCharts,
      manualKpis: result.kpi ? [result.kpi, ...current.manualKpis].slice(0, 8) : current.manualKpis,
      geoActive: result.geoRequested || current.geoActive,
    };
    saveDashboardState(dataset.id, nextState);
    recordDashboardAction(dataset.id, result.auditLabel, "chat", nextState);
  }

  async function persistDashboardAction(action: NonNullable<Message["dashboardAction"]>) {
    if (!dataset?.id || !action.available) return;
    try {
      await fetch("/api/dashboard/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dataset.id,
          action: {
            type: action.type,
            chart: action.payload?.chart,
            kpi: action.payload?.kpi,
            filters: action.payload?.filters,
          },
        }),
      });
    } catch (error) {
      console.warn("Dashboard action endpoint unavailable; saving locally.", error);
    }
    const current = loadDashboardState(dataset.id);
    const filtersFromAction = action.type === "APPLY_FILTER"
      ? Object.fromEntries((action.payload?.filters || []).map((filter) => [filter.column, filter.value]))
      : {};
    const nextState = {
      ...current,
      filters: action.type === "CLEAR_FILTER" ? {} : { ...current.filters, ...filtersFromAction },
      manualCharts: action.payload?.chart ? [action.payload.chart, ...current.manualCharts].slice(0, 8) : current.manualCharts,
      manualKpis: action.payload?.kpi ? [action.payload.kpi, ...current.manualKpis].slice(0, 8) : current.manualKpis,
    };
    saveDashboardState(dataset.id, nextState);
    recordDashboardAction(dataset.id, action.label || action.type || "Chat action", "chat", nextState);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: makeId(),
        role: "assistant",
        content: action.type === "ADD_CHART"
          ? "Chart added to the dashboard."
          : action.type === "ADD_KPI"
            ? "KPI added to the dashboard."
            : action.type === "CLEAR_FILTER"
              ? "Dashboard filters cleared."
              : "Dashboard filter applied.",
        timestamp: new Date(),
      },
    ]);
  }

  async function sendPrompt(prompt = input) {
    const query = prompt.trim();
    if (!query) return;

    // Empty state: no dataset is active
    if (!dataset) {
      const userMsg: Message = {
        id: makeId(),
        role: "user",
        content: query,
        timestamp: new Date(),
      };
      let reply = "No dataset is currently loaded. Please upload a dataset first.";
      if (/help|what is|how to/i.test(query)) {
        reply = "I am InsightFlow AI Copilot. You can upload CSV/Excel/JSON datasets and ask me questions, create charts, or analyze metrics.";
      }
      const assistantMsg: Message = {
        id: makeId(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((current) => [...current, userMsg, assistantMsg]);
      setInput("");
      return;
    }

    const userMsgId = makeId();
    const assistantMsgId = makeId();

    setInput("");
    setLoading(true);

    // Insert user message and temporary thinking indicator
    setMessages((current) => [
      ...current.filter((m) => m.id !== "welcome"),
      {
        id: userMsgId,
        role: "user",
        content: query,
        timestamp: new Date(),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "Thinking...",
        loading: true,
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await fetch(`/api/chat/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dataset.id,
          message: query,
          activeFilters: stored.filters || {},
          mode: "analysis",
        }),
      });

      const data = await response.json();
      const chatData = data.data || data;

      if (!response.ok || !data.success || chatData.success === false) {
        throw new Error(chatData.answer || data.error?.message || "I could not process that chat request.");
      }

      const localResult = !chatData.chart && !chatData.kpi
        ? interpretCommand(query, model.filteredRows.length ? model.filteredRows : model.rows)
        : null;
      if (localResult && (localResult.chart || localResult.kpi || localResult.filters || localResult.geoRequested)) {
        persistAction(localResult);
      }

      setMessages((current) =>
        current.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              id: chatData.messageId || makeId(),
              role: "assistant",
              content: chatData.answer || "I prepared a schema-safe analytics response.",
              chart: chatData.chart || localResult?.chart || undefined,
              kpi: chatData.kpi || localResult?.kpi || undefined,
              table: chatData.result?.rows && /table/i.test(query) ? chatData.result.rows : undefined,
              dashboardAction: chatData.dashboardAction?.available ? chatData.dashboardAction : undefined,
              debug: {
                sql: chatData.sql,
                queryPlan: chatData.queryPlan,
                safety: chatData.safety,
              },
              timestamp: new Date(),
            };
          }
          return msg;
        })
      );
    } catch (err: any) {
      setMessages((current) =>
        current.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              id: makeId(),
              role: "assistant",
              content: err.message || "Failed to communicate with AI.",
              error: true,
              timestamp: new Date(),
            };
          }
          return msg;
        })
      );
    } finally {
      setLoading(false);
    }
  }

  function exportConversation() {
    const blob = JSON.stringify({ dataset: dataset?.name, messages }, null, 2);
    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dataset?.name || "insightflow"}-copilot.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const schemaPreview = model.profile?.columns?.slice(0, 6) || [];
  const activeFilters = Object.entries(stored.filters || {}).filter(([key, value]) => key !== "conditions" && value);

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto grid max-w-[1720px] gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <header className="flex items-start gap-4">
            <div className="mt-1 text-[#7C3AED]">
              <Sparkles className="size-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">AI Data Copilot</h1>
              <p className="mt-1 text-sm text-[#64748B]">Ask questions about your dataset and let InsightFlow create analyses, charts, and insights.</p>
            </div>
          </header>

          <section className="space-y-5 pb-28">
            {!messages.length && dataset && (
              <div className="grid gap-4">
                {model.suggestedCommands.slice(0, 3).map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => sendPrompt(command)}
                    className="ml-auto w-full max-w-xl rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-left text-sm font-semibold text-[#0F172A]"
                  >
                    {command}
                    <span className="float-right text-[#64748B]">Ready</span>
                  </button>
                ))}
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-3xl" : "w-full max-w-5xl"}>
                  <div
                    className={
                      message.role === "user"
                        ? "rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-semibold text-[#0F172A]"
                        : `rounded-2xl border ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#E2E8F0] bg-white text-[#334155]'} px-5 py-4 text-sm shadow-sm`
                    }
                  >
                    {message.loading ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-line leading-6">{message.content}</p>
                    )}
                    <p className="mt-2 text-right text-xs text-[#64748B]">{formatTime(message.timestamp)}</p>
                  </div>

                  {message.kpi && (
                    <div className="mt-3 max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                      <p className="text-sm font-semibold text-[#64748B]">{message.kpi.title}</p>
                      <p className="mt-2 text-3xl font-bold text-[#0F172A]">{message.kpi.value}</p>
                      <p className="mt-2 text-sm text-[#64748B]">{message.kpi.subtitle}</p>
                    </div>
                  )}

                  {message.chart && (
                    <div className="mt-3">
                      <SmartChartCard chart={message.chart} />
                    </div>
                  )}

                  {message.dashboardAction?.available && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void persistDashboardAction(message.dashboardAction!)}
                        className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1E293B]"
                      >
                        {message.dashboardAction.label || "Add to Dashboard"}
                      </button>
                      {message.debug?.sql && (
                        <details className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs text-[#64748B]">
                          <summary className="cursor-pointer font-bold text-[#334155]">Query plan</summary>
                          <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap">{JSON.stringify({ sql: message.debug.sql, plan: message.debug.queryPlan, safety: message.debug.safety }, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  {message.table?.length ? (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                          <tr>
                            {model.columns.slice(0, 6).map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {message.table.map((row) => (
                            <tr key={`${message.id}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155]">
                              {model.columns.slice(0, 6).map((column) => <td key={column} className="max-w-[160px] truncate px-4 py-3">{String(row[column] ?? "") || "-"}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </section>

          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E2E8F0] bg-white/95 p-4 backdrop-blur xl:left-72">
            <div className="mx-auto max-w-[1200px]">
              <div className="flex items-center gap-2 rounded-2xl border border-violet-300 bg-white p-2 shadow-[0_0_0_4px_rgba(124,58,237,0.05)]">
                <input
                  value={input}
                  aria-label="Ask InsightFlow Copilot a question or command"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendPrompt();
                    }
                  }}
                  placeholder={dataset ? "Ask a question or give a command..." : "Ask a general question..."}
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => sendPrompt()}
                  disabled={!input.trim() || loading}
                  className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white disabled:opacity-50"
                  aria-label="Send command"
                >
                  <Send className="size-5" />
                </button>
              </div>
              {dataset && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <QuickButton label="Create Chart" onClick={() => sendPrompt(model.suggestedCommands.find((command) => /chart|compare|top/i.test(command)) || "Create chart")} />
                  <QuickButton label="Explain Trend" onClick={() => sendPrompt("Explain the trend")} />
                  <QuickButton label="Generate Summary" onClick={() => sendPrompt("Generate summary")} />
                  <QuickButton label="Export Report" onClick={exportConversation} />
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-[#0F172A]">
                <Database className="size-5 text-[#7C3AED]" />
                Dataset Context
              </h2>
              {dataset ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Live</span>
              ) : (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">None</span>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">Dataset</span><span className="font-bold text-[#0F172A]">{dataset?.name || "No dataset loaded"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Rows</span><span className="font-bold text-[#0F172A]">{dataset ? model.rows.length.toLocaleString() : "0"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Columns</span><span className="font-bold text-[#0F172A]">{dataset ? model.columns.length : "0"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Data Quality</span><span className="font-bold text-[#0F172A]">{dataset ? `${Math.round(model.quality.finalScore)}%` : "N/A"}</span></div>
            </div>
          </section>

          {dataset && (
            <>
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#0F172A]">Columns Overview</h3>
                <div className="mt-4 space-y-3">
                  {schemaPreview.map((column) => (
                    <div key={column.name} className="flex items-center justify-between text-sm">
                      <span className="truncate text-[#334155]">{column.name}</span>
                      <span className="rounded-full bg-[#F8FAFC] px-2 py-1 text-xs font-semibold text-[#64748B]">{titleCase(column.type)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#0F172A]">Active Filters ({activeFilters.length})</h3>
                  <span className="text-xs font-bold text-[#2563EB]">View all</span>
                </div>
                <div className="mt-3 space-y-2">
                  {activeFilters.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs font-semibold text-[#334155]">
                      <span>{key} is {String(value)}</span>
                      <X className="size-3" />
                    </div>
                  ))}
                  {!activeFilters.length && <p className="text-sm text-[#64748B]">No filters applied.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#0F172A]">Suggested Actions</h3>
                <div className="mt-3 space-y-2">
                  {model.suggestedCommands.slice(0, 5).map((command) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => sendPrompt(command)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-left text-sm text-[#334155]"
                    >
                      <span><Sparkles className="mr-2 inline size-4 text-[#7C3AED]" />{command}</span>
                      <span aria-hidden="true">{"->"}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#0F172A]">Recent Commands</h3>
                <div className="mt-4 space-y-3 text-sm">
                  {(dataset?.id ? loadDashboardState(dataset.id).auditTrail || [] : []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[68px_1fr] gap-3">
                      <span className="text-xs text-[#64748B]">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[#334155]">{entry.label}</span>
                    </div>
                  ))}
                  {!(dataset?.id && loadDashboardState(dataset.id).auditTrail || []).length && (
                    <p className="text-sm text-[#64748B]">
                      <CheckCircle2 className="mr-2 inline size-4 text-emerald-500" />
                      Copilot is ready.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
