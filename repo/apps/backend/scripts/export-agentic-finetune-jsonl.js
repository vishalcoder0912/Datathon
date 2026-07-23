import fs from "fs";
import path from "path";
import { generateSyntheticAgenticExamples } from "../src/services/ai-analyst/training/synthetic-agentic-training-generator.js";

const outputPath = path.resolve("data/agentic-analytics-finetune.jsonl");

function toJsonlMessage(example) {
  return {
    messages: [
      {
        role: "system",
        content:
          "You are InsightFlow, a pure Agentic AI Data Analytics Platform. You analyze schemas, select KPIs, design dashboards, generate insights, validate quality, and recommend actions.",
      },
      {
        role: "user",
        content: `${example.instruction}\n\nInput:\n${JSON.stringify(example.input, null, 2)}`,
      },
      {
        role: "assistant",
        content: JSON.stringify(example.output, null, 2),
      },
    ],
  };
}

function main() {
  const examples = generateSyntheticAgenticExamples();

  const jsonl = examples.map((example) =>
    JSON.stringify(toJsonlMessage(example))
  ).join("\n");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, jsonl, "utf8");

  console.log(`✅ Exported ${examples.length} fine-tuning examples`);
  console.log(`📦 Output: ${outputPath}`);
}

main();
