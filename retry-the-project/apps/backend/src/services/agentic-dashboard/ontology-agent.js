function scoreDomain(text, terms) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

export function runOntologyAgent(semanticProfile = {}, ragMatches = []) {
  const text = (semanticProfile.columns || [])
    .map((column) => `${column.name} ${column.semanticRole || column.role || ""}`)
    .join(" ")
    .toLowerCase();

  const scores = {
    workforce_salary: scoreDomain(text, ["salary", "compensation", "employee", "department", "experience", "ctc"]),
    sales_commerce: scoreDomain(text, ["revenue", "sales", "order", "profit", "product", "customer", "gmv"]),
    healthcare: scoreDomain(text, ["patient", "health", "diagnosis", "treatment", "hospital", "clinical"]),
    education: scoreDomain(text, ["student", "course", "marks", "grade", "attendance", "school"]),
    geo: scoreDomain(text, ["country", "state", "city", "region", "market", "territory"]),
  };

  const inferred = Object.entries(scores).sort((left, right) => right[1] - left[1])[0];
  const ragDomain = ragMatches.find((match) => match?.entry?.domain)?.entry?.domain;
  const domain = inferred?.[1] > 0 ? inferred[0] : semanticProfile.domain || ragDomain || "generic";

  return {
    domain,
    confidence: inferred?.[1] > 0 ? Math.min(0.95, 0.65 + inferred[1] * 0.08) : 0.55,
    ragSuggestedDomain: ragDomain || null,
    metricColumns: semanticProfile.numericColumns || [],
    dimensionColumns: semanticProfile.categoricalColumns || [],
    dateColumns: semanticProfile.dateColumns || [],
    geoColumns: semanticProfile.geoColumns || [],
  };
}
