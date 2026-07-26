export function executeStorytellingAgent(dashboardSpec, ontologyMapping) {
  const domain = ontologyMapping.inferredDomain;
  let summary = [];

  if (domain === 'sales' || domain === 'ecommerce') {
    summary = [
      "Revenue growth looks stable, but specific segments might be underperforming against targets.",
      "A small percentage of top-tier products are likely driving the majority of profitability.",
      "The largest opportunity lies in optimizing discount rates to protect margins without sacrificing volume."
    ];
  } else if (domain === 'hr_salary') {
    summary = [
      "Compensation spreads show normal distribution, but outliers exist in senior roles.",
      "Certain departments appear to consume a disproportionate amount of the salary budget.",
      "An opportunity exists to standardize pay bands and improve retention in high-turnover roles."
    ];
  } else {
    summary = [
      `Overall performance across the ${domain} domain requires deeper drill-down to isolate key drivers.`,
      "Top-performing segments are carrying the aggregate averages, masking weak points.",
      "The next immediate action should be investigating anomalies in the primary KPI distribution."
    ];
  }

  return { ...dashboardSpec, executiveSummary: summary };
}
