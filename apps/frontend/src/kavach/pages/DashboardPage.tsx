import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  AlertTriangle, Users, MapPin, Repeat, Bell, Shield,
  Clock, TrendingUp, TrendingDown,
} from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import GlobalFilters from '@/kavach/components/GlobalFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';

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
    <Card className="border-slate-200">
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">KAVACH Command Centre</h1>
        <p className="text-sm text-slate-500">Karnataka Crime Intelligence Command Centre — Real-time Overview</p>
      </div>
      <GlobalFilters />

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
            <StatCard title="Repeat Offenders" value={overview.repeatOffenders ?? 0} icon={Repeat} change={overview.periodChanges?.repeatOffenders} color="#7C3AED" />
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
            <Card className="border-slate-200">
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

            <Card className="border-slate-200 lg:col-span-2 xl:col-span-3">
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
            <Card className="border-slate-200">
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

            <Card className="border-slate-200">
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

            <Card className="border-slate-200">
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

      {!loading && !overview && (
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-slate-400">
            <Shield className="size-8" />
            <p className="text-sm">No data available. Load demo data to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
