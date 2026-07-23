import { BaseAgent } from "./base-agent.js";
import { generateWithAgent, chatWithAgent } from "../services/agentic/ollama-agent-router.js";
import {
  storeSchemaMemory,
  findSimilarSchemaMemories,
  storeFeedback,
} from "../services/ollama/schema-rag-memory-service.js";
import {
  saveLearningCorrection,
  retrieveLearningMemory,
} from "../services/ai-analyst/self-learning-memory.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function columnNames(schema = {}) {
  return asArray(schema.columns).map((column) => column.name || column).filter(Boolean);
}

function normalizeSchemaProfile(schema = {}) {
  const columns = asArray(schema.columns);

  return {
    measures: columns
      .filter((column) => ["number", "metric", "money_metric", "score_metric", "count_metric", "continuous_metric"].includes(column.type) || String(column.role || "").includes("metric"))
      .map((column) => column.name),
    dimensions: columns
      .filter((column) => ["string", "category", "dimension", "location", "target"].includes(column.type) || ["dimension", "category", "location", "target"].includes(column.role))
      .map((column) => column.name),
    dateColumns: columns
      .filter((column) => column.type === "date" || column.role === "date")
      .map((column) => column.name),
    idColumns: columns
      .filter((column) => /(^id$|_id$|uuid|identifier)/i.test(column.name || ""))
      .map((column) => column.name),
    financialColumns: columns
      .filter((column) => /sales|revenue|salary|price|amount|cost|profit|income|budget|compensation/i.test(column.name || "") || column.role === "money_metric")
      .map((column) => column.name),
    geoColumns: columns
      .filter((column) => /country|city|state|region|location|geo|address|lat|lng/i.test(column.name || "") || column.role === "location")
      .map((column) => column.name),
    customerColumns: columns
      .filter((column) => /customer|client|user|buyer|member/i.test(column.name || ""))
      .map((column) => column.name),
    productColumns: columns
      .filter((column) => /product|item|category|subcategory|sku/i.test(column.name || ""))
      .map((column) => column.name),
    qualityIssues: columns
      .filter((column) => Number(column.nullCount || 0) > 0 || Number(column.missingRate || 0) > 0.2)
      .map((column) => ({
        column: column.name,
        issue: Number(column.missingRate || 0) > 0.2 ? "high_missing_rate" : "missing_values",
      })),
  };
}

function parseAgentJson(result, fallback) {
  return result?.json && typeof result.json === "object" ? result.json : fallback;
}

export class ManagerAgent extends BaseAgent {
  async execute({ schemaProfile = {}, ragMatches = [], goal = "" } = {}) {
    this.addThought({ action: "manager_plan", reasoning: "Choosing dashboard domain and strategy from schema/RAG context only." });

    const prompt = `You are ManagerAgent for an agentic analytics platform.
Return JSON only. Do not calculate data values.

Allowed domains: sales, salary, education, finance, generic
Allowed dashboardGoal: executive, operational, diagnostic

Return exactly:
{
  "domain": "sales | salary | education | finance | generic",
  "dashboardGoal": "executive | operational | diagnostic",
  "requiredKPIs": [],
  "requiredCharts": [],
  "warnings": []
}

User goal: ${goal || "Create the best analytics dashboard."}
Schema profile:
${JSON.stringify(schemaProfile, null, 2)}
RAG matches:
${JSON.stringify(ragMatches.slice(0, 3), null, 2)}`;

    const result = await generateWithAgent("manager", prompt, { json: true });
    return parseAgentJson(result, {
      domain: schemaProfile.domain || "generic",
      dashboardGoal: "executive",
      requiredKPIs: [],
      requiredCharts: [],
      warnings: [],
    });
  }
}

