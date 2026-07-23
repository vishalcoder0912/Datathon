import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  File,
  FileSpreadsheet,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, QrUploadSession, QrUploadStatus } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import { analyzeDataQuality, type Dataset } from "@/features/data/model/dataStore";

function getPortalBaseUrl() {
  return import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
}

function getFileTypeLabel(dataset?: Pick<Dataset, "fileName" | "sourceType"> | null) {
  const source = (dataset?.fileName || dataset?.sourceType || "").toLowerCase();

  if (/\.(csv|tsv|txt)$/.test(source) || source.includes("csv")) return "Delimited";
  if (/\.(xlsx|xls)$/.test(source)) return "Spreadsheet";
  if (/\.json$/.test(source) || source.includes("json")) return "JSON";

  return "Dataset";
}

function validateDataset(dataset: Dataset | null) {
  if (!dataset) {
    return {
      canProceed: false,
      qualityScore: null as number | null,
      errors: ["Upload a dataset before opening the dashboard."],
      warnings: [] as string[],
    };
  }

  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const columns = Array.isArray(dataset.columns) ? dataset.columns : [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const columnNames = columns.map((column) => column.name).filter(Boolean);
  const duplicateColumns = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);

  if (rows.length === 0 && Number(dataset.rowCount || 0) === 0) {
    errors.push("No analyzable rows were found.");
  }

  if (columns.length === 0) {
    errors.push("No columns were detected.");
  }

  if (duplicateColumns.length > 0) {
    errors.push(`Duplicate fields detected: ${Array.from(new Set(duplicateColumns)).join(", ")}.`);
  }

  let qualityScore: number | null = null;

  if (rows.length > 0 && columns.length > 0) {
    const quality = analyzeDataQuality(dataset);
    qualityScore = quality.summary.qualityScore;

    if (quality.summary.missingValues > 0) {
      warnings.push(`${quality.summary.missingValues.toLocaleString()} missing value(s) detected.`);
    }

    if (quality.summary.invalidValues > 0) {
      warnings.push(`${quality.summary.invalidValues.toLocaleString()} invalid numeric value(s) detected.`);
    }

    if (quality.summary.duplicates > 0) {
      warnings.push(`${quality.summary.duplicates.toLocaleString()} duplicate row(s) detected.`);
    }

    if (quality.summary.outliers > 0) {
      warnings.push(`${quality.summary.outliers.toLocaleString()} possible outlier(s) detected.`);
    }
  }

  return {
    canProceed: errors.length === 0,
    qualityScore,
    errors,
    warnings,
  };
}

