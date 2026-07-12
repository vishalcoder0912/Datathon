import { generateSchemaProfile } from "../services/dashboard/schemaProfiler.js";
import { planDashboardWithAI } from "../services/ai/dashboardPlanner.js";
import { buildDashboardFromPlan } from "../services/dashboard/dashboardAnalytics.js";
import { validateAndFixDashboard } from "../services/dashboard/dashboardFixEngine.js";
import { getDatasetById } from "../database/dataset-repository.js";

async function readJsonBody(request) {
  try {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export async function handleDashboardAiRoutes(request, response, pathname) {
  const { method } = request;

  if (method === "POST" && pathname === "/api/dashboard-ai/generate") {
    try {
      const body = await readJsonBody(request);
      let rows = body.rows || [];
      let dataDictionary = body.dataDictionary || [];
      let datasetName = body.datasetName || "Uploaded Dataset";
      const filters = body.filters || {};

      if (body.datasetId) {
        const dataset = getDatasetById(body.datasetId);
        if (dataset) {
          rows = dataset.rows || [];
          datasetName = dataset.name || datasetName;
        }
      }

      const schemaProfile = generateSchemaProfile({
        rows,
        dataDictionary,
        datasetName,
      });

      const aiPlan = await planDashboardWithAI({
        schemaProfile,
      });

      const dashboard = buildDashboardFromPlan({
        rows,
        filters,
        dashboardPlan: aiPlan.dashboardPlan,
      });

      sendJson(response, 200, {
        success: true,
        schemaProfile,
        aiPlan,
        dashboard,
      });
      return true;
    } catch (error) {
      sendJson(response, 500, {
        success: false,
        message: getErrorMessage(error, "Dashboard failed."),
      });
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/dashboard-ai/command") {
    try {
      const body = await readJsonBody(request);
      const query = body.query || "";
      let rows = body.rows || [];
      let dataDictionary = body.dataDictionary || [];
      let datasetName = body.datasetName || "Uploaded Dataset";
      const currentDashboard = body.currentDashboard || {};
      const filters = body.filters || {};

      if (body.datasetId) {
        const dataset = getDatasetById(body.datasetId);
        if (dataset) {
          rows = dataset.rows || [];
          datasetName = dataset.name || datasetName;
        }
      }

      if (/fix|validate|correct|wrong|repair|regenerate/i.test(query)) {
        const result = await validateAndFixDashboard({
          rows,
          dataDictionary,
          datasetName,
          currentDashboard,
        });

        sendJson(response, 200, {
          success: true,
          ...result,
        });
        return true;
      }

      const schemaProfile = generateSchemaProfile({
        rows,
        dataDictionary,
        datasetName,
      });

      const aiPlan = await planDashboardWithAI({
        schemaProfile,
        userQuery: query,
        currentDashboard,
      });

      const dashboard = buildDashboardFromPlan({
        rows,
        filters,
        dashboardPlan: aiPlan.dashboardPlan,
      });

      sendJson(response, 200, {
        success: true,
        action: aiPlan.action,
        message: aiPlan.message,
        schemaOnly: true,
        aiPlan,
        dashboard,
      });
      return true;
    } catch (error) {
      sendJson(response, 500, {
        success: false,
        message: getErrorMessage(error, "Dashboard command failed."),
      });
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/dashboard-ai/fix") {
    try {
      const body = await readJsonBody(request);
      let rows = body.rows || [];
      let dataDictionary = body.dataDictionary || [];
      let datasetName = body.datasetName || "Uploaded Dataset";
      const currentDashboard = body.currentDashboard || {};

      if (body.datasetId) {
        const dataset = getDatasetById(body.datasetId);
        if (dataset) {
          rows = dataset.rows || [];
          datasetName = dataset.name || datasetName;
        }
      }

      const result = await validateAndFixDashboard({
        rows,
        dataDictionary,
        datasetName,
        currentDashboard,
      });

      sendJson(response, 200, {
        success: true,
        ...result,
      });
      return true;
    } catch (error) {
      sendJson(response, 500, {
        success: false,
        message: getErrorMessage(error, "Dashboard fix failed."),
      });
      return true;
    }
  }

  return false;
}

export default { handleDashboardAiRoutes };
