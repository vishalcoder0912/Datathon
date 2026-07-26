import {useEffect, useMemo, useRef, useState} from "react";
import ForceGraph2D, {type ForceGraphMethods, type LinkObject, type NodeObject} from "react-force-graph-2d";

export interface NetworkGraphNode extends NodeObject {
  id: string;
  label: string;
  type: string;
  risk?: string;
  isRepeat?: boolean;
  modusOperandi?: string[];
}

export interface NetworkEvidence {
  crimeNo?: string;
  reason?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface NetworkGraphEdge extends LinkObject<NetworkGraphNode> {
  id?: string;
  source: string | NetworkGraphNode;
  target: string | NetworkGraphNode;
  label?: string;
  type?: string;
  relationshipType?: string;
  weight?: number;
  explanation?: string;
  evidence?: NetworkEvidence[];
}

interface NetworkGraphProps {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
  layoutRevision: number;
  onNodeSelect: (node: NetworkGraphNode) => void;
  onEdgeSelect: (edge: NetworkGraphEdge) => void;
}

const nodeColors: Record<string, string> = {
  PERSON: "#dc2626",
  SUSPECT: "#dc2626",
  OFFENDER: "#dc2626",
  ACCUSED: "#dc2626",
  CASE: "#1d4ed8",
  INCIDENT: "#1d4ed8",
  VICTIM: "#15803d",
  COMPLAINANT: "#0f766e",
  LOCATION: "#d97706",
  POLICE_STATION: "#7c3aed",
  DISTRICT: "#0891b2",
  VEHICLE: "#475569",
  MODUS_OPERANDI: "#a16207",
  ACT_SECTION: "#64748b",
};

function normalizeNodeType(type: string) {
  return type.replaceAll(" ", "_").toUpperCase();
}

function endpointId(endpoint: string | NetworkGraphNode) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

export default function NetworkForceGraph({nodes, edges, layoutRevision, onNodeSelect, onEdgeSelect}: NetworkGraphProps) {
  const graphRef = useRef<ForceGraphMethods<NetworkGraphNode, NetworkGraphEdge> | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const graphData = useMemo(() => ({nodes: nodes.map((node) => ({...node})), links: edges.map((edge) => ({...edge}))}), [edges, nodes]);

  useEffect(() => {
    if (layoutRevision === 0) return;
    graphRef.current?.d3ReheatSimulation();
    graphRef.current?.zoomToFit(450, 50);
  }, [layoutRevision]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-lg bg-slate-50" aria-label="Interactive relationship force graph">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={900}
        height={520}
        backgroundColor="#f8fafc"
        nodeRelSize={5}
        nodeVal={(node) => node.isRepeat ? 2.2 : 1}
        nodeColor={(node) => selectedNodeId === node.id ? "#0f172a" : nodeColors[normalizeNodeType(node.type)] ?? "#64748b"}
        nodeLabel={(node) => `${node.label}\n${normalizeNodeType(node.type)}${node.isRepeat ? "\nRepeat case link" : ""}${node.modusOperandi?.length ? `\nMO: ${node.modusOperandi.join(", ")}` : ""}`}
        linkWidth={(link) => Math.min(5, Math.max(1, Number(link.weight ?? 1)))}
        linkColor={() => "#94a3b8"}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkLabel={(link) => link.explanation ?? link.evidence?.[0]?.reason ?? link.relationshipType ?? link.type ?? "Evidence-backed relationship"}
        cooldownTicks={80}
        onEngineStop={() => graphRef.current?.zoomToFit(350, 45)}
        onNodeClick={(node) => {
          setSelectedNodeId(node.id);
          onNodeSelect(node);
        }}
        onLinkClick={(link) => {
          const selected = edges.find((edge) => edge.id === link.id || (endpointId(edge.source) === endpointId(link.source) && endpointId(edge.target) === endpointId(link.target)));
          if (selected) onEdgeSelect(selected);
        }}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-medium text-slate-600 shadow-sm">
        {Object.entries(nodeColors).filter(([type]) => ["SUSPECT", "INCIDENT", "VICTIM", "LOCATION", "POLICE_STATION", "MODUS_OPERANDI"].includes(type)).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{backgroundColor: color}} />{type.replaceAll("_", " ")}</span>
        ))}
      </div>
    </div>
  );
}
