import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
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

  const fetchAlerts = () => {
    setLoading(true);
    setError(null);
    const apiFilters: Record<string, unknown> = { ...filters };
    if (typeFilter && typeFilter !== 'all') apiFilters.type = typeFilter;
    if (severityFilter && severityFilter !== 'all') apiFilters.severity = severityFilter;
    if (reviewedFilter && reviewedFilter !== 'all') apiFilters.reviewed = reviewedFilter;
    kavachApi.getAlerts(apiFilters)
      .then((res) => setAlerts(normalizeAlerts(res.data)))
      .catch((err) => setError(err?.message || 'Failed to load alerts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(); }, [filters, typeFilter, severityFilter, reviewedFilter]);

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

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Alerts</h1><p className="text-sm text-slate-500">Intelligence alerts and notifications</p></div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Alerts</h1>
          <p className="text-sm text-slate-500">Intelligence alerts and notifications</p>
        </div>
        <Badge className={`px-3 py-1 text-sm ${unreadCount > 0 ? 'bg-[#DC2626]' : 'bg-[#15803D]'}`}>
          {unreadCount} Unread
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="CRIME_SPIKE">Crime spike</SelectItem>
            <SelectItem value="ANOMALY">Anomaly</SelectItem>
            <SelectItem value="INVESTIGATION_DELAY">Investigation delay</SelectItem>
            <SelectItem value="NETWORK_ASSOCIATION">Network association</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="false">Unreviewed</SelectItem>
            <SelectItem value="true">Reviewed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchAlerts} className="h-9 text-xs">Refresh</Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-slate-200"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : alerts.length > 0 ? alerts.map((alert) => (
          <Card key={alert.id} className={`border-slate-200 transition ${!alert.reviewed ? 'ring-1 ring-[#1D4ED8]/20' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button onClick={() => toggleExpand(alert.id)} className="mt-1 shrink-0 text-slate-400">
                    {expandedIds.has(alert.id) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`border ${typeColors[alert.type] || 'bg-slate-100 text-slate-600'}`}>
                        {formatType(alert.type)}
                      </Badge>
                      <Badge className={severityColors[alert.severity?.toLowerCase()] || ''}>
                        {alert.severity}
                      </Badge>
                      {!alert.reviewed && <span className="size-2 rounded-full bg-[#1D4ED8]" />}
                    </div>
                    <h3 className="mt-1 font-bold text-[#0F172A]">{alert.title}</h3>
                    <p className="text-sm text-slate-500">{alert.message}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="size-3" />
                    {alert.detectionTime}
                  </div>
                  <Badge variant="secondary" className="text-xs">{alert.district}</Badge>
                  {!alert.reviewed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkReviewed(alert.id)}
                      className="h-7 gap-1 text-xs text-[#15803D]"
                    >
                      <CheckCircle className="size-3" /> Mark Reviewed
                    </Button>
                  )}
                </div>
              </div>
              {expandedIds.has(alert.id) && (
                <div className="ml-8 mt-3 border-t border-slate-100 pt-3">
                  {alert.evidence && alert.evidence.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Evidence References</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-slate-400">
                        {alert.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )) : (
          <Card className="border-slate-200">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <Bell className="size-8" />
              <p className="text-sm">No alerts match your filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
