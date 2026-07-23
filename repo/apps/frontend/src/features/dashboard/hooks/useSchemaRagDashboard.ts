import { useCallback, useState } from "react";
import {
  generateSchemaDashboard,
  generateSmartRagDashboard,
  getSchemaRagMemory,
  retrieveSchemaRagMemory,
  runDashboardCommand,
  runSchemaChat,
  trainSmartRagDashboard,
  trainCurrentDashboardPattern,
  understandDatasetSchema,
} from "../../data/api/schemaAiClient";

type DashboardState = {
  kpis: unknown[];
  charts: unknown[];
  filters?: Record<string, unknown>;
  [key: string]: unknown;
};

type UseSchemaRagDashboardOptions = {
  datasetId: string;
  rows: Array<Record<string, unknown>>;
  columns: unknown[];
  dashboard: DashboardState;
  setDashboard: (next: DashboardState | ((previous: DashboardState) => DashboardState)) => void;
};

function unwrapResponse<T>(response: T | { data?: T }): T {
  return (response as { data?: T })?.data || (response as T);
}

export function useSchemaRagDashboard({
  datasetId,
  rows,
  columns,
  dashboard,
  setDashboard,
}: UseSchemaRagDashboardOptions) {
  const [loading, setLoading] = useState(false);
  const [ragInfo, setRagInfo] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const buildPayload = useCallback(
    (extra: Record<string, unknown> = {}) => ({
      name: datasetId,
      rows,
      columns,
      currentDashboard: dashboard,
      ...extra,
    }),
    [columns, dashboard, datasetId, rows],
  );

  const generateDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = unwrapResponse(
        await generateSchemaDashboard(
          datasetId,
          buildPayload({
            useLlm: true,
            useRagEmbedding: true,
          }),
        ),
      );

      const nextDashboard = result.dashboard || result.dashboardPlan;

      if (nextDashboard) {
        setDashboard((previous) => ({
          ...previous,
          ...nextDashboard,
          kpis: nextDashboard.kpis || [],
          charts: nextDashboard.charts || [],
        }));
      }

      setRagInfo(result.rag || null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate dashboard.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [buildPayload, datasetId, setDashboard]);

  const askDashboardAI = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);

      try {
        if (/understand|explain schema|schema samjhao|data samjhao/i.test(query)) {
          const result = unwrapResponse(
            await understandDatasetSchema(datasetId, buildPayload()),
          );

          setRagInfo(result);
          return {
            action: "ANSWER",
            message: result.explanation || "Schema understanding generated.",
            schemaOnly: true,
            provider: "smart-schema-understanding",
          };
        }

        if (/smart dashboard|best dashboard|rag dashboard/i.test(query)) {
          const result = unwrapResponse(
            await generateSmartRagDashboard(
              datasetId,
              buildPayload({
                useOllama: true,
              }),
            ),
          );

          const nextDashboard = result.dashboard;

          if (nextDashboard) {
            setDashboard((previous) => ({
              ...previous,
              ...nextDashboard,
              kpis: nextDashboard.kpis || [],
              charts: nextDashboard.charts || [],
            }));
          }

          setRagInfo(result.rag || result);
          return {
            action: "GENERATE_DASHBOARD",
            message: result.understanding?.userExplanation || "Smart RAG dashboard generated.",
            dashboardPlan: nextDashboard,
            dashboard: nextDashboard,
            schemaOnly: true,
            provider: "smart-rag-dashboard",
          };
        }

        if (/remember|train this|save pattern|learn this dashboard/i.test(query)) {
          const result = unwrapResponse(
            await trainSmartRagDashboard(
              datasetId,
              buildPayload({
                acceptedDashboardPlan: dashboard,
                rating: "good",
                notes: "User approved this dashboard from UI.",
                useOllama: true,
              }),
            ),
          );

          setRagInfo(result.stats || result);
          return {
            action: "ANSWER",
            message: `I saved this dashboard pattern. RAG memory now has ${result.stats?.total || "updated"} patterns.`,
            schemaOnly: true,
            provider: "smart-rag-training",
          };
        }

        const result = unwrapResponse(
          await runDashboardCommand(
            datasetId,
            buildPayload({
              query,
              useLlm: true,
            }),
          ),
        );

        if ((result.action === "GENERATE_DASHBOARD" || result.action === "FIX_DASHBOARD") && result.dashboardPlan) {
          setDashboard((previous) => ({
            ...previous,
            ...result.dashboardPlan,
            kpis: result.dashboardPlan.kpis || previous.kpis || [],
            charts: result.dashboardPlan.charts || previous.charts || [],
          }));
        }

        if (result.action === "FIX_DASHBOARD" && result.correctedDashboard) {
          setDashboard((previous) => ({
            ...previous,
            ...result.correctedDashboard,
          }));
        }

        if (result.action === "GENERATE_CHART" && result.chartSpec) {
          setDashboard((previous) => ({
            ...previous,
            charts: [...(previous.charts || []), result.chartSpec],
          }));
        }

        if (result.action === "GENERATE_KPI" && result.kpiSpec) {
          setDashboard((previous) => ({
            ...previous,
            kpis: [...(previous.kpis || []), result.kpiSpec],
          }));
        }

        if (result.action === "FILTER" && result.filters) {
          setDashboard((previous) => ({
            ...previous,
            filters: {
              ...(previous.filters || {}),
              ...result.filters,
            },
          }));
        }

        if (result.action === "CLEAR_FILTERS") {
          setDashboard((previous) => ({
            ...previous,
            filters: {},
          }));
        }

        setRagInfo(result.rag || null);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dashboard AI command failed.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [buildPayload, datasetId, setDashboard],
  );

  const askSchemaChat = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);

      try {
        return unwrapResponse(
          await runSchemaChat(
            datasetId,
            buildPayload({
              query,
              useLlm: true,
            }),
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Schema chat failed.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [buildPayload, datasetId],
  );

  const rememberDashboardPattern = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = unwrapResponse(
        await trainCurrentDashboardPattern(
          datasetId,
          buildPayload({
            acceptedDashboardPlan: dashboard,
            rating: "good",
            notes: "User approved this dashboard pattern.",
            useOllama: true,
          }),
        ),
      );

      setRagInfo(result.stats || result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remember dashboard pattern.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [buildPayload, dashboard, datasetId]);

  const showRagMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = unwrapResponse(
        await retrieveSchemaRagMemory(
          buildPayload({
            threshold: 0.55,
            limit: 5,
            useOllama: true,
          }),
        ),
      );

      setRagInfo(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to retrieve RAG matches.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  const loadRagMemory = useCallback(async () => {
    const result = unwrapResponse(await getSchemaRagMemory());
    setRagInfo(result);
    return result;
  }, []);

  return {
    loading,
    error,
    ragInfo,
    generateDashboard,
    askDashboardAI,
    askSchemaChat,
    rememberDashboardPattern,
    showRagMatches,
    loadRagMemory,
  };
}
