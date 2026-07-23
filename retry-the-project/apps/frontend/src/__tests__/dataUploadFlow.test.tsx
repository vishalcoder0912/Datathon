import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UploadPage from "@/features/data/pages/UploadPage";

const uploadFiles = vi.fn(async () => undefined);
const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/features/data/context/useData", () => ({
  useData: () => ({
    dataset: null,
    analysis: null,
    loadDemo: vi.fn(),
    deleteDataset: vi.fn(),
    uploadFiles,
    retryHydrate: vi.fn(),
    isProcessing: false,
  }),
}));

vi.mock("@/features/data/api/dataApi", () => ({
  api: {
    generateQRSession: vi.fn(async () => ({
      sessionId: "qr-1",
      uploadToken: "token", // audit-ignore: secret-leak
      uploadUrl: "http://localhost/mobile-upload/qr-1",
      qrDataUrl: "data:image/png;base64,abc",
      workspaceName: "InsightFlow Workspace",
      status: "waiting",
      expiresAt: new Date().toISOString(),
    })),
    getQRSessionStatus: vi.fn(async () => ({
      sessionId: "qr-1",
      status: "waiting",
      workspaceName: "InsightFlow Workspace",
      files: [],
      expiresAt: new Date().toISOString(),
    })),
  },
}));

describe("upload/data flow", () => {
  it("uploads a selected CSV file through the data context", async () => {
    uploadFiles.mockClear();
    navigate.mockClear();
    render(<UploadPage />);

    const file = new File(["country,salary_usd\nIndia,50000"], "salary.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]:not([multiple])') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith([file]));
    await waitFor(() => expect(screen.getByText(/File processed successfully/i)).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /^Upload Data$/i })).toBeInTheDocument();
  });
});
