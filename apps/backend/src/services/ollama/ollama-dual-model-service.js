import { serviceUrls } from "../../config/serviceUrls.js";
import { getModelForTask } from "../../config/model-router.js";
import { assertNoRawRowsInString } from "../ai/llm-payload-sanitizer.js";

const OLLAMA_BASE_URL = serviceUrls.ollama;

export const OLLAMA_MODELS = {
  dashboard: getModelForTask('dashboard_planner'),
  chat: getModelForTask('chatbot'),
};

const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);

function makeTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function extractJson(text = '') {
  const raw = String(text || '').trim();

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Ollama response did not contain valid JSON.');
    }

    return JSON.parse(match[0]);
  }
}

export async function getOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    if (!response.ok) {
      return {
        running: false,
        baseUrl: OLLAMA_BASE_URL,
        models: [],
        dashboardModel: OLLAMA_MODELS.dashboard,
        chatModel: OLLAMA_MODELS.chat,
      };
    }

    const payload = await response.json();

    return {
      running: true,
      baseUrl: OLLAMA_BASE_URL,
      models: (payload.models || []).map((model) => model.name),
      dashboardModel: OLLAMA_MODELS.dashboard,
      chatModel: OLLAMA_MODELS.chat,
    };
  } catch {
    return {
      running: false,
      baseUrl: OLLAMA_BASE_URL,
      models: [],
      dashboardModel: OLLAMA_MODELS.dashboard,
      chatModel: OLLAMA_MODELS.chat,
    };
  }
}

export async function assertOllamaModelAvailable(model) {
  const status = await getOllamaStatus();

  if (!status.running) {
    throw new Error('Ollama is not running. Run: ollama serve');
  }

  const exists = status.models.some(
    (name) => name === model || name.startsWith(`${model}:`),
  );

  if (!exists) {
    throw new Error(`Model "${model}" is not installed. Run: ollama pull ${model}`);
  }

  return true;
}

export async function callOllamaChat({
  model,
  messages,
  json = false,
  temperature = 0.1,
  topP = 0.9,
  numCtx = 8192,
}) {
  try {
    assertNoRawRowsInString(JSON.stringify(messages));
  } catch (error) {
    console.error(`[OLLAMA DUAL MODEL BLOCKED] ${error.message}`);
    throw new Error(`Blocked unsafe LLM payload: ${error.message}`);
  }

  await assertOllamaModelAvailable(model);

  const timeout = makeTimeout();

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: json ? 'json' : undefined,
        options: {
          temperature,
          top_p: topP,
          num_ctx: numCtx,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama ${model} failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const content = payload.message?.content || '';

    return {
      provider: 'ollama',
      model,
      content,
      json: json ? extractJson(content) : null,
      raw: payload,
    };
  } finally {
    timeout.clear();
  }
}

export function callDashboardPlanner(messages) {
  return callOllamaChat({
    model: OLLAMA_MODELS.dashboard,
    messages,
    json: true,
    temperature: 0,
    numCtx: 8192,
  });
}

export function callDatasetChat(messages) {
  return callOllamaChat({
    model: OLLAMA_MODELS.chat,
    messages,
    json: false,
    temperature: 0.2,
    numCtx: 8192,
  });
}
