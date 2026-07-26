import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError, api } from "./dataApi";

describe("API Client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ApiError", () => {
    it("should create ApiError with correct properties", () => {
      const error = new ApiError("Test error", 500, "INTERNAL_ERROR");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.name).toBe("ApiError");
    });
  });

  describe("api.getState", () => {
    it("should return state on success", async () => {
      const mockState = { dataset: null, chatMessages: [] };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockState),
        status: 200,
      } as Response);

      const result = await api.getState();
      expect(result).toEqual(mockState);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("/api/state");
    });

    it("should throw ApiError on error response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      } as Response);

      await expect(api.getState()).rejects.toThrow(ApiError);
    });
  });

  describe("api.importDataset", () => {
    it("should import dataset successfully", async () => {
      const mockState = { dataset: { id: "1" }, chatMessages: [] };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockState),
        status: 201,
      } as Response);

      const result = await api.importDataset({
        name: "Test Dataset",
        columns: [],
        rows: [{ col1: "value" }],
      });
      expect(result).toEqual(mockState);
    });
  });

  describe("api.sendChatQuery", () => {
    it("should send chat query successfully", async () => {
      const mockResponse = {
        userMessage: { id: "1", role: "user", content: "test", timestamp: "2024-01-01" },
        assistantMessage: { id: "2", role: "assistant", content: "response", timestamp: "2024-01-01" },
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        status: 201,
      } as Response);

      const result = await api.sendChatQuery("dataset-1", "test query");
      expect(result).toEqual(mockResponse);
    });
  });
});