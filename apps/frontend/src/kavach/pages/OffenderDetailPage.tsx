import {useEffect, useState} from "react";
import {useParams, Link, useNavigate} from "react-router-dom";
import {ArrowLeft, AlertTriangle, FileText, GitBranch, ShieldAlert, Info, Search} from "lucide-react";
import {kavachApi} from "@/kavach/api/kavachApi";
import {Card, CardContent, CardHeader, CardTitle} from "@/shared/components/ui/card";
import {Badge} from "@/shared/components/ui/badge";
import {Button} from "@/shared/components/ui/button";
import {Skeleton} from "@/shared/components/ui/skeleton";

interface LinkedCase {
  crimeNo: string;
  date: string;
  category: string;
  district: string;
}

interface SimilarCase extends LinkedCase {
  similarityScore: number;
  matchedFeatures: string[];
  evidence: string[];
}

interface PersonLinkDetail {
  personId: string;
  maskedName: string;
  caseCount: number;
  districtCount: number;
  stationCount: number;
  coAccusedCount: number;
  linkComplexityScore: number;
  firstKnownCase: string;
  latestKnownCase: string;
  crimeCategories: string[];
  modusOperandi: string[];
  linkLabels: string[];
  linkedCases: LinkedCase[];
  network?: {nodes: Array<{id: string; label: string; type: string}>; edges: Array<{source: string; target: string}>};
}

function unwrap<T>(payload: unknown): T {
  const candidate = payload as {data?: T};
  return candidate.data ?? (payload as T);
}

function maskName(name: string) {
  return name.split(" ").filter(Boolean).map((part) => `${part.slice(0, 1)}${"*".repeat(Math.max(1, part.length - 1))}`).join(" ") || "Restricted";
}

function mapDetail(raw: Record<string, unknown>): PersonLinkDetail {
  const person = (raw.person ?? raw) as Record<string, unknown>;
  const incidents = Array.isArray(raw.incidents) ? raw.incidents as Array<Record<string, unknown>> : Array.isArray(raw.linkedCases) ? raw.linkedCases as Array<Record<string, unknown>> : [];
  const timeline = Array.isArray(raw.timeline) ? raw.timeline as Array<Record<string, unknown>> : [];
  const associates = Array.isArray(raw.associates) ? raw.associates as Array<Record<string, unknown>> : [];
  const linkedCases = incidents.flatMap((incident) => {
    const linkedCase = {
      crimeNo: String(incident.crimeNo ?? incident.firNumber ?? incident.fir_number ?? ""),
      date: String(incident.date ?? incident.incidentDate ?? incident.incident_date ?? "Not available"),
      category: String(incident.crimeType ?? incident.crime_type ?? incident.category ?? "Unspecified"),
      district: String(incident.district ?? "Restricted"),
    };
    return linkedCase.crimeNo ? [linkedCase] : [];
  });
  const labels = Array.isArray(raw.linkLabels) ? raw.linkLabels.map(String) : Array.isArray(raw.labels) ? raw.labels.map(String) : [String(raw.linkLabel ?? raw.classification ?? "SINGLE_CASE_LINK")];
  return {
    personId: String(raw.personId ?? raw.offenderId ?? person.person_id ?? person.personId ?? ""),
    maskedName: String(raw.maskedName ?? person.maskedName ?? person.name ?? "Restricted"),
    caseCount: Number(raw.caseCount ?? raw.incidentCount ?? linkedCases.length),
    districtCount: Number(raw.districtCount ?? new Set(linkedCases.map((incident) => incident.district)).size),
    stationCount: Number(raw.stationCount ?? 0),
    coAccusedCount: Number(raw.coAccusedCount ?? raw.associateCount ?? associates.length),
    linkComplexityScore: Number(raw.linkComplexityScore ?? 0),
    firstKnownCase: String(raw.firstKnownCaseDate ?? timeline.at(0)?.date ?? linkedCases.at(-1)?.date ?? "Not available"),
    latestKnownCase: String(raw.latestKnownCaseDate ?? timeline.at(-1)?.date ?? linkedCases.at(0)?.date ?? "Not available"),
    crimeCategories: [...new Set(linkedCases.map((incident) => incident.category))],
    modusOperandi: Array.isArray(raw.commonModusOperandi) ? raw.commonModusOperandi.map(String) : Array.isArray(raw.modusOperandi) ? raw.modusOperandi.map(String) : [],
    linkLabels: labels,
    linkedCases,
    network: raw.network as PersonLinkDetail["network"] | undefined,
  };
}

