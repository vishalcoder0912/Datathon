import { useState } from 'react';
import { useAutoTrainSchema } from '../hooks/useAutoTrainSchema';
import { SchemaTrainingStatus } from '../components/SchemaTrainingStatus';
import { AgenticThinkingPanel } from '../features/dashboard/components/AgenticThinkingPanel';

export default function SchemaAgentTrainerPage() {
  const [datasetId, setDatasetId] = useState('');
  const { loading, error, result, trainAndBuild } = useAutoTrainSchema();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!datasetId.trim()) return;
    await trainAndBuild(datasetId.trim());
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <section className="rounded-2xl border p-6 shadow-sm">
        <p className="text-sm uppercase tracking-wide opacity-60">InsightFlow</p>
        <h1 className="mt-2 text-3xl font-bold">Schema Agent Trainer</h1>
        <p className="mt-2 opacity-80">
          Train schema memory and generate a real analytics dashboard every time a dataset is uploaded.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 md:flex-row">
          <input
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
            placeholder="Enter datasetId"
            className="flex-1 rounded-xl border px-4 py-3"
          />
          <button className="rounded-xl border px-5 py-3 font-semibold shadow-sm">
            Train Schema
          </button>
        </form>
      </section>

      <div className="mt-5">
        <SchemaTrainingStatus loading={loading} error={error} result={result} />
      </div>

      {result && (result.agentPlan || result.critic || result.ontologyMapping) && (
        <div className="mt-5">
          <AgenticThinkingPanel 
            agentPlan={result.agentPlan} 
            agentTools={result.agentTools} 
            critic={result.critic} 
            ontologyMapping={result.ontologyMapping}
            dashboardSpec={result.dashboardSpec}
          />
        </div>
      )}

      {result?.calculatedDashboard && (
        <section className="mt-5 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold">Generated Dashboard Spec</h2>
          <pre className="mt-3 max-h-[560px] overflow-auto rounded-xl border p-4 text-xs">
            {JSON.stringify(result.calculatedDashboard, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
