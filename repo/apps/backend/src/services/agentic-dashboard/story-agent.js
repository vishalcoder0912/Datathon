export function runStoryAgent({ schemaProfile, kpis, charts, geo, insights }) {
  return {
    title: `${schemaProfile.datasetName || "Dataset"} Dashboard Story`,
    summary: "Dashboard generated from schema profile, deterministic KPI rules, and validated chart intent.",
    sections: [
      { id: "overview", title: "Overview", itemCount: (kpis || []).length },
      { id: "analytics", title: "Analytics", itemCount: (charts || []).length },
      ...(geo?.enabled ? [{ id: "geo", title: "Geo Analysis", itemCount: geo.maps?.length || 0 }] : []),
      { id: "insights", title: "Insights", itemCount: (insights || []).length },
    ],
  };
}
