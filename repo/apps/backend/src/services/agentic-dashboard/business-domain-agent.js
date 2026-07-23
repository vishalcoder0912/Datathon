const DOMAIN_LABELS = {
  workforce_salary: "Workforce Salary Analytics",
  salary_analytics: "Salary Analytics",
  sales_commerce: "Sales and Commerce Analytics",
  healthcare: "Healthcare Analytics",
  education: "Education Analytics",
  geo: "Geographic Analytics",
  generic: "General Analytics",
};

const DOMAIN_TERMS = {
  workforce_salary: ["salary", "compensation", "ctc", "employee", "experience", "department"],
  sales_commerce: ["revenue", "sales", "order", "orders", "profit", "product", "customer", "gmv"],
  healthcare: ["patient", "patients", "diagnosis", "treatment", "hospital", "clinical", "disease"],
  education: ["student", "course", "grade", "marks", "attendance", "school", "exam"],
  geo: ["country", "state", "city", "region", "territory", "market"],
};

function scoreTerms(text, terms) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

export function runBusinessDomainAgent({ semanticProfile = {}, ontology = {} } = {}) {
  const text = [
    ontology.domain,
    ...(semanticProfile.columns || []).map((column) => `${column.name} ${column.semanticRole || column.role || ""}`),
  ].join(" ").toLowerCase();

  const scored = Object.entries(DOMAIN_TERMS)
    .map(([domain, terms]) => ({ domain, score: scoreTerms(text, terms) }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const domain = best?.score > 0 ? best.domain : ontology.domain || semanticProfile.domain || "generic";

  return {
    domain,
    label: DOMAIN_LABELS[domain] || DOMAIN_LABELS.generic,
    confidence: best?.score > 0 ? Math.min(0.96, 0.68 + best.score * 0.07) : 0.55,
    businessMetrics: semanticProfile.numericColumns || [],
    businessDimensions: semanticProfile.categoricalColumns || [],
    governance: {
      fakeMetricPolicy: "reject",
      rowIndexTrendPolicy: "reject",
      unsupportedInsightPolicy: "reject",
    },
  };
}
