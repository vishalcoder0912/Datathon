import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/shared/layout/AppLayout";
import StatusPanel from "@/shared/layout/StatusPanel";
import { FilterProvider } from "@/kavach/context/FilterContext";
import ProtectedRoute from "@/auth/ProtectedRoute";

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

const KavachDashboard = lazy(() => import("@/kavach/pages/DashboardPage"));
const IntelligenceOS = lazy(() => import("@/kavach/pages/IntelligenceOSPage"));
const GeoIntelligence = lazy(() => import("@/kavach/pages/GeoIntelligencePage"));
const TrendIntelligence = lazy(() => import("@/kavach/pages/TrendIntelligencePage"));
const NetworkIntelligence = lazy(() => import("@/kavach/pages/NetworkIntelligencePage"));
const OffendersPage = lazy(() => import("@/kavach/pages/OffendersPage"));
const OffenderDetailPage = lazy(() => import("@/kavach/pages/OffenderDetailPage"));
const RiskIntelligence = lazy(() => import("@/kavach/pages/RiskIntelligencePage"));
const SocialIntelligence = lazy(() => import("@/kavach/pages/SocialIntelligencePage"));
const AICopilot = lazy(() => import("@/kavach/pages/AICopilotPage"));
const AlertsPage = lazy(() => import("@/kavach/pages/AlertsPage"));
const ReportsPage = lazy(() => import("@/kavach/pages/ReportsPage"));
const DataManagement = lazy(() => import("@/kavach/pages/DataManagementPage"));
const ImportDataPage = lazy(() => import("@/kavach/pages/ImportDataPage"));
const LoginPage = lazy(() => import("@/auth/LoginPage"));
const UnauthorizedPage = lazy(() => import("@/auth/UnauthorizedPage"));

export default function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<StatusPanel title="Loading" message="Preparing KAVACH AI workspace." />}>
        <FilterProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* ── Command Centre ── */}
                <Route path="/dashboard" element={<KavachDashboard />} />
                <Route path="/intelligence-os" element={<IntelligenceOS />} />
                <Route path="/geo-intelligence" element={<GeoIntelligence />} />
                <Route path="/trend-intelligence" element={<TrendIntelligence />} />
                <Route path="/network-intelligence" element={<NetworkIntelligence />} />
                <Route path="/offenders" element={<OffendersPage />} />
                <Route path="/offenders/:offenderId" element={<OffenderDetailPage />} />
                <Route path="/risk-intelligence" element={<RiskIntelligence />} />
                <Route path="/social-intelligence" element={<SocialIntelligence />} />
                <Route path="/ai-copilot" element={<AICopilot />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/import-data" element={<ImportDataPage />} />

                {/* ── Admin-only ── */}
                <Route
                  path="/data-management"
                  element={<ProtectedRoute roles={["STATE_ADMIN", "DATA_ENGINEER", "AUDITOR"]} />}
                >
                  <Route index element={<DataManagement />} />
                </Route>

                {/* ── Legacy / InsightFlow ── */}
                <Route path="/data" element={<DataTablePage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/pdf" element={<PdfUploadPage />} />
                <Route path="/pdf-upload" element={<PdfUploadPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/agentic" element={<AgenticPage />} />
                <Route path="/agentic-data-science" element={<AgenticDataSciencePage />} />
                <Route path="/ml" element={<MLPage />} />
                <Route path="/insightflow-dashboard" element={<PremiumAgenticDashboardPage />} />

                {/* ── Redirects ── */}
                <Route path="/elite-dashboard" element={<Navigate to="/dashboard" replace />} />
                <Route path="/local-chat" element={<Navigate to="/chat" replace />} />
              </Route>
            </Route>

            <Route path="/mobile-upload/:sessionId" element={<ProtectedRoute />}>
              <Route index element={<MobileUploadPortal />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </FilterProvider>
      </Suspense>
    </BrowserRouter>
  );
}
