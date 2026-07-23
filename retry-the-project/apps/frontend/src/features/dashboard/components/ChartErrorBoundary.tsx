import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ChartErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("Chart render failed:", error);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] rounded-3xl border border-rose-100 bg-white p-6 text-rose-700 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle className="size-5" /></span>
            <h3 className="font-bold text-slate-950">{this.props.fallbackTitle || "Chart failed to load"}</h3>
          </div>
          <p className="mb-4 text-sm text-slate-500">This chart failed to render, but the dashboard is still available.</p>
          <button onClick={this.reset} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white" type="button">
            <RefreshCw className="size-4" />
            Retry chart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
