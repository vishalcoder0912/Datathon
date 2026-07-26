# Project Architecture Report

Generated: 2026-05-20T03:58:27.389Z
Root: C:\Users\VISHAL\Desktop\20-12-2025\All_full_stack_preparation\expo\retry-the-project

## Executive Summary

- Files exported: 314
- Total lines exported: 59,372
- Total source bytes exported: 19,19,616
- Skipped paths: 39
- Secret redaction: enabled

## Project Tree

```text
|-- .github/
|   `-- workflows/
|       |-- ci.yml
|       `-- deploy.yml
|-- apps/
|   |-- backend/
|   |   |-- api/
|   |   |   `-- index.js
|   |   |-- data/
|   |   |   |-- ai-analyst-memory.json
|   |   |   |-- schema-training-memory.json
|   |   |   `-- schema-training-memory.seed.json
|   |   |-- scripts/
|   |   |   |-- export-schema-training-jsonl.js
|   |   |   `-- train-schema-dashboard-llm.js
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   |-- constants.js
|   |   |   |   |-- environment.js
|   |   |   |   `-- gemini-config.js
|   |   |   |-- core/
|   |   |   |   `-- server.js
|   |   |   |-- database/
|   |   |   |   `-- dataset-repository.js
|   |   |   |-- genai/
|   |   |   |   |-- analyticsEngine.ts
|   |   |   |   |-- dashboardBuilder.ts
|   |   |   |   `-- reportGenerator.ts
|   |   |   |-- middleware/
|   |   |   |   |-- cors.js
|   |   |   |   |-- error-handler.js
|   |   |   |   |-- error.middleware.js
|   |   |   |   |-- logger.middleware.js
|   |   |   |   |-- request-logger.js
|   |   |   |   `-- validation.middleware.js
|   |   |   |-- routes/
|   |   |   |   |-- ai-analyst.routes.js
|   |   |   |   |-- ai.js
|   |   |   |   |-- analytics-brain.js
|   |   |   |   |-- analytics.js
|   |   |   |   |-- analytics.routes.js
|   |   |   |   |-- chat.js
|   |   |   |   |-- chat.routes.js
|   |   |   |   |-- dashboard-quality.js
|   |   |   |   |-- dashboardAiRoutes.js
|   |   |   |   |-- dataset.routes.js
|   |   |   |   |-- datasets.js
|   |   |   |   |-- export.js
|   |   |   |   |-- genaiRoutes.ts
|   |   |   |   |-- health.js
|   |   |   |   |-- health.routes.js
|   |   |   |   |-- index.js
|   |   |   |   |-- machine-learning.js
|   |   |   |   |-- pdf.js
|   |   |   |   |-- playbook-analysis.js
|   |   |   |   |-- qr-upload.js
|   |   |   |   |-- schema-trained-ai.routes.js
|   |   |   |   `-- state.js
|   |   |   |-- services/
|   |   |   |   |-- __tests__/
|   |   |   |   |   |-- schema-only-dashboard-engine.test.js
|   |   |   |   |   `-- schema-packet-builder.test.js
|   |   |   |   |-- ai/
|   |   |   |   |   |-- providers/
|   |   |   |   |   |   |-- anthropic-provider.js
|   |   |   |   |   |   |-- gemini-provider.js
|   |   |   |   |   |   |-- ollama-provider.js
|   |   |   |   |   |   `-- openai-provider.js
|   |   |   |   |   |-- utils/
|   |   |   |   |   |   |-- prompt-templates.js
|   |   |   |   |   |   |-- response-parser.js
|   |   |   |   |   |   `-- token-counter.js
|   |   |   |   |   |-- ai-manager.js
|   |   |   |   |   |-- dashboardPlanner.js
|   |   |   |   |   |-- insightflowMasterPlanner.ts
|   |   |   |   |   `-- ollamaClient.js
|   |   |   |   |-- ai-analyst/
|   |   |   |   |   |-- ai-analyst-orchestrator.js
|   |   |   |   |   |-- analyst-memory.js
|   |   |   |   |   |-- analyst-playbooks.js
|   |   |   |   |   |-- chart-engine.js
|   |   |   |   |   |-- command-router.js
|   |   |   |   |   |-- dashboard-plan-engine.js
|   |   |   |   |   |-- kpi-engine.js
|   |   |   |   |   |-- llm-schema-dashboard-planner.js
|   |   |   |   |   |-- schema-fingerprint.js
|   |   |   |   |   |-- schema-profiler.js
|   |   |   |   |   |-- schema-trained-ai-service.js
|   |   |   |   |   `-- schema-training-store.js
|   |   |   |   |-- ai-providers/
|   |   |   |   |   |-- ai-router.js
|   |   |   |   |   |-- gemini-service.js
|   |   |   |   |   |-- local-nlp-service.js
|   |   |   |   |   `-- ollama-service.js
|   |   |   |   |-- dashboard/
|   |   |   |   |   |-- dashboard-integrity-engine.js
|   |   |   |   |   |-- dashboardAnalytics.js
|   |   |   |   |   |-- dashboardFixEngine.js
|   |   |   |   |   `-- schemaProfiler.js
|   |   |   |   |-- ml/
|   |   |   |   |   `-- automl-service.js
|   |   |   |   |-- ollama/
|   |   |   |   |   |-- dataset-schema-summary.js
|   |   |   |   |   `-- ollama-dual-model-service.js
|   |   |   |   |-- pdf/
|   |   |   |   |   |-- pdf-dataset-builder.js
|   |   |   |   |   |-- pdf-loader-service.js
|   |   |   |   |   |-- pdf-qa-service.js
|   |   |   |   |   |-- pdf-rag-chunker.js
|   |   |   |   |   |-- pdf-store.js
|   |   |   |   |   `-- pdf-table-extractor.js
|   |   |   |   |-- playbooks/
|   |   |   |   |   |-- data-analytics-projects-playbooks.js
|   |   |   |   |   |-- playbook-dashboard-engine.js
|   |   |   |   |   `-- playbook-matcher.js
|   |   |   |   |-- qr-upload/
|   |   |   |   |   |-- qr-file-parser.js
|   |   |   |   |   `-- qr-upload-store.js
|   |   |   |   |-- ai-analyzer.js
|   |   |   |   |-- ai-cascade-service.js
|   |   |   |   |-- ai-data-service.js
|   |   |   |   |-- alert-service.js
|   |   |   |   |-- analytics-brain-service.js
|   |   |   |   |-- analytics-memory-service.js
|   |   |   |   |-- analytics-playbook-engine.js
|   |   |   |   |-- analytics-service.js
|   |   |   |   |-- dashboard-ai-agent.js
|   |   |   |   |-- data-merger.js
|   |   |   |   |-- data-sampling-service.js
|   |   |   |   |-- data-visualization-service.js
|   |   |   |   |-- dataset-role-detector.js
|   |   |   |   |-- domain-detector.js
|   |   |   |   |-- export-service.js
|   |   |   |   |-- gemini-ai-service.js
|   |   |   |   |-- llama-chat-agent.js
|   |   |   |   |-- llama-validation-middleware.js
|   |   |   |   |-- local-database-service.js
|   |   |   |   |-- ml-client.js
|   |   |   |   |-- ollama-ai-service.js
|   |   |   |   |-- ollama-service.js
|   |   |   |   |-- pipeline-service.js
|   |   |   |   |-- predictive-analytics.js
|   |   |   |   |-- qr-upload-service.js
|   |   |   |   |-- query-cache.js
|   |   |   |   |-- recommendation-engine.js
|   |   |   |   |-- report-generator.js
|   |   |   |   |-- schema-ai-service.js
|   |   |   |   |-- schema-dashboard-engine.js
|   |   |   |   |-- schema-detector.js
|   |   |   |   |-- schema-only-dashboard-engine.js
|   |   |   |   |-- schema-packet-builder.js
|   |   |   |   |-- schema-packet-worker.js
|   |   |   |   `-- smart-query-handler.js
|   |   |   |-- utils/
|   |   |   |   |-- helpers.js
|   |   |   |   |-- logger.js
|   |   |   |   |-- response-utils.js
|   |   |   |   `-- schema-extractor.js
|   |   |   |-- index.js
|   |   |   |-- server.js
|   |   |   `-- server.ts
|   |   |-- kill-port.js
|   |   |-- MIGRATION_GUIDE.md
|   |   |-- package.json
|   |   |-- quick-start.bat
|   |   |-- quick-start.sh
|   |   |-- README.md
|   |   |-- REFACTORING_COMPLETE.md
|   |   |-- SETUP_NEW_STRUCTURE.md
|   |   |-- STRUCTURE_SUMMARY.md
|   |   `-- test-gemini.js
|   |-- frontend/
|   |   |-- public/
|   |   |   `-- robots.txt
|   |   |-- src/
|   |   |   |-- app/
|   |   |   |   |-- providers/
|   |   |   |   |   |-- AppErrorBoundary.tsx
|   |   |   |   |   `-- AppProviders.tsx
|   |   |   |   |-- routes/
|   |   |   |   |   |-- AppRouter.tsx
|   |   |   |   |   `-- NotFoundPage.tsx
|   |   |   |   `-- App.tsx
|   |   |   |-- components/
|   |   |   |   `-- GenAIDashboard.tsx
|   |   |   |-- features/
|   |   |   |   |-- analytics/
|   |   |   |   |   `-- pages/
|   |   |   |   |       |-- AnalyticsPage.tsx
|   |   |   |   |       |-- AnomalyDetectionPage.tsx
|   |   |   |   |       |-- DataCleaningPage.tsx
|   |   |   |   |       |-- DataProfilingPage.tsx
|   |   |   |   |       |-- ExportPage.tsx
|   |   |   |   |       `-- RelationshipsPage.tsx
|   |   |   |   |-- chat/
|   |   |   |   |   |-- components/
|   |   |   |   |   |   |-- ChatInterface.tsx
|   |   |   |   |   |   `-- LocalAIChatInterface.tsx
|   |   |   |   |   `-- pages/
|   |   |   |   |       |-- ChatPage.tsx
|   |   |   |   |       `-- LocalChatPage.tsx
|   |   |   |   |-- dashboard/
|   |   |   |   |   |-- components/
|   |   |   |   |   |   |-- AnalyticsChart.tsx
|   |   |   |   |   |   |-- AnalyticsSidebar.tsx
|   |   |   |   |   |   |-- DashboardFilters.tsx
|   |   |   |   |   |   |-- DataQualityPanel.tsx
|   |   |   |   |   |   |-- ExportMenu.tsx
|   |   |   |   |   |   |-- KPICard.tsx
|   |   |   |   |   |   |-- LlamaQueryBuilder.tsx
|   |   |   |   |   |   |-- RecommendationsPanel.tsx
|   |   |   |   |   |   |-- SchemaDashboardChat.tsx
|   |   |   |   |   |   `-- SmartChartCard.tsx
|   |   |   |   |   |-- hooks/
|   |   |   |   |   |   |-- useEliteAnalytics.ts
|   |   |   |   |   |   |-- useKPIEngine.ts
|   |   |   |   |   |   `-- useSchemaTrainedDashboard.ts
|   |   |   |   |   |-- pages/
|   |   |   |   |   |   |-- DashboardPage.tsx
|   |   |   |   |   |   |-- DataTablePage.tsx
|   |   |   |   |   |   `-- EliteDashboardPage.tsx
|   |   |   |   |   |-- types/
|   |   |   |   |   |   `-- dashboardTypes.ts
|   |   |   |   |   `-- utils/
|   |   |   |   |       |-- dashboardAnalytics.ts
|   |   |   |   |       |-- dashboardController.ts
|   |   |   |   |       |-- dashboardStateStorage.ts
|   |   |   |   |       `-- dynamicQuestionSuggestions.ts
|   |   |   |   |-- data/
|   |   |   |   |   |-- api/
|   |   |   |   |   |   |-- dataApi.test.ts
|   |   |   |   |   |   |-- dataApi.ts
|   |   |   |   |   |   `-- schemaTrainedApi.additions.ts
|   |   |   |   |   |-- context/
|   |   |   |   |   |   |-- data-context-store.ts
|   |   |   |   |   |   |-- DataContext.tsx
|   |   |   |   |   |   |-- localDataContext.tsx
|   |   |   |   |   |   `-- useData.ts
|   |   |   |   |   |-- model/
|   |   |   |   |   |   |-- analyticsEngine.ts
|   |   |   |   |   |   `-- dataStore.ts
|   |   |   |   |   |-- pages/
|   |   |   |   |   |   |-- MobileUploadPortal.tsx
|   |   |   |   |   |   `-- UploadPage.tsx
|   |   |   |   |   `-- utils/
|   |   |   |   |       |-- exportUtils.ts
|   |   |   |   |       `-- localFileProcessor.ts
|   |   |   |   |-- ml/
|   |   |   |   |   `-- pages/
|   |   |   |   |       `-- MLPage.tsx
|   |   |   |   `-- pdf/
|   |   |   |       `-- pages/
|   |   |   |           `-- PdfUploadPage.tsx
|   |   |   |-- shared/
|   |   |   |   |-- components/
|   |   |   |   |   |-- navigation/
|   |   |   |   |   |   `-- NavLink.tsx
|   |   |   |   |   |-- ui/
|   |   |   |   |   |   |-- accordion.tsx
|   |   |   |   |   |   |-- alert-dialog.tsx
|   |   |   |   |   |   |-- alert.tsx
|   |   |   |   |   |   |-- aspect-ratio.tsx
|   |   |   |   |   |   |-- avatar.tsx
|   |   |   |   |   |   |-- badge.tsx
|   |   |   |   |   |   |-- breadcrumb.tsx
|   |   |   |   |   |   |-- button-variants.ts
|   |   |   |   |   |   |-- button.tsx
|   |   |   |   |   |   |-- calendar.tsx
|   |   |   |   |   |   |-- card.tsx
|   |   |   |   |   |   |-- carousel.tsx
|   |   |   |   |   |   |-- chart.tsx
|   |   |   |   |   |   |-- checkbox.tsx
|   |   |   |   |   |   |-- collapsible.tsx
|   |   |   |   |   |   |-- command.tsx
|   |   |   |   |   |   |-- context-menu.tsx
|   |   |   |   |   |   |-- dialog.tsx
|   |   |   |   |   |   |-- drawer.tsx
|   |   |   |   |   |   |-- dropdown-menu.tsx
|   |   |   |   |   |   |-- form.tsx
|   |   |   |   |   |   |-- hover-card.tsx
|   |   |   |   |   |   |-- input-otp.tsx
|   |   |   |   |   |   |-- input.tsx
|   |   |   |   |   |   |-- label.tsx
|   |   |   |   |   |   |-- menubar.tsx
|   |   |   |   |   |   |-- navigation-menu.tsx
|   |   |   |   |   |   |-- pagination.tsx
|   |   |   |   |   |   |-- popover.tsx
|   |   |   |   |   |   |-- progress.tsx
|   |   |   |   |   |   |-- radio-group.tsx
|   |   |   |   |   |   |-- resizable.tsx
|   |   |   |   |   |   |-- scroll-area.tsx
|   |   |   |   |   |   |-- select.tsx
|   |   |   |   |   |   |-- separator.tsx
|   |   |   |   |   |   |-- sheet.tsx
|   |   |   |   |   |   |-- sidebar.tsx
|   |   |   |   |   |   |-- skeleton.tsx
|   |   |   |   |   |   |-- slider.tsx
|   |   |   |   |   |   |-- sonner.tsx
|   |   |   |   |   |   |-- switch.tsx
|   |   |   |   |   |   |-- table.tsx
|   |   |   |   |   |   |-- tabs.tsx
|   |   |   |   |   |   |-- textarea.tsx
|   |   |   |   |   |   |-- toast.tsx
|   |   |   |   |   |   |-- toaster.tsx
|   |   |   |   |   |   |-- toggle-group.tsx
|   |   |   |   |   |   |-- toggle-variants.ts
|   |   |   |   |   |   |-- toggle.tsx
|   |   |   |   |   |   |-- tooltip.tsx
|   |   |   |   |   |   `-- use-toast.ts
|   |   |   |   |   `-- ErrorBoundary.tsx
|   |   |   |   |-- hooks/
|   |   |   |   |   |-- use-mobile.tsx
|   |   |   |   |   `-- use-toast.ts
|   |   |   |   |-- layout/
|   |   |   |   |   |-- AppLayout.tsx
|   |   |   |   |   |-- AppSidebar.tsx
|   |   |   |   |   |-- StatusPanel.tsx
|   |   |   |   |   `-- ThemeToggle.tsx
|   |   |   |   `-- lib/
|   |   |   |       |-- logger.test.ts
|   |   |   |       |-- logger.ts
|   |   |   |       `-- utils.ts
|   |   |   |-- test/
|   |   |   |   |-- dataStore.test.ts
|   |   |   |   |-- example.test.ts
|   |   |   |   `-- setup.ts
|   |   |   |-- index.css
|   |   |   |-- main.tsx
|   |   |   `-- vite-env.d.ts
|   |   |-- components.json
|   |   |-- eslint.config.js
|   |   |-- index.html
|   |   |-- package.json
|   |   |-- postcss.config.js
|   |   |-- README.md
|   |   |-- tailwind.config.ts
|   |   |-- tsconfig.app.json
|   |   |-- tsconfig.json
|   |   |-- tsconfig.node.json
|   |   |-- vite.config.ts
|   |   |-- vite.config.ts.timestamp-1778317320522-4b59a14bffbf68.mjs
|   |   `-- vitest.config.ts
|   `-- ml-service/
|       |-- app.py
|       |-- CONFIGURATION_GUIDE.md
|       |-- QUICK_START.md
|       |-- requirements.txt
|       `-- test_ml_service.py
|-- docs/
|   `-- FOLDER_STRUCTURE.md
|-- packages/
|   |-- shared-analytics/
|   |   |-- src/
|   |   |   `-- index.js
|   |   `-- package.json
|   `-- shared-errors/
|       `-- index.js
|-- scripts/
|   |-- export-ai-safe.js
|   `-- export-codebase-deep.js
|-- API_FIX_COMPLETE.md
|-- api-test.js
|-- DATA_ANALYST_AUTOMATION_PLAN.md
|-- DEPLOY.md
|-- e2e-full-test.js
|-- export-codebase.ps1
|-- gemini-config.js
|-- IMPLEMENTATION_NOTES.md
|-- package.json
|-- PROJECT_STATUS.md
|-- PROXY_FIX.md
|-- rapid-load-test.cjs
|-- README.md
|-- restart-dev.bat
|-- scratch_test_ollama_real.js
|-- scratch_test_ollama.js
|-- scratch_test_service.js
|-- start-all.bat
|-- start-all.sh
|-- TEST_DOCUMENTATION.md
|-- test-integration.bat
|-- test-integration.sh
|-- TESTING_DOCUMENTATION.md
|-- TESTING_PROMPTS.md
|-- vercel.json
`-- VERIFICATION_COMPLETE.md
```

## Workspaces And Packages

| Package | File | Scripts | Dependency Count | Workspaces |
| --- | --- | --- | --- | --- |
| @insightflow/backend | apps/backend/package.json | dev, dev:watch, start, build, kill-port, test, test:run | 17 |  |
| @insightflow/frontend | apps/frontend/package.json | dev, build, build:dev, lint, preview, test, test:watch | 73 |  |
| insightflow | package.json | dev, dev:all, dev:frontend, dev:backend, dev:ml, build, build:frontend, build:backend, export:ai-safe, lint, test | 1 | apps/frontend, apps/backend, packages/shared-analytics |
| @insightflow/shared-analytics | packages/shared-analytics/package.json | test | 0 |  |

## Entrypoints

- apps/backend/src/core/server.js
- apps/backend/src/server.js
- apps/backend/src/server.ts
- apps/frontend/src/app/routes/AppRouter.tsx
- apps/frontend/src/main.tsx
- apps/frontend/vite.config.ts
- apps/ml-service/app.py

## Frontend Routes

| Route | File |
| --- | --- |
| / | apps/frontend/src/app/routes/AppRouter.tsx |
| /dashboard | apps/frontend/src/app/routes/AppRouter.tsx |
| /upload | apps/frontend/src/app/routes/AppRouter.tsx |
| /pdf | apps/frontend/src/app/routes/AppRouter.tsx |
| /pdf-upload | apps/frontend/src/app/routes/AppRouter.tsx |
| /chat | apps/frontend/src/app/routes/AppRouter.tsx |
| /local-chat | apps/frontend/src/app/routes/AppRouter.tsx |
| /data | apps/frontend/src/app/routes/AppRouter.tsx |
| /analytics | apps/frontend/src/app/routes/AppRouter.tsx |
| /analytics/profile | apps/frontend/src/app/routes/AppRouter.tsx |
| /analytics/anomalies | apps/frontend/src/app/routes/AppRouter.tsx |
| /analytics/relationships | apps/frontend/src/app/routes/AppRouter.tsx |
| /analytics/cleaning | apps/frontend/src/app/routes/AppRouter.tsx |
| /analytics/export | apps/frontend/src/app/routes/AppRouter.tsx |
| /ml | apps/frontend/src/app/routes/AppRouter.tsx |
| /mobile-upload/:sessionId | apps/frontend/src/app/routes/AppRouter.tsx |
| * | apps/frontend/src/app/routes/AppRouter.tsx |

## API Endpoints

| Endpoint | File |
| --- | --- |
| /api/state | API_FIX_COMPLETE.md |
| /api/datasets | API_FIX_COMPLETE.md |
| /api/datasets/:id/chat | API_FIX_COMPLETE.md |
| /api/datasets/:id/ai-* | API_FIX_COMPLETE.md |
| /api/datasets/:id/export/:format | API_FIX_COMPLETE.md |
| /api/health | apps/backend/api/index.js |
| /api/state | apps/backend/api/index.js |
| /api/datasets/demo | apps/backend/api/index.js |
| /api/datasets/import | apps/backend/api/index.js |
| /api/datasets/merge | apps/backend/api/index.js |
| /api/automation/analyze | apps/backend/api/index.js |
| /api/llama/query | apps/backend/api/index.js |
| /api/llama/status | apps/backend/api/index.js |
| /api/llama/cache | apps/backend/api/index.js |
| /api/automation/report | apps/backend/api/index.js |
| /api/automation/forecast | apps/backend/api/index.js |
| /api/automation/alerts | apps/backend/api/index.js |
| /api/health | apps/backend/SETUP_NEW_STRUCTURE.md |
| /api/ai/status | apps/backend/SETUP_NEW_STRUCTURE.md |
| /api/health | apps/backend/src/config/constants.js |
| /api/ai/status | apps/backend/src/config/constants.js |
| /api/ai/models | apps/backend/src/config/constants.js |
| /api/ai/test | apps/backend/src/config/constants.js |
| /api/datasets | apps/backend/src/config/constants.js |
| /api/datasets/import | apps/backend/src/config/constants.js |
| /api/datasets/merge | apps/backend/src/config/constants.js |
| /api/datasets/:id/chat | apps/backend/src/config/constants.js |
| /api/datasets/:id/analyze | apps/backend/src/config/constants.js |
| /api/datasets/:id/schema | apps/backend/src/config/constants.js |
| /api/datasets/:id/export | apps/backend/src/config/constants.js |
| /api/datasets/:id/auto-charts | apps/backend/src/config/constants.js |
| /api/datasets/:id/correlations | apps/backend/src/config/constants.js |
| /api/datasets/:id/outliers | apps/backend/src/config/constants.js |
| /api/datasets/:id/predictions | apps/backend/src/config/constants.js |
| /api/ai/ollama-status | apps/backend/src/routes/ai.js |
| /api/ai/status | apps/backend/src/routes/ai.js |
| /api/ai/providers | apps/backend/src/routes/ai.js |
| /api/ai/stats | apps/backend/src/routes/ai.js |
| /api/ai/test | apps/backend/src/routes/ai.js |
| /api/ai/chat | apps/backend/src/routes/ai.js |
| /api/ai/switch | apps/backend/src/routes/ai.js |
| /api/ai/reset-stats | apps/backend/src/routes/ai.js |
| /api/cascade/status | apps/backend/src/routes/ai.js |
| /api/qr-upload/generate | apps/backend/src/routes/ai.js |
| /api/analytics-brain/feedback | apps/backend/src/routes/analytics-brain.js |
| /api/analytics-brain/memory | apps/backend/src/routes/analytics-brain.js |
| /api/dashboard-ai/generate | apps/backend/src/routes/dashboardAiRoutes.js |
| /api/dashboard-ai/command | apps/backend/src/routes/dashboardAiRoutes.js |
| /api/dashboard-ai/fix | apps/backend/src/routes/dashboardAiRoutes.js |
| /api/datasets/current | apps/backend/src/routes/dataset.routes.js |
| /api/datasets/demo | apps/backend/src/routes/dataset.routes.js |
| /api/datasets/import | apps/backend/src/routes/dataset.routes.js |
| /api/datasets | apps/backend/src/routes/datasets.js |
| /api/datasets/demo | apps/backend/src/routes/datasets.js |
| /api/datasets/import | apps/backend/src/routes/datasets.js |
| /api/datasets/merge | apps/backend/src/routes/datasets.js |
| /api/health | apps/backend/src/routes/health.js |
| /api/health/detailed | apps/backend/src/routes/health.js |
| /api/health/ping | apps/backend/src/routes/health.js |
| /api/health/ready | apps/backend/src/routes/health.js |
| /api/health/live | apps/backend/src/routes/health.js |
| /api/health | apps/backend/src/routes/health.routes.js |
| /api/ready | apps/backend/src/routes/health.routes.js |
| /api/health | apps/backend/src/routes/index.js |
| /api/ai/* | apps/backend/src/routes/index.js |
| /api/datasets/* | apps/backend/src/routes/index.js |
| /api/datasets/:id/chat | apps/backend/src/routes/index.js |
| /api/datasets/:id/analyze | apps/backend/src/routes/index.js |
| /api/datasets/:id/export | apps/backend/src/routes/index.js |
| /api/docs | apps/backend/src/routes/index.js |
| /api/ml/health | apps/backend/src/routes/machine-learning.js |
| /api/ml/train | apps/backend/src/routes/machine-learning.js |
| /api/ml/predict | apps/backend/src/routes/machine-learning.js |
| /api/ml/models | apps/backend/src/routes/machine-learning.js |
| /api/ml/cluster | apps/backend/src/routes/machine-learning.js |
| /api/ml/pca | apps/backend/src/routes/machine-learning.js |
| /api/pdf/import | apps/backend/src/routes/pdf.js |
| /api/qr-upload/generate | apps/backend/src/routes/qr-upload.js |
| /api/ai/schema-training-memory | apps/backend/src/routes/schema-trained-ai.routes.js |
| /api/ai/schema-training/train-memory | apps/backend/src/routes/schema-trained-ai.routes.js |
| /api/state | apps/backend/src/routes/state.js |
| /api/state/reset | apps/backend/src/routes/state.js |
| /api/health | apps/backend/src/server.js |
| /api/state | apps/backend/src/server.js |
| /api/datasets/demo | apps/backend/src/server.js |
| /api/datasets/import | apps/backend/src/server.js |
| /api/datasets/merge | apps/backend/src/server.js |
| /api/genai | apps/backend/src/server.ts |
| /api/qr-upload/${sessionId}/${uploadToken} | apps/backend/src/services/qr-upload-service.js |
| /api/ai/* | apps/backend/STRUCTURE_SUMMARY.md |
| /api/health | apps/backend/STRUCTURE_SUMMARY.md |
| /api/datasets/* | apps/backend/STRUCTURE_SUMMARY.md |
| /api/datasets/:id/chat | apps/backend/STRUCTURE_SUMMARY.md |
| /api/datasets/:id/analyze | apps/backend/STRUCTURE_SUMMARY.md |
| /api/datasets/:id/export | apps/backend/STRUCTURE_SUMMARY.md |
| /api/automation/report | apps/frontend/src/features/dashboard/components/ExportMenu.tsx |
| /api/llama/status | apps/frontend/src/features/dashboard/components/LlamaQueryBuilder.tsx |
| /api/llama/query | apps/frontend/src/features/dashboard/components/LlamaQueryBuilder.tsx |
| /api/automation/analyze | apps/frontend/src/features/dashboard/components/RecommendationsPanel.tsx |
| /api/state | apps/frontend/src/features/data/api/dataApi.test.ts |
| /api/state | apps/frontend/src/features/data/api/dataApi.ts |
| /api/state/reset | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/import | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/merge | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/demo | apps/frontend/src/features/data/api/dataApi.ts |
| /api/pdf/${pdfId}/ask | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/rows/${rowId} | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/chat | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/schema-dashboard | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/schema-train | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/dashboard-command | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/schema-chat | apps/frontend/src/features/data/api/dataApi.ts |
| /api/ai/schema-training-memory | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/dashboard-validate-fix | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/analytics-brain | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/playbook-analysis | apps/frontend/src/features/data/api/dataApi.ts |
| /api/analytics-brain/feedback | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/ai-correlations | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/ai/profile | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/ai/anomalies | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/ai/relationships | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/ai/cleaning | apps/frontend/src/features/data/api/dataApi.ts |
| /api/cascade/status | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId} | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/ai-analyst/analyze | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${input.datasetId}/ai-analyst/command | apps/frontend/src/features/data/api/dataApi.ts |
| /api/dashboard-ai/generate | apps/frontend/src/features/data/api/dataApi.ts |
| /api/dashboard-ai/command | apps/frontend/src/features/data/api/dataApi.ts |
| /api/dashboard-ai/fix | apps/frontend/src/features/data/api/dataApi.ts |
| /api/datasets/${datasetId}/schema-dashboard | apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts |
| /api/datasets/${datasetId}/schema-train | apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts |
| /api/datasets/${datasetId}/dashboard-command | apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts |
| /api/datasets/${datasetId}/schema-chat | apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts |
| /api/ai/schema-training-memory | apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts |
| /api/ml/train | apps/frontend/src/features/ml/pages/MLPage.tsx |
| /api/ml/predict | apps/frontend/src/features/ml/pages/MLPage.tsx |
| /api/ml | apps/frontend/vite.config.ts |
| /api/ml/health | apps/ml-service/app.py |
| /api/ml/config | apps/ml-service/app.py |
| /api/ml/train | apps/ml-service/app.py |
| /api/ml/predict | apps/ml-service/app.py |
| /api/ml/feature-importance | apps/ml-service/app.py |
| /api/ml/models | apps/ml-service/app.py |
| /api/ml/models/<dataset_id> | apps/ml-service/app.py |
| /api/ml/health | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/config | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/train | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/predict | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/feature-importance | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/models | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/models/:id | apps/ml-service/CONFIGURATION_GUIDE.md |
| /api/ml/config | apps/ml-service/QUICK_START.md |
| /api/ml/train | apps/ml-service/QUICK_START.md |
| /api/ml/predict | apps/ml-service/QUICK_START.md |
| /api/ml/models | apps/ml-service/QUICK_START.md |
| /api/ml/models/:id | apps/ml-service/QUICK_START.md |
| /api/* | DEPLOY.md |
| /api/health | docs/FOLDER_STRUCTURE.md |
| /api/datasets/current | docs/FOLDER_STRUCTURE.md |
| /api/datasets/demo | docs/FOLDER_STRUCTURE.md |
| /api/datasets/import | docs/FOLDER_STRUCTURE.md |
| /api/datasets/:id/schema | docs/FOLDER_STRUCTURE.md |
| /api/datasets/:id/chat | docs/FOLDER_STRUCTURE.md |
| /api/datasets/:id/ai-correlations | docs/FOLDER_STRUCTURE.md |
| /api/health | e2e-full-test.js |
| /api/state | e2e-full-test.js |
| /api/datasets/demo | e2e-full-test.js |
| /api/datasets/import | e2e-full-test.js |
| /api/datasets/${datasetId}/schema | e2e-full-test.js |
| /api/datasets/nonexistent-id/schema | e2e-full-test.js |
| /api/datasets/${datasetId}/rows/${rowId} | e2e-full-test.js |
| /api/datasets/${datasetId}/rows/999999 | e2e-full-test.js |
| /api/datasets/${datasetId}/chat | e2e-full-test.js |
| /api/datasets/${datasetId}/ai-correlations | e2e-full-test.js |
| /api/datasets/${datasetId}/ai/profile | e2e-full-test.js |
| /api/datasets/${datasetId}/ai/anomalies | e2e-full-test.js |
| /api/datasets/${datasetId}/ai/relationships | e2e-full-test.js |
| /api/datasets/${datasetId}/ai/cleaning | e2e-full-test.js |
| /api/datasets/${datasetId}/ai/suggestions | e2e-full-test.js |
| /api/datasets/${datasetId}/ai/narrative | e2e-full-test.js |
| /api/cache/stats | e2e-full-test.js |
| /api/datasets/${datasetId}/cache/stats | e2e-full-test.js |
| /api/datasets/${datasetId}/cache/clear | e2e-full-test.js |
| /api/datasets/schema-ai-query | e2e-full-test.js |
| /api/datasets/local-import | e2e-full-test.js |
| /api/ml/health | e2e-full-test.js |
| /api/ml/models/list | e2e-full-test.js |
| /api/datasets/${datasetId}/ml/train | e2e-full-test.js |
| /api/datasets/${datasetId}/ml/predict | e2e-full-test.js |
| /api/datasets/${datasetId}/ml/feature-importance | e2e-full-test.js |
| /api/nonexistent | e2e-full-test.js |
| /api/datasets/fake-id/chat | e2e-full-test.js |
| /api/datasets/fake-id/ai-correlations | e2e-full-test.js |
| /api/datasets/fake-id/ai/profile | e2e-full-test.js |
| /api/state | PROXY_FIX.md |
| /api/ml | PROXY_FIX.md |
| /api/* | PROXY_FIX.md |
| /api/ml/* | PROXY_FIX.md |
| /api/health | TESTING_PROMPTS.md |
| /api/state | TESTING_PROMPTS.md |
| /api/state | VERIFICATION_COMPLETE.md |

## Environment Variables Referenced

| Variable | File |
| --- | --- |
| AI_MAX_TOKENS | apps/backend/src/services/ai-providers/gemini-service.js |
| AI_MAX_TOKENS | apps/backend/src/services/ai-providers/ollama-service.js |
| AI_MAX_TOKENS | apps/backend/src/services/ollama-ai-service.js |
| AI_PROVIDER_PRIORITY | apps/backend/src/config/environment.js |
| AI_PROVIDER_PRIORITY | apps/backend/src/services/ai-providers/ai-router.js |
| AI_TEMPERATURE | apps/backend/src/config/environment.js |
| AI_TEMPERATURE | apps/backend/src/services/ai-providers/gemini-service.js |
| AI_TEMPERATURE | apps/backend/src/services/ai-providers/ollama-service.js |
| AI_TEMPERATURE | apps/backend/src/services/ollama-ai-service.js |
| AI_TIMEOUT_MS | apps/backend/src/config/environment.js |
| AI_TIMEOUT_MS | apps/backend/src/services/ai-providers/gemini-service.js |
| AI_TIMEOUT_MS | apps/backend/src/services/ai-providers/ollama-service.js |
| AI_TIMEOUT_MS | apps/backend/src/services/llama-validation-middleware.js |
| AI_TIMEOUT_MS | apps/backend/src/services/ollama-ai-service.js |
| ANALYTICS_BRAIN_MEMORY_FILE | apps/backend/src/services/analytics-brain-service.js |
| ANTHROPIC_API_KEY | apps/backend/src/config/environment.js |
| AUTO_CHART_GENERATION | apps/backend/src/config/environment.js |
| CHAT_HISTORY_ENABLED | apps/backend/src/config/environment.js |
| CHAT_LLM_MODEL | apps/backend/src/services/ai-analyst/llm-schema-dashboard-planner.js |
| CLIENT_ORIGIN | apps/backend/src/routes/qr-upload.js |
| CORRELATION_ANALYSIS | apps/backend/src/config/environment.js |
| CORS_CREDENTIALS | apps/backend/src/config/environment.js |
| CORS_ORIGIN | apps/backend/src/config/environment.js |
| CORS_ORIGIN | apps/backend/src/routes/qr-upload.js |
| DASHBOARD_AI_TIMEOUT_MS | apps/backend/src/services/schema-dashboard-engine.js |
| DASHBOARD_LLM_MODEL | apps/backend/src/services/ai-analyst/llm-schema-dashboard-planner.js |
| DASHBOARD_LLM_MODEL | apps/backend/src/services/ai/dashboardPlanner.js |
| DASHBOARD_LLM_TIMEOUT_MS | apps/backend/src/services/ai/ollamaClient.js |
| DASHBOARD_MASTER_MODEL | apps/backend/src/services/ai/dashboardPlanner.js |
| DASHBOARD_MASTER_MODEL | apps/backend/src/services/ai/insightflowMasterPlanner.ts |
| DATA_DIR | apps/backend/src/config/environment.js |
| DATA_DIR | apps/backend/src/database/dataset-repository.js |
| DATABASE_PATH | apps/backend/src/config/environment.js |
| EMBEDDING_MODEL | apps/backend/src/services/ai/ollamaClient.js |
| ENABLE_AI_FALLBACK | apps/backend/src/config/environment.js |
| FRONTEND_PUBLIC_URL | apps/backend/src/routes/ai.js |
| FRONTEND_PUBLIC_URL | apps/backend/src/routes/qr-upload.js |
| GEMINI_API_KEY | apps/backend/src/services/ai-cascade-service.js |
| GEMINI_API_KEY | apps/backend/src/services/ai-providers/gemini-service.js |
| GEMINI_API_KEY | apps/backend/src/services/gemini-ai-service.js |
| GEMINI_API_KEY | apps/backend/src/services/schema-ai-service.js |
| GEMINI_API_KEY | apps/backend/test-gemini.js |
| GOOGLE_API_KEY | apps/backend/src/config/environment.js |
| GOOGLE_API_KEY | apps/backend/src/genai/analyticsEngine.ts |
| GOOGLE_API_KEY | apps/backend/src/services/ai-cascade-service.js |
| GOOGLE_API_KEY | apps/backend/src/services/ai-providers/gemini-service.js |
| GOOGLE_API_KEY | apps/backend/src/services/gemini-ai-service.js |
| GOOGLE_API_KEY | apps/backend/src/services/schema-ai-service.js |
| GOOGLE_API_KEY | PROJECT_STATUS.md |
| HOST | apps/backend/src/config/environment.js |
| LOCAL_AI_ONLY | apps/backend/src/config/environment.js |
| LOCAL_NLP_ENABLED | apps/backend/src/config/environment.js |
| LOCAL_NLP_ENABLED | apps/backend/src/services/ai-providers/local-nlp-service.js |
| LOG_LEVEL | apps/backend/src/config/environment.js |
| LOG_LEVEL | apps/backend/src/middleware/logger.middleware.js |
| ML_SERVICE_URL | apps/backend/src/services/ml-client.js |
| NODE_ENV | apps/backend/src/config/environment.js |
| NODE_ENV | apps/backend/src/routes/health.js |
| NODE_ENV | apps/backend/src/utils/logger.js |
| NODE_ENV | apps/backend/src/utils/response-utils.js |
| NODE_ENV | packages/shared-errors/index.js |
| OLLAMA_BASE_URL | apps/backend/src/config/environment.js |
| OLLAMA_BASE_URL | apps/backend/src/genai/analyticsEngine.ts |
| OLLAMA_BASE_URL | apps/backend/src/services/ai-analyst/command-router.js |
| OLLAMA_BASE_URL | apps/backend/src/services/ai-analyst/llm-schema-dashboard-planner.js |
| OLLAMA_BASE_URL | apps/backend/src/services/ai-providers/ollama-service.js |
| OLLAMA_BASE_URL | apps/backend/src/services/ai/insightflowMasterPlanner.ts |
| OLLAMA_BASE_URL | apps/backend/src/services/ai/ollamaClient.js |
| OLLAMA_BASE_URL | apps/backend/src/services/llama-validation-middleware.js |
| OLLAMA_BASE_URL | apps/backend/src/services/ollama-ai-service.js |
| OLLAMA_BASE_URL | apps/backend/src/services/ollama-service.js |
| OLLAMA_BASE_URL | apps/backend/src/services/ollama/ollama-dual-model-service.js |
| OLLAMA_BASE_URL | apps/backend/src/services/pdf/pdf-qa-service.js |
| OLLAMA_BASE_URL | apps/backend/src/services/schema-dashboard-engine.js |
| OLLAMA_BASE_URL | apps/backend/src/services/schema-only-dashboard-engine.js |
| OLLAMA_CHAT_MODEL | apps/backend/src/config/environment.js |
| OLLAMA_CHAT_MODEL | apps/backend/src/services/ollama/ollama-dual-model-service.js |
| OLLAMA_CHAT_MODEL | apps/backend/src/services/schema-dashboard-engine.js |
| OLLAMA_CHAT_MODEL | apps/backend/src/services/schema-only-dashboard-engine.js |
| OLLAMA_DASHBOARD_MODEL | apps/backend/src/services/ollama/ollama-dual-model-service.js |
| OLLAMA_ENABLED | apps/backend/src/config/environment.js |
| OLLAMA_FREQUENCY_PENALTY | apps/backend/src/config/environment.js |
| OLLAMA_MODEL | apps/backend/src/config/environment.js |
| OLLAMA_MODEL | apps/backend/src/genai/analyticsEngine.ts |
| OLLAMA_MODEL | apps/backend/src/services/ai-analyst/command-router.js |
| OLLAMA_MODEL | apps/backend/src/services/ai-cascade-service.js |
| OLLAMA_MODEL | apps/backend/src/services/ai-providers/ollama-service.js |
| OLLAMA_MODEL | apps/backend/src/services/llama-validation-middleware.js |
| OLLAMA_MODEL | apps/backend/src/services/ollama-ai-service.js |
| OLLAMA_MODEL | apps/backend/src/services/ollama-service.js |
| OLLAMA_MODEL | apps/backend/src/services/pdf/pdf-qa-service.js |
| OLLAMA_MODEL | scratch_test_service.js |
| OLLAMA_TEMPERATURE | apps/backend/src/config/environment.js |
| OLLAMA_TIMEOUT_MS | apps/backend/src/config/environment.js |
| OLLAMA_TIMEOUT_MS | apps/backend/src/services/ollama/ollama-dual-model-service.js |
| OLLAMA_TOP_P | apps/backend/src/config/environment.js |
| OPENAI_API_KEY | apps/backend/src/config/environment.js |
| OUTLIER_DETECTION | apps/backend/src/config/environment.js |
| PORT | apps/backend/src/config/environment.js |
| PORT | apps/backend/src/server.js |
| PORT | apps/backend/src/server.ts |
| PUBLIC_APP_URL | apps/backend/src/routes/qr-upload.js |
| SCHEMA_ANALYSIS_CONCURRENCY | apps/backend/src/services/schema-packet-builder.js |
| SCHEMA_PACKET_SAMPLE_SIZE | apps/backend/src/services/schema-packet-builder.js |
| SCHEMA_TRAINING_MEMORY_PATH | apps/backend/src/services/ai-analyst/schema-training-store.js |
| SCHEMA_WORKER_CELL_THRESHOLD | apps/backend/src/services/schema-packet-builder.js |
| SCHEMA_WORKER_ROW_THRESHOLD | apps/backend/src/services/schema-packet-builder.js |
| SMARTCHART_ENABLED | apps/backend/src/config/environment.js |
| VERBOSE_LOGGING | apps/backend/src/config/environment.js |
| VITE_API_BASE_URL | apps/frontend/src/features/data/api/dataApi.ts |
| VITE_API_BASE_URL | apps/frontend/src/features/data/context/localDataContext.tsx |
| VITE_PUBLIC_APP_URL | apps/backend/src/routes/ai.js |
| VITE_PUBLIC_APP_URL | apps/backend/src/routes/qr-upload.js |
| VITE_PUBLIC_APP_URL | apps/frontend/src/features/data/api/dataApi.ts |
| VITE_PUBLIC_APP_URL | apps/frontend/src/features/data/pages/UploadPage.tsx |

## Source Composition

| Extension | Files | Lines | Bytes |
| --- | --- | --- | --- |
| .js | 136 | 31385 | 974822 |
| .tsx | 91 | 12286 | 470231 |
| .ts | 37 | 7394 | 230215 |
| .md | 20 | 5649 | 147473 |
| .json | 12 | 701 | 31427 |
| .bat | 4 | 220 | 5598 |
| .sh | 3 | 178 | 5928 |
| .yml | 2 | 148 | 3458 |
| .txt | 2 | 31 | 504 |
| .py | 2 | 1020 | 35955 |
| .html | 1 | 22 | 802 |
| .css | 1 | 132 | 3337 |
| .mjs | 1 | 43 | 4300 |
| .ps1 | 1 | 111 | 3729 |
| .cjs | 1 | 52 | 1837 |

## Module Breakdown

| Folder | Files | Lines | Top Extensions |
| --- | --- | --- | --- |
| .github | 2 | 148 | .yml: 2 |
| API_FIX_COMPLETE.md | 1 | 150 | .md: 1 |
| DATA_ANALYST_AUTOMATION_PLAN.md | 1 | 84 | .md: 1 |
| DEPLOY.md | 1 | 86 | .md: 1 |
| IMPLEMENTATION_NOTES.md | 1 | 266 | .md: 1 |
| PROJECT_STATUS.md | 1 | 209 | .md: 1 |
| PROXY_FIX.md | 1 | 154 | .md: 1 |
| README.md | 1 | 124 | .md: 1 |
| TESTING_DOCUMENTATION.md | 1 | 793 | .md: 1 |
| TESTING_PROMPTS.md | 1 | 882 | .md: 1 |
| TEST_DOCUMENTATION.md | 1 | 303 | .md: 1 |
| VERIFICATION_COMPLETE.md | 1 | 267 | .md: 1 |
| api-test.js | 1 | 22 | .js: 1 |
| apps | 280 | 52932 | .js: 126, .tsx: 91, .ts: 37, .json: 9, .md: 8 |
| docs | 1 | 199 | .md: 1 |
| e2e-full-test.js | 1 | 650 | .js: 1 |
| export-codebase.ps1 | 1 | 111 | .ps1: 1 |
| gemini-config.js | 1 | 6 | .js: 1 |
| package.json | 1 | 28 | .json: 1 |
| packages | 3 | 731 | .js: 2, .json: 1 |
| rapid-load-test.cjs | 1 | 52 | .cjs: 1 |
| restart-dev.bat | 1 | 58 | .bat: 1 |
| scratch_test_ollama.js | 1 | 24 | .js: 1 |
| scratch_test_ollama_real.js | 1 | 28 | .js: 1 |
| scratch_test_service.js | 1 | 32 | .js: 1 |
| scripts | 2 | 894 | .js: 2 |
| start-all.bat | 1 | 12 | .bat: 1 |
| start-all.sh | 1 | 38 | .sh: 1 |
| test-integration.bat | 1 | 39 | .bat: 1 |
| test-integration.sh | 1 | 43 | .sh: 1 |
| vercel.json | 1 | 7 | .json: 1 |

## Local Import Map

| File | Imports |
| --- | --- |
| apps/backend/api/index.js | ../src/services/ai-analyzer.js, ../src/services/alert-service.js, ../src/services/data-merger.js, ../src/services/llama-validation-middleware.js, ../src/services/ollama-ai-service.js, ../src/services/predictive-analytics.js, ../src/services/recommendation-engine.js, ../src/services/report-generator.js, ../src/services/schema-detector.js, ../src/utils/logger.js, node:crypto, sql.js |
| apps/backend/scripts/export-schema-training-jsonl.js | ../src/services/ai-analyst/schema-training-store.js, node:fs, node:path |
| apps/backend/scripts/train-schema-dashboard-llm.js | ../src/services/ai-analyst/dashboard-plan-engine.js, ../src/services/ai-analyst/schema-fingerprint.js, ../src/services/ai-analyst/schema-training-store.js, node:fs, node:path, node:url |
| apps/backend/src/core/server.js | ../config/environment.js, ../middleware/cors.js, ../middleware/error-handler.js, ../middleware/request-logger.js, ../routes/index.js, node:http |
| apps/backend/src/genai/dashboardBuilder.ts | ./analyticsEngine.js |
| apps/backend/src/index.js | ./config/environment.js, ./core/server.js, ./middleware/request-logger.js |
| apps/backend/src/middleware/cors.js | ../config/environment.js |
| apps/backend/src/middleware/error-handler.js | ../config/constants.js, ../config/environment.js, ../utils/response-utils.js |
| apps/backend/src/middleware/request-logger.js | ../config/environment.js |
| apps/backend/src/routes/ai-analyst.routes.js | ../config/constants.js, ../database/dataset-repository.js, ../services/ai-analyst/ai-analyst-orchestrator.js, ../utils/response-utils.js |
| apps/backend/src/routes/ai.js | ../config/constants.js, ../middleware/error-handler.js, ../services/ai/ai-manager.js, ../services/ollama/ollama-dual-model-service.js, ../services/qr-upload/qr-upload-store.js, ../utils/response-utils.js, qrcode |
| apps/backend/src/routes/analytics-brain.js | ../config/constants.js, ../database/dataset-repository.js, ../services/analytics-brain-service.js, ../utils/response-utils.js |
| apps/backend/src/routes/analytics.js | ../config/constants.js, ../database/dataset-repository.js, ../services/schema-packet-builder.js, ../utils/response-utils.js, ./state.js |
| apps/backend/src/routes/analytics.routes.js | ../database/dataset-repository.js, ../middleware/error.middleware.js, ../middleware/logger.middleware.js, ../services/analytics-service.js |
| apps/backend/src/routes/chat.js | ../config/constants.js, ../database/dataset-repository.js, ../services/dashboard-ai-agent.js, ../services/llama-chat-agent.js, ../utils/response-utils.js, node:crypto |
| apps/backend/src/routes/chat.routes.js | ../database/dataset-repository.js, ../middleware/error.middleware.js, ../middleware/logger.middleware.js, ../middleware/validation.middleware.js, ../services/analytics-service.js, node:crypto |
| apps/backend/src/routes/dashboard-quality.js | ../config/constants.js, ../database/dataset-repository.js, ../services/dashboard/dashboard-integrity-engine.js, ../utils/response-utils.js |
| apps/backend/src/routes/dashboardAiRoutes.js | ../services/ai/dashboardPlanner.js, ../services/dashboard/dashboardAnalytics.js, ../services/dashboard/dashboardFixEngine.js, ../services/dashboard/schemaProfiler.js |
| apps/backend/src/routes/dataset.routes.js | ../database/dataset-repository.js, ../middleware/error.middleware.js, ../middleware/logger.middleware.js, ../middleware/validation.middleware.js, ../services/analytics-service.js, node:crypto |
| apps/backend/src/routes/datasets.js | ../config/constants.js, ../database/dataset-repository.js, ../services/ai-analyst/ai-analyst-orchestrator.js, ../services/dataset-role-detector.js, ../utils/response-utils.js, ./state.js |
| apps/backend/src/routes/export.js | ../config/constants.js, ../database/dataset-repository.js, ../utils/response-utils.js |
| apps/backend/src/routes/genaiRoutes.ts | ../genai/dashboardBuilder.js, ../genai/reportGenerator.js, express |
| apps/backend/src/routes/health.js | ../config/constants.js, ../utils/response-utils.js, fs |
| apps/backend/src/routes/health.routes.js | ../database/dataset-repository.js, ../middleware/logger.middleware.js, ../services/gemini-ai-service.js |
| apps/backend/src/routes/index.js | ../config/constants.js, ../utils/response-utils.js, ./ai-analyst.routes.js, ./ai.js, ./analytics-brain.js, ./analytics.js, ./chat.js, ./dashboard-quality.js, ./dashboardAiRoutes.js, ./datasets.js, ./export.js, ./health.js, ./machine-learning.js, ./pdf.js, ./playbook-analysis.js, ./qr-upload.js, ./schema-trained-ai.routes.js, ./state.js |
| apps/backend/src/routes/machine-learning.js | ../services/ml/automl-service.js, ../utils/response-utils.js |
| apps/backend/src/routes/pdf.js | ../config/constants.js, ../database/dataset-repository.js, ../services/pdf/pdf-dataset-builder.js, ../services/pdf/pdf-loader-service.js, ../services/pdf/pdf-qa-service.js, ../services/pdf/pdf-store.js, ../services/playbooks/playbook-dashboard-engine.js, ../utils/response-utils.js, ./state.js, busboy, node:crypto, node:fs, node:fs/promises, node:path |
| apps/backend/src/routes/playbook-analysis.js | ../config/constants.js, ../database/dataset-repository.js, ../services/playbooks/playbook-dashboard-engine.js, ../utils/response-utils.js |
| apps/backend/src/routes/qr-upload.js | ../config/constants.js, ../database/dataset-repository.js, ../services/qr-upload/qr-file-parser.js, ../services/qr-upload/qr-upload-store.js, ../utils/response-utils.js, ./state.js, busboy, node:crypto, qrcode |
| apps/backend/src/routes/schema-trained-ai.routes.js | ../services/ai-analyst/schema-trained-ai-service.js, ../services/ai-analyst/schema-training-store.js, ../services/dashboard/dashboard-integrity-engine.js |
| apps/backend/src/routes/state.js | ../config/constants.js, ../database/dataset-repository.js, ../utils/response-utils.js |
| apps/backend/src/server.js | ./database/dataset-repository.js, ./routes/pdf.js, ./services/ai-analyzer.js, ./services/analytics-service.js, ./services/data-merger.js, ./services/report-generator.js, ./services/schema-detector.js, dotenv/config, node:crypto, node:http |
| apps/backend/src/server.ts | ./routes/genaiRoutes.js, cors, dotenv, express |
| apps/backend/src/services/__tests__/schema-only-dashboard-engine.test.js | ../schema-only-dashboard-engine.js, vitest |
| apps/backend/src/services/__tests__/schema-packet-builder.test.js | ../schema-packet-builder.js, vitest |
| apps/backend/src/services/ai-analyst/ai-analyst-orchestrator.js | ./analyst-memory.js, ./analyst-playbooks.js, ./chart-engine.js, ./command-router.js, ./kpi-engine.js, ./schema-profiler.js, node:crypto |
| apps/backend/src/services/ai-analyst/chart-engine.js | ./schema-profiler.js |
| apps/backend/src/services/ai-analyst/command-router.js | ./schema-profiler.js |
| apps/backend/src/services/ai-analyst/dashboard-plan-engine.js | ./schema-fingerprint.js |
| apps/backend/src/services/ai-analyst/kpi-engine.js | ./schema-profiler.js |
| apps/backend/src/services/ai-analyst/llm-schema-dashboard-planner.js | ./dashboard-plan-engine.js, ./schema-fingerprint.js |
| apps/backend/src/services/ai-analyst/schema-trained-ai-service.js | ./dashboard-plan-engine.js, ./llm-schema-dashboard-planner.js, ./schema-fingerprint.js, ./schema-training-store.js |
| apps/backend/src/services/ai-analyst/schema-training-store.js | ./dashboard-plan-engine.js, ./schema-fingerprint.js, node:crypto, node:fs, node:path, node:url |
| apps/backend/src/services/ai-analyzer.js | ./ai-providers/gemini-service.js, ./ai-providers/ollama-service.js, ./schema-detector.js |
| apps/backend/src/services/ai-cascade-service.js | ./ai/ai-manager.js, ./analytics-service.js, ./ollama-ai-service.js, ./query-cache.js |
| apps/backend/src/services/ai-data-service.js | ./gemini-ai-service.js |
| apps/backend/src/services/ai-providers/ai-router.js | ../ollama-ai-service.js, ./gemini-service.js, ./local-nlp-service.js |
| apps/backend/src/services/ai-providers/gemini-service.js | ../../utils/schema-extractor.js, @google/generative-ai |
| apps/backend/src/services/ai-providers/ollama-service.js | ../../utils/schema-extractor.js, axios |
| apps/backend/src/services/ai/ai-manager.js | ../../config/environment.js, ../../middleware/error-handler.js, ./providers/anthropic-provider.js, ./providers/gemini-provider.js, ./providers/ollama-provider.js, ./providers/openai-provider.js |
| apps/backend/src/services/ai/dashboardPlanner.js | ./ollamaClient.js |
| apps/backend/src/services/ai/providers/anthropic-provider.js | ../../../middleware/error-handler.js, @anthropic-ai/sdk |
| apps/backend/src/services/ai/providers/gemini-provider.js | ../../../middleware/error-handler.js, @google/generative-ai |
| apps/backend/src/services/ai/providers/ollama-provider.js | ../../../middleware/error-handler.js, axios, perf_hooks |
| apps/backend/src/services/ai/providers/openai-provider.js | ../../../middleware/error-handler.js, openai |
| apps/backend/src/services/alert-service.js | @insightflow/shared-analytics |
| apps/backend/src/services/analytics-playbook-engine.js | ./analytics-memory-service.js, ./domain-detector.js, node:crypto |
| apps/backend/src/services/analytics-service.js | ../utils/schema-extractor.js, ./ai-providers/ai-router.js, ./ollama-ai-service.js, ./schema-packet-builder.js, ./smart-query-handler.js, @insightflow/shared-analytics |
| apps/backend/src/services/dashboard-ai-agent.js | ./ollama/dataset-schema-summary.js, ./ollama/ollama-dual-model-service.js, node:crypto |
| apps/backend/src/services/dashboard/dashboardAnalytics.js | ./schemaProfiler.js, node:crypto |
| apps/backend/src/services/dashboard/dashboardFixEngine.js | ../ai/dashboardPlanner.js, ./dashboardAnalytics.js, ./schemaProfiler.js |
| apps/backend/src/services/gemini-ai-service.js | ../config/gemini-config.js, ./schema-packet-builder.js, @google/generative-ai |
| apps/backend/src/services/llama-chat-agent.js | ./ollama/dataset-schema-summary.js, ./ollama/ollama-dual-model-service.js |
| apps/backend/src/services/ml/automl-service.js | ../ai/ai-manager.js, ml-random-forest |
| apps/backend/src/services/ollama-ai-service.js | ../utils/schema-extractor.js |
| apps/backend/src/services/ollama-service.js | ../config/gemini-config.js, ./schema-packet-builder.js |
| apps/backend/src/services/pdf/pdf-dataset-builder.js | ./pdf-rag-chunker.js, ./pdf-table-extractor.js |
| apps/backend/src/services/pipeline-service.js | ./alert-service.js, ./predictive-analytics.js, ./recommendation-engine.js, ./report-generator.js, ./schema-detector.js, @insightflow/shared-analytics |
| apps/backend/src/services/playbooks/playbook-dashboard-engine.js | ../analytics-memory-service.js, ./playbook-matcher.js, node:crypto |
| apps/backend/src/services/playbooks/playbook-matcher.js | ./data-analytics-projects-playbooks.js |
| apps/backend/src/services/predictive-analytics.js | @insightflow/shared-analytics |
| apps/backend/src/services/recommendation-engine.js | ./schema-detector.js, @insightflow/shared-analytics |
| apps/backend/src/services/report-generator.js | ./pipeline-service.js |
| apps/backend/src/services/schema-dashboard-engine.js | ./schema-packet-builder.js, node:crypto |
| apps/backend/src/services/schema-only-dashboard-engine.js | ./analytics-playbook-engine.js, node:crypto |
| apps/backend/src/services/schema-packet-builder.js | @insightflow/shared-analytics, node:os, node:worker_threads |
| apps/backend/src/services/schema-packet-worker.js | @insightflow/shared-analytics, node:worker_threads |
| apps/backend/src/services/smart-query-handler.js | ./schema-detector.js, @insightflow/shared-analytics |
| apps/backend/src/utils/response-utils.js | ../config/constants.js, fs, path |
| apps/frontend/src/app/App.tsx | @/app/providers/AppProviders, @/app/routes/AppRouter |
| apps/frontend/src/app/providers/AppErrorBoundary.tsx | @/shared/layout/StatusPanel, react |
| apps/frontend/src/app/providers/AppProviders.tsx | @/app/providers/AppErrorBoundary, @/features/data/context/DataContext, @/features/data/context/localDataContext, @/shared/components/ui/sonner, @/shared/components/ui/toaster, @/shared/components/ui/tooltip, next-themes, react |
| apps/frontend/src/app/routes/AppRouter.tsx | @/app/routes/NotFoundPage, @/features/analytics/pages/AnalyticsPage, @/features/analytics/pages/AnomalyDetectionPage, @/features/analytics/pages/DataCleaningPage, @/features/analytics/pages/DataProfilingPage, @/features/analytics/pages/ExportPage, @/features/analytics/pages/RelationshipsPage, @/features/chat/pages/ChatPage, @/features/chat/pages/LocalChatPage, @/features/dashboard/pages/DashboardPage, @/features/dashboard/pages/DataTablePage, @/features/dashboard/pages/EliteDashboardPage, @/features/data/pages/MobileUploadPortal, @/features/data/pages/UploadPage, @/features/ml/pages/MLPage, @/features/pdf/pages/PdfUploadPage, @/shared/layout/AppLayout, react-router-dom |
| apps/frontend/src/components/GenAIDashboard.tsx | @/components/ui/button, @/components/ui/card, axios, react, recharts, sonner |
| apps/frontend/src/features/analytics/pages/AnalyticsPage.tsx | @/features/dashboard/components/SchemaDashboardChat, @/features/dashboard/components/SmartChartCard, @/features/dashboard/utils/dashboardAnalytics, @/features/data/context/useData, @/shared/layout/StatusPanel, lucide-react, react |
| apps/frontend/src/features/analytics/pages/AnomalyDetectionPage.tsx | @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react |
| apps/frontend/src/features/analytics/pages/DataCleaningPage.tsx | @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react |
| apps/frontend/src/features/analytics/pages/DataProfilingPage.tsx | @/features/data/api/dataApi, @/features/data/context/useData, react |
| apps/frontend/src/features/analytics/pages/ExportPage.tsx | @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react |
| apps/frontend/src/features/analytics/pages/RelationshipsPage.tsx | @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react |
| apps/frontend/src/features/chat/components/ChatInterface.tsx | @/features/dashboard/components/SmartChartCard, @/features/dashboard/utils/dashboardAnalytics, @/features/dashboard/utils/dashboardStateStorage, @/features/dashboard/utils/dynamicQuestionSuggestions, @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react, react-router-dom |
| apps/frontend/src/features/chat/components/LocalAIChatInterface.tsx | @/features/data/context/localDataContext, framer-motion, lucide-react, react |
| apps/frontend/src/features/chat/pages/ChatPage.tsx | @/features/chat/components/ChatInterface, @/features/data/context/useData, @/shared/layout/StatusPanel, react |
| apps/frontend/src/features/chat/pages/LocalChatPage.tsx | @/features/chat/components/LocalAIChatInterface |
| apps/frontend/src/features/dashboard/components/AnalyticsChart.tsx | @/features/data/model/dataStore, @/shared/components/ui/input, @/shared/components/ui/sheet, @/shared/components/ui/switch, framer-motion, html-to-image, lucide-react, react, recharts |
| apps/frontend/src/features/dashboard/components/AnalyticsSidebar.tsx | @/features/data/api/dataApi, @/features/data/model/dataStore, framer-motion, lucide-react, react |
| apps/frontend/src/features/dashboard/components/DashboardFilters.tsx | @/features/data/model/dataStore, @/shared/components/ui/badge, @/shared/components/ui/button, @/shared/components/ui/calendar, @/shared/components/ui/popover, @/shared/components/ui/select, @/shared/lib/utils, date-fns, framer-motion, lucide-react, react |
| apps/frontend/src/features/dashboard/components/DataQualityPanel.tsx | @/features/data/model/dataStore, @/shared/lib/utils, lucide-react |
| apps/frontend/src/features/dashboard/components/ExportMenu.tsx | @/shared/components/ui/button, @/shared/components/ui/dropdown-menu, lucide-react, react, sonner |
| apps/frontend/src/features/dashboard/components/KPICard.tsx | @/features/data/model/dataStore, @/shared/lib/utils, framer-motion, lucide-react |
| apps/frontend/src/features/dashboard/components/LlamaQueryBuilder.tsx | @/shared/components/ui/alert, @/shared/components/ui/badge, @/shared/components/ui/button, @/shared/components/ui/card, @/shared/components/ui/textarea, lucide-react, react |
| apps/frontend/src/features/dashboard/components/RecommendationsPanel.tsx | @/features/data/context/useData, @/shared/components/ui/badge, @/shared/components/ui/button, @/shared/components/ui/card, @/shared/components/ui/scroll-area, lucide-react, react, sonner |
| apps/frontend/src/features/dashboard/components/SchemaDashboardChat.tsx | @/features/dashboard/utils/dashboardAnalytics, @/features/dashboard/utils/dynamicQuestionSuggestions, @/features/data/api/dataApi, lucide-react, react |
| apps/frontend/src/features/dashboard/components/SmartChartCard.tsx | @/features/dashboard/types/dashboardTypes, @/features/dashboard/utils/dashboardAnalytics, @/shared/components/ui/button, @/shared/components/ui/dropdown-menu, lucide-react, react, recharts |
| apps/frontend/src/features/dashboard/hooks/useEliteAnalytics.ts | @/features/data/model/analyticsEngine, @/features/data/model/dataStore, react |
| apps/frontend/src/features/dashboard/hooks/useKPIEngine.ts | @/features/data/model/analyticsEngine, @/features/data/model/dataStore, react |
| apps/frontend/src/features/dashboard/hooks/useSchemaTrainedDashboard.ts | @/features/data/api/dataApi, react |
| apps/frontend/src/features/dashboard/pages/DashboardPage.tsx | @/features/dashboard/components/AnalyticsChart, @/features/dashboard/components/AnalyticsSidebar, @/features/dashboard/components/DashboardFilters, @/features/dashboard/components/DataQualityPanel, @/features/dashboard/components/KPICard, @/features/data/context/useData, @/features/data/model/dataStore, @/features/data/utils/exportUtils, @/shared/layout/StatusPanel, framer-motion, lucide-react, react |
| apps/frontend/src/features/dashboard/pages/DataTablePage.tsx | @/features/dashboard/utils/dashboardAnalytics, @/features/data/context/useData, @/features/data/model/dataStore, @/shared/layout/StatusPanel, lucide-react, react |
| apps/frontend/src/features/dashboard/pages/EliteDashboardPage.tsx | @/features/dashboard/components/SchemaDashboardChat, @/features/dashboard/components/SmartChartCard, @/features/dashboard/types/dashboardTypes, @/features/dashboard/utils/dashboardAnalytics, @/features/dashboard/utils/dashboardStateStorage, @/features/data/api/dataApi, @/features/data/context/useData, @/shared/layout/StatusPanel, lucide-react, react, react-router-dom |
| apps/frontend/src/features/dashboard/utils/dashboardAnalytics.ts | @/features/dashboard/types/dashboardTypes |
| apps/frontend/src/features/dashboard/utils/dashboardStateStorage.ts | @/features/dashboard/utils/dashboardAnalytics |
| apps/frontend/src/features/dashboard/utils/dynamicQuestionSuggestions.ts | @/features/dashboard/utils/dashboardAnalytics |
| apps/frontend/src/features/data/api/dataApi.test.ts | ./dataApi, vitest |
| apps/frontend/src/features/data/api/dataApi.ts | @/features/dashboard/types/dashboardTypes, @/features/data/model/dataStore, @/shared/lib/logger |
| apps/frontend/src/features/data/context/data-context-store.ts | @/features/data/api/dataApi, @/features/data/model/dataStore, react |
| apps/frontend/src/features/data/context/DataContext.tsx | @/features/data/api/dataApi, @/features/data/context/data-context-store, @/features/data/model/dataStore, papaparse, react, xlsx |
| apps/frontend/src/features/data/context/localDataContext.tsx | @/features/data/api/dataApi, @/features/data/model/dataStore, react |
| apps/frontend/src/features/data/context/useData.ts | @/features/data/context/data-context-store, react |
| apps/frontend/src/features/data/model/analyticsEngine.ts | @/features/data/model/dataStore, @insightflow/shared-analytics |
| apps/frontend/src/features/data/model/dataStore.ts | @insightflow/shared-analytics |
| apps/frontend/src/features/data/pages/MobileUploadPortal.tsx | @/features/data/api/dataApi, lucide-react, react, react-router-dom |
| apps/frontend/src/features/data/pages/UploadPage.tsx | @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react, react-router-dom |
| apps/frontend/src/features/data/utils/exportUtils.ts | @/features/data/model/dataStore |
| apps/frontend/src/features/data/utils/localFileProcessor.ts | @/features/data/model/dataStore, papaparse, xlsx |
| apps/frontend/src/features/ml/pages/MLPage.tsx | @/features/data/context/useData, axios, react, recharts |
| apps/frontend/src/features/pdf/pages/PdfUploadPage.tsx | @/features/dashboard/components/SmartChartCard, @/features/dashboard/utils/dashboardAnalytics, @/features/data/api/dataApi, @/features/data/context/useData, lucide-react, react, react-router-dom |
| apps/frontend/src/main.tsx | ./app/App.tsx, ./index.css, react-dom/client |
| apps/frontend/src/shared/components/navigation/NavLink.tsx | @/shared/lib/utils, react, react-router-dom |
| apps/frontend/src/shared/components/ui/accordion.tsx | @/shared/lib/utils, @radix-ui/react-accordion, lucide-react, react |
| apps/frontend/src/shared/components/ui/alert-dialog.tsx | @/shared/components/ui/button-variants, @/shared/lib/utils, @radix-ui/react-alert-dialog, react |
| apps/frontend/src/shared/components/ui/alert.tsx | @/shared/lib/utils, class-variance-authority, react |
| apps/frontend/src/shared/components/ui/avatar.tsx | @/shared/lib/utils, @radix-ui/react-avatar, react |
| apps/frontend/src/shared/components/ui/badge.tsx | @/shared/lib/utils, class-variance-authority, react |
| apps/frontend/src/shared/components/ui/breadcrumb.tsx | @/shared/lib/utils, @radix-ui/react-slot, lucide-react, react |
| apps/frontend/src/shared/components/ui/button.tsx | @/shared/components/ui/button-variants, @/shared/lib/utils, @radix-ui/react-slot, react |
| apps/frontend/src/shared/components/ui/calendar.tsx | @/shared/components/ui/button-variants, @/shared/lib/utils, lucide-react, react, react-day-picker |
| apps/frontend/src/shared/components/ui/card.tsx | @/shared/lib/utils, react |
| apps/frontend/src/shared/components/ui/carousel.tsx | @/shared/components/ui/button, @/shared/lib/utils, embla-carousel-react, lucide-react, react |
| apps/frontend/src/shared/components/ui/chart.tsx | @/shared/lib/utils, react, recharts |
| apps/frontend/src/shared/components/ui/checkbox.tsx | @/shared/lib/utils, @radix-ui/react-checkbox, lucide-react, react |
| apps/frontend/src/shared/components/ui/command.tsx | @/shared/components/ui/dialog, @/shared/lib/utils, @radix-ui/react-dialog, cmdk, lucide-react, react |
| apps/frontend/src/shared/components/ui/context-menu.tsx | @/shared/lib/utils, @radix-ui/react-context-menu, lucide-react, react |
| apps/frontend/src/shared/components/ui/dialog.tsx | @/shared/lib/utils, @radix-ui/react-dialog, lucide-react, react |
| apps/frontend/src/shared/components/ui/drawer.tsx | @/shared/lib/utils, react, vaul |
| apps/frontend/src/shared/components/ui/dropdown-menu.tsx | @/shared/lib/utils, @radix-ui/react-dropdown-menu, lucide-react, react |
| apps/frontend/src/shared/components/ui/form.tsx | @/shared/components/ui/label, @/shared/lib/utils, @radix-ui/react-label, @radix-ui/react-slot, react, react-hook-form |
| apps/frontend/src/shared/components/ui/hover-card.tsx | @/shared/lib/utils, @radix-ui/react-hover-card, react |
| apps/frontend/src/shared/components/ui/input-otp.tsx | @/shared/lib/utils, input-otp, lucide-react, react |
| apps/frontend/src/shared/components/ui/input.tsx | @/shared/lib/utils, react |
| apps/frontend/src/shared/components/ui/label.tsx | @/shared/lib/utils, @radix-ui/react-label, class-variance-authority, react |
| apps/frontend/src/shared/components/ui/menubar.tsx | @/shared/lib/utils, @radix-ui/react-menubar, lucide-react, react |
| apps/frontend/src/shared/components/ui/navigation-menu.tsx | @/shared/lib/utils, @radix-ui/react-navigation-menu, class-variance-authority, lucide-react, react |
| apps/frontend/src/shared/components/ui/pagination.tsx | @/shared/components/ui/button, @/shared/components/ui/button-variants, @/shared/lib/utils, lucide-react, react |
| apps/frontend/src/shared/components/ui/popover.tsx | @/shared/lib/utils, @radix-ui/react-popover, react |
| apps/frontend/src/shared/components/ui/progress.tsx | @/shared/lib/utils, @radix-ui/react-progress, react |
| apps/frontend/src/shared/components/ui/radio-group.tsx | @/shared/lib/utils, @radix-ui/react-radio-group, lucide-react, react |
| apps/frontend/src/shared/components/ui/resizable.tsx | @/shared/lib/utils, lucide-react, react-resizable-panels |
| apps/frontend/src/shared/components/ui/scroll-area.tsx | @/shared/lib/utils, @radix-ui/react-scroll-area, react |
| apps/frontend/src/shared/components/ui/select.tsx | @/shared/lib/utils, @radix-ui/react-select, lucide-react, react |
| apps/frontend/src/shared/components/ui/separator.tsx | @/shared/lib/utils, @radix-ui/react-separator, react |
| apps/frontend/src/shared/components/ui/sheet.tsx | @/shared/lib/utils, @radix-ui/react-dialog, class-variance-authority, lucide-react, react |
| apps/frontend/src/shared/components/ui/sidebar.tsx | @/shared/components/ui/button, @/shared/components/ui/input, @/shared/components/ui/separator, @/shared/components/ui/sheet, @/shared/components/ui/skeleton, @/shared/components/ui/tooltip, @/shared/hooks/use-mobile, @/shared/lib/utils, @radix-ui/react-slot, class-variance-authority, lucide-react, react |
| apps/frontend/src/shared/components/ui/skeleton.tsx | @/shared/lib/utils |
| apps/frontend/src/shared/components/ui/slider.tsx | @/shared/lib/utils, @radix-ui/react-slider, react |
| apps/frontend/src/shared/components/ui/switch.tsx | @/shared/lib/utils, @radix-ui/react-switch, react |
| apps/frontend/src/shared/components/ui/table.tsx | @/shared/lib/utils, react |
| apps/frontend/src/shared/components/ui/tabs.tsx | @/shared/lib/utils, @radix-ui/react-tabs, react |
| apps/frontend/src/shared/components/ui/textarea.tsx | @/shared/lib/utils, react |
| apps/frontend/src/shared/components/ui/toast.tsx | @/shared/lib/utils, @radix-ui/react-toast, class-variance-authority, lucide-react, react |
| apps/frontend/src/shared/components/ui/toaster.tsx | @/shared/components/ui/toast, @/shared/hooks/use-toast |
| apps/frontend/src/shared/components/ui/toggle-group.tsx | @/shared/components/ui/toggle-variants, @/shared/lib/utils, @radix-ui/react-toggle-group, react |
| apps/frontend/src/shared/components/ui/toggle.tsx | @/shared/components/ui/toggle-variants, @/shared/lib/utils, @radix-ui/react-toggle, react |
| apps/frontend/src/shared/components/ui/tooltip.tsx | @/shared/lib/utils, @radix-ui/react-tooltip, react |
| apps/frontend/src/shared/components/ui/use-toast.ts | @/shared/hooks/use-toast |
| apps/frontend/src/shared/hooks/use-toast.ts | @/shared/components/ui/toast, react |
| apps/frontend/src/shared/layout/AppLayout.tsx | @/features/data/context/useData, @/shared/layout/AppSidebar, lucide-react, react, react-router-dom |
| apps/frontend/src/shared/layout/AppSidebar.tsx | @/shared/layout/ThemeToggle, @/shared/lib/utils, lucide-react, react-router-dom |
| apps/frontend/src/shared/layout/StatusPanel.tsx | @/shared/components/ui/button |
| apps/frontend/src/shared/lib/logger.test.ts | ./logger, vitest |
| apps/frontend/src/test/dataStore.test.ts | @/features/dashboard/hooks/useKPIEngine, @/features/data/model/analyticsEngine, @/features/data/model/dataStore, @testing-library/react, vitest |
| scratch_test_ollama_real.js | ./apps/backend/src/services/ollama-service.js |
| scratch_test_service.js | ./apps/backend/src/services/ai-providers/ollama-service.js, dotenv |

## Skipped Paths

| Path | Reason |
| --- | --- |
| .env | ignored file or sensitive path |
| .env.example | ignored file or sensitive path |
| .git | ignored directory |
| .gitignore | extension not included |
| .tmp_schema_trained_patch | ignored directory |
| apps/backend/.env | ignored file or sensitive path |
| apps/backend/.env.example | ignored file or sensitive path |
| apps/backend/.gitignore | extension not included |
| apps/backend/data/insightflow.sqlite | ignored file or sensitive path |
| apps/backend/data/insightflow.sqlite-shm | extension not included |
| apps/backend/data/insightflow.sqlite-wal | extension not included |
| apps/backend/Modelfile.schema-analyst | extension not included |
| apps/backend/node_modules | ignored directory |
| apps/data/local-datasets/1cc948f2-c055-4bb4-b8e3-1c07193d5f0a.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/4109a035-b7f7-4d2d-89b5-7d914e823873.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/4154333e-b40e-469f-8b7c-d6dd968c8372.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/5faa9a46-14ee-4470-add9-831e4550cc48.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/87043a9e-06f6-4cb6-80ca-216db89ed963.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/9235eb40-c600-4024-b96c-7a8c3b9f691d.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/bfdd4ed0-12d1-4d9f-9daa-6afb93e51d3b.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/caf937ac-6a07-4818-9a1c-e3fef609eb46.sqlite | ignored file or sensitive path |
| apps/data/local-datasets/de2bf94d-0424-43d1-87f9-e14c2bd6e1e6.sqlite | ignored file or sensitive path |
| apps/frontend/.gitignore | extension not included |
| apps/frontend/dist | ignored directory |
| apps/frontend/node_modules | ignored directory |
| apps/ml-service/__pycache__/app.cpython-314.pyc | extension not included |
| apps/ml-service/.gitignore | extension not included |
| apps/ml-service/Dockerfile | extension not included |
| codebase.md | larger than 1200000 bytes |
| data/uploads | ignored directory |
| IMPLEMENTATION_NOTES.pdf | ignored file or sensitive path |
| InsightFlow_AI_Implementation_Document.docx | ignored file or sensitive path |
| logs | ignored directory |
| Modelfile | extension not included |
| node_modules | ignored directory |
| package-lock.json | ignored file or sensitive path |
| PROJECT_AI_SAFE.md | ignored file or sensitive path |
| PROJECT_ARCHITECTURE.md | ignored file or sensitive path |
| sample.csv | extension not included |

## Export Notes

- The code bundle is intended for AI review, migration planning, auditing, and debugging.
- Generated folders, dependencies, binary/media files, logs, PDFs, SQLite databases, and common secret files are skipped.
- Secret redaction is best effort. Review the generated bundle before sharing it externally.
- Use `CODEBASE_MANIFEST.json` for automation and `CODEBASE_ARCHITECTURE.md` for human review.

