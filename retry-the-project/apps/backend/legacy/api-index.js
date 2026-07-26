import initSqlJs from "sql.js";
import { randomUUID } from "node:crypto";
import logger from "../src/utils/logger.js";
import { buildEnhancedSchema, classifyColumns, smartAutoChartGeneration, smartAutoChartGenerationForSingle, smartAutoChartGenerationForMerged } from "../src/services/schema-detector.js";
import { aiAnalyzer } from "../src/services/ai-analyzer.js";
import { buildUnifiedSchema, mergeDatasets } from "../src/services/data-merger.js";
import { reportGenerator } from "../src/services/report-generator.js";
import { predictiveAnalytics } from "../src/services/predictive-analytics.js";
import { alertService } from "../src/services/alert-service.js";
import { recommendationEngine } from "../src/services/recommendation-engine.js";
import { llamaValidationMiddleware } from "../src/services/llama-validation-middleware.js";
import { isOllamaConfigured } from "../src/services/ollama-ai-service.js";

let db = null;
let dbReady = null;

const initDB = async () => {
  if (db) return db;
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    
    db.run(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        file_name TEXT,
        uploaded_at TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        column_count INTEGER NOT NULL,
        columns_json TEXT NOT NULL,
        rows_json TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sql_text TEXT,
        chart_json TEXT,
        insights_json TEXT,
        created_at TEXT NOT NULL
      );
    `);
    
    return db;
  })();
  
  return dbReady;
};

const getCurrentDatasetId = () => {
  const result = db.exec("SELECT value FROM meta WHERE key = 'current_dataset_id'");
  return result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : null;
};

const setCurrentDatasetId = (id) => {
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('current_dataset_id', ?)", [id]);
};

const getDatasetById = (id) => {
  const result = db.exec("SELECT * FROM datasets WHERE id = ?", [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  
  const row = result[0].values[0];
  const columns = result[0].columns;
  return {
    id: row[columns.indexOf("id")],
    name: row[columns.indexOf("name")],
    sourceType: row[columns.indexOf("source_type")],
    fileName: row[columns.indexOf("file_name")],
    uploadedAt: row[columns.indexOf("uploaded_at")],
    rowCount: row[columns.indexOf("row_count")],
    columnCount: row[columns.indexOf("column_count")],
    columns: JSON.parse(row[columns.indexOf("columns_json")]),
    rows: JSON.parse(row[columns.indexOf("rows_json")]),
  };
};

const getChatMessages = (datasetId) => {
  const result = db.exec("SELECT * FROM chat_messages WHERE dataset_id = ? ORDER BY created_at ASC", [datasetId]);
  if (result.length === 0) return [];
  
  const rows = result[0].values;
  const cols = result[0].columns;
  return rows.map(row => ({
    id: row[cols.indexOf("id")],
    role: row[cols.indexOf("role")],
    content: row[cols.indexOf("content")],
    sql: row[cols.indexOf("sql_text")] || undefined,
    chart: row[cols.indexOf("chart_json")] ? JSON.parse(row[cols.indexOf("chart_json")]) : undefined,
    insights: row[cols.indexOf("insights_json")] ? JSON.parse(row[cols.indexOf("insights_json")]) : [],
    timestamp: row[cols.indexOf("created_at")],
  }));
};

const normalizeColumns = (rows, columns) => {
  if (columns.length > 0) {
    return columns.map((col) => ({
      name: col.name || col,
      type: col.type || typeof rows[0]?.[col.name || col] || "string",
      sample: rows.slice(0, 5).map((row) => row[col.name || col]).filter((v) => v !== undefined && v !== null),
    }));
  }
  if (rows.length === 0) return [];
  const firstRow = rows[0];
  const columnNames = Object.keys(firstRow);
  return columnNames.map((name) => ({
    name,
    type: typeof firstRow[name],
    sample: rows.slice(0, 5).map((row) => row[name]).filter((v) => v !== undefined && v !== null),
  }));
};

const generateDemoDataset = () => {
  const regions = ["North", "South", "East", "West", "Central"];
  const products = ["Widget A", "Widget B", "Gadget X", "Gadget Y", "Service Z"];
  const channels = ["Online", "Retail", "Wholesale", "Direct"];
  const rows = [];
  for (let i = 0; i < 100; i++) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const baseRevenue = product.includes("Widget") ? 5000 : product.includes("Gadget") ? 8000 : 3000;
    const revenue = Math.round((baseRevenue + Math.random() * 5000) * 100) / 100;
    const units = Math.floor(50 + Math.random() * 450);
    const profitMargin = 0.2 + Math.random() * 0.4;
    rows.push({
      Region: region,
      Product: product,
      Channel: channel,
      Revenue: revenue,
      Units: units,
      ProfitMargin: Math.round(profitMargin * 100) / 100,
      Date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split("T")[0],
    });
  }
  return { name: "Sales Performance Dataset", fileName: null, sourceType: "demo", columns: normalizeColumns(rows, []), rows };
};

const buildDatasetSchema = (dataset) => {
  const numericColumns = dataset.columns.filter((col) => ["number", "integer", "float", "double"].includes(col.type));
  const categoricalColumns = dataset.columns.filter((col) => !numericColumns.includes(col));
  const dateColumns = dataset.columns.filter((col) => col.type === "date" || /date/i.test(col.name));
  return {
    columns: dataset.columns.map((col) => ({
      name: col.name, type: col.type,
      uniqueValues: new Set(dataset.rows.map((row) => String(row[col.name]))).size,
      nullCount: dataset.rows.filter((row) => row[col.name] === null || row[col.name] === undefined).length,
    })),
    numericColumns: numericColumns.map((c) => c.name),
    categoricalColumns: categoricalColumns.map((c) => c.name),
    dateColumns: dateColumns.map((c) => c.name),
    totalRows: dataset.rowCount,
    totalColumns: dataset.columns.length,
  };
};

const computeStats = (values) => {
  const nums = values.filter((v) => typeof v === "number" && !isNaN(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((acc, val) => acc + val, 0);
  const mean = sum / nums.length;
  const median = nums.length % 2 === 0 ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2 : sorted[Math.floor(nums.length / 2)];
  const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nums.length;
  return { mean: Math.round(mean * 100) / 100, median, stdDev: Math.round(Math.sqrt(variance) * 100) / 100, min: sorted[0], max: sorted[sorted.length - 1] };
};

const createChatResponse = (ds, query) => {
  const lowerQuery = query.toLowerCase();
  const schema = buildDatasetSchema(ds);

  if (/average|mean|avg/i.test(lowerQuery)) {
    const numericCols = schema.numericColumns;
    if (numericCols.length > 0) {
      const targetCol = numericCols.find((c) => lowerQuery.includes(c.toLowerCase())) || numericCols[0];
      const stats = computeStats(ds.rows.map((r) => r[targetCol]));
      return { content: `The average ${targetCol} is ${stats?.mean || 0}.`, chart: { type: "bar", data: { labels: ["Average", "Median"], datasets: [{ label: targetCol, data: [stats?.mean || 0, stats?.median || 0] }] } }, insights: [{ metric: `Average ${targetCol}`, value: stats?.mean || 0 }] };
    }
  }
  if (/sum|total/i.test(lowerQuery)) {
    const numericCols = schema.numericColumns;
    if (numericCols.length > 0) {
      const targetCol = numericCols.find((c) => lowerQuery.includes(c.toLowerCase())) || numericCols[0];
      const total = ds.rows.reduce((acc, row) => acc + (Number(row[targetCol]) || 0), 0);
      return { content: `The total ${targetCol} is ${total.toLocaleString()}.`, chart: { type: "bar", data: { labels: ["Total"], datasets: [{ label: targetCol, data: [total] }] } }, insights: [{ metric: `Total ${targetCol}`, value: total }] };
    }
  }
  if (/category|group|breakdown/i.test(lowerQuery)) {
    const catCols = schema.categoricalColumns;
    if (catCols.length > 0) {
      const targetCol = catCols[0];
      const counts = {};
      ds.rows.forEach((row) => { const val = String(row[targetCol]); counts[val] = (counts[val] || 0) + 1; });
      const labels = Object.keys(counts);
      return { content: `Breakdown by ${targetCol}: ${labels.map((l) => `${l} (${counts[l]})`).join(", ")}.`, chart: { type: "doughnut", data: { labels, datasets: [{ label: targetCol, data: Object.values(counts) }] } }, insights: labels.slice(0, 3).map((l) => ({ metric: l, value: counts[l] })) };
    }
  }
  return { content: `Dataset has ${ds.rowCount} rows and ${ds.columns.length} columns.`, chart: null, insights: [] };
};

const generateCorrelationAnalysis = (ds) => {
  const numericCols = ds.columns.filter((c) => ["number", "integer", "float", "double"].includes(c.type));
  const correlations = [];
  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const values1 = ds.rows.map((r) => r[numericCols[i].name]).filter((v) => typeof v === "number");
      const values2 = ds.rows.map((r) => r[numericCols[j].name]).filter((v) => typeof v === "number");
      const minLen = Math.min(values1.length, values2.length);
      if (minLen > 2) {
        const x = values1.slice(0, minLen);
        const y = values2.slice(0, minLen);
        const xMean = x.reduce((a, b) => a + b, 0) / x.length;
        const yMean = y.reduce((a, b) => a + b, 0) / y.length;
        const numerator = x.reduce((acc, xi, i) => acc + (xi - xMean) * (y[i] - yMean), 0);
        const denominator = Math.sqrt(x.reduce((acc, xi) => acc + Math.pow(xi - xMean, 2), 0) * y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0));
        const coefficient = denominator === 0 ? 0 : numerator / denominator;
        let strength = Math.abs(coefficient) > 0.7 ? "strong" : Math.abs(coefficient) > 0.4 ? "moderate" : "weak";
        correlations.push({ column1: numericCols[i].name, column2: numericCols[j].name, coefficient: Math.round(coefficient * 1000) / 1000, strength, interpretation: coefficient > 0.5 ? "Positive correlation" : coefficient < -0.5 ? "Negative correlation" : "Weak correlation", sampleSize: minLen });
      }
    }
  }
  return { correlations: correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)), summary: `Found ${correlations.length} pairs.`, hasGemini: false };
};

const sendJson = (statusCode, payload, headers = {}) => {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 
      "Content-Type": "application/json; charset=utf-8", 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Headers": "Content-Type", 
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      ...headers 
    },
  });
};

const readJsonBody = async (request) => {
  try { const text = await request.text(); return text ? JSON.parse(text) : {}; } catch { return {}; }
};

export async function GET(request) {
  const startTime = Date.now();
  try {
    await initDB();
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname === "/api/health") return sendJson(200, { status: "ok", database: "SQLite" });
    if (pathname === "/api/state") {
      const currentDatasetId = getCurrentDatasetId();
      return sendJson(200, { dataset: currentDatasetId ? getDatasetById(currentDatasetId) : null, chatMessages: currentDatasetId ? getChatMessages(currentDatasetId) : [] });
    }
    const schemaMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema$/);
    if (schemaMatch) { const ds = getDatasetById(schemaMatch[1]); return ds ? sendJson(200, { schema: buildDatasetSchema(ds) }) : sendJson(404, { error: "Not found" }); }
    const aiCorrMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai-correlations$/);
    if (aiCorrMatch) { const ds = getDatasetById(aiCorrMatch[1]); return ds ? sendJson(200, generateCorrelationAnalysis(ds)) : sendJson(404, { error: "Not found" }); }
    return sendJson(404, { error: "Route not found" });
  } catch (error) {
    logger.error("GET request failed", { pathname: new URL(request.url).pathname, error: error.message });
    return sendJson(500, { error: "Internal server error" });
  } finally {
    logger.logRequest("GET", new URL(request.url).pathname, 200, Date.now() - startTime);
  }
}

export async function POST(request) {
  const startTime = Date.now();
  const pathname = new URL(request.url).pathname;
  try {
    await initDB();
    const body = await readJsonBody(request);
    
    if (pathname === "/api/datasets/demo") {
      const demo = generateDemoDataset();
      const id = randomUUID();
      db.run("INSERT INTO datasets VALUES (?,?,?,?,?,?,?,?,?)", [id, demo.name, demo.sourceType, demo.fileName, new Date().toISOString(), demo.rows.length, demo.columns.length, JSON.stringify(demo.columns), JSON.stringify(demo.rows)]);
      setCurrentDatasetId(id);
      
      const dataset = getDatasetById(id);
      console.log('[DEMO] Columns:', demo.columns.length, 'Rows:', demo.rows.length);
      
      let analysisResult = null;
      try {
        console.log('[DEMO] Running AI analysis...');
        analysisResult = await aiAnalyzer.analyzeDataset(demo.columns, demo.rows);
        console.log('[DEMO] AI result:', analysisResult ? 'received' : 'null');
      } catch (error) {
        console.log('[DEMO] AI analysis error:', error.message);
        try {
          const schema = buildEnhancedSchema(demo.columns, demo.rows);
          console.log('[DEMO] Schema result:', schema.dataType);
          analysisResult = {
            schema,
            chartRecommendations: schema.recommendedCharts || [],
            insights: schema.insights || []
          };
        } catch (e) {
          console.log('[DEMO] Schema error:', e.message);
        }
      }
      
      console.log('[DEMO] Final analysisResult:', analysisResult ? 'present' : 'null');
      
      const analysisOutput = analysisResult ? {
        dataType: analysisResult.schema?.dataType || 'SALES',
        dataTypeLabel: analysisResult.schema?.dataTypeLabel || 'Sales Data',
        chartRecommendations: analysisResult.chartRecommendations || [],
        insights: analysisResult.insights || [],
        aiInsights: analysisResult.aiInsights
      } : null;
      
      console.log('[DEMO] Sending response with analysis:', analysisOutput ? 'yes' : 'no');
      
      return sendJson(201, { 
        dataset, 
        chatMessages: [],
        analysis: analysisOutput
      });
    }
    
    if (pathname === "/api/datasets/import") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (rows.length === 0) return sendJson(400, { error: "Dataset must contain at least one row" });
      const columns = normalizeColumns(rows, Array.isArray(body.columns) ? body.columns : []);
      const id = randomUUID();
      db.run("INSERT INTO datasets VALUES (?,?,?,?,?,?,?,?,?)", [id, body.name || "Uploaded Dataset", body.sourceType || "upload", body.fileName || null, new Date().toISOString(), rows.length, columns.length, JSON.stringify(columns), JSON.stringify(rows)]);
      setCurrentDatasetId(id);
      
      const dataset = getDatasetById(id);
      
      logger.info("Running auto-analysis on imported dataset", { datasetId: id, rowCount: rows.length, columnCount: columns.length });
      
      let analysisResult = null;
      try {
        analysisResult = await aiAnalyzer.analyzeDataset(columns, rows);
        logger.info("Auto-analysis completed", { 
          dataType: analysisResult.schema.dataType, 
          chartCount: analysisResult.chartRecommendations?.length || 0,
          insightCount: analysisResult.insights?.length || 0
        });
      } catch (error) {
        logger.warn("Auto-analysis failed, using schema detection only", { error: error.message });
        try {
          const schema = buildEnhancedSchema(columns, rows);
          analysisResult = {
            schema,
            chartRecommendations: schema.recommendedCharts || [],
            insights: schema.insights || [],
            aiInsights: null,
            generatedAt: new Date().toISOString()
          };
        } catch (schemaError) {
          logger.error("Schema detection also failed", { error: schemaError.message });
        }
      }
      
      logger.info("Running automatic chart generation", { rowCount: rows.length });
      
      let autoGeneratedCharts = [];
      try {
        const columnClassification = classifyColumns(rows);
        autoGeneratedCharts = smartAutoChartGenerationForSingle(rows, columnClassification);
        logger.info("Auto-generated charts", { count: autoGeneratedCharts.length, pipeline: 'single-file' });
      } catch (autoError) {
        logger.warn("Auto chart generation failed", { error: autoError.message });
      }
      
      const allCharts = [...(analysisResult?.chartRecommendations || []), ...autoGeneratedCharts];
      const seen = new Set();
      const uniqueCharts = allCharts.filter(chart => {
        if (seen.has(chart.title)) return false;
        seen.add(chart.title);
        return true;
      }).slice(0, 10);
      
      const response = {
        dataset: dataset,
        chatMessages: [],
        pipeline: 'single-file',
        analysis: analysisResult ? {
          dataType: analysisResult.schema?.dataType || 'GENERAL',
          dataTypeLabel: analysisResult.schema?.dataTypeLabel || 'Generic Data',
          chartRecommendations: uniqueCharts,
          insights: analysisResult.insights || [],
          aiInsights: analysisResult.aiInsights
        } : null
      };
      
      return sendJson(201, response);
    }

    if (pathname === "/api/datasets/merge") {
      const datasets = Array.isArray(body.datasets) ? body.datasets : [];
      if (datasets.length === 0) return sendJson(400, { error: "At least one dataset is required for merging" });
      if (datasets.length === 1) {
        const rows = datasets[0].rows || [];
        const columns = normalizeColumns(rows, datasets[0].columns || []);
        const id = randomUUID();
        db.run("INSERT INTO datasets VALUES (?,?,?,?,?,?,?,?,?)", [id, datasets[0].name || "Uploaded Dataset", "upload", datasets[0].fileName || null, new Date().toISOString(), rows.length, columns.length, JSON.stringify(columns), JSON.stringify(rows)]);
        setCurrentDatasetId(id);
        const dataset = getDatasetById(id);
        
        let analysisResult = null;
        try {
          analysisResult = await aiAnalyzer.analyzeDataset(columns, rows);
        } catch (error) {
          logger.warn("Merge analysis failed", { error: error.message });
          try {
            const schema = buildEnhancedSchema(columns, rows);
            analysisResult = { schema, chartRecommendations: schema.recommendedCharts || [], insights: schema.insights || [] };
          } catch (e) {
            logger.warn("Fallback schema build failed", { error: e.message });
          }
        }
        
        return sendJson(201, {
          dataset,
          chatMessages: [],
          analysis: analysisResult ? { dataType: analysisResult.schema?.dataType || 'GENERAL', dataTypeLabel: analysisResult.schema?.dataTypeLabel || 'Merged Data', chartRecommendations: analysisResult.chartRecommendations || [], insights: analysisResult.insights || [] } : null
        });
      }

      logger.info("Merging multiple datasets", { count: datasets.length, names: datasets.map(d => d.name).join(', ') });
      
      const unified = buildUnifiedSchema(datasets);
      if (!unified || !unified.mergedDataset) {
        return sendJson(400, { error: "Failed to merge datasets" });
      }

      const mergedDataset = unified.mergedDataset;
      const mergedColumns = normalizeColumns(mergedDataset.rows, mergedDataset.columns);
      const id = randomUUID();
      
      db.run("INSERT INTO datasets VALUES (?,?,?,?,?,?,?,?,?)", [
        id,
        mergedDataset.name,
        "merged",
        JSON.stringify(datasets.map(d => d.fileName || d.name)),
        new Date().toISOString(),
        mergedDataset.rows.length,
        mergedColumns.length,
        JSON.stringify(mergedColumns),
        JSON.stringify(mergedDataset.rows)
      ]);
      
      setCurrentDatasetId(id);
      const savedDataset = getDatasetById(id);
      
      logger.info("Running AI analysis on merged dataset", { datasetId: id, rowCount: mergedDataset.rows.length, columnCount: mergedColumns.length });
      
      let analysisResult = null;
      try {
        analysisResult = await aiAnalyzer.analyzeDataset(mergedColumns, mergedDataset.rows);
        if (analysisResult && analysisResult.schema) {
          analysisResult.schema.dataTypeLabel = mergedDataset.name;
        }
        logger.info("Merged dataset analysis completed", { dataType: analysisResult?.schema?.dataType, chartCount: analysisResult?.chartRecommendations?.length || 0 });
      } catch (error) {
        logger.warn("AI analysis failed on merged data", { error: error.message });
      }
      
      if (!analysisResult) {
        try {
          const schema = buildEnhancedSchema(mergedColumns, mergedDataset.rows);
          schema.dataTypeLabel = "Merged Dataset";
          analysisResult = {
            schema,
            chartRecommendations: schema.recommendedCharts || [],
            insights: schema.insights || []
          };
          logger.info("Schema-based analysis completed", { dataType: schema.dataType, chartCount: schema.recommendedCharts?.length || 0 });
        } catch (e) {
          logger.error("Schema detection also failed", { error: e.message });
        }
      }

      const finalDataType = analysisResult?.schema?.dataType || unified.detectedDataTypes?.[0]?.type || 'GENERAL';
      const finalDataTypeLabel = analysisResult?.schema?.dataTypeLabel || 'Merged Dataset';
      
      const chartRecommendations = analysisResult?.chartRecommendations || [];
      const insights = analysisResult?.insights || [];
      
      logger.info("Running automatic chart generation for merged dataset", { rowCount: mergedDataset.rows.length, columnCount: mergedColumns.length });
      
      let autoGeneratedCharts = [];
      try {
        const columnClassification = classifyColumns(mergedDataset.rows);
        autoGeneratedCharts = smartAutoChartGenerationForMerged(mergedDataset.rows, columnClassification);
        logger.info("Auto-generated charts", { count: autoGeneratedCharts.length, chartTypes: autoGeneratedCharts.map(c => c.type), pipeline: 'multi-file-merged' });
      } catch (autoError) {
        logger.warn("Auto chart generation failed", { error: autoError.message });
      }
      
const allCharts = [...chartRecommendations, ...autoGeneratedCharts];
      const seen = new Set();
      const uniqueCharts = allCharts.filter(chart => {
        if (seen.has(chart.title)) return false;
        seen.add(chart.title);
        return true;
      }).slice(0, 10);
      
      const mergeSummary = { type: 'summary', title: 'Merge Summary', message: `Combined ${datasets.length} datasets with ${mergedDataset.rows.length} total rows and ${mergedColumns.length} columns` };
      const allInsights = [mergeSummary, ...insights];

      return sendJson(201, {
        dataset: savedDataset,
        chatMessages: [],
        pipeline: 'multi-file-merged',
        analysis: {
          dataType: finalDataType,
          dataTypeLabel: finalDataTypeLabel,
          chartRecommendations: uniqueCharts,
          insights: allInsights,
          aiInsights: analysisResult?.aiInsights || null,
          mergeInfo: {
            originalDatasets: datasets.length,
            totalRows: mergedDataset.rows.length,
            commonColumns: unified.summary.commonColumns,
            uniqueColumns: unified.summary.uniqueColumns,
            detectedDataTypes: unified.detectedDataTypes
          }
        }
      });
    }
    
    const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);
    if (chatMatch) {
      const ds = getDatasetById(chatMatch[1]);
      if (!ds) return sendJson(404, { error: "Dataset not found" });
      const query = String(body.query || "").trim();
      if (!query) return sendJson(400, { error: "Query is required" });
      const analysis = createChatResponse(ds, query);
      const now = new Date().toISOString();
      const userId = randomUUID();
      const assistantId = randomUUID();
      db.run("INSERT INTO chat_messages VALUES (?,?,?,?,?,?,?,?)", [userId, chatMatch[1], "user", query, null, null, null, now]);
      db.run("INSERT INTO chat_messages VALUES (?,?,?,?,?,?,?,?)", [assistantId, chatMatch[1], "assistant", analysis.content, analysis.sql || null, analysis.chart ? JSON.stringify(analysis.chart) : null, JSON.stringify(analysis.insights), now]);
      return sendJson(201, { userMessage: { id: userId, role: "user", content: query, timestamp: now }, assistantMessage: { id: assistantId, role: "assistant", content: analysis.content, chart: analysis.chart, insights: analysis.insights, timestamp: now } });
    }

    if (pathname === "/api/automation/analyze") {
      const rows = body.rows || [];
      const columns = body.columns || [];
      if (rows.length === 0) return sendJson(400, { error: "Dataset required" });
      
      const processed = {
        name: body.name || "Analysis",
        rowCount: rows.length,
        columns: columns.length > 0 ? columns : normalizeColumns(rows, []),
        rows
      };
      
      const recommendations = await recommendationEngine.generateRecommendations(processed);
      const numericCols = columns.filter(c => c.type === "number").map(c => c.name);
      const predictions = numericCols.length > 0 ? await predictiveAnalytics.analyzeMultipleMetrics(rows, numericCols.slice(0, 3)) : {};
      
      return sendJson(200, {
        recommendations,
        predictions,
        alerts: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          rowCount: rows.length,
          columnCount: columns.length
        }
      });
    }

    const llamaQueryMatch = pathname.match(/^\/api\/llama\/query$/);
    if (llamaQueryMatch && pathname === "/api/llama/query") {
      const { query, rows, columns, name } = body;
      
      if (!query?.trim()) {
        return sendJson(400, { success: false, error: 'Query is required' });
      }

      console.log(`\n📝 Llama query request: "${query}"`);

      const dataset = {
        name: name || 'Query Dataset',
        rows: rows || [],
        columns: columns?.length > 0 ? columns : normalizeColumns(rows || [], []),
        rowCount: (rows || []).length,
      };

      if (!dataset.rows || dataset.rows.length === 0) {
        return sendJson(400, { success: false, error: 'Dataset not found or empty' });
      }

      const schema = buildEnhancedSchema(dataset.columns, dataset.rows);
      const ollamaAvailable = await isOllamaConfigured();

      if (!ollamaAvailable) {
        return sendJson(503, {
          success: false,
          error: 'Llama 3.2 not available',
          installation: 'Run: ollama serve && ollama pull llama3.2'
        });
      }

      try {
        const result = await llamaValidationMiddleware.processQuery(
          query,
          dataset,
          schema
        );

        return sendJson(200, result);
      } catch (error) {
        return sendJson(500, { success: false, error: error.message });
      }
    }

    const llamaStatusMatch = pathname.match(/^\/api\/llama\/status$/);
    if (llamaStatusMatch && pathname === "/api/llama/status") {
      const ollamaAvailable = await isOllamaConfigured();
      
      if (!ollamaAvailable) {
        return sendJson(200, {
          ollama_running: false,
          error: 'Ollama not available',
          installation_guide: 'Install from https://ollama.ai then run: ollama pull llama3.2'
        });
      }

      return sendJson(200, {
        ollama_running: true,
        model: 'llama3.2',
        status: 'ready',
        ram_requirement: '16GB recommended',
        cache_size: llamaValidationMiddleware.cache?.size || 0
      });
    }

    const llamaCacheMatch = pathname.match(/^\/api\/llama\/cache$/);
    if (llamaCacheMatch && pathname === "/api/llama/cache") {
      const action = body.action;
      
      if (action === 'clear') {
        llamaValidationMiddleware.clearCache();
        return sendJson(200, { success: true, message: 'Cache cleared' });
      }

      return sendJson(200, {
        cache_size: llamaValidationMiddleware.cache?.size || 0,
        cache_stats: llamaValidationMiddleware.getCacheStats?.() || {}
      });
    }

    if (pathname === "/api/automation/report") {
      const rows = body.rows || [];
      const columns = body.columns || [];
      const format = body.format || "html";
      
      if (rows.length === 0) return sendJson(400, { error: "Dataset required" });
      
      const dataset = {
        name: body.name || "Report",
        rowCount: rows.length,
        columns: columns.length > 0 ? columns : normalizeColumns(rows, []),
        rows,
        insights: body.insights || [],
        charts: body.charts || []
      };
      
      const buffer = await reportGenerator.generateReport(dataset, { format });
      
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": format === "pdf" ? "application/pdf" : format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/html",
          "Content-Disposition": `attachment; filename="report.${format}"`
        }
      });
    }

    if (pathname === "/api/automation/forecast") {
      const rows = body.rows || [];
      const column = body.column;
      const periods = body.periods || 3;
      
      if (!column) return sendJson(400, { error: "Column required" });
      
      const forecast = await predictiveAnalytics.forecastTimeseries(rows, column, periods);
      const trend = await predictiveAnalytics.detectTrends(rows, column);
      
      return sendJson(200, { forecast, trend });
    }

    if (pathname === "/api/automation/alerts") {
      const rows = body.rows || [];
      const column = body.column;
      const threshold = body.threshold || 1.5;
      
      if (!column || rows.length === 0) return sendJson(400, { error: "Column and rows required" });
      
      const anomalies = await alertService.detectAnomalies(rows, column, { threshold });
      
      return sendJson(200, anomalies);
    }

    return sendJson(404, { error: "Route not found" });
  } catch (error) {
    logger.error("POST request failed", { pathname, error: error.message });
    return sendJson(500, { error: "Internal server error" });
  } finally {
    logger.logRequest("POST", pathname, 201, Date.now() - startTime);
  }
}

export async function PATCH(request) {
  const startTime = Date.now();
  const pathname = new URL(request.url).pathname;
  try {
    await initDB();
    const body = await readJsonBody(request);
    const rowMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/rows\/([^/]+)$/);
    if (rowMatch) {
      const ds = getDatasetById(rowMatch[1]);
      if (!ds) return sendJson(404, { error: "Dataset not found" });
      const rowId = Number(rowMatch[2]);
      if (ds.rows[rowId]) {
        ds.rows[rowId] = { ...ds.rows[rowId], [body.column]: body.value };
        db.run("UPDATE datasets SET rows_json = ? WHERE id = ?", [JSON.stringify(ds.rows), rowMatch[1]]);
        return sendJson(200, { dataset: getDatasetById(rowMatch[1]) });
      }
      return sendJson(404, { error: "Row not found" });
    }
    return sendJson(404, { error: "Route not found" });
  } catch (error) {
    logger.error("PATCH request failed", { pathname, error: error.message });
    return sendJson(500, { error: "Internal server error" });
  } finally {
    logger.logRequest("PATCH", pathname, 200, Date.now() - startTime);
  }
}
