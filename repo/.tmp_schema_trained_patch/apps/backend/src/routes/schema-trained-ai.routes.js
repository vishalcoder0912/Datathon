import { generateSchemaDashboard, runDashboardCommand, runSchemaChat, trainSchemaDashboard } from "../services/ai-analyst/schema-trained-ai-service.js";
import { getMemoryStats, readSchemaTrainingMemory, trainManySchemaExamples } from "../services/ai-analyst/schema-training-store.js";

async function readJsonBody(request) {
  try {
    if (request.body && typeof request.body === "object" && !request.readable) return request.body;
    let raw = "";
    for await (const chunk of request) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function ok(response, data, message = "OK") {
  sendJson(response, 200, { success: true, data, message });
}

function fail(response, statusCode, message, details) {
  sendJson(response, statusCode, { success: false, error: { message, details } });
}

async function tryCall(fn) {
  try { return await fn(); } catch { return null; }
}

async function loadDatasetById(datasetId, body = {}) {
  if (body.dataset?.rows) return body.dataset;
  if (Array.isArray(body.rows)) return { id: datasetId, name: body.name || datasetId, columns: body.columns || [], rows: body.rows, dictionaryRows: body.dictionaryRows || [] };

  const repo = await tryCall(() => import("../database/dataset-repository.js"));
  const localDb = await tryCall(() => import("../services/local-database-service.js"));

  const candidates = [
    repo?.getDatasetById,
    repo?.getDataset,
    repo?.datasetRepository?.getById,
    repo?.default?.getDatasetById,
    repo?.default?.getById,
    localDb?.getDatasetById,
    localDb?.getDataset,
    localDb?.default?.getDatasetById,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const dataset = await tryCall(() => candidate(datasetId));
    if (dataset?.rows) return dataset;
    if (dataset?.data?.rows) return dataset.data;
  }

  return null;
}

export async function handleSchemaTrainedAIRoutes(request, response, pathname) {
  const method = request.method;

  if (method === "GET" && pathname === "/api/ai/schema-training-memory") {
    ok(response, { stats: getMemoryStats(), memory: readSchemaTrainingMemory() }, "Schema training memory loaded");
    return true;
  }

  if (method === "POST" && pathname === "/api/ai/schema-training/train-memory") {
    try {
      const body = await readJsonBody(request);
      const datasets = Array.isArray(body.datasets) ? body.datasets : [];
      if (!datasets.length) return fail(response, 400, "datasets[] is required");
      const trained = trainManySchemaExamples(datasets.map((dataset) => ({ dataset, dashboardPlan: dataset.dashboardPlan, rating: dataset.rating || "good", source: "bulk-api" })));
      ok(response, { trained, stats: getMemoryStats() }, "Schema memory trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Training failed");
      return true;
    }
  }

  const dashboardMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-dashboard$/);
  if (method === "POST" && dashboardMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(dashboardMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found. Pass {rows, columns} in body or check dataset repository integration.");
      const result = await generateSchemaDashboard(dataset, { useLlm: body.useLlm !== false, threshold: body.threshold });
      ok(response, result, "Schema-trained dashboard generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Dashboard generation failed");
      return true;
    }
  }

  const trainMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-train$/);
  if (method === "POST" && trainMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(trainMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found");
      const entry = trainSchemaDashboard(dataset, {
        dashboardPlan: body.dashboardPlan || body.acceptedDashboard,
        rating: body.rating || "good",
        notes: body.notes || "",
        source: "user-feedback",
      });
      ok(response, { entry, stats: getMemoryStats() }, "Schema pattern trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Schema training failed");
      return true;
    }
  }

  const commandMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/dashboard-command$/);
  if (method === "POST" && commandMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(commandMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found");
      const query = String(body.query || "").trim();
      if (!query) return fail(response, 400, "query is required");
      const result = await runDashboardCommand({ dataset, query, currentDashboard: body.currentDashboard || {}, useLlm: body.useLlm !== false });
      ok(response, result, "Dashboard command processed");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Dashboard command failed");
      return true;
    }
  }

  const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-chat$/);
  if (method === "POST" && chatMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(chatMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found");
      const query = String(body.query || body.message || "").trim();
      if (!query) return fail(response, 400, "query is required");
      const result = await runSchemaChat({ dataset, query, useLlm: body.useLlm !== false });
      ok(response, {
        userMessage: { role: "user", content: query, timestamp: new Date().toISOString() },
        assistantMessage: { role: "assistant", content: result.answer, model: result.model, provider: result.provider, schemaOnly: true, timestamp: new Date().toISOString() },
      }, "AI chat response generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "AI chat failed");
      return true;
    }
  }

  return false;
}

export default { handleSchemaTrainedAIRoutes };
