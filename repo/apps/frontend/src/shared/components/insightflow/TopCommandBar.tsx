import { Download, Filter, RefreshCw, Share2, Sparkles } from "lucide-react";
import { useData } from "@/features/data/context/useData";

export function TopCommandBar() {
  const { dataset } = useData();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-7 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <button className="min-w-56 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
          <p className="text-sm font-bold text-slate-950">
            {dataset?.name ?? "Upload a dataset"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {dataset?.rows?.length ? `${dataset.rows.length.toLocaleString()} rows` : "No active data"}
          </p>
        </button>

        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-sm">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Ask InsightFlow AI anything about your data..."
          />
          <button className="rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 p-2 text-white shadow-lg shadow-violet-200">
            <Filter className="h-4 w-4" />
          </button>
        </div>

        <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold shadow-sm hover:bg-slate-50">
          <RefreshCw className="mr-2 inline h-4 w-4" />
          Refresh
        </button>

        <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold shadow-sm hover:bg-slate-50">
          <Download className="mr-2 inline h-4 w-4" />
          Export
        </button>

        <button className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200">
          <Share2 className="mr-2 inline h-4 w-4" />
          Share
        </button>
      </div>
    </header>
  );
}
