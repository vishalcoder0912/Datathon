import { generateWithAgent, chatWithAgent } from './ollama-agent-router.js';
import { AGENTIC_MODELS } from '../../config/agentic-models.js';
import {
  DashboardChatAgent,
  DashboardPlannerAgent,
  GeneralChatAgent,
  ManagerAgent,
  SchemaAgent,
  DashboardQualityAgent,
  FeedbackLearningAgent,
} from '../../agents/ollama-agent-roles.js';
import { DataAnalystAgent } from '../../agents/data-analyst-agent.js';
import {
  buildRagDashboardPlan,
  retrieveSchemaRagMemories,
} from '../ai-analyst/schema-rag-retriever.js';

function inferColumnType(values) {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 100);
  if (!sample.length) return 'empty';
  const numeric = sample.filter((v) => !Number.isNaN(Number(v))).length / sample.length;
  if (numeric >= 0.8) return 'number';
  const dateish = sample.filter((v) => !Number.isNaN(Date.parse(String(v)))).length / sample.length;
  if (dateish >= 0.7) return 'date';
  const unique = new Set(sample.map(String)).size;
  if (unique <= Math.max(20, sample.length * 0.3)) return 'category';
  return 'text';
}

function profileRows(rows = [], columns = []) {
  const names = columns.length
    ? columns.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean)
    : Object.keys(rows[0] || {});

  const columnProfiles = names.map((name) => {
    const values = rows.map((row) => row?.[name]);
    const missing = values.filter((v) => v === null || v === undefined || v === '').length;
    const type = inferColumnType(values);
    const nums = values.map(Number).filter((v) => Number.isFinite(v));
    return {
      name,
      type,
      missing,
      missingRate: rows.length ? Number((missing / rows.length).toFixed(4)) : 0,
      unique: new Set(values.filter((v) => v !== null && v !== undefined).map(String)).size,
      sample: values.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 5),
      stats: nums.length
        ? {
            min: Math.min(...nums),
            max: Math.max(...nums),
            avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          }
        : undefined,
    };
  });

  return {
    rowCount: rows.length,
    columnCount: names.length,
    columns: columnProfiles,
    numericColumns: columnProfiles.filter((c) => c.type === 'number').map((c) => c.name),
    dateColumns: columnProfiles.filter((c) => c.type === 'date').map((c) => c.name),
    categoricalColumns: columnProfiles.filter((c) => c.type === 'category').map((c) => c.name),
    textColumns: columnProfiles.filter((c) => c.type === 'text').map((c) => c.name),
  };
}

function deterministicDashboard(profile) {
  const firstNumber = profile.numericColumns[0];
  const secondNumber = profile.numericColumns[1];
  const firstCategory = profile.categoricalColumns[0];
  const firstDate = profile.dateColumns[0];

  const kpis = [
    { id: 'rows', label: 'Total Rows', type: 'count', field: null },
    { id: 'columns', label: 'Total Columns', type: 'count_columns', field: null },
  ];

  if (firstNumber) {
    kpis.push({ id: `avg_${firstNumber}`, label: `Average ${firstNumber}`, type: 'avg', field: firstNumber });
    kpis.push({ id: `sum_${firstNumber}`, label: `Total ${firstNumber}`, type: 'sum', field: firstNumber });
  }

  const charts = [];
  if (firstCategory && firstNumber) {
    charts.push({
      id: 'category_bar',
      title: `${firstNumber} by ${firstCategory}`,
      type: 'bar',
      x: firstCategory,
      y: firstNumber,
      aggregation: 'sum',
      reason: 'Compares numeric performance across categories.',
    });
  }
  if (firstDate && firstNumber) {
    charts.push({
      id: 'trend_line',
      title: `${firstNumber} trend over ${firstDate}`,
      type: 'line',
      x: firstDate,
      y: firstNumber,
      aggregation: 'sum',
      reason: 'Shows movement over time.',
    });
  }
  if (firstNumber && secondNumber) {
    charts.push({
      id: 'numeric_scatter',
      title: `${firstNumber} vs ${secondNumber}`,
      type: 'scatter',
      x: firstNumber,
      y: secondNumber,
      aggregation: 'none',
      reason: 'Helps inspect relationship between two numeric fields.',
    });
  }

  return {
    kpis,
    charts,
    filters: [firstCategory, firstDate].filter(Boolean),
    warnings: profile.columns
      .filter((c) => c.missingRate > 0.2)
      .map((c) => `${c.name} has ${Math.round(c.missingRate * 100)}% missing values.`),
  };
}

