import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  HelpCircle,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Upload,
  X,
} from "lucide-react";
import { api, QrUploadStatus } from "@/features/data/api/dataApi";

type UploadMode = "single" | "multiple";

type QueueFile = {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "uploaded" | "error";
};

function fileIcon(name: string) {
  const lower = name.toLowerCase();

  if (lower.endsWith(".json")) {
    return <FileJson className="size-7 text-violet-300" />;
  }

  return <FileSpreadsheet className="size-7 text-emerald-300" />;
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes || 1) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${
    units[index]
  }`;
}

export default function MobileUploadPortal() {
  const { sessionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>("single");
  const [status, setStatus] = useState<QrUploadStatus | null>(null);
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function refreshStatus() {
    if (!sessionId || !token) return;

    const next = await api.getQRSessionStatus(sessionId, token);
    setStatus(next);
  }

  useEffect(() => {
    refreshStatus().catch((err) => {
      setError(err instanceof Error ? err.message : "Invalid upload session.");
    });
  }, [sessionId, token]);

  function selectFiles(files: File[]) {
    const allowed = mode === "single" ? files.slice(0, 1) : files;

    setQueue(
      allowed.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        progress: 0,
        status: "pending",
      }))
    );
  }

  function removeFile(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  async function uploadNow() {
    if (!queue.length || uploading) return;

    setUploading(true);
    setError("");

    const interval = window.setInterval(() => {
      setQueue((prev) =>
        prev.map((item) =>
          item.status === "uploaded"
            ? item
            : {
                ...item,
                status: "uploading",
                progress: Math.min(item.progress + Math.random() * 18, 92),
              }
        )
      );
    }, 400);

    try {
      const result = await api.uploadToQRSession(
        sessionId,
        token,
        queue.map((item) => item.file)
      );

      window.clearInterval(interval);

      setQueue((prev) =>
        prev.map((item) => ({
          ...item,
          progress: 100,
          status: "uploaded",
        }))
      );

      setStatus(result);
    } catch (err) {
      window.clearInterval(interval);

      setQueue((prev) =>
        prev.map((item) => ({
          ...item,
          status: "error",
        }))
      );

      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const totalSize = queue.reduce((sum, item) => sum + item.file.size, 0);

  return (
    <div className="min-h-screen bg-[#07111f] px-4 py-6 text-white">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-800 bg-slate-950/70 p-5 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-600 p-2">
              <Upload className="size-5" />
            </div>
            <h1 className="text-xl font-bold">InsightFlow</h1>
          </div>

          <button type="button" className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300">
            <HelpCircle className="mr-1 inline size-4" />
            Help
          </button>
        </div>

        <h2 className="text-3xl font-bold">Mobile Upload Portal</h2>
        <p className="mt-2 text-slate-400">
          Upload one or multiple datasets and sync them to your workspace.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-400">
            <span className="mr-2 inline-block size-2 rounded-full bg-emerald-400" />
            Connected to Workspace
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="truncate font-semibold">
              {status?.workspaceName || "InsightFlow Workspace"}
            </p>
            <span className="rounded-xl border border-violet-500/40 px-3 py-2 text-sm text-violet-300">
              Change
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-2xl border border-slate-800 p-1">
          <button type="button"
            onClick={() => {
              setMode("single");
              setQueue([]);
            }}
            className={`rounded-xl py-3 font-semibold ${
              mode === "single" ? "bg-violet-600 text-white" : "text-slate-300"
            }`}
          >
            Single File
          </button>

          <button type="button"
            onClick={() => {
              setMode("multiple");
              setQueue([]);
            }}
            className={`rounded-xl py-3 font-semibold ${
              mode === "multiple" ? "bg-violet-600 text-white" : "text-slate-300"
            }`}
          >
            Multiple Files
          </button>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-2xl border border-dashed border-violet-500/60 p-8 text-center"
        >
          <Upload className="mx-auto mb-3 size-14 text-violet-400" />
          <p className="text-xl font-bold">Tap to select files</p>
          <p className="mt-1 text-slate-400">or drag and drop</p>
          <p className="mx-auto mt-3 inline-flex rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300">
            CSV, XLSX, JSON
          </p>

          <button type="button" className="mt-6 w-full rounded-xl bg-violet-600 py-4 font-bold">
            <FolderOpen className="mr-2 inline size-5" />
            Select Files
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple={mode === "multiple"}
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={(event) =>
              selectFiles(Array.from(event.target.files || []))
            }
          />
        </div>

        {queue.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold">Files to Upload ({queue.length})</p>
              <p className="text-sm text-slate-400">
                Total: {formatBytes(totalSize)}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-slate-800 p-4 last:border-b-0"
                >
                  <div>{fileIcon(item.file.name)}</div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.file.name}</p>
                    <p className="text-sm text-slate-400">
                      {formatBytes(item.file.size)}
                    </p>

                    {item.status === "uploading" && (
                      <div className="mt-2 h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-violet-500"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {item.status === "uploaded" && (
                      <p className="mt-1 text-sm text-emerald-400">
                        <CheckCircle2 className="mr-1 inline size-4" />
                        Uploaded • Synced to workspace
                      </p>
                    )}

                    {item.status === "error" && (
                      <p className="mt-1 text-sm text-red-400">
                        Upload failed
                      </p>
                    )}
                  </div>

                  <button type="button" onClick={() => removeFile(item.id)} disabled={uploading}>
                    <X className="size-5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-violet-600 p-3">
              <RefreshCw className="size-6" />
            </div>
            <p className="font-semibold">
              Uploads sync automatically to your desktop dashboard.
            </p>
            <Smartphone className="ml-auto size-7 text-violet-300" />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button type="button"
          onClick={uploadNow}
          disabled={!queue.length || uploading}
          className="mt-5 w-full rounded-xl bg-violet-600 py-4 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 inline size-5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 inline size-5" />
              Upload Now
            </>
          )}
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border border-slate-700 py-3 font-semibold text-slate-200"
          >
            <Plus className="mr-2 inline size-5" />
            Add More
          </button>

          <button type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-slate-700 py-3 font-semibold text-slate-200"
          >
            <QrCode className="mr-2 inline size-5" />
            Scan New QR
          </button>
        </div>

        {status?.dataset && (
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold">Recently Synced Dataset</p>
              <span className="text-sm text-emerald-400">Synced</span>
            </div>

            <p className="mt-3 font-semibold">{status.dataset.name}</p>
            <p className="text-sm text-slate-400">
              {status.dataset.rowCount?.toLocaleString?.() || 0} rows •{" "}
              {status.dataset.columns?.length || 0} columns
            </p>
          </div>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          Your files are encrypted and secure.
        </p>
      </div>
    </div>
  );
}