export default function UploadPage() {
  const navigate = useNavigate();
  const {
    dataset,
    analysis,
    loadDemo,
    deleteDataset,
    uploadFiles: uploadDataFiles,
    retryHydrate,
    isProcessing,
    apiError,
  } = useData();

  const singleInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

  const [qrSession, setQrSession] = useState<QrUploadSession | null>(null);
  const [qrStatus, setQrStatus] = useState<QrUploadStatus | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");

  const generateQr = useCallback(async () => {
    setMessage("");

    const session = await api.generateQRSession({
      portalBaseUrl: getPortalBaseUrl(),
      workspaceName: dataset?.name || "InsightFlow Workspace",
    });

    setQrSession(session);
    setQrStatus({
      sessionId: session.sessionId,
      status: session.status,
      workspaceName: session.workspaceName,
      files: [],
      expiresAt: session.expiresAt,
    });

    return session;
  }, [dataset?.name]);

  useEffect(() => {
    generateQr().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to generate QR.");
    });
  }, [generateQr]);

  useEffect(() => {
    if (!qrSession) return;

    const interval = window.setInterval(async () => {
      try {
        const status = await api.getQRSessionStatus(
          qrSession.sessionId,
          qrSession.uploadToken
        );

        setQrStatus(status);

        if (status.status === "completed" && status.dataset) {
          await retryHydrate();
          setUploadState("success");
          setMessage("Mobile upload synced. Review validation before opening the dashboard.");
        } else if (status.status === "error") {
          setUploadState("error");
          setMessage(status.error || "Mobile upload failed.");
        }
      } catch {
        // silent polling failure
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [qrSession, retryHydrate]);

  async function uploadFiles(files: File[]) {
    if (!files.length || uploading) return;

    setUploading(true);
    setUploadState("uploading");
    setMessage("Uploading and validating dataset...");

    try {
      await uploadDataFiles(files);
      setUploadState("success");
      setMessage("Dataset uploaded and schema validation completed. Review the results, then open the dashboard.");
    } catch (error) {
      setUploadState("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(event.dataTransfer.files || []));
  }

  const activeDataset = qrStatus?.dataset || dataset;
  const activeAnalysis = qrStatus?.analysis || analysis;
  const validation = validateDataset(activeDataset || null);
  const dashboardReady = Boolean(activeDataset && validation.canProceed && !uploading && !isProcessing);
  const statusMessage = apiError && uploadState !== "uploading" ? apiError : message;

  return (
    <div className="min-h-screen bg-[#07111f] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400">
              {activeDataset?.name || "No dataset selected"}{" "}
              {activeDataset?.rowCount
                ? `• ${activeDataset.rowCount.toLocaleString()} rows`
                : ""}
            </p>
            <h1 className="mt-1 text-3xl font-bold">Upload Data</h1>
            <p className="mt-1 text-sm text-slate-400">
              Import your datasets for analysis
            </p>
          </div>

          <button type="button" className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Docs
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.8fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr_250px]">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-xl font-bold">
                    Scan to Upload from Mobile
                  </h2>
                  <span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs text-violet-300">
                    Recommended
                  </span>
                </div>

                <div className="rounded-2xl bg-white p-3">
                  {qrSession?.qrDataUrl ? (
                    <img
                      src={qrSession.qrDataUrl}
                      alt="Upload QR code"
                      className="size-52 rounded-xl"
                    />
                  ) : (
                    <div className="flex size-52 items-center justify-center text-slate-900">
                      <Loader2 className="size-8 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <p className="max-w-sm text-sm leading-6 text-slate-300">
                  Scan this QR code to open the secure upload portal on your
                  phone. Upload one or multiple files and sync them directly to
                  InsightFlow.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button"
                    disabled={!qrSession}
                    onClick={() =>
                      qrSession && window.open(qrSession.uploadUrl, "_blank")
                    }
                    className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    Open Upload Portal{" "}
                    <ExternalLink className="ml-2 inline size-4" />
                  </button>

                  <button type="button"
                    onClick={() => generateQr()}
                    className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                  >
                    Generate New QR{" "}
                    <RefreshCw className="ml-2 inline size-4" />
                  </button>
                </div>

                {statusMessage && (
                  <div
                    className={`mt-4 rounded-xl border p-3 text-sm ${
                      uploadState === "error" || apiError
                        ? "border-red-500/40 bg-red-500/10 text-red-200"
                        : uploadState === "success"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-800 bg-slate-950/60 text-slate-300"
                    }`}
                    role={uploadState === "error" || apiError ? "alert" : "status"}
                  >
                    {uploadState === "error" || apiError ? (
                      <XCircle className="mr-2 inline size-4" />
                    ) : uploadState === "success" ? (
                      <CheckCircle2 className="mr-2 inline size-4" />
                    ) : null}
                    {statusMessage}
                  </div>
                )}
              </div>

              <div className="hidden overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 p-4 lg:block">
                <div className="mb-3 flex justify-between text-xs text-slate-400">
                  <span>9:41</span>
                  <span>●●●</span>
                </div>

                <p className="text-sm font-bold">InsightFlow</p>
                <p className="mt-2 text-sm text-slate-300">Upload Files</p>

                <div className="mt-4 rounded-xl border border-dashed border-violet-500/60 p-5 text-center">
                  <Upload className="mx-auto mb-2 size-8 text-violet-400" />
                  <p className="text-sm font-semibold">Tap to select files</p>
                  <p className="mt-1 text-xs text-slate-400">
                    CSV, XLSX, JSON
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 p-3">
                  <p className="text-xs text-slate-400">Recent upload</p>
                  <p className="mt-1 text-sm">
                    {qrStatus?.files?.[0]?.name || "customer_data.csv"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Mobile uploads auto-sync to this workspace
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                Live
              </span>
            </div>

            {[
              ["Scan QR", "Use your phone camera"],
              ["Select files", "Choose one or multiple files"],
              ["Upload", "Files are securely uploaded"],
              ["Dataset appears here", "Ready for analysis instantly"],
            ].map((step, index) => (
              <div key={step[0]} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold">{step[0]}</p>
                  <p className="text-sm text-slate-400">{step[1]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="rounded-2xl bg-violet-500/15 p-4">
                <File className="size-7 text-violet-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Single File</h3>
                <p className="text-sm text-slate-400">
                  Upload one dataset file
                </p>
                <p className="text-sm text-slate-500">CSV, XLSX or JSON</p>
              </div>
            </div>

            <button type="button"
              onClick={() => singleInputRef.current?.click()}
              className="w-full rounded-xl border border-slate-700 py-3 text-sm font-semibold hover:bg-slate-800"
            >
              Select File
            </button>

            <input
              ref={singleInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(event) =>
                uploadFiles(Array.from(event.target.files || []).slice(0, 1))
              }
            />
          </div>

          <div className="rounded-2xl border border-violet-500/40 bg-slate-900/70 p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="rounded-2xl bg-violet-500/15 p-4">
                <Layers className="size-7 text-violet-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Multiple Files</h3>
                <p className="text-sm text-slate-400">
                  Upload and merge multiple files
                </p>
                <p className="text-sm text-slate-500">CSV, XLSX or JSON</p>
              </div>
            </div>

            <button type="button"
              onClick={() => multiInputRef.current?.click()}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500"
            >
              Select Files
            </button>

            <input
              ref={multiInputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(event) =>
                uploadFiles(Array.from(event.target.files || []))
              }
            />
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center ${
              dragging
                ? "border-violet-400 bg-violet-500/10"
                : "border-violet-500/50 bg-slate-900/70"
            }`}
          >
            <Upload className="mb-3 size-10 text-violet-300" />
            <h3 className="text-lg font-bold">Drag & Drop Files Here</h3>
            <p className="mt-1 text-sm text-slate-400">
              Drop one or more files to upload
            </p>
            <p className="mt-1 text-sm text-slate-500">
              CSV, XLSX, JSON • Multiple files supported
            </p>
          </div>
        </div>

        {uploading && (
          <div
            className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-4 text-sm text-violet-200"
            role="status"
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <span>
                <Loader2 className="mr-2 inline size-4 animate-spin" />
                Uploading, parsing, and validating dataset...
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-100">
                In progress
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-950/70">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-violet-300" />
            </div>
          </div>
        )}

        {activeDataset && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="size-7 text-emerald-400" />
                <div>
                  <h2 className="text-xl font-bold">{activeDataset.name}</h2>
                  <p className="text-sm text-slate-400">
                    {validation.canProceed
                      ? "Dataset loaded and schema validation passed"
                      : "Dataset loaded but needs attention"}
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  validation.canProceed
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {validation.canProceed ? "Validated" : "Blocked"}
              </span>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-5">
              <div>
                <p className="text-sm text-slate-400">Total Records</p>
                <p className="mt-1 text-2xl font-bold">
                  {activeDataset.rowCount?.toLocaleString?.() ||
                    activeDataset.rows?.length?.toLocaleString?.() ||
                    0}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Columns</p>
                <p className="mt-1 text-2xl font-bold">
                  {activeDataset.columns?.length || 0}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">File Type</p>
                <p className="mt-2 inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-sm">
                  <FileSpreadsheet className="mr-2 size-4" />
                  {getFileTypeLabel(activeDataset)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Validation</p>
                <p className="mt-1 text-2xl font-bold">
                  {validation.qualityScore == null ? "Ready" : `${validation.qualityScore}%`}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Uploaded</p>
                <p className="mt-1 text-sm text-slate-200">
                  {activeDataset.uploadedAt
                    ? new Date(activeDataset.uploadedAt).toLocaleString()
                    : "Just now"}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <p className="mb-3 text-sm text-slate-400">Detected Fields</p>

              <div className="flex flex-wrap gap-2">
                {(activeDataset.columns || []).slice(0, 16).map((column: any) => (
                  <span
                    key={column.name}
                    className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200"
                  >
                    {column.name}
                  </span>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {validation.errors.map((error) => (
                  <div
                    key={error}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
                    role="alert"
                  >
                    <XCircle className="mr-2 inline size-4" />
                    {error}
                  </div>
                ))}

                {validation.errors.length === 0 && validation.warnings.length === 0 && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    <CheckCircle2 className="mr-2 inline size-4" />
                    Validation passed. No missing, duplicate, invalid, or outlier issues were detected.
                  </div>
                )}

                {validation.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100"
                  >
                    <AlertTriangle className="mr-2 inline size-4" />
                    {warning}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button"
                  onClick={async () => {
                    if (window.confirm(`Delete "${activeDataset.name}"? This cannot be undone.`)) {
                      await deleteDataset();
                    }
                  }}
                  className="rounded-xl border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="mr-2 inline size-4" />
                  Clear Dataset
                </button>

                <button type="button"
                  onClick={() => navigate("/dashboard")}
                  disabled={!dashboardReady}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Proceed to Dashboard{" "}
                  <ArrowRight className="ml-2 inline size-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!activeDataset && (
          <div className="flex justify-end">
            <button type="button"
              onClick={() => loadDemo()}
              disabled={isProcessing}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:bg-slate-800"
            >
              <Database className="mr-2 inline size-4" />
              Use Demo Data
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 text-sm text-slate-400 md:flex-row md:justify-between">
          <p>
            <ShieldCheck className="mr-2 inline size-4 text-emerald-400" />
            All uploads are encrypted and stored securely.
          </p>
          <p>
            <Lock className="mr-2 inline size-4 text-orange-400" />
            Your data is private and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
