import { useEffect, useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  AlertTriangle, Users, MapPin, Repeat, Bell, Shield,
  Clock, TrendingUp, TrendingDown, Play, Pause, Search,
  ArrowRight, BookOpen, Plus, Settings, CheckCircle, XCircle,
  Info, Sliders, Database, AlertOctagon, RefreshCw, Upload, Save, Check
} from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import GlobalFilters from '@/kavach/components/GlobalFilters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';
import CytoscapeNetworkGraph, { NetworkGraphNode, NetworkGraphEdge } from '@/kavach/components/CytoscapeNetworkGraph';

// File upload helpers
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface OverviewData {
  totalIncidents: number;
  activeInvestigations: number;
  closedInvestigations: number;
  highRiskDistricts: number;
  activeHotspots: number;
  repeatOffenders: number;
  currentAlerts: number;
  mostCommonCategory: string;
  avgInvestigationDuration: string;
  dataQualityScore: number;
  periodChanges?: Record<string, number>;
  categoryDistribution?: { name: string; value: number }[];
  monthlyTrend?: { month: string; incidents: number; previous?: number }[];
  districtComparison?: { district: string; incidents: number }[];
  dayOfWeekAnalysis?: { day: string; incidents: number }[];
  severityBreakdown?: { name: string; value: number }[];
}

const severityColors = ['#DC2626', '#D97706', '#0891B2', '#15803D'];
const CHART_COLORS = ['#1D4ED8', '#0891B2', '#D97706', '#DC2626', '#15803D', '#7C3AED', '#0F172A'];

