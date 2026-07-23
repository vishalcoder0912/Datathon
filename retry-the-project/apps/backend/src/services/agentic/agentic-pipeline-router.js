import { chooseAnalyticsExecutionPolicy } from "../performance/analytics-execution-policy.js";

function lower(value = "") {
  return String(value || "").toLowerCase();
}

function hasRole(profile, role) {
  return (profile?.columns || []).some((column) => column.role === role);
}

function hasColumn(profile, pattern) {
  return (profile?.columns || []).some((column) => pattern.test(lower(column.name)));
}

function fileExtension(dataset = {}) {
  const name = dataset.fileName || dataset.originalFilePath || dataset.optimizedFilePath || "";
  const match = String(name).match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function selectAgenticPipeline({ dataset = {}, schemaProfile = {} }) {
  const policy = chooseAnalyticsExecutionPolicy(dataset);
  const extension = fileExtension(dataset);
  const rowCount = Number(schemaProfile.rowCount || dataset.rowCount || dataset.rows?.length || 0);
  const hasMetric = hasRole(schemaProfile, "metric");
  const hasDate = hasRole(schemaProfile, "date") || hasColumn(schemaProfile, /date|time|month|year|timestamp/);
  const hasGeo = hasColumn(schemaProfile, /country|region|state|city|location|territory|province|geo|lat|lon|longitude|latitude/);
  const hasText = hasRole(schemaProfile, "text") || hasColumn(schemaProfile, /comment|review|description|summary|message|text/);
  const hasSales = hasColumn(schemaProfile, /sales|revenue|amount|profit|price|order|customer/);
  const hasHr = hasColumn(schemaProfile, /employee|salary|department|education|attrition|hiring|performance/);
  const hasFinance = hasColumn(schemaProfile, /balance|expense|income|cost|margin|budget|invoice|payment/);

  let selectedPipeline = "generic-exploration";
  const reasons = [];

  if (extension === "pdf") {
    selectedPipeline = "pdf-table-rag";
    reasons.push("PDF input uses table extraction and RAG.");
  } else if (extension === "xlsx" || extension === "xls") {
    selectedPipeline = "excel-multi-sheet";
    reasons.push("Excel input may contain multiple sheets.");
  } else if (extension === "json") {
    selectedPipeline = "json-flattened";
    reasons.push("JSON input should be flattened before analytics.");
  } else if (policy.mode === "fast-analytics-service") {
    selectedPipeline = "large-csv-duckdb";
    reasons.push(policy.reason);
  } else if (hasGeo) {
    selectedPipeline = "geo-intelligence";
    reasons.push("Geographic columns detected.");
  } else if (hasDate && hasMetric) {
    selectedPipeline = "time-series";
    reasons.push("Date and metric columns support trend analysis.");
  } else if (hasSales) {
    selectedPipeline = "sales-dashboard";
    reasons.push("Sales or revenue semantics detected.");
  } else if (hasHr) {
    selectedPipeline = "hr-dashboard";
    reasons.push("HR semantics detected.");
  } else if (hasFinance) {
    selectedPipeline = "finance-dashboard";
    reasons.push("Finance semantics detected.");
  } else if (hasText && !hasMetric) {
    selectedPipeline = "text-heavy-rag";
    reasons.push("Text-heavy schema detected.");
  } else if (extension === "csv" || extension === "txt" || rowCount > 0) {
    selectedPipeline = "small-csv-memory";
    reasons.push("Dataset can use local deterministic execution.");
  }

  return {
    selectedPipeline,
    executionPolicy: policy,
    reasons,
    rawRowsSentToLlm: false,
  };
}

export default {
  selectAgenticPipeline,
};
