import { useEffect, useMemo, useState, useCallback } from 'react';
import { useData } from '@/features/data/context/useData';
import KPICard from '@/features/dashboard/components/KPICard';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import DashboardFilters, { FilterState } from '@/features/dashboard/components/DashboardFilters';
import DataQualityPanel from '@/features/dashboard/components/DataQualityPanel';
import AnalyticsSidebar from '@/features/dashboard/components/AnalyticsSidebar';
import { generateDemoKPIs, generateDemoCharts, ChartConfig, KPI, analyzeDataQuality } from '@/features/data/model/dataStore';
import { Download, RotateCcw, Sparkles, Layers, MessageSquare } from 'lucide-react';
import { exportDatasetCSV } from '@/features/data/utils/exportUtils';
import { AnimatePresence, motion } from 'framer-motion';
import StatusPanel from '@/shared/layout/StatusPanel';

const DashboardPage = () => {
  const { dataset, analysis, isHydrating, apiError, loadDemo, resetAppState, retryHydrate } = useData();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    columns: {},
  });
  const [showSidebar, setShowSidebar] = useState(false);
  const [aiGeneratedCharts, setAiGeneratedCharts] = useState<ChartConfig[]>([]);

  const handleChartGenerated = useCallback((chart: ChartConfig) => {
    setAiGeneratedCharts(prev => {
      const exists = prev.some(c => c.title === chart.title && c.xKey === chart.xKey && c.yKey === chart.yKey && c.type === chart.type);
      if (exists) return prev;
      return [...prev, chart];
    });
  }, []);

  const handleChartModified = useCallback((chart: ChartConfig) => {
    setAiGeneratedCharts(prev => {
      if (prev.length === 0) return [chart];
      return [...prev.slice(0, -1), chart];
    });
  }, []);

  const handleChartDeleted = useCallback(() => {
    setAiGeneratedCharts(prev => prev.slice(0, -1));
  }, []);

  const handleClearGeneratedCharts = useCallback(() => {
    setAiGeneratedCharts([]);
  }, []);

  const handleFilterChange = useCallback((newFilters: Record<string, string>) => {
    setFilters(prev => ({
      ...prev,
      columns: newFilters
    }));
  }, []);

  const dateColumnName = useMemo(
    () => (Array.isArray(dataset?.columns) ? dataset.columns : []).find((column) => column.type === 'date')?.name,
    [dataset],
  );

  useEffect(() => {
    if (!dataset && !isHydrating) {
      void loadDemo().catch(() => undefined);
    }
  }, [dataset, isHydrating, loadDemo]);

  const filteredDataset = useMemo(() => {
    if (!dataset) return null;

    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    const filtered = rows.filter((row) => {
      for (const [col, value] of Object.entries(filters.columns)) {
        if (value && String(row[col]) !== value) return false;
      }

      if (dateColumnName && (filters.dateRange.from || filters.dateRange.to)) {
        const rawValue = row[dateColumnName];
        const parsedDate = rawValue == null ? Number.NaN : Date.parse(String(rawValue));

        if (Number.isNaN(parsedDate)) {
          return false;
        }

        if (filters.dateRange.from && parsedDate < filters.dateRange.from.getTime()) {
          return false;
        }

        if (filters.dateRange.to) {
          const endOfDay = new Date(filters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (parsedDate > endOfDay.getTime()) {
            return false;
          }
        }
      }

      return true;
    });
    return { ...dataset, rows: filtered, rowCount: filtered.length };
  }, [dataset, filters, dateColumnName]);

  const kpis = useMemo(() => {
    if (!filteredDataset) return [];

    const backendBusinessKpis = (analysis?.kpis || []).filter((kpi) => kpi.businessKpi === true);
    if (backendBusinessKpis.length > 0) return backendBusinessKpis;

    if (analysis?.insights && analysis.insights.length > 0) {
      const aiKPIs: KPI[] = [];
      analysis.insights.forEach((insight: Record<string, unknown>) => {
        if (insight.type === 'summary' && insight.metrics) {
          const metrics = insight.metrics as Record<string, unknown>;
          if (metrics.totalRecords !== undefined) {
            aiKPIs.push({ title: 'Total Records', value: String(metrics.totalRecords), icon: 'rows', businessKpi: true });
          }
          if (metrics.totalValue !== undefined) {
            aiKPIs.push({ title: `Total ${metrics.primaryMetric || 'Value'}`, value: String(metrics.totalValue), icon: 'chart', businessKpi: true });
          }
          if (metrics.averageValue !== undefined) {
            aiKPIs.push({ title: `Avg ${metrics.primaryMetric || 'Value'}`, value: String(metrics.averageValue), icon: 'chart', businessKpi: true });
          }
        }
        if (insight.type === 'top_performer' && insight.category) {
          aiKPIs.push({ title: `Top Performer`, value: String(insight.category), icon: 'star', businessKpi: true });
        }
      });
      const businessAiKpis = aiKPIs.filter((kpi) => kpi.businessKpi === true);
      if (businessAiKpis.length > 0) return businessAiKpis;
    }
    return generateDemoKPIs(filteredDataset).filter((kpi) => kpi.businessKpi === true);
  }, [filteredDataset, analysis]);

  const charts = useMemo(() => {
    if (!filteredDataset) return [];
    const baseCharts = analysis?.chartRecommendations && analysis.chartRecommendations.length > 0
      ? analysis.chartRecommendations as ChartConfig[]
      : generateDemoCharts(filteredDataset);
    
    if (aiGeneratedCharts.length > 0) {
      const combined = [...baseCharts, ...aiGeneratedCharts];
      // Deduplicate by title, xKey, and yKey
      const seen = new Set<string>();
      return combined.filter(chart => {
        const key = `${chart.title}|${chart.xKey}|${chart.yKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return baseCharts;
  }, [filteredDataset, analysis, aiGeneratedCharts]);

  const qualityReport = useMemo(() => {
    if (!dataset) return null;
    return analyzeDataQuality(dataset);
  }, [dataset]);

  const executionMeta = useMemo(() => {
    const dashboard = analysis?.dashboard as Record<string, unknown> | undefined;
    const policy = (dataset as { executionPolicy?: Record<string, unknown> } | null)?.executionPolicy;
    return {
      engine: dashboard?.engine || policy?.engine,
      cacheHit: dashboard?.cacheHit,
      durationMs: dashboard?.durationMs,
      rowCount: dashboard?.rowCount || dataset?.rowCount,
    };
  }, [analysis, dataset]);

  if (isHydrating) {
    return (
      <StatusPanel
        title="Loading dashboard"
        message="Connecting to the local API and restoring your dataset."
      />
    );
  }

  if (apiError) {
    return (
      <StatusPanel
        title="Dashboard unavailable"
        message={apiError}
        actionLabel="Retry"
        onAction={() => {
          void retryHydrate();
        }}
      />
    );
  }

  if (!dataset || !filteredDataset) {
    return (
      <StatusPanel
        title="No dataset loaded"
        message="Load the demo dataset or upload a file to start using the dashboard."
        actionLabel="Load Demo Dataset"
        onAction={() => {
          void loadDemo().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {analysis && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Sparkles className="size-3" />
                  AI Insights
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {dataset.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {analysis ? (
                <span className="flex items-center gap-2">
                  <Layers className="size-4" />
                  {analysis.dataTypeLabel} • {filteredDataset.rowCount.toLocaleString()} records
                </span>
              ) : (
                `Analyzing ${dataset.name} • ${filteredDataset.rowCount.toLocaleString()} records`
              )}
            </p>
            {(executionMeta.engine || executionMeta.durationMs !== undefined || executionMeta.cacheHit !== undefined) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {executionMeta.engine && <span className="rounded-md border border-border px-2 py-1">Engine: {String(executionMeta.engine).toUpperCase()}</span>}
                {executionMeta.rowCount !== undefined && <span className="rounded-md border border-border px-2 py-1">Rows: {Number(executionMeta.rowCount).toLocaleString()}</span>}
                {executionMeta.cacheHit !== undefined && <span className="rounded-md border border-border px-2 py-1">Cache: {executionMeta.cacheHit ? "Hit" : "Miss"}</span>}
                {executionMeta.durationMs !== undefined && <span className="rounded-md border border-border px-2 py-1">Duration: {Number(executionMeta.durationMs).toLocaleString()}ms</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => exportDatasetCSV(filteredDataset)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground"
          >
            <Download className="size-4" />
            Export
          </button>
          <button type="button"
            onClick={() => {
              void resetAppState();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        </div>
      </div>

      <DashboardFilters dataset={dataset} filters={filters} onChange={setFilters} />

      {qualityReport && qualityReport.summary.qualityScore < 100 && (
        <DataQualityPanel qualityReport={qualityReport} />
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Key Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => (
            <KPICard key={kpi.title} kpi={kpi} index={index} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Visualizations</h3>
          <span className="text-sm text-muted-foreground">
            {charts.length} chart{charts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {charts.map((chart, index) => (
            <AnalyticsChart key={chart.title} config={chart} index={index} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showSidebar && (
          <AnalyticsSidebar 
            isOpen={showSidebar} 
            onClose={() => setShowSidebar(false)}
            dataset={filteredDataset}
            charts={charts}
            onAddChart={handleChartGenerated}
            onReplaceLatestChart={handleChartModified}
            onRemoveLatestChart={handleChartDeleted}
            onFilterChange={handleFilterChange}
          />
        )}
      </AnimatePresence>

      {!showSidebar && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSidebar(true)}
          className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
        >
          <MessageSquare className="size-5" />
        </motion.button>
      )}
    </div>
  );
};

export default DashboardPage;