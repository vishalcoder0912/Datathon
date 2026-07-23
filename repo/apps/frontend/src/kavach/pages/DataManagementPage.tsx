import {useEffect, useMemo, useState} from "react";
import {Database, RefreshCw, Upload, CheckCircle, AlertTriangle, FileSpreadsheet, ShieldCheck} from "lucide-react";
import {kavachApi} from "@/kavach/api/kavachApi";
import {useDataQualitySummary} from "@/kavach/hooks/useKavachQueries";
import type {DataQualityIssue} from "@/kavach/api/types";
import {Card, CardContent, CardHeader, CardTitle} from "@/shared/components/ui/card";
import {Button} from "@/shared/components/ui/button";
import {Badge} from "@/shared/components/ui/badge";
import {Skeleton} from "@/shared/components/ui/skeleton";

interface DatasetInfo {
  name: string;
  records: number;
  size: string;
  lastUpdated: string;
  schema: {column: string; type: string; quality: number}[];
  qualityScore: number;
}

interface ImportPreview {
  importId: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  status: string;
}

const importTypes = [
  "CaseMaster",
  "ComplainantDetails",
  "Victim",
  "Accused",
  "ArrestSurrender",
  "ActSectionAssociation",
  "ChargesheetDetails",
  "District",
  "Unit",
  "Employee",
  "SocioeconomicIndicators",
];

function unwrap<T>(payload: unknown): T {
  const candidate = payload as {data?: T};
  return candidate.data ?? (payload as T);
}

function qualityClass(score: number) {
  if (score >= 80) return "bg-[#15803D]";
  if (score >= 60) return "bg-[#D97706]";
  return "bg-[#DC2626]";
}