function mapSimilarCases(payload: unknown): SimilarCase[] {
  const rows = unwrap<unknown>(payload);
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const source = row as Record<string, unknown>;
    const similarCase: SimilarCase = {
      crimeNo: String(source.crimeNo ?? source.firNumber ?? ""),
      date: String(source.incidentDate ?? source.date ?? "Not available"),
      category: String(source.crimeType ?? source.category ?? "Unspecified"),
      district: String(source.district ?? "Restricted"),
      similarityScore: Math.round(Number(source.similarityScore ?? 0) * 100),
      matchedFeatures: Array.isArray(source.matchedFeatures) ? source.matchedFeatures.map(String) : [],
      evidence: Array.isArray(source.evidence) ? source.evidence.map(String) : [],
    };
    return similarCase.crimeNo ? [similarCase] : [];
  });
}

export default function OffenderDetailPage() {
  const navigate = useNavigate();
  const {offenderId} = useParams<{offenderId: string}>();
  const [detail, setDetail] = useState<PersonLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [similarCases, setSimilarCases] = useState<SimilarCase[] | null>(null);
  const [similarMoLoading, setSimilarMoLoading] = useState(false);
  const [similarMoError, setSimilarMoError] = useState<string | null>(null);

  useEffect(() => {
    if (!offenderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    kavachApi.getOffenderDetail(offenderId)
      .then((response) => { if (!cancelled) setDetail(mapDetail(unwrap<Record<string, unknown>>(response.data))); })
      .catch(() => { if (!cancelled) setError("Unable to load this masked person-link profile."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offenderId]);

  async function inspectSimilarMo(crimeNo: string) {
    setSimilarMoLoading(true);
    setSimilarMoError(null);
    try {
      const response = await kavachApi.getSimilarModusOperandi(crimeNo);
      setSimilarCases(mapSimilarCases(response.data));
    } catch {
      setSimilarCases(null);
      setSimilarMoError("Similar-modus-operandi evidence is unavailable for the current scope.");
    } finally {
      setSimilarMoLoading(false);
    }
  }

  if (error) return <div className="space-y-6"><Link to="/offenders" className="inline-flex items-center gap-1 text-sm text-[#1D4ED8]"><ArrowLeft className="size-4" />Back to Person Links</Link><Card className="border-red-200 bg-red-50"><CardContent className="flex items-center gap-3 p-8 text-sm text-[#DC2626]"><AlertTriangle className="size-5" />{error}</CardContent></Card></div>;

  if (loading) return <div className="space-y-6"><Link to="/offenders" className="inline-flex items-center gap-1 text-sm text-[#1D4ED8]"><ArrowLeft className="size-4" />Back to Person Links</Link><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-64 w-full" /></div>;

  if (!detail) return null;

  const stats = [
    {label: "Case links", value: detail.caseCount},
    {label: "District links", value: detail.districtCount},
    {label: "Station links", value: detail.stationCount},
    {label: "Co-accused links", value: detail.coAccusedCount},
    {label: "Link complexity", value: detail.linkComplexityScore},
    {label: "Latest known case", value: detail.latestKnownCase},
  ];

  return <div className="space-y-6">
    <Link to="/offenders" className="inline-flex items-center gap-1 text-sm text-[#1D4ED8] hover:underline"><ArrowLeft className="size-4" />Back to Person Links</Link>
    <div className="flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-xl bg-[#1D4ED8]/10 text-[#1D4ED8]"><ShieldAlert className="size-7" /></div><div><h1 className="text-xl font-bold text-[#0F172A]">{maskName(detail.maskedName)}</h1><p className="text-sm text-slate-500">Masked person-link profile: {detail.personId}</p></div></div>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{stats.map((stat) => <Card key={stat.label} className="border-slate-200"><CardContent className="p-4 text-center"><p className="text-xs font-semibold uppercase text-slate-500">{stat.label}</p><p className="mt-1 text-lg font-bold text-[#0F172A]">{stat.value}</p></CardContent></Card>)}</div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Historical link indicators</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2">{detail.linkLabels.map((label) => <Badge key={label} className="bg-[#1D4ED8]">{label.replaceAll("_", " ")}</Badge>)}</div><div><p className="text-xs font-semibold uppercase text-slate-500">Crime categories</p><div className="mt-2 flex flex-wrap gap-1.5">{detail.crimeCategories.length ? detail.crimeCategories.map((category) => <Badge key={category} variant="secondary">{category}</Badge>) : <span className="text-sm text-slate-400">Not available</span>}</div></div><div><p className="text-xs font-semibold uppercase text-slate-500">Observed MO terms</p><ul className="mt-2 list-inside list-disc text-sm text-slate-600">{detail.modusOperandi.length ? detail.modusOperandi.map((mo) => <li key={mo}>{mo}</li>) : <li className="list-none text-slate-400">No verified MO terms.</li>}</ul></div></CardContent></Card>
      <Card className="border-amber-200 bg-amber-50"><CardHeader><CardTitle className="text-sm font-semibold text-amber-950">Human-review safeguard</CardTitle></CardHeader><CardContent className="flex gap-2 text-sm leading-6 text-amber-950"><Info className="mt-1 size-4 shrink-0" /><span>These are historic case associations and link-complexity indicators, not a guilt conclusion, risk score, arrest recommendation, or prediction of future conduct.</span></CardContent></Card>
    </div>
    <Card className="border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileText className="size-4" />Linked synthetic cases</CardTitle></CardHeader><CardContent>{detail.linkedCases.length ? <div className="divide-y">{detail.linkedCases.map((linkedCase) => <div key={linkedCase.crimeNo} className="flex flex-wrap items-center justify-between gap-3 py-3"><button type="button" onClick={() => navigate(`/network-intelligence?q=${linkedCase.crimeNo}`)} className="text-left text-sm hover:underline"><span className="font-mono text-xs font-medium text-[#1D4ED8]">{linkedCase.crimeNo}</span><span className="ml-3 text-slate-600">{linkedCase.category}</span><span className="ml-3 text-xs text-slate-500">{linkedCase.district} · {linkedCase.date}</span></button><Button type="button" variant="outline" size="sm" onClick={() => void inspectSimilarMo(linkedCase.crimeNo)} className="gap-1 text-xs"><Search className="size-3" />Find similar MO</Button></div>)}</div> : <p className="text-sm text-slate-400">No linked cases are visible in the current scope.</p>}</CardContent></Card>
    <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Similar modus-operandi evidence</CardTitle></CardHeader><CardContent>{similarMoLoading ? <Skeleton className="h-20 w-full" /> : similarMoError ? <p className="text-sm text-[#DC2626]">{similarMoError}</p> : similarCases ? similarCases.length ? <div className="space-y-3">{similarCases.map((similarCase) => <div key={similarCase.crimeNo} className="rounded-lg border border-slate-100 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs text-[#1D4ED8]">{similarCase.crimeNo}</span><Badge variant="secondary">Similarity {similarCase.similarityScore}%</Badge></div><p className="mt-1 text-slate-700">{similarCase.category} · {similarCase.district} · {similarCase.date}</p><p className="mt-2 text-xs text-slate-500">Matched features: {similarCase.matchedFeatures.join(", ") || "recorded MO text"}</p>{similarCase.evidence.map((evidence) => <p key={evidence} className="mt-1 text-xs text-slate-600">{evidence}</p>)}</div>)}</div> : <p className="text-sm text-slate-500">No sufficiently similar synthetic cases were found for the selected case.</p> : <p className="text-sm text-slate-500">Select a linked case to retrieve deterministic, explainable MO similarity evidence.</p>}</CardContent></Card>
    {detail.network?.nodes?.length ? <Card className="border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700"><GitBranch className="size-4" />Scoped network summary</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">{detail.network.nodes.length} nodes and {detail.network.edges.length} evidence-backed edges are available. Open Network Intelligence to inspect an edge evidence drawer.</p></CardContent></Card> : null}
  </div>;
}
