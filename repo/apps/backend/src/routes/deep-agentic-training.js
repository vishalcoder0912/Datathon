import { trainDeepAgenticAnalytics } from "../services/ai-analyst/training/deep-agentic-trainer.js";
import { sendSuccess, sendError } from "../utils/response-utils.js";
import { HTTP_STATUS } from "../config/constants.js";

export async function handleDeepAgenticTrainingRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname === "/api/deep-agentic-training/train" && method === "POST") {
    try {
      const result = await trainDeepAgenticAnalytics();
      sendSuccess(response, result, "Deep agentic analytics training completed");
    } catch (error) {
      console.error("Deep agentic training failed:", error);
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Deep agentic training failed",
        "TRAINING_ERROR"
      );
    }
    return true;
  }

  return false;
}

export default {
  handleDeepAgenticTrainingRoutes,
};
