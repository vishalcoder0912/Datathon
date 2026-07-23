export function buildAnalyticsAgentPlan({ schemaProfile, userGoal = "" }) {
  const columns = schemaProfile.columns || [];

  const hasDate = columns.some((c) =>
    /date|time|timestamp|month|year/i.test(c.name)
  );

  const hasGeo = columns.some((c) =>
    /country|state|city|region|location|lat|lng|latitude|longitude/i.test(c.name)
  );

  const hasMoney = columns.some((c) =>
    /revenue|sales|salary|amount|price|profit|cost|expense|budget|margin/i.test(c.name)
  );

  const hasTarget = columns.some((c) =>
    /churn|fraud|target|label|status|outcome|prediction/i.test(c.name)
  );

  const tasks = [
    "profile_dataset",
    "detect_domain",
    "retrieve_schema_rag_memory",
    "select_kpis",
    "build_dashboard_plan",
    "generate_insights",
    "validate_dashboard_quality",
  ];

  if (hasDate) tasks.push("time_series_analysis");
  if (hasGeo) tasks.push("geo_intelligence");
  if (hasMoney) tasks.push("financial_metric_analysis");
  if (hasTarget) tasks.push("ml_recommendation");
  if (userGoal) tasks.push("user_goal_alignment");

  return {
    agentType: "pure_agentic_data_analyst",
    goal: userGoal || "Automatically generate the best analytics dashboard and insights.",
    tasks,
    reasoningRules: [
      "Prefer business KPIs over raw counts.",
      "Use trend charts when date columns exist.",
      "Use global map when geo columns exist.",
      "Use median when numeric data likely contains outliers.",
      "Use ML recommendation when target/label exists.",
      "Never generate charts without analytical meaning.",
    ],
  };
}
