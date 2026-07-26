import { sendSuccess, sendError } from "../utils/response-utils.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { getDatasetById } from "../database/dataset-repository.js";
import { validateAndFixDashboard } from "../services/dashboard/dashboard-integrity-engine.js";

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

export async function handleDashboardQualityRoutes(request, response, pathname) {
  const { method } = request;

  const match = pathname.match(/^\/api\/datasets\/([^/]+)\/dashboard-validate-fix$/);

  if (match && method === "POST") {
    try {
      const [, datasetId] = match;
      const body = await readJsonBody(request);

      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(
          response,
          HTTP_STATUS.NOT_FOUND || 404,
          "Dataset not found",
          ERROR_CODES.NOT_FOUND
        );
        return true;
      }

      const result = validateAndFixDashboard(dataset, body.currentDashboard || {});

      sendSuccess(response, result, "Dashboard validation completed");
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR || 500,
        error.message || "Dashboard validation failed",
        ERROR_CODES.INTERNAL_ERROR
      );
      return true;
    }
  }

  return false;
}