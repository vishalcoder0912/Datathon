function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.slice(1).toLowerCase());
}

function choosePrimaryTarget(profile) {
  if (profile.targets?.length) return profile.targets[0];

  const numeric = profile.columns.filter((c) => c.detectedType === 'number');
  const preferred = numeric.find((c) =>
    /salary|revenue|profit|sales|amount|price|score|income/i.test(c.name)
  );

  return preferred?.name || numeric[0]?.name || null;
}

function lowCardinalityDimensions(profile) {
  return profile.columns
    .filter((c) => c.role === 'dimension' && c.uniqueCount <= 30 && !c.isMultiValue)
    .sort((a, b) => a.uniqueCount - b.uniqueCount);
}

function numericMeasures(profile, target) {
  return profile.columns
    .filter((c) => c.detectedType === 'number' && c.name !== target)
    .map((c) => c.name);
}

export function buildDashboardSpec(profile, options = {}) {
  const target = choosePrimaryTarget(profile);
  const dimensions = lowCardinalityDimensions(profile);
  const numeric = numericMeasures(profile, target);
  const charts = [];
  const kpis = [];
  const filters = [];

  kpis.push({
    id: 'total_rows',
    title: 'Total Rows',
    calculation: { type: 'count_rows' },
    format: 'integer',
  });

  kpis.push({
    id: 'data_quality_score',
    title: 'Data Quality Score',
    calculation: { type: 'quality_score' },
    format: 'percent',
  });

  if (target) {
    kpis.push({
      id: `avg_${target}`,
      title: `Average ${titleCase(target)}`,
      calculation: { type: 'avg', column: target },
      format: target.toLowerCase().includes('salary') || target.toLowerCase().includes('usd') ? 'currency_usd' : 'number',
    });

    kpis.push({
      id: `median_${target}`,
      title: `Median ${titleCase(target)}`,
      calculation: { type: 'median', column: target },
      format: target.toLowerCase().includes('salary') || target.toLowerCase().includes('usd') ? 'currency_usd' : 'number',
    });

    kpis.push({
      id: `max_${target}`,
      title: `Highest ${titleCase(target)}`,
      calculation: { type: 'max', column: target },
      format: target.toLowerCase().includes('salary') || target.toLowerCase().includes('usd') ? 'currency_usd' : 'number',
    });
  }

  const experience = profile.columns.find((c) => /experience|age|years/i.test(c.name) && c.detectedType === 'number');
  if (experience) {
    kpis.push({
      id: `avg_${experience.name}`,
      title: `Average ${titleCase(experience.name)}`,
      calculation: { type: 'avg', column: experience.name },
      format: 'number',
    });
  }

  if (target) {
    const bestSegment = dimensions.find((d) => /country|region|state|city/i.test(d.name)) || dimensions[0];

    if (bestSegment) {
      charts.push({
        id: `avg_${target}_by_${bestSegment.name}`,
        title: `Average ${titleCase(target)} by ${titleCase(bestSegment.name)}`,
        type: 'bar',
        calculation: {
          metric: { aggregation: 'avg', column: target },
          dimension: bestSegment.name,
          sort: 'desc',
          limit: 12,
        },
        reason: 'Shows which segment has the highest average target value.',
      });
    }

    charts.push({
      id: `${target}_distribution`,
      title: `${titleCase(target)} Distribution`,
      type: 'histogram',
      calculation: {
        metric: { aggregation: 'count', column: target },
        dimension: target,
        bins: 12,
      },
      reason: 'Shows spread, skewness, and concentration of the target metric.',
    });

    if (experience && experience.name !== target) {
      charts.push({
        id: `${target}_vs_${experience.name}`,
        title: `${titleCase(target)} vs ${titleCase(experience.name)}`,
        type: 'scatter',
        calculation: {
          x: experience.name,
          y: target,
          trendline: true,
        },
        reason: 'Shows relationship between experience and salary/target.',
      });
    }

    for (const dim of dimensions) {
      if (charts.length >= 7) break;
      if (bestSegment && dim.name === bestSegment.name) continue;
      charts.push({
        id: `avg_${target}_by_${dim.name}`,
        title: `Average ${titleCase(target)} by ${titleCase(dim.name)}`,
        type: 'bar',
        calculation: {
          metric: { aggregation: 'avg', column: target },
          dimension: dim.name,
          sort: 'desc',
          limit: 12,
        },
        reason: `Compares ${titleCase(target)} across ${titleCase(dim.name)} segments.`,
      });
    }
  }

  for (const multi of profile.multiValueColumns || []) {
    if (charts.length >= 7) break;
    charts.push({
      id: `top_${multi}`,
      title: `Top ${titleCase(multi)} by Records`,
      type: 'bar',
      calculation: {
        metric: { aggregation: 'count_rows' },
        dimension: multi,
        splitMultiValue: true,
        separator: ',',
        sort: 'desc',
        limit: 10,
      },
      reason: `Splits ${titleCase(multi)} values and ranks them by frequency.`,
    });
  }

  for (const dim of dimensions) {
    filters.push({
      column: dim.name,
      type: 'multi_select',
      title: titleCase(dim.name),
    });
  }

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    mode: 'schema-aware-agentic-dashboard',
    datasetId: profile.datasetId,
    primaryTarget: target,
    kpis: kpis.slice(0, 6),
    charts: charts.slice(0, 7),
    filters: filters.slice(0, 8),
    agentRules: [
      'LLM plans dashboard only.',
      'All KPI values are calculated from rows.',
      'Regenerate this spec when schema or dataset fingerprint changes.',
      'Use Dashboard Guardian to validate referenced columns before rendering.',
    ],
  };
}
