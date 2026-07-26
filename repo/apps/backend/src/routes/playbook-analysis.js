import { getDatasetById } from "../database/dataset-repository.js";
import { buildDataAnalyticsProjectsDashboard } from "../services/playbooks/playbook-dashboard-engine.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { sendError, sendSuccess } from "../utils/response-utils.js";

export async function handlePlaybookAnalysisRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname.match(/^\/api\/datasets\/[^/]+\/playbook-analysis$/) && method === "POST") {
    try {
      const datasetId = pathname.split("/")[3];
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "Dataset not found", ERROR_CODES.NOT_FOUND);
        return true;
      }

      const analysis = await buildDataAnalyticsProjectsDashboard(dataset);
      sendSuccess(response, analysis, "Playbook analysis generated");
      return true;
    } catch (error) {
      console.error("[PLAYBOOK ANALYSIS] Error:", error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "Failed to generate playbook analysis",
        ERROR_CODES.AI_ERROR,
      );
      return true;
    }
  }

  return false;
}

export default {
  handlePlaybookAnalysisRoutes,
};
