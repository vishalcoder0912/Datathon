export type KavachRole =
  | "STATE_ADMIN"
  | "SCRB_ANALYST"
  | "DISTRICT_OFFICER"
  | "STATION_OFFICER"
  | "INVESTIGATOR"
  | "EVALUATOR"
  | "AUDITOR"
  | "DATA_ENGINEER";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  displayName: string;
  roleCode: KavachRole;
  districtId?: number | null;
  unitId?: number | null;
  clearanceLevel?: number | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface KavachApiFilters {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  districtId?: string | number;
  stationId?: string | number;
  crimeHeadId?: string | number;
  crimeSubHeadId?: string | number;
  status?: string;
  severity?: string;
  daypart?: string;
  districts?: string[];
  policeStations?: string[];
  crimeCategories?: string[];
  timeOfDay?: string;
  [key: string]: string | number | string[] | undefined;
}

export interface ApiEnvelope<T> {
  data: T;
  pagination?: Pagination;
  message?: string;
  mode?: "postgres" | "file-demo";
}

export interface StationSummary {
  stationId: number;
  stationName: string;
  districtId?: number;
  districtName?: string;
  totalIncidents: number;
  activeAlerts?: number;
  riskScore?: number;
  latitude?: number;
  longitude?: number;
}

export interface DataQualityIssue {
  issueId: string;
  issueType: string;
  severity: string;
  tableName: string;
  recordId: string;
  description: string;
  suggestedAction: string;
  status: string;
  detectedAt: string;
}

export interface DataQualitySummary {
  overallQualityScore: number;
  issueCounts: Record<string, number>;
  unresolvedImports: number;
  generatedAt?: string;
}
