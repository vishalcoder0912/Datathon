import { saveLearningCorrection } from "./apps/backend/src/services/ai-analyst/self-learning-memory.js";

const correction = {
  domain: "workforce_salary",
  userQuestion: "What education correlates with highest salary?",
  wrongAnswer: "Fallback generic answer",
  correctAnswer: "PhD has the highest average salary, followed by Masters. Group by education and calculate average salary_usd.",
  schemaColumns: [
    "experience",
    "country",
    "education",
    "languages",
    "frameworks",
    "company_size",
    "salary_usd"
  ],
  rule: "When user asks education vs salary, group rows by education and calculate avg salary_usd. Do not fallback."
};

try {
  const result = saveLearningCorrection(correction);
  console.log("SUCCESS! Seeded learning correction:", result);
} catch (error) {
  console.error("FAILED to seed learning correction:", error);
}