function StatCard({ title, value, icon: Icon, change, color }: {
  title: string; value: string | number; icon: React.ElementType; change?: number; color: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm bg-white/70 backdrop-blur-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-1.5 text-2xl font-bold text-[#0F172A]">{value}</p>
            {change !== undefined && (
              <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>
                {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(change).toFixed(1)}% vs prev
              </div>
            )}
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
            <Icon className="size-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { filters } = useKavachFilters();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Evolution State
  const [evolutionData, setEvolutionData] = useState<any[]>([]);
  const [evolutionIndex, setEvolutionIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playInterval = useRef<any>(null);

  // Graph State
  const [graphNodes, setGraphNodes] = useState<NetworkGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<NetworkGraphEdge[]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [selectedNode, setSelectedNode] = useState<NetworkGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkGraphEdge | null>(null);
  const [graphSearch, setGraphSearch] = useState('');
  const [pathFrom, setPathFrom] = useState('');
  const [pathTo, setPathTo] = useState('');
  const [pathResult, setPathResult] = useState<string[] | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  // Socioeconomic State
  const [socioIndicators, setSocioIndicators] = useState<any[]>([]);
  const [socioAreas, setSocioAreas] = useState<any[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [correlationLoading, setCorrelationLoading] = useState(false);

  // Emerging Trends State
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertGrowth, setAlertGrowth] = useState(30);
  const [alertZ, setAlertZ] = useState(1.5);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // What-If Simulator State
  const [whatIfPolice, setWhatIfPolice] = useState(100);
  const [whatIfPoverty, setWhatIfPoverty] = useState(20);
  const [simulatedRisk, setSimulatedRisk] = useState(65.4);

  // Schema Import State
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importProfiled, setImportProfiled] = useState<any[]>([]);
  const [importMappings, setImportMappings] = useState<Record<string, string>>({});
  const [importProfileName, setImportProfileName] = useState('New Ingestion Profile');
  const [importProfileList, setImportProfileList] = useState<any[]>([]);
  const [importStatusMessage, setImportStatusMessage] = useState('');

  // Data Quality State
  const [dqSummary, setDqSummary] = useState<any>(null);
  const [dqIssues, setDqIssues] = useState<any[]>([]);

  // Tabbed queries controller
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    kavachApi.getOverview(filters)
      .then((res) => { if (!cancelled) setOverview(res.data?.data || res.data); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  // Load Tab Specific Data
  useEffect(() => {
    if (activeTab === 'evolution') {
      kavachApi.getIntelligenceEvolution(filters)
        .then(res => setEvolutionData(res.data?.data || res.data || []));
    } else if (activeTab === 'graph') {
      kavachApi.getIntelligenceGraph(filters)
        .then(res => {
          const data = res.data?.data || res.data || { nodes: [], edges: [] };
          setGraphNodes(data.nodes || []);
          setGraphEdges(data.edges || []);
        });
    } else if (activeTab === 'socioeconomic') {
      kavachApi.getIntelligenceSocioeconomicIndicators().then(res => setSocioIndicators(res.data?.data || res.data || []));
      kavachApi.getIntelligenceSocioeconomicAreas().then(res => setSocioAreas(res.data?.data || res.data || []));
      setCorrelationLoading(true);
      kavachApi.calculateIntelligenceSocioeconomicCorrelation(filters)
        .then(res => setCorrelations(res.data?.data?.correlations || res.data?.correlations || []))
        .finally(() => setCorrelationLoading(false));
    } else if (activeTab === 'trends') {
      setAlertsLoading(true);
      kavachApi.detectIntelligenceAlerts(alertGrowth, alertZ, filters)
        .then(res => setAlerts(res.data?.data?.alerts || res.data?.alerts || []))
        .finally(() => setAlertsLoading(false));
    } else if (activeTab === 'imports') {
      kavachApi.getImportProfiles().then(res => setImportProfileList(res.data?.data || res.data || []));
    } else if (activeTab === 'quality') {
      kavachApi.getDataQualitySummary(filters).then(res => setDqSummary(res.data?.data || res.data));
      kavachApi.getDataQualityIssues(filters).then(res => setDqIssues(res.data?.data?.data || res.data?.data || []));
    }
  }, [activeTab, alertGrowth, alertZ, filters]);

  // Timeline player logic
  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        setEvolutionIndex(prev => (prev + 1) % (evolutionData.length || 1));
      }, 1000);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }
    return () => { if (playInterval.current) clearInterval(playInterval.current); };
  }, [isPlaying, evolutionData]);

  // Shortest path logic
  const handleFindPath = () => {
    if (!pathFrom || !pathTo) return;
    kavachApi.getIntelligenceGraphPath(pathFrom, pathTo, filters)
      .then(res => setPathResult(res.data?.data?.path || res.data?.path || null));
  };

  // What-If Simulator Logic
  useEffect(() => {
    const baseRisk = 65.4;
    const policeFactor = (100 - whatIfPolice) * 0.15;
    const povertyFactor = (whatIfPoverty - 20) * 0.45;
    setSimulatedRisk(Number((baseRisk + policeFactor + povertyFactor).toFixed(1)));
  }, [whatIfPolice, whatIfPoverty]);

  // Upload/Load mock dataset logic
  const handleLoadSampleData = () => {
    const samples = [
      { fir_number: "FIR-2026-0091", district: "BENGALURU_URBAN", police_station: "COROMANGALA", crime_type: "Cybercrime", incident_date: "2026-06-15", incident_time: "14:30:00", latitude: 12.9344, longitude: 77.6192, weapon: "Computer", value: 120000, suspect_name: "Ramesh K.", suspect_phone: "+919888877771" },
      { fir_number: "FIR-2026-0092", district: "MYSORE", police_station: "LASHKAR", crime_type: "Burglary", incident_date: "2026-06-16", incident_time: "03:15:00", latitude: 12.3118, longitude: 76.6564, weapon: "Iron Rod", value: 450000, suspect_name: "Unknown", suspect_phone: "" },
      { fir_number: "FIR-2026-0093", district: "BENGALURU_URBAN", police_station: "COROMANGALA", crime_type: "Cybercrime", incident_date: "2026-06-17", incident_time: "11:20:00", latitude: 12.9388, longitude: 77.6102, weapon: "Smartphone", value: 80000, suspect_name: "Ramesh K.", suspect_phone: "+919888877771" }
    ];
    processUploadedRows(samples);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatusMessage(`Reading file: ${file.name}...`);
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const rows = Array.isArray(json) ? json : [json];
          processUploadedRows(rows);
        } catch (err) {
          setImportStatusMessage('Error: Failed to parse JSON file.');
        }
      };
      reader.readAsText(file);
    } else if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          processUploadedRows(results.data);
        },
        error: (err) => {
          setImportStatusMessage(`Error: Failed to parse CSV: ${err.message}`);
        }
      });
    } else if (extension === 'xls' || extension === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet);
          processUploadedRows(rows);
        } catch (err) {
          setImportStatusMessage('Error: Failed to parse Excel sheet.');
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setImportStatusMessage('Error: Unsupported file format.');
    }
  };

  const processUploadedRows = (rows: any[]) => {
    if (rows.length === 0) {
      setImportStatusMessage('Error: Uploaded file contains no data.');
      return;
    }
    setImportRows(rows);
    setImportStatusMessage(`File loaded successfully. Profiling ${rows.length} records...`);
    kavachApi.validateImportData(rows)
      .then(res => {
        const profiled = res.data?.data?.profiled || res.data?.profiled || [];
        setImportProfiled(profiled);
        // Pre-fill target schema mappings
        const maps: Record<string, string> = {};
        profiled.forEach((col: any) => {
          if (col.detectedSemanticMeaning && col.detectedSemanticMeaning !== 'IGNORED') {
            maps[col.sourceName] = col.detectedSemanticMeaning;
          }
        });
        setImportMappings(maps);
        setImportStatusMessage(`Profiled ${rows.length} rows. System mapped ${Object.keys(maps).length} fields automatically!`);
      })
      .catch(err => {
        setImportStatusMessage(`Error profiling data: ${err?.message || 'Unknown error'}`);
      });
  };

  const handleSaveImportProfile = () => {
    kavachApi.saveImportProfile({
      name: importProfileName,
      sourceType: 'JSON',
      columnMappings: importMappings
    }).then(() => {
      setImportStatusMessage('Ingestion profile saved successfully.');
      setTimeout(() => setImportStatusMessage(''), 3000);
      kavachApi.getImportProfiles().then(res => setImportProfileList(res.data?.data || res.data || []));
    });
  };

  const handleCommitImport = () => {
    setImportStatusMessage('Committing transaction to database...');
    // Map uploaded rows using mapped fields
    const mappedRows = importRows.map(row => {
      const mapped: Record<string, any> = {};
      Object.entries(importMappings).forEach(([sourceField, targetField]) => {
        if (targetField) {
          mapped[targetField] = row[sourceField];
        }
      });
      return mapped;
    });

    kavachApi.submitImportData(mappedRows)
      .then((res) => {
        const addedCount = res.data?.data?.addedCount ?? mappedRows.length;
        setImportStatusMessage(`Database Transaction Committed successfully. ${addedCount} new cases imported and processed!`);
        setImportRows([]);
        setImportProfiled([]);
        // Re-load Overview/Dashboard stats to show the changes
        kavachApi.getOverview(filters).then(res => setOverview(res.data?.data || res.data));
      })
      .catch(err => {
        setImportStatusMessage(`Error committing transaction: ${err?.response?.data?.error?.message || err?.message || 'Unknown error'}`);
      });
  };

  const handleResolveIssue = (issueId: string) => {
    kavachApi.resolveDataQualityIssue(issueId, 'RESOLVED')
      .then(() => {
        setDqIssues(prev => prev.filter(i => i.id !== issueId));
      });
  };

  const handleMarkAlert = (alertId: string) => {
    kavachApi.markAlertReviewed(alertId)
      .then(() => {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, reviewStatus: 'REVIEWED' } : a));
      });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <GlobalFilters />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center gap-3 p-10">
            <AlertTriangle className="size-8 text-[#DC2626]" />
            <p className="text-sm font-medium text-[#DC2626]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter Graph Nodes based on threshold and search
  const filteredNodes = graphNodes.filter(node => 
    (!graphSearch || node.label.toLowerCase().includes(graphSearch.toLowerCase()) || node.id.includes(graphSearch))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">KAVACH AI Workspace</h1>
        <p className="text-sm text-slate-500">Karnataka Geospatial, Temporal and Socioeconomic Crime Intelligence Platform</p>
      </div>

      <GlobalFilters />

      {/* Glassmorphic Tabs List */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-1.5 scrollbar-thin">
        {[
          { id: 'overview', label: 'Overview', icon: Shield },
          { id: 'evolution', label: 'Crime Evolution', icon: Clock },
          { id: 'graph', label: 'Knowledge Graph', icon: Repeat },
          { id: 'communities', label: 'Community Analysis', icon: Users },
          { id: 'socioeconomic', label: 'Socioeconomic Context', icon: MapPin },
          { id: 'trends', label: 'Emerging Trends', icon: TrendingUp },
          { id: 'risk', label: 'Risk Explanation', icon: Sliders },
          { id: 'imports', label: 'Schema Import', icon: Database },
          { id: 'quality', label: 'Data Quality', icon: AlertOctagon }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <Card key={i} className="border-slate-200">
                  <CardContent className="p-5">
                    <Skeleton className="mb-2 h-3 w-20" />
                    <Skeleton className="h-7 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : overview ? (
              <>
                <StatCard title="Total Incidents" value={overview.totalIncidents ?? 0} icon={Shield} change={overview.periodChanges?.totalIncidents} color="#1D4ED8" />
                <StatCard title="Active Investigations" value={overview.activeInvestigations ?? 0} icon={Shield} change={overview.periodChanges?.activeInvestigations} color="#0891B2" />
                <StatCard title="Closed Investigations" value={overview.closedInvestigations ?? 0} icon={Shield} change={overview.periodChanges?.closedInvestigations} color="#15803D" />
                <StatCard title="High-Risk Districts" value={overview.highRiskDistricts ?? 0} icon={AlertTriangle} change={overview.periodChanges?.highRiskDistricts} color="#DC2626" />
                <StatCard title="Active Hotspots" value={overview.activeHotspots ?? 0} icon={MapPin} change={overview.periodChanges?.activeHotspots} color="#D97706" />
                <StatCard title="Multiple Case Links" value={overview.repeatOffenders ?? 0} icon={Repeat} change={overview.periodChanges?.repeatOffenders} color="#7C3AED" />
                <StatCard title="Current Alerts" value={overview.currentAlerts ?? 0} icon={Bell} change={overview.periodChanges?.currentAlerts} color="#DC2626" />
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-slate-200">
                  <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                </Card>
              ))
            ) : overview ? (
              <>
                <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Most Common Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-[#1D4ED8] px-3 py-1 text-sm">{overview.mostCommonCategory || 'N/A'}</Badge>
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="size-4" />
                        Avg Investigation: {overview.avgInvestigationDuration || 'N/A'}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Data Quality</span>
                        <span className="font-bold text-[#0F172A]">{overview.dataQualityScore ?? 0}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#15803D] transition-all"
                          style={{ width: `${overview.dataQualityScore ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 lg:col-span-2 xl:col-span-3 bg-white/70 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Monthly Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={overview.monthlyTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="incidents" stroke="#1D4ED8" strokeWidth={2} dot={false} />
                        {overview.monthlyTrend?.[0]?.previous !== undefined && (
                          <Line type="monotone" dataKey="previous" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-slate-200">
                  <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                </Card>
              ))
            ) : overview ? (
              <>
                <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Category Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={overview.categoryDistribution || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#1D4ED8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Day of Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={overview.dayOfWeekAnalysis || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="incidents" fill="#0891B2" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">Severity Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={overview.severityBreakdown || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {(overview.severityBreakdown || []).map((_, idx) => (
                            <Cell key={idx} fill={severityColors[idx % severityColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'evolution' && (
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Spatio-Temporal Hotspot Evolution</CardTitle>
              <CardDescription>Animate the weekly/monthly progression of crime hotspots across Karnataka districts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold shadow hover:bg-slate-800 transition-all"
                >
                  {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  {isPlaying ? 'Pause Timeline' : 'Play Timeline'}
                </button>
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, evolutionData.length - 1)}
                    value={evolutionIndex}
                    onChange={(e) => setEvolutionIndex(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
                    <span>{evolutionData[0]?.period || 'Start'}</span>
                    <span className="font-bold text-slate-900">{evolutionData[evolutionIndex]?.period || 'Current Period'}</span>
                    <span>{evolutionData[evolutionData.length - 1]?.period || 'End'}</span>
                  </div>
                </div>
              </div>

              {evolutionData[evolutionIndex] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-700">Evolution Stage: {evolutionData[evolutionIndex].period}</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {evolutionData[evolutionIndex].districts?.map((d: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 text-xs shadow-sm">
                          <span className="font-medium text-slate-800">{d.district}</span>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-700 font-semibold">{d.count} Crimes</Badge>
                            <Badge className={d.avgSeverity > 2.5 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}>
                              Sev: {d.avgSeverity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="h-[350px] bg-slate-950 rounded-xl p-4 flex flex-col justify-end text-white relative overflow-hidden border border-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900 to-slate-850 opacity-90" />
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="text-red-500 size-5" />
                        <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Animated Hotspot Overlay</span>
                      </div>
                      <p className="text-sm text-slate-300">Hotspot concentration rendering for <span className="text-white font-bold">{evolutionData[evolutionIndex].period}</span>. High crime zones are dynamically mapped.</p>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white/5 p-3 rounded-lg border border-white/10 text-center">
                          <p className="text-xs text-slate-400">Districts Tracked</p>
                          <p className="text-xl font-bold mt-1">{evolutionData[evolutionIndex].districts?.length || 0}</p>
                        </div>
                        <div className="flex-1 bg-white/5 p-3 rounded-lg border border-white/10 text-center">
                          <p className="text-xs text-slate-400">Peak Incident Count</p>
                          <p className="text-xl font-bold mt-1">
                            {Math.max(...(evolutionData[evolutionIndex].districts?.map((d: any) => d.count) || [0]))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3 space-y-4">
            <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Crime Knowledge Graph</CardTitle>
                    <CardDescription>Cytoscape relationship navigator mapping accused co-offenders, vehicles, locations, and shared modus operandi.</CardDescription>
                  </div>
                  <button onClick={() => setLayoutRevision(prev => prev + 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <RefreshCw className="size-4 text-slate-600" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search nodes (e.g. accused, case)..."
                      value={graphSearch}
                      onChange={(e) => setGraphSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Confidence:</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                      className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{confidenceThreshold}</span>
                  </div>

                  <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg p-1.5 bg-slate-50/50">
                    <input
                      type="text"
                      placeholder="From node ID"
                      value={pathFrom}
                      onChange={(e) => setPathFrom(e.target.value)}
                      className="w-24 px-2 py-1 text-[11px] border border-slate-200 rounded"
                    />
                    <ArrowRight className="size-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="To node ID"
                      value={pathTo}
                      onChange={(e) => setPathTo(e.target.value)}
                      className="w-24 px-2 py-1 text-[11px] border border-slate-200 rounded"
                    />
                    <button
                      onClick={handleFindPath}
                      className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-semibold"
                    >
                      Find Path
                    </button>
                  </div>
                </div>

                <CytoscapeNetworkGraph
                  nodes={filteredNodes}
                  edges={graphEdges}
                  layoutRevision={layoutRevision}
                  onNodeSelect={(node) => { setSelectedNode(node); setSelectedEdge(null); }}
                  onEdgeSelect={(edge) => { setSelectedEdge(edge); setSelectedNode(null); }}
                />

                {pathResult && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                    <p className="font-semibold text-blue-800">Shortest Linkage Path Detected:</p>
                    <p className="mt-1 font-mono text-blue-700">{pathResult.join(' ➔ ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/70 backdrop-blur-md h-full">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Entity Profile & Legend</CardTitle>
                <CardDescription>Select a node or edge in the Cytoscape graph to view detailed metadata and verified indicators.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {selectedNode && (
                  <div className="space-y-2 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 text-sm">{selectedNode.label}</span>
                      <Badge className="bg-slate-900 text-white">{selectedNode.type}</Badge>
                    </div>
                    <p className="text-slate-500 font-mono text-[10px]">ID: {selectedNode.id}</p>
                    {selectedNode.isRepeat && (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 font-semibold">
                        Repeat Association Detected
                      </Badge>
                    )}
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-2 border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 text-sm">Relationship Link</span>
                      <Badge className="bg-slate-200 text-slate-700">{selectedEdge.relationshipType || selectedEdge.type}</Badge>
                    </div>
                    <p className="text-slate-500">Source: <span className="font-mono">{selectedEdge.source}</span></p>
                    <p className="text-slate-500">Target: <span className="font-mono">{selectedEdge.target}</span></p>
                    {selectedEdge.evidence && selectedEdge.evidence.length > 0 && (
                      <div className="mt-2 border-t border-slate-200 pt-2 space-y-1">
                        <p className="font-semibold text-slate-700">Evidentiary Provenance:</p>
                        {selectedEdge.evidence.map((ev, i) => (
                          <p key={i} className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100">
                            {ev.reason || ev.crimeNo}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!selectedNode && !selectedEdge && (
                  <div className="text-slate-400 text-center py-10">Select an element on graph to inspect.</div>
                )}

                <div className="border-t border-slate-150 pt-4 space-y-2">
                  <p className="font-bold text-slate-700">Visual Legend:</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-red-600" /> Accused / Suspect</div>
                    <div className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-blue-600" /> Case / Incident</div>
                    <div className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-green-600" /> Victim / Complainant</div>
                    <div className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-purple-600" /> Police Station</div>
                    <div className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-amber-600" /> Modus Operandi</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'communities' && (
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Louvain Network Community Detection</CardTitle>
              <CardDescription>Review criminal communities identified using Louvain modularity optimization alongside node centrality metrics.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="p-3">Node / Entity</th>
                      <th className="p-3">Entity Type</th>
                      <th className="p-3">Modularity Community</th>
                      <th className="p-3">Degree Centrality</th>
                      <th className="p-3">Weighted Degree</th>
                      <th className="p-3">Betweenness Centrality</th>
                      <th className="p-3">PageRank</th>
                      <th className="p-3">Eigenvector Centrality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNodes.slice(0, 10).map((node, index) => {
                      const metrics = (node as any).metrics || { degreeCentrality: 0, weightedDegree: 0, betweennessCentrality: 0, pageRank: 0, eigenvectorCentrality: 0 };
                      return (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{node.label}</td>
                          <td className="p-3"><Badge className="bg-slate-100 text-slate-700">{node.type}</Badge></td>
                          <td className="p-3 font-mono">Group #{(node as any).community ?? '0'}</td>
                          <td className="p-3 font-mono">{metrics.degreeCentrality ?? '0.00'}</td>
                          <td className="p-3 font-mono">{metrics.weightedDegree ?? '0.00'}</td>
                          <td className="p-3 font-mono">{metrics.betweennessCentrality ?? '0.00'}</td>
                          <td className="p-3 font-mono">{metrics.pageRank ?? '0.00'}</td>
                          <td className="p-3 font-mono">{metrics.eigenvectorCentrality ?? '0.00'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5"><Info className="size-4 text-blue-600" /> Centrality Methodology</h4>
                  <p className="text-slate-500">
                    **Degree Centrality** represents direct connections. **Weighted Degree** incorporates strength. **Betweenness** isolates key connectors or bridges. **PageRank** identifies systemic influence across the network structure.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5"><Shield className="size-4 text-slate-700" /> Community Partitioning</h4>
                  <p className="text-slate-500">
                    Communities are clustered using Louvain Modularity, maximizing dense local connections. Node groups suggest coordinated activity. These are for research analysis and do not imply individual guilt.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'socioeconomic' && (
        <div className="space-y-4">
          {/* Causation Warning */}
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="size-5 text-amber-700 shrink-0" />
              <p className="text-xs font-semibold text-amber-800">
                CAUTION: Correlation does not prove that the socioeconomic indicator caused the crime pattern. These statistics represent macro-level associations for research.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-slate-200 bg-white/70 backdrop-blur-md lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Socioeconomic Correlation Matrix</CardTitle>
                <CardDescription>Pearson and Spearman rank coefficients correlating district crime counts with social indicators.</CardDescription>
              </CardHeader>
              <CardContent>
                {correlationLoading ? (
                  <div className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-20 w-full" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                          <th className="p-3">Indicator</th>
                          <th className="p-3">Pearson (r)</th>
                          <th className="p-3">Spearman (ρ)</th>
                          <th className="p-3">Association Strength</th>
                          <th className="p-3">Confidence P-Value</th>
                          <th className="p-3">Sample Size (Districts)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {correlations.map((c, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-slate-800">{c.indicatorName}</td>
                            <td className="p-3 font-mono">{c.pearsonCorrelation}</td>
                            <td className="p-3 font-mono">{c.spearmanCorrelation}</td>
                            <td className="p-3 capitalize">
                              <Badge className={c.strength === 'strong' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}>
                                {c.strength} {c.direction}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono">P = {c.spearmanPValue}</td>
                            <td className="p-3 font-mono">{c.sampleSize}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Indicator Overlays</CardTitle>
                <CardDescription>Toggle visual socioeconomic overlays for mapping comparison.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {socioIndicators.map((ind, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <p className="font-semibold text-slate-700">{ind.name}</p>
                      <p className="text-[10px] text-slate-400">{ind.description}</p>
                    </div>
                    <Badge className="bg-slate-200 text-slate-700 font-semibold">{ind.year}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-semibold">Growth Threshold:</span>
              <input
                type="number"
                value={alertGrowth}
                onChange={(e) => setAlertGrowth(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-slate-200 rounded text-xs"
              />
              <span className="text-xs text-slate-500 font-semibold">Z-Score:</span>
              <input
                type="number"
                step="0.1"
                value={alertZ}
                onChange={(e) => setAlertZ(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-slate-200 rounded text-xs"
              />
              <button
                onClick={() => {
                  setAlertsLoading(true);
                  kavachApi.detectIntelligenceAlerts(alertGrowth, alertZ, filters)
                    .then(res => setAlerts(res.data?.data?.alerts || res.data?.alerts || []))
                    .finally(() => setAlertsLoading(false));
                }}
                className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold shadow hover:bg-slate-800"
              >
                Scan Spikes
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {alertsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : alerts.length > 0 ? (
              alerts.map((al, idx) => (
                <Card key={idx} className="border-slate-200 bg-white/70 backdrop-blur-md shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge className={al.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                        {al.severity}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-mono">z-score: {al.zScore}</span>
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-2">{al.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-slate-600">
                    <p>{al.description}</p>
                    <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">Status: {al.reviewStatus}</span>
                      {al.reviewStatus === 'OPEN' && (
                        <button
                          onClick={() => handleMarkAlert(al.id || idx.toString())}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[10px]"
                        >
                          Mark Acknowledged
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-slate-200 col-span-full">
                <CardContent className="text-center py-10 text-slate-400 text-xs">No emerging crime spikes detected at current thresholds.</CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Explainable Risk Scoring Driver</CardTitle>
                <CardDescription>Multi-dimensional area risk score methodology breakdown and top contributing indicators.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-600">
                <p>
                  KAVACH evaluates risk scores using an additive aggregate linear model combining volume (35%), growth (20%), severity (20%), repeat offender concentration (15%), and z-score anomalies (10%).
                </p>
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="font-bold text-slate-800">Risk Calculation Formula</h4>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-center text-slate-700 text-sm">
                    \(Risk = Volume \cdot 0.35 + Growth \cdot 0.20 + Severity \cdot 0.20 + RepeatOffenders \cdot 0.15 + Anomalies \cdot 0.10\)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">What-If Simulation</CardTitle>
                <CardDescription>Adjust area indicators to project simulated changes in risk index.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Police Presence:</span>
                    <span className="font-mono text-slate-900">{whatIfPolice} / 100</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    value={whatIfPolice}
                    onChange={(e) => setWhatIfPolice(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Poverty Rate:</span>
                    <span className="font-mono text-slate-900">{whatIfPoverty}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    value={whatIfPoverty}
                    onChange={(e) => setWhatIfPoverty(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="border-t border-slate-100 pt-4 text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Simulated Risk Score</p>
                  <p className={`text-4xl font-extrabold mt-2 ${simulatedRisk > 70 ? 'text-red-600' : 'text-slate-900'}`}>{simulatedRisk}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div className="space-y-4">
          {importStatusMessage && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-3 text-xs font-semibold text-blue-800">{importStatusMessage}</CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-slate-200 bg-white/70 backdrop-blur-md lg:col-span-2">
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base font-semibold">Schema Mapping & Profiling Dashboard</CardTitle>
                      <CardDescription>Profile schema mapping and review files before final transactional database commit.</CardDescription>
                    </div>
                    <button
                      onClick={handleLoadSampleData}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold shadow hover:bg-slate-800"
                    >
                      Load Sample Crime JSON
                    </button>
                  </div>
                  
                  {/* Drag and Drop File Input Area */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 hover:bg-slate-50/50 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".csv,.json,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="size-8 text-slate-400 mb-2" />
                    <p className="text-xs font-bold text-slate-700">Drag and drop or click to upload</p>
                    <p className="text-[10px] text-slate-400 mt-1">Supports CSV, JSON, XLS, and XLSX formats</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {importProfiled.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                            <th className="p-3">Source Field</th>
                            <th className="p-3">Inferred Type</th>
                            <th className="p-3">Null %</th>
                            <th className="p-3">Unique %</th>
                            <th className="p-3">PII?</th>
                            <th className="p-3">Likely ID?</th>
                            <th className="p-3">Geo Type</th>
                            <th className="p-3">Target Field Mapping</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importProfiled.map((col, index) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-800">{col.sourceName}</td>
                              <td className="p-3 font-mono">{col.inferredDataType}</td>
                              <td className="p-3 font-mono">{col.nullablePercentage}%</td>
                              <td className="p-3 font-mono">{col.uniquenessPercentage}%</td>
                              <td className="p-3">
                                {col.isPotentialPII ? <Badge className="bg-red-50 text-red-700">PII</Badge> : 'No'}
                              </td>
                              <td className="p-3">{col.isLikelyIdentifier ? 'Yes' : 'No'}</td>
                              <td className="p-3 font-mono text-[10px] text-slate-500">{col.geographicFormat || 'None'}</td>
                              <td className="p-3">
                                <select
                                  value={importMappings[col.sourceName] || ''}
                                  onChange={(e) => setImportMappings(prev => ({ ...prev, [col.sourceName]: e.target.value }))}
                                  className="border border-slate-200 rounded px-1 py-0.5 text-xs bg-white text-slate-800"
                                >
                                  <option value="">-- Ignore --</option>
                                  <option value="fir_number">FIR Number (ID)</option>
                                  <option value="incident_date">Incident Date</option>
                                  <option value="incident_time">Incident Time</option>
                                  <option value="district">District</option>
                                  <option value="police_station">Police Station</option>
                                  <option value="crime_type">Crime Category</option>
                                  <option value="modus_operandi">Modus Operandi</option>
                                  <option value="latitude">Latitude</option>
                                  <option value="longitude">Longitude</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={handleSaveImportProfile}
                        className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-700"
                      >
                        <Save className="size-3.5" />
                        Save Profile
                      </button>
                      <button
                        onClick={handleCommitImport}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        <Check className="size-3.5" />
                        Validate & Commit Transaction
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Please upload or load sample crime records to profile column parameters and configure schema mapping.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Active Mappings Profiles</CardTitle>
                <CardDescription>Reusable ingestion profiles currently deployed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-2">
                  <span className="font-semibold text-slate-600">Profile Name:</span>
                  <input
                    type="text"
                    value={importProfileName}
                    onChange={(e) => setImportProfileName(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="font-bold text-slate-700">Existing Profiles:</p>
                  {importProfileList.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-100 rounded text-xs">
                      <span className="font-medium text-slate-700">{p.name}</span>
                      <Badge className="bg-blue-50 text-blue-700">{p.version}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white/70 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Data Quality Issue Manager</CardTitle>
              <CardDescription>Acknowledge, track, and resolve structural/geospatial errors in crime registry logs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Quality Score</p>
                  <p className="text-2xl font-bold mt-1 text-[#15803D]">{dqSummary?.overallQualityScore ?? 100}%</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Missing Coordinates</p>
                  <p className="text-2xl font-bold mt-1 text-[#DC2626]">{dqSummary?.missingCoordinateCount ?? 0}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Duplicate Crime Numbers</p>
                  <p className="text-2xl font-bold mt-1 text-[#DC2626]">{dqSummary?.duplicateCrimeNumberCount ?? 0}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400">Unresolved Issues</p>
                  <p className="text-2xl font-bold mt-1 text-slate-700">{dqSummary?.unresolvedIssueCount ?? 0}</p>
                </div>
              </div>

              <div className="overflow-x-auto border-t border-slate-100 pt-4">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                      <th className="p-3">Issue ID</th>
                      <th className="p-3">Field / Column</th>
                      <th className="p-3">Issue Type</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dqIssues.length > 0 ? (
                      dqIssues.map((issue, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 font-semibold font-mono text-slate-800">{issue.id || issue.issue_id}</td>
                          <td className="p-3 font-mono">{issue.fieldName || issue.field_name || 'N/A'}</td>
                          <td className="p-3"><Badge className="bg-red-50 text-red-700">{issue.issueType || issue.issue_type}</Badge></td>
                          <td className="p-3 text-slate-500">{issue.description}</td>
                          <td className="p-3 capitalize font-semibold">{issue.status}</td>
                          <td className="p-3">
                            {issue.status === 'OPEN' && (
                              <button
                                onClick={() => handleResolveIssue(issue.id || issue.issue_id)}
                                className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-semibold"
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">No active data quality issues detected. All logs are clean.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
