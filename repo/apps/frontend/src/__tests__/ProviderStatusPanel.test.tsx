import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProviderStatusPanel from "@/features/dashboard/components/ProviderStatusPanel";

describe("ProviderStatusPanel", () => {
  it("renders availability status for Gemini and Ollama", () => {
    const gemini = { available: true };
    const ollama = { available: true, missing_models: [] };

    render(<ProviderStatusPanel gemini={gemini} ollama={ollama} mode="hybrid_best" />);

    expect(screen.getByText("Gemini Cloud")).toBeInTheDocument();
    expect(screen.getByText("Ollama Local")).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(2);
  });

  it("shows warnings when local models are missing", () => {
    const gemini = { available: true };
    const ollama = { available: true, missing_models: ["qwen3:8b", "llama3.2:3b"] };

    render(<ProviderStatusPanel gemini={gemini} ollama={ollama} mode="hybrid" />);

    expect(screen.getByText("Missing local models:")).toBeInTheDocument();
    expect(screen.getByText("qwen3:8b, llama3.2:3b")).toBeInTheDocument();
  });
});
