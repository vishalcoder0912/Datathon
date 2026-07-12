/**
 * Ollama Manager Routes
 * Exposes: /api/ollama-manager/*
 */

import {
  generateDashboardFromSchema,
  handleDashboardCommand,
  generalChat,
  getOllamaManagerStatus,
} from "../services/ollama/ollama-manager-service.js";
import { fastDashboardChat } from "../services/ollama/fast-dashboard-chat-service.js";

import {
  storeSchemaMemory,
  findSimilarSchemaMemories,
  storeFeedback,
  getDomainStats,
} from "../services/ollama/schema-rag-memory-service.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

export async function handleOllamaManagerRoutes(request, response, pathname) {
  const method = request.method;

  // GET /api/ollama-manager/status
  if (method === "GET" && pathname === "/api/ollama-manager/status") {
    const status = await getOllamaManagerStatus();
    sendJson(response, 200, { ok: true, status });
    return true;
  }

  // POST /api/ollama-manager/generate-dashboard
  if (method === "POST" && pathname === "/api/ollama-manager/generate-dashboard") {
    try {
      const body = await parseBody(request);
      const { schemaProfile } = body;

      if (!schemaProfile) {
        sendJson(response, 400, { ok: false, error: "schemaProfile is required" });
        return true;
      }

      const dashboard = await generateDashboardFromSchema(schemaProfile);

      // Store in RAG memory
      const memoryEntry = await storeSchemaMemory({
        schemaProfile,
        dashboardPlan: dashboard,
        domain: dashboard.domain,
      });

      sendJson(response, 200, {
        ok: true,
        model: process.env.OLLAMA_MANAGER_MODEL || "qwen3:8b",
        dashboard,
        memoryId: memoryEntry.id,
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  // POST /api/ollama-manager/dashboard-command
  if (method === "POST" && pathname === "/api/ollama-manager/dashboard-command") {
    try {
      const body = await parseBody(request);
      const { message, schemaProfile, currentDashboard } = body;

      if (!message) {
        sendJson(response, 400, { ok: false, error: "message is required" });
        return true;
      }

      const result = await handleDashboardCommand({
        message,
        schemaProfile,
        currentDashboard,
      });

      sendJson(response, 200, {
        ok: true,
        model: process.env.OLLAMA_DASHBOARD_MODEL || "qwen3:8b",
        result,
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  // POST /api/ollama-manager/fast-chat
  if (method === "POST" && pathname === "/api/ollama-manager/fast-chat") {
    try {
      const body = await parseBody(request);

      if (!body.message) {
        sendJson(response, 400, { ok: false, error: "message is required" });
        return true;
      }

      const result = await fastDashboardChat({
        message: body.message,
        schemaProfile: body.schemaProfile,
        currentDashboard: body.currentDashboard,
      });

      sendJson(response, 200, {
        ok: true,
        result,
      });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error.message,
      });
    }

    return true;
  }

  // POST /api/ollama-manager/chat
  if (method === "POST" && pathname === "/api/ollama-manager/chat") {
    try {
      const body = await parseBody(request);
      const { message, schemaProfile } = body;

      if (!message) {
        sendJson(response, 400, { ok: false, error: "message is required" });
        return true;
      }

      const answer = await generalChat({ message, schemaProfile });

      sendJson(response, 200, {
        ok: true,
        model: process.env.OLLAMA_CHAT_MODEL || "qwen3:4b",
        answer,
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  // POST /api/ollama-manager/remember-schema
  if (method === "POST" && pathname === "/api/ollama-manager/remember-schema") {
    try {
      const body = await parseBody(request);
      const { schemaProfile, dashboardPlan, domain, feedback } = body;

      const entry = await storeSchemaMemory({
        schemaProfile,
        dashboardPlan,
        domain,
        feedback,
      });

      sendJson(response, 200, {
        ok: true,
        memoryId: entry.id,
        message: "Schema memory stored successfully",
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  // POST /api/ollama-manager/find-similar
  if (method === "POST" && pathname === "/api/ollama-manager/find-similar") {
    try {
      const body = await parseBody(request);
      const { schemaProfile, topK } = body;

      const similar = await findSimilarSchemaMemories(schemaProfile, topK || 3);

      sendJson(response, 200, {
        ok: true,
        count: similar.length,
        memories: similar.map((m) => ({
          id: m.id,
          domain: m.domain,
          similarity: m.similarity,
          schema: m.schemaProfile,
          plan: m.dashboardPlan,
          feedback: m.feedback,
        })),
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  // POST /api/ollama-manager/feedback
  if (method === "POST" && pathname === "/api/ollama-manager/feedback") {
    try {
      const body = await parseBody(request);
      const { memoryId, feedbackType, details } = body;

      const entry = await storeFeedback({ memoryId, feedbackType, details });

      sendJson(response, 200, {
        ok: true,
        entry: entry ? { id: entry.id, feedback: entry.feedback } : null,
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
    return true;
  }

  // GET /api/ollama-manager/domain-stats
  if (method === "GET" && pathname === "/api/ollama-manager/domain-stats") {
    const stats = getDomainStats();
    sendJson(response, 200, { ok: true, stats });
    return true;
  }

  return false;
}
