"""NetworkX-powered case-link analysis with explicit evidence on every edge."""

from __future__ import annotations

from collections import defaultdict
from itertools import combinations
from typing import Any

try:
    import networkx as nx
except Exception:  # pragma: no cover - normal deployment installs NetworkX
    nx = None

from .common import (
    PROTOTYPE_DISCLAIMER,
    case_identifier,
    coordinates,
    district_identifier,
    extract_person_roles,
    mask_person_identifier,
    stable_identifier,
    station_identifier,
    value_for,
)

MODEL_VERSION = "case-network-1.0.0"
MAX_DERIVED_PAIR_EDGES = 250

ROLE_EDGE = {
    "ACCUSED": "ACCUSED_IN",
    "VICTIM": "VICTIM_IN",
    "COMPLAINANT": "COMPLAINANT_IN",
    "ARRESTED_PERSON": "ARRESTED_IN",
    "ASSOCIATE": "ASSOCIATED_WITH",
    "PERSON_OF_INTEREST": "ASSOCIATED_WITH",
    "WITNESS": "ASSOCIATED_WITH",
}

ALLOWED_EDGE_TYPES = {
    "ACCUSED_IN",
    "VICTIM_IN",
    "COMPLAINANT_IN",
    "ARRESTED_IN",
    "OCCURRED_AT",
    "REGISTERED_AT",
    "IN_DISTRICT",
    "USES_MO",
    "INVOKES_SECTION",
    "CO_ACCUSED_WITH",
    "SHARED_LOCATION",
    "SHARED_MO",
    "ASSOCIATED_WITH",
}

ALLOWED_NODE_TYPES = {"PERSON", "CASE", "LOCATION", "POLICE_STATION", "DISTRICT", "VEHICLE", "ACT_SECTION", "MODUS_OPERANDI"}


def _node_label(node_type: str, identifier: str) -> str:
    if node_type == "PERSON":
        return mask_person_identifier(identifier)
    if node_type == "CASE":
        return f"Case • {identifier[-8:]}"
    if node_type == "LOCATION":
        return "Approximate incident location"
    if node_type == "POLICE_STATION":
        return f"Station • {identifier}"
    if node_type == "DISTRICT":
        return f"District • {identifier}"
    if node_type == "MODUS_OPERANDI":
        return f"MO • {identifier[-6:]}"
    return f"{node_type.title()} • {identifier[-8:]}"


def _node_id(node_type: str, identifier: str) -> str:
    return f"{node_type.lower()}:{identifier}"


def _location_identifier(record: dict[str, Any]) -> str | None:
    point = coordinates(record)
    if point is None:
        return None
    return f"{round(point[0], 4)}:{round(point[1], 4)}"


def _mo_identifier(record: dict[str, Any]) -> str | None:
    value = value_for(record, "mo_id", "moId", "modus_operandi_id", "modusOperandiId")
    if value is not None:
        return str(value)
    text = value_for(record, "mo_text", "moText", "modus_operandi", "modusOperandi")
    return stable_identifier("mo", str(text).casefold()) if text else None


def _act_sections(record: dict[str, Any]) -> list[str]:
    raw = value_for(record, "act_sections", "actSections", "sections", default=[])
    if not isinstance(raw, list):
        raw = [raw]
    values: list[str] = []
    for item in raw:
        if isinstance(item, dict):
            act = value_for(item, "act_code", "actCode")
            section = value_for(item, "section_code", "sectionCode")
            if act and section:
                values.append(f"{act}:{section}")
        elif item:
            values.append(str(item))
    return list(dict.fromkeys(values))


