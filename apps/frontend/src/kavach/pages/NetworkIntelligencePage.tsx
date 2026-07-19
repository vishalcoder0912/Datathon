import {useEffect, useMemo, useState} from "react";
import {Search, GitBranch, AlertTriangle, X, Shrink, UserCheck, Link2, Info} from "lucide-react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {kavachApi} from "@/kavach/api/kavachApi";
import {useKavachFilters} from "@/kavach/context/FilterContext";
import {useImportData} from "@/kavach/context/ImportDataContext";
import CytoscapeNetworkGraph, {type NetworkGraphEdge, type NetworkGraphNode} from "@/kavach/components/CytoscapeNetworkGraph";
import GlobalFilters from "@/kavach/components/GlobalFilters";
import {Card, CardContent, CardHeader, CardTitle} from "@/shared/components/ui/card";
import {Badge} from "@/shared/components/ui/badge";
import {Button} from "@/shared/components/ui/button";
import {Input} from "@/shared/components/ui/input";
import {Skeleton} from "@/shared/components/ui/skeleton";

interface GraphData {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
}

const nodeColors: Record<string, string> = {
  PERSON: "#DC2626",
  OFFENDER: "#DC2626",
  ACCUSED: "#DC2626",
  CASE: "#1D4ED8",
  INCIDENT: "#1D4ED8",
  VICTIM: "#15803D",
  COMPLAINANT: "#0F766E",
  LOCATION: "#D97706",
  POLICE_STATION: "#7C3AED",
  DISTRICT: "#0891B2",
  VEHICLE: "#475569",
  MODUS_OPERANDI: "#A16207",
  ACT_SECTION: "#64748B",
};
function normalizeType(value?: string) {
  return (value ?? "ASSOCIATION").replaceAll(" ", "_").toUpperCase();
}

