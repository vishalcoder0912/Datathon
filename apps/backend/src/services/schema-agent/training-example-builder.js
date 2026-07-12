function compactSchema(profile) {
  return {
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    columns: profile.columns.map((c) => ({
      name: c.name,
      type: c.detectedType,
      role: c.role,
      uniqueCount: c.uniqueCount,
      missingCount: c.missingCount,
      isMultiValue: c.isMultiValue,
    })),
    measures: profile.measures,
    dimensions: profile.dimensions,
    targets: profile.targets,
    multiValueColumns: profile.multiValueColumns,
    quality: profile.quality,
  };
}

export function buildTrainingExamples(profile, dashboardSpec) {
  const schema = compactSchema(profile);

  return [
    {
      task: 'schema_to_dashboard',
      instruction: 'Build a professional analytics dashboard from this schema. Do not calculate KPI values. Return only dashboard spec JSON.',
      input: { schema },
      output: dashboardSpec,
    },
    {
      task: 'schema_to_kpi_plan',
      instruction: 'Choose KPI cards for this schema. Prefer business metrics, target metrics, quality metrics, and row count.',
      input: { schema },
      output: { kpis: dashboardSpec.kpis },
    },
    {
      task: 'schema_to_chart_plan',
      instruction: 'Choose useful charts for this schema. Prefer target by segment, distribution, relationship, and top category charts.',
      input: { schema },
      output: { charts: dashboardSpec.charts },
    },
    {
      task: 'schema_rules',
      instruction: 'Write strict rules for this schema so future similar uploads generate the correct dashboard.',
      input: { schema },
      output: {
        rules: [
          'Detect target numeric columns before creating dashboard.',
          'Use low-cardinality categorical columns as filters and dimensions.',
          'Use multi-value columns with split logic for ranking charts.',
          'Never hallucinate values; all values must be calculated by analytics tools.',
          'Regenerate dashboard when dataset fingerprint changes.',
        ],
      },
    },
  ];
}
