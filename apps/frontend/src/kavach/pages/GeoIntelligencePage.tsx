import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MapPin, AlertTriangle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import GlobalFilters from '@/kavach/components/GlobalFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';

const KARNATAKA_DISTRICTS: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  'Belagavi': { x: 20, y: 20, w: 80, h: 50, label: 'Belagavi' },
  'Bagalkote': { x: 35, y: 45, w: 60, h: 35, label: 'Bagalkote' },
  'Vijayapura': { x: 55, y: 30, w: 60, h: 35, label: 'Vijayapura' },
  'Dharwad': { x: 30, y: 65, w: 50, h: 30, label: 'Dharwad' },
  'Hubli-Dharwad': { x: 30, y: 65, w: 50, h: 30, label: 'Hubli' },
  'Gadag': { x: 45, y: 75, w: 45, h: 25, label: 'Gadag' },
  'Haveri': { x: 30, y: 90, w: 50, h: 30, label: 'Haveri' },
  'Uttara Kannada': { x: 10, y: 80, w: 55, h: 50, label: 'Uttara Kannada' },
  'Dakshina Kannada': { x: 15, y: 175, w: 50, h: 40, label: 'D.Kannada' },
  'Udupi': { x: 25, y: 155, w: 45, h: 30, label: 'Udupi' },
  'Shivamogga': { x: 35, y: 115, w: 55, h: 35, label: 'Shivamogga' },
  'Chitradurga': { x: 55, y: 105, w: 55, h: 30, label: 'Chitradurga' },
  'Davangere': { x: 50, y: 90, w: 50, h: 30, label: 'Davangere' },
  'Ballari': { x: 70, y: 85, w: 55, h: 35, label: 'Ballari' },
  'Koppal': { x: 60, y: 65, w: 45, h: 28, label: 'Koppal' },
  'Raichur': { x: 75, y: 50, w: 55, h: 35, label: 'Raichur' },
  'Yadgir': { x: 85, y: 45, w: 45, h: 28, label: 'Yadgir' },
  'Kalaburagi': { x: 80, y: 25, w: 60, h: 35, label: 'Kalaburagi' },
  'Bidar': { x: 90, y: 10, w: 50, h: 30, label: 'Bidar' },
  'Tumakuru': { x: 45, y: 150, w: 55, h: 30, label: 'Tumakuru' },
  'Hassan': { x: 30, y: 170, w: 50, h: 30, label: 'Hassan' },
  'Kodagu': { x: 15, y: 200, w: 40, h: 28, label: 'Kodagu' },
  'Mysuru': { x: 35, y: 200, w: 55, h: 35, label: 'Mysuru' },
  'Chamarajanagara': { x: 45, y: 215, w: 50, h: 28, label: 'Chamarajanagara' },
  'Mandya': { x: 50, y: 180, w: 45, h: 25, label: 'Mandya' },
  'Ramanagara': { x: 55, y: 165, w: 45, h: 25, label: 'Ramanagara' },
  'Bengaluru Urban': { x: 60, y: 170, w: 55, h: 30, label: 'Bengaluru U' },
  'Bengaluru Rural': { x: 65, y: 155, w: 45, h: 25, label: 'Bengaluru R' },
  'Kolar': { x: 75, y: 160, w: 45, h: 28, label: 'Kolar' },
  'Chikkaballapur': { x: 70, y: 140, w: 50, h: 28, label: 'Chikkaballapur' },
  'Kolar Gold Fields': { x: 82, y: 165, w: 40, h: 22, label: 'KGF' },
};

const RISK_COLORS = ['#15803D', '#0891B2', '#D97706', '#DC2626'];

function getDistrictColor(incidents: number, maxInc: number): string {
  if (!incidents || maxInc === 0) return '#E2E8F0';
  const ratio = incidents / maxInc;
  if (ratio < 0.25) return '#15803D';
  if (ratio < 0.5) return '#0891B2';
  if (ratio < 0.75) return '#D97706';
  return '#DC2626';
}

interface DistrictData {
  district: string;
  incidents: number;
  riskScore?: number;
  hotspots?: number;
  growth?: number;
}

