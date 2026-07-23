import PDFDocument from "pdfkit";
import { Workbook } from "exceljs";
import * as fs from "fs";

interface ReportData {
  dashboard: Record<string, unknown>;
  schema: Record<string, unknown>;
  kpis: Record<string, unknown>[];
  visualizations: Record<string, unknown>[];
  insights: Record<string, unknown>[];
}

export class ReportGenerator {
  async generatePDFReport(
    data: ReportData,
    filename: string = "analytics-report.pdf"
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filename);

      doc.pipe(stream);

      // Title
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Enterprise Analytics Report", 100, 100);

      // Generated Date
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Generated: ${new Date().toLocaleString()}`, 100, 140);

      // Executive Summary
      doc.fontSize(16).font("Helvetica-Bold").text("Executive Summary", 100, 180);
      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          (data.dashboard as Record<string, unknown>).title ||
            "Analytics Dashboard",
          100,
          210
        );

      // KPIs Section
      let yPos = 260;
      doc.fontSize(14).font("Helvetica-Bold").text("Key Performance Indicators", 100, yPos);
      yPos += 40;

      (data.kpis as Record<string, unknown>[]).slice(0, 8).forEach((kpi) => {
        const kpiData = kpi as Record<string, unknown>;
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`• ${kpiData.name}`, 120, yPos);
        doc
          .fontSize(9)
          .font("Helvetica")
          .text(`  ${kpiData.description}`, 130, yPos + 15);
        yPos += 40;

        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
      });

      // Insights Section
      yPos += 20;
      doc.fontSize(14).font("Helvetica-Bold").text("AI-Generated Insights", 100, yPos);
      yPos += 40;

      (data.insights as Record<string, unknown>[]).slice(0, 10).forEach((insight) => {
        const insightData = insight as Record<string, unknown>;
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(`• ${insightData.insight}`, 120, yPos);
        yPos += 30;

        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
      });

      doc.end();

      stream.on("finish", () => resolve(filename));
      stream.on("error", reject);
    });
  }

  async generateExcelReport(
    data: ReportData,
    filename: string = "analytics-report.xlsx"
  ): Promise<string> {
    const workbook = new Workbook();

    // KPIs Sheet
    const kpiSheet = workbook.addWorksheet("KPIs");
    kpiSheet.columns = [
      { header: "KPI Name", key: "name", width: 25 },
      { header: "Description", key: "description", width: 40 },
      { header: "Formula", key: "formula", width: 30 },
      { header: "Business Value", key: "business_value", width: 35 },
    ];

    (data.kpis as Record<string, unknown>[]).forEach((kpi) => {
      kpiSheet.addRow(kpi);
    });

    // Insights Sheet
    const insightSheet = workbook.addWorksheet("Insights");
    insightSheet.columns = [
      { header: "Type", key: "type", width: 15 },
      { header: "Insight", key: "insight", width: 50 },
      { header: "Business Impact", key: "business_impact", width: 40 },
    ];

    (data.insights as Record<string, unknown>[]).forEach((insight) => {
      insightSheet.addRow(insight);
    });

    // Visualizations Sheet
    const vizSheet = workbook.addWorksheet("Visualizations");
    vizSheet.columns = [
      { header: "Chart Type", key: "type", width: 15 },
      { header: "Title", key: "title", width: 30 },
      { header: "Dimensions", key: "dimensions", width: 25 },
      { header: "Measures", key: "measures", width: 25 },
      { header: "Insight", key: "insight", width: 40 },
    ];

    (data.visualizations as Record<string, unknown>[]).forEach((viz) => {
      vizSheet.addRow(viz);
    });

    // Metadata Sheet
    const metaSheet = workbook.addWorksheet("Metadata");
    metaSheet.columns = [
      { header: "Property", key: "property", width: 25 },
      { header: "Value", key: "value", width: 50 },
    ];

    metaSheet.addRow({
      property: "Generated At",
      value: new Date().toISOString(),
    });
    metaSheet.addRow({
      property: "Dataset Domain",
      value: (data.schema as Record<string, unknown>).dataset_domain,
    });

    await workbook.xlsx.writeFile(filename);
    return filename;
  }

  async generateMarkdownReport(
    data: ReportData,
    filename: string = "analytics-report.md"
  ): Promise<string> {
    let markdown = "# Enterprise Analytics Report\n\n";

    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    markdown += `## Executive Summary\n\n${(data.dashboard as Record<string, unknown>).title || "Analytics Dashboard"}\n\n`;

    markdown += "## Key Performance Indicators\n\n";
    (data.kpis as Record<string, unknown>[]).slice(0, 8).forEach((kpi) => {
      const kpiData = kpi as Record<string, unknown>;
      markdown += `### ${kpiData.name}\n`;
      markdown += `**Description:** ${kpiData.description}\n\n`;
      markdown += `**Formula:** ${kpiData.formula || "N/A"}\n\n`;
      markdown += `**Business Value:** ${kpiData.business_value}\n\n`;
    });

    markdown += "## AI-Generated Insights\n\n";
    (data.insights as Record<string, unknown>[]).forEach((insight) => {
      const insightData = insight as Record<string, unknown>;
      markdown += `- **${insightData.type}:** ${insightData.insight}\n`;
      markdown += `  *Impact: ${insightData.business_impact}*\n\n`;
    });

    markdown += "## Visualizations\n\n";
    (data.visualizations as Record<string, unknown>[]).slice(0, 12).forEach((viz) => {
      const vizData = viz as Record<string, unknown>;
      markdown += `### ${vizData.title}\n`;
      markdown += `**Type:** ${vizData.type}\n`;
      markdown += `**Dimensions:** ${(vizData.dimensions as string[]).join(", ")}\n`;
      markdown += `**Measures:** ${(vizData.measures as string[]).join(", ")}\n`;
      markdown += `**Insight:** ${vizData.insight}\n\n`;
    });

    fs.writeFileSync(filename, markdown);
    return filename;
  }
}

export default ReportGenerator;
