const DOMAINS = [
  "sales",
  "finance",
  "hr_salary",
  "ecommerce",
  "marketing",
  "crm",
  "saas",
  "banking_fraud",
  "healthcare_operations",
  "education",
  "real_estate",
  "manufacturing",
  "logistics",
  "insurance",
  "telecom",
  "energy",
];

export function generateSyntheticAgenticExamples() {
  return DOMAINS.flatMap((domain) => {
    return [
      {
        instruction: `Analyze this ${domain} dataset schema and create the best dashboard.`,
        input: {
          domain,
          schema: buildSyntheticSchema(domain),
        },
        output: {
          domain,
          kpis: buildSyntheticKpis(domain),
          charts: buildSyntheticCharts(domain),
          insights: buildSyntheticInsights(domain),
          nextActions: buildNextActions(domain),
        },
      },
      {
        instruction: `Act as a senior data analyst. Find risks and opportunities in ${domain} data.`,
        input: {
          domain,
          schema: buildSyntheticSchema(domain),
        },
        output: {
          risks: buildRisks(domain),
          opportunities: buildOpportunities(domain),
          recommendedQuestions: [
            "Which segment is underperforming?",
            "Which KPI needs immediate attention?",
            "What is the strongest growth opportunity?",
          ],
        },
      },
    ];
  });
}

function buildSyntheticSchema(domain) {
  const common = {
    sales: ["date", "product", "region", "revenue", "profit", "quantity"],
    finance: ["date", "department", "revenue", "expense", "budget", "actual"],
    hr_salary: ["employee_id", "department", "salary", "experience", "country", "education"],
    ecommerce: ["order_id", "customer_id", "product", "revenue", "discount", "return_status"],
    marketing: ["campaign", "channel", "spend", "clicks", "conversions", "revenue"],
    crm: ["customer_id", "segment", "mrr", "churn_status", "health_score", "nps"],
    saas: ["user_id", "event_time", "feature", "retention_rate", "activation_rate"],
    banking_fraud: ["transaction_id", "amount", "merchant", "country", "risk_score", "is_fraud"],
    healthcare_operations: ["patient_id", "department", "wait_time", "cost", "readmission_rate"],
    education: ["student_id", "course", "marks", "attendance", "grade"],
    real_estate: ["property_id", "city", "price", "area_sqft", "rental_yield"],
    manufacturing: ["batch_id", "machine_id", "defect_count", "oee", "downtime"],
    logistics: ["shipment_id", "carrier", "delay_days", "cost", "route"],
    insurance: ["claim_id", "claim_amount", "claim_type", "fraud_flag", "settlement_days"],
    telecom: ["customer_id", "plan", "monthly_bill", "data_usage_gb", "churn"],
    energy: ["meter_id", "timestamp", "consumption_kwh", "region", "tariff"],
  };

  return common[domain] || ["id", "date", "category", "value"];
}

function buildSyntheticKpis(domain) {
  const map = {
    sales: ["Total Revenue", "Total Profit", "Profit Margin", "Revenue Growth"],
    finance: ["Net Profit", "Budget Variance", "Expense Ratio", "Profit Margin"],
    hr_salary: ["Average Salary", "Median Salary", "Salary Spread", "Employee Count"],
    ecommerce: ["Total Revenue", "AOV", "Return Rate", "Payment Success Rate"],
    marketing: ["ROAS", "CTR", "CPA", "Conversion Rate"],
    crm: ["MRR", "Churn Rate", "NPS", "Customer Health Score"],
    saas: ["DAU", "Retention Rate", "Activation Rate", "Feature Adoption"],
  };

  return map[domain] || ["Total Records", "Primary Metric", "Growth Rate", "Quality Score"];
}

function buildSyntheticCharts(domain) {
  return [
    "Primary Metric Trend",
    "Top Segment Ranking",
    "Distribution Analysis",
    "Geo Map if location exists",
  ];
}

function buildSyntheticInsights(domain) {
  return [
    `${domain} analysis should prioritize business impact, not only raw counts.`,
    "Detect strongest driver, weakest segment, and most actionable opportunity.",
  ];
}

function buildNextActions(domain) {
  return [
    `Monitor core ${domain} KPIs daily.`,
    "Investigate outliers and underperforming segments.",
    "Create follow-up dashboard drilldowns.",
  ];
}

function buildRisks(domain) {
  return [
    `${domain} may contain outliers, missing values, weak segments, or misleading averages.`,
  ];
}

function buildOpportunities(domain) {
  return [
    `Use segment ranking and trend analysis to discover growth opportunities in ${domain}.`,
  ];
}
