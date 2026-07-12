import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Users } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';

interface Offender {
  offenderId: string;
  name: string;
  age: number;
  gender: string;
  incidentCount: number;
  districtCount: number;
  associateCount: number;
  riskBand: string;
  recentActivity: string;
}

const riskBandColors: Record<string, string> = {
  critical: 'bg-[#DC2626] text-white',
  high: 'bg-[#D97706] text-white',
  medium: 'bg-[#0891B2] text-white',
  low: 'bg-[#15803D] text-white',
};

function maskName(name: string): string {
  if (!name) return '';
  const parts = name.split(' ');
  return parts.map((p) => p[0] + '*'.repeat(p.length - 1)).join(' ');
}

export default function OffendersPage() {
  const navigate = useNavigate();
  const { filters } = useKavachFilters();
  const [offenders, setOffenders] = useState<Offender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [repeatFilter, setRepeatFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const apiFilters: Record<string, unknown> = { ...filters };
    if (riskFilter) apiFilters.riskBand = riskFilter;
    if (repeatFilter) apiFilters.repeatOffender = repeatFilter;
    kavachApi.getOffenders(apiFilters)
      .then((res) => { if (!cancelled) setOffenders(res.data?.offenders || res.data || []); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load offenders'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, riskFilter, repeatFilter]);

  const filtered = offenders.filter((o) => {
    if (search && !o.name.toLowerCase().includes(search.toLowerCase()) && !o.offenderId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Offenders</h1><p className="text-sm text-slate-500">Criminal profiles and tracking</p></div>
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
        <h1 className="text-xl font-bold text-[#0F172A]">Offenders</h1>
        <p className="text-sm text-slate-500">Criminal profiles and tracking</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="Risk Band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Risks</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={repeatFilter} onValueChange={setRepeatFilter}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Repeat Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="true">Repeat Offender</SelectItem>
            <SelectItem value="false">First-time</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">{filtered.length} offenders</span>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Incidents</TableHead>
                  <TableHead>Districts</TableHead>
                  <TableHead>Associates</TableHead>
                  <TableHead>Risk Band</TableHead>
                  <TableHead>Recent Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((offender) => (
                  <TableRow
                    key={offender.offenderId}
                    onClick={() => navigate(`/offenders/${offender.offenderId}`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs">{offender.offenderId}</TableCell>
                    <TableCell className="font-medium">{maskName(offender.name)}</TableCell>
                    <TableCell>{offender.age ?? 'N/A'}</TableCell>
                    <TableCell>{offender.gender}</TableCell>
                    <TableCell>{offender.incidentCount}</TableCell>
                    <TableCell>{offender.districtCount}</TableCell>
                    <TableCell>{offender.associateCount}</TableCell>
                    <TableCell>
                      <Badge className={riskBandColors[offender.riskBand?.toLowerCase()] || ''}>
                        {offender.riskBand || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{offender.recentActivity || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
              <Users className="size-8" />
              <p className="text-sm">No offenders found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
