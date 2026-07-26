import { FormEvent, useState } from "react";
import { Bot, BrainCircuit, Send, Sparkles } from "lucide-react";
import type { AgentMessage, AgentReasoningStep } from "@/features/dashboard/types/premiumDashboardTypes";

const examples = [
  "What are the top paying jobs?",
  "Which countries have highest salaries?",
  "Show salary trend over time",
  "What skills are most in demand?",
  "Compare education vs salary",
];

export function PremiumAgentPanel({
  messages,
  reasoning,
  loading,
  onAsk,
}: {
  messages: AgentMessage[];
  reasoning: AgentReasoningStep[];
  loading: boolean;
  onAsk: (query: string) => void;
}) {
  const [tab, setTab] = useState<"chat" | "plan">("chat");
  const [query, setQuery] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    onAsk(query);
    setQuery("");
  };

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-4 shadow-[0_0_34px_rgba(6,182,212,.12)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-cyan-200">AI Agent Active</p>
            <p className="text-xs text-slate-500">RAG Enabled</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/20 text-violet-200">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">InsightFlow AI Agent</h3>
            <p className="text-xs text-slate-500">Schema + RAG + deterministic analytics</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1 text-xs">
          <button className={`rounded-lg py-2 ${tab === "chat" ? "bg-violet-500/30 text-white" : "text-slate-400"}`} onClick={() => setTab("chat")} type="button">Chat</button>
          <button className={`rounded-lg py-2 ${tab === "plan" ? "bg-violet-500/30 text-white" : "text-slate-400"}`} onClick={() => setTab("plan")} type="button">Plan</button>
        </div>

        {tab === "chat" ? (
          <div className="max-h-56 space-y-3 overflow-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border p-3 text-xs leading-5 ${
                  message.role === "assistant"
                    ? "border-slate-800 bg-slate-900/70 text-slate-300"
                    : "border-violet-400/20 bg-violet-500/10 text-violet-100"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 text-xs text-slate-300">
            <p>1. Read schema safely</p>
            <p>2. Retrieve RAG memories</p>
            <p>3. Generate dashboard plan</p>
            <p>4. Validate with guardian</p>
            <p>5. Calculate values locally</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Example Questions</h3>
        <div className="space-y-2">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => onAsk(example)} className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-violet-400/40 hover:text-white">
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Agent Reasoning</h3>
        <div className="space-y-3">
          {reasoning.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-300">{step.label}</span>
              <span className={`rounded-full px-2 py-0.5 ${step.status === "completed" ? "bg-emerald-400/10 text-emerald-300" : step.status === "running" ? "bg-violet-400/10 text-violet-300" : "bg-slate-800 text-slate-500"}`}>
                {step.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
        </div>
      </section>

      <form onSubmit={submit} className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-3">
        <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask anything..." className="h-20 w-full resize-none rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50" />
        <button type="submit" disabled={loading} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </aside>
  );
}
