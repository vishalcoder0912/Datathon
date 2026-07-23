import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  BrainCircuit,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wrench,
  User,
  Circle,
  Lightbulb,
  Target,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { generateDynamicQuestionSuggestions } from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import type { useDashboardAiController } from "@/features/dashboard/hooks/useDashboardAiController";
import { api } from "@/features/data/api/dataApi";

type DatasetLike = {
  id?: string;
  name?: string;
  rows?: Array<Record<string, unknown>>;
  columns?: Array<Record<string, unknown> | string>;
};

type Props = {
  dataset: DatasetLike;
  controller?: ReturnType<typeof useDashboardAiController>;
  currentDashboard?: unknown;
  onCommand: (command: Record<string, unknown>) => void;
  onSend?: (query: string) => void;
  collapsible?: boolean;
};

const modes = [
  { id: "Build", icon: Wand2, prompt: "Build dashboard automatically" },
  { id: "Fix", icon: Wrench, prompt: "fix dashboard and generate 7 useful charts" },
  { id: "Explain", icon: MessageSquareText, prompt: "Explain this dashboard" },
  { id: "Train", icon: BrainCircuit, prompt: "Train memory from this dashboard pattern" },
] as const;

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-end gap-2"
    >
      <div className="flex size-8 items-center justify-center rounded-xl bg-violet-600/20 shrink-0">
        <Bot className="size-4 text-violet-300" />
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 0.15, 0.3].map((delay) => (
            <motion.span
              key={delay}
              className="size-1.5 rounded-full bg-slate-400"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay, ease: "easeInOut" }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function formatMessageContent(content: string) {
  const parts = content.split(/(`{3,}[\s\S]*?`{3,}|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.slice(3, -3).replace(/^\w+\n/, "");
      return (
        <pre key={i} className="my-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
          <code>{code}</code>
        </pre>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-violet-300">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

type Section = { title: string; icon: React.ReactNode; content: string };

const sectionMatchers: Array<{ pattern: RegExp; icon: React.ReactNode }> = [
  { pattern: /^(Summary|Overview)/im, icon: <Lightbulb className="size-3.5 text-amber-400" /> },
  { pattern: /^(Key Findings?|Findings)/im, icon: <Target className="size-3.5 text-violet-400" /> },
  { pattern: /^(Business Impact|Impact)/im, icon: <TrendingUp className="size-3.5 text-emerald-400" /> },
  { pattern: /^(Recommendation|Next Step)/im, icon: <Sparkles className="size-3.5 text-blue-400" /> },
  { pattern: /^(Confidence Score|Score)/im, icon: <AlertTriangle className="size-3.5 text-amber-400" /> },
  { pattern: /^(What This Can Help Answer)/im, icon: <Target className="size-3.5 text-cyan-400" /> },
  { pattern: /^(Recommended Starting Point)/im, icon: <Sparkles className="size-3.5 text-pink-400" /> },
];

function parseSections(text: string): Section[] | null {
  const sectionRegex = /^(#{0,3}\s*)?(Summary|Overview|Key Findings?|Findings|Business Impact|Impact|Recommendation|Recommended Starting Point|Next Step|Confidence Score|Score|What This Can Help Answer)[:\s]*\n*/gim;
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    sectionRegex.lastIndex = 0;
    const match = sectionRegex.exec(line);
    if (match) {
      if (currentTitle) {
        sections.push({ title: currentTitle, icon: <Lightbulb className="size-3.5" />, content: currentContent.join("\n").trim() });
      }
      currentTitle = match[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, icon: <Lightbulb className="size-3.5" />, content: currentContent.join("\n").trim() });
  }

  if (sections.length < 2) return null;

  return sections.map((s) => {
    const matcher = sectionMatchers.find((m) => m.pattern.test(s.title));
    return { ...s, icon: matcher?.icon || <Lightbulb className="size-3.5 text-slate-400" /> };
  });
}

function StructuredMessage({ content }: { content: string }) {
  const sections = parseSections(content);

  if (!sections) {
    return <div className="whitespace-pre-wrap break-words">{formatMessageContent(content)}</div>;
  }

  return (
    <div className="space-y-2.5">
      {sections.map((section, i) => (
        <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            {section.icon}
            {section.title}
          </div>
          {section.content.startsWith("- ") || section.content.startsWith("1. ") ? (
            <ul className="space-y-1">
              {section.content.split("\n").filter(Boolean).map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-violet-500" />
                  <span>{formatMessageContent(item.replace(/^[\d.]*\s*[-.]?\s*/, ""))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm leading-relaxed text-slate-300">
              {formatMessageContent(section.content)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

let messageIdCounter = 0;

export default function SchemaDashboardChat({
  dataset,
  controller,
  currentDashboard,
  onCommand,
  onSend,
}: Props) {
  const [input, setInput] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [provider, setProvider] = useState("schema-safe");
  const [activeMode, setActiveMode] =
    useState<(typeof modes)[number]["id"]>("Build");
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Dashboard AI Guardian is ready. I use schema-only AI specs and calculate values locally.",
    },
  ]);
  const loading = controller?.loading || localLoading;
  const visibleMessages = controller?.messages || messages;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(visibleMessages.length);

  useEffect(() => {
    if (visibleMessages.length > prevMessageCount.current) {
      const raf = requestAnimationFrame(() => {
        if (typeof messagesEndRef.current?.scrollIntoView === "function") {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      });
      prevMessageCount.current = visibleMessages.length;
      return () => cancelAnimationFrame(raf);
    }
    prevMessageCount.current = visibleMessages.length;
  }, [visibleMessages.length]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const suggestions = useMemo(() => {
    const dynamic = generateDynamicQuestionSuggestions(dataset as Record<string, unknown>, 8);

    const fixed = [
      "Build dashboard automatically",
      "fix dashboard and generate 7 useful charts",
      "Show average salary_usd by country",
      "Create pie chart of education",
      "Show salary_usd distribution",
      "Add KPI for highest salary_usd",
      "Show salary_usd vs experience as scatter",
      "Filter country = USA",
    ];

    const averageAlreadySuggested = dynamic.some((prompt) => /show average/i.test(prompt));
    const merged = [
      ...(dynamic || []),
      ...fixed.filter((prompt) => !(averageAlreadySuggested && /show average/i.test(prompt))),
    ];

    return [...new Set(merged)].slice(0, 10);
  }, [dataset]);

  const dashboardChartCount = useMemo(() => {
    const dashboard = currentDashboard as { charts?: unknown[] } | undefined;
    return Array.isArray(dashboard?.charts) ? dashboard.charts.length : 0;
  }, [currentDashboard]);

  const submit = useCallback(async (explicitQuery?: string) => {
    const query = (explicitQuery || input).trim();
    if (!query || loading) return;

    setInput("");
    setLocalLoading(true);

    const userMsgId = `user-${++messageIdCounter}`;
    if (!controller) {
      setMessages((current) => [...current, { id: userMsgId, role: "user", content: query }]);
    }

    let resultMessage = "";
    try {
      if (controller) {
        if (/explain|why|summary|describe/i.test(query)) {
          await controller.askChat(query);
        } else {
          await controller.runCommand(query);
        }
      } else {
        onSend?.(query);
        const safeDatasetId = dataset?.id || dataset?.name || "local-dataset";
        const safeDatasetPayload = {
          id: safeDatasetId,
          name: dataset?.name || "Uploaded Dataset",
          rows: Array.isArray(dataset?.rows) ? dataset.rows : [],
          columns: Array.isArray(dataset?.columns) ? dataset.columns : [],
        };

        if (!safeDatasetPayload.rows.length && !safeDatasetPayload.columns.length) {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content:
                "I can see no active dataset context. Please upload or select a dataset first.",
            },
          ]);
          setLocalLoading(false);
          return;
        }

        const command = await api.sendDashboardCommand(
          safeDatasetId,
          query,
          currentDashboard,
          {
            rows: safeDatasetPayload.rows,
            columns: safeDatasetPayload.columns,
            pageContext: "premium-agentic-dashboard",
            dashboardChartCount,
          },
        );
        setProvider(command.provider || "schema-safe");
        onCommand(command);
        resultMessage = command.message || "";
      }

      if (!controller) {
        const assistantMsgId = `assistant-${++messageIdCounter}`;
        setMessages((current) => [
          ...current,
          {
            id: assistantMsgId,
            role: "assistant",
            content:
              resultMessage ||
              (!controller && /explain|why|summary|describe/i.test(query)
                ? "Explanation request sent to schema chat."
                : "Dashboard command sent. Values will be calculated locally."),
          },
        ]);
      }
    } catch (error) {
      if (!controller) {
        const errorMsgId = `error-${++messageIdCounter}`;
        setMessages((current) => [
          ...current,
          {
            id: errorMsgId,
            role: "assistant",
            content: error instanceof Error ? error.message : "Command failed.",
          },
        ]);
      }
    } finally {
      setLocalLoading(false);
    }
  }, [input, loading, controller, dataset, currentDashboard, onSend, onCommand]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <aside className="sticky top-5 flex h-[min(760px,calc(100vh-8rem))] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="shrink-0 border-b border-slate-700/80 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-violet-600/10 text-violet-200 shadow-[0_0_12px_rgba(124,58,237,0.15)]">
            <Bot className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-50">Schema AI Studio</h3>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-300">{dataset?.name || "Current dataset"}</p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
            Schema-only
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setActiveMode(mode.id);
                  void submit(mode.prompt);
                }}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-all ${
                  isActive
                    ? "border-violet-500/60 bg-violet-500/15 text-violet-100 shadow-[0_0_12px_rgba(124,58,237,0.1)]"
                    : "border-slate-600/70 bg-slate-900/70 text-slate-300 hover:border-violet-500/50 hover:text-violet-200"
                }`}
              >
                <Icon className={`size-4 ${isActive ? "text-violet-300" : ""}`} />
                {mode.id}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-700/80 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Sparkles className="size-3.5 text-violet-300" />
          Trained prompts
        </div>

        <div className="grid max-h-36 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {suggestions.slice(0, 6).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submit(prompt)}
              disabled={loading}
              className="group min-h-9 rounded-xl border border-slate-600/70 bg-slate-900/70 px-3 py-2 text-left text-xs font-medium leading-snug text-slate-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-100 disabled:opacity-50"
            >
              <span className="mr-1.5 text-slate-400 transition-colors group-hover:text-violet-300">&rarr;</span>
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {controller?.dashboardHealth && (
        <div className="shrink-0 border-b border-slate-700/80 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Guardian health</span>
            <span
              className={
                controller.dashboardHealth.status === "failed"
                  ? "text-red-300"
                  : controller.dashboardHealth.status === "warning"
                    ? "text-amber-300"
                    : "text-emerald-300"
              }
            >
              {controller.dashboardHealth.status} {controller.dashboardHealth.score}/100
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.max(12, Math.min(100, controller.dashboardHealth.score || 0))}%` }}
            />
          </div>
        </div>
      )}

      <div ref={containerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-950/35 p-4">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message) => (
            <motion.div
              key={(message as { id?: string }).id || message.role + ((message as { content?: string }).content || "").slice(0, 20)}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`flex items-end gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-xl ${
                  message.role === "user"
                    ? "bg-slate-800"
                    : "bg-violet-600/20"
                }`}
              >
                {message.role === "user" ? (
                  <User className="size-3.5 text-slate-400" />
                ) : (
                  <Bot className="size-3.5 text-violet-300" />
                )}
              </div>

              <div
                className={`max-w-[min(85%,42rem)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.2)]"
                    : "border border-slate-700/80 bg-slate-900 text-slate-100"
                }`}
              >
                {message.role === "user" ? (
                  <div className="whitespace-pre-wrap break-words">{formatMessageContent(message.content)}</div>
                ) : (
                  <StructuredMessage content={message.content} />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-slate-700/80 bg-slate-950/95 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              aria-label="Dashboard command"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask: build the strict salary dashboard"
              rows={1}
              className="block min-h-11 w-full resize-none overflow-hidden rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-50 outline-none transition-all placeholder:text-slate-400 focus:border-violet-400 focus:shadow-[0_0_12px_rgba(124,58,237,0.12)]"
              disabled={loading}
            />
            <kbd className="hidden">
              ↵
            </kbd>
          </div>

          <button
            type="submit"
            aria-label="Send dashboard command"
            disabled={loading || !input.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-[0_2px_8px_rgba(124,58,237,0.25)] transition-all hover:from-violet-500 hover:to-violet-600 hover:shadow-[0_4px_12px_rgba(124,58,237,0.35)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="truncate rounded-lg border border-emerald-500/20 bg-emerald-950/60 px-2 py-0.5 font-mono font-medium text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.05)]">
              Provider: {provider}
            </span>
          </div>
          <span className="rounded-lg border border-violet-500/20 bg-violet-950/60 px-2 py-0.5 font-mono font-medium text-violet-300 shadow-[0_0_8px_rgba(139,92,246,0.05)]">
            {dashboardChartCount ? `${dashboardChartCount} charts` : `Mode: ${activeMode}`}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
          <ShieldCheck className="size-3.5" />
          Schema-only AI enabled &middot; raw rows never sent to LLM
        </div>
      </div>
    </aside>
  );
}
