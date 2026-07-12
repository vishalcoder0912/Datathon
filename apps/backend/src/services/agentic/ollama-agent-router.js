import { AGENTIC_RUNTIME, OLLAMA_HOST, getModelForTask } from '../../config/agentic-models.js';

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timeout) };
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch {
    return null;
  }
}

async function postOllama(path, body) {
  const timer = withTimeout(AGENTIC_RUNTIME.timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_HOST}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: timer.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Ollama ${path} failed: ${res.status} ${errorText}`);
    }

    return await res.json();
  } finally {
    timer.done();
  }
}

export async function generateWithAgent(task, prompt, options = {}) {
  const model = options.model || getModelForTask(task);
  const payload = {
    model,
    prompt,
    stream: false,
    format: options.json ? 'json' : undefined,
    options: {
      temperature: options.temperature ?? AGENTIC_RUNTIME.temperature,
      num_ctx: options.numCtx ?? AGENTIC_RUNTIME.numCtx,
      num_predict: options.numPredict ?? AGENTIC_RUNTIME.numPredict,
    },
    keep_alive: options.keepAlive ?? AGENTIC_RUNTIME.keepAlive,
  };

  const result = await postOllama('/api/generate', payload);
  const text = result.response || '';

  return {
    task,
    model,
    text,
    json: options.json ? extractJson(text) : null,
    raw: result,
  };
}

export async function chatWithAgent(task, messages, options = {}) {
  const model = options.model || getModelForTask(task);
  const payload = {
    model,
    messages,
    stream: false,
    format: options.json ? 'json' : undefined,
    options: {
      temperature: options.temperature ?? AGENTIC_RUNTIME.temperature,
      num_ctx: options.numCtx ?? AGENTIC_RUNTIME.numCtx,
      num_predict: options.numPredict ?? AGENTIC_RUNTIME.numPredict,
    },
    keep_alive: options.keepAlive ?? AGENTIC_RUNTIME.keepAlive,
  };

  const result = await postOllama('/api/chat', payload);
  const text = result.message?.content || '';

  return {
    task,
    model,
    text,
    json: options.json ? extractJson(text) : null,
    raw: result,
  };
}

export async function embedWithAgent(input, options = {}) {
  const model = options.model || getModelForTask('embed');
  const result = await postOllama('/api/embeddings', {
    model,
    prompt: Array.isArray(input) ? input.join('\n') : String(input || ''),
  });

  return {
    model,
    embedding: result.embedding || [],
    raw: result,
  };
}

export async function pingOllamaModels(models) {
  const timer = withTimeout(30000);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: timer.signal });
    if (!res.ok) throw new Error(`Ollama tags failed: ${res.status}`);
    const data = await res.json();
    const installed = new Set((data.models || []).map((m) => m.name));
    return models.map((model) => ({
      model,
      installed: installed.has(model),
    }));
  } finally {
    timer.done();
  }
}
