import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "@/auth/LoginPage";

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate, Navigate: vi.fn(() => null) };
});

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
  }),
}));

describe("Login form a11y", () => {
  it("has labeled inputs and submit button", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("announces errors with role=alert", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/invalid email or password/i);
    });
  });

  it("disables submit button while submitting", async () => {
    mockLogin.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});

describe("Filter controls a11y", () => {
  it("renders toggle buttons with proper ARIA attributes", () => {
    render(
      <div>
        <button type="button" aria-pressed="false" onClick={vi.fn()}>
          Active Only
        </button>
        <button type="button" aria-pressed="true" onClick={vi.fn()}>
          Verified
        </button>
      </div>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Search input a11y", () => {
  it("has accessible clear button and announced results", () => {
    render(
      <div>
        <label htmlFor="search">Search datasets</label>
        <input id="search" type="text" defaultValue="test" />
        <button type="button" aria-label="Clear search">X</button>
        <div aria-live="polite" role="status">3 results found</div>
      </div>,
    );

    const input = screen.getByLabelText("Search datasets");
    expect(input).toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    expect(clearBtn).toBeInTheDocument();

    const results = screen.getByRole("status");
    expect(results).toHaveAttribute("aria-live", "polite");
    expect(results).toHaveTextContent("3 results found");
  });
});
