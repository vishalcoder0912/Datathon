import {useEffect, useMemo, useState} from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Database,
  FileBarChart,
  GitBranch,
  Loader2,
  Map,
  Network,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Waypoints,
} from 'lucide-react';
import {kavachApi} from '@/kavach/api/kavachApi';
import {useKavachFilters} from '@/kavach/context/FilterContext';
import {Badge} from '@/shared/components/ui/badge';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/shared/components/ui/card';

interface Capability {
  id: string;
  name: string;
  status: string;
  route: string;
}

interface Agent {
  id: string;
  name: string;
  responsibility: string;
  inputBoundary: string;
  outputBoundary: string;
}

interface Manifest {
  name: string;
  version: string;
  capabilities: Capability[];
  agents: Agent[];
  architecture: string[];
  safetyBoundary: Record<string, boolean>;
}

type JsonRecord = Record<string, any>;

const sampleRows: JsonRecord[] = [
  {
    fir_number: '202400000000000001',
    district: 'BLR',
    incident_date: '01/02/24',
    registered_date: '02/02/24',
    latitude: 12.9716,
    longitude: 77.5946,
    crime_type: 'Robbery',
    suspect_name: 'Masked Person A',
    vehicle: 'White Swift',
  },
  {
    fir_number: '202400000000000001',
    district: "B'lore",
    incident_date: '2 Feb 2024',
    registered_date: '01/02/24',
    latitude: 99,
    longitude: 77.6,
    crime_type: 'robbery',
    victim_name: 'Masked Person B',
  },
  {
    fir_number: '202400000000000003',
    district: 'Mysore',
    incident_date: '03-02-2024',
    latitude: null,
    longitude: null,
    crime_type: 'Cyber',
    suspect_phone: '+91XXXXXXXX42',
  },
];

const alertEvents = Array.from({length: 5}, (_, index) => ({
  id: `demo-incident-${index + 1}`,
  latitude: 12.9716 + index * 0.0001,
  longitude: 77.5946 + index * 0.0001,
  occurredAt: `2024-02-01T10:${String(index).padStart(2, '0')}:00Z`,
}));

const featureIcons: Record<string, typeof Database> = {
  'universal-data-gateway': Cloud,
  'schema-intelligence': TableProperties,
  'data-quality-ai': ShieldCheck,
  'crime-knowledge-graph': Network,
  'investigation-copilot': Search,
  'natural-language-dashboard': Sparkles,
  'multi-agent-ai': BrainCircuit,
  'digital-twin': Map,
  'timeline-investigation': Activity,
  'report-generator': FileBarChart,
  'explainable-ai': CheckCircle2,
  'realtime-alerts': AlertTriangle,
  'prediction-sandbox': Waypoints,
  'explainable-graph-ai': GitBranch,
  'cloud-connectors': Cloud,
};

function unwrap<T>(response: any): T {
  return (response?.data?.data || response?.data || response) as T;
}

function statusClass(status: string) {
  if (status === 'implemented') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'prototype') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-blue-100 text-blue-800 border-blue-200';
}

