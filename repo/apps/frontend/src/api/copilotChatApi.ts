import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

export function sendCopilotAnalyticsChat<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.copilotChat.analytics, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
