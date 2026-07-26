import { describe, expect, it } from "vitest";
import { sendError, sendValidationError } from "../utils/response-utils.js";
import { makeRes } from "./test-helpers.js";

describe("Stable Error Shape", () => {
  it("sendError formats errors in the standard error shape", () => {
    const res = makeRes();
    sendError(res, 500, "Database crashed", "DATABASE_ERROR");

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("DATABASE_ERROR");
    expect(body.error.message).toBe("Database crashed");
  });

  it("sendValidationError formats details correctly in standard shape", () => {
    const res = makeRes();
    const details = { email: "Email is malformed" };
    sendValidationError(res, details);

    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toEqual(details);
  });
});
