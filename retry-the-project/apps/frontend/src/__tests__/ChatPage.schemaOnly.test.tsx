import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ChatPage from "@/features/chat/pages/ChatPage";
import { useData } from "@/features/data/context/useData";

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock useData
vi.mock("@/features/data/context/useData", () => ({
  useData: vi.fn(),
}));

const mockSalaryDataset = {
  id: "test-salary",
  name: "Salary Specs",
  columns: [
    { name: "country", type: "string", sample: ["USA"] },
    { name: "salary_usd", type: "number", sample: ["90000"] },
    { name: "experience", type: "number", sample: ["5"] },
  ],
  rows: [
    { country: "USA", salary_usd: 90000, experience: 5 },
    { country: "India", salary_usd: 50000, experience: 2 },
  ],
  rowCount: 2,
};

describe("ChatPage Schema-Only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders empty state correctly when no dataset is loaded", async () => {
    vi.mocked(useData).mockReturnValue({
      dataset: null,
      isHydrating: false,
      apiError: null,
      retryHydrate: vi.fn(),
    } as any);

    render(<ChatPage />);

    expect(screen.getByRole("heading", { name: /AI Data Copilot/i })).toBeInTheDocument();
    expect(screen.getByText(/No dataset loaded/i)).toBeInTheDocument();

    const input = screen.getByLabelText(/Ask InsightFlow Copilot a question or command/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Show average salary_usd" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/No dataset is currently loaded\. Please upload a dataset first\./i)).toBeInTheDocument();
    });
  });

  it("renders active dataset context and can interact with backend AI chat", async () => {
    vi.mocked(useData).mockReturnValue({
      dataset: mockSalaryDataset,
      isHydrating: false,
      apiError: null,
      retryHydrate: vi.fn(),
    } as any);

    // Mock fetch based on requested endpoint URL
    vi.mocked(window.fetch).mockImplementation((url: string) => {
      if (url.includes("/chat/history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { messages: [] } }),
        } as any);
      }
      if (url.includes("/chat")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                userMessage: { id: "u-1", role: "user", content: "Show average salary_usd by country", timestamp: new Date().toISOString() },
                assistantMessage: { id: "a-1", role: "assistant", content: "The average salary is computed safely.\n\nSchema-only mode: raw rows were not sent to AI.", timestamp: new Date().toISOString() },
              },
            }),
        } as any);
      }
      return Promise.reject(new Error("Not found"));
    });

    render(<ChatPage />);

    expect(screen.getByText("Salary Specs")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const input = screen.getByLabelText(/Ask InsightFlow Copilot a question or command/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Show average salary_usd by country" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/The average salary is computed safely\./i)).toBeInTheDocument();
      expect(screen.getByText(/Schema-only mode: raw rows were not sent to AI\./i)).toBeInTheDocument();
    });
  });

  it("shows clean validation errors when query references columns missing from schema", async () => {
    vi.mocked(useData).mockReturnValue({
      dataset: mockSalaryDataset,
      isHydrating: false,
      apiError: null,
      retryHydrate: vi.fn(),
    } as any);

    vi.mocked(window.fetch).mockImplementation((url: string) => {
      if (url.includes("/chat/history")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { messages: [] } }),
        } as any);
      }
      if (url.includes("/chat")) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              success: false,
              error: { message: "Column 'revenue' does not exist in schema." },
            }),
        } as any);
      }
      return Promise.reject(new Error("Not found"));
    });

    render(<ChatPage />);

    const input = screen.getByLabelText(/Ask InsightFlow Copilot a question or command/i);
    fireEvent.change(input, { target: { value: "Show average revenue by country" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/Column 'revenue' does not exist in schema\./i)).toBeInTheDocument();
    });
  });
});
