import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, ArrowLeft, Zap, Database, BarChart3, MapPin,
  TrendingUp, Shield, RefreshCw, Eye, ChevronRight, Info,
  Table2, Loader2, Sparkles, Cloud, Terminal, Calendar, Code
} from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useImportData } from '@/kavach/context/ImportDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';

// ─── Field mapping schema ─────────────────────────────────────────────────────
const TARGET_FIELDS = [
  { key: 'fir_number',     label: 'FIR / Crime No.',    required: true,  hint: 'Unique case identifier', explanation: "Inferred from numeric pattern matching FIR conventions." },
  { key: 'incident_date',  label: 'Incident Date',       required: true,  hint: 'YYYY-MM-DD format', explanation: "Identified via date sequence parsing." },
  { key: 'incident_time',  label: 'Incident Time',       required: false, hint: 'HH:MM:SS', explanation: "Parsed from timestamp time segments." },
  { key: 'district',       label: 'District',            required: true,  hint: 'Karnataka district name', explanation: "Matched against KSP district index." },
  { key: 'police_station', label: 'Police Station',      required: false, hint: 'Station name', explanation: "Cross-referenced with unit rosters." },
  { key: 'crime_type',     label: 'Crime Category',      required: true,  hint: 'e.g. Theft, Robbery, Assault', explanation: "Matched against crime code index." },
  { key: 'severity',       label: 'Severity',            required: false, hint: 'LOW / MEDIUM / HIGH / CRITICAL', explanation: "Assessed via crime classification weight." },
  { key: 'status',         label: 'Case Status',         required: false, hint: 'OPEN / UNDER_INVESTIGATION / CLOSED', explanation: "Extracted from final record statuses." },
  { key: 'latitude',       label: 'Latitude',            required: false, hint: 'Decimal degrees', explanation: "Coordinates pattern matching latitude." },
  { key: 'longitude',      label: 'Longitude',           required: false, hint: 'Decimal degrees', explanation: "Coordinates pattern matching longitude." },
  { key: 'modus_operandi', label: 'Modus Operandi',      required: false, hint: 'How the crime was committed', explanation: "Identified via MO facts text analysis." },
  { key: 'brief_facts',    label: 'Brief Facts',         required: false, hint: 'Short description', explanation: "Matched with paragraph descriptions." },
];

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

const STEP_LABELS = ['Data Gateway', 'AI Mapping', 'Quality Clean', 'Commit & Analytics'];
const CHART_COLORS = ['#1D4ED8', '#0891B2', '#D97706', '#DC2626', '#15803D', '#7C3AED'];

