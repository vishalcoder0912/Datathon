import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import StatusPanel from "@/shared/layout/StatusPanel";

const AnalyticsPage = lazy(() => import("@/features/analytics/pages/AnalyticsPage"));
const AgenticPage = lazy(() => import("@/features/analytics/pages/AgenticPage"));
const AgenticDataSciencePage = lazy(() => import("@/features/analytics/pages/AgenticDataSciencePage"));
const ChatPage = lazy(() => import("@/features/chat/pages/ChatPage"));
const PremiumAgenticDashboardPage = lazy(() => import("@/features/dashboard/pages/PremiumAgenticDashboardPage"));
const DataTablePage = lazy(() => import("@/features/dashboard/pages/DataTablePage"));
const UploadPage = lazy(() => import("@/features/data/pages/UploadPage"));
const MobileUploadPortal = lazy(() => import("@/features/data/pages/MobileUploadPortal"));
const MLPage = lazy(() => import("@/features/ml/pages/MLPage"));
const PdfUploadPage = lazy(() => import("@/features/pdf/pages/PdfUploadPage"));
const NotFoundPage = lazy(() => import("@/app/routes/NotFoundPage"));

export default function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<StatusPanel title="Loading" message="Preparing InsightFlow workspace." />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<PremiumAgenticDashboardPage />} />
            <Route path="/dashboard" element={<PremiumAgenticDashboardPage />} />
            <Route path="/data" element={<DataTablePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/pdf" element={<PdfUploadPage />} />
            <Route path="/pdf-upload" element={<PdfUploadPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/agentic" element={<AgenticPage />} />
            <Route path="/agentic-data-science" element={<AgenticDataSciencePage />} />
            <Route path="/ml" element={<MLPage />} />

            <Route path="/elite-dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/local-chat" element={<Navigate to="/chat" replace />} />
          </Route>

          <Route path="/mobile-upload/:sessionId" element={<MobileUploadPortal />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