export class SchemaAgent extends BaseAgent {
  async execute({ schemaProfile = {}, sampleSummary = {} } = {}) {
    this.addThought({ action: "schema_understanding", reasoning: "Running senior data analyst schema understanding." });

    const fallback = normalizeSchemaProfile(schemaProfile);
    
    const isSales = schemaProfile.domain === 'sales_analytics' || 
                    schemaProfile.domain === 'sales_commerce' || 
                    /sales|revenue|profit|invoice|transaction|sales_rep|quantity_sold/i.test(JSON.stringify(schemaProfile));

    let systemRolePrompt = `You are a senior data analyst.

You will receive only dataset schema, sample statistics, column names, data types, missing values, unique counts, and numeric ranges.

Your task:
1. Detect business domain.
2. Identify measures, dimensions, date columns, ID columns, financial columns, geo columns, customer columns, and product columns.
3. Recommend useful KPIs.
4. Recommend useful charts.
5. Reject charts that do not make analytical sense.
6. Return only valid JSON.

Never invent columns.
Never calculate values yourself.
Never create line chart without date/time column.
Never create pie chart for high-cardinality numeric values.`;

    if (isSales) {
      systemRolePrompt = `You are a senior sales data analyst.

When a sales dataset is uploaded, analyze it like a real business dashboard.

Your job:
1. Detect sales/revenue/profit/quantity/order columns.
2. Detect date, product, category, region, customer, and channel columns.
3. Create KPIs that help business decisions.
4. Create charts that explain sales performance.
5. Give reasons for every KPI and chart.
6. Reject charts that are visually nice but analytically useless.

Never invent columns.
Never use ID columns as numeric metrics.
Never create a line chart without date.
Never create a pie chart with more than 6 categories.
Always create top-N product/customer charts when many categories exist.`;
    }

    const prompt = `${systemRolePrompt}

Format the response exactly as:
{
  "domain": "sales_analytics | sales_commerce | workforce_salary | education | finance | generic",
  "measures": [],
  "dimensions": [],
  "dateColumns": [],
  "idColumns": [],
  "financialColumns": [],
  "geoColumns": [],
  "customerColumns": [],
  "productColumns": [],
  "qualityIssues": [],
  "recommendedKPIs": [],
  "recommendedCharts": []
}

Schema profile:
${JSON.stringify(schemaProfile, null, 2)}
Sample summary:
${JSON.stringify(sampleSummary, null, 2)}`;

    const result = await generateWithAgent("schema", prompt, { json: true });
    return parseAgentJson(result, fallback);
  }
}

export class DashboardPlannerAgent extends BaseAgent {
  async execute({ schemaProfile = {}, schemaUnderstanding = {}, managerPlan = {}, ragDashboardPlan = null, ragMatches = [], goal = "" } = {}) {
    this.addThought({ action: "dashboard_plan", reasoning: "Planning KPI and chart specifications without calculating metric values." });

    const matchesInfo = (ragMatches || []).map(m => {
      const entry = m.entry || m;
      return {
        name: entry.name || entry.id,
        domain: entry.domain,
        score: m.score,
        matchType: m.score >= 0.70 ? "strong match (highly relevant - prioritize this structure)" : "weak reference (use only as inspiration)",
        dashboardPlan: entry.dashboardPlan
      };
    });

    const prompt = `You are a senior business data analyst.

You receive only schema profile, column statistics, detected domain, and retrieved RAG memories.

Your task:
1. Understand the dataset domain.
2. Identify measures, dimensions, date columns, ID columns, and financial columns.
3. Choose KPIs that help business decisions.
4. Choose charts that answer real analytical questions.
5. Use RAG memory only if it matches the current schema.
6. Never invent columns.
7. Never calculate values yourself.
8. Backend will calculate KPI values.
9. Return only valid JSON.

Priority:
- Correct schema usage
- Business usefulness
- Real dashboard quality
- Clear reason for every KPI and chart

Return JSON only in this exact format:
{
  "domain": "sales_analytics",
  "confidence": 0.94,
  "dashboardGoal": "Track revenue, profit, product performance, and regional growth.",
  "kpis": [
    { "title": "Total Revenue", "metric": "sales", "aggregation": "sum", "reason": "Sales is the main revenue metric." }
  ],
  "charts": [
    { "title": "Revenue Trend", "type": "line", "xKey": "date", "yKey": "sales", "aggregation": "sum", "reason": "Date column exists, so trend analysis is useful." }
  ],
  "insightQuestions": ["Which product category generates the highest profit?"],
  "warnings": [],
  "reasoningSummary": "This dashboard focuses on revenue and profit because those are the strongest business metrics in the schema."
}

User goal: ${goal || "Create a dashboard"}
Schema profile:
${JSON.stringify(schemaProfile, null, 2)}
SchemaAgent:
${JSON.stringify(schemaUnderstanding, null, 2)}
ManagerAgent:
${JSON.stringify(managerPlan, null, 2)}
RAG matches details (use strong matches over weak references):
${JSON.stringify(matchesInfo, null, 2)}`;

    const fallback = {
      domain: schemaProfile.domain || "generic",
      confidence: 0.5,
      dashboardGoal: goal || "Create a dashboard",
      kpis: ragDashboardPlan?.kpis || [],
      charts: ragDashboardPlan?.charts || [],
      insightQuestions: [],
      warnings: [],
      reasoningSummary: "Fallback dashboard plan."
    };

    const result = await generateWithAgent("dashboardPlanner", prompt, { json: true });
    return parseAgentJson(result, fallback);
  }
}