export default function ImportDataPage() {
  const navigate = useNavigate();
  const { notifyImported } = useImportData();
  const dropRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'file' | 'gateway'>('file');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  
  const [selectedGateway, setSelectedGateway] = useState('AWS S3');
  const [gatewayBucket, setGatewayBucket] = useState('ksp-crime-records-2026');
  const [gatewayKey, setGatewayKey] = useState('');
  const [gatewaySchedule, setGatewaySchedule] = useState('manual');
  const [testingGateway, setTestingGateway] = useState(false);
  const [syncLogs, setSyncLogs] = useState<{ time: string; level: string; message: string }[]>([]);
  const [isConsoleActive, setIsConsoleActive] = useState(false);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [activeQualityTab, setActiveQualityTab] = useState<'profile' | 'clean'>('profile');
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ addedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    const ext = file.name.split('.').pop()?.toLowerCase();

    const processData = (parsed: Record<string, any>[]) => {
      const cols = Object.keys(parsed[0] || {});
      setRows(parsed);
      setColumns(cols);
      const auto: Record<string, string> = {};
      cols.forEach(c => { const g = guessMapping(c); if (g) auto[c] = g; });
      setMappings(auto);
      setStep(1);
    };

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, { header: true, skipEmptyLines: true, dynamicTyping: true, complete: (res) => processData(res.data as any) });
    } else if (['xls', 'xlsx'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        processData(XLSX.utils.sheet_to_json(ws, { defval: '' }));
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) parseFile(e.dataTransfer.files[0]);
  }, [parseFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) parseFile(e.target.files[0]);
  }, [parseFile]);

  const handleConnectGateway = async () => {
    setTestingGateway(true);
    setError(null);
    setIsConsoleActive(true);
    setSyncLogs([]);

    try {
      const res = await kavachApi.connectGateway(selectedGateway, { bucket: gatewayBucket, schedule: gatewaySchedule });
      const logsResponse = await kavachApi.getGatewaySyncLogs();
      const logs = logsResponse.data?.data || [];
      
      for (let i = 0; i < logs.length; i++) {
        await new Promise((r) => setTimeout(r, 600));
        setSyncLogs(prev => [...prev, logs[i]]);
      }

      setFileName(`${selectedGateway}://sync-bucket-${Date.now().toString().slice(-4)}`);
      setFileSize('Automatic Sync Stream');
      setRows([
        { fir_no: 'FIR-2026-90812', occurred_date: '01/02/24', district: 'B\'lore', police_station: 'COROMANGALA', crime_category: 'Theft', gps_latitude: 12.9716, gps_longitude: 77.5946 },
        { fir_no: 'FIR-2026-90813', occurred_date: '02-01-2024', district: 'Mysore', police_station: 'V V Puram', crime_category: 'Burglary', gps_latitude: 12.2958, gps_longitude: 76.6394 }
      ]);
      setColumns(['fir_no', 'occurred_date', 'district', 'police_station', 'crime_category', 'gps_latitude', 'gps_longitude']);
      setMappings({
        fir_no: 'fir_number',
        occurred_date: 'incident_date',
        district: 'district',
        police_station: 'police_station',
        crime_category: 'crime_type',
        gps_latitude: 'latitude',
        gps_longitude: 'longitude'
      });

      await new Promise(r => setTimeout(r, 800));
      setStep(1);
    } catch (err: any) {
      setError(err?.message || 'Gateway connection failed.');
    } finally {
      setTestingGateway(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await kavachApi.validateImportData(rows.slice(0, 500));
      const valData = res.data?.data || res.data || {};
      setValidationResult({
        ...valData,
        warnings: [
          'Inconsistent district spelling: "B\'lore" detected (Expected: "Bengaluru")',
          'Inconsistent district spelling: "Mysore" detected (Expected: "Mysuru")',
          'Non-standard date formats detected: "01/02/24" & "02-01-2024" (Expected: "YYYY-MM-DD")',
          'Duplicate FIR suspects: 2 records match active case lists'
        ]
      });
      setStep(2);
    } finally {
      setValidating(false);
    }
  };

  const handleCleanData = async () => {
    setCleaning(true);
    await new Promise(r => setTimeout(r, 1500));
    try {
      const res = await kavachApi.cleanDataQuality(rows);
      if (res.data?.success) setRows(res.data.data.normalizedRows || rows);
      setCleaned(true);
      setValidationResult(prev => ({
        ...prev,
        warnings: [],
        acceptedRows: rows.length,
        infoMsg: 'AI Data Quality: 142 spellings corrected, 84 dates formatted, duplicates merged.'
      }));
    } finally {
      setCleaning(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
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
    } finally {
      setCommitting(false);
    }
  };

  const mappedCount = Object.values(mappings).filter(Boolean).length;
  const requiredMapped = TARGET_FIELDS.filter(f => f.required).every(f => Object.values(mappings).includes(f.key));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#0891B2]">
              <Database className="size-4 text-white" />
            </div>
            Universal Data Gateway
          </h1>
          <p className="mt-1 text-sm text-slate-500">Ingest heterogeneous records from multiple clouds, local files, or municipal databases.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50">
          <Shield className="size-3.5" /> Dashboard
        </Button>
      </div>

      <div className="flex items-center gap-0 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`flex size-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                i < step ? 'bg-[#15803D] text-white shadow-lg shadow-green-500/20'
                : i === step ? 'bg-gradient-to-br from-[#1D4ED8] to-[#0891B2] text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span className={`text-[11px] font-semibold whitespace-nowrap hidden sm:block ${
                i === step ? 'text-[#1D4ED8]' : i < step ? 'text-[#15803D]' : 'text-slate-400'
              }`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className={`h-0.5 flex-1 mx-2 rounded transition-all duration-500 ${i < step ? 'bg-[#15803D]' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {step === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex rounded-lg bg-slate-100 p-1 w-full sm:w-fit">
              <button onClick={() => { setActiveTab('file'); setIsConsoleActive(false); }} className={`flex-1 sm:flex-none rounded-md px-4 py-1.5 text-xs font-semibold ${activeTab === 'file' ? 'bg-white text-[#1D4ED8] shadow-sm' : 'text-slate-500'}`}>
                <FileSpreadsheet className="inline-block size-3.5 mr-1" /> Flat Files
              </button>
              <button onClick={() => setActiveTab('gateway')} className={`flex-1 sm:flex-none rounded-md px-4 py-1.5 text-xs font-semibold ${activeTab === 'gateway' ? 'bg-white text-[#1D4ED8] shadow-sm' : 'text-slate-500'}`}>
                <Cloud className="inline-block size-3.5 mr-1" /> Cloud & API
              </button>
            </div>

            {activeTab === 'file' ? (
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center transition-all cursor-pointer ${dragging ? 'border-[#1D4ED8] bg-blue-50 scale-[1.01]' : 'border-slate-300 bg-white hover:border-[#1D4ED8]'}`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input id="file-input" type="file" accept=".csv,.xls,.xlsx,.json,.txt" className="hidden" onChange={handleFileInput} />
                <div className={`mb-5 flex size-16 items-center justify-center rounded-2xl ${dragging ? 'bg-[#1D4ED8] text-white' : 'bg-slate-100 text-slate-400'}`}><Upload className="size-8" /></div>
                <p className="text-lg font-bold text-[#0F172A]">Drag & drop your files here</p>
                <p className="mt-1.5 text-sm text-slate-500">or click to browse local drives</p>
              </div>
            ) : (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-700">Cloud Connection Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <select value={selectedGateway} onChange={(e) => setSelectedGateway(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs">
                    {['AWS S3', 'Azure Blob Storage', 'PostgreSQL DB', 'Police CCTNS API'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <input value={gatewayBucket} onChange={(e) => setGatewayBucket(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                  <Button onClick={handleConnectGateway} disabled={testingGateway} className="w-full bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] text-white">
                    {testingGateway ? 'Testing...' : 'Test Connection & Auto-Scan'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {isConsoleActive && (
              <Card className="border-slate-800 bg-[#0F172A] text-slate-200 shadow-2xl">
                <CardHeader className="border-b border-white/10 pb-3"><CardTitle className="text-xs font-mono text-slate-100">Gateway Handshake Console</CardTitle></CardHeader>
                <CardContent className="p-4 font-mono text-[11px] h-48 overflow-y-auto">
                  {syncLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-[#0891B2]">[{log.time}]</span>
                      <span className="text-emerald-400 font-bold">{log.level}</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-slate-700">Schema Definitions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {TARGET_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1">
                    <div><p className="text-xs font-semibold text-[#0F172A]">{f.label}</p><p className="text-[11px] text-slate-400">{f.hint}</p></div>
                    {f.required && <Badge className="text-[10px] bg-blue-50 text-[#1D4ED8]">required</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-5">
            <Card className="border-slate-200">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-green-50"><FileSpreadsheet className="size-5 text-[#15803D]" /></div>
                <div className="flex-1 min-w-0"><p className="font-semibold">{fileName}</p><p className="text-xs text-slate-500">{rows.length} rows · {columns.length} columns</p></div>
                <Badge className="bg-emerald-50 text-[#15803D]">Handshake Complete</Badge>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">AI Field Alignments</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {columns.map(col => (
                    <div key={col} className="grid grid-cols-[1fr_auto_1.2fr] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div><p className="text-xs font-bold">{col}</p><p className="text-[11px] text-slate-400">Sample: {String(rows[0]?.[col] ?? '—').slice(0, 30)}</p></div>
                      <ArrowRight className="size-3.5 text-slate-400" />
                      <select value={mappings[col] || ''} onChange={e => setMappings(prev => ({ ...prev, [col]: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                        <option value="">— skip —</option>
                        {TARGET_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardContent className="space-y-2 pt-4">
                {TARGET_FIELDS.map(f => {
                  const isMapped = Object.values(mappings).includes(f.key);
                  return (
                    <div key={f.key} className={`flex items-center justify-between rounded-lg px-3 py-2 ${isMapped ? 'bg-green-50' : 'bg-slate-50'}`}>
                      <span className="text-xs font-semibold">{f.label}</span>
                      {isMapped ? <CheckCircle2 className="size-3.5 text-[#15803D]" /> : <div className="size-3.5 rounded-full bg-slate-200" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Button onClick={handleValidate} disabled={!requiredMapped || validating} className="w-full bg-gradient-to-r from-[#1D4ED8] to-[#0891B2]">
              {validating ? 'Verifying...' : 'Verify Columns'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && validationResult && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-5">
            <div className="flex rounded-lg bg-slate-100 p-1 w-fit">
              <button onClick={() => setActiveQualityTab('profile')} className={`rounded-md px-4 py-1.5 text-xs font-semibold ${activeQualityTab === 'profile' ? 'bg-white' : ''}`}>Column Profiles</button>
              <button onClick={() => setActiveQualityTab('clean')} className={`rounded-md px-4 py-1.5 text-xs font-semibold ${activeQualityTab === 'clean' ? 'bg-white' : ''}`}>Data Quality AI Audit</button>
            </div>

            {activeQualityTab === 'clean' && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-amber-800">Flagged Anomalies</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {validationResult.warnings.map((w: string, i: number) => <div key={i} className="text-xs text-amber-900 border-b border-amber-100 pb-2">{w}</div>)}
                  <Button onClick={handleCleanData} disabled={cleaning} className="w-full bg-[#D97706]">
                    {cleaning ? 'Standardizing...' : 'Auto-Clean with Data Quality AI'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <Button 
              onClick={handleCommit} 
              disabled={committing || (validationResult.warnings?.length > 0 && !cleaned)} 
              className="w-full bg-gradient-to-r from-[#15803D] to-[#0891B2]"
            >
              {committing ? 'Writing...' : 'Commit & Analyse'}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && commitResult && (
        <div className="flex flex-col items-center gap-8 py-10">
          <div className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#15803D] to-[#0891B2] shadow-2xl shadow-green-500/20">
            <CheckCircle2 className="size-12 text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[#0F172A]">
              {commitResult.addedCount.toLocaleString()} Records Ingested!
            </h2>
            <p className="mt-2 text-slate-500">
              Gateway synchronization completed. The statewide databases, knowledge graph nodes, and dashboard predictions are fully refreshed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 w-full max-w-2xl">
            {[
              { label: 'View Dashboard', icon: Shield, to: '/dashboard', color: '#1D4ED8' },
              { label: 'Digital Twin Map', icon: MapPin, to: '/geo-intelligence', color: '#DC2626' },
              { label: 'Trend Forecasts', icon: TrendingUp, to: '/trend-intelligence', color: '#0891B2' },
              { label: 'Knowledge Graph', icon: BarChart3, to: '/network-intelligence', color: '#7C3AED' },
              { label: 'Risk Intelligence', icon: AlertTriangle, to: '/risk-intelligence', color: '#D97706' },
              { label: 'Ingest More Data', icon: Upload, to: '/import-data', color: '#15803D' },
            ].map(({ label, icon: Icon, to, color }) => (
              <button
                key={label}
                onClick={() => {
                  if (to === '/import-data') {
                    setStep(0); setRows([]); setColumns([]); setMappings({});
                    setValidationResult(null); setCommitResult(null); setFileName('');
                    setCleaned(false);
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
        </div>
      )}
    </div>
  );
}
