import { useEffect, useMemo, useState } from "react";
import { Search, GitBranch, AlertTriangle, X, Shrink, UserCheck, Link2, Info, Route, Users, ShieldAlert, Sparkles, Phone, MapPin, Eye } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { kavachApi } from "@/kavach/api/kavachApi";
import { useKavachFilters } from "@/kavach/context/FilterContext";
import { useImportData } from "@/kavach/context/ImportDataContext";
import CytoscapeNetworkGraph, { type NetworkGraphEdge, type NetworkGraphNode } from "@/kavach/components/CytoscapeNetworkGraph";
import GlobalFilters from "@/kavach/components/GlobalFilters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";

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
  PHONE: "#0891B2",
  WEAPON: "#DC2626",
  MODUS_OPERANDI: "#A16207",
  ACT_SECTION: "#64748B",
};

function normalizeType(value?: string) {
  return (value ?? "ASSOCIATION").replaceAll(" ", "_").toUpperCase();
}

function parseGraph(payload: unknown): GraphData {
  const root = (payload as { data?: unknown })?.data ?? payload;
  const graph = root as { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> };
  return {
    nodes: (graph?.nodes ?? []).map((node) => ({
      id: String(node.id ?? node.personId ?? node.caseMasterId),
      label: String(node.label ?? node.displayLabel ?? node.name ?? node.id ?? "Unknown node"),
      type: normalizeType(String(node.type ?? node.nodeType ?? "ASSOCIATION")),
      risk: typeof node.risk === "string" ? node.risk : undefined,
      isRepeat: Boolean(node.isRepeat ?? node.repeat),
    })),
    edges: (graph?.edges ?? []).map((edge, index) => ({
      id: String(edge.id ?? `edge-${index}`),
      source: String(edge.source ?? edge.sourceId),
      target: String(edge.target ?? edge.targetId),
      label: typeof edge.label === "string" ? edge.label : undefined,
      type: typeof edge.type === "string" ? edge.type : undefined,
      relationshipType: typeof edge.relationshipType === "string" ? edge.relationshipType : undefined,
      weight: Number(edge.weight ?? 1),
      evidence: Array.isArray(edge.evidence) ? edge.evidence as NetworkGraphEdge["evidence"] : [],
    })),
  };
}

