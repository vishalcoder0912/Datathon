# Code Audit Report

**Summary:** 545 issues (0 critical, 0 high, 94 medium, 451 low) across 409 files

## 1. Issues by Rule

### console-log
- **Total:** 447 low
- **Affected files (57):**
  - .tmp_schema_trained_patch/
apps/
backend/
scripts/
export-schema-training-jsonl.js
  - .tmp_schema_trained_patch/
apps/
backend/
scripts/
train-schema-dashboard-llm.js
  - api-test.js
  - apps/
backend/
kill-port.js
  - apps/
backend/
legacy/
api-index.js
  - apps/
backend/
scripts/
export-agentic-finetune-jsonl.js
  - apps/
backend/
scripts/
export-schema-training-jsonl.js
  - apps/
backend/
scripts/
install-strict-salary-training-memory.js
  - apps/
backend/
scripts/
train-genai-agentic-domains.js
  - apps/
backend/
scripts/
train-schema-dashboard-llm.js
  - apps/
backend/
scripts/
train-smart-rag-seeds.js
  - apps/
backend/
src/
config/
environment.js
  - apps/
backend/
src/
core/
server.js
  - apps/
backend/
src/
database/
dataset-repository.js
  - apps/
backend/
src/
genai/
analyticsEngine.ts
  - apps/
backend/
src/
genai/
dashboardBuilder.ts
  - apps/
backend/
src/
index.js
  - apps/
backend/
src/
legacy/
routes/
chat.routes.js
  - apps/
backend/
src/
legacy/
runtime/
server.ts
  - apps/
backend/
src/
middleware/
logger.middleware.js
  - apps/
backend/
src/
middleware/
request-logger.js
  - apps/
backend/
src/
routes/
ai.js
  - apps/
backend/
src/
routes/
datasets.js
  - apps/
backend/
src/
routes/
export.js
  - apps/
backend/
src/
services/
agentic/
core/
agent-registry.js
  - apps/
backend/
src/
services/
ai/
ai-manager.js
  - apps/
backend/
src/
services/
ai/
providers/
anthropic-provider.js
  - apps/
backend/
src/
services/
ai/
providers/
gemini-provider.js
  - apps/
backend/
src/
services/
ai/
providers/
ollama-provider.js
  - apps/
backend/
src/
services/
ai/
providers/
openai-provider.js
  - apps/
backend/
src/
services/
ai-analyzer.js
  - apps/
backend/
src/
services/
ai-cascade-service.js
  - apps/
backend/
src/
services/
analytics-service.js
  - apps/
backend/
src/
services/
gemini-ai-service.js
  - apps/
backend/
src/
services/
llama-validation-middleware.js
  - apps/
backend/
src/
services/
local-database-service.js
  - apps/
backend/
src/
services/
ml/
automl-service.js
  - apps/
backend/
src/
services/
ollama-ai-service.js
  - apps/
backend/
src/
services/
ollama-service.js
  - apps/
backend/
src/
services/
query-cache.js
  - apps/
backend/
src/
services/
smart-query-handler.js
  - apps/
backend/
src/
utils/
logger.js
  - apps/
backend/
test-gemini.js
  - apps/
frontend/
src/
components/
GenAIDashboard.tsx
  - apps/
frontend/
src/
features/
data/
api/
dataApi.ts
  - apps/
frontend/
src/
features/
ml/
pages/
MLPage.tsx
  - apps/
frontend/
src/
shared/
lib/
logger.ts
  - apps/
frontend/
vite.config.ts
  - e2e-full-test.js
  - qa-test-script.js
  - scratch_test_ollama.js
  - scratch_test_ollama_real.js
  - scratch_test_service.js
  - scripts/
audit-codebase.js
  - scripts/
export-ai-safe.js
  - scripts/
export-codebase-deep.js
  - scripts/
export-full-codebase-one-file.js

### todo-found
- **Total:** 4 low
- **Affected files (2):**
  - apps/
backend/
src/
routes/
agentic-api.js
  - scripts/
audit-codebase.js

### hardcoded-localhost
- **Total:** 39 medium
- **Affected files (25):**
  - api-test.js
  - apps/
