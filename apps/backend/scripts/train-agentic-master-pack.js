import { trainAgenticMasterPack } from "../src/services/ai-analyst/training/agentic-master-trainer.js";

async function main() {
  console.log("🚀 Training Agentic Master Analytics Pack...");
  const result = await trainAgenticMasterPack();
  console.log(JSON.stringify(result, null, 2));
  console.log("✅ Agentic Master Training Completed");
}

main().catch((error) => {
  console.error("❌ Training failed:", error);
  process.exit(1);
});
