import { useCallback, useEffect, useState } from 'react';
import { Bell, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Clock, Plus, Settings, MessageSquare } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  district: string;
  detectionTime: string;
  reviewed: boolean;
  evidence: string[];
}

function formatType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeEvidence(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${formatType(key)}: ${typeof item === "string" ? item : JSON.stringify(item)}`);
  }
  return [];
}

function normalizeAlerts(payload: unknown): Alert[] {
  const unwrapped = (payload as {data?: unknown})?.data ?? payload;
  const rows = Array.isArray(unwrapped) ? unwrapped : (unwrapped as {data?: unknown[]})?.data ?? [];
  return rows.map((row) => {
    const source = row as Record<string, unknown>;
    const detectedAt = String(source.detectedAt ?? source.detectionTime ?? "");
    return {
      id: String(source.id ?? source.alertId ?? ""),
      type: String(source.type ?? "INTELLIGENCE_ALERT"),
      title: String(source.title ?? "KAVACH intelligence alert"),
      message: String(source.message ?? source.description ?? "Evidence requires human review."),
      severity: String(source.severity ?? "medium"),
      district: String(source.district ?? (source.districtId ? `District ${source.districtId}` : "Scoped area")),
      detectionTime: detectedAt ? new Date(detectedAt).toLocaleString() : "Not recorded",
      reviewed: Boolean(source.reviewed ?? source.reviewedAt),
      evidence: normalizeEvidence(source.evidence),
    };
  });
}

const severityColors: Record<string, string> = {
  critical: 'bg-[#DC2626] text-white',
  high: 'bg-[#D97706] text-white',
  medium: 'bg-[#0891B2] text-white',
  low: 'bg-[#15803D] text-white',
};

const typeColors: Record<string, string> = {
  CRIME_SPIKE: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20',
  ANOMALY: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20',
  INVESTIGATION_DELAY: 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20',
  NETWORK_ASSOCIATION: 'bg-[#0891B2]/10 text-[#0891B2] border-[#0891B2]/20',
};

export default function AlertsPage() {
  const { filters } = useKavachFilters();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [reviewedFilter, setReviewedFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Rule Builder States
  const [ruleName, setRuleName] = useState("Spike in Chain Snatching");
  const [ruleCrimeType, setRuleCrimeType] = useState("Robbery");
  const [ruleRadius, setRuleRadius] = useState("500m");
  const [ruleTemporal, setRuleTemporal] = useState("24h");
  const [ruleThreshold, setRuleThreshold] = useState("3");
  const [webhookUrl, setWebhookUrl] = useState("KSP Officer WhatsApp Group");
  const [activeRules, setActiveRules] = useState<any[]>([]);

  // WhatsApp Dispatch logs feed
  const [whatsappLogs, setWhatsappLogs] = useState<string[]>([
    "[Rule: Spike in Chain Snatching] ➔ Dispatched to KSP Officers: 'WARNING: 3 robberies clustered within 500m in Jayanagar within 24h. Dispatching patrol unit.'",
    "[ANPR Camera Rule] ➔ Dispatched to Beat Unit 4: 'Suspect vehicle KA-03-MM-7821 logged at toll checkpost. Focus search in sector 1.'"
  ]);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    setError(null);
    const apiFilters: Record<string, unknown> = { ...filters };
    if (typeFilter && typeFilter !== 'all') apiFilters.type = typeFilter;
    if (severityFilter && severityFilter !== 'all') apiFilters.severity = severityFilter;
    if (reviewedFilter && reviewedFilter !== 'all') apiFilters.reviewed = reviewedFilter;
    
    Promise.all([
      kavachApi.getAlerts(apiFilters),
      kavachApi.getAlertRules()
    ])
      .then(([alertsRes, rulesRes]) => {
        setAlerts(normalizeAlerts(alertsRes.data));
        setActiveRules(rulesRes.data?.data || []);
      })
      .catch((err) => setError(err?.message || 'Failed to load alerts'))
      .finally(() => setLoading(false));
  }, [filters, typeFilter, severityFilter, reviewedFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkReviewed = async (id: string) => {
    try {
      await kavachApi.markAlertReviewed(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, reviewed: true } : a));
    } catch { /* ignore */ }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Rule creation handler
  const handleCreateRule = async () => {
    if (!ruleName) return;
    const ruleObj = {
      name: ruleName,
      crimeType: ruleCrimeType,
      radius: ruleRadius,
      temporalWindow: ruleTemporal,
      threshold: Number(ruleThreshold),
      webhook: webhookUrl
    };
    try {
      const res = await kavachApi.saveAlertRule(ruleObj);
      setActiveRules(prev => [...prev, res.data?.data || ruleObj]);
      
      // Update simulated logs
      setWhatsappLogs(prev => [
        `[Rule Created: ${ruleName}] ➔ Hook active for ${webhookUrl}`,
        ...prev
      ]);
    } catch {
      setActiveRules(prev => [...prev, ruleObj]);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Alerts</h1>
          <p className="text-sm text-slate-500">Intelligence alerts and notifications</p>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center gap-3 p-10">
            <AlertTriangle className="size-8 text-[#DC2626]" />
            <p className="text-sm font-medium text-[#DC2626]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unreadCount = alerts.filter((a) => !a.reviewed).length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#DC2626] to-[#D97706]">
              <Bell className="size-4 text-white animate-ring" />
            </div>
            Real-Time Alert Engine
          </h1>
          <p className="text-sm text-slate-500">Establish clustering rules to automate active dispatch alerts across stations.</p>
        </div>
        <Badge className={`px-3 py-1 text-sm font-semibold ${unreadCount > 0 ? 'bg-[#DC2626]' : 'bg-[#15803D]'}`}>
          {unreadCount} Unread Alerts
        </Badge>
      </div>

      {/* Main Grid: Left Filters & Alerts, Right Rule Builder & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Alerts List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Types</option>
              <option value="CRIME_SPIKE">Crime spike</option>
              <option value="ANOMALY">Anomaly</option>
              <option value="INVESTIGATION_DELAY">Investigation delay</option>
              <option value="NETWORK_ASSOCIATION">Network association</option>
            </select>
            
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={reviewedFilter}
              onChange={(e) => setReviewedFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Status</option>
              <option value="false">Unreviewed</option>
              <option value="true">Reviewed</option>
            </select>

            <Button variant="outline" size="sm" onClick={fetchAlerts} className="h-8 text-xs ml-auto border-slate-200 text-slate-600 hover:bg-slate-50">
              Refresh Feed
            </Button>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-slate-200">
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : alerts.length > 0 ? (
              alerts.map((alert) => (
                <Card key={alert.id} className={`border-slate-200 shadow-sm transition hover:shadow-md ${!alert.reviewed ? 'ring-1 ring-[#DC2626]/20' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button onClick={() => toggleExpand(alert.id)} className="mt-1 shrink-0 text-slate-400">
                          {expandedIds.has(alert.id) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={`border text-[9px] ${typeColors[alert.type] || 'bg-slate-100 text-slate-600'}`}>
                              {formatType(alert.type)}
                            </Badge>
                            <Badge className={`text-[9px] ${severityColors[alert.severity?.toLowerCase()] || ''}`}>
                              {alert.severity}
                            </Badge>
                            {!alert.reviewed && <span className="size-2 rounded-full bg-[#DC2626]" />}
                          </div>
                          <h3 className="mt-1.5 font-bold text-sm text-[#0F172A]">{alert.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{alert.message}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="size-3" />
                          {alert.detectionTime}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{alert.district}</Badge>
                        {!alert.reviewed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkReviewed(alert.id)}
                            className="h-7 gap-1 text-xs text-[#15803D] hover:bg-green-50"
                          >
                            <CheckCircle className="size-3" /> Mark Reviewed
                          </Button>
                        )}
                      </div>
                    </div>
                    {expandedIds.has(alert.id) && (
                      <div className="ml-7 mt-3 border-t border-slate-100 pt-3">
                        {alert.evidence && alert.evidence.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidence References</p>
                            <ul className="list-inside list-disc text-xs text-slate-600">
                              {alert.evidence.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="flex flex-col items-center gap-3 py-16 text-slate-400 text-center">
                  <Bell className="size-10 text-slate-300" />
                  <p className="text-xs font-semibold">No active intelligence alerts match your filters.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column: Rule Builder & WhatsApp dispatcher feed */}
        <div className="space-y-4">
          
          {/* Rule Builder */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Settings className="size-4 text-[#1D4ED8]" /> Alert Rule Builder
              </CardTitle>
              <CardDescription className="text-[11px]">Define trigger boundaries for geospatial clustering alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rule Name</label>
                <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Spike in Chain Snatching" className="h-8 text-xs focus:ring-[#1D4ED8]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Crime Type</label>
                  <Input value={ruleCrimeType} onChange={(e) => setRuleCrimeType(e.target.value)} placeholder="Robbery" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Radius Limit</label>
                  <select value={ruleRadius} onChange={(e) => setRuleRadius(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                    <option value="100m">100 meters</option>
                    <option value="500m">500 meters</option>
                    <option value="1km">1 kilometer</option>
                    <option value="2km">2 kilometers</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time Window</label>
                  <select value={ruleTemporal} onChange={(e) => setRuleTemporal(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                    <option value="12h">12 Hours</option>
                    <option value="24h">24 Hours</option>
                    <option value="3d">3 Days</option>
                    <option value="7d">7 Days</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Min Cases</label>
                  <Input type="number" value={ruleThreshold} onChange={(e) => setRuleThreshold(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dispatch Target</label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="Officer Whatsapp Webhook" className="h-8 text-xs focus:ring-[#1D4ED8]" />
              </div>

              <Button onClick={handleCreateRule} className="w-full h-8 text-xs bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] text-white flex items-center justify-center gap-1">
                <Plus className="size-3.5" /> Save & Activate Rule
              </Button>

              {/* Active Rules List */}
              {activeRules.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Rules ({activeRules.length})</p>
                  {activeRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs border border-slate-100">
                      <span className="font-semibold text-slate-800">{rule.name}</span>
                      <Badge className="text-[9px] bg-green-100 text-[#15803D] hover:bg-green-100">ACTIVE</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Whatsapp Dispatcher Log Feed */}
          <Card className="border-slate-200 bg-[#0F172A] text-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-white/10 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                <MessageSquare className="size-4 text-emerald-400" /> WhatsApp Dispatcher Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 font-mono text-[9px] leading-5 space-y-2 h-44 overflow-y-auto">
              {whatsappLogs.map((log, idx) => (
                <div key={idx} className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-slate-400">{log}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
