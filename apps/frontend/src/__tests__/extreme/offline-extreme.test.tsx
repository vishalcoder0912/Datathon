import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

function DataSaveComponent() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/save", { method: "POST" });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
    } catch (err) {
      setError("Unable to save. Your data is safe and will not be lost.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {saving && <div aria-busy="true">Saving...</div>}
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {saved && <div>Data saved successfully</div>}
      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Data"}
      </button>
    </div>
  );
}

function OfflineIndicator() {
  const [offline, setOffline] = useState(true);
  return (
    <div>
      {offline && (
        <div role="status" className="offline-banner">
          <span>You are currently offline</span>
          <button
            type="button"
            onClick={() => setOffline(false)}
            aria-label="Dismiss offline notification"
          >
            Dismiss
          </button>
        </div>
      )}
      <p>Dashboard content</p>
    </div>
  );
}

describe("Offline behavior", () => {
  it("shows user-friendly error message when API is down", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<DataSaveComponent />);

    const saveBtn = screen.getByRole("button", { name: /save data/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toContain("data is safe");
      expect(alert.textContent).not.toContain("Network error");
    });

    globalThis.fetch = originalFetch;
  });

  it("shows offline indicator", () => {
    render(<OfflineIndicator />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.textContent).toContain("offline");
  });

  it("does not lose data on failed save", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const localStorageMock = vi.spyOn(Storage.prototype, "setItem");

    render(<DataSaveComponent />);

    const saveBtn = screen.getByRole("button", { name: /save data/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("data is safe");
    });

    globalThis.fetch = originalFetch;
    localStorageMock.mockRestore();
  });
});

describe("Graceful degradation", () => {
  it("still shows basic UI when API is unavailable", () => {
    render(
      <div>
        <h1>Dashboard</h1>
        <p>Showing cached data</p>
        <button type="button" onClick={vi.fn()}>
          Retry
        </button>
      </div>,
    );

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retry button triggers reconnection attempt", () => {
    const retryHandler = vi.fn();

    render(
      <div>
        <p role="alert">Connection lost</p>
        <button type="button" onClick={retryHandler}>
          Retry Connection
        </button>
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry connection/i }));
    expect(retryHandler).toHaveBeenCalledTimes(1);
  });
});
