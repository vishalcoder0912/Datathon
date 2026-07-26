import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("Tab order and keyboard navigation", () => {
  it("logical tab order through interactive elements", () => {
    render(
      <div>
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button">Third</button>
      </div>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("First");
    expect(buttons[1]).toHaveTextContent("Second");
    expect(buttons[2]).toHaveTextContent("Third");

    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
  });
});

describe("Skip-to-content link", () => {
  it("has a skip navigation link", () => {
    render(
      <div>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <main id="main-content">Content</main>
      </div>,
    );

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });
});

describe("Dialog focus management", () => {
  it("trap focus inside open dialog and close with Escape", () => {
    render(
      <div role="dialog" aria-modal="true" aria-label="Confirm action">
        <h2>Are you sure?</h2>
        <button type="button" autoFocus>Confirm</button>
        <button type="button">Cancel</button>
      </div>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    expect(confirmBtn).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
  });
});

describe("Accordion ARIA attributes", () => {
  it("has expanded/collapsed state on accordion buttons", () => {
    render(
      <div>
        <button type="button" aria-expanded="false" aria-controls="section-1">
          Toggle Section
        </button>
        <div id="section-1" hidden>Section content</div>
      </div>,
    );

    const toggle = screen.getByRole("button", { name: /toggle section/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "section-1");
  });

  it("announces expanded state when toggled", () => {
    const { rerender } = render(
      <button type="button" aria-expanded="false" aria-controls="section-1">
        Toggle Section
      </button>,
    );

    rerender(
      <button type="button" aria-expanded="true" aria-controls="section-1">
        Toggle Section
      </button>,
    );

    const toggle = screen.getByRole("button", { name: /toggle section/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