backend/
src/
config/
agentic-models.js
  - apps/
backend/
src/
config/
environment.js
  - apps/
backend/
src/
core/
server.js
  - apps/
backend/
src/
genai/
analyticsEngine.ts
  - apps/
backend/
src/
legacy/
runtime/
server.ts
  - apps/
backend/
src/
routes/
ai.js
  - apps/
backend/
src/
routes/
qr-upload.js
  - apps/
backend/
src/
services/
ai/
insightflowMasterPlanner.ts
  - apps/
backend/
src/
services/
ai/
ollamaClient.js
  - apps/
backend/
src/
services/
ai-analyst/
command-router.js
  - apps/
backend/
src/
services/
ai-providers/
ollama-service.js
  - apps/
backend/
src/
services/
llama-validation-middleware.js
  - apps/
backend/
src/
services/
ml/
ml-client.js
  - apps/
backend/
src/
services/
ml-client.js
  - apps/
backend/
src/
services/
ollama/
ollama-dual-model-service.js
  - apps/
backend/
src/
services/
ollama-ai-service.js
  - apps/
backend/
src/
services/
pdf/
pdf-qa-service.js
  - apps/
backend/
src/
services/
schema-dashboard-engine.js
  - apps/
backend/
src/
services/
schema-only-dashboard-engine.js
  - apps/
frontend/
src/
__tests__/
dataUploadFlow.test.tsx
  - apps/
frontend/
src/
components/
GenAIDashboard.tsx
  - apps/
frontend/
src/
features/
data/
context/
localDataContext.tsx
  - apps/
frontend/
vite.config.ts
  - scripts/
audit-codebase.js

### any-type
- **Total:** 55 medium
- **Affected files (17):**
  - .tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx
  - .tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts
  - apps/
backend/
src/
genai/
analyticsEngine.ts
  - apps/
backend/
src/
services/
agentic/
core/
agent-memory.js
  - apps/
frontend/
src/
api/
schemaAgentApi.ts
  - apps/
frontend/
src/
components/
SchemaTrainingStatus.tsx
  - apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx
  - apps/
frontend/
src/
features/
dashboard/
components/
AgenticThinkingPanel.tsx
  - apps/
frontend/
src/
features/
dashboard/
components/
DataScienceSummaryCards.tsx
  - apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx
  - apps/
frontend/
src/
features/
dashboard/
hooks/
useDashboardAiController.ts
  - apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaRagDashboard.ts
  - apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts
  - apps/
frontend/
src/
features/
dashboard/
pages/
EliteDashboardPage.tsx
  - apps/
frontend/
src/
features/
data/
api/
dataApi.ts
  - apps/
frontend/
src/
features/
data/
api/
schemaAiClient.ts
  - apps/
frontend/
src/
features/
data/
pages/
UploadPage.tsx

## 2. Issues by File

