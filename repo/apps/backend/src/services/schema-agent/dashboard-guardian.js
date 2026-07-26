export function validateDashboardSpec(profile, dashboardSpec) {
  const columns = new Set(profile.columns.map((c) => c.name));
  const warnings = [];
  const errors = [];

  function assertColumn(column, location) {
    if (!column) return;
    if (!columns.has(column)) {
      errors.push(`${location} references missing column: ${column}`);
    }
  }

  for (const kpi of dashboardSpec.kpis || []) {
    const calc = kpi.calculation || {};
    assertColumn(calc.column, `KPI ${kpi.id || kpi.title}`);
  }

  for (const chart of dashboardSpec.charts || []) {
    const calc = chart.calculation || {};
    assertColumn(calc.dimension, `Chart ${chart.id || chart.title}`);
    assertColumn(calc.x, `Chart ${chart.id || chart.title}`);
    assertColumn(calc.y, `Chart ${chart.id || chart.title}`);
    assertColumn(calc.metric?.column, `Chart ${chart.id || chart.title}`);
  }

  if (!dashboardSpec.kpis?.length) {
    warnings.push('Dashboard has no KPI cards.');
  }

  if (!dashboardSpec.charts?.length) {
    warnings.push('Dashboard has no charts.');
  }

  if ((dashboardSpec.charts || []).length > 8) {
    warnings.push('Dashboard has too many charts. Keep 5-7 useful charts for readability.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
