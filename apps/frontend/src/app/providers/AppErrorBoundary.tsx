import { Component, ErrorInfo, ReactNode } from "react";
import StatusPanel from "@/shared/layout/StatusPanel";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "The application hit an unexpected error.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Application error boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <StatusPanel
          title="Application error"
          message={this.state.errorMessage}
          actionLabel="Reload App"
          onAction={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