export class DashboardChatAgent extends BaseAgent {
  async execute({ command = "", schemaProfile = {}, currentDashboard = {}, history = [] } = {}) {
    this.addThought({ action: "dashboard_command", reasoning: "Routing dashboard chat command into a structured dashboard action." });

    const system = {
      role: "system",
      content: `You are DashboardChatAgent. Handle chart/KPI/filter/explanation commands only.
Return JSON only:
{
  "intent": "add_chart|remove_chart|update_chart|add_kpi|filter|explain|answer",
  "action": {},
  "answer": "",
  "reason": ""
}
Use only columns from schema. Do not calculate metric values.`,
    };
    const user = {
      role: "user",
      content: `Command: ${command}
Schema:
${JSON.stringify(schemaProfile, null, 2)}
Current dashboard:
${JSON.stringify(currentDashboard, null, 2)}`,
    };

    const result = await chatWithAgent("dashboardChat", [system, ...history.slice(-6), user], { json: true });
    return parseAgentJson(result, {
      intent: "answer",
      action: {},
      answer: "I could not convert that into a dashboard action.",
      reason: "The command did not map to a valid schema-aware dashboard operation.",
    });
  }
}

export class GeneralChatAgent extends BaseAgent {
  async execute({ message = "", history = [] } = {}) {
    this.addThought({ action: "general_chat", reasoning: "Answering a non-dashboard conversational question." });

    const result = await chatWithAgent("generalChat", [
      {
        role: "system",
        content: "You are GeneralChatAgent. Answer normal non-data questions concisely. Do not modify dashboards.",
      },
      ...history.slice(-8),
      { role: "user", content: message },
    ]);

    return {
      answer: result.text,
      model: result.model,
    };
  }
}

export class DashboardQualityAgent extends BaseAgent {
  async execute({ schemaProfile = {}, dashboardPlan = {} } = {}) {
    this.addThought({ action: "quality_check", reasoning: "Checking if dashboard is logically correct." });

    const prompt = `You are DashboardQualityAgent.
Analyze the proposed dashboard plan and schema context. Check if it is logically and analytically correct according to these rules:
1. Reject any chart or KPI that uses a missing column.
2. Reject line/area charts that do not have a date/time column on the x-axis.
3. Reject pie/donut charts with more than 6 categories.
4. Reject using ID columns (matching /(^id$|_id$|uuid|identifier)/i) for SUM or AVG aggregations in either KPIs or charts.
5. Reject using numeric/money fields as x-axis categories unless it's a scatter or histogram.
6. Every chart and KPI must have a business reason.
7. If a dimension has high cardinality (>10 categories), limit the chart to 10 items (Top-N).
8. Prefer metrics like revenue, sales, profit, and amount over arbitrary fields.

If a chart/KPI violates these rules, remove or fix it.
Return only valid JSON.

Format the response exactly as:
{
  "valid": true | false,
  "issues": [
    { "type": "rule_violation", "message": "Why it violates" }
  ],
  "fixedPlan": {
    "kpis": [...],
    "charts": [...],
    "filters": [...]
  },
  "confidence": 0.0 - 1.0
}

Schema Profile:
${JSON.stringify(schemaProfile, null, 2)}

Proposed Dashboard Plan:
${JSON.stringify(dashboardPlan, null, 2)}`;

    const result = await generateWithAgent("guard", prompt, { json: true });
    return parseAgentJson(result, {
      valid: true,
      issues: [],
      fixedPlan: dashboardPlan,
      confidence: 1.0,
    });
  }
}

export class FeedbackLearningAgent extends BaseAgent {
  async execute({ action = "retrieve", data = {} } = {}) {
    this.addThought({ action: "feedback_learning", reasoning: `Processing feedback/learning action: ${action}` });

    if (action === "store_success") {
      const entry = await storeSchemaMemory({
        schemaProfile: data.schemaProfile,
        dashboardPlan: data.dashboardPlan,
        domain: data.domain,
        feedback: data.feedback,
      });
      return { success: true, memoryId: entry.id };
    }

    if (action === "store_correction") {
      const correction = saveLearningCorrection({
        domain: data.domain,
        userQuestion: data.userQuestion,
        wrongAnswer: data.wrongAnswer,
        correctAnswer: data.correctAnswer,
        schemaColumns: data.schemaColumns,
        rule: data.rule,
      });
      return { success: true, correction };
    }

    if (action === "retrieve") {
      const memories = retrieveLearningMemory({
        userQuestion: data.userQuestion,
        schemaColumns: data.schemaColumns,
        domain: data.domain,
      });
      const similarSchemas = await findSimilarSchemaMemories(data.schemaProfile, 3);
      return { memories, similarSchemas };
    }

    return { error: "Unknown action" };
  }
}
