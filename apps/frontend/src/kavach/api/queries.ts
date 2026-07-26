import {apiClient} from "@/kavach/api/client";
import type {DataQualityIssue, DataQualitySummary, KavachApiFilters, PaginatedResponse, StationSummary} from "@/kavach/api/types";

const KAVACH_BASE = "/api/kavach";

export const kavachQueryKeys = {
  overview: (filters: KavachApiFilters = {}) => ["kavach", "overview", filters] as const,
  districts: (filters: KavachApiFilters = {}) => ["kavach", "districts", filters] as const,
  stations: (filters: KavachApiFilters = {}) => ["kavach", "stations", filters] as const,
  alerts: (filters: KavachApiFilters = {}) => ["kavach", "alerts", filters] as const,
  dataQuality: (filters: KavachApiFilters = {}) => ["kavach", "data-quality", filters] as const,
};

export function unwrapData<T>(payload: unknown): T {
  const candidate = payload as {data?: T};
  return candidate?.data ?? (payload as T);
}

export const kavachQueries = {
  overview: (filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get(`${KAVACH_BASE}/overview`, {params: filters, signal}),
  districts: (filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get(`${KAVACH_BASE}/districts`, {params: filters, signal}),
  stations: (filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get<PaginatedResponse<StationSummary>>(`${KAVACH_BASE}/police-stations`, {params: filters, signal}),
  station: (stationId: string | number, filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get(`${KAVACH_BASE}/police-stations/${stationId}`, {params: filters, signal}),
  stationTrends: (stationId: string | number, filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get(`${KAVACH_BASE}/police-stations/${stationId}/trends`, {params: filters, signal}),
  stationHotspots: (stationId: string | number, filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get(`${KAVACH_BASE}/police-stations/${stationId}/hotspots`, {params: filters, signal}),
  dataQualitySummary: (filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get<DataQualitySummary>(`${KAVACH_BASE}/data-quality/summary`, {params: filters, signal}),
  dataQualityIssues: (filters?: KavachApiFilters, signal?: AbortSignal) => apiClient.get<PaginatedResponse<DataQualityIssue>>(`${KAVACH_BASE}/data-quality/issues`, {params: filters, signal}),
  resolveDataQualityIssue: (issueId: string, status: string) => apiClient.patch(`${KAVACH_BASE}/data-quality/issues/${issueId}`, {status}),
  createImport: (file: File, sourceType: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("sourceType", sourceType);
    return apiClient.post(`${KAVACH_BASE}/imports`, body, {headers: {"Content-Type": "multipart/form-data"}});
  },
  getImport: (importId: string) => apiClient.get(`${KAVACH_BASE}/imports/${importId}`),
  getImportErrors: (importId: string) => apiClient.get(`${KAVACH_BASE}/imports/${importId}/errors`),
  commitImport: (importId: string) => apiClient.post(`${KAVACH_BASE}/imports/${importId}/commit`),
};
