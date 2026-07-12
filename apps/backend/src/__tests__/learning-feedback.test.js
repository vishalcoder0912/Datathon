import { describe, expect, it } from "vitest";
import { handleLearningFeedbackRoutes } from "../routes/learning-feedback.js";
import { makeReq, makeRes } from "./test-helpers.js";

async function callRoute(pathname, body) {
  const response = makeRes();
  const handled = await handleLearningFeedbackRoutes(makeReq("POST", body), response, pathname);
  return { handled, response, payload: response.json() };
}

describe("self-learning-feedback API and service", () => {
  it("saves a correction and retrieves it successfully", async () => {
    const correctionData = {
      domain: "workforce_salary",
      userQuestion: "What education correlates with highest salary?",
      wrongAnswer: "Old wrong guess",
      correctAnswer: "PhD average salary is the highest.",
      schemaColumns: ["education", "salary_usd"],
      rule: "Group by education and average salary_usd."
    };

    // 1. Save correction
    const { handled: saveHandled, payload: savePayload } = await callRoute(
      "/api/learning-feedback/save-correction",
      correctionData
    );

    expect(saveHandled).toBe(true);
    expect(savePayload.success).toBe(true);
    expect(savePayload.data.correction.domain).toBe("workforce_salary");
    expect(savePayload.data.correction.rule).toBe("Group by education and average salary_usd.");

    // 2. Retrieve correction with matching columns, domain, and keywords
    const { handled: retrieveHandled, payload: retrievePayload } = await callRoute(
      "/api/learning-feedback/retrieve",
      {
        userQuestion: "highest salary by education level?",
        schemaColumns: ["education", "salary_usd", "experience"],
        domain: "workforce_salary"
      }
    );

    expect(retrieveHandled).toBe(true);
    expect(retrievePayload.success).toBe(true);
    expect(retrievePayload.data.memories.length).toBeGreaterThanOrEqual(1);

    const match = retrievePayload.data.memories.find(
      (item) => item.rule === "Group by education and average salary_usd."
    );
    expect(match).toBeDefined();
    expect(match.correctAnswer).toBe("PhD average salary is the highest.");
  });

  it("does not retrieve corrections when columns do not match", async () => {
    const { handled, payload } = await callRoute(
      "/api/learning-feedback/retrieve",
      {
        userQuestion: "highest salary by education level?",
        schemaColumns: ["country", "languages"],
        domain: "workforce_salary"
      }
    );

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    const match = payload.data.memories.find(
      (item) => item.rule === "Group by education and average salary_usd."
    );
    expect(match).toBeUndefined();
  });
});