def build_network(
    records: list[dict[str, Any]],
    *,
    relationships: list[dict[str, Any]],
    maximum_nodes: int,
    minimum_edge_weight: int,
    focus_node_id: str | None = None,
    shortest_path_from: str | None = None,
    shortest_path_to: str | None = None,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Create a privacy-safe graph from case links and supplied relationship rows."""

    if not records and not relationships:
        return {
            "status": "insufficient_data",
            "minimumRequired": 1,
            "available": 0,
            "nodes": [],
            "edges": [],
            "modelVersion": model_version or MODEL_VERSION,
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    nodes: dict[str, dict[str, Any]] = {}
    edges: dict[tuple[str, str, str], dict[str, Any]] = {}
    case_districts: dict[str, str] = {}
    person_districts: dict[str, set[str]] = defaultdict(set)
    person_cases: dict[str, set[str]] = defaultdict(set)
    location_cases: dict[str, list[str]] = defaultdict(list)
    mo_cases: dict[str, list[str]] = defaultdict(list)

    def add_node(node_type: str, identifier: str) -> str:
        node_type = node_type if node_type in ALLOWED_NODE_TYPES else "PERSON"
        node_id = _node_id(node_type, identifier)
        nodes.setdefault(node_id, {"id": node_id, "type": node_type, "label": _node_label(node_type, identifier)})
        return node_id

    def add_edge(source: str, target: str, relationship: str, evidence: dict[str, Any], weight: int = 1) -> None:
        if relationship not in ALLOWED_EDGE_TYPES or source == target:
            return
        key = (source, target, relationship)
        item = edges.setdefault(
            key,
            {
                "id": stable_identifier("edge", source, target, relationship),
                "source": source,
                "target": target,
                "relationship": relationship,
                "weight": 0,
                "evidence": [],
            },
        )
        item["weight"] += weight
        if evidence and evidence not in item["evidence"] and len(item["evidence"]) < 20:
            item["evidence"].append(evidence)

    for index, record in enumerate(records):
        case_id = case_identifier(record, index)
        case_node = add_node("CASE", case_id)
        district = district_identifier(record)
        station = station_identifier(record)
        if district:
            district_node = add_node("DISTRICT", district)
            add_edge(case_node, district_node, "IN_DISTRICT", {"caseId": case_id, "reason": "The case is registered in this district."})
            case_districts[case_id] = district
        if station:
            station_node = add_node("POLICE_STATION", station)
            add_edge(case_node, station_node, "REGISTERED_AT", {"caseId": case_id, "reason": "The case is registered at this police station."})
        location = _location_identifier(record)
        if location:
            location_node = add_node("LOCATION", location)
            add_edge(case_node, location_node, "OCCURRED_AT", {"caseId": case_id, "reason": "The supplied case has this approximate incident coordinate."})
            location_cases[location].append(case_id)
        mo = _mo_identifier(record)
        if mo:
            mo_node = add_node("MODUS_OPERANDI", mo)
            add_edge(case_node, mo_node, "USES_MO", {"caseId": case_id, "reason": "The supplied case records this modus-operandi feature set."})
            mo_cases[mo].append(case_id)
        for section in _act_sections(record):
            section_node = add_node("ACT_SECTION", section)
            add_edge(case_node, section_node, "INVOKES_SECTION", {"caseId": case_id, "reason": "This legal act/section is associated with the case."})
        accused_nodes: list[str] = []
        for person_id, role in extract_person_roles(record):
            person_node = add_node("PERSON", person_id)
            relationship = ROLE_EDGE.get(role, "ASSOCIATED_WITH")
            add_edge(
                person_node,
                case_node,
                relationship,
                {"caseId": case_id, "reason": f"The supplied case links this canonical person in the {role} role."},
            )
            person_cases[person_id].add(case_id)
            if district:
                person_districts[person_id].add(district)
            if role == "ACCUSED":
                accused_nodes.append(person_node)
        for source, target in combinations(sorted(set(accused_nodes)), 2):
            add_edge(
                source,
                target,
                "CO_ACCUSED_WITH",
                {"caseId": case_id, "reason": "Both canonical persons are listed as accused in this supplied case."},
            )

    derived_count = 0
    for location, case_ids in sorted(location_cases.items()):
        for left, right in combinations(sorted(set(case_ids)), 2):
            if derived_count >= MAX_DERIVED_PAIR_EDGES:
                break
            add_edge(
                _node_id("CASE", left),
                _node_id("CASE", right),
                "SHARED_LOCATION",
                {"caseIds": [left, right], "reason": "Both cases use the same rounded synthetic incident coordinate."},
            )
            derived_count += 1
    for mo, case_ids in sorted(mo_cases.items()):
        for left, right in combinations(sorted(set(case_ids)), 2):
            if derived_count >= MAX_DERIVED_PAIR_EDGES:
                break
            add_edge(
                _node_id("CASE", left),
                _node_id("CASE", right),
                "SHARED_MO",
                {"caseIds": [left, right], "reason": "Both cases share a supplied modus-operandi identifier or normalized feature text."},
            )
            derived_count += 1

    for relation in relationships:
        source = str(value_for(relation, "source_id", "sourceId", "source") or "")
        target = str(value_for(relation, "target_id", "targetId", "target") or "")
        relationship = str(value_for(relation, "relationship_type", "relationshipType", "relationship") or "")
        source_type = str(value_for(relation, "source_type", "sourceType") or "PERSON").upper()
        target_type = str(value_for(relation, "target_type", "targetType") or "PERSON").upper()
        if not source or not target or relationship not in ALLOWED_EDGE_TYPES:
            continue
        source_node = source if source.startswith(f"{source_type.casefold()}:") else add_node(source_type, source)
        target_node = target if target.startswith(f"{target_type.casefold()}:") else add_node(target_type, target)
        if source_node not in nodes:
            add_node(source_type, source_node.split(":", 1)[-1])
        if target_node not in nodes:
            add_node(target_type, target_node.split(":", 1)[-1])
        add_edge(
            source_node,
            target_node,
            relationship,
            {
                "caseId": value_for(relation, "case_master_id", "caseId", "crimeNo"),
                "reason": str(value_for(relation, "evidence_text", "evidenceText", "reason", default="Supplied relationship evidence.")),
            },
            int(value_for(relation, "weight", default=1) or 1),
        )

    filtered_edges = [edge for edge in edges.values() if edge["weight"] >= minimum_edge_weight]
    if nx is None:
        return {
            "status": "degraded",
            "nodes": list(nodes.values())[:maximum_nodes],
            "edges": filtered_edges,
            "recordCount": len(records),
            "algorithm": "deterministic_edge_builder",
            "modelVersion": model_version or MODEL_VERSION,
            "limitations": ["NetworkX is unavailable; centrality and community metrics were not computed."],
            "humanReviewRequired": True,
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    graph = nx.Graph()
    graph.add_nodes_from(nodes)
    for edge in filtered_edges:
        source = edge["source"]
        target = edge["target"]
        graph.add_edge(source, target, weight=graph.get_edge_data(source, target, {}).get("weight", 0) + edge["weight"])

    degree = nx.degree_centrality(graph) if graph.number_of_nodes() > 1 else {node_id: 0.0 for node_id in graph.nodes}
    weighted_degree = {node_id: float(graph.degree(node_id, weight="weight")) for node_id in graph.nodes}
    betweenness = nx.betweenness_centrality(graph, weight="weight", normalized=True) if graph.number_of_nodes() > 2 else {node_id: 0.0 for node_id in graph.nodes}
    pagerank = nx.pagerank(graph, weight="weight") if graph.number_of_edges() else {node_id: 0.0 for node_id in graph.nodes}
    try:
        eigenvector = nx.eigenvector_centrality(graph, weight="weight", max_iter=1000) if graph.number_of_edges() else {node_id: 0.0 for node_id in graph.nodes}
    except Exception:
        eigenvector = {node_id: 0.0 for node_id in graph.nodes}

    for node_id, node in nodes.items():
        node["metrics"] = {
            "degreeCentrality": round(float(degree.get(node_id, 0.0)), 5),
            "weightedDegree": round(float(weighted_degree.get(node_id, 0.0)), 5),
            "betweennessCentrality": round(float(betweenness.get(node_id, 0.0)), 5),
            "pageRank": round(float(pagerank.get(node_id, 0.0)), 5),
            "eigenvectorCentrality": round(float(eigenvector.get(node_id, 0.0)), 5),
        }

    communities: list[set[str]]
    if graph.number_of_edges() and graph.number_of_nodes() >= 3:
        try:
            communities = [set(group) for group in nx.community.louvain_communities(graph, weight="weight")]
        except AttributeError:
            try:
                communities = [set(group) for group in nx.community.greedy_modularity_communities(graph, weight="weight")]
            except Exception:
                communities = [set(group) for group in nx.connected_components(graph)]
        except Exception:
            communities = [set(group) for group in nx.connected_components(graph)]
    else:
        communities = [set(group) for group in nx.connected_components(graph)]
    community_index = {node_id: index for index, group in enumerate(communities) for node_id in group}
    for node_id, node in nodes.items():
        node["community"] = community_index.get(node_id)

    shortest_path: list[str] | None = None
    if shortest_path_from and shortest_path_to:
        try:
            shortest_path = nx.shortest_path(graph, shortest_path_from, shortest_path_to, weight="weight")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            shortest_path = None

    if focus_node_id and focus_node_id in graph:
        kept_node_ids = {focus_node_id, *graph.neighbors(focus_node_id)}
    else:
        kept_node_ids = set(nodes)
    if len(kept_node_ids) > maximum_nodes:
        kept_node_ids = set(
            sorted(kept_node_ids, key=lambda node_id: (-pagerank.get(node_id, 0.0), node_id))[:maximum_nodes]
        )
    visible_nodes = [nodes[node_id] for node_id in sorted(kept_node_ids)]
    visible_edges = [edge for edge in filtered_edges if edge["source"] in kept_node_ids and edge["target"] in kept_node_ids]
    central_people = [node for node in visible_nodes if node["type"] == "PERSON"]
    central_people.sort(key=lambda node: (-node["metrics"]["pageRank"], node["id"]))
    bridges = [
        {
            "personId": _node_id("PERSON", person_id),
            "label": mask_person_identifier(person_id),
            "districtIds": sorted(districts),
            "caseCount": len(person_cases[person_id]),
            "reason": "The canonical person is linked as an accused across more than one supplied district.",
        }
        for person_id, districts in person_districts.items()
        if len(districts) > 1
    ]
    return {
        "status": "ok",
        "nodes": visible_nodes,
        "edges": visible_edges,
        "components": [sorted(component) for component in nx.connected_components(graph)],
        "communities": [{"communityId": index, "nodeIds": sorted(group)} for index, group in enumerate(communities)],
        "centralPersons": central_people[:25],
        "crossDistrictBridges": bridges,
        "shortestPath": shortest_path,
        "recordCount": len(records),
        "nodeCount": len(visible_nodes),
        "edgeCount": len(visible_edges),
        "algorithm": "networkx_degree_betweenness_pagerank_greedy_modularity",
        "modelVersion": model_version or MODEL_VERSION,
        "limitations": [
            "Edges represent supplied case-record associations and require human verification; they do not establish guilt or criminal conspiracy.",
            "Person labels are masked by design and raw victim/complainant identity details are not returned.",
        ],
        "humanReviewRequired": True,
        "disclaimer": PROTOTYPE_DISCLAIMER,
    }