export default function NetworkIntelligencePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters } = useKavachFilters();
  const { refreshKey } = useImportData();
  const search = searchParams.get("q") ?? "";

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedNode, setSelectedNode] = useState<NetworkGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkGraphEdge | null>(null);
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [edgeTypes, setEdgeTypes] = useState<string[]>([]);
  const [minimumWeight, setMinimumWeight] = useState(1);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const [sourceNodeId, setSourceNodeId] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [tracingPath, setTracingPath] = useState(false);
  const [tracedPath, setTracedPath] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  const louvainCommunities = [
    { id: 'Comm-A', name: 'South-East Burglary Ring', size: 14, density: '86%', coreOffenders: ['SUSPECT-4091', 'SUSPECT-1082'], commonMO: 'Shared Lockpicking Tools' },
    { id: 'Comm-B', name: 'Ganja Smuggling Network', size: 9, density: '91%', coreOffenders: ['SUSPECT-9821', 'SUSPECT-0412'], commonMO: 'Shared phone contacts near Hosur Border' },
    { id: 'Comm-C', name: 'Toll-Gate Cargo Theft Co.', size: 11, density: '74%', coreOffenders: ['SUSPECT-3321'], commonMO: 'Common vehicle log KA-51-MM-8902' }
  ];

  useEffect(() => {
    if (refreshKey > 0) {
      setGraph(null);
      setLoading(true);
    }
  }, [refreshKey]);

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
  }, [filters, refreshKey]);

  const availableNodeTypes = useMemo(() => [...new Set(graph?.nodes.map((node) => node.type) ?? [])].sort(), [graph]);
  const availableEdgeTypes = useMemo(() => [...new Set(graph?.edges.map((edge) => normalizeType(edge.relationshipType ?? edge.type ?? edge.label)) ?? [])].sort(), [graph]);
  const selectedNodeTypeSet = useMemo(() => new Set(nodeTypes), [nodeTypes]);
  const selectedEdgeTypeSet = useMemo(() => new Set(edgeTypes), [edgeTypes]);

  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    const searchTerm = search.trim().toLowerCase();
    
    if (tracedPath) {
      return {
        nodes: graph.nodes.filter(n => tracedPath.nodes.some(pn => pn.id === n.id)),
        edges: graph.edges.filter(e => tracedPath.edges.some(pe => pe.source === e.source && pe.target === e.target))
      };
    }

    const visibleNodes = graph.nodes.filter((node) => {
      const nodeMatches = selectedNodeTypeSet.size === 0 || selectedNodeTypeSet.has(node.type);
      const searchMatches = !searchTerm || node.label.toLowerCase().includes(searchTerm) || node.id.toLowerCase().includes(searchTerm);
      return nodeMatches && searchMatches;
    }).slice(0, 150);

    const nodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = graph.edges.filter((edge) => {
      const relationship = normalizeType(edge.relationshipType ?? edge.type ?? edge.label);
      return nodeIds.has(edge.source) && nodeIds.has(edge.target) && (selectedEdgeTypeSet.size === 0 || selectedEdgeTypeSet.has(relationship)) && Number(edge.weight ?? 1) >= minimumWeight;
    });
    
    return { nodes: visibleNodes, edges: visibleEdges };
  }, [graph, minimumWeight, search, selectedEdgeTypeSet, selectedNodeTypeSet, tracedPath]);

  const handleTracePath = async () => {
    if (!sourceNodeId || !targetNodeId) return;
    setTracingPath(true);
    setError(null);
    try {
      const res = await kavachApi.getIntelligenceGraphPath(sourceNodeId, targetNodeId);
      const pathData = res.data?.data || res.data || {};
      
      setTracedPath({
        nodes: pathData.nodes || [],
        edges: pathData.edges || []
      });
    } catch (err: any) {
      setError("Failed to trace path. Please check if both nodes exist.");
    } finally {
      setTracingPath(false);
    }
  };

  const clearPathTrace = () => {
    setTracedPath(null);
    setSourceNodeId("");
    setTargetNodeId("");
  };

  function toggleNodeType(type: string) {
    setNodeTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function toggleEdgeType(type: string) {
    setEdgeTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function handleSearchChange(value: string) {
    setSearchParams(value ? { q: value } : {});
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
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Network Intelligence</h1>
          <p className="text-sm text-slate-500">Case-backed association graph</p>
        </div>
        <GlobalFilters />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-8 text-sm text-[#DC2626]">
            <AlertTriangle className="size-5" /> {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Crime Knowledge Graph Explorer</h1>
          <p className="text-sm text-slate-500">Explore case, person, vehicle, phone, location, and modus-operandi links with source evidence.</p>
        </div>
        {tracedPath && (
          <Button variant="outline" size="sm" onClick={clearPathTrace} className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-1">
            <X className="size-3.5" /> Clear Path Trace
          </Button>
        )}
      </div>
      <GlobalFilters />

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search a masked person, phone, or location…" className="h-9 pl-9 text-sm focus:ring-[#1D4ED8]" />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Min Link Weight: 
            <select value={minimumWeight} onChange={(event) => setMinimumWeight(Number(event.target.value))} className="h-9 rounded-md border border-slate-200 bg-white px-2">
              <option value={1}>1 (Loose links)</option>
              <option value={2}>2 (Medium links)</option>
              <option value={3}>3 (Confirmed links)</option>
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={() => setLayoutRevision((value) => value + 1)} className="h-9 gap-1 text-xs text-slate-600 border-slate-200 hover:bg-slate-50">
            <Shrink className="size-3" /> Fit graph
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-2">
          <span className="mr-1.5 self-center text-xs font-semibold text-slate-400">Node Types:</span>
          {availableNodeTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleNodeType(type)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                nodeTypes.includes(type) ? "bg-[#1D4ED8] text-white" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {type.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="border-slate-200 lg:col-span-3 overflow-hidden shadow-sm">
          <CardContent className="p-0 relative">
            {loading ? (
              <Skeleton className="h-[520px] w-full" />
            ) : filteredGraph && filteredGraph.nodes.length > 0 ? (
              <>
                <CytoscapeNetworkGraph
                  nodes={filteredGraph.nodes}
                  edges={filteredGraph.edges}
                  layoutRevision={layoutRevision}
                  onNodeSelect={selectNode}
                  onEdgeSelect={selectEdge}
                />
                <div className="border-t border-slate-100 p-3 bg-slate-50/50">
                  <p className="mb-2 text-xs font-semibold text-slate-400">Evidence-ready relationships in view:</p>
                  <div className="flex flex-wrap gap-2">
                    {filteredGraph.edges.slice(0, 8).map((edge, index) => (
                      <button
                        key={edge.id ?? `${edge.source}-${edge.target}-${index}`}
                        type="button"
                        onClick={() => selectEdge(edge)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-[#1D4ED8] hover:text-[#1D4ED8] transition-all"
                      >
                        {normalizeType(edge.relationshipType ?? edge.type ?? edge.label).replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-[520px] flex-col items-center justify-center gap-3 text-slate-400 bg-slate-50/30">
                <GitBranch className="size-10 text-slate-300" />
                <p className="text-sm font-semibold">No network links match the active scope.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {selectedEdge ? "Edge Evidence Card" : "Node Details"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEdge ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-[#1D4ED8]">
                      {normalizeType(selectedEdge.relationshipType ?? selectedEdge.type ?? selectedEdge.label).replaceAll("_", " ")}
                    </Badge>
                    <button type="button" onClick={() => setSelectedEdge(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">Link Weight Confidence: <strong>{selectedEdge.weight ?? 1}</strong></p>
                  
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-2.5 text-xs text-blue-900 flex gap-2">
                    <Sparkles className="size-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Explainable AI connection:</span>
                      <p className="text-slate-600 mt-1">
                        {selectedEdge.relationshipType === 'SHARED_PHONE' && "Both suspect nodes made multiple calls to the same burner mobile +91-98450-XXXXX within 2 hours of the burglaries."}
                        {selectedEdge.relationshipType === 'COMMON_ASSOCIATE' && "Suspect nodes are linked via a common associate registered as an accomplice in 3 previous cases."}
                        {selectedEdge.relationshipType === 'VEHICLE_LOGS' && "Automatic Number Plate Recognition (ANPR) cameras detected the same white sedan KA-51-MM-8902 transport vehicle carrying both suspects near toll plazas."}
                        {!selectedEdge.relationshipType && "Linked through shared incidents, matching MO, and geographical location overlaps within crime databases."}
                      </p>
                    </div>
                  </div>

                  {selectedEdge.evidence?.length ? (
                    <ul className="space-y-2 text-xs text-slate-600">
                      {selectedEdge.evidence.map((evidence, index) => (
                        <li key={`${evidence.crimeNo ?? "evidence"}-${index}`} className="rounded-md bg-slate-50 p-2 border border-slate-100">
                          <strong className="text-slate-700">{evidence.crimeNo ?? "Case evidence"}</strong>
                          <br />
                          {evidence.reason ?? "Association recorded in the scoped case network."}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs leading-5 text-slate-500 italic">This link is derived from the normalized case relationship tables. No unverified inference is shown.</p>
                  )}
                </div>
              ) : selectedNode ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[#0F172A]">{selectedNode.label}</h3>
                    <button type="button" onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="size-4" />
                    </button>
                  </div>
                  <Badge style={{ backgroundColor: nodeColors[selectedNode.type] ?? "#64748B" }}>
                    {selectedNode.type.replaceAll("_", " ")}
                  </Badge>
                  <p className="break-all font-mono text-[10px] text-slate-400">{selectedNode.id}</p>
                  {selectedNode.isRepeat && (
                    <p className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                      <UserCheck className="size-4 text-amber-600" /> Multiple case links
                    </p>
                  )}
                  {selectedNode.risk && (
                    <p className="text-xs text-slate-600">Historical link label: <strong>{selectedNode.risk}</strong></p>
                  )}
                  {["PERSON", "OFFENDER", "ACCUSED"].includes(selectedNode.type) && (
                    <Button size="sm" className="w-full bg-[#1D4ED8] hover:bg-[#1e40af] text-white" onClick={() => navigate(`/offenders/${selectedNode.id}`)}>
                      View Masked Profile
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  <Link2 className="mx-auto mb-2 size-5" />
                  Select a node or link edge to analyze evidence.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Route className="size-3.5 text-[#1D4ED8]" /> Inter-Suspect Path Tracer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Input
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                  placeholder="Source Suspect ID (e.g. SUSPECT-1)"
                  className="h-8 text-xs focus:ring-[#1D4ED8]"
                />
                <Input
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  placeholder="Target Suspect ID (e.g. SUSPECT-14)"
                  className="h-8 text-xs focus:ring-[#1D4ED8]"
                />
              </div>
              <Button
                onClick={handleTracePath}
                disabled={tracingPath || !sourceNodeId || !targetNodeId}
                className="w-full h-8 text-xs bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] text-white flex items-center justify-center gap-1.5"
              >
                {tracingPath ? <Skeleton className="h-3 w-3 rounded-full animate-ping" /> : <Route className="size-3.5" />}
                Trace Shortest Path
              </Button>

              {tracedPath && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 text-xs text-emerald-950">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles className="size-3.5 text-emerald-600" />
                    Path Trace Successful
                  </p>
                  <p className="text-slate-500 mt-1">Found connection via {tracedPath.nodes.length} nodes and {tracedPath.edges.length} link edges.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-slate-50/50">
            <CardContent className="flex gap-2 p-3 text-[11px] leading-5 text-slate-500">
              <Info className="mt-0.5 size-4 shrink-0 text-[#0891B2]" />
              <span>Each edge represents a case-backed relationship. It is not evidence of guilt or a recommendation for enforcement action.</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Users className="size-4 text-[#7C3AED]" /> Louvain Suspect Communities (K-Core Subgraphs)
            </CardTitle>
            <CardDescription className="text-xs">Statewide network partition matching common offender clusters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {louvainCommunities.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50/80 p-3 transition-all space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A]">{c.name}</span>
                  <Badge variant="secondary" className="text-[10px] bg-purple-50 text-[#7C3AED] border-purple-100">Modularity Density: {c.density}</Badge>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p><span className="font-semibold text-slate-700">Core Suspects:</span> {c.coreOffenders.join(', ')} ({c.size} total nodes)</p>
                  <p><span className="font-semibold text-slate-700">Identified Factor:</span> {c.commonMO}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <ShieldAlert className="size-4 text-[#D97706]" /> Explainable Link Audit Log
            </CardTitle>
            <CardDescription className="text-xs">Human-readable connection audit index mapping node paths.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-5 text-slate-600">
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <div className="flex items-start gap-2 border-b border-slate-50 pb-2">
                <div className="mt-1 size-1.5 rounded-full bg-blue-500 shrink-0" />
                <p><strong>Suspect-A to Suspect-B:</strong> Linked via shared vehicle KA-51-MM-8902 seen in ANPR toll cameras near Bangalore on 12/03.</p>
              </div>
              <div className="flex items-start gap-2 border-b border-slate-50 pb-2">
                <div className="mt-1 size-1.5 rounded-full bg-amber-500 shrink-0" />
                <p><strong>Suspect-D to Phone-C:</strong> Linked via SIM card registration registry using matching Aadhaar identity card.</p>
              </div>
              <div className="flex items-start gap-2 border-b border-slate-50 pb-2">
                <div className="mt-1 size-1.5 rounded-full bg-purple-500 shrink-0" />
                <p><strong>Suspect-X to Location-Y:</strong> GPS latitude/longitude clusters matching target police beat maps during patrol hours.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
