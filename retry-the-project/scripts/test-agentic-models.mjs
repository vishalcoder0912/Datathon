const host = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const expected = [
  'strict-schema-analyst:latest',
  'insightflow-dashboard-guardian:latest',
  'minimax-m2.7:cloud',
  'insightflow-strict-schema-analyst:latest',
  'insightflow-master:latest',
  'nomic-embed-text:latest',
  'qwen2.5-coder:7b',
  'qwen3:8b',
  'neural-chat:7b',
  'llama3.2:latest',
];

async function main() {
  const res = await fetch(`${host}/api/tags`);
  if (!res.ok) throw new Error(`Cannot connect to Ollama at ${host}: ${res.status}`);
  const data = await res.json();
  const installed = new Set((data.models || []).map((m) => m.name));

  console.log('\nInsightFlow Agentic Model Check\n');
  for (const model of expected) {
    console.log(`${installed.has(model) ? '✅' : '❌'} ${model}`);
  }

  const missing = expected.filter((m) => !installed.has(m));
  if (missing.length) {
    console.log('\nMissing models:', missing.join(', '));
    process.exitCode = 1;
  } else {
    console.log('\nAll configured models are available.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
