import {useEffect, useRef, useState} from "react";
import {AlertTriangle, Bot, Database, Send, Shield} from "lucide-react";
import {kavachApi} from "@/kavach/api/kavachApi";
import {useKavachFilters} from "@/kavach/context/FilterContext";
import {Card, CardContent} from "@/shared/components/ui/card";
import {Badge} from "@/shared/components/ui/badge";
import {Button} from "@/shared/components/ui/button";
import {Skeleton} from "@/shared/components/ui/skeleton";

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUsed?: string;
  dataPeriod?: {start?: string | null; end?: string | null};
  recordCount?: number;
  dataSources?: string[];
  confidence?: number;
  limitations?: string[];
  followUpSuggestions?: string[];
  fallbackNotice?: string;
}

const SUGGESTIONS = [
  "Show the current crime overview",
  "Find current hotspots",
  "Show monthly crime trends",
  "Compare districts by aggregated risk",
  "Find people with multiple case links",
  "Show data quality issues",
  "Show case network evidence",
];

function unwrap<T>(payload: unknown): T {
  const candidate = payload as {data?: T};
  return candidate.data ?? (payload as T);
}

function answerFromPayload(payload: Record<string, unknown>): CopilotMessage {
  const data = payload.data as Record<string, unknown> | undefined;
  const overview = data && !Array.isArray(data) ? data : undefined;
  const content = String(payload.answer ?? payload.message ?? payload.responseText ?? (overview?.totalIncidents !== undefined
    ? `Approved tool completed. The scoped result contains ${Number(overview.totalIncidents).toLocaleString()} incident records.`
    : "Approved analytical tool completed."));
  const limitations = Array.isArray(payload.limitations) ? payload.limitations.map(String) : [
    "Synthetic prototype data.",
    "Human review is required for all intelligence outputs.",
  ];
  const routerNotice = String(payload.message ?? "").includes("Local AI model unavailable")
    ? "Local AI model unavailable. The result was generated using the approved analytical tool router."
    : undefined;
  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content,
    toolUsed: String(payload.toolUsed ?? payload.type ?? "approved-tool"),
    dataPeriod: payload.dataPeriod as CopilotMessage["dataPeriod"],
    recordCount: Number(payload.recordCount ?? overview?.totalIncidents ?? 0),
    dataSources: Array.isArray(payload.dataSources) ? payload.dataSources.map(String) : ["KAVACH approved analytical tool"],
    confidence: typeof payload.confidence === "number" ? Math.round(payload.confidence * (payload.confidence <= 1 ? 100 : 1)) : undefined,
    limitations,
    followUpSuggestions: Array.isArray(payload.followUpSuggestions) ? payload.followUpSuggestions.map(String) : undefined,
    fallbackNotice: routerNotice,
  };
}

export default function AICopilotPage() {
  const {filters} = useKavachFilters();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  async function handleSend(query: string) {
    if (!query.trim() || loading) return;
    setMessages((previous) => [...previous, {id: `user-${Date.now()}`, role: "user", content: query.trim()}]);
    setInput("");
    setLoading(true);
    try {
      const response = await kavachApi.copilotQuery(query, filters);
      const payload = unwrap<Record<string, unknown>>(response.data);
      setMessages((previous) => [...previous, answerFromPayload(payload)]);
    } catch {
      setMessages((previous) => [...previous, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "The approved Copilot tool could not complete this request. No synthetic or hard-coded answer has been substituted.",
        limitations: ["Check the local backend connection and your geographic access scope before retrying."],
      }]);
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold text-[#0F172A]">AI Copilot</h1>
      <p className="text-sm text-slate-500">Approved local intelligence tools with optional Ollama explanation.</p>
    </div>
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.</p>
    </div>
    <Card className="border-slate-200">
      <CardContent className="flex flex-col p-0">
        <div className="flex h-[500px] flex-col overflow-y-auto p-4">
          {messages.length === 0 && <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
            <Bot className="size-12" />
            <p className="text-sm">Ask about approved, scoped KAVACH intelligence tools.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.slice(0, 4).map((suggestion) => <button key={suggestion} type="button" onClick={() => void handleSend(suggestion)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-[#1D4ED8] hover:text-[#1D4ED8]">{suggestion}</button>)}
            </div>
          </div>}
          {messages.map((message) => <div key={message.id} className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl p-4 ${message.role === "user" ? "bg-[#1D4ED8] text-white" : "border border-slate-200 bg-white"}`}>
              <div className="mb-2 flex items-center gap-2">{message.role === "assistant" ? <Bot className="size-4 text-[#1D4ED8]" /> : <Shield className="size-4" />}<span className={`text-xs font-semibold ${message.role === "user" ? "text-white/80" : "text-slate-500"}`}>{message.role === "assistant" ? "KAVACH Copilot" : "You"}</span></div>
              <p className={`text-sm leading-6 ${message.role === "user" ? "text-white" : "text-slate-700"}`}>{message.content}</p>
              {message.fallbackNotice && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">{message.fallbackNotice}</p>}
              {message.role === "assistant" && <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {message.toolUsed && <Badge className="bg-[#1D4ED8]">{message.toolUsed}</Badge>}
                {message.recordCount !== undefined && <Badge variant="secondary"><Database className="mr-1 size-3" />{message.recordCount} records</Badge>}
                {message.confidence !== undefined && <Badge variant="secondary">Confidence {message.confidence}%</Badge>}
              </div>}
              {message.dataPeriod && <p className="mt-2 text-xs text-slate-500">Data period: {message.dataPeriod.start ?? "all available"} to {message.dataPeriod.end ?? "current"}</p>}
              {message.dataSources?.length ? <div className="mt-3 rounded-lg bg-blue-50 p-2"><p className="text-xs font-semibold text-[#1D4ED8]">Data sources</p><p className="mt-1 text-xs text-slate-600">{message.dataSources.join(", ")}</p></div> : null}
              {message.limitations?.length ? <div className="mt-3 text-xs text-slate-500"><p className="font-semibold">Limitations</p><ul className="list-inside list-disc">{message.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div> : null}
              {message.followUpSuggestions?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{message.followUpSuggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => void handleSend(suggestion)} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">{suggestion}</button>)}</div> : null}
            </div>
          </div>)}
          {loading && <div className="flex items-start gap-2 text-slate-400"><Bot className="size-4" /><div className="flex gap-1"><Skeleton className="h-3 w-2" /><Skeleton className="h-3 w-2" /><Skeleton className="h-3 w-2" /></div></div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-slate-200 p-4">
          <div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(input); } }} placeholder="Ask KAVACH Copilot a supported question..." aria-label="Ask KAVACH Copilot a supported question" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#1D4ED8]" /><Button onClick={() => void handleSend(input)} disabled={loading || !input.trim()} className="gap-2 bg-[#1D4ED8]"><Send className="size-4" />Send</Button></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{SUGGESTIONS.slice(4).map((suggestion) => <button key={suggestion} type="button" onClick={() => void handleSend(suggestion)} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">{suggestion}</button>)}</div>
        </div>
      </CardContent>
    </Card>
  </div>;
}
