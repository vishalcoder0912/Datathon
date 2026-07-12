import { useEffect, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { AlertTriangle, Info, BarChart3 } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';

const CORRELATION_COLORS = ['#15803D', '#0891B2', '#D97706', '#DC2626'];

function getCorrelationColor(val: number): string {
  const abs = Math.abs(val);
  if (abs < 0.25) return '#94A3B8';
  if (abs < 0.5) return '#0891B2';
  if (abs < 0.75) return '#D97706';
  return '#DC2626';
}

export default function SocialIntelligencePage() {
  const [correlationMatrix, setCorrelationMatrix] = useState<{ variable: string; correlations: Record<string, number> }[]>([]);
  const [rankedCorrelations, setRankedCorrelations] = useState<{ pair: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scatterData, setScatterData] = useState<Record<string, unknown>[]>([]);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      kavachApi.getCorrelationMatrix(),
      kavachApi.getRankedCorrelations(),
    ])
      .then(([matrixRes, rankedRes]) => {
        if (!cancelled) {
          setCorrelationMatrix(matrixRes.data?.matrix || matrixRes.data || []);
          setRankedCorrelations(rankedRes.data?.correlations || rankedRes.data || []);
        }
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load correlation data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const maxCorrValue = Math.max(...rankedCorrelations.map((c) => Math.abs(c.value)), 0.01);

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Social Intelligence</h1><p className="text-sm text-slate-500">Socioeconomic correlation analysis</p></div>
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
        <h1 className="text-xl font-bold text-[#0F172A]">Social Intelligence</h1>
        <p className="text-sm text-slate-500">Socioeconomic correlation analysis with crime patterns</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Statistical correlation indicates association and does not prove causation. Correlations may be influenced by confounding variables, data quality, and reporting biases.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Correlation Matrix</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : correlationMatrix.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-1.5 text-left text-slate-500" />
                      {correlationMatrix.map((row) => (
                        <th key={row.variable} className="p-1.5 text-center font-medium text-slate-700">
                          {row.variable.length > 8 ? row.variable.slice(0, 8) + '…' : row.variable}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlationMatrix.map((row) => (
                      <tr key={row.variable}>
                        <td className="p-1.5 text-left font-medium text-slate-700">
                          {row.variable.length > 8 ? row.variable.slice(0, 8) + '…' : row.variable}
                        </td>
                        {correlationMatrix.map((col) => {
                          const val = row.correlations[col.variable] ?? 0;
                          return (
                            <td
                              key={col.variable}
                              className="p-1.5 text-center font-mono"
                              style={{ backgroundColor: getCorrelationColor(val) + '30' }}
                            >
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <BarChart3 className="size-8" />
                <p className="text-sm">No correlation data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Ranked Correlations</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : rankedCorrelations.length > 0 ? (
              <div className="space-y-2">
                {rankedCorrelations
                  .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                  .slice(0, 15)
                  .map((corr) => (
                    <button
                      key={corr.pair}
                      onClick={() => setSelectedPair(corr.pair)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-2 text-left text-xs transition hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-[#0F172A]">{corr.pair}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(Math.abs(corr.value) / maxCorrValue) * 100}%`,
                              backgroundColor: getCorrelationColor(corr.value),
                            }}
                          />
                        </div>
                        <Badge
                          className="font-mono text-xs"
                          style={{
                            backgroundColor: corr.value > 0 ? '#15803D20' : '#DC262620',
                            color: corr.value > 0 ? '#15803D' : '#DC2626',
                          }}
                        >
                          {corr.value > 0 ? '+' : ''}{corr.value.toFixed(2)}
                        </Badge>
                      </div>
                    </button>
                  ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">No correlations</p>
            )}
          </CardContent>
        </Card>
      </div>

      {scatterData.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Scatter: {selectedPair}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis dataKey="y" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Scatter data={scatterData} fill="#1D4ED8" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
