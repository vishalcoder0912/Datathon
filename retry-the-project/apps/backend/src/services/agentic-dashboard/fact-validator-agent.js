const UNKNOWN =
  "Based on the current schema and available analytics, this cannot be determined.";

export function validateChatAnswer({ answer, schemaProfile, dashboard, ragMatches = [] }) {
  const text = String(answer || "").toLowerCase();
  const allowedTerms = new Set();

  for (const col of schemaProfile.columns || []) {
    allowedTerms.add(String(col.name).toLowerCase());
    if (col.title) allowedTerms.add(String(col.title).toLowerCase());
  }

  for (const kpi of dashboard?.kpis || []) {
    allowedTerms.add(String(kpi.title).toLowerCase());
    allowedTerms.add(String(kpi.metric).toLowerCase());
  }

  for (const chart of dashboard?.charts || []) {
    allowedTerms.add(String(chart.title).toLowerCase());
    if (chart.xKey) allowedTerms.add(String(chart.xKey).toLowerCase());
    if (chart.yKey) allowedTerms.add(String(chart.yKey).toLowerCase());
  }

  for (const match of ragMatches || []) {
    if (match?.entry?.domain) allowedTerms.add(String(match.entry.domain).toLowerCase());
  }

  const riskyClaims = ["revenue", "salary", "profit", "conversion", "refund", "patients", "orders"];
  const hallucinated = riskyClaims.some((term) =>
    text.includes(term) && !Array.from(allowedTerms).some((allowed) => allowed.includes(term))
  );

  if (hallucinated) {
    return {
      valid: false,
      answer: UNKNOWN,
      reason: "Answer mentioned a business metric not grounded in schema, KPIs, charts, or RAG.",
    };
  }

  return {
    valid: true,
    answer,
  };
}
