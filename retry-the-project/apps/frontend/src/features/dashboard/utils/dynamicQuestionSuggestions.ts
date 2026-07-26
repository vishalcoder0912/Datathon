import {
  buildDatasetProfile,
  cleanDatasetRows,
  getUniqueValues,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";

export type DatasetColumn =
  | string
  | {
      name?: string;
      key?: string;
      accessorKey?: string;
      label?: string;
      title?: string;
      type?: string;
      role?: string;
    };

export type SuggestionDataset = {
  id?: string;
  name?: string;
  rows?: unknown[];
  columns?: DatasetColumn[];
};

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toRows(dataset?: SuggestionDataset) {
  return cleanDatasetRows(
    Array.isArray(dataset?.rows)
      ? (dataset.rows.filter((row) => row && typeof row === "object") as Row[])
      : [],
  );
}

function getColumnName(column: DatasetColumn) {
  if (typeof column === "string") return column;
  return column.name || column.key || column.accessorKey || column.label || column.title || "";
}

function pushUnique(items: string[], value?: string) {
  if (!value) return;
  if (!items.some((item) => item.toLowerCase() === value.toLowerCase())) {
    items.push(value);
  }
}

export function generateDynamicQuestionSuggestions(
  dataset?: SuggestionDataset,
  maxSuggestions = 8,
) {
  const rows = toRows(dataset);
  const profile = buildDatasetProfile(rows);
  const suggestions: string[] = [];
  const primaryMetric = profile.primaryMetric;
  const secondaryMetric = profile.secondaryMetric;
  const primaryCategory = profile.primaryCategory;
  const dateColumn = profile.dateColumn;
  const availableColumns =
    Array.isArray(dataset?.columns) && dataset.columns.length
      ? dataset.columns.map(getColumnName).filter(Boolean)
      : profile.columns.map((column) => column.name);

  if (!availableColumns.length) {
    return ["Build dashboard automatically", "Summarize this dataset"];
  }

  pushUnique(suggestions, "Build dashboard automatically");

  const salaryCol = availableColumns.find(col => /salary/i.test(col));
  const countryCol = availableColumns.find(col => /country/i.test(col));
  const expCol = availableColumns.find(col => /experience|exp|years/i.test(col));
  const salesCol = availableColumns.find(col => /sales|revenue|profit/i.test(col));
  const catCol = availableColumns.find(col => /category|type|segment|department/i.test(col));

  if (countryCol && salaryCol && expCol) {
    pushUnique(suggestions, `Compare average ${salaryCol} by ${countryCol} and ${expCol} level`);
  } else if (salaryCol && expCol) {
    pushUnique(suggestions, `Compare average ${salaryCol} by ${expCol}`);
  }

  if (countryCol && salesCol) {
    pushUnique(suggestions, `Compare total ${salesCol} by ${countryCol}`);
  } else if (catCol && salesCol) {
    pushUnique(suggestions, `Analyze ${salesCol} breakdown across ${catCol}`);
  }

  if (primaryMetric && primaryCategory) {
    pushUnique(
      suggestions,
      `Show average ${primaryMetric.name} by ${primaryCategory.name}`,
    );
  }

  if (primaryCategory) {
    pushUnique(suggestions, `Create pie chart of ${primaryCategory.name}`);
  }

  if (primaryMetric) {
    pushUnique(suggestions, `Show ${primaryMetric.name} distribution`);
    pushUnique(suggestions, `Add KPI for highest ${primaryMetric.name}`);
  }

  if (primaryMetric && secondaryMetric) {
    pushUnique(
      suggestions,
      `Show ${primaryMetric.name} vs ${secondaryMetric.name} as scatter`,
    );
  }

  if (primaryMetric) {
    pushUnique(
      suggestions,
      dateColumn
        ? `Show ${primaryMetric.name} trend by ${dateColumn.name}`
        : `Show ${primaryMetric.name} trend by row index`,
    );
  }

  if (primaryCategory) {
    const topValue = getUniqueValues(rows, primaryCategory.name, 1)[0];
    if (topValue) {
      pushUnique(suggestions, `Filter ${primaryCategory.name} = ${topValue}`);
    }
  }

  if (
    !primaryMetric &&
    availableColumns.length >= 2 &&
    rows.length
  ) {
    pushUnique(
      suggestions,
      `Show average ${titleCase(availableColumns[0])} by ${titleCase(availableColumns[1])}`,
    );
  }

  pushUnique(suggestions, "Generate KPI cards");
  pushUnique(suggestions, "Explain data quality");
  pushUnique(suggestions, "Clear filters");
  pushUnique(suggestions, "Remove chart");

  return suggestions.slice(0, maxSuggestions);
}