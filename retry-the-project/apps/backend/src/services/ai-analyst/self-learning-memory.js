import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..", "..");
const MEMORY_PATH = path.resolve(BACKEND_ROOT, "data", "self-learning-memory.json");

function readMemory() {
  try {
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    if (!fs.existsSync(MEMORY_PATH)) {
      fs.writeFileSync(MEMORY_PATH, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(MEMORY_PATH, "utf8");
    return JSON.parse(raw) || [];
  } catch (error) {
    console.error("[SELF-LEARNING-MEMORY] Error reading memory:", error);
    return [];
  }
}

function writeMemory(memory) {
  try {
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
  } catch (error) {
    console.error("[SELF-LEARNING-MEMORY] Error writing memory:", error);
  }
}

export function saveLearningCorrection(data = {}) {
  const memory = readMemory();

  const correction = {
    id: data.id || `learn-${Date.now()}`,
    type: data.type || "correction",
    domain: data.domain,
    userQuestion: data.userQuestion || `Feedback for ${data.domain || 'dataset'}`,
    wrongAnswer: data.wrongAnswer || "",
    correctAnswer: data.correctAnswer || "",
    schemaColumns: data.schemaColumns || (data.schemaSignature ? data.schemaSignature.split("|") : []),
    rule: data.rule || data.learningRule || "",
    
    // Add additional feedback training fields if present
    schemaSignature: data.schemaSignature,
    userAction: data.userAction,
    successfulKPIs: data.successfulKPIs,
    successfulCharts: data.successfulCharts,
    rejectedCharts: data.rejectedCharts,
    learningRule: data.learningRule,
    
    successCount: 0,
    createdAt: new Date().toISOString(),
  };

  memory.push(correction);
  writeMemory(memory);

  return correction;
}

export function retrieveLearningMemory({ userQuestion, schemaColumns = [], domain }) {
  const memory = readMemory();

  const q = String(userQuestion || "").toLowerCase();

  return memory
    .filter((item) => {
      // 1. Domain match
      const sameDomain = !domain || !item.domain || item.domain === domain;

      // 2. Schema match (either columns overlap, or same schema signature)
      const hasSignatureOverlap = item.schemaSignature && schemaColumns.length > 0 && 
                                  item.schemaSignature.split("|").some(col => schemaColumns.includes(col));
      
      const hasColumnOverlap = item.schemaColumns?.some((col) =>
        schemaColumns.includes(col)
      );

      const schemaMatch = !item.schemaColumns || item.schemaColumns.length === 0 || hasColumnOverlap || hasSignatureOverlap;

      // 3. Question match (keywords or explicit domain matches)
      const domainMatch = item.domain && domain && item.domain.toLowerCase() === domain.toLowerCase();
      const questionMatch =
        domainMatch ||
        q.includes("salary") ||
        q.includes("education") ||
        q.includes("skill") ||
        q.includes("country") ||
        q.includes("experience") ||
        q.includes("sales") ||
        q.includes("revenue") ||
        q.includes("profit") ||
        q.includes("amount") ||
        q.includes("order") ||
        q.includes("quantity") ||
        (item.userQuestion && q.includes(item.userQuestion.toLowerCase()));

      return sameDomain && (questionMatch || domainMatch) && schemaMatch;
    })
    .slice(-5);
}