function guardPrompt(profile, dashboardPlan) {
  return `You are InsightFlow dashboard guardian. Validate dashboard specs.\nRules:\n- Return JSON only.\n- Mark invalid charts that reference missing columns.\n- Suggest safer replacements.\n\nSchema columns: ${profile.columns.map((c) => c.name).join(', ')}\n\nDashboard plan:\n${JSON.stringify(dashboardPlan, null, 2)}\n\nReturn JSON with keys: valid, issues, fixedPlan, confidence.`;
}

export async function runModelAwareAgenticAnalysis({ rows = [], columns = [], goal = '' }) {
  const profile = profileRows(rows, columns);
  const audit = [];
  const schemaAgent = new SchemaAgent();
  const dataAnalystAgent = new DataAnalystAgent();
  const plannerAgent = new DashboardPlannerAgent();
  const qualityAgent = new DashboardQualityAgent();
  const feedbackAgent = new FeedbackLearningAgent();

  let rag = { used: false, matches: [] };
  let ragDashboardPlan = null;
  let memories = [];
  try {
    const feedbackResult = await feedbackAgent.execute({
      action: "retrieve",
      data: {
        userQuestion: goal,
        schemaColumns: profile.columns.map((c) => c.name),
        domain: profile.domain || 'generic',
        schemaProfile: profile
      }
    });
    memories = feedbackResult.memories || [];

    rag = await retrieveSchemaRagMemories(profile, { limit: 5 });
    ragDashboardPlan = buildRagDashboardPlan(profile, rag.matches);
    audit.push({
      step: 'rag_memory_retrieval',
      model: rag.query?.embeddingModel || AGENTIC_MODELS.embedding,
      status: 'ok',
      used: rag.used || memories.length > 0,
      matches: rag.matches.length + memories.length,
    });
  } catch (error) {
    audit.push({ step: 'rag_memory_retrieval', model: AGENTIC_MODELS.embedding, status: 'fallback', error: error.message });
  }

  let schemaAnalysis;
  try {
    schemaAnalysis = await schemaAgent.execute({ schemaProfile: profile });
    audit.push({ step: 'schema_analysis', model: AGENTIC_MODELS.schema, agent: 'SchemaAgent', status: 'ok' });
  } catch (error) {
    schemaAnalysis = { fallback: true, error: error.message };
    audit.push({ step: 'schema_analysis', model: AGENTIC_MODELS.schema, agent: 'SchemaAgent', status: 'fallback', error: error.message });
  }

  let managerPlan;
  try {
    managerPlan = await dataAnalystAgent.execute({
      schemaProfile: profile,
      ragMatches: rag.matches || [],
      goal,
    });
    audit.push({ step: 'data_analysis', model: AGENTIC_MODELS.manager, agent: 'DataAnalystAgent', status: 'ok' });
  } catch (error) {
    managerPlan = { fallback: true, domain: profile.domain || 'generic', dashboardGoal: 'executive', requiredKPIs: [], requiredCharts: [], warnings: [error.message] };
    audit.push({ step: 'data_analysis', model: AGENTIC_MODELS.manager, agent: 'DataAnalystAgent', status: 'fallback', error: error.message });
  }

  const deterministicPlan = deterministicDashboard(profile);

  let dashboardPlan;
  try {
    dashboardPlan = await plannerAgent.execute({
      schemaProfile: profile,
      schemaUnderstanding: schemaAnalysis,
      managerPlan,
      ragDashboardPlan,
      ragMatches: rag.matches || [],
      goal,
    });
    if (!Array.isArray(dashboardPlan?.kpis) && !Array.isArray(dashboardPlan?.charts)) {
      dashboardPlan = ragDashboardPlan || deterministicPlan;
    }
    audit.push({ step: 'dashboard_planning', model: AGENTIC_MODELS.dashboardPlanner, agent: 'DashboardPlannerAgent', status: 'ok' });
  } catch (error) {
    dashboardPlan = ragDashboardPlan || deterministicPlan;
    audit.push({ step: 'dashboard_planning', model: AGENTIC_MODELS.dashboardPlanner, agent: 'DashboardPlannerAgent', status: 'fallback', error: error.message });
  }

  let guard;
  try {
    const qualityResult = await qualityAgent.execute({
      schemaProfile: profile,
      dashboardPlan,
    });
    guard = qualityResult;
    audit.push({ step: 'dashboard_quality_check', model: AGENTIC_MODELS.dashboardGuardian, agent: 'DashboardQualityAgent', status: 'ok' });
  } catch (error) {
    guard = { valid: true, fixedPlan: dashboardPlan, fallback: true, error: error.message };
    audit.push({ step: 'dashboard_quality_check', model: AGENTIC_MODELS.dashboardGuardian, agent: 'DashboardQualityAgent', status: 'fallback', error: error.message });
  }

  const finalDashboard = guard?.fixedPlan?.charts || guard?.fixedPlan?.kpis ? guard.fixedPlan : dashboardPlan;

  return {
    success: true,
    mode: 'model-aware-agentic-analytics',
    models: { ...AGENTIC_MODELS },
    agents: ['SchemaAgent', 'DataAnalystAgent', 'DashboardPlannerAgent', 'DashboardQualityAgent', 'FeedbackLearningAgent'],
    profile,
    schemaAnalysis,
    managerPlan,
    rag,
    dashboardPlan,
    dashboard: finalDashboard,
    audit,
    nextTrainingHooks: {
      ragEmbeddingModel: AGENTIC_MODELS.embedding,
      strategy: 'Save accepted dashboard feedback, embed schema/dashboard plan, and retrieve similar memories next time.',
      memoryFiles: ['schema-rag-memory.json', 'schema-training-memory.json', 'ai-analyst-memory.json'],
      fineTuneTargets: [],
    },
  };
}

