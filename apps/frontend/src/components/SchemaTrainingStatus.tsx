type Props = {
  loading: boolean;
  error?: string | null;
  result?: {
    message?: string;
    profile?: {
      rowCount?: number;
      columnCount?: number;
    };
    dashboardSpec?: {
      kpis?: unknown[];
      charts?: unknown[];
    };
    guardian?: {
      valid?: boolean;
      errors?: string[];
    };
  };
};

export function SchemaTrainingStatus({ loading, error, result }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Schema Agent Training</h3>
        <p className="text-sm opacity-80">
          Profiling schema, updating memory, generating dashboard plan, and calculating values...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400 p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Schema Training Failed</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <h3 className="text-lg font-semibold">Schema Agent Ready</h3>
      <p className="text-sm opacity-80">{result.message}</p>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <p className="text-xs opacity-60">Rows</p>
          <p className="font-semibold">{result.profile?.rowCount?.toLocaleString?.() ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Columns</p>
          <p className="font-semibold">{result.profile?.columnCount ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">KPIs</p>
          <p className="font-semibold">{result.dashboardSpec?.kpis?.length ?? 0}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Charts</p>
          <p className="font-semibold">{result.dashboardSpec?.charts?.length ?? 0}</p>
        </div>
      </div>

      {result.guardian && !result.guardian.valid && (
        <div className="mt-3 rounded-xl border border-yellow-400 p-3 text-sm">
          <strong>Guardian warnings:</strong>
          <ul className="mt-1 list-disc pl-4">
            {result.guardian.errors?.map((item: string) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