- .tmp_schema_trained_patch/
apps/
backend/
scripts/
export-schema-training-jsonl.js -> medium: 0, low: 2, total: 2
- .tmp_schema_trained_patch/
apps/
backend/
scripts/
train-schema-dashboard-llm.js -> medium: 0, low: 5, total: 5
- .tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx -> medium: 2, low: 0, total: 2
- .tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts -> medium: 1, low: 0, total: 1
- api-test.js -> medium: 1, low: 4, total: 5
- apps/
backend/
kill-port.js -> medium: 0, low: 9, total: 9
- apps/
backend/
legacy/
api-index.js -> medium: 0, low: 9, total: 9
- apps/
backend/
scripts/
export-agentic-finetune-jsonl.js -> medium: 0, low: 2, total: 2
- apps/
backend/
scripts/
export-schema-training-jsonl.js -> medium: 0, low: 2, total: 2
- apps/
backend/
scripts/
install-strict-salary-training-memory.js -> medium: 0, low: 2, total: 2
- apps/
backend/
scripts/
train-genai-agentic-domains.js -> medium: 0, low: 3, total: 3
- apps/
backend/
scripts/
train-schema-dashboard-llm.js -> medium: 0, low: 5, total: 5
- apps/
backend/
scripts/
train-smart-rag-seeds.js -> medium: 0, low: 3, total: 3
- apps/
backend/
src/
config/
agentic-models.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
config/
environment.js -> medium: 2, low: 20, total: 22
- apps/
backend/
src/
core/
server.js -> medium: 2, low: 17, total: 19
- apps/
backend/
src/
database/
dataset-repository.js -> medium: 0, low: 1, total: 1
- apps/
backend/
src/
genai/
analyticsEngine.ts -> medium: 4, low: 4, total: 8
- apps/
backend/
src/
genai/
dashboardBuilder.ts -> medium: 0, low: 12, total: 12
- apps/
backend/
src/
index.js -> medium: 0, low: 1, total: 1
- apps/
backend/
src/
legacy/
routes/
chat.routes.js -> medium: 0, low: 15, total: 15
- apps/
backend/
src/
legacy/
runtime/
server.ts -> medium: 1, low: 2, total: 3
- apps/
backend/
src/
middleware/
logger.middleware.js -> medium: 0, low: 2, total: 2
- apps/
backend/
src/
middleware/
request-logger.js -> medium: 0, low: 13, total: 13
- apps/
backend/
src/
routes/
agentic-api.js -> medium: 0, low: 1, total: 1
- apps/
backend/
src/
routes/
ai.js -> medium: 3, low: 3, total: 6
- apps/
backend/
src/
routes/
datasets.js -> medium: 0, low: 2, total: 2
- apps/
backend/
src/
routes/
export.js -> medium: 0, low: 1, total: 1
- apps/
backend/
src/
routes/
qr-upload.js -> medium: 3, low: 0, total: 3
- apps/
backend/
src/
services/
agentic/
core/
agent-memory.js -> medium: 4, low: 0, total: 4
- apps/
backend/
src/
services/
agentic/
core/
agent-registry.js -> medium: 0, low: 3, total: 3
- apps/
backend/
src/
services/
ai/
ai-manager.js -> medium: 0, low: 14, total: 14
- apps/
backend/
src/
services/
ai/
insightflowMasterPlanner.ts -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
ai/
ollamaClient.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
ai/
providers/
anthropic-provider.js -> medium: 0, low: 6, total: 6
- apps/
backend/
src/
services/
ai/
providers/
gemini-provider.js -> medium: 0, low: 6, total: 6
- apps/
backend/
src/
services/
ai/
providers/
ollama-provider.js -> medium: 0, low: 13, total: 13
- apps/
backend/
src/
services/
ai/
providers/
openai-provider.js -> medium: 0, low: 6, total: 6
- apps/
backend/
src/
services/
ai-analyst/
command-router.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
ai-analyzer.js -> medium: 0, low: 3, total: 3
- apps/
backend/
src/
services/
ai-cascade-service.js -> medium: 0, low: 13, total: 13
- apps/
backend/
src/
services/
ai-providers/
ollama-service.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
analytics-service.js -> medium: 0, low: 13, total: 13
- apps/
backend/
src/
services/
gemini-ai-service.js -> medium: 0, low: 6, total: 6
- apps/
backend/
src/
services/
llama-validation-middleware.js -> medium: 1, low: 19, total: 20
- apps/
backend/
src/
services/
local-database-service.js -> medium: 0, low: 1, total: 1
- apps/
backend/
src/
services/
ml/
automl-service.js -> medium: 0, low: 6, total: 6
- apps/
backend/
src/
services/
ml/
ml-client.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
ml-client.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
ollama/
ollama-dual-model-service.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
ollama-ai-service.js -> medium: 1, low: 2, total: 3
- apps/
backend/
src/
services/
ollama-service.js -> medium: 0, low: 1, total: 1
- apps/
backend/
src/
services/
pdf/
pdf-qa-service.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
query-cache.js -> medium: 0, low: 6, total: 6
- apps/
backend/
src/
services/
schema-dashboard-engine.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
schema-only-dashboard-engine.js -> medium: 1, low: 0, total: 1
- apps/
backend/
src/
services/
smart-query-handler.js -> medium: 0, low: 9, total: 9
- apps/
backend/
src/
utils/
logger.js -> medium: 0, low: 1, total: 1
- apps/
backend/
test-gemini.js -> medium: 0, low: 4, total: 4
- apps/
frontend/
src/
__tests__/
dataUploadFlow.test.tsx -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
api/
schemaAgentApi.ts -> medium: 5, low: 0, total: 5
- apps/
frontend/
src/
components/
GenAIDashboard.tsx -> medium: 2, low: 1, total: 3
- apps/
frontend/
src/
components/
SchemaTrainingStatus.tsx -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx -> medium: 16, low: 0, total: 16
- apps/
frontend/
src/
features/
dashboard/
components/
AgenticThinkingPanel.tsx -> medium: 2, low: 0, total: 2
- apps/
frontend/
src/
features/
dashboard/
components/
DataScienceSummaryCards.tsx -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx -> medium: 3, low: 0, total: 3
- apps/
frontend/
src/
features/
dashboard/
hooks/
useDashboardAiController.ts -> medium: 3, low: 0, total: 3
- apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaRagDashboard.ts -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts -> medium: 3, low: 0, total: 3
- apps/
frontend/
src/
features/
dashboard/
pages/
EliteDashboardPage.tsx -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
features/
data/
api/
dataApi.ts -> medium: 8, low: 1, total: 9
- apps/
frontend/
src/
features/
data/
api/
schemaAiClient.ts -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
features/
data/
context/
localDataContext.tsx -> medium: 4, low: 0, total: 4
- apps/
frontend/
src/
features/
data/
pages/
UploadPage.tsx -> medium: 1, low: 0, total: 1
- apps/
frontend/
src/
features/
ml/
pages/
MLPage.tsx -> medium: 0, low: 4, total: 4
- apps/
frontend/
src/
shared/
lib/
logger.ts -> medium: 0, low: 1, total: 1
- apps/
frontend/
vite.config.ts -> medium: 2, low: 3, total: 5
- e2e-full-test.js -> medium: 0, low: 83, total: 83
- qa-test-script.js -> medium: 0, low: 55, total: 55
- scratch_test_ollama.js -> medium: 0, low: 2, total: 2
- scratch_test_ollama_real.js -> medium: 0, low: 3, total: 3
- scratch_test_service.js -> medium: 0, low: 7, total: 7
- scripts/
audit-codebase.js -> medium: 3, low: 6, total: 9
- scripts/
export-ai-safe.js -> medium: 0, low: 3, total: 3
- scripts/
export-codebase-deep.js -> medium: 0, low: 7, total: 7
- scripts/
export-full-codebase-one-file.js -> medium: 0, low: 3, total: 3