export default function DataManagementPage() {
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState("CaseMaster");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [issueStatus, setIssueStatus] = useState("OPEN");
  const [issueSeverity, setIssueSeverity] = useState("");
  const {data: dataQuality, error: dataQualityError, isLoading: loadingQuality, refetch: refetchQuality} = useDataQualitySummary();

  const fetchDatasetInfo = async () => {
    setLoadingDataset(true);
    try {
      const response = await kavachApi.getOverview();
      const overview = unwrap<Record<string, unknown>>(response.data);
      const qualityScore = Number(overview.dataQualityScore ?? dataQuality?.overallQualityScore ?? 0);
      setDatasetInfo({
        name: "KAVACH Crime Database",
        records: Number(overview.totalIncidents ?? 0),
        size: "Persistent PostgreSQL dataset",
        lastUpdated: new Date().toISOString().slice(0, 10),
        schema: [
          {column: "crime_no", type: "varchar", quality: 100},
          {column: "crime_registered_at", type: "timestamptz", quality: 100},
          {column: "police_station_id", type: "integer", quality: 100},
          {column: "incident_location", type: "geometry(Point,4326)", quality: 0},
          {column: "case_status_id", type: "integer", quality: 100},
        ],
        qualityScore,
      });
      setError(null);
    } catch {
      setDatasetInfo(null);
      setError("Unable to load the persistent dataset summary.");
    } finally {
      setLoadingDataset(false);
    }
  };

  const fetchIssues = async () => {
    try {
      const response = await kavachApi.getDataQualityIssues({page: 1, pageSize: 25, status: issueStatus, severity: issueSeverity || undefined});
      const payload = unwrap<{data?: DataQualityIssue[]} | DataQualityIssue[]>(response.data);
      setIssues(Array.isArray(payload) ? payload : payload.data ?? []);
    } catch {
      setIssues([]);
    }
  };

  useEffect(() => {
    void fetchDatasetInfo();
  // Dataset metadata only needs refresh after a user action.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataQuality?.overallQualityScore]);

  useEffect(() => {
    void fetchIssues();
  // API filters define the result set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueSeverity, issueStatus]);

  const visibleIssueCount = useMemo(() => issues.length, [issues]);

  async function handleLoadData() {
    setLoadingAction(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await kavachApi.loadDemoData();
      const payload = unwrap<Record<string, unknown>>(response.data);
      setSuccess(`Demo migration completed: ${Number(payload.incidents ?? payload.records ?? 0).toLocaleString()} synthetic records available.`);
      await Promise.all([fetchDatasetInfo(), refetchQuality(), fetchIssues()]);
    } catch {
      setError("Unable to load the synthetic demo dataset.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadingAction(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceType", sourceType);
      const response = await kavachApi.createImport(formData);
      const payload = unwrap<Partial<ImportPreview> & {id?: string}>(response.data);
      const importId = payload.importId ?? payload.id;
      if (!importId) throw new Error("Import preview did not return an identifier");
      setImportPreview({
        importId,
        totalRows: Number(payload.totalRows ?? 0),
        acceptedRows: Number(payload.acceptedRows ?? 0),
        rejectedRows: Number(payload.rejectedRows ?? 0),
        duplicateRows: Number(payload.duplicateRows ?? 0),
        status: payload.status ?? "VALIDATED",
      });
      setSuccess("Validation preview created. Review counts before committing valid rows.");
    } catch {
      setError("The import could not be validated. Check the file type, mapping, and required columns.");
    } finally {
      setLoadingAction(false);
      event.target.value = "";
    }
  }

  async function commitImport() {
    if (!importPreview) return;
    setLoadingAction(true);
    setError(null);
    try {
      await kavachApi.commitImport(importPreview.importId);
      setSuccess("Validated records were committed in a database transaction.");
      setImportPreview(null);
      await Promise.all([fetchDatasetInfo(), refetchQuality(), fetchIssues()]);
    } catch {
      setError("The validated import could not be committed. No rows were silently discarded.");
    } finally {
      setLoadingAction(false);
    }
  }

  async function resolveIssue(issueId: string) {
    try {
      await kavachApi.resolveDataQualityIssue(issueId, "RESOLVED");
      await Promise.all([fetchIssues(), refetchQuality()]);
    } catch {
      setError("Unable to update the data-quality issue status.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Data Management</h1>
        <p className="text-sm text-slate-500">Validate synthetic records, monitor quality, and commit approved imports.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Database className="size-4" /> Current Dataset</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDataset ? <div className="space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-20 w-full" /></div> : datasetInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div><p className="text-xs font-semibold uppercase text-slate-500">Name</p><p className="font-medium text-[#0F172A]">{datasetInfo.name}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-slate-500">Records</p><p className="font-medium text-[#0F172A]">{datasetInfo.records.toLocaleString()}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-slate-500">Storage</p><p className="font-medium text-[#0F172A]">{datasetInfo.size}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-slate-500">Last refreshed</p><p className="font-medium text-[#0F172A]">{datasetInfo.lastUpdated}</p></div>
                </div>
                <div>
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-slate-500">Data quality</p><Badge className={qualityClass(datasetInfo.qualityScore)}>{datasetInfo.qualityScore}%</Badge></div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${qualityClass(datasetInfo.qualityScore)}`} style={{width: `${datasetInfo.qualityScore}%`}} /></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs"><thead><tr className="bg-slate-50"><th className="p-2 text-left font-medium text-slate-500">Column</th><th className="p-2 text-left font-medium text-slate-500">Type</th><th className="p-2 text-left font-medium text-slate-500">Quality</th></tr></thead>
                    <tbody>{datasetInfo.schema.map((column) => <tr key={column.column} className="border-t border-slate-100"><td className="p-2 font-mono text-[#0F172A]">{column.column}</td><td className="p-2 text-slate-500">{column.type}</td><td className="p-2">{column.quality}%</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            ) : <div className="flex flex-col items-center gap-3 py-10 text-slate-400"><Database className="size-8" /><p className="text-sm">No persistent dataset summary is available.</p></div>}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Import controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLoadData} disabled={loadingAction} className="w-full gap-2 bg-[#1D4ED8]"><RefreshCw className={`size-4 ${loadingAction ? "animate-spin" : ""}`} /> Refresh synthetic demo data</Button>
            <label className="block text-xs font-semibold text-slate-500">Source type
              <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700">
                {importTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <div className="relative">
              <Button variant="outline" disabled={loadingAction} className="w-full gap-2" onClick={() => document.getElementById("kavach-file-upload")?.click()}><Upload className="size-4" /> Validate CSV or Excel</Button>
              <input id="kavach-file-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            </div>
            {success && <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-[#15803D]"><CheckCircle className="mt-0.5 size-4 shrink-0" />{success}</div>}
            {error && <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-[#DC2626]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
          </CardContent>
        </Card>
      </div>

      {importPreview && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm text-slate-700"><FileSpreadsheet className="size-4" /> Import validation preview</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4"><span>Total <strong>{importPreview.totalRows}</strong></span><span>Accepted <strong className="text-[#15803D]">{importPreview.acceptedRows}</strong></span><span>Rejected <strong className="text-[#DC2626]">{importPreview.rejectedRows}</strong></span><span>Duplicates <strong className="text-[#D97706]">{importPreview.duplicateRows}</strong></span></div>
            <Button onClick={commitImport} disabled={loadingAction || importPreview.acceptedRows === 0} className="bg-[#1D4ED8]">Commit valid rows</Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ShieldCheck className="size-4" /> Data-quality monitoring</CardTitle>
          <div className="flex gap-2"><select aria-label="Filter data-quality issues by status" value={issueStatus} onChange={(event) => setIssueStatus(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="">All statuses</option></select><select aria-label="Filter data-quality issues by severity" value={issueSeverity} onChange={(event) => setIssueSeverity(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">All severity</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Overall score</p><p className="text-xl font-bold text-[#0F172A]">{loadingQuality ? "…" : `${dataQuality?.overallQualityScore ?? 0}%`}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Visible issues</p><p className="text-xl font-bold text-[#0F172A]">{visibleIssueCount}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Unresolved import errors</p><p className="text-xl font-bold text-[#0F172A]">{dataQuality?.unresolvedImports ?? 0}</p></div></div>
          {dataQualityError ? <p className="text-sm text-[#DC2626]">Data-quality summary is temporarily unavailable.</p> : issues.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No issues match the current filters.</p> : <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Issue</th><th className="p-3">Affected record</th><th className="p-3">Why it matters</th><th className="p-3">Recommended correction</th><th className="p-3">Status</th><th className="p-3" /></tr></thead><tbody>{issues.map((issue) => <tr key={issue.issueId} className="border-t border-slate-100 align-top"><td className="p-3 font-medium text-[#0F172A]"><Badge className={issue.severity === "HIGH" ? "bg-[#DC2626]" : "bg-[#D97706]"}>{issue.issueType}</Badge></td><td className="p-3 font-mono text-xs text-slate-600">{issue.recordId}</td><td className="p-3 text-slate-600">{issue.description}</td><td className="p-3 text-slate-600">{issue.suggestedAction}</td><td className="p-3 text-slate-600">{issue.status}</td><td className="p-3">{issue.status !== "RESOLVED" && <Button variant="outline" size="sm" onClick={() => void resolveIssue(issue.issueId)}>Resolve</Button>}</td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
