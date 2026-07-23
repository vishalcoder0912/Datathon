import { useCallback, useEffect, useState } from "react";
import { api } from "@/features/data/api/dataApi";

type DatasetLike = {
  id?: string;
  name?: string;
  columns?: unknown[];
  rows?: unknown[];
};

export function useSchemaTrainedDashboard(dataset: DatasetLike | null | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaDashboard, setSchemaDashboard] = useState<any>(null);

  const generate = useCallback(async () => {
    if (!dataset?.id && !dataset?.rows?.length) return null;
    setLoading(true);
    setError(null);

    try {
      const datasetId = dataset.id || "local-dataset";
      const fallbackPayload = dataset.id ? undefined : { rows: dataset.rows || [], columns: dataset.columns || [] };
      const result = await api.generateSchemaDashboard(datasetId, true, fallbackPayload as any);
      setSchemaDashboard(result);
      return result;
    } catch (err: any) {
      setError(err?.message || "Failed to generate schema-trained dashboard");
      return null;
    } finally {
      setLoading(false);
    }
  }, [dataset]);

  useEffect(() => {
    generate();
  }, [generate]);

  return { loading, error, schemaDashboard, regenerate: generate };
}
