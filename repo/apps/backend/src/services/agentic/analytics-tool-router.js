export function routeAnalyticsTools(agentPlan) {
  const tools = [];

  for (const task of agentPlan.tasks) {
    if (task === "profile_dataset") tools.push("schema_profiler");
    if (task === "detect_domain") tools.push("domain_detector");
    if (task === "retrieve_schema_rag_memory") tools.push("schema_rag_retriever");
    if (task === "select_kpis") tools.push("kpi_engine");
    if (task === "build_dashboard_plan") tools.push("dashboard_plan_engine");
    if (task === "generate_insights") tools.push("senior_analyst_brain");
    if (task === "validate_dashboard_quality") tools.push("dashboard_quality_guardian");
    if (task === "time_series_analysis") tools.push("time_series_agent");
    if (task === "geo_intelligence") tools.push("geo_agent");
    if (task === "financial_metric_analysis") tools.push("finance_agent");
    if (task === "ml_recommendation") tools.push("automl_agent");
  }

  return [...new Set(tools)];
}
