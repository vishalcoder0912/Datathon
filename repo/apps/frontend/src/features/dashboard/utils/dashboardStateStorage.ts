import type { DashboardChart, DashboardFilters, DashboardKpi } from "@/features/dashboard/utils/dashboardAnalytics";

export type StoredDashboardState = {
  filters: DashboardFilters;
  manualCharts: DashboardChart[];
  manualKpis: DashboardKpi[];
  aiChatMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    actionLabel?: string;
  }>;
  auditTrail?: Array<{
    id: string;
    label: string;
    timestamp: string;
    source: "chat" | "command-bar" | "dashboard" | "agent";
  }>;
  lastAction?: {
    label: string;
    timestamp: string;
    source: "chat" | "command-bar" | "dashboard" | "agent";
  };
  geoActive?: boolean;
};

function getKey(datasetId?: string) {
  return datasetId ? `insightflow-dashboard-state:${datasetId}` : "";
}

export function loadDashboardState(datasetId?: string): StoredDashboardState {
  if (!datasetId || typeof window === "undefined") {
    return { filters: {}, manualCharts: [], manualKpis: [] };
  }

  try {
    const raw = window.localStorage.getItem(getKey(datasetId));
    if (!raw) return { filters: {}, manualCharts: [], manualKpis: [] };
    const parsed = JSON.parse(raw) as Partial<StoredDashboardState>;
    return {
      filters: parsed.filters || {},
      manualCharts: Array.isArray(parsed.manualCharts) ? parsed.manualCharts : [],
      manualKpis: Array.isArray(parsed.manualKpis) ? parsed.manualKpis : [],
      aiChatMessages: Array.isArray(parsed.aiChatMessages) ? parsed.aiChatMessages : [],
      auditTrail: Array.isArray(parsed.auditTrail) ? parsed.auditTrail : [],
      lastAction: parsed.lastAction,
      geoActive: Boolean(parsed.geoActive),
    };
  } catch {
    return { filters: {}, manualCharts: [], manualKpis: [] };
  }
}

export function saveDashboardState(datasetId: string | undefined, state: StoredDashboardState) {
  if (!datasetId || typeof window === "undefined") return;
  window.localStorage.setItem(getKey(datasetId), JSON.stringify(state));
}

export function recordDashboardAction(
  datasetId: string | undefined,
  label: string,
  source: "chat" | "command-bar" | "dashboard" | "agent" = "dashboard",
  patch: Partial<StoredDashboardState> = {},
) {
  if (!datasetId || typeof window === "undefined") return;
  const current = loadDashboardState(datasetId);
  const entry = {
    id: crypto.randomUUID?.() || `${Date.now()}`,
    label,
    timestamp: new Date().toISOString(),
    source,
  };
  saveDashboardState(datasetId, {
    ...current,
    ...patch,
    auditTrail: [entry, ...(current.auditTrail || [])].slice(0, 20),
    lastAction: {
      label,
      timestamp: entry.timestamp,
      source,
    },
  });
}
