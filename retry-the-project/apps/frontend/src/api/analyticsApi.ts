import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

export function runAdvancedAnalytics<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.analytics.advanced, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
