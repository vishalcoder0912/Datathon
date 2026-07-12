import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Filter,
  Search,
  Table2,
} from "lucide-react";
import { useData } from "@/features/data/context/useData";
import {
  buildCommandCenterModel,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import {
  applyFilters,
  buildDatasetProfile,
  cleanDatasetRows,
  exportRowsToCsv,
  safeNumber,
  type DashboardFilters,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";
const PAGE_SIZES = [10, 25, 50, 100];
const OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less or equal" },
];

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DataTablePage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate, updateDatasetCell } = useData();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<{ row: number; column: string } | null>(null);
  const [draft, setDraft] = useState("");

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const model = useMemo(() => buildCommandCenterModel(dataset), [dataset]);
  const columns = profile.columns.map((column) => column.name);
  const primaryCategory = profile.primaryCategory?.name;

  const filteredRows = useMemo(() => {
    let next = applyFilters(rows, filters);
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      next = next.filter((row) => columns.some((column) => String(row[column] ?? "").toLowerCase().includes(query)));
    }
    if (sortColumn) {
      next = Array.from(next).sort((left, right) => {
        const leftNumber = safeNumber(left[sortColumn]);
        const rightNumber = safeNumber(right[sortColumn]);
        const comparison = leftNumber !== null && rightNumber !== null
          ? leftNumber - rightNumber
          : String(left[sortColumn] ?? "").localeCompare(String(right[sortColumn] ?? ""));
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }
    return next;
  }, [columns, filters, rows, search, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice(page * pageSize, page * pageSize + pageSize);
  const categoryValues = useMemo(() => {
    if (!primaryCategory) return [];
    const values = new Set<string>();
    for (const row of rows) {
      const value = String(row[primaryCategory] ?? "");
      if (value) values.add(value);
      if (values.size >= 50) break;
    }
    return Array.from(values);
  }, [primaryCategory, rows]);

  if (isHydrating) return <StatusPanel title="Loading table" message="Preparing dataset rows." />;
  if (apiError) return <StatusPanel title="Table unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  if (!dataset) return <StatusPanel title="No dataset loaded" message="Upload a file before opening the data table." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;

  function setSort(column: string) {
    if (sortColumn === column) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(0);
  }

  function exportVisible() {
    downloadFile(`${dataset.name || "dataset"}-table.csv`, exportRowsToCsv(filteredRows), "text/csv;charset=utf-8");
  }

  async function commitEdit(rowIndex: number, column: string) {
    const originalRow = pageRows[rowIndex];
    const rowId = Number(originalRow.__rowId ?? rows.indexOf(originalRow));
    setEditing(null);
    if (!Number.isFinite(rowId)) return;
    await updateDatasetCell(rowId, column, draft);
  }

  const typeCounts = [
    ["Numeric", profile.columns.filter((column) => column.type === "number").length],
    ["Categorical", profile.categoryColumns.length],
    ["Date", profile.columns.filter((column) => column.type === "date").length],
    ["Quality", `${Math.round(model.quality.finalScore)}%`],
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Table2 className="mt-1 size-8 text-[#7C3AED]" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Data Table</h1>
              <p className="mt-1 text-sm text-[#64748B]">Explore, sort, filter, edit, and export your active dataset.</p>
            </div>
          </div>
          <button type="button" onClick={exportVisible} className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-bold text-[#334155] shadow-sm">
            <Download className="mr-2 inline size-4" />
            Export
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Rows", rows.length.toLocaleString(), "Loaded records"],
            ["Visible Rows", filteredRows.length.toLocaleString(), "After search/filter"],
            ["Columns", columns.length.toLocaleString(), "Detected schema"],
            ["Data Quality", `${Math.round(model.quality.finalScore)}%`, `${model.quality.completeness}% complete`],
          ].map(([title, value, subtitle]) => (
            <div key={title} className={`${CARD} p-5`}>
              <p className="text-sm font-semibold text-[#64748B]">{title}</p>
              <p className="mt-2 text-2xl font-bold text-[#0F172A]">{value}</p>
              <p className="mt-2 text-xs text-[#64748B]">{subtitle}</p>
            </div>
          ))}
        </section>

        <section className={`${CARD} overflow-hidden`}>
          <div className="space-y-4 border-b border-[#E2E8F0] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={search}
                  aria-label="Search table rows"
                  onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                  placeholder="Search all columns..."
                  className="w-full rounded-2xl border border-[#E2E8F0] bg-white py-3 pl-11 pr-4 text-sm text-[#0F172A] outline-none focus:border-[#7C3AED]"
                />
              </div>
              {primaryCategory && (
                <select
                  value={String(filters[primaryCategory] || "")}
                  aria-label={`Filter by ${primaryCategory}`}
                  onChange={(event) => { setFilters((current) => ({ ...current, [primaryCategory]: event.target.value || undefined })); setPage(0); }}
                  className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] outline-none"
                >
                  <option value="">All {primaryCategory}</option>
                  {categoryValues.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              )}
              <button type="button" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155]">
                <Filter className="mr-2 inline size-4" />
                Filters
              </button>
              <button type="button" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155]">
                <Columns3 className="mr-2 inline size-4" />
                Columns
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {typeCounts.map(([label, value]) => (
                <span key={String(label)} className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-bold text-[#64748B]">{label}: {String(value)}</span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 bg-[#F8FAFC] text-xs text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  {columns.slice(0, 12).map((column) => (
                    <th key={column} className="px-4 py-3">
                      <button type="button" onClick={() => setSort(column)} className="inline-flex items-center gap-1 font-bold">
                        {column}
                        {sortColumn === column ? (sortDirection === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3" />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rowIndex) => (
                  <tr key={`${dataset.id}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 text-[#94A3B8]">{page * pageSize + rowIndex + 1}</td>
                    {columns.slice(0, 12).map((column) => {
                      const isEditing = editing?.row === rowIndex && editing.column === column;
                      return (
                        <td key={column} className="max-w-[220px] px-4 py-3">
                          {isEditing ? (
                            <input
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onBlur={() => void commitEdit(rowIndex, column)}
                              onKeyDown={(event) => event.key === "Enter" && void commitEdit(rowIndex, column)}
                              aria-label={`Edit ${column}`}
                              className="w-full rounded-lg border border-violet-200 px-2 py-1 outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEditing({ row: rowIndex, column }); setDraft(String(row[column] ?? "")); }}
                              className="max-w-full truncate text-left"
                            >
                              {String(row[column] ?? "") || "-"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] px-5 py-4 text-sm text-[#64748B]">
            <span>Page {page + 1} of {pageCount}</span>
            <div className="flex items-center gap-2">
              <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
              </select>
              <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#334155]">Previous</button>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#334155]">Next</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
