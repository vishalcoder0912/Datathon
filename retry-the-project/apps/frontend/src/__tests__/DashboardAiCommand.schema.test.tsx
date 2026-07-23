import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;
window.fetch = mockFetch;

import { fireEvent, render, screen } from "@testing-library/react";
import ChatInterface from "@/features/chat/components/ChatInterface";

const salesDataset = {
  id: "sales-id",
  name: "Sales Dataset",
  columns: [
    { name: "region", type: "string" },
    { name: "category", type: "string" },
    { name: "revenue", type: "number" }
  ],
  rows: [
    { region: "North", category: "Tech", revenue: 1000 },
    { region: "South", category: "Office", revenue: 500 }
  ]
};

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({
    dataset: salesDataset,
  }),
}));


beforeEach(() => {
  mockFetch.mockReset();
  
  // Default mock behavior for history loading and chat sending
  mockFetch.mockImplementation(async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes("/chat/history")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { messages: [] }
        })
      };
    }
    
    if (urlStr.includes("/chat") && options?.method === "POST") {
      const body = JSON.parse(options.body as string);
      const query = body.query || "";
      const isSalary = query.toLowerCase().includes("salary");
      
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            assistantMessage: {
              id: "reply-id",
              role: "assistant",
              content: isSalary
                ? "I cannot create salary analysis because a salary or salary_usd field was not found. Available numeric fields are: revenue."
                : "Created Revenue by Region.",
              timestamp: new Date().toISOString()
            }
          }
        })
      };
    }
    
    return { ok: false };
  });
});

describe("ChatInterface AI commands validation in UI", () => {
  it("processes a valid chart command and adds it to the chat messages", async () => {
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/Ask a question or give a command/i);
    const sendButton = screen.getByLabelText("Send command");

    fireEvent.change(input, { target: { value: "Create revenue chart by region" } });
    fireEvent.click(sendButton);

    // Expect the user's message to be in the chat list
    expect(screen.getByText("Create revenue chart by region")).toBeInTheDocument();

    // Expect the assistant's response to mention creating the chart
    expect(await screen.findByText(/Created Revenue by Region/i)).toBeInTheDocument();
  });

  it("shows validation message when an invalid command is sent", async () => {
    render(<ChatInterface />);

    const input = screen.getByPlaceholderText(/Ask a question or give a command/i);
    const sendButton = screen.getByLabelText("Send command");

    // Ask for salary columns which are not in the sales schema
    fireEvent.change(input, { target: { value: "Show average salary by job title" } });
    fireEvent.click(sendButton);

    expect(screen.getByText("Show average salary by job title")).toBeInTheDocument();
    
    // Should display the validation warning message
    expect(await screen.findByText(/I cannot create salary analysis because a salary or salary_usd field was not found/i)).toBeInTheDocument();
  });
});
