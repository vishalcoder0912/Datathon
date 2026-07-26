import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardPlan, KpiSpec as SharedKpiSpec } from "@/types/dashboard";
import { schemaTrainedApi } from "@/features/data/api/schemaTrainedApi.additions";
import {
  applyDashboardFilters,
  calculateCharts,
  calculateKpis,
  validateChartSpecForRows,
  type DashboardFilter,
  type DataRow,
} from "@/features/dashboard/utils/schemaLocalAnalytics";

export type SchemaDashboardChartSpec = {
  id?: string;
  type:
    | "bar"
    | "line"
    | "area"
    | "pie"
    | "donut"
    | "histogram"
    | "scatter"
    | "radar"
    | "composed"
    | "heatmap"
    | "horizontalBar"
    | "horizontal_bar"
    | "map"
    | "table";
  title: string;
  xKey: string;
  yKey: string;
  aggregation: "none" | "count" | "sum" | "avg" | "min" | "max" | "median" | "count_unique";
  intent?: "trend" | "ranking" | "distribution" | "correlation" | "geo" | "comparison" | "table" | "relationship" | "geo_ranking" | "segment_comparison" | "skill_salary_impact";
  limit?: number;
  multiValue?: boolean;
  splitValues?: boolean;
  splitDelimiter?: string;
};

export type SchemaDashboardKpiSpec = {
  id?: string;
  title: string;
  metric: string;
  aggregation: "count" | "sum" | "avg" | "min" | "max" | "median" | "count_unique" | "top_by_avg";
  format?: "number" | "currency" | "percent" | "text";
  businessKpi?: boolean;
};

type DatasetInput = {
  datasetId?: string;
  datasetName?: string;
  rows?: DataRow[];
  columns?: Array<{ name: string } | string>;
  dictionaryRows?: unknown[];
  autoLoad?: boolean;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

function normalizeName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasColumn(rows: DataRow[], name: string) {
  if (!rows.length) return false;
  return Object.prototype.hasOwnProperty.call(rows[0], name);
}

function getColumns(rows: DataRow[], explicitColumns?: Array<{ name: string } | string>) {
  if (explicitColumns?.length) {
    return explicitColumns
      .map((column) => (typeof column === "string" ? column : column.name))
      .filter(Boolean);
  }

  return Object.keys(rows[0] || {}).filter((key) => !key.startsWith("_"));
}

function findColumn(columns: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeName);

  return (
    columns.find((column) => normalizedAliases.includes(normalizeName(column))) ||
    columns.find((column) =>
      normalizedAliases.some((alias) => normalizeName(column).includes(alias)),
    ) ||
    null
  );
}

function isSalaryDataset(rows: DataRow[], columns: string[]) {
  const text = columns.map(normalizeName).join(" ");
  return (
    /salary|salary_usd|income|pay/.test(text) &&
    /experience|country|education|language|languages|framework|frameworks|company_size/.test(text)
  );
}

function strictSalaryKpis(columns: string[]): SchemaDashboardKpiSpec[] {
  const salary = findColumn(columns, ["salary_usd", "salary", "income"]);
  const country = findColumn(columns, ["country", "region", "location"]);

  const kpis: SchemaDashboardKpiSpec[] = [];

  if (salary) {
    kpis.push(
      {
        id: "average-salary",
        title: "Average Salary",
        metric: salary,
        aggregation: "avg",
        format: "currency",
        businessKpi: true,
      },
      {
        id: "highest-salary",
        title: "Highest Salary",
        metric: salary,
        aggregation: "max",
        format: "currency",
        businessKpi: true,
      }
    );
  }

  kpis.push({
    id: "total-records",
    title: "Total Records",
    metric: "__row_count__",
    aggregation: "count",
    format: "number",
    businessKpi: true,
  });

  if (country) {
    kpis.push({
      id: "countries-covered",
      title: "Countries Covered",
      metric: country,
      aggregation: "count_unique",
      format: "number",
      businessKpi: true,
    });
  }

  return kpis;
}