## 3. Top 10 Files by Issue Count

1. **e2e-full-test.js** - 83 issues (0 medium, 83 low)
1. **qa-test-script.js** - 55 issues (0 medium, 55 low)
1. **apps/
backend/
src/
config/
environment.js** - 22 issues (2 medium, 20 low)
1. **apps/
backend/
src/
services/
llama-validation-middleware.js** - 20 issues (1 medium, 19 low)
1. **apps/
backend/
src/
core/
server.js** - 19 issues (2 medium, 17 low)
1. **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx** - 16 issues (16 medium, 0 low)
1. **apps/
backend/
src/
legacy/
routes/
chat.routes.js** - 15 issues (0 medium, 15 low)
1. **apps/
backend/
src/
services/
ai/
ai-manager.js** - 14 issues (0 medium, 14 low)
1. **apps/
backend/
src/
services/
ai/
providers/
ollama-provider.js** - 13 issues (0 medium, 13 low)
1. **apps/
backend/
src/
services/
analytics-service.js** - 13 issues (0 medium, 13 low)

## 4. Medium Severity Details

- **.tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx:8** - any-type
  ```
  onCommand: (command: any) => void;
  ```
- **.tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx:32** - any-type
  ```
  } catch (err: any) {
  ```
- **.tmp_schema_trained_patch/
apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts:27** - any-type
  ```
  } catch (err: any) {
  ```
