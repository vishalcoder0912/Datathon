import { useMemo, useState } from "react";
import { ArrowDownUp, Download, Search } from "lucide-react";
import type { Dataset } from "@/features/data/model/dataStore";

const PAGE_SIZE = 8;
const text = (value: unknown) => String(value ?? "").trim() || "-";

const escapeCsv = (value: unknown) => {
  const raw = String(value ?? "");
  return raw.includes(",") || raw.includes("\n") || raw.includes('"') ? '"' + raw.replaceAll('"', '""') + '"' : raw;
};

export function PremiumDataPreview({ dataset, onViewFullTable }: { dataset: Dataset; onViewFullTable?: () => void; onDownload?: () => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(dataset.columns[0]?.name || "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const columns = dataset.columns.slice(0, 8);
  const mobileColumns = dataset.columns.slice(0, 5);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const baseRows = search ? dataset.rows.filter((row) => dataset.columns.some((column) => text(row[column.name]).toLowerCase().includes(search))) : dataset.rows;
    if (!sortColumn) return baseRows;
    return [...baseRows].sort((left, right) => {
      const a = left[sortColumn];
      const b = right[sortColumn];
      const leftNumber = Number(String(a ?? "").replace(/[$,%]/g, ""));
      const rightNumber = Number(String(b ?? "").replace(/[$,%]/g, ""));
      const result = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) ? leftNumber - rightNumber : String(a ?? "").localeCompare(String(b ?? ""));
      return sortDirection === "asc" ? result : -result;
    });
  }, [dataset.columns, dataset.rows, query, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (columnName: string) => {
    if (sortColumn === columnName) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(columnName);
      setSortDirection("asc");
    }
  };

  const downloadFiltered = () => {
    const headers = dataset.columns.map((column) => column.name);
    const csvRows = filteredRows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","));
    const blob = new Blob([[headers.map(escapeCsv).join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${dataset.name || "dataset"}-filtered.csv`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="col-span-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950">Dataset Preview</h3>
          <p className="text-xs leading-5 text-slate-500">Showing {filteredRows.length.toLocaleString()} of {dataset.rows.length.toLocaleString()} rows</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button onClick={onViewFullTable} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50" type="button">View table</button>
          <button onClick={downloadFiltered} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700" type="button"><Download className="h-3.5 w-3.5" />CSV</button>
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
        <Search className="h-4 w-4 shrink-0 text-violet-500" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search rows..." className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400" />
      </label>

      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <article key={String(row.__rowId ?? index)} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">Row {(safePage - 1) * PAGE_SIZE + index + 1}</span>
              {sortColumn && <span className="truncate text-[11px] font-bold text-violet-700">Sorted by {sortColumn}</span>}
            </div>
            <dl className="grid gap-2">
              {mobileColumns.map((column) => (
                <div key={column.name} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-xs">
                  <dt className="truncate font-bold text-slate-500">{column.name}</dt>
                  <dd className="min-w-0 break-words text-slate-800">{text(row[column.name])}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
        {rows.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">No rows match the current filter.</div>}
      </div>

      <div className="hidden rounded-2xl border border-slate-200 md:block">
        <div className="max-h-[460px] overflow-auto">
          <table className="min-w-[920px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="w-14 px-3 py-3">#</th>
                {columns.map((column) => (
                  <th key={column.name} className="px-3 py-3 font-semibold">
                    <button type="button" onClick={() => toggleSort(column.name)} className="inline-flex max-w-40 items-center gap-1 truncate text-left hover:text-violet-700">
                      <span className="truncate">{column.name}</span><ArrowDownUp className="h-3 w-3 shrink-0" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, index) => (
                <tr key={String(row.__rowId ?? index)} className="text-slate-700 hover:bg-violet-50/40">
                  <td className="px-3 py-3 font-semibold text-slate-400">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                  {columns.map((column) => <td key={column.name} className="max-w-48 truncate px-3 py-3" title={text(row[column.name])}>{text(row[column.name])}</td>)}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={columns.length + 1}>No rows match the current filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Page {safePage.toLocaleString()} of {pageCount.toLocaleString()}</span>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-600 disabled:opacity-40" disabled={safePage === 1}>Prev</button>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-600 disabled:opacity-40" disabled={safePage === pageCount}>Next</button>
        </div>
      </div>
    </section>
  );
}
