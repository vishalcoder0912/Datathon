import {useEffect, useRef} from "react";
import cytoscape, {type Core, type ElementDefinition} from "cytoscape";

export interface NetworkGraphNode {
  id: string;
  label: string;
  type: string;
  risk?: string;
  isRepeat?: boolean;
}

export interface NetworkEvidence {
  crimeNo?: string;
  reason?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface NetworkGraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  relationshipType?: string;
  weight?: number;
  evidence?: NetworkEvidence[];
}

interface CytoscapeNetworkGraphProps {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
  layoutRevision: number;
  onNodeSelect: (node: NetworkGraphNode) => void;
  onEdgeSelect: (edge: NetworkGraphEdge) => void;
}

const nodeColors: Record<string, string> = {
  PERSON: "#dc2626",
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

function toElements(nodes: NetworkGraphNode[], edges: NetworkGraphEdge[]): ElementDefinition[] {
  const nodeElements = nodes.map((node) => ({
    group: "nodes" as const,
    data: {
      id: node.id,
      label: node.label,
      nodeType: normalizeNodeType(node.type),
      color: nodeColors[normalizeNodeType(node.type)] ?? "#64748b",
      isRepeat: String(Boolean(node.isRepeat)),
    },
  }));
  const edgeElements = edges.map((edge, index) => ({
    group: "edges" as const,
    data: {
      id: edge.id ?? `${edge.source}-${edge.target}-${edge.relationshipType ?? edge.type ?? index}`,
      source: edge.source,
      target: edge.target,
      label: edge.relationshipType ?? edge.type ?? edge.label ?? "ASSOCIATED_WITH",
      weight: Number(edge.weight ?? 1),
    },
  }));
  return [...nodeElements, ...edgeElements];
}

export default function CytoscapeNetworkGraph({nodes, edges, layoutRevision, onNodeSelect, onEdgeSelect}: CytoscapeNetworkGraphProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const nodeSelectRef = useRef(onNodeSelect);
  const edgeSelectRef = useRef(onEdgeSelect);
  const graphRef = useRef({nodes, edges});

  nodeSelectRef.current = onNodeSelect;
  edgeSelectRef.current = onEdgeSelect;
  graphRef.current = {nodes, edges};

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: toElements(nodes, edges),
      style: [
        {selector: "node", style: {"background-color": "data(color)", label: "data(label)", color: "#334155", "font-size": 10, "text-valign": "bottom", "text-margin-y": 6, width: 22, height: 22, "border-width": 2, "border-color": "#ffffff"}},
        {selector: "node[isRepeat = 'true']", style: {"border-color": "#f59e0b", "border-width": 4}},
        {selector: "edge", style: {width: "mapData(weight, 1, 5, 1, 4)", "line-color": "#94a3b8", "target-arrow-color": "#94a3b8", "target-arrow-shape": "triangle", "curve-style": "bezier", label: "data(label)", "font-size": 8, color: "#64748b", "text-background-color": "#ffffff", "text-background-opacity": 0.85, "text-background-padding": 2}},
        {selector: ":selected", style: {"border-color": "#0f172a", "border-width": 4, "line-color": "#1d4ed8", "target-arrow-color": "#1d4ed8"}},
      ],
      layout: {name: "cose", animate: false, padding: 40, nodeRepulsion: () => 12_000, idealEdgeLength: () => 110},
      minZoom: 0.25,
      maxZoom: 2.5,
    });
    cy.on("tap", "node", (event) => {
      const node = graphRef.current.nodes.find((item) => item.id === event.target.id());
      if (node) nodeSelectRef.current(node);
    });
    cy.on("tap", "edge", (event) => {
      const edge = graphRef.current.edges.find((item, index) => (item.id ?? `${item.source}-${item.target}-${item.relationshipType ?? item.type ?? index}`) === event.target.id());
      if (edge) edgeSelectRef.current(edge);
    });
    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  // Cytoscape owns mutations after initial construction; updates are handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().remove();
    cy.add(toElements(nodes, edges));
    cy.layout({name: "cose", animate: false, padding: 40, nodeRepulsion: () => 12_000, idealEdgeLength: () => 110}).run();
    cy.fit(undefined, 35);
  }, [edges, nodes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || layoutRevision === 0) return;
    cy.layout({name: "cose", animate: false, padding: 40, nodeRepulsion: () => 12_000, idealEdgeLength: () => 110}).run();
    cy.fit(undefined, 35);
  }, [layoutRevision]);

  return <div ref={container} className="h-[520px] w-full rounded-lg bg-slate-50" aria-label="Interactive relationship network graph" />;
}
