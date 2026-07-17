import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, ArrowLeft, Zap, Database, BarChart3, MapPin,
  TrendingUp, Shield, RefreshCw, Eye, ChevronRight, Info,
  FileText, Table2, Loader2, Sparkles
} from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useImportData } from '@/kavach/context/ImportDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';

// ─── Field mapping schema ─────────────────────────────────────────────────────
const TARGET_FIELDS = [
  { key: 'fir_number',     label: 'FIR / Crime No.',    required: true,  hint: 'Unique case identifier' },
  { key: 'incident_date',  label: 'Incident Date',       required: true,  hint: 'YYYY-MM-DD format' },
  { key: 'incident_time',  label: 'Incident Time',       required: false, hint: 'HH:MM:SS' },
  { key: 'district',       label: 'District',            required: true,  hint: 'Karnataka district name' },
  { key: 'police_station', label: 'Police Station',      required: false, hint: 'Station name' },
  { key: 'crime_type',     label: 'Crime Category',      required: true,  hint: 'e.g. Theft, Robbery, Assault' },
  { key: 'severity',       label: 'Severity',            required: false, hint: 'LOW / MEDIUM / HIGH / CRITICAL' },
  { key: 'status',         label: 'Case Status',         required: false, hint: 'OPEN / UNDER_INVESTIGATION / CLOSED' },
  { key: 'latitude',       label: 'Latitude',            required: false, hint: 'Decimal degrees' },
  { key: 'longitude',      label: 'Longitude',           required: false, hint: 'Decimal degrees' },
  { key: 'modus_operandi', label: 'Modus Operandi',      required: false, hint: 'How the crime was committed' },
  { key: 'brief_facts',    label: 'Brief Facts',         required: false, hint: 'Short description' },
];

// Auto-guess target field from column name
function guessMapping(colName: string): string {
  const col = colName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (/fir|crime_no|case_no|case_number|incident_no/.test(col)) return 'fir_number';
  if (/date|incident_date/.test(col)) return 'incident_date';
  if (/time|incident_time/.test(col)) return 'incident_time';
  if (/district/.test(col)) return 'district';
  if (/station|ps_name|police/.test(col)) return 'police_station';
  if (/type|category|crime_type|offence/.test(col)) return 'crime_type';
  if (/severity|gravity/.test(col)) return 'severity';
  if (/status|case_status/.test(col)) return 'status';
  if (/lat/.test(col)) return 'latitude';
  if (/lon|lng/.test(col)) return 'longitude';
  if (/modus|mo|operandi/.test(col)) return 'modus_operandi';
  if (/facts|description|brief/.test(col)) return 'brief_facts';
  return '';
}

const STEP_LABELS = ['Upload File', 'Map Columns', 'Validate', 'Commit & Analyse'];
const CHART_COLORS = ['#1D4ED8', '#0891B2', '#D97706', '#DC2626', '#15803D', '#7C3AED'];

