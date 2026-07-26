import type {
  ChartCommand,
  ChartType,
  ChartCustomizationOptions,
} from "@/features/dashboard/types/chartManagementTypes";

// Keywords for parsing chart commands
const commandKeywords = {
  create: ["create", "add", "new", "generate", "make", "build"],
  remove: ["remove", "delete", "eliminate"],
  modify: ["change", "update", "edit", "modify", "set"],
  duplicate: ["copy", "duplicate", "clone"],
  toggle: ["toggle", "hide", "unhide", "visibility"],
};

const chartTypeKeywords: Record<string, ChartType> = {
  bar: ["bar", "bars", "barchart", "column"],
  line: ["line", "lines", "trend", "time-series"],
  scatter: ["scatter", "dots", "points", "xy"],
  donut: ["donut", "doughnut", "pie"],
  histogram: ["histogram", "hist", "distribution"],
  table: ["table", "list", "ranking", "rows"],
};

const customizationKeywords = {
  colors: ["color", "colours", "palette", "hue", "shade", "vibrant", "theme"],
  legend: ["legend", "key", "labels"],
  grid: ["grid", "gridlines", "lines"],
  tooltip: ["tooltip", "hover", "info"],
  title: ["title", "name", "heading", "label"],
  axis: ["axis", "axes", "scale", "range"],
};

