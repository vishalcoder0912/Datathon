import { trainDeepAgenticAnalytics } from "../src/services/ai-analyst/training/deep-agentic-trainer.js";

async function main() {
  console.log("🚀 Starting deep agentic analytics training...");

  const result = await trainDeepAgenticAnalytics();

  console.log("✅ Deep training complete");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("❌ Deep training failed:", error);
  process.exit(1);
});
