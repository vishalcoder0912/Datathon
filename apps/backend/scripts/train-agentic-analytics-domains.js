import { DOMAIN_TRAINING_SEEDS } from "../src/services/ai-analyst/training/domain-training-seeds.js";
import { trainManySchemaExamples } from "../src/services/ai-analyst/schema-training-store.js";

function buildTrainingExample(seed) {
  return {
    dataset: {
      name: `${seed.domain} domain seed`,
      columns: seed.schema.map((name) => ({
        name,
        type:
          name.includes("date") || name.includes("timestamp")
            ? "date"
            : name.includes("salary") ||
                name.includes("sales") ||
                name.includes("revenue") ||
                name.includes("profit") ||
                name.includes("expense") ||
                name.includes("spend") ||
                name.includes("stock") ||
                name.includes("quantity") ||
                name.includes("latitude") ||
                name.includes("longitude")
              ? "number"
              : "category",
      })),
      rows: [], // Seeds don't have rows
    },
    dashboardPlan: {
      kpis: seed.kpis.map((title) => ({
        title,
        priority: "high",
      })),
      charts: seed.charts.map((title) => ({
        title,
        priority: "high",
      })),
    },
    analystThinking: seed.analystThinking,
    rating: "excellent",
    source: "agentic-domain-seed",
  };
}

async function main() {
  const examples = DOMAIN_TRAINING_SEEDS.map(buildTrainingExample);

  await trainManySchemaExamples(examples);

  console.log(`✅ Trained ${examples.length} agentic analytics domain seeds`);
}

main().catch((error) => {
  console.error("❌ Training failed:", error);
  process.exit(1);
});
