import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

export function uploadDataset<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.dataset.upload, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function importDataset<T>(payload: unknown) {
  return apiRequest<T>(API_ROUTES.dataset.import, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loadDemoDataset<T>() {
  return apiRequest<T>(API_ROUTES.dataset.demo, {
    method: "POST",
  });
}

export function getActiveDataset<T>() {
  return apiRequest<T>(API_ROUTES.dataset.active);
}
