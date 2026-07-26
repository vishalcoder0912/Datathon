import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

export function getDashboardState<T>() {
  return apiRequest<T>(API_ROUTES.dashboard.state);
}

export function runDashboardAnalysis<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.dashboard.analyze, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendDashboardAction<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.dashboard.action, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendDashboardChatCommand<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.dashboard.chat, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
