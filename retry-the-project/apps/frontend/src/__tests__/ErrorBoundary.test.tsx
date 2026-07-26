import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";

function ProblematicComponent() {
  throw new Error("UI crashed intentionally");
}

describe("ErrorBoundary Component", () => {
  it("catches rendering errors and renders fallback UI", () => {
    // Suppress console.error in tests for this block
    const originalError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("UI crashed intentionally")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    console.error = originalError;
  });
});