function strictSalaryCharts(columns: string[]): SchemaDashboardChartSpec[] {
  const salary = findColumn(columns, ["salary_usd", "salary", "income"]) || "salary_usd";
  const experience = findColumn(columns, ["experience", "years_experience", "exp"]) || "experience";
  const country = findColumn(columns, ["country", "region", "location"]) || "country";
  const education = findColumn(columns, ["education", "degree", "qualification"]) || "education";
  const companySize = findColumn(columns, ["company_size", "company", "size"]) || "company_size";

  return [
    {
      id: "salary-distribution",
      title: "Salary Distribution",
      type: "histogram",
      xKey: salary,
      yKey: salary,
      aggregation: "count",
      intent: "distribution",
      limit: 12,
    },
    {
      id: "salary-by-country",
      title: "Salary by Country",
      type: "bar",
      xKey: country,
      yKey: salary,
      aggregation: "avg",
      intent: "geo_ranking",
      limit: 10,
    },
    {
      id: "experience-vs-salary",
      title: "Experience vs Salary",
      type: "scatter",
      xKey: experience,
      yKey: salary,
      aggregation: "none",
      intent: "relationship",
      limit: 500,
    },
    {
      id: "education-distribution",
      title: "Education Distribution",
      type: "donut",
      xKey: education,
      yKey: "count",
      aggregation: "count",
      intent: "distribution",
      limit: 10,
    },
    {
      id: "salary-by-company-size",
      title: "Salary by Company Size",
      type: "bar",
      xKey: companySize,
      yKey: salary,
      aggregation: "avg",
      intent: "segment_comparison",
      limit: 10,
    },
    {
      id: "country-salary-heatmap",
      title: "Country Salary Heatmap",
      type: "heatmap",
      xKey: country,
      yKey: salary,
      aggregation: "avg",
      intent: "geo",
      limit: 10,
    },
    {
      id: "top-education-by-average-salary",
      title: "Top Education by Average Salary",
      type: "bar",
      xKey: education,
      yKey: salary,
      aggregation: "avg",
      intent: "ranking",
      limit: 10,
    },
  ];
}

function makeLocalFallbackDashboard(
  rows: DataRow[],
  columnsInput?: Array<{ name: string } | string>,
) {
  const columns = getColumns(rows, columnsInput);

  if (isSalaryDataset(rows, columns)) {
    return {
      source: "frontend-strict-salary-fallback",
      domain: "workforce_salary",
      kpis: strictSalaryKpis(columns),
      charts: strictSalaryCharts(columns),
    };
  }

  const numeric = columns.find((column) =>
    rows.slice(0, 50).some((row) => Number.isFinite(Number(row[column]))),
  );

  const category = columns.find((column) => column !== numeric);

  const kpis: SchemaDashboardKpiSpec[] = [
    {
      id: "total-records",
      title: "Total Records",
      metric: "__row_count__",
      aggregation: "count",
      format: "number",
      businessKpi: true,
    },
  ];

  if (numeric) {
    kpis.push({
      id: `avg-${normalizeName(numeric)}`,
      title: `Average ${numeric}`,
      metric: numeric,
      aggregation: "avg",
      format: "number",
      businessKpi: true,
    });
  }

  const charts: SchemaDashboardChartSpec[] = [];

  if (numeric && category) {
    charts.push({
      id: `avg-${normalizeName(numeric)}-by-${normalizeName(category)}`,
      title: `Average ${numeric} by ${category}`,
      type: "bar",
      xKey: category,
      yKey: numeric,
      aggregation: "avg",
      limit: 10,
    });
  }

  if (numeric) {
    charts.push({
      id: `${normalizeName(numeric)}-distribution`,
      title: `${numeric} Distribution`,
      type: "histogram",
      xKey: numeric,
      yKey: numeric,
      aggregation: "count",
      limit: 12,
    });
  }

  if (category) {
    charts.push({
      id: `${normalizeName(category)}-distribution`,
      title: `${category} Distribution`,
      type: "donut",
      xKey: category,
      yKey: "count",
      aggregation: "count",
      limit: 10,
    });
  }

  return {
    source: "frontend-generic-fallback",
    domain: "generic",
    kpis,
    charts,
  };
}

