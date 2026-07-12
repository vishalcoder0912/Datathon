import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Search, Users, GitBranch, AlertTriangle, X, ZoomIn, Expand, Shrink, UserCheck } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface GraphNode {
  id: string;
  label: string;
  type: 'offender' | 'incident' | 'victim' | 'location' | 'phone' | 'vehicle';
  risk?: string;
  isRepeat?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type: 'involved_in' | 'connected_to' | 'uses' | 'located_at' | 'associate';
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_COLORS: Record<string, string> = {
  offender: '#DC2626',
  incident: '#1D4ED8',
  victim: '#15803D',
  location: '#D97706',
  phone: '#7C3AED',
  vehicle: '#0891B2',
};

const NODE_TYPES: { key: string; label: string }[] = [
  { key: 'offender', label: 'Offender' },
  { key: 'incident', label: 'Incident' },
  { key: 'victim', label: 'Victim' },
  { key: 'location', label: 'Location' },
  { key: 'phone', label: 'Phone' },
  { key: 'vehicle', label: 'Vehicle' },
];

const MAX_NODES = 100;

function forceLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const positions: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  const centerX = width / 2;
  const centerY = height / 2;

  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const radius = Math.min(width, height) * 0.35;
    positions[n.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      vx: 0, vy: 0,
    };
  });

  for (let iter = 0; iter < 100; iter++) {
    for (const edge of edges) {
      const s = positions[edge.source];
      const t = positions[edge.target];
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 80) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx; s.vy += fy;
      t.vx -= fx; t.vy -= fy;
    }

    for (const node of nodes) {
      const p = positions[node.id];
      if (!p) continue;
      const dx = centerX - p.x;
      const dy = centerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const centerForce = 0.01;
      p.vx += dx * centerForce;
      p.vy += dy * centerForce;
    }

    for (const node of nodes) {
      const p = positions[node.id];
      if (!p) continue;
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.9; p.vy *= 0.9;
      p.x = Math.max(20, Math.min(width - 20, p.x));
      p.y = Math.max(20, Math.min(height - 20, p.y));
    }
  }

  return positions;
}

export default function NetworkIntelligencePage() {
  const { filters } = useKavachFilters();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeFilter, setNodeFilter] = useState<string[]>([]);
  const [fitScale, setFitScale] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    kavachApi.getNetwork(filters)
      .then((res) => { if (!cancelled) setGraph(res.data); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load network'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    let nodes = graph.nodes;
    if (nodeFilter.length > 0) {
      nodes = nodes.filter((n) => nodeFilter.includes(n.type));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      nodes = nodes.filter((n) => n.label.toLowerCase().includes(q));
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [graph, nodeFilter, search]);

  const showLimitWarning = (filteredGraph?.nodes.length ?? 0) > MAX_NODES;

  const displayGraph = useMemo(() => {
    if (!filteredGraph) return null;
    const nodes = filteredGraph.nodes.slice(0, MAX_NODES);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = filteredGraph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [filteredGraph]);

  const dimensions = useMemo(() => ({ w: 800, h: 500 }), []);
  const positions = useMemo(() => {
    if (!displayGraph) return {};
    return forceLayout(displayGraph.nodes, displayGraph.edges, dimensions.w * fitScale, dimensions.h * fitScale);
  }, [displayGraph, fitScale, dimensions]);

  const toggleNodeFilter = (type: string) => {
    setNodeFilter((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Network Intelligence</h1><p className="text-sm text-slate-500">Criminal association graph</p></div>
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
        <h1 className="text-xl font-bold text-[#0F172A]">Network Intelligence</h1>
        <p className="text-sm text-slate-500">Criminal association and connection graph</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offender or FIR..."
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {NODE_TYPES.map((nt) => (
            <button
              key={nt.key}
              onClick={() => toggleNodeFilter(nt.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                nodeFilter.includes(nt.key)
                  ? 'bg-slate-200 text-slate-500'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200'
              }`}
            >
              {nt.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setFitScale((s) => Math.min(s + 0.2, 2))} className="h-9 gap-1 text-xs">
          <ZoomIn className="size-3" /> In
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFitScale(1)} className="h-9 gap-1 text-xs">
          <Shrink className="size-3" /> Fit
        </Button>
      </div>

      {showLimitWarning && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          <AlertTriangle className="size-4" />
          Network has {(filteredGraph?.nodes.length ?? 0)} nodes. Showing first {MAX_NODES}. Refine filters.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="border-slate-200 lg:col-span-3">
          <CardContent className="p-0">
            {loading ? (
              <Skeleton className="h-[500px] w-full rounded-lg" />
            ) : displayGraph && displayGraph.nodes.length > 0 ? (
              <svg ref={svgRef} viewBox={`0 0 ${dimensions.w * fitScale} ${dimensions.h * fitScale}`} className="w-full" style={{ minHeight: 500 }}>
                {displayGraph.edges.map((edge) => {
                  const s = positions[edge.source];
                  const t = positions[edge.target];
                  if (!s || !t) return null;
                  return (
                    <line
                      key={`${edge.source}-${edge.target}`}
                      x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                      stroke="#CBD5E1" strokeWidth={1}
                    />
                  );
                })}
                {displayGraph.nodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;
                  const color = NODE_COLORS[node.type] || '#94A3B8';
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <g
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={pos.x} cy={pos.y} r={isSelected ? 10 : 7}
                        fill={color} fillOpacity={0.8}
                        stroke={isSelected ? '#0F172A' : 'white'}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      {node.isRepeat && (
                        <circle cx={pos.x} cy={pos.y} r={14} fill="none" stroke="#D97706" strokeWidth={1.5} strokeDasharray="3 2" />
                      )}
                      <text x={pos.x} y={pos.y + 18} textAnchor="middle" fontSize="8" fill="#475569" style={{ pointerEvents: 'none' }}>
                        {node.label.length > 15 ? node.label.slice(0, 15) + '…' : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                <GitBranch className="size-10" />
                <p className="text-sm">No network data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">
              {selectedNode ? 'Node Details' : 'Node Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedNode ? (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <GitBranch className="size-8" />
                <p className="text-sm">Click a node</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#0F172A]">{selectedNode.label}</h3>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Type</span>
                    <Badge style={{ backgroundColor: NODE_COLORS[selectedNode.type] }} className="text-white">
                      {selectedNode.type}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">ID</span>
                    <span className="font-mono text-xs">{selectedNode.id}</span>
                  </div>
                  {selectedNode.risk && (
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-500">Risk</span>
                      <Badge variant={selectedNode.risk === 'high' ? 'destructive' : 'secondary'}>{selectedNode.risk}</Badge>
                    </div>
                  )}
                  {selectedNode.isRepeat && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <UserCheck className="size-4" />
                      Repeat Offender
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
