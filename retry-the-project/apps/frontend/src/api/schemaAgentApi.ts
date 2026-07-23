import type { ColumnProfile, DashboardPlan } from "@/types/dashboard";

export type SchemaTrainResponse = {
  ok: boolean;
  profile: ColumnProfile[] | null;
  dashboardSpec: DashboardPlan | null;
  agentPlan?: Record<string, unknown>;
  agentTools?: string[];
  ontologyMapping?: {
    inferredDomain: string;
    canonicalTerms: string[];
    mapping: Record<string, string>;
  };
  critic?: {
    score: number;
    status: string;
    issues: string[];
    improvements: string[];
  };
  guardian: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  calculatedDashboard?: DashboardPlan;
  memoryRecordId?: string;
  trainingExamplesCount?: number;
  message?: string;
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json();
}

export const schemaAgentApi = {
  trainSchema(datasetId: string) {
    return requestJson<SchemaTrainResponse>(
      `/api/schema-agent/datasets/${encodeURIComponent(datasetId)}/train-schema`,
      { method: 'POST' }
    );
  },

  buildDashboardSpec(datasetId: string) {
    return requestJson<SchemaTrainResponse>(
      `/api/schema-agent/datasets/${encodeURIComponent(datasetId)}/dashboard-spec`,
      { method: 'POST' }
    );
  },

  memoryStats() {
    return requestJson<{ ok: boolean; stats: Record<string, unknown> }>(
      '/api/schema-agent/memory/stats'
    );
  },
};