function makeAnalystFallbackExplanation(rows: DataRow[], columnsInput?: Array<{ name: string } | string>) {
  const columns = getColumns(rows, columnsInput);
  const salary = findColumn(columns, ["salary_usd", "salary", "income", "pay"]);
  const revenue = findColumn(columns, ["revenue", "sales", "amount", "profit", "billing"]);
  const country = findColumn(columns, ["country", "region", "state", "city", "location"]);
  const education = findColumn(columns, ["education", "degree", "qualification"]);
  const experience = findColumn(columns, ["experience", "seniority", "tenure", "years"]);
  const category = findColumn(columns, ["category", "segment", "department", "product_category", "status"]);
  const metric = salary || revenue || columns.find((column) =>
    rows.slice(0, 50).some((row) => Number.isFinite(Number(row[column]))),
  );
  const segment = country || education || experience || category || columns.find((column) => column !== metric);

  const fieldLines = [
    metric ? `- ${metric} -> primary business metric` : null,
    country ? `- ${country} -> geographic distribution` : null,
    education ? `- ${education} -> qualification level` : null,
    experience ? `- ${experience} -> seniority indicator` : null,
    segment && segment !== country && segment !== education && segment !== experience ? `- ${segment} -> analysis segment` : null,
  ].filter(Boolean);

  const chartLines = [
    metric && segment ? `- ${metric} by ${segment}` : null,
    metric ? `- ${metric} Distribution` : null,
    country && metric ? `- Top ${country} by ${metric}` : null,
    education && metric ? `- ${education} vs ${metric}` : null,
    experience && metric ? `- ${metric} by ${experience}` : null,
  ].filter(Boolean);

  return [
    "This looks like a dataset that can be turned into a practical analytics dashboard around its key measures and business segments.",
    "",
    "The most useful fields appear to be:",
    ...(fieldLines.length ? fieldLines : ["- The available fields can support segment, ranking, and distribution analysis."]),
    "",
    "I recommend starting with:",
    ...(chartLines.length ? chartLines : ["- Category Breakdown", "- Metric Distribution", "- Top Segment Ranking"]),
  ].join("\n");
}