- **api-test.js:14** - hardcoded-localhost
  ```
  const res = await fetch('http://localhost:3001/api/health');
  ```
- **apps/
backend/
src/
config/
agentic-models.js:10** - hardcoded-localhost
  ```
  'http://localhost:11434';
  ```
- **apps/
backend/
src/
config/
environment.js:53** - hardcoded-localhost
  ```
  host: process.env.HOST || 'localhost',
  ```
- **apps/
backend/
src/
config/
environment.js:59** - hardcoded-localhost
  ```
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ```
- **apps/
backend/
src/
core/
server.js:47** - hardcoded-localhost
  ```
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`...
  ```
- **apps/
backend/
src/
core/
server.js:82** - hardcoded-localhost
  ```
  const host = address.address === '::' ? 'localhost' : address.address;
  ```
- **apps/
backend/
src/
genai/
analyticsEngine.ts:63** - hardcoded-localhost
  ```
  private ollamaUrl: string = "http://localhost:11434";
  ```
- **apps/
backend/
src/
genai/
analyticsEngine.ts:79** - hardcoded-localhost
  ```
  this.ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
genai/
analyticsEngine.ts:134** - any-type
  ```
  } catch (e: any) {
  ```
- **apps/
backend/
src/
genai/
analyticsEngine.ts:159** - any-type
  ```
  const messages: any[] = [];
  ```
