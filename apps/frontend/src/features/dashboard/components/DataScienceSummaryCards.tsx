type DataScienceSummaryProps = {
  profile?: {
    rowCount?: number;
    columnCount?: number;
    qualityScore?: number | string;
    measures?: string[];
    dimensions?: string[];
  };
  anomalies?: {
    summary?: {
      anomalyCount?: number;
      count?: number;
    };
    method?: string;
  };
  correlations?: {
    strongPairs?: unknown[];
  };
  model?: {
    metrics?: Record<string, number>;
    modelType?: string;
  };
};

type SummaryCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

function Card({ label, value, hint }: SummaryCardProps) {
  return (
    <section className="min-h-28 rounded-lg border border-slate-700/70 bg-slate-900/70 p-4">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-50">{value}</p>
      {hint && <p className="mt-2 break-words text-xs text-slate-400">{hint}</p>}
    </section>
  );
}

export default function DataScienceSummaryCards({
  profile,
  anomalies,
  correlations,
  model,
}: DataScienceSummaryProps) {
  const anomalyCount = anomalies?.summary?.anomalyCount ?? anomalies?.summary?.count ?? "-";
  const modelScore = model?.metrics ? Object.values(model.metrics)[0] : null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card label="Rows" value={profile?.rowCount ?? "-"} />
      <Card label="Columns" value={profile?.columnCount ?? "-"} />
      <Card label="Quality Score" value={profile?.qualityScore ?? "-"} />
      <Card label="Anomalies" value={anomalyCount} hint={anomalies?.method ?? "auto"} />
      <Card label="Measures" value={profile?.measures?.length ?? 0} hint={(profile?.measures ?? []).slice(0, 3).join(", ")} />
      <Card label="Dimensions" value={profile?.dimensions?.length ?? 0} hint={(profile?.dimensions ?? []).slice(0, 3).join(", ")} />
      <Card label="Strong Correlations" value={correlations?.strongPairs?.length ?? 0} />
      <Card
        label="Model Score"
        value={typeof modelScore === "number" ? modelScore.toFixed(3) : "-"}
        hint={model?.modelType ?? "select target"}
      />
    </div>
  );
}
