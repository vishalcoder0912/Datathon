import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Phone, Car, FileText, ShieldAlert, GitBranch } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface OffenderDetail {
  offenderId: string;
  name: string;
  age: number;
  gender: string;
  incidentCount: number;
  districtCount: number;
  associateCount: number;
  firstIncidentDate: string;
  latestIncidentDate: string;
  crimeCategories: string[];
  commonModusOperandi: string[];
  phoneNumbers: string[];
  vehicles: string[];
  linkedFIRs: { firNumber: string; date: string; category: string; district: string }[];
  riskScore: number;
  riskFactors: { factor: string; score: number; evidence: string }[];
  network?: { nodes: { id: string; label: string; type: string }[]; edges: { source: string; target: string }[] };
}

export default function OffenderDetailPage() {
  const { offenderId } = useParams<{ offenderId: string }>();
  const [detail, setDetail] = useState<OffenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offenderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    kavachApi.getOffenderDetail(offenderId)
      .then((res) => { if (!cancelled) setDetail(res.data); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load offender details'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offenderId]);

  function maskName(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    return parts.map((p) => p[0] + '*'.repeat(p.length - 1)).join(' ');
  }

  function maskValue(val: string): string {
    if (!val) return '';
    if (val.length <= 4) return '****';
    return val.slice(0, 2) + '****' + val.slice(-2);
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link to="/offenders" className="inline-flex items-center gap-1 text-sm text-[#1D4ED8] hover:underline">
          <ArrowLeft className="size-4" /> Back to Offenders
        </Link>
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
      <Link to="/offenders" className="inline-flex items-center gap-1 text-sm text-[#1D4ED8] hover:underline">
        <ArrowLeft className="size-4" /> Back to Offenders
      </Link>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : detail ? (
        <>
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-[#DC2626]/10 text-[#DC2626]">
              <ShieldAlert className="size-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">{maskName(detail.name)}</h1>
              <p className="text-sm text-slate-500">Offender ID: {detail.offenderId}</p>
            </div>
            <div className="ml-auto">
              <Badge className={`text-sm ${detail.riskScore > 75 ? 'bg-[#DC2626]' : detail.riskScore > 50 ? 'bg-[#D97706]' : detail.riskScore > 25 ? 'bg-[#0891B2]' : 'bg-[#15803D]'}`}>
                Risk: {detail.riskScore}/100
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: 'Age', value: detail.age },
              { label: 'Gender', value: detail.gender },
              { label: 'Incidents', value: detail.incidentCount },
              { label: 'Districts', value: detail.districtCount },
              { label: 'Associates', value: detail.associateCount },
              { label: 'First Incident', value: detail.firstIncidentDate || 'N/A' },
              { label: 'Latest Incident', value: detail.latestIncidentDate || 'N/A' },
            ].map((stat) => (
              <Card key={stat.label} className="border-slate-200">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-lg font-bold text-[#0F172A]">{stat.value ?? 'N/A'}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Profile Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Crime Categories</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detail.crimeCategories?.length > 0
                      ? detail.crimeCategories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)
                      : <span className="text-sm text-slate-400">None</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Common Modus Operandi</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                    {detail.commonModusOperandi?.length > 0
                      ? detail.commonModusOperandi.map((mo) => <li key={mo}>{mo}</li>)
                      : <li className="list-none text-slate-400">N/A</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Associated Phones</p>
                  <div className="mt-1 space-y-1">
                    {detail.phoneNumbers?.length > 0
                      ? detail.phoneNumbers.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="size-3.5 text-[#7C3AED]" /> {maskValue(p)}
                          </div>
                        ))
                      : <span className="text-sm text-slate-400">None</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Associated Vehicles</p>
                  <div className="mt-1 space-y-1">
                    {detail.vehicles?.length > 0
                      ? detail.vehicles.map((v, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                            <Car className="size-3.5 text-[#0891B2]" /> {maskValue(v)}
                          </div>
                        ))
                      : <span className="text-sm text-slate-400">None</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Risk Factor Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {detail.riskFactors?.length > 0 ? detail.riskFactors.map((rf) => (
                  <div key={rf.factor} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#0F172A]">{rf.factor}</span>
                      <Badge className={rf.score > 7 ? 'bg-[#DC2626]' : rf.score > 4 ? 'bg-[#D97706]' : 'bg-[#0891B2]'}>
                        {rf.score}/10
                      </Badge>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-current transition-all" style={{ width: `${(rf.score / 10) * 100}%`, color: rf.score > 7 ? '#DC2626' : rf.score > 4 ? '#D97706' : '#0891B2' }} />
                    </div>
                    {rf.evidence && <p className="mt-1 text-xs text-slate-400">Evidence: {rf.evidence}</p>}
                  </div>
                )) : <p className="text-sm text-slate-400">No risk factors data</p>}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileText className="size-4" /> Linked FIRs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.linkedFIRs?.length > 0 ? (
                <div className="divide-y">
                  {detail.linkedFIRs.map((fir) => (
                    <div key={fir.firNumber} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <span className="font-mono text-xs font-medium text-[#1D4ED8]">{fir.firNumber}</span>
                        <span className="ml-3 text-slate-500">{fir.category}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{fir.district}</span>
                        <span>{fir.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <span className="text-sm text-slate-400">No linked FIRs</span>}
            </CardContent>
          </Card>

          {detail.network && detail.network.nodes?.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <GitBranch className="size-4" /> Network Visualization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <svg viewBox="0 0 400 300" className="w-full" style={{ maxHeight: 300 }}>
                  {detail.network.edges.map((edge, i) => (
                    <line key={i} x1={100} y1={100} x2={200} y2={200} stroke="#CBD5E1" strokeWidth={1} />
                  ))}
                  {detail.network.nodes.map((node, i) => (
                    <g key={node.id}>
                      <circle
                        cx={50 + i * 80} cy={100 + (i % 2) * 100}
                        r={6} fill={node.type === 'offender' ? '#DC2626' : '#1D4ED8'} />
                      <text x={50 + i * 80} y={100 + (i % 2) * 100 + 16} textAnchor="middle" fontSize="7" fill="#475569">
                        {node.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