- **apps/
backend/
src/
legacy/
runtime/
server.ts:25** - hardcoded-localhost
  ```
  console.log(`ðŸ“Š API Documentation: http://localhost:${PORT}/api/docs`);
  ```
- **apps/
backend/
src/
routes/
ai.js:351** - hardcoded-localhost
  ```
  const host = request.headers.host || 'localhost:3001';
  ```
- **apps/
backend/
src/
routes/
ai.js:353** - hardcoded-localhost
  ```
  if (host === 'localhost:3001') {
  ```
- **apps/
backend/
src/
routes/
ai.js:354** - hardcoded-localhost
  ```
  return `${protocol}://localhost:5173`;
  ```
- **apps/
backend/
src/
routes/
qr-upload.js:66** - hardcoded-localhost
  ```
  const host = request.headers.host || "localhost:3001";
  ```
- **apps/
backend/
src/
routes/
qr-upload.js:68** - hardcoded-localhost
  ```
  if (host === "localhost:3001") {
  ```
- **apps/
backend/
src/
routes/
qr-upload.js:69** - hardcoded-localhost
  ```
  return `${protocol}://localhost:5173`;
  ```
- **apps/
backend/
src/
services/
agentic/
core/
agent-memory.js:58** - any-type
  ```
  /** @type {Map<string, { value: any, writtenAt: number }>} */
  ```
- **apps/
backend/
src/
services/
agentic/
core/
agent-memory.js:142** - any-type
  ```
  *   async get(key): any
  ```
- **apps/
backend/
src/
services/
agentic/
core/
agent-memory.js:193** - any-type
  ```
  /** @type {Map<string, { schema: object, plan: any, hitCount: number }>} */
  ```
- **apps/
backend/
src/
services/
agentic/
core/
agent-memory.js:231** - any-type
  ```
  * @returns {{ match: object, plan: any, similarity: number } | null}
  ```
- **apps/
backend/
src/
services/
ai/
insightflowMasterPlanner.ts:102** - hardcoded-localhost
  ```
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
ai/
ollamaClient.js:2** - hardcoded-localhost
  ```
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
ai-analyst/
command-router.js:49** - hardcoded-localhost
  ```
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
ai-providers/
ollama-service.js:6** - hardcoded-localhost
  ```
  this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  ```
- **apps/
backend/
src/
services/
llama-validation-middleware.js:9** - hardcoded-localhost
  ```
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
ml/
ml-client.js:2** - hardcoded-localhost
  ```
  const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  ```
- **apps/
backend/
src/
services/
ml-client.js:4** - hardcoded-localhost
  ```
  const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  ```
- **apps/
backend/
src/
services/
ollama/
ollama-dual-model-service.js:1** - hardcoded-localhost
  ```
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  ```
- **apps/
backend/
src/
services/
ollama-ai-service.js:8** - hardcoded-localhost
  ```
  const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
pdf/
pdf-qa-service.js:45** - hardcoded-localhost
  ```
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
schema-dashboard-engine.js:280** - hardcoded-localhost
  ```
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
backend/
src/
services/
schema-only-dashboard-engine.js:178** - hardcoded-localhost
  ```
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  ```
- **apps/
frontend/
src/
api/
schemaAgentApi.ts:3** - any-type
  ```
  profile: any;
  ```
- **apps/
frontend/
src/
api/
schemaAgentApi.ts:4** - any-type
  ```
  dashboardSpec: any;
  ```
- **apps/
frontend/
src/
api/
schemaAgentApi.ts:5** - any-type
  ```
  agentPlan?: any;
  ```
- **apps/
frontend/
src/
api/
schemaAgentApi.ts:23** - any-type
  ```
  calculatedDashboard?: any;
  ```
- **apps/
frontend/
src/
api/
schemaAgentApi.ts:62** - any-type
  ```
  return requestJson<{ ok: boolean; stats: any }>(
  ```
- **apps/
frontend/
src/
components/
GenAIDashboard.tsx:93** - hardcoded-localhost
  ```
  const response = await axios.post("http://localhost:3000/api/genai/dashboard/cre...
  ```
- **apps/
frontend/
src/
components/
GenAIDashboard.tsx:116** - hardcoded-localhost
  ```
  const response = await axios.post("http://localhost:3000/api/genai/query", {
  ```
- **apps/
frontend/
src/
components/
SchemaTrainingStatus.tsx:4** - any-type
  ```
  result?: any;
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:138** - any-type
  ```
  } catch (err: any) {
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:164** - any-type
  ```
  } catch (err: any) {
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:188** - any-type
  ```
  } catch (err: any) {
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:208** - any-type
  ```
  } catch (err: any) {
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:231** - any-type
  ```
  const safeArray = (arr: any) => (Array.isArray(arr) ? arr : []);
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:232** - any-type
  ```
  const safeText = (txt: any, fallback = "-") => (typeof txt === "string" || typeo...
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:588** - any-type
  ```
  {safeArray(analysisResult.audit).map((step: any, idx: number) => (
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:673** - any-type
  ```
  {safeArray(analysisResult.dashboard.warnings).map((warning: any, idx: number) =>...
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:756** - any-type
  ```
  {safeArray(analysisResult.dashboard?.kpis).map((kpi: any, idx: number) => {
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:770** - any-type
  ```
  analysisResult.profile?.columns?.find((c: any) => c.name === kpi.field)?.stats?....
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:771** - any-type
  ```
  ? Math.round(analysisResult.profile.columns.find((c: any) => c.name === kpi.fiel...
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:796** - any-type
  ```
  {safeArray(analysisResult.dashboard?.charts).map((chart: any, idx: number) => (
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:833** - any-type
  ```
  {safeArray(analysisResult.schemaAnalysis?.risks).map((risk: any, idx: number) =>...
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:878** - any-type
  ```
  {safeArray(dataset.columns).map((col: any, idx: number) => {
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:1280** - any-type
  ```
  {safeArray(simResult.dashboardPlan?.kpis || simResult.dashboard?.kpis).map((kpi:...
  ```
- **apps/
frontend/
src/
features/
analytics/
pages/
AgenticPage.tsx:1296** - any-type
  ```
  {safeArray(simResult.dashboardPlan?.charts || simResult.dashboard?.charts).map((...
  ```
- **apps/
frontend/
src/
features/
dashboard/
components/
AgenticThinkingPanel.tsx:7** - any-type
  ```
  agentPlan?: any;
  ```
- **apps/
frontend/
src/
features/
dashboard/
components/
AgenticThinkingPanel.tsx:20** - any-type
  ```
  dashboardSpec?: any;
  ```
- **apps/
frontend/
src/
features/
dashboard/
components/
DataScienceSummaryCards.tsx:13** - any-type
  ```
  export function DataScienceSummaryCards({ profile, anomalies, correlations, mode...
  ```
- **apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx:20** - any-type
  ```
  rows?: any[];
  ```
- **apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx:21** - any-type
  ```
  columns?: any[];
  ```
- **apps/
frontend/
src/
features/
dashboard/
components/
SchemaDashboardChat.tsx:28** - any-type
  ```
  onCommand: (command: any) => void;
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useDashboardAiController.ts:242** - any-type
  ```
  const result: any = await schemaAiClient.understandDatasetSchema(payload.id || "...
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useDashboardAiController.ts:254** - any-type
  ```
  const result: any = await schemaAiClient.generateSmartRagDashboard(payload.id ||...
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useDashboardAiController.ts:285** - any-type
  ```
  const result: any = await schemaAiClient.trainSmartRagDashboard(payload.id || "l...
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaRagDashboard.ts:29** - any-type
  ```
  function unwrapResponse(response: any) {
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts:397** - any-type
  ```
  function getPlanFromResponse(response: any) {
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts:447** - any-type
  ```
  (plan: any, source = "unknown") => {
  ```
- **apps/
frontend/
src/
features/
dashboard/
hooks/
useSchemaTrainedDashboard.ts:561** - any-type
  ```
  (command: any) => {
  ```
- **apps/
frontend/
src/
features/
dashboard/
pages/
EliteDashboardPage.tsx:512** - any-type
  ```
  function applyAiDashboardCommand(command: any) {
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:147** - any-type
  ```
  rows: any[];
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:148** - any-type
  ```
  dataDictionary?: any[];
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:155** - any-type
  ```
  currentDashboard?: any;
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:159** - any-type
  ```
  currentDashboard?: any;
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:164** - any-type
  ```
  schemaProfile?: any;
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:165** - any-type
  ```
  aiPlan?: any;
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:166** - any-type
  ```
  dashboard?: any;
  ```
- **apps/
frontend/
src/
features/
data/
api/
dataApi.ts:170** - any-type
  ```
  correctedDashboard?: any;
  ```
- **apps/
frontend/
src/
features/
data/
api/
schemaAiClient.ts:54** - any-type
  ```
  let payload: any = null;
  ```
- **apps/
frontend/
src/
features/
data/
context/
localDataContext.tsx:56** - hardcoded-localhost
  ```
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://loc...
  ```
- **apps/
frontend/
src/
features/
data/
context/
localDataContext.tsx:98** - hardcoded-localhost
  ```
  const aiResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://l...
  ```
- **apps/
frontend/
src/
features/
data/
context/
localDataContext.tsx:117** - hardcoded-localhost
  ```
  const queryResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http:...
  ```
- **apps/
frontend/
src/
features/
data/
context/
localDataContext.tsx:164** - hardcoded-localhost
  ```
  `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/datasets/${...
  ```
- **apps/
frontend/
src/
features/
data/
pages/
UploadPage.tsx:543** - any-type
  ```
  {(activeDataset.columns || []).slice(0, 16).map((column: any) => (
  ```
- **apps/
frontend/
src/
__tests__/
dataUploadFlow.test.tsx:30** - hardcoded-localhost
  ```
  uploadUrl: "http://localhost/mobile-upload/qr-1",
  ```
- **apps/
frontend/
vite.config.ts:22** - hardcoded-localhost
  ```
  target: "http://localhost:3001",
  ```
- **apps/
frontend/
vite.config.ts:39** - hardcoded-localhost
  ```
  target: "http://localhost:5000",
  ```
- **scripts/
audit-codebase.js:42** - hardcoded-localhost
  ```
  id: "hardcoded-localhost",
  ```
- **scripts/
audit-codebase.js:44** - hardcoded-localhost
  ```
  test: line => line.includes("localhost"),
  ```
- **scripts/
audit-codebase.js:45** - hardcoded-localhost
  ```
  message: "Hardcoded localhost found. Use environment variables."
  ```

## 5. Low Severity Summary (by Rule)

- **console-log:** 447
- **todo-found:** 4

---
*Report generated from code-audit-report.json*