function dedupeCharts(charts: SchemaDashboardChartSpec[]) {
  const seen = new Set<string>();

  return charts.filter((chart) => {
    const key = `${chart.title}|${chart.type}|${chart.xKey}|${chart.yKey}|${chart.aggregation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPlanFromResponse(response: Record<string, unknown>) {
  const data: Record<string, unknown> = (response?.data as Record<string, unknown>) || response || {};
  return (data.dashboardPlan || data.dashboard || ((data.data as Record<string, unknown>)?.dashboardPlan) || ((data.data as Record<string, unknown>)?.dashboard) || null) as DashboardPlan | null;
}

export function useSchemaTrainedDashboard({
  datasetId = "local-dataset",
  datasetName = "Uploaded Dataset",
  rows = [],
  columns = [],
  dictionaryRows = [],
  autoLoad = true,
}: DatasetInput) {
  const [loading, setLoading] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [memoryMatch, setMemoryMatch] = useState<Record<string, unknown> | null>(null);
  const [model, setModel] = useState<string | undefined>();
  const [provider, setProvider] = useState<string>("local");

  const [kpiSpecs, setKpiSpecs] = useState<SchemaDashboardKpiSpec[]>([]);
  const [chartSpecs, setChartSpecs] = useState<SchemaDashboardChartSpec[]>([]);
  const [filters, setFilters] = useState<DashboardFilter[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Schema-trained assistant ready. I can build, fix, explain, or train dashboard patterns without sending raw rows to the LLM.",
    },
  ]);

  const safeRows = useMemo(() => rows.filter(Boolean), [rows]);

  const filteredRows = useMemo(
    () => applyDashboardFilters(safeRows, filters),
    [safeRows, filters],
  );

  const currentDashboard = useMemo(
    () => ({
      kpis: kpiSpecs,
      charts: chartSpecs,
      filters,
    }),
    [kpiSpecs, chartSpecs, filters],
  );

  const applyDashboardPlan = useCallback(
    (plan: DashboardPlan | null | undefined, source = "unknown") => {
      const fallback = makeLocalFallbackDashboard(safeRows, columns);
      const incomingKpis = Array.isArray(plan?.kpis) ? plan.kpis : [];
      const incomingCharts = Array.isArray(plan?.charts) ? plan.charts : [];

      const columnsList = getColumns(safeRows, columns);
      const salaryMode = isSalaryDataset(safeRows, columnsList);

      const finalKpis = salaryMode
        ? strictSalaryKpis(columnsList)
        : incomingKpis.length
          ? incomingKpis
          : fallback.kpis;

      const finalCharts = salaryMode
        ? strictSalaryCharts(columnsList)
        : incomingCharts.length
          ? incomingCharts
          : fallback.charts;

      const validCharts = dedupeCharts(finalCharts)
        .filter((spec) => {
          if (spec.xKey === "__row_index__") return false;
          if ((spec.type === "line" || spec.intent === "trend") && !/date|time/i.test(spec.xKey)) return false;
          if (!hasColumn(safeRows, spec.xKey)) return false;
          if (spec.yKey !== "count" && !hasColumn(safeRows, spec.yKey)) return false;
          const valid = validateChartSpecForRows(safeRows, spec);
          return valid.ok;
        })
        .slice(0, salaryMode ? 7 : 10);

      setKpiSpecs(finalKpis.slice(0, 8));
      setChartSpecs(validCharts);

      setProvider(plan?.provider || source);
    },
    [safeRows, columns],
  );

  const loadDashboard = useCallback(async () => {
    if (!safeRows.length) return;

    setLoading(true);
    setError(null);

    try {
      const response = await schemaTrainedApi.generateSchemaDashboard(datasetId, {
        name: datasetName,
        rows: safeRows,
        columns,
        dictionaryRows,
        useLlm: true,
      } as Record<string, unknown>);

      const data = response?.data || {};
      const plan = getPlanFromResponse(response);

      setProfile(data.profile || null);
      setMemoryMatch(data.memoryMatch || data.match || null);
      setModel(data.model);
      setProvider(data.provider || "schema-trained-api");
      if (data.provider) localStorage.setItem("last_selected_provider", data.provider);
      if (data.model) localStorage.setItem("last_selected_model", data.model);

      applyDashboardPlan(plan, data.provider || "schema-trained-api");

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Dashboard loaded from ${
            data.provider || "schema-trained-api"
          }. If backend returns incomplete specs, local quality guard fills valid charts.`,
        },
      ]);
    } catch (err) {
      const fallback = makeLocalFallbackDashboard(safeRows, columns);
      applyDashboardPlan(fallback, "frontend-fallback");

      const message =
        err instanceof Error
          ? err.message
          : "Schema dashboard API failed. Local fallback dashboard generated.";

      setError(message);
      setProvider("frontend-fallback");

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Backend schema dashboard failed, so I generated a local schema-safe dashboard.\n\nDebug: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [safeRows, datasetId, datasetName, columns, dictionaryRows, applyDashboardPlan]);

  useEffect(() => {
    // Guard: only auto-load once per datasetId, not on every safeRows / loadDashboard reference change.
    // Without this guard, including `loadDashboard` in deps causes a re-call loop because
    // loadDashboard is re-created when safeRows changes, triggering this effect again.
    if (!autoLoad || !safeRows.length) return;
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, datasetId]); // Only re-run when the dataset itself changes, not on every render

  const kpis = useMemo(() => calculateKpis(filteredRows, kpiSpecs as unknown as Parameters<typeof calculateKpis>[1]), [filteredRows, kpiSpecs]);

  const charts = useMemo(
    () => calculateCharts(filteredRows, chartSpecs as unknown as Parameters<typeof calculateCharts>[1]),
    [filteredRows, chartSpecs],
  );

  const applyCommand = useCallback(
    (command: Record<string, unknown> | null | undefined) => {
      if (!command) return;

      if (command.action === "GENERATE_DASHBOARD") {
        const plan = command.dashboardPlan || command.dashboard;
        if (plan) {
          applyDashboardPlan(plan, command.provider || "dashboard-command");
        }
        return;
      }

      if (command.action === "GENERATE_CHART" && command.chartSpec) {
        const valid = validateChartSpecForRows(safeRows, command.chartSpec);
        if (!valid.ok) {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: valid.reason || "This chart is not compatible with the current dataset.",
            },
          ]);
          return;
        }

        setChartSpecs((current) => dedupeCharts([command.chartSpec, ...current]).slice(0, 10));
        return;
      }

      if (command.action === "MODIFY_CHART" && command.chartSpec) {
        const valid = validateChartSpecForRows(safeRows, command.chartSpec);
        if (!valid.ok) {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: valid.reason || "This chart conversion is not compatible.",
            },
          ]);
          return;
        }

        setChartSpecs((current) => {
          if (!current.length) return [command.chartSpec];
          const copy = [...current];
          copy[0] = { ...copy[0], ...command.chartSpec };
          return copy;
        });
        return;
      }

      if (command.action === "DELETE_CHART") {
        setChartSpecs((current) => current.slice(1));
        return;
      }

      if (command.action === "GENERATE_KPI" && command.kpiSpec) {
        setKpiSpecs((current) => [command.kpiSpec, ...current].slice(0, 8));
        return;
      }

      if (command.action === "FILTER" && command.filters) {
        const nextFilters = Array.isArray(command.filters)
          ? command.filters
          : Object.entries(command.filters).map(([key, value]) => ({
              key,
              operator: "equals" as const,
              value,
            }));

        setFilters((current) => [...current, ...nextFilters]);
        return;
      }

      if (command.action === "CLEAR_FILTERS") {
        setFilters([]);
      }
    },
    [safeRows, applyDashboardPlan],
  );

  const sendCommand = useCallback(
    async (query: string) => {
      const text = query.trim();
      if (!text || !safeRows.length || commandLoading) return;

      setCommandLoading(true);
      setError(null);
      setMessages((current) => [...current, { role: "user", content: text }]);

      try {
        if (/understand|explain schema|schema samjhao|data samjhao/i.test(text)) {
          const response = await schemaTrainedApi.understandDatasetSchema(datasetId, {
            name: datasetName,
            rows: safeRows,
            columns,
            dictionaryRows,
          } as Record<string, unknown>);

          const result = response?.data || response;
          setProfile(result?.profile || profile);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: result?.explanation || "Schema understanding generated.",
            },
          ]);
          return;
        }

        if (/smart dashboard|best dashboard|rag dashboard/i.test(text)) {
          const response = await schemaTrainedApi.generateSmartRagDashboard(datasetId, {
            name: datasetName,
            rows: safeRows,
            columns,
            dictionaryRows,
            useOllama: true,
          } as Record<string, unknown>);

          const result = response?.data || response;
          if (result?.dashboard) {
            applyDashboardPlan(result.dashboard, "smart-rag-dashboard");
          }
          setProfile(result?.profile || profile);
          setProvider("smart-rag-dashboard");
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content:
                result?.understanding?.userExplanation ||
                "Smart RAG dashboard generated.",
            },
          ]);
          return;
        }

        if (/remember|train this|save pattern|learn this dashboard/i.test(text)) {
          const response = await schemaTrainedApi.trainSmartRagDashboard(datasetId, {
            name: datasetName,
            rows: safeRows,
            columns,
            dictionaryRows,
            acceptedDashboardPlan: currentDashboard,
            rating: "good",
            notes: "User approved this dashboard from UI.",
            useOllama: true,
          } as Record<string, unknown>);

          const result = response?.data || response;
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: `I saved this dashboard pattern. RAG memory now has ${result?.stats?.total || "updated"} patterns.`,
            },
          ]);
          return;
        }

        const response = await schemaTrainedApi.runDashboardCommand(datasetId, {
          query: text,
          currentDashboard,
          name: datasetName,
          rows: safeRows,
          columns,
          dictionaryRows,
          useLlm: true,
        } as Record<string, unknown>);

        const command = response?.data || response;
        applyCommand(command);

        setProvider(command?.provider || "dashboard-command");
        if (command?.provider) localStorage.setItem("last_selected_provider", command.provider);
        if (command?.model) localStorage.setItem("last_selected_model", command.model);

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: command?.message || "Dashboard command applied.",
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dashboard command failed.";
        setError(message);

        if (/fix|build|regenerate|dashboard|7 chart|seven chart/i.test(text)) {
          const fallback = makeLocalFallbackDashboard(safeRows, columns);
          applyDashboardPlan(fallback, "frontend-command-fallback");

          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: `Backend command failed, so I rebuilt the dashboard locally with schema-safe rules.\n\nDebug: ${message}`,
            },
          ]);
        } else {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: message,
            },
          ]);
        }
      } finally {
        setCommandLoading(false);
      }
    },
    [
      safeRows,
      commandLoading,
      datasetId,
      currentDashboard,
      datasetName,
      columns,
      dictionaryRows,
      profile,
      applyCommand,
      applyDashboardPlan,
    ],
  );

  const sendChat = useCallback(
    async (query: string) => {
      const text = query.trim();
      if (!text || !safeRows.length || commandLoading) return;

      setCommandLoading(true);
      setMessages((current) => [...current, { role: "user", content: text }]);

      try {
        const response = await schemaTrainedApi.runSchemaChat(datasetId, {
          query: text,
          name: datasetName,
          rows: safeRows,
          columns,
          dictionaryRows,
          useLlm: true,
        } as Record<string, unknown>);

        const chatData = response?.data || response;
        if (chatData?.assistantMessage?.provider || chatData?.provider) {
          localStorage.setItem("last_selected_provider", chatData.assistantMessage?.provider || chatData.provider);
        }
        if (chatData?.assistantMessage?.model || chatData?.model) {
          localStorage.setItem("last_selected_model", chatData.assistantMessage?.model || chatData.model);
        }

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              chatData?.assistantMessage?.content ||
              "I generated a schema-safe explanation.",
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Schema chat failed.";

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: `${makeAnalystFallbackExplanation(safeRows, columns)}\n\nDebug: ${message}`,
          },
        ]);
      } finally {
        setCommandLoading(false);
      }
    },
    [safeRows, commandLoading, datasetId, datasetName, columns, dictionaryRows],
  );

  const trainAcceptedDashboard = useCallback(async () => {
    if (!safeRows.length) return;

    await schemaTrainedApi.trainSchemaDashboard(datasetId, {
      name: datasetName,
      rows: safeRows,
      columns,
      dashboardPlan: {
        kpis: kpiSpecs,
        charts: chartSpecs,
      },
      rating: "good",
      notes: "User accepted this dashboard pattern.",
    } as Record<string, unknown>);

    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: "This dashboard pattern has been trained into schema memory.",
      },
    ]);
  }, [safeRows, datasetId, datasetName, columns, kpiSpecs, chartSpecs]);

  return {
    loading,
    commandLoading,
    error,

    profile,
    memoryMatch,
    model,
    provider,

    kpiSpecs,
    chartSpecs,
    filters,
    filteredRows,
    kpis,
    charts,
    messages,

    setKpiSpecs,
    setChartSpecs,
    setFilters,
    setMessages,

    loadDashboard,
    reload: loadDashboard,
    sendCommand,
    sendChat,
    applyCommand,
    trainAcceptedDashboard,
  };
}