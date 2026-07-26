import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

console.log(`✅ API Key found: ${apiKey.slice(0, 10)}...`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-flash-latest",
  generationConfig: {
    maxOutputTokens: 100,
  },
});

try {
  console.log("[test] Calling Gemini API...");
  const response = await model.generateContent("What is 2+2?");
  console.log("[test] ✅ Response received:");
  console.log(response.response.text());
} catch (error) {
  console.error("[test] ❌ Error:", error.message);
  process.exit(1);
}
