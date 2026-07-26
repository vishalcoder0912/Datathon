import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { useImportData } from '@/kavach/context/ImportDataContext';
import GlobalFilters from '@/kavach/components/GlobalFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface DistrictRisk {
  district: string;
  riskScore: number;
  factors: { name: string; value: number; explanation?: string }[];
  confidence: number;
  incidents: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export default function RiskIntelligencePage() {
  const { filters } = useKavachFilters();
  const { refreshKey } = useImportData();
  const [risks, setRisks] = useState<DistrictRisk[]>([]);
  const [distribution, setDistribution] = useState<{ range: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState(false);

  // Auto-refresh when custom data is imported
  useEffect(() => { if (refreshKey > 0) { setRisks([]); setLoading(true); } }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      kavachApi.getDistrictRisks(filters),
      kavachApi.getRiskDistribution(),
    ])
      .then(([risksRes, distRes]) => {
        if (!cancelled) {
          const rawRisks = risksRes.data?.data || risksRes.data?.districts || risksRes.data || [];
          const processedRisks = (Array.isArray(rawRisks) ? rawRisks : []).map((item): DistrictRisk => {
            const risk = asRecord(item);
            const factors = Array.isArray(risk.factors) ? risk.factors.map((factor) => {
              const value = asRecord(factor);
              return {
                name: String(value.name ?? value.factorName ?? 'Unspecified factor'),
                value: Number(value.value ?? value.contribution ?? 0),
                explanation: typeof value.explanation === 'string' ? value.explanation : undefined,
              };
            }) : [];
            return {
              district: String(risk.district ?? risk.districtName ?? 'Unknown district'),
              riskScore: Number(risk.riskScore ?? risk.score ?? 0),
              confidence: risk.confidence !== undefined && risk.confidence !== null ? Math.round(Number(risk.confidence) * 100) : 0,
              incidents: Number(risk.incidents ?? risk.totalIncidents ?? 0),
              factors,
            };
          });
          setRisks(processedRisks);

          const rawDist = distRes.data?.data?.distribution || distRes.data?.distribution?.distribution || distRes.data?.distribution || {};
          const bandLabels: Record<string, string> = {
            VERY_LOW: 'Very Low',
            LOW: 'Low',
            MODERATE: 'Moderate',
            HIGH: 'High',
            VERY_HIGH: 'Very High',
            CRITICAL: 'Critical'
          };
          const processedDist = Object.entries(rawDist).map(([band, count]) => ({
            range: bandLabels[band] || band,
            count: count as number
          }));
          setDistribution(processedDist);
        }
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load risk data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const sortedRisks = [...risks].sort((a, b) => b.riskScore - a.riskScore);

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Risk Intelligence</h1><p className="text-sm text-slate-500">District-level risk assessment</p></div>
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
        <h1 className="text-xl font-bold text-[#0F172A]">Risk Intelligence</h1>
        <p className="text-sm text-slate-500">District-level risk assessment and scoring</p>
      </div>
      <GlobalFilters />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">District Risk Ranking</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-80 w-full" />
            ) : sortedRisks.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={sortedRisks} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="district" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="riskScore" radius={[0, 4, 4, 0]}>
                    {sortedRisks.map((entry, idx) => (
                      <Cell key={idx} fill={entry.riskScore > 75 ? '#DC2626' : entry.riskScore > 50 ? '#D97706' : entry.riskScore > 25 ? '#0891B2' : '#15803D'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <AlertTriangle className="size-8" />
                <p className="text-sm">No risk data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">No distribution data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {sortedRisks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedRisks.slice(0, 6).map((district) => (
            <Card key={district.district} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#0F172A]">{district.district}</h3>
                  <Badge className={district.riskScore > 75 ? 'bg-[#DC2626]' : district.riskScore > 50 ? 'bg-[#D97706]' : district.riskScore > 25 ? 'bg-[#0891B2]' : 'bg-[#15803D]'}>
                    {district.riskScore}/100
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span>Confidence: {district.confidence != null ? `${district.confidence}%` : 'N/A'}</span>
                  {district.confidence != null && district.confidence < 50 && (
                    <Badge variant="outline" className="text-[#D97706]">Insufficient Data</Badge>
                  )}
                </div>
                {district.factors && district.factors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {district.factors.map((f) => (
                      <div key={f.name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{f.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-[#1D4ED8]" style={{ width: `${f.value * 10}%` }} />
                          </div>
                          <span className="w-4 text-right font-medium text-[#0F172A]">{f.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-slate-200">
        <CardHeader>
          <button
            type="button"
            onClick={() => setShowFormula(!showFormula)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700"
          >
            {showFormula ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Risk Scoring Formula
          </button>
        </CardHeader>
        {showFormula && (
          <CardContent>
            <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <p><strong>Risk Score</strong> = weighted combination of:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Recent incident-trend increase (25%)</li>
                <li>Historical incident frequency (20%)</li>
                <li>Serious-offence concentration (15%)</li>
                <li>Night-time concentration and hotspot persistence (20%)</li>
                <li>Cross-district activity and historical multiple-case links (15%)</li>
                <li>Data-quality penalty (5%)</li>
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                Confidence is reduced when the scoped record count is low or when dates, locations, or legal sections are incomplete. The score applies only to an aggregate geography and time window.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>This is geographic decision support, not a person score, guilt assessment, arrest recommendation, or prediction of future conduct. Human review is required.</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
