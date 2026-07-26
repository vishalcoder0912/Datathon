import { FormEvent, useState } from "react";
import { Download, RefreshCw, Send, Share2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/features/data/context/useData";

function getDatasetName(dataset: any) {
  return dataset?.name || dataset?.fileName || dataset?.title || "No dataset loaded";
}

function getRowCount(dataset: any) {
  return dataset?.rowCount || dataset?.rows?.length || 0;
}

function downloadCsv(dataset: any) {
  if (!dataset?.rows?.length) return;

  const columns = dataset.columns?.map((column: any) => column.name || column.key || column) || Object.keys(dataset.rows[0] || {});
  const csv = [
    columns.join(","),
    ...dataset.rows.map((row: Record<string, unknown>) =>
      columns
        .map((column: string) => {
          const value = row[column] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${getDatasetName(dataset).replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CommandTopBar() {
  const navigate = useNavigate();
  const { dataset, retryHydrate } = useData();
  const [command, setCommand] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const text = command.trim();
    if (!text) return;

    window.dispatchEvent(
      new CustomEvent("insightflow:global-command", {
        detail: { command: text },
      }),
    );

    const lower = text.toLowerCase();

    if (lower.includes("pdf")) navigate("/pdf");
    else if (lower.includes("upload")) navigate("/upload");
    else if (lower.includes("chat") || lower.includes("ask")) navigate("/chat");
    else if (lower.includes("analytics") || lower.includes("anomaly") || lower.includes("correlation")) navigate("/analytics");
    else if (lower.includes("agent")) navigate("/agentic");
    else navigate("/dashboard");

    setCommand("");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-5">
        {dataset ? (
        <button
          type="button"
          onClick={() => navigate("/data")}
          className="flex h-12 min-w-[260px] items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-4 text-left shadow-sm"
        >
          <div>
            <p className="text-sm font-bold text-[#0F172A]">{getDatasetName(dataset)}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>{getRowCount(dataset).toLocaleString()} rows</span>
            </div>
          </div>
          <span className="text-slate-400">⌄</span>
        </button>
        ) : null}

        <form onSubmit={handleSubmit} className="min-w-0 flex-1">
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 shadow-sm shadow-violet-100">
            <Sparkles className="size-5 text-violet-600" />
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Ask InsightFlow AI anything about your data..."
            />
            <button
              type="submit"
              aria-label="Send AI command"
              className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-md"
            >
              <Send className="size-4" />
            </button>
          </div>
        </form>

        {dataset ? (
          <>
        <button
          type="button"
          onClick={() => void retryHydrate?.()}
          className="flex h-12 items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-bold text-[#0F172A] shadow-sm"
        >
          <RefreshCw className="size-4" />
          Refresh
        </button>

        <button
          type="button"
          onClick={() => downloadCsv(dataset)}
          className="flex h-12 items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-bold text-[#0F172A] shadow-sm"
        >
          <Download className="size-4" />
          Export
        </button>

        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(window.location.href)}
          className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 text-sm font-bold text-white shadow-lg shadow-violet-200"
        >
          <Share2 className="size-4" />
          Share
        </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
