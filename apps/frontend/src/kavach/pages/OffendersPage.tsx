import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Search, AlertTriangle, Users} from "lucide-react";
import {kavachApi} from "@/kavach/api/kavachApi";
import {useKavachFilters} from "@/kavach/context/FilterContext";
import {Card, CardContent} from "@/shared/components/ui/card";
import {Badge} from "@/shared/components/ui/badge";
import {Input} from "@/shared/components/ui/input";
import {Skeleton} from "@/shared/components/ui/skeleton";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/shared/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/shared/components/ui/table";

interface PersonLinkSummary {
  offenderId: string;
  maskedName: string;
  caseCount: number;
  districtCount: number;
  stationCount: number;
  associateCount: number;
  linkComplexityScore: number;
  linkLabels: string[];
  recentActivity: string;
}

const labelColors: Record<string, string> = {
  MULTIPLE_CASE_LINKS: "bg-[#1D4ED8]",
  CROSS_DISTRICT_LINKS: "bg-[#7C3AED]",
  RECURRING_MO: "bg-[#D97706]",
  HIGH_NETWORK_CENTRALITY: "bg-[#0891B2]",
};

function maskName(name: string) {
  if (!name) return "Restricted";
  return name.split(" ").map((part) => `${part.slice(0, 1)}${"*".repeat(Math.max(1, part.length - 1))}`).join(" ");
}

export default function OffendersPage() {
  const navigate = useNavigate();
  const {filters} = useKavachFilters();
  const [profiles, setProfiles] = useState<PersonLinkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState("all");
  const [repeatFilter, setRepeatFilter] = useState("true");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const apiFilters: Record<string, unknown> = {...filters, repeatOffender: repeatFilter};
    if (labelFilter !== "all") apiFilters.linkLabel = labelFilter;
    kavachApi.getOffenders(apiFilters)
      .then((response) => {
        if (cancelled) return;
        const rawProfiles = response.data?.data ?? response.data?.offenders ?? response.data ?? [];
        setProfiles(rawProfiles.map((profile: Record<string, unknown>) => ({
          offenderId: String(profile.offenderId ?? profile.personId ?? ""),
          maskedName: String(profile.maskedName ?? profile.name ?? "Restricted"),
          caseCount: Number(profile.caseCount ?? profile.incidentCount ?? 0),
          districtCount: Number(profile.districtCount ?? 0),
          stationCount: Number(profile.stationCount ?? 0),
          associateCount: Number(profile.associateCount ?? profile.coAccusedCount ?? 0),
          linkComplexityScore: Number(profile.linkComplexityScore ?? 0),
          linkLabels: Array.isArray(profile.linkLabels) ? profile.linkLabels.map(String) : [String(profile.linkLabel ?? "MULTIPLE_CASE_LINKS")],
          recentActivity: String(profile.latestKnownCaseDate ?? profile.recentActivity ?? "Not available"),
        })));
      })
      .catch(() => { if (!cancelled) setError("Unable to load masked person-link profiles."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, labelFilter, repeatFilter]);

  const filteredProfiles = profiles.filter((profile) => !search || profile.maskedName.toLowerCase().includes(search.toLowerCase()) || profile.offenderId.toLowerCase().includes(search.toLowerCase()));

  if (error) return <div className="space-y-6"><div><h1 className="text-xl font-bold text-[#0F172A]">Person Link Intelligence</h1><p className="text-sm text-slate-500">Historical case links requiring human review</p></div><Card className="border-red-200 bg-red-50"><CardContent className="flex items-center gap-3 p-8 text-sm text-[#DC2626]"><AlertTriangle className="size-5" />{error}</CardContent></Card></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-[#0F172A]">Person Link Intelligence</h1><p className="text-sm text-slate-500">Canonical people linked as accused in multiple synthetic cases. This is not a guilt assessment or prediction.</p></div>
      <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search masked name or profile ID…" className="h-9 pl-9 text-sm" /></div><Select value={labelFilter} onValueChange={setLabelFilter}><SelectTrigger className="h-9 w-[190px] text-xs"><SelectValue placeholder="Link indicator" /></SelectTrigger><SelectContent><SelectItem value="all">All link indicators</SelectItem>{Object.keys(labelColors).map((label) => <SelectItem key={label} value={label}>{label.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select><Select value={repeatFilter} onValueChange={setRepeatFilter}><SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Multiple case links</SelectItem><SelectItem value="all">All people</SelectItem></SelectContent></Select><span className="text-xs text-slate-400">{filteredProfiles.length} profiles</span></div>
      <Card className="border-slate-200"><CardContent className="p-0">{loading ? <div className="space-y-3 p-5">{Array.from({length: 8}).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : filteredProfiles.length > 0 ? <Table><TableHeader><TableRow><TableHead>Profile ID</TableHead><TableHead>Masked person</TableHead><TableHead>Case links</TableHead><TableHead>District links</TableHead><TableHead>Station links</TableHead><TableHead>Co-accused links</TableHead><TableHead>Link complexity</TableHead><TableHead>Historical indicators</TableHead><TableHead>Latest known case</TableHead></TableRow></TableHeader><TableBody>{filteredProfiles.map((profile) => <TableRow key={profile.offenderId} onClick={() => navigate(`/offenders/${profile.offenderId}`)} className="cursor-pointer"><TableCell className="font-mono text-xs">{profile.offenderId}</TableCell><TableCell className="font-medium">{maskName(profile.maskedName)}</TableCell><TableCell>{profile.caseCount}</TableCell><TableCell>{profile.districtCount}</TableCell><TableCell>{profile.stationCount}</TableCell><TableCell>{profile.associateCount}</TableCell><TableCell>{profile.linkComplexityScore}</TableCell><TableCell><div className="flex flex-wrap gap-1">{profile.linkLabels.map((label) => <Badge key={label} className={labelColors[label] ?? "bg-slate-500"}>{label.replaceAll("_", " ")}</Badge>)}</div></TableCell><TableCell className="text-xs text-slate-500">{profile.recentActivity}</TableCell></TableRow>)}</TableBody></Table> : <div className="flex flex-col items-center gap-3 py-10 text-slate-400"><Users className="size-8" /><p className="text-sm">No person links match the current scope.</p></div>}</CardContent></Card>
    </div>
  );
}
