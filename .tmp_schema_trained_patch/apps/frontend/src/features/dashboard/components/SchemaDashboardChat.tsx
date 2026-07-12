import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { api } from "@/features/data/api/dataApi";

type Props = {
  dataset: { id?: string; rows?: unknown[]; columns?: unknown[] };
  currentDashboard?: unknown;
  onCommand: (command: any) => void;
};

export default function SchemaDashboardChat({ dataset, currentDashboard, onCommand }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Upload data and ask me: create KPI, show chart, filter country = USA, convert chart, or build dashboard." },
  ]);

  async function submit() {
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setMessages((current) => [...current, { role: "user", content: query }]);
    setLoading(true);

    try {
      const datasetId = dataset.id || "local-dataset";
      const fallbackPayload = dataset.id ? undefined : { rows: dataset.rows || [], columns: dataset.columns || [] };
      const command = await api.sendDashboardCommand(datasetId, query, currentDashboard, fallbackPayload as any);
      onCommand(command);
      setMessages((current) => [...current, { role: "assistant", content: [command.message, command.model ? `Model: ${command.model}` : "", command.schemaOnly ? "Schema-only mode enabled." : ""].filter(Boolean).join("\n") }]);
    } catch (err: any) {
      setMessages((current) => [...current, { role: "assistant", content: err?.message || "Command failed" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="font-semibold">AI Dashboard Chatbot</h3>
        <p className="text-xs text-muted-foreground">Uses trained schema memory. Raw rows are not sent to the LLM.</p>
      </div>

      <div className="max-h-72 space-y-3 overflow-auto rounded-xl bg-muted/30 p-3">
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "text-right" : "text-left"}>
            <div className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="Ask: show salary vs experience as scatter"
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button onClick={submit} disabled={loading} className="rounded-xl bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