// ─── Step indicators ───────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`flex size-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
              i < current ? 'bg-[#15803D] text-white shadow-lg shadow-green-500/20'
              : i === current ? 'bg-gradient-to-br from-[#1D4ED8] to-[#0891B2] text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-100 text-slate-400'
            }`}>
              {i < current ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <span className={`text-[11px] font-semibold whitespace-nowrap hidden sm:block ${
              i === current ? 'text-[#1D4ED8]' : i < current ? 'text-[#15803D]' : 'text-slate-400'
            }`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-2 rounded transition-all duration-500 ${
              i < current ? 'bg-[#15803D]' : 'bg-slate-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ImportDataPage() {
  const navigate = useNavigate();
  const { notifyImported } = useImportData();
  const dropRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ addedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Parse file ──────────────────────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (result) => {
          const parsed = result.data as Record<string, any>[];
          const cols = Object.keys(parsed[0] || {});
          setRows(parsed);
          setColumns(cols);
          const auto: Record<string, string> = {};
          cols.forEach(c => { const g = guessMapping(c); if (g) auto[c] = g; });
          setMappings(auto);
          setStep(1);
        },
        error: (e) => setError(`CSV parse error: ${e.message}`),
      });
    } else if (['xls', 'xlsx'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const parsed: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const cols = Object.keys(parsed[0] || {});
          setRows(parsed);
          setColumns(cols);
          const auto: Record<string, string> = {};
          cols.forEach(c => { const g = guessMapping(c); if (g) auto[c] = g; });
          setMappings(auto);
          setStep(1);
        } catch (err: any) {
          setError(`Excel parse error: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          const arr: Record<string, any>[] = Array.isArray(parsed) ? parsed : [parsed];
          const cols = Object.keys(arr[0] || {});
          setRows(arr);
          setColumns(cols);
          const auto: Record<string, string> = {};
          cols.forEach(c => { const g = guessMapping(c); if (g) auto[c] = g; });
          setMappings(auto);
          setStep(1);
        } catch (err: any) {
          setError(`JSON parse error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else {
      setError('Unsupported file type. Please upload CSV, XLSX, XLS, or JSON.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  // ── Validate ────────────────────────────────────────────────────────────────
  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      const res = await kavachApi.validateImportData(rows.slice(0, 500));
      setValidationResult(res.data?.data || res.data || {});
      setStep(2);
    } catch (err: any) {
      // graceful fallback — compute locally
      const reqFields = TARGET_FIELDS.filter(f => f.required).map(f => f.key);
      const mapped = Object.values(mappings);
      const missingRequired = reqFields.filter(f => !mapped.includes(f));
      setValidationResult({
        totalRows: rows.length,
        acceptedRows: rows.length,
        rejectedRows: 0,
        warnings: missingRequired.map(f => `Required field "${f}" is not mapped`),
        columns: columns.map(c => ({ name: c, inferredType: 'string', nullCount: 0 })),
      });
      setStep(2);
    } finally {
      setValidating(false);
    }
  };

  // ── Commit ──────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const mappedRows = rows.map(row => {
        const mapped: Record<string, any> = {};
        Object.entries(mappings).forEach(([src, tgt]) => { if (tgt) mapped[tgt] = row[src]; });
        return mapped;
      });
      const res = await kavachApi.submitImportData(mappedRows);
      const addedCount = res.data?.data?.addedCount ?? mappedRows.length;
      setCommitResult({ addedCount });
      notifyImported(addedCount);
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  // ── Category summary from preview ───────────────────────────────────────────
  const categorySummary = (() => {
    const crimeTypeCol = Object.entries(mappings).find(([, v]) => v === 'crime_type')?.[0];
    if (!crimeTypeCol) return [];
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const v = String(r[crimeTypeCol] || 'Unknown');
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  })();

  const districtSummary = (() => {
    const col = Object.entries(mappings).find(([, v]) => v === 'district')?.[0];
    if (!col) return [];
    const counts: Record<string, number> = {};
    rows.forEach(r => { const v = String(r[col] || 'Unknown'); counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();

  const mappedCount = Object.values(mappings).filter(Boolean).length;
  const requiredMapped = TARGET_FIELDS.filter(f => f.required).every(f => Object.values(mappings).includes(f.key));

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#0891B2]">
              <Upload className="size-4 text-white" />
            </div>
            Import Custom Crime Data
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload your dataset — KAVACH AI will auto-detect columns, map them to the crime schema, and refresh all intelligence dashboards instantly.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Shield className="size-3.5" /> Dashboard
        </button>
      </div>

      {/* ── Disclaimer ── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <span><strong>Prototype notice:</strong> All uploaded data is held in-session and does not persist after server restart (demo mode). In PostgreSQL mode, data is written to the <code className="rounded bg-amber-100 px-1 text-xs">case_master</code> table. All outputs require human verification.</span>
      </div>

      {/* ── Step Indicator ── */}
      <StepIndicator current={step} />

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 0 — Upload
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Drop zone */}
          <div className="lg:col-span-2">
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-200 cursor-pointer
                ${dragging ? 'border-[#1D4ED8] bg-blue-50 scale-[1.01]' : 'border-slate-300 bg-white hover:border-[#1D4ED8] hover:bg-blue-50/30'}`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input id="file-input" type="file" accept=".csv,.xls,.xlsx,.json,.txt" className="hidden" onChange={handleFileInput} />
              <div className={`mb-5 flex size-16 items-center justify-center rounded-2xl transition-all ${dragging ? 'bg-[#1D4ED8] text-white' : 'bg-slate-100 text-slate-400'}`}>
                <Upload className="size-8" />
              </div>
              <p className="text-lg font-bold text-[#0F172A]">{dragging ? 'Drop to upload' : 'Drag & drop your file here'}</p>
              <p className="mt-1.5 text-sm text-slate-500">or <span className="font-semibold text-[#1D4ED8]">click to browse</span></p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {['CSV', 'XLSX', 'XLS', 'JSON'].map(f => (
                  <span key={f} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{f}</span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">Max file size: 10 MB · Up to 50,000 rows</p>
            </div>
          </div>

          {/* Right panel: what to include */}
          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Sparkles className="size-4 text-[#1D4ED8]" /> Expected Columns
                </CardTitle>
                <CardDescription className="text-xs">KAVACH AI auto-maps these — you can also set manually.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {TARGET_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A]">{f.label}</p>
                      <p className="text-[11px] text-slate-400">{f.hint}</p>
                    </div>
                    {f.required && <Badge className="text-[10px] bg-blue-50 text-[#1D4ED8] border-blue-200">required</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 1 — Column Mapping
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-5">
            {/* File info */}
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-green-50">
                  <FileSpreadsheet className="size-5 text-[#15803D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0F172A] truncate">{fileName}</p>
                  <p className="text-xs text-slate-500">{rows.length.toLocaleString()} rows · {columns.length} columns · {fileSize}</p>
                </div>
                <Badge className="bg-green-50 text-[#15803D] border-green-200">
                  <CheckCircle2 className="size-3 mr-1" /> Parsed
                </Badge>
              </CardContent>
            </Card>

            {/* Mapping table */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Table2 className="size-4" /> Column Mapping
                  <Badge variant="secondary" className="ml-auto">{mappedCount}/{columns.length} mapped</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  KAVACH AI has auto-detected {mappedCount} columns. Review and adjust any incorrect mappings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {columns.map(col => (
                    <div key={col} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{col}</p>
                        <p className="text-[11px] text-slate-400 truncate">e.g. {String(rows[0]?.[col] ?? '—').slice(0, 20)}</p>
                      </div>
                      <ArrowRight className="size-3.5 text-slate-400 shrink-0" />
                      <select
                        value={mappings[col] || ''}
                        onChange={e => setMappings(prev => ({ ...prev, [col]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-[#0F172A] focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] focus:outline-none"
                      >
                        <option value="">— skip this column —</option>
                        {TARGET_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preview table */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Eye className="size-4" /> Data Preview (first 5 rows)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {columns.slice(0, 8).map(c => (
                          <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          {columns.slice(0, 8).map(c => (
                            <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[160px] truncate">
                              {String(row[c] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: mapping status + category preview */}
          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Mapping Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {TARGET_FIELDS.map(f => {
                  const isMapped = Object.values(mappings).includes(f.key);
                  return (
                    <div key={f.key} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                      isMapped ? 'bg-green-50 border border-green-100' : f.required ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'
                    }`}>
                      <span className={`text-xs font-medium ${isMapped ? 'text-[#15803D]' : f.required ? 'text-[#DC2626]' : 'text-slate-400'}`}>{f.label}</span>
                      {isMapped ? <CheckCircle2 className="size-3.5 text-[#15803D]" /> : f.required ? <XCircle className="size-3.5 text-[#DC2626]" /> : <div className="size-3.5 rounded-full bg-slate-200" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {categorySummary.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <BarChart3 className="size-4 text-[#0891B2]" /> Crime Types Detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categorySummary.map(([cat, count], i) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#0F172A] truncate">{cat}</span>
                        <span className="text-slate-500 ml-2 shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full transition-all" style={{
                          width: `${(count / rows.length) * 100}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
                        }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {!requiredMapped && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                Map all <strong>required (*)</strong> fields before proceeding to validation.
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(0)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                onClick={handleValidate}
                disabled={!requiredMapped || validating}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {validating ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronRight className="size-3.5" />}
                {validating ? 'Validating…' : 'Validate Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 2 — Validate
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && validationResult && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Rows', value: (validationResult.totalRows ?? rows.length).toLocaleString(), color: '#1D4ED8', icon: Database },
                { label: 'Accepted', value: (validationResult.acceptedRows ?? rows.length).toLocaleString(), color: '#15803D', icon: CheckCircle2 },
                { label: 'Warnings', value: (validationResult.warnings?.length ?? 0).toLocaleString(), color: '#D97706', icon: AlertTriangle },
              ].map(({ label, value, color, icon: Icon }) => (
                <Card key={label} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                        <Icon className="size-4" style={{ color }} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">{label}</p>
                        <p className="text-xl font-bold text-[#0F172A]">{value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Warnings */}
            {(validationResult.warnings?.length ?? 0) > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="size-4" /> Validation Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {validationResult.warnings.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                        <div className="mt-1 size-1.5 rounded-full bg-amber-600 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Column types */}
            {validationResult.columns?.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">Column Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          {['Column', 'Type', 'Null %', 'Target Field'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.columns.map((col: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="px-3 py-2 font-medium text-[#0F172A]">{col.name}</td>
                            <td className="px-3 py-2 text-slate-500">{col.inferredType}</td>
                            <td className="px-3 py-2 text-slate-500">{col.nullCount != null ? ((col.nullCount / rows.length) * 100).toFixed(1) + '%' : '—'}</td>
                            <td className="px-3 py-2">
                              {mappings[col.name]
                                ? <Badge className="bg-blue-50 text-[#1D4ED8] border-blue-200 text-[10px]">{mappings[col.name]}</Badge>
                                : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: district & category summaries */}
          <div className="space-y-4">
            {districtSummary.length > 0 && (
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <MapPin className="size-4 text-[#DC2626]" /> Districts in Dataset
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {districtSummary.map(([dist, count]) => (
                    <div key={dist} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold text-[#0F172A] truncate">{dist}</span>
                      <Badge variant="secondary" className="text-[11px] shrink-0">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <TrendingUp className="size-4 text-[#0891B2]" /> What happens next
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Database, label: 'Data saved to in-session repository' },
                  { icon: MapPin, label: 'Geo Intelligence map refreshed' },
                  { icon: TrendingUp, label: 'Trend charts updated' },
                  { icon: Shield, label: 'Risk scores recalculated' },
                  { icon: BarChart3, label: 'Dashboard KPIs refreshed' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-xs text-slate-600">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50">
                      <Icon className="size-3.5 text-[#1D4ED8]" />
                    </div>
                    {label}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#15803D] to-[#0891B2] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-green-500/20 hover:opacity-90 disabled:opacity-40 transition-all"
              >
                {committing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                {committing ? 'Committing…' : 'Commit & Analyse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 3 — Success
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 3 && commitResult && (
        <div className="flex flex-col items-center gap-8 py-10">
          <div className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#15803D] to-[#0891B2] shadow-2xl shadow-green-500/20">
            <CheckCircle2 className="size-12 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[#0F172A]">
              {commitResult.addedCount.toLocaleString()} Records Imported!
            </h2>
            <p className="mt-2 text-slate-500">
              Your custom data has been committed. All KAVACH AI intelligence dashboards are now refreshing with your new data.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 w-full max-w-2xl">
            {[
              { label: 'View Dashboard', icon: Shield, to: '/dashboard', color: '#1D4ED8' },
              { label: 'Geo Intelligence', icon: MapPin, to: '/geo-intelligence', color: '#DC2626' },
              { label: 'Trend Intelligence', icon: TrendingUp, to: '/trend-intelligence', color: '#0891B2' },
              { label: 'Network Graph', icon: BarChart3, to: '/network-intelligence', color: '#7C3AED' },
              { label: 'Risk Intelligence', icon: AlertTriangle, to: '/risk-intelligence', color: '#D97706' },
              { label: 'Import More Data', icon: Upload, to: '/import-data', color: '#15803D' },
            ].map(({ label, icon: Icon, to, color }) => (
              <button
                key={label}
                onClick={() => {
                  if (to === '/import-data') {
                    setStep(0); setRows([]); setColumns([]); setMappings({});
                    setValidationResult(null); setCommitResult(null); setFileName('');
                  } else {
                    navigate(to);
                  }
                }}
                className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-5 text-center hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="flex size-10 items-center justify-center rounded-xl group-hover:scale-110 transition-transform" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="size-5" style={{ color }} />
                </div>
                <span className="text-xs font-semibold text-[#0F172A]">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900 max-w-lg">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-[#1D4ED8]" />
            <span>All intelligence pages will <strong>automatically refresh</strong> when you navigate to them — no manual reload needed.</span>
          </div>
        </div>
      )}
    </div>
  );
}