export function parseChartCommand(query: string): ChartCommand | null {
  const lowerQuery = query.toLowerCase();
  let action: ChartCommand["action"] = "create";
  let confidence = 0;
  let chartType: ChartType | null = null;
  let explanation = "";
  const customizations: Partial<ChartCustomizationOptions> = {};
  let hasCustomization = false;

  // Detect action
  if (
    commandKeywords.remove.some((keyword) => lowerQuery.includes(keyword)) &&
    !commandKeywords.create.some((keyword) => lowerQuery.includes(keyword))
  ) {
    action = "remove";
    confidence += 0.3;
    explanation = "User wants to remove a chart";
  } else if (commandKeywords.modify.some((keyword) => lowerQuery.includes(keyword))) {
    action = "modify";
    confidence += 0.3;
    explanation = "User wants to modify a chart";
  } else if (commandKeywords.duplicate.some((keyword) => lowerQuery.includes(keyword))) {
    action = "duplicate";
    confidence += 0.3;
    explanation = "User wants to duplicate a chart";
  } else if (commandKeywords.toggle.some((keyword) => lowerQuery.includes(keyword))) {
    action = "toggle_visibility";
    confidence += 0.3;
    explanation = "User wants to toggle chart visibility";
  } else if (commandKeywords.create.some((keyword) => lowerQuery.includes(keyword))) {
    action = "create";
    confidence += 0.3;
    explanation = "User wants to create a new chart";
  }

  // Detect chart type
  for (const [type, keywords] of Object.entries(chartTypeKeywords)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      chartType = type as ChartType;
      customizations.chartType = chartType;
      hasCustomization = true;
      confidence += 0.25;
      explanation += ` of type ${type}`;
      break;
    }
  }

  // Detect customization intent
  if (customizationKeywords.colors.some((keyword) => lowerQuery.includes(keyword))) {
    hasCustomization = true;
    confidence += 0.15;
    customizations.colorMode = "palette";
    explanation += ", with color customization";
  }

  if (customizationKeywords.legend.some((keyword) => lowerQuery.includes(keyword))) {
    hasCustomization = true;
    confidence += 0.1;
    customizations.showLegend = !lowerQuery.includes("hide");
    explanation += ", with legend";
  }

  if (customizationKeywords.title.some((keyword) => lowerQuery.includes(keyword))) {
    hasCustomization = true;
    confidence += 0.1;
  }

  // Extract chart title mentions
  const titleMatch = query.match(
    /(?:called|named|titled|show(?:ing)?\s+)(["'])?(.+?)\1?(?:\s+chart|of|by)/i
  );
  if (titleMatch && titleMatch[2]) {
    customizations.title = titleMatch[2].trim();
    confidence += 0.1;
  }

  if (/\b(show|visualize|plot|graph|chart|dashboard|breakdown|compare)\b/.test(lowerQuery)) {
    confidence += 0.25;
    explanation = explanation || "User wants to control dashboard charts";
  }

  if (/\b(by|vs|versus|over time|trend|distribution|breakdown)\b/.test(lowerQuery)) {
    confidence += 0.15;
  }

  // Extract column names (simple heuristic: capitalized words or quoted strings)
  const columnMatches = query.match(/([A-Z][a-z]+|"[^"]+"|'[^']+')/g);
  if (columnMatches) {
    confidence += 0.05;
  }

  // If we detected chart-related keywords, consider it a chart command
  if (
    action ||
    chartType ||
    hasCustomization ||
    commandKeywords[action as keyof typeof commandKeywords].some((keyword) =>
      lowerQuery.includes(keyword)
    )
  ) {
    return {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      confidence: Math.min(1, confidence),
      originalQuery: query,
      explanation: explanation || "Unknown chart operation",
      customization: hasCustomization ? customizations : undefined,
    };
  }

  return null;
}

export function extractChartReference(
  query: string,
  availableCharts: Array<{ id: string; title: string }>
): { chartId: string; title: string } | null {
  const lowerQuery = query.toLowerCase();

  // Try exact title match first
  for (const chart of availableCharts) {
    if (lowerQuery.includes(chart.title.toLowerCase())) {
      return chart;
    }
  }

  // Try word-based matching
  const queryWords = lowerQuery.split(/\s+/);
  for (const chart of availableCharts) {
    const titleWords = chart.title.toLowerCase().split(/\s+/);
    const matchCount = titleWords.filter((word) =>
      queryWords.some((qWord) => qWord.includes(word) || word.includes(qWord))
    ).length;

    if (matchCount > 0) {
      return chart;
    }
  }

  return null;
}

export function extractColumnReferences(
  query: string,
  availableColumns: string[]
): { x?: string; y?: string } {
  const result: { x?: string; y?: string } = {};
  const lowerQuery = query.toLowerCase();

  // Look for "by" or "vs" patterns: "salary by country"
  const byPattern = /by\s+(\w+)/i;
  const byMatch = query.match(byPattern);
  if (byMatch) {
    const columnName = findClosestColumn(byMatch[1], availableColumns);
    if (columnName) result.x = columnName;
  }

  // Look for "vs" patterns: "experience vs salary"
  const vsPattern = /(\w+)\s+vs\.?\s+(\w+)/i;
  const vsMatch = query.match(vsPattern);
  if (vsMatch) {
    const col1 = findClosestColumn(vsMatch[1], availableColumns);
    const col2 = findClosestColumn(vsMatch[2], availableColumns);
    if (col1) result.x = col1;
    if (col2) result.y = col2;
  }

  // Look for "of" patterns: "distribution of experience"
  const ofPattern = /(?:distribution|breakdown|analysis)\s+of\s+(\w+)/i;
  const ofMatch = query.match(ofPattern);
  if (ofMatch) {
    const columnName = findClosestColumn(ofMatch[1], availableColumns);
    if (columnName) result.y = columnName;
  }

  // Fallback: look for any column names mentioned
  for (const column of availableColumns) {
    if (lowerQuery.includes(column.toLowerCase())) {
      if (!result.x) {
        result.x = column;
      } else if (!result.y) {
        result.y = column;
        break;
      }
    }
  }

  return result;
}

function findClosestColumn(
  search: string,
  columns: string[]
): string | undefined {
  const lowerSearch = search.toLowerCase();

  // Exact match
  const exact = columns.find((c) => c.toLowerCase() === lowerSearch);
  if (exact) return exact;

  // Partial match
  const partial = columns.find((c) => c.toLowerCase().includes(lowerSearch));
  if (partial) return partial;

  // Fuzzy match using simple similarity
  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const column of columns) {
    const score = calculateStringSimilarity(lowerSearch, column.toLowerCase());
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = column;
    }
  }

  return bestMatch;
}

function calculateStringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1: string, s2: string): number {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

export function suggestChartType(
  xColumn: string | undefined,
  yColumn: string | undefined,
  columnTypes: Record<string, "numeric" | "categorical" | "text" | "date">
): ChartType[] {
  const suggestions: ChartType[] = [];

  if (!xColumn || !yColumn) return ["bar"];

  const xType = columnTypes[xColumn];
  const yType = columnTypes[yColumn];

  // Numeric vs Numeric
  if (xType === "numeric" && yType === "numeric") {
    suggestions.push("scatter");
    suggestions.push("line");
  }

  // Categorical vs Numeric
  if ((xType === "categorical" || xType === "text") && yType === "numeric") {
    suggestions.push("bar");
    suggestions.push("line");
  }

  // Numeric vs Categorical
  if (xType === "numeric" && (yType === "categorical" || yType === "text")) {
    suggestions.push("bar");
  }

  // Categorical vs Categorical
  if ((xType === "categorical" || xType === "text") && (yType === "categorical" || yType === "text")) {
    suggestions.push("table");
  }

  // Always include common options
  if (suggestions.length === 0) {
    suggestions.push("bar", "table");
  }

  return [...new Set(suggestions)];
}
