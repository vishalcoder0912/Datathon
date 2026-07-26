function hasRole(profile, rolePart) {
  return (profile.columns || []).some((c) =>
    String(c.role || "").toLowerCase().includes(rolePart)
  );
}

function hasType(profile, type) {
  return (profile.columns || []).some((c) =>
    String(c.type || "").toLowerCase() === type
  );
}

function hasChart(plan, type) {
  return (plan.charts || []).some((c) =>
    String(c.type || "").toLowerCase().includes(type)
  );
}

function hasMoneyKpi(plan) {
  return (plan.kpis || []).some((k) =>
    /revenue|sales|salary|profit|cost|expense|margin|amount/i.test(k.title || "")
  );
}

export function validateAgenticDashboardPlan(profile, plan) {
  const issues = [];
  const fixes = [];

  const hasMoney = hasRole(profile, "money") || hasRole(profile, "profit") || hasRole(profile, "cost");
  const hasTime = hasRole(profile, "time") || hasType(profile, "date");
  const hasGeo = hasRole(profile, "geo") || ["country", "city", "state", "region"].some((word) =>
    (profile.columns || []).some((c) => c.name.toLowerCase().includes(word))
  );

  if (hasMoney && !hasMoneyKpi(plan)) {
    issues.push("Money metric exists but dashboard does not prioritize financial KPI.");
    fixes.push("Add Total Revenue / Average Salary / Profit / Cost KPI based on detected metric.");
  }

  if (hasTime && !hasChart(plan, "line")) {
    issues.push("Time column exists but no trend chart found.");
    fixes.push("Add line chart for metric over time.");
  }

  if (hasGeo && !hasChart(plan, "geo")) {
    issues.push("Geo column exists but no global map found.");
    fixes.push("Add geo map / choropleth chart.");
  }

  if ((plan.charts || []).some((c) => c.type === "pie" && /id|name|email/i.test(c.xKey || ""))) {
    issues.push("Pie chart uses high-cardinality identifier field.");
    fixes.push("Replace pie chart with ranking bar chart or grouped table.");
  }

  return {
    valid: issues.length === 0,
    score: Math.max(0, 100 - issues.length * 15),
    issues,
    fixes,
  };
}