export default function GeoIntelligencePage() {
  const { filters } = useKavachFilters();
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [districtDetail, setDistrictDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    kavachApi.getDistricts(filters)
      .then((res) => { if (!cancelled) setDistricts(res.data?.data || res.data?.districts || res.data || []); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load district data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    if (!selectedDistrict) { setDistrictDetail(null); return; }
    let cancelled = false;
    kavachApi.getDistrict(selectedDistrict, filters)
      .then((res) => { if (!cancelled) setDistrictDetail(res.data?.data || res.data); })
      .catch(() => { if (!cancelled) setDistrictDetail(null); });
    return () => { cancelled = true; };
  }, [selectedDistrict, filters]);

  const maxInc = useMemo(() => Math.max(...districts.map((d) => d.totalIncidents || 0), 1), [districts]);

  const sortedDistricts = useMemo(() => [...districts].sort((a, b) => b.totalIncidents - a.totalIncidents), [districts]);

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Geo Intelligence</h1><p className="text-sm text-slate-500">Spatial crime analysis across Karnataka districts</p></div>
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
        <h1 className="text-xl font-bold text-[#0F172A]">Geo Intelligence</h1>
        <p className="text-sm text-slate-500">Spatial crime analysis across Karnataka districts</p>
      </div>
      <GlobalFilters />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin className="size-4" />
              District Crime Map — Karnataka
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : (
              <div className="relative overflow-x-auto">
                <svg viewBox="0 0 500 250" className="min-w-[500px] w-full animate-fade-in" role="img" aria-label="Karnataka district crime map">
                  {Object.entries(KARNATAKA_DISTRICTS).map(([name, geo]) => {
                    const d = districts.find((dd) => dd.district === name || dd.district.toLowerCase() === name.toLowerCase());
                    const inc = d?.totalIncidents || 0;
                    const mapX = geo.x * 4.2;
                    const mapY = geo.y * 0.9 + 10;
                    const mapW = 34;
                    const mapH = 20;
                    return (
                      <g key={name} onClick={() => setSelectedDistrict(name)} className="transition-transform duration-200 hover:scale-105" style={{ cursor: 'pointer' }}>
                        <rect
                          x={mapX} y={mapY} width={mapW} height={mapH} rx={4}
                          fill={getDistrictColor(inc, maxInc)}
                          stroke={selectedDistrict === name ? '#0F172A' : '#CBD5E1'}
                          strokeWidth={selectedDistrict === name ? 1.5 : 0.5}
                          className="transition-colors duration-200"
                        />
                        <text
                          x={mapX + mapW / 2} y={mapY + 8}
                          textAnchor="middle" fontSize="5.5" fill="#fff" fontWeight="bold"
                          style={{ pointerEvents: 'none' }}
                        >
                          {geo.label}
                        </text>
                        <text
                          x={mapX + mapW / 2} y={mapY + 16}
                          textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.9)" fontWeight="black"
                          style={{ pointerEvents: 'none' }}
                        >
                          {inc}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="size-3 rounded bg-[#15803D]" /> Low</span>
                  <span className="flex items-center gap-1"><span className="size-3 rounded bg-[#0891B2]" /> Medium</span>
                  <span className="flex items-center gap-1"><span className="size-3 rounded bg-[#D97706]" /> High</span>
                  <span className="flex items-center gap-1"><span className="size-3 rounded bg-[#DC2626]" /> Critical</span>
                  <span className="flex items-center gap-1"><span className="size-3 rounded bg-[#E2E8F0]" /> No Data</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">
              {selectedDistrict ? `${selectedDistrict} Intelligence` : 'District Intelligence'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDistrict ? (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <Info className="size-8" />
                <p className="text-sm">Click a district on the map</p>
              </div>
            ) : loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#0F172A]">{selectedDistrict}</h3>
                {districtDetail ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-500">Total Incidents</span>
                      <span className="font-bold">{(districtDetail as any).totalIncidents ?? 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-500">Active Stations</span>
                      <span className="font-bold">{Object.keys((districtDetail as any).stationCounts || {}).length}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-500">Average Severity</span>
                      <span className="font-bold">{(districtDetail as any).avgSeverity ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-500">Active Cases</span>
                      <span className="font-bold">{(districtDetail as any).activeCases ?? 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-500">Closed Cases</span>
                      <span className="font-bold">{(districtDetail as any).closedCases ?? 0}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-500">Top Crime Category</span>
                      <span className="font-bold">{(districtDetail as any).topCategory ?? 'N/A'}</span>
                    </div>
                    { (districtDetail as any).indicators && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Socioeconomic Indicators</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded">
                            <div className="text-slate-500">Population</div>
                            <div className="font-bold text-slate-800">{(((districtDetail as any).indicators.population || 0) / 1000000).toFixed(2)}M</div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <div className="text-slate-500">Literacy Rate</div>
                            <div className="font-bold text-slate-800">{((districtDetail as any).indicators.literacyRate || 0).toFixed(1)}%</div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <div className="text-slate-500">Unemployment</div>
                            <div className="font-bold text-slate-800">{((districtDetail as any).indicators.unemploymentRate || 0).toFixed(1)}%</div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded">
                            <div className="text-slate-500">Poverty Rate</div>
                            <div className="font-bold text-slate-800">{((districtDetail as any).indicators.povertyRate || 0).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No detailed data available</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">District Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : sortedDistricts.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={sortedDistricts} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="district" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="totalIncidents" name="Total Incidents" fill="#1D4ED8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <MapPin className="size-8" />
              <p className="text-sm">No district data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
