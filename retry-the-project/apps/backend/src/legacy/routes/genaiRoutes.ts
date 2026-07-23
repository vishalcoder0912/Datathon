import express, { Request, Response } from "express";
import DashboardBuilder from "../genai/dashboardBuilder.js";
import ReportGenerator from "../genai/reportGenerator.js";

const router = express.Router();
const dashboardBuilder = new DashboardBuilder();
const reportGenerator = new ReportGenerator();

// Create full dashboard from dataset
router.post("/dashboard/create", async (req: Request, res: Response) => {
  try {
    const { dataset, title, focus } = req.body;

    if (!dataset || !dataset.data || !dataset.columns) {
      return res.status(400).json({ error: "Invalid dataset format" });
    }

    const result = await dashboardBuilder.createDashboard({
      dataset,
      title,
      focus,
    });

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "Dashboard creation failed",
      });
  }
});

// Query dataset with AI
router.post("/query", async (req: Request, res: Response) => {
  try {
    const { query, schema, dataset } = req.body;

    if (!query || !dataset) {
      return res.status(400).json({ error: "Query and dataset required" });
    }

    const result = await dashboardBuilder.queryDataset(query, schema, dataset);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "Query processing failed",
      });
  }
});

// Generate PDF report
router.post("/report/pdf", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const filename = await reportGenerator.generatePDFReport(data);

    res.download(filename);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "PDF generation failed" });
  }
});

// Generate Excel report
router.post("/report/excel", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const filename = await reportGenerator.generateExcelReport(data);

    res.download(filename);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "Excel generation failed",
      });
  }
});

// Generate Markdown report
router.post("/report/markdown", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const filename = await reportGenerator.generateMarkdownReport(data);

    res.download(filename);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : "Markdown generation failed",
      });
  }
});

export default router;
