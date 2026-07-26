import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

function ClickCounter({ onAsync }: { onAsync?: () => Promise<void> }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p data-testid="count">{count}</p>
      <button
        type="button"
        onClick={async () => {
          if (onAsync) await onAsync();
          setCount((c) => c + 1);
        }}
      >
        Click me
      </button>
    </div>
  );
}

describe("Extreme click interactions", () => {
  it("fires once on double click", () => {
    render(<ClickCounter />);
    const btn = screen.getByRole("button", { name: /click me/i });

    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("fires once on triple click", () => {
    render(<ClickCounter />);
    const btn = screen.getByRole("button", { name: /click me/i });

    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("handles 100 rapid clicks", () => {
    render(<ClickCounter />);
    const btn = screen.getByRole("button", { name: /click me/i });

    for (let i = 0; i < 100; i++) {
      fireEvent.click(btn);
    }

    expect(screen.getByTestId("count").textContent).toBe("100");
  });
});

describe("Click during loading state", () => {
  it("does not increment while async operation is pending", async () => {
    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    render(<ClickCounter onAsync={() => promise} />);
    const btn = screen.getByRole("button", { name: /click me/i });

    fireEvent.click(btn);
    expect(screen.getByTestId("count").textContent).toBe("0");

    resolvePromise!();
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });
});

describe("Form submission during submission", () => {
  it("prevents double form submission", async () => {
    const submitHandler = vi.fn();

    function DoubleSubmitForm() {
      const [submitting, setSubmitting] = useState(false);
      return (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            submitHandler();
            await new Promise((r) => setTimeout(r, 100));
            setSubmitting(false);
          }}
        >
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </form>
      );
    }

    render(<DoubleSubmitForm />);
    const btn = screen.getByRole("button", { name: /save/i });

    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(submitHandler).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Rapid keyboard input", () => {
  it("handles 100 rapid key presses in input", () => {
    render(
      <div>
        <label htmlFor="input">Name</label>
        <input id="input" />
      </div>,
    );

    const input = screen.getByLabelText("Name");
    for (let i = 0; i < 100; i++) {
      fireEvent.change(input, { target: { value: String(i) } });
    }

    expect(input).toHaveValue("99");
  });
});

describe("Tab through all elements rapidly", () => {
  it("focus cycles through all focusable elements", () => {
    render(
      <div>
        <button type="button" autoFocus>First</button>
        <button type="button">Second</button>
        <button type="button">Third</button>
        <a href="/">Link</a>
      </div>,
    );

    const first = screen.getByText("First");
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Tab" });
  });
});
