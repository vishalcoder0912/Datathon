import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { getDatasetById } from "../database/dataset-repository.js";
import { sendError, sendSuccess } from "../utils/response-utils.js";
import {
  analyzeDatasetWithAnalyticsBrain,
  getAnalyticsBrainMemory,
  saveAnalyticsBrainFeedback,
} from "../services/analytics-brain-service.js";

async function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    request.on("error", reject);
  });
}

export async function handleAnalyticsBrainRoutes(request, response, pathname) {
  const { method } = request;

  const analyzeMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/analytics-brain$/);

  if (method === "POST" && analyzeMatch) {
    try {
      const datasetId = analyzeMatch[1];
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "Dataset not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }

      const result = await analyzeDatasetWithAnalyticsBrain(dataset);
      sendSuccess(response, result, "Analytics brain completed");
      return true;
    } catch (error) {
      console.error("[ANALYTICS BRAIN ERROR]", error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "Analytics brain failed",
        ERROR_CODES.AI_GENERATION_FAILED,
      );
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/analytics-brain/feedback") {
    try {
      const body = await getRequestBody(request);
      const result = saveAnalyticsBrainFeedback({
        patternId: body.patternId,
        action: body.action,
        rating: body.rating,
        note: body.note,
      });

      sendSuccess(response, result, "Analytics brain feedback saved");
      return true;
    } catch (error) {
      console.error("[ANALYTICS BRAIN FEEDBACK ERROR]", error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "Feedback save failed",
        ERROR_CODES.DATABASE_ERROR,
      );
      return true;
    }
  }

  if (method === "GET" && pathname === "/api/analytics-brain/memory") {
    try {
      sendSuccess(response, { memory: getAnalyticsBrainMemory() }, "Analytics brain memory retrieved");
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "Memory read failed",
        ERROR_CODES.DATABASE_ERROR,
      );
      return true;
    }
  }

  return false;
}

export default {
  handleAnalyticsBrainRoutes,
};