function edgeEndpointId(endpoint: NetworkGraphEdge["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function parseGraph(payload: unknown): GraphData {
  const root = (payload as {data?: unknown})?.data ?? payload;
  const graph = root as {nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>>; links?: Array<Record<string, unknown>>};
  return {
    nodes: (graph?.nodes ?? []).map((node) => ({
      id: String(node.id ?? node.personId ?? node.caseMasterId),
      label: String(node.label ?? node.displayLabel ?? node.name ?? node.id ?? "Unknown node"),
      type: normalizeType(String(node.type ?? node.nodeType ?? "ASSOCIATION")),
      risk: typeof node.risk === "string" ? node.risk : undefined,
      isRepeat: Boolean(node.isRepeat ?? node.repeat ?? node.repeatOffender),
      modusOperandi: Array.isArray(node.modusOperandi) ? node.modusOperandi.map(String) : [],
    })),
    edges: (graph?.edges ?? graph?.links ?? []).map((edge, index) => ({
      id: String(edge.id ?? `edge-${index}`),
      source: String(edge.source ?? edge.sourceId),
      target: String(edge.target ?? edge.targetId),
      label: typeof edge.label === "string" ? edge.label : undefined,
      type: typeof edge.type === "string" ? edge.type : undefined,
      relationshipType: typeof edge.relationshipType === "string" ? edge.relationshipType : undefined,
      weight: Number(edge.weight ?? 1),
      explanation: typeof edge.explanation === "string" ? edge.explanation : undefined,
      evidence: Array.isArray(edge.evidence) ? edge.evidence as NetworkGraphEdge["evidence"] : [],
    })),
  };
}

export default function NetworkIntelligencePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {filters} = useKavachFilters();
  const { refreshKey } = useImportData();
  const search = searchParams.get("q") ?? "";
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkGraphEdge | null>(null);
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);

  // Auto-refresh when custom data is imported
  useEffect(() => {
    if (refreshKey > 0) { setGraph(null); setLoading(true); }
  }, [refreshKey]);
  const [edgeTypes, setEdgeTypes] = useState<string[]>([]);
  const [minimumWeight, setMinimumWeight] = useState(1);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    kavachApi.getNetwork(filters)
      .then((response) => {
        if (!cancelled) setGraph(parseGraph(response.data));
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the scoped association graph.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  const availableNodeTypes = useMemo(() => [...new Set(graph?.nodes.map((node) => node.type) ?? [])].sort(), [graph]);
  const availableEdgeTypes = useMemo(() => [...new Set(graph?.edges.map((edge) => normalizeType(edge.relationshipType ?? edge.type ?? edge.label)) ?? [])].sort(), [graph]);
  const selectedNodeTypeSet = useMemo(() => new Set(nodeTypes), [nodeTypes]);
  const selectedEdgeTypeSet = useMemo(() => new Set(edgeTypes), [edgeTypes]);
  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    const searchTerm = search.trim().toLowerCase();
    const visibleNodes = graph.nodes.filter((node) => {
      const nodeMatches = selectedNodeTypeSet.size === 0 || selectedNodeTypeSet.has(node.type);
      const searchMatches = !searchTerm || node.label.toLowerCase().includes(searchTerm) || node.id.toLowerCase().includes(searchTerm);
      return nodeMatches && searchMatches;
    }).slice(0, 150);
    const nodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = graph.edges.filter((edge) => {
      const relationship = normalizeType(edge.relationshipType ?? edge.type ?? edge.label);
      return nodeIds.has(edgeEndpointId(edge.source)) && nodeIds.has(edgeEndpointId(edge.target)) && (selectedEdgeTypeSet.size === 0 || selectedEdgeTypeSet.has(relationship)) && Number(edge.weight ?? 1) >= minimumWeight;
    });
    return {nodes: visibleNodes, edges: visibleEdges};
  }, [graph, minimumWeight, search, selectedEdgeTypeSet, selectedNodeTypeSet]);

  function toggleNodeType(type: string) {
    setNodeTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function toggleEdgeType(type: string) {
    setEdgeTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function handleSearchChange(value: string) {
    setSearchParams(value ? {q: value} : {});
  }

  function selectNode(node: NetworkGraphNode) {
    setSelectedNode(node);
    setSelectedEdge(null);
  }

  function selectEdge(edge: NetworkGraphEdge) {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }

  if (error) {
    return <div className="space-y-6"><div><h1 className="text-xl font-bold text-[#0F172A]">Network Intelligence</h1><p className="text-sm text-slate-500">Case-backed association graph</p></div><GlobalFilters /><Card className="border-red-200 bg-red-50"><CardContent className="flex items-center gap-3 p-8 text-sm text-[#DC2626]"><AlertTriangle className="size-5" />{error}</CardContent></Card></div>;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-[#0F172A]">Network Intelligence</h1><p className="text-sm text-slate-500">Explore case, person, location, station, and modus-operandi links with source evidence.</p></div>
      <GlobalFilters />

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search a masked person, case, or location…" className="h-9 pl-9 text-sm" /></div><label className="flex items-center gap-2 text-xs font-medium text-slate-600">Minimum edge weight <select value={minimumWeight} onChange={(event) => setMinimumWeight(Number(event.target.value))} className="h-9 rounded-md border border-slate-200 bg-white px-2"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label><Button variant="outline" size="sm" onClick={() => setLayoutRevision((value) => value + 1)} className="h-9 gap-1 text-xs"><Shrink className="size-3" /> Fit graph</Button></div>
        <div className="flex flex-wrap gap-1.5"><span className="mr-1 self-center text-xs font-semibold text-slate-500">Nodes</span>{availableNodeTypes.map((type) => <button key={type} type="button" onClick={() => toggleNodeType(type)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${nodeTypes.includes(type) ? "bg-slate-200 text-slate-500" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"}`}>{type.replaceAll("_", " ")}</button>)}</div>
        <div className="flex flex-wrap gap-1.5"><span className="mr-1 self-center text-xs font-semibold text-slate-500">Edges</span>{availableEdgeTypes.map((type) => <button key={type} type="button" onClick={() => toggleEdgeType(type)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${edgeTypes.includes(type) ? "bg-slate-200 text-slate-500" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"}`}>{type.replaceAll("_", " ")}</button>)}</div>
      </div>

      {(graph?.nodes.length ?? 0) > 150 && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800"><AlertTriangle className="size-4" />The graph is limited to 150 matching nodes. Refine filters or search to expand an investigation safely.</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="border-slate-200 lg:col-span-3"><CardContent className="p-0">{loading ? <Skeleton className="h-[520px] w-full" /> : filteredGraph && filteredGraph.nodes.length > 0 ? <><CytoscapeNetworkGraph nodes={filteredGraph.nodes} edges={filteredGraph.edges} layoutRevision={layoutRevision} onNodeSelect={selectNode} onEdgeSelect={selectEdge} /><div className="border-t border-slate-100 p-3"><p className="mb-2 text-xs font-semibold text-slate-500">Evidence-ready relationships</p><div className="flex flex-wrap gap-2">{filteredGraph.edges.slice(0, 8).map((edge, index) => <button key={edge.id ?? `${edge.source}-${edge.target}-${index}`} type="button" onClick={() => selectEdge(edge)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-[#1D4ED8] hover:text-[#1D4ED8]" aria-label={`Inspect evidence for ${normalizeType(edge.relationshipType ?? edge.type ?? edge.label)}`}>{normalizeType(edge.relationshipType ?? edge.type ?? edge.label).replaceAll("_", " ")}</button>)}</div></div></> : <div className="flex h-[520px] flex-col items-center justify-center gap-3 text-slate-400"><GitBranch className="size-10" /><p className="text-sm">No network links match the active scope.</p></div>}</CardContent></Card>

        <div className="space-y-4">
          <Card className="border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700">{selectedEdge ? "Edge evidence" : "Node details"}</CardTitle></CardHeader><CardContent>{selectedEdge ? <div className="space-y-3"><div className="flex items-center justify-between"><Badge className="bg-[#1D4ED8]">{normalizeType(selectedEdge.relationshipType ?? selectedEdge.type ?? selectedEdge.label).replaceAll("_", " ")}</Badge><button type="button" onClick={() => setSelectedEdge(null)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button></div><p className="text-xs text-slate-600">Weight: <strong>{selectedEdge.weight ?? 1}</strong></p>{selectedEdge.evidence?.length ? <ul className="space-y-2 text-xs text-slate-600">{selectedEdge.evidence.map((evidence, index) => <li key={`${evidence.crimeNo ?? "evidence"}-${index}`} className="rounded-md bg-slate-50 p-2"><strong className="text-slate-700">{evidence.crimeNo ?? "Case evidence"}</strong><br />{evidence.reason ?? "Association recorded in the scoped case network."}</li>)}</ul> : <p className="text-xs leading-5 text-slate-600">{selectedEdge.explanation ?? "This association is derived from normalized case relationships. No unsupported inference is shown."}</p>}</div> : selectedNode ? <div className="space-y-3"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-[#0F172A]">{selectedNode.label}</h3><button type="button" onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button></div><Badge style={{backgroundColor: nodeColors[selectedNode.type] ?? "#64748B"}}>{selectedNode.type.replaceAll("_", " ")}</Badge><p className="break-all font-mono text-xs text-slate-500">{selectedNode.id}</p>{selectedNode.isRepeat && <p className="flex items-center gap-1 text-xs text-amber-700"><UserCheck className="size-4" />Multiple case links</p>}{selectedNode.modusOperandi?.length ? <p className="text-xs text-slate-600">Modus operandi: <strong>{selectedNode.modusOperandi.join(", ")}</strong></p> : null}{selectedNode.risk && <p className="text-xs text-slate-600">Historical link label: <strong>{selectedNode.risk}</strong></p>}{["PERSON", "OFFENDER", "ACCUSED"].includes(selectedNode.type) && <Button size="sm" className="w-full bg-[#1D4ED8]" onClick={() => navigate(`/offenders/${selectedNode.id}`)}>View masked profile</Button>}</div> : <div className="py-6 text-center text-sm text-slate-500"><Link2 className="mx-auto mb-2 size-6" />Select a node or edge.</div>}</CardContent></Card>
          <Card className="border-slate-200 bg-slate-50"><CardContent className="flex gap-2 p-3 text-xs leading-5 text-slate-600"><Info className="mt-0.5 size-4 shrink-0 text-[#0891B2]" /><span>Each edge is an explainable, case-backed relationship. It is not evidence of guilt or a recommendation for enforcement.</span></CardContent></Card>
        </div>
      </div>
    </div>
  );
}