function JsonBlock({value}: {value: unknown}) {
  return (
    <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function IntelligenceOSPage() {
  const {filters} = useKavachFilters();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [query, setQuery] = useState('Show all robbery cases linked with a white Swift car within 15 km during the last 6 months involving repeat offenders in Mysuru');
  const [investigation, setInvestigation] = useState<JsonRecord | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [schemaResult, setSchemaResult] = useState<JsonRecord | null>(null);
  const [qualityResult, setQualityResult] = useState<JsonRecord | null>(null);
  const [graphExplanation, setGraphExplanation] = useState<JsonRecord | null>(null);
  const [alertResult, setAlertResult] = useState<JsonRecord | null>(null);
  const [reportResult, setReportResult] = useState<JsonRecord | null>(null);
  const [simulationResult, setSimulationResult] = useState<JsonRecord | null>(null);
  const [patrolChange, setPatrolChange] = useState(20);
  const [festivalIntensity, setFestivalIntensity] = useState(50);
  const [recentTrend, setRecentTrend] = useState(10);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingManifest(true);
    kavachApi.getIntelligenceOSCapabilities()
      .then((response) => {
        if (!cancelled) setManifest(unwrap<Manifest>(response));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError?.message || 'Failed to load Crime Intelligence OS capabilities.');
      })
      .finally(() => {
        if (!cancelled) setLoadingManifest(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const implementedCount = useMemo(
    () => manifest?.capabilities.filter((capability) => capability.status === 'implemented').length || 0,
    [manifest],
  );

  async function runAction<T>(name: string, operation: () => Promise<any>, setter: (value: T) => void) {
    setWorkingAction(name);
    setError(null);
    try {
      setter(unwrap<T>(await operation()));
    } catch (requestError: any) {
      setError(requestError?.message || `${name} failed.`);
    } finally {
      setWorkingAction(null);
    }
  }

  async function planInvestigation() {
    if (!query.trim()) return;
    setInvestigating(true);
    setError(null);
    try {
      const response = await kavachApi.planIntelligenceOSInvestigation(query, filters as Record<string, unknown>);
      setInvestigation(unwrap<JsonRecord>(response));
    } catch (requestError: any) {
      setError(requestError?.message || 'Investigation planning failed.');
    } finally {
      setInvestigating(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 p-7 text-white shadow-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              <ShieldCheck className="size-4" />
              State-wide intelligence layer
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">KAVACH Crime Intelligence Operating System</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              One controlled workspace for fragmented data ingestion, schema intelligence, data quality, spatial analysis,
              knowledge graphs, investigation planning, explainability, alerts, simulation, and report generation.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-bold">{manifest?.capabilities.length || 15}</p>
              <p className="text-xs text-slate-300">Capabilities</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-bold">{manifest?.agents.length || 8}</p>
              <p className="text-xs text-slate-300">Agents</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-bold">{implementedCount}</p>
              <p className="text-xs text-slate-300">Implemented</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
            <Database className="size-5 text-blue-700" />
            Platform capability map
          </CardTitle>
          <CardDescription>
            The platform now presents the requested modules as first-class capabilities, with honest deployment status rather than optimistic labels applied by committee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingManifest ? (
            <div className="flex h-40 items-center justify-center text-slate-500"><Loader2 className="mr-2 size-5 animate-spin" /> Loading capability manifest</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {manifest?.capabilities.map((capability) => {
                const Icon = featureIcons[capability.id] || Database;
                return (
                  <div key={capability.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm">
                        <Icon className="size-5 text-blue-700" />
                      </div>
                      <Badge className={`border ${statusClass(capability.status)}`}>{capability.status.replaceAll('-', ' ')}</Badge>
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-950">{capability.name}</h3>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{capability.route}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <Bot className="size-5 text-blue-700" /> Investigation Copilot
            </CardTitle>
            <CardDescription>
              Converts natural language into an approved relational, spatial, graph, repeat-offender, and visualization plan. It never executes arbitrary model-generated SQL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={5}
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              aria-label="Investigation question"
            />
            <button
              type="button"
              onClick={() => void planInvestigation()}
              disabled={investigating || !query.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {investigating ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Build investigation plan
            </button>

            {investigation && (
              <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(investigation.parsedIntent || {}).map(([key, value]) => (
                    value !== null && value !== false && <Badge key={key} variant="secondary">{key}: {String(value)}</Badge>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {Object.entries(investigation.executionPlan || {}).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{key}</p>
                      <p className="text-sm font-semibold text-slate-900">{(value as JsonRecord).engine}</p>
                    </div>
                  ))}
                </div>
                <JsonBlock value={investigation.executionPlan} />
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <strong>Safety:</strong> parameterized approved tools only, no guilt prediction, no enforcement recommendation, and mandatory human verification.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950"><BrainCircuit className="size-5 text-violet-700" /> Multi-agent pipeline</CardTitle>
            <CardDescription>Each agent has a narrow responsibility and a visible data boundary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manifest?.agents.map((agent, index) => (
              <div key={agent.id} className="relative rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">{index + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">{agent.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{agent.responsibility}</p>
                    <p className="mt-2 text-[11px] text-slate-500"><strong>Boundary:</strong> {agent.inputBoundary} → {agent.outputBoundary}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950"><TableProperties className="size-5 text-cyan-700" /> Schema Intelligence Engine</CardTitle>
            <CardDescription>Infers Incident, Person, Location, Police Station, Vehicle, Phone, and MO structures from source columns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => void runAction<JsonRecord>('schema', () => kavachApi.inferIntelligenceOSSchema(sampleRows), setSchemaResult)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800"
            >
              {workingAction === 'schema' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Analyze sample schema
            </button>
            {schemaResult && <JsonBlock value={schemaResult} />}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950"><ShieldCheck className="size-5 text-emerald-700" /> Data Quality AI</CardTitle>
            <CardDescription>Normalizes aliases and dates, then flags duplicate FIRs, missing coordinates, impossible timestamps, and out-of-bound locations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => void runAction<JsonRecord>('quality', () => kavachApi.analyzeIntelligenceOSDataQuality(sampleRows), setQualityResult)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              {workingAction === 'quality' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run quality analysis
            </button>
            {qualityResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-xl bg-slate-100 p-3"><p className="text-xl font-bold">{qualityResult.qualityScore}</p><p className="text-[11px] text-slate-500">Quality score</p></div>
                  <div className="rounded-xl bg-slate-100 p-3"><p className="text-xl font-bold">{qualityResult.issueCount}</p><p className="text-[11px] text-slate-500">Issues</p></div>
                  <div className="rounded-xl bg-slate-100 p-3"><p className="text-xl font-bold">{qualityResult.duplicateRows}</p><p className="text-[11px] text-slate-500">Duplicates</p></div>
                  <div className="rounded-xl bg-slate-100 p-3"><p className="text-xl font-bold">{qualityResult.autoCorrections}</p><p className="text-[11px] text-slate-500">Corrections</p></div>
                </div>
                <JsonBlock value={{issues: qualityResult.issues, corrections: qualityResult.corrections}} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950"><GitBranch className="size-5 text-indigo-700" /> Explainable Graph AI</CardTitle>
            <CardDescription>Shows why two nodes are linked instead of displaying a mysterious line and hoping investigators admire it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => void runAction<JsonRecord>('graph', () => kavachApi.explainIntelligenceOSGraph({
                source: 'Masked Person A',
                target: 'Masked Person B',
                relationshipType: 'POTENTIAL_ASSOCIATION',
                evidence: ['Shared phone number', 'Both appear in FIR-42', 'Shared vehicle registration'],
              }), setGraphExplanation)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
            >
              {workingAction === 'graph' ? <Loader2 className="size-4 animate-spin" /> : <Network className="size-4" />} Explain sample link
            </button>
            {graphExplanation && <JsonBlock value={graphExplanation} />}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950"><AlertTriangle className="size-5 text-red-700" /> Real-Time Alert Engine</CardTitle>
            <CardDescription>Evaluates count, radius, and time-window rules. Notification delivery remains controlled by configured workers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => void runAction<JsonRecord>('alerts', () => kavachApi.evaluateIntelligenceOSAlerts(alertEvents, {thresholdCount: 5, radiusKm: 2, windowHours: 2, channels: ['dashboard', 'email']}), setAlertResult)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
            >
              {workingAction === 'alerts' ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />} Evaluate 5-in-2km rule
            </button>
            {alertResult && <JsonBlock value={alertResult} />}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-950"><FileBarChart className="size-5 text-amber-700" /> Report Generator</CardTitle>
            <CardDescription>Plans reviewable SCRB PDF, PowerPoint, Excel, officer, and executive report packages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => void runAction<JsonRecord>('report', () => kavachApi.planIntelligenceOSReport({reportType: 'SCRB_MONTHLY', formats: ['PDF', 'POWERPOINT', 'EXCEL']}), setReportResult)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              {workingAction === 'report' ? <Loader2 className="size-4 animate-spin" /> : <FileBarChart className="size-4" />} Plan report package
            </button>
            {reportResult && <JsonBlock value={reportResult} />}
          </CardContent>
        </Card>
      </div>

      <Card className="border-violet-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-slate-950"><Waypoints className="size-5 text-violet-700" /> Prediction Sandbox</CardTitle>
          <CardDescription>Simulates bounded aggregate scenarios with visible factor contributions. It is not a causal model and cannot recommend enforcement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <label className="block text-sm font-medium text-slate-700">
              Patrol change: {patrolChange}%
              <input type="range" min={-50} max={100} value={patrolChange} onChange={(event) => setPatrolChange(Number(event.target.value))} className="mt-2 w-full" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Festival intensity: {festivalIntensity}%
              <input type="range" min={0} max={100} value={festivalIntensity} onChange={(event) => setFestivalIntensity(Number(event.target.value))} className="mt-2 w-full" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Recent recorded trend: {recentTrend}%
              <input type="range" min={-50} max={100} value={recentTrend} onChange={(event) => setRecentTrend(Number(event.target.value))} className="mt-2 w-full" />
            </label>
            <button
              type="button"
              onClick={() => void runAction<JsonRecord>('sandbox', () => kavachApi.simulateIntelligenceOSScenario({baselineRisk: 65, patrolChangePercent: patrolChange, festivalIntensity, recentTrendPercent: recentTrend}), setSimulationResult)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
            >
              {workingAction === 'sandbox' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run scenario
            </button>
          </div>
          <div>
            {simulationResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-100 p-4 text-center"><p className="text-2xl font-bold">{simulationResult.baselineRisk}</p><p className="text-xs text-slate-500">Baseline</p></div>
                  <div className="rounded-2xl bg-violet-100 p-4 text-center"><p className="text-2xl font-bold text-violet-900">{simulationResult.simulatedRisk}</p><p className="text-xs text-violet-700">Simulated</p></div>
                  <div className="rounded-2xl bg-slate-100 p-4 text-center"><p className="text-2xl font-bold">{simulationResult.delta > 0 ? '+' : ''}{simulationResult.delta}</p><p className="text-xs text-slate-500">Delta</p></div>
                </div>
                <JsonBlock value={{factors: simulationResult.factors, limitations: simulationResult.limitations}} />
              </div>
            ) : (
              <div className="flex h-full min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Adjust the scenario and run the bounded simulation.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
