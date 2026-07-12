/**
 * Data Export Service
 * Export analyses and reports in multiple formats
 */

export function exportToJSON(analysis, filename = "analysis") {
  const json = JSON.stringify(analysis, null, 2);
  return {
    data: json,
    filename: `${filename}.json`,
    mimeType: "application/json",
  };
}

export function exportToCSV(data, filename = "export") {
  if (!Array.isArray(data) || data.length === 0) {
    return { data: "", filename: `${filename}.csv`, mimeType: "text/csv" };
  }

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => JSON.stringify(row[h])).join(",")
    )
  ].join("\n");

  return { data: csv, filename: `${filename}.csv`, mimeType: "text/csv" };
}

export function exportToMarkdown(analysis, datasetName = "Dataset") {
  let md = `# Analysis Report: ${datasetName}\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  if (analysis.profile) {
    md += `## Dataset Profile\n`;
    md += `- Rows: ${analysis.profile.summary.totalRows}\n`;
    md += `- Columns: ${analysis.profile.summary.totalColumns}\n`;
    md += `- Quality Score: ${analysis.profile.summary.quality}%\n\n`;
  }

  if (analysis.findings) {
    md += `## Key Findings\n`;
    analysis.findings.forEach(finding => {
      md += `- ${finding}\n`;
    });
    md += "\n";
  }

  return { data: md, filename: `${datasetName}-report.md`, mimeType: "text/markdown" };
}