export async function runModelAwareAgenticChat({ rows = [], columns = [], message = '', history = [] }) {
  const profile = profileRows(rows, columns);
  const isDashboardCommand = /\b(add|remove|delete|change|update|show|filter|explain)\b/i.test(message)
    && /\b(chart|graph|kpi|metric|sales|salary|revenue|region|month|filter|dashboard)\b/i.test(message);

  if (isDashboardCommand) {
    try {
      const agent = new DashboardChatAgent();
      const command = await agent.execute({
        command: message,
        schemaProfile: profile,
        currentDashboard: {},
        history,
      });

      return {
        success: true,
        model: AGENTIC_MODELS.dashboardChat,
        mode: 'dashboard-chat-command',
        command,
        answer: command.answer,
        profile,
      };
    } catch (error) {
      return {
        success: true,
        model: 'fallback-local',
        mode: 'dashboard-chat-command',
        command: {
          intent: 'answer',
          action: {},
          answer: 'I could not convert that into a dashboard action.',
          reason: error.message,
        },
        profile,
      };
    }
  }

  const isGeneralQuestion = !/\b(data|dataset|column|row|chart|kpi|metric|sales|salary|revenue|region|dashboard)\b/i.test(message);
  if (isGeneralQuestion) {
    try {
      const agent = new GeneralChatAgent();
      const result = await agent.execute({ message, history });
      return { success: true, model: result.model, mode: 'general-chat', answer: result.answer, profile };
    } catch {
      // Fall through to schema-aware local response.
    }
  }

  const system = {
    role: 'system',
    content: 'You are InsightFlow agentic data analyst. Use schema/profile and computed summaries only. Do not pretend to inspect hidden rows. Give concise dashboard-ready answers.',
  };
  const user = {
    role: 'user',
    content: `Dataset profile:\n${JSON.stringify(profile, null, 2)}\n\nUser question: ${message}`,
  };

  try {
    const res = await chatWithAgent('generalChat', [system, ...history.slice(-6), user], { json: false });
    return { success: true, model: res.model, answer: res.text, profile };
  } catch (error) {
    return {
      success: true,
      model: 'fallback-local',
      answer: `I analyzed the dataset schema: ${profile.rowCount} rows, ${profile.columnCount} columns. Numeric columns: ${profile.numericColumns.join(', ') || 'none'}. Category columns: ${profile.categoricalColumns.join(', ') || 'none'}.`,
      profile,
      error: error.message,
    };
  }
}
