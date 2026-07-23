export function sanitizeDatasetForLLM(dataset, options = {}) {
  if (!dataset) return null;
  return {
    datasetId: dataset.id || dataset.datasetId,
    datasetName: dataset.name || dataset.datasetName,
    rowCount: dataset.rowCount ?? dataset.rows?.length ?? 0,
    columns: (dataset.schema?.columns || dataset.columns || []).map((column) => ({
      name: column.name,
      type: column.type,
      role: column.role,
      semanticType: column.semanticType,
      nullable: column.nullable,
      missingRate: column.missingRate || column.missingPct || 0,
      cardinality: column.cardinality || column.uniqueCount || 0,
      isMetric: column.isMetric ?? (column.role === 'metric'),
      isDimension: column.isDimension ?? (column.role === 'dimension'),
      isDate: column.isDate ?? (column.role === 'date'),
      isGeo: column.isGeo ?? false,
    })),
    schemaSignature: dataset.schemaSignature || dataset.signature,
    domain: dataset.domain || dataset.dataType || dataset.detectedDomain,
    warnings: dataset.schemaWarnings || dataset.warnings || [],
  };
}

export function sanitizeAnalyticsResultForLLM(result) {
  if (!result) return null;
  return {
    datasetId: result.datasetId,
    rowCount: result.rowCount,
    selectedMetric: result.selectedMetric,
    kpis: result.kpis,
    charts: result.charts,
    correlations: result.correlations,
    anomalies: result.anomalies,
    segmentation: result.segmentation,
    drivers: result.drivers,
    forecast: result.forecast,
    dataHealth: result.dataHealth,
    warnings: result.warnings,
  };
}

export function assertNoRawRowsInLLMPayload(payload) {
  if (!payload) return true;

  const forbiddenKeys = [
    "rows",
    "data",
    "records",
    "rawRows",
    "rawData",
    "csv",
    "jsonRows",
    "previewRows",
    "sampleRows",
    "values",
    "fullDataset",
  ];

  const found = [];

  function walk(obj, path = "") {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (forbiddenKeys.includes(key)) {
        found.push(currentPath);
      }

      if (Array.isArray(value)) {
        if (value.length > 50 && typeof value[0] === "object") {
          found.push(currentPath);
        }
      }

      walk(value, currentPath);
    }
  }

  walk(payload);

  if (found.length) {
    throw new Error(
      `Blocked unsafe LLM payload. Raw dataset-like fields found: ${found.join(", ")}`
    );
  }

  return true;
}

export function assertNoRawRowsInString(text) {
  if (typeof text !== "string") return true;

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return assertNoRawRowsInLLMPayload(parsed);
    }
  } catch (e) {
    // Not a JSON string
  }

  const forbiddenPatterns = [
    /"rows"\s*:/i,
    /"records"\s*:/i,
    /"rawRows"\s*:/i,
    /"rawData"\s*:/i,
    /"previewRows"\s*:/i,
    /"sampleRows"\s*:/i,
    /"fullDataset"\s*:/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      throw new Error(`Blocked unsafe LLM payload. Raw rows key match found in prompt.`);
    }
  }

  // Check for CSV-like structure: many commas on multiple lines
  const lines = text.split("\n");
  let csvLikeLines = 0;
  for (const line of lines) {
    if (/[{}[\]:]/.test(line)) continue;
    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount >= 3) {
      csvLikeLines++;
    }
  }
  if (csvLikeLines > 15) {
    throw new Error("Blocked unsafe LLM payload. Detected raw CSV-like data block in prompt.");
  }

  return true;
}
