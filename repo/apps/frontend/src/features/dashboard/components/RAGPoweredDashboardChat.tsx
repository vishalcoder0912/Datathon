import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Loader2,
  Send,
  User,
  BarChart3,
  PieChart,
  LineChart,
  TrendingUp,
  Sparkles,
  X,
  RotateCcw,
  Zap,
} from "lucide-react";
import { dashboardAiApi, type ChartQueryResponse } from "@/features/data/api/dataApi";

type DatasetLike = {
  id?: string;
  name?: string;
  rows?: Array<Record<string, unknown>>;
  columns?: Array<Record<string, unknown> | string>;
};

type Props = {
  dataset: DatasetLike;
  charts: ChartConfig[];
  onChartCreated: (chart: ChartConfig) => void;
  onChartRemoved: (chartId: string) => void;
  onResetCharts: () => void;
};

const suggestions = [
  "Show me the distribution",
  "Create a pie chart",
  "Compare categories",
  "Show trends over time",
  "Show average values",
  "Create a bar chart",
];

function getChartIcon(type: string) {
  switch (type) {
    case "pie": return <PieChart className="size-4" />;
    case "line": return <LineChart className="size-4" />;
    case "bar":
    case "horizontal_bar": return <BarChart3 className="size-4" />;
    default: return <TrendingUp className="size-4" />;
  }
}

export default function RAGPoweredDashboardChat({
  dataset,
  charts,
  onChartCreated,
  onChartRemoved,
  onResetCharts,
}: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    chart?: ChartConfig;
    confidence?: number;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setInput("");
    const userMsg = { id: `user-${Date.now()}`, role: "user" as const, content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await dashboardAiApi.chartQuery({
        query: trimmed,
        datasetId: dataset.id,
        existingCharts: charts,
      });

      const chart = response.chart;
      setMessages((prev) => [...prev, {
        id: `assist-${Date.now()}`,
        role: "assistant",
        content: response.message,
        chart,
        confidence: response.confidence,
      }]);

      if (chart) {
        onChartCreated(chart);
      }
    } catch (error) {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "Failed to process request",
      }]);
    } finally {
      setLoading(false);
    }
  }, [dataset.id, charts, loading, onChartCreated]);

  const handleRemoveChart = useCallback(async (chartId: string) => {
    try {
      await dashboardAiApi.removeChart(chartId);
      onChartRemoved(chartId);
    } catch {
      onChartRemoved(chartId);
    }
  }, [onChartRemoved]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600/20">
            <Zap className="size-4 text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200">RAG Chart Assistant</span>
          <span className="rounded-full bg-violet-600/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
            1B Optimized
          </span>
        </div>
        {charts.length > 0 && (
          <button
            onClick={onResetCharts}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-violet-600/10">
              <Sparkles className="size-6 text-violet-400" />
            </div>
            <p className="mb-1 text-sm font-medium text-slate-300">Ask me to create charts</p>
            <p className="mb-4 text-xs text-slate-500">
              I'll search the schema and generate the right visualization
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-violet-600 hover:text-violet-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-600/20">
                  <Bot className="size-4 text-violet-300" />
                </div>
              )}

              <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                {msg.role === "user" ? (
                  <div className="rounded-2xl bg-violet-600/10 px-4 py-2.5 text-sm text-slate-200">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {msg.content && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-300">
                        {msg.content}
                      </div>
                    )}

                    {msg.chart && (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getChartIcon(msg.chart.chartType || msg.chart.type || "bar")}
                            <span className="text-sm font-medium text-slate-200">
                              {msg.chart.title || "Chart"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.confidence !== undefined && (
                              <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                RAG {Math.round(msg.confidence * 100)}%
                              </span>
                            )}
                            <button
                              onClick={() => handleRemoveChart(msg.chart!.id)}
                              className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-300"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>Type: <span className="text-slate-300">{msg.chart.chartType || msg.chart.type}</span></div>
                          {msg.chart.xKey && <div>X: <span className="text-slate-300">{msg.chart.xKey}</span></div>}
                          {msg.chart.yKey && <div>Y: <span className="text-slate-300">{msg.chart.yKey}</span></div>}
                          {msg.chart.aggregation && <div>Agg: <span className="text-slate-300">{msg.chart.aggregation}</span></div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-800">
                  <User className="size-4 text-slate-400" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-violet-600/20">
              <Bot className="size-4 text-violet-300" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
              <Loader2 className="size-4 animate-spin text-violet-400" />
              <span className="text-sm text-slate-400">Searching schema...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-800 p-3">
        {messages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSubmit(s)}
                className="rounded-full border border-slate-700/50 px-2.5 py-1 text-[11px] text-slate-500 transition-colors hover:border-violet-600/50 hover:text-violet-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to create a chart..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-violet-600"
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || loading}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
