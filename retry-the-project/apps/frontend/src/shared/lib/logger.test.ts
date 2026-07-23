import { describe, it, expect, vi, beforeEach } from "vitest";
import logger from "./logger";

describe("Logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should be a singleton", () => {
    const instance1 = logger;
    const instance2 = logger;
    expect(instance1).toBe(instance2);
  });

  it("should have error, warn, info, debug methods", () => {
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should log in correct format", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("test message", { key: "value" });
    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.message).toBe("test message");
    expect(parsed.context.key).toBe("value");
    expect(parsed.level).toBe("info");
  });

  it("should log errors correctly", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test error");
    logger.error("error occurred", { id: 1 }, error);
    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("error occurred");
    expect(parsed.error.message).toBe("test error");
  });
});