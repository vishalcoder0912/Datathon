import { trainGenAiAgenticDomainPack } from "../src/services/ai-analyst/training/genai-agentic-domain-trainer.js";

async function main() {
  console.log("🚀 Training GenAI Agentic Analytics Domains...");
  const result = await trainGenAiAgenticDomainPack();
  console.log(JSON.stringify(result, null, 2));
  console.log("✅ GenAI Agentic Domain Training Complete");
}

main().catch((error) => {
  console.error("❌ Training failed:", error);
  process.exit(1);
});
