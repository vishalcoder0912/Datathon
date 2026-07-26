# 🤖 AI Agentic Schema-Based Data Analytics Refactoring Plan

**Status**: Comprehensive Analysis & Implementation Blueprint
**Version**: 2.0
**Last Updated**: June 2, 2026

---

## Executive Summary

Your codebase has foundational agentic capabilities scattered across multiple services and routes.
This document consolidates them into a **unified, enterprise-grade AI Agentic Schema-Based Data Analytics Framework**.

### Current State
- ✅ Schema detection systems exist
- ✅ Multiple AI providers configured (Ollama, Gemini, OpenAI, Claude)
- ✅ Route handlers for agentic models and schema agents
- ⚠️ **Critical Gap**: No unified agentic orchestration layer
- ⚠️ **Critical Gap**: Schema-based agents operate independently
- ⚠️ **Critical Gap**: No multi-agent collaboration framework
- ⚠️ **Critical Gap**: Deterministic analytics not fully integrated with agentic reasoning

### Target State
A **multi-layered agentic schema framework** where:
1. **Schema Agent** extracts & understands data structure
2. **Analytics Agent** plans insights & metrics
3. **Tool Router Agent** selects optimal analysis methods
4. **Critic Agent** validates dashboard decisions
5. **Orchestrator Agent** coordinates multi-agent workflow
6. **Memory Agent** learns from patterns across datasets

---

## Part 1: Current Architecture Analysis

### 1.1 Existing Agentic Components

```
BACKEND STRUCTURE:
├── routes/
│   ├── agentic-models.js          ← Model config & health
│   ├── agentic-data-science.js    ← Python ML gateway
│   ├── schema-agent.js            ← Schema profiling & dashboard spec
│   └── schema-trained-ai.routes.js ← Schema-aware chat/analysis
│
├── services/
│   ├── agentic/
│   │   ├── ollama-agent-router.js
│   │   ├── analytics-agent-planner.js
│   │   ├── analytics-tool-router.js
│   │   ├── analytics-critic-agent.js
│   │   └── chief-analyst-orchestrator.js  ← Multi-agent coordinator
│   │
│   ├── schema-*
│   │   ├── schema-detector.js (59 KB - core schema analysis)
│   │   ├── schema-ai-service.js
│   │   ├── schema-dashboard-engine.js
│   │   ├── schema-packet-builder.js
│   │   └── schema-agent/ (subdirectory with profiler, planner, etc)
│   │
│   └── Other Services:
│       ├── analytics-service.js (33 KB - traditional analytics)
│       ├── analytics-brain-service.js (26 KB - insights)
│       └── dashboard-ai-agent.js (11 KB - AI dashboard planning)
│
└── config/
    ├── agentic-models.js  ← Model definitions
    └── environment.js     ← AI provider config
```

### 1.2 Problems Identified

| Problem | Impact | Priority |
|---------|--------|----------|
| No unified schema-agentic pipeline | Each component works in isolation | 🔴 CRITICAL |
| Duplicate schema processing logic | Code redundancy, maintenance overhead | 🟠 HIGH |
| AI providers not agent-aware | Can't adapt models based on task | 🟠 HIGH |
| No agentic reasoning memory | Agents don't learn across requests | 🟠 HIGH |
| Schema ↔ Analytics coupling loose | Hard to trace agentic reasoning | 🟠 HIGH |
| Frontend doesn't show agentic flow | Users see black boxes | 🟡 MEDIUM |
| No agent performance metrics | Can't measure agent effectiveness | 🟡 MEDIUM |
| Tools hardcoded, not dynamic | New analysis types require code changes | 🟡 MEDIUM |

---

## Part 2: Unified Agentic Schema Framework Architecture

### 2.1 Core Framework Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INSIGHTFLOW AGENTIC SYSTEM                        │
└──────────────────────────────────────────────────────────────────────┘

LAYER 1: DATA INGESTION & SCHEMA DETECTION
┌──────────────────────────────────────────┐
│  Dataset Upload  →  Schema Detector Agent │  ← Identifies structure
│  (CSV/Excel/PDF)    (Profiling + Types)   │
└──────────────────────────────────────────┘

LAYER 2: SCHEMA NORMALIZATION & MEMORY
┌──────────────────────────────────────────┐
│  Schema Normalizer  ↔  Semantic Memory   │  ← Learns similar schemas
│  (Consolidate, Standardize, Index)       │
└──────────────────────────────────────────┘

LAYER 3: MULTI-AGENT ORCHESTRATION
┌────────────────────────────────────────────────────────────────────┐
│                   Chief Analyst Orchestrator                       │
│       (Coordinates agents, routes decisions, aggregates results)   │
├────────────────────────────────────────────────────────────────────┤
│  ANALYTICS  │  SCHEMA    │  TOOL     │  CRITIC   │  EXECUTION     │
│  AGENT      │  VALIDATOR │  ROUTER   │  AGENT    │  AGENT         │
│  (Plan      │  (Ensures  │  (Selects │ (Validates│  (Computes     │
│  metrics &  │  valid     │  methods) │  quality) │   analytics)   │
│  insights)  │  schema)   │           │           │                │
└────────────────────────────────────────────────────────────────────┘

LAYER 4: DETERMINISTIC ANALYTICS ENGINE
┌──────────────────────────────────────────┐
│  Query Planner  ← Agentic Plans          │
│  ├─ Correlations                         │
│  ├─ Anomalies                            │
│  ├─ Predictions                          │
│  ├─ Segmentation                         │
│  └─ Recommendations                     │
└──────────────────────────────────────────┘

LAYER 5: AI PROVIDER ADAPTER (Agent-Aware)
┌──────────────────────────────────────────┐
│  Provider Selector (Task→Model Mapping)  │
│  ├─ Ollama   (Local reasoning)           │
│  ├─ Gemini   (Complex analysis)          │
│  ├─ GPT-4    (Creative insights)         │
│  └─ Claude   (Validation & critique)    │
└──────────────────────────────────────────┘

LAYER 6: RESPONSE FORMATTER & FRONTEND API
┌──────────────────────────────────────────┐
│  Agentic Flow Visualizer                 │
│  (Exposes agent thinking to frontend)    │
└──────────────────────────────────────────┘
```

### 2.2 Agent Responsibilities (RACI)

| Agent | Role | Input | Output | Reasoning |
|-------|------|-------|--------|-----------|
| **Schema** | Understand data structure | Rows + metadata | Normalized schema profile | Detects types, cardinality, domain |
| **Analytics** | Plan what to compute | Schema profile | Metric/insight plan | Determines relevant calculations |
| **Tool Router** | Select algorithms | Analytics plan | Prioritized tools list | Matches plan to available tools |
| **Execution** | Run computations | Tools + data | Raw results | Deterministic algorithms |
| **Critic** | Quality assurance | Results + goals | Critique report | Validates against schema goals |
| **Orchestrator** | Coordinate all | User goal | Final dashboard | Routes, aggregates, decides |

---

## Part 3: File Structure & Code Organization

### 3.1 Proposed Reorganization

```
apps/backend/src/
├── services/
│   ├── agentic/
│   │   ├── core/
│   │   │   ├── agentic-framework.js          ⭐ NEW: Core agent base class
│   │   │   ├── agent-registry.js             ⭐ NEW: Agent lifecycle manager
│   │   │   ├── agent-message-bus.js          ⭐ NEW: Inter-agent communication
│   │   │   ├── agent-memory.js               ⭐ NEW: Unified memory layer
│   │   │   └── agent-execution-context.js    ⭐ NEW: Execution state management
│   │   │
│   │   ├── agents/
│   │   │   ├── schema-agent.js               ✏️ REFACTOR: Unified schema understanding
│   │   │   ├── analytics-planner-agent.js    ✏️ REFACTOR: Insight planning
│   │   │   ├── tool-router-agent.js          ✏️ REFACTOR: Method selection
│   │   │   ├── execution-agent.js            ⭐ NEW: Unified computation runner
│   │   │   ├── critic-agent.js               ✏️ REFACTOR: Quality validation
│   │   │   └── orchestrator-agent.js         ✏️ REFACTOR: Multi-agent coordinator
│   │   │
│   │   ├── tools/
│   │   │   ├── tool-registry.js              ⭐ NEW: Dynamic tool catalog
│   │   │   ├── tool-descriptor.js            ⭐ NEW: Tool metadata/capabilities
│   │   │   ├── tool-executor.js              ⭐ NEW: Generic tool runner
│   │   │   └── builtin-tools/
│   │   │       ├── correlation-tool.js
│   │   │       ├── anomaly-tool.js
│   │   │       ├── segmentation-tool.js
│   │   │       ├── prediction-tool.js
│   │   │       └── recommendation-tool.js
│   │   │
│   │   ├── ai-providers/
│   │   │   ├── agent-aware-provider.js       ⭐ NEW: Base provider class
│   │   │   ├── ollama-agent.js
│   │   │   ├── gemini-agent.js
│   │   │   ├── openai-agent.js
│   │   │   ├── claude-agent.js
│   │   │   └── provider-selector.js          ⭐ NEW: Smart provider routing
│   │   │
│   │   ├── workflows/
│   │   │   ├── standard-analysis-workflow.js ⭐ NEW: Default flow
│   │   │   ├── custom-goal-workflow.js        ⭐ NEW: User-directed flow
│   │   │   └── experimental-workflow.js       ⭐ NEW: AB-testing flow
│   │   │
│   │   └── monitoring/
│   │       ├── agent-metrics.js              ⭐ NEW: Agent performance tracking
│   │       ├── agent-audit-log.js            ⭐ NEW: Agent decision logging
│   │       └── agent-debugger.js             ⭐ NEW: Agentic flow visualization
│   │
│   ├── schema/
│   │   ├── schema-detector.js               ✏️ CONSOLIDATE: Keep as-is (core detection)
│   │   ├── schema-normalizer.js             ⭐ NEW: Standardize schemas
│   │   ├── schema-validator.js              ⭐ NEW: Quality checks
│   │   ├── schema-memory.js                 ⭐ NEW: Semantic similarity matching
│   │   └── domain-models/
│   │       ├── ecommerce-domain.js
│   │       ├── financial-domain.js
│   │       ├── healthcare-domain.js
│   │       └── custom-domain.js
│   │
│   ├── analytics/
│   │   ├── analytics-executor.js            ⭐ NEW: Unified execution wrapper
│   │   └── deterministic-engine.js          ✏️ REFACTOR: Core computation logic
│   │
│   └── (existing services keep supporting roles)
│
├── routes/
│   ├── agentic-api.js                       ⭐ NEW: Main agentic endpoint
│   ├── agentic-models.js                    ✏️ REFACTOR: Keep for model config
│   ├── agentic-debug.js                     ⭐ NEW: Debugging/visualization
│   └── (existing routes adjusted for agentic)
│
├── config/
│   ├── agents.js                            ⭐ NEW: Agent lifecycle config
│   ├── tools.js                             ⭐ NEW: Tool registry config
│   ├── workflows.js                         ⭐ NEW: Workflow definitions
│   ├── agentic-models.js                    ✏️ EXISTING
│   └── (existing configs)
│
└── __tests__/
    └── agentic/
        ├── agents.test.js
        ├── tools.test.js
        ├── workflows.test.js
        └── integration.test.js
```

### 3.2 Key Classes & Interfaces

```typescript
// Core Agentic Framework

abstract class Agent {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: string[];
  memory: AgentMemory;

  abstract async process(context: ExecutionContext): Promise<AgentResult>;
  async communicate(target: Agent, message: AgentMessage): void;
  async updateMemory(key: string, value: any): void;
}

interface ExecutionContext {
  datasetId: string;
  schema: SchemaProfile;
  rows: Row[];
  goal: string;
  agentTrail: AgentStep[];  // Track which agents ran & decisions
  parentContext?: ExecutionContext;
}

interface AgentResult {
  agent: string;
  status: 'success' | 'partial' | 'error';
  output: any;
  reasoning: string;
  metrics: { latency: number; tokens?: number; };
  nextAgents?: Agent[];  // Recommend next agents to run
}

interface SchemaProfile {
  id: string;
  columns: ColumnProfile[];
  rowCount: number;
  domain: DomainClassification;
  qualityScore: number;
  suggestedMetrics: string[];
}

interface ColumnProfile {
  name: string;
  type: DataType;
  cardinality: number;
  nullCount: number;
  role: ColumnRole;  // dimension, measure, key, time, text
  domain: string;   // sales, customer, product, etc.
}

class ToolRegistry {
  static tools: Map<string, ToolDescriptor>;
  static register(tool: ToolDescriptor): void;
  static findTools(criteria: ToolSearchCriteria): ToolDescriptor[];
}

interface ToolDescriptor {
  id: string;
  name: string;
  category: 'statistical' | 'ml' | 'text' | 'time_series';
  requires: ColumnRole[];
  produces: MetricType[];
  implementation: (data: any, config: any) => Promise<any>;
  costEstimate: (rowCount: number) => number;
  agentPreference?: string[];  // Which agents prefer this tool
}
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2) 🏗️
**Goal**: Build core agentic infrastructure

**Create Agentic Framework Core**
- [ ] `agentic-framework.js` - Base Agent class
- [ ] `agent-registry.js` - Lifecycle management
- [ ] `agent-message-bus.js` - Inter-agent communication
- [ ] `agent-memory.js` - Unified memory (Redis-backed)
- [ ] `agent-execution-context.js` - State management
- [ ] Unit tests for each

**Extract & Consolidate Schema Logic**
- [ ] Create `schema-normalizer.js` (from schema-detector)
- [ ] Create `schema-validator.js` (quality checks)
- [ ] Create `schema-memory.js` (similarity matching)
- [ ] Refactor existing schema-detector to use normalizer
- [ ] Integration tests

**Deliverable**: Core framework can create agents, agents communicate via message bus, schema pipeline is unified.

---

### Phase 2: Agent Implementation (Weeks 3-4) 🤖
**Goal**: Refactor existing agents to new framework

**Refactor Existing Agents**
- [ ] `schema-agent.js` - Extends Agent base class
- [ ] `analytics-planner-agent.js` - Extends Agent
- [ ] `tool-router-agent.js` - Extends Agent
- [ ] `critic-agent.js` - Extends Agent
- [ ] `orchestrator-agent.js` - Extends Agent

**Create New Agents**
- [ ] `execution-agent.js` - Unified computation runner
- [ ] `schema-validator-agent.js` - Quality assurance

**Tool System**
- [ ] `tool-registry.js` - Catalog all tools
- [ ] `tool-descriptor.js` - Metadata for each tool
- [ ] `tool-executor.js` - Generic runner
- [ ] Register existing analytics tools

**Deliverable**: All agents work in new framework, tools are discoverable, agents can route work via tools.

---

### Phase 3: Provider Integration (Week 5) 🧠
**Goal**: Make AI providers agent-aware

**Provider Abstraction**
- [ ] `agent-aware-provider.js` - Base class
- [ ] `ollama-agent.js` - Ollama as agent
- [ ] `gemini-agent.js` - Gemini as agent
- [ ] `openai-agent.js` - GPT-4 as agent
- [ ] `claude-agent.js` - Claude as agent

**Smart Routing**
- [ ] `provider-selector.js` - Task → Provider mapping
- [ ] Provider performance metrics
- [ ] Fallback logic

**Deliverable**: Each provider is an agent, framework can select best provider per task, providers report reasoning/tokens.

---

### Phase 4: Workflows & Orchestration (Weeks 6-7) 🔄
**Goal**: Define standard and custom workflows

**Workflow Engine**
- [ ] `standard-analysis-workflow.js` - Default flow
- [ ] `custom-goal-workflow.js` - User-directed
- [ ] `experimental-workflow.js` - AB-testing

**Orchestrator Enhancement**
- [ ] Multi-agent coordination
- [ ] Parallel execution where possible
- [ ] Error recovery & fallbacks
- [ ] Decision logging (audit trail)

**Deliverable**: Standard analysis flow works end-to-end, custom goals supported, all agent decisions logged.

---

### Phase 5: Monitoring & Frontend (Weeks 8-9) 📊
**Goal**: Visibility into agentic reasoning

**Monitoring Infrastructure**
- [ ] `agent-metrics.js` - Performance tracking
- [ ] `agent-audit-log.js` - Decision logging
- [ ] `agent-debugger.js` - Flow visualization

**New Endpoints**
- [ ] `POST /api/agentic/analyze-with-reasoning` - Full agentic flow
- [ ] `GET /api/agentic/debug/:requestId` - View agent trace
- [ ] `GET /api/agentic/metrics` - Agent performance stats

**Frontend Enhancement**
- [ ] Agentic flow panel
- [ ] Agent decision tree visualization
- [ ] Reasoning explanations

**Deliverable**: Users see what agents did, developers can debug agentic reasoning, performance metrics available.

---

### Phase 6: Production Hardening (Weeks 10-11) ⚡
**Goal**: Ready for production deployment

**Performance Optimization**
- [ ] Agent caching (semantic duplicates)
- [ ] Parallel agent execution
- [ ] Tool batching

**Resilience**
- [ ] Circuit breakers for AI calls
- [ ] Graceful degradation
- [ ] Comprehensive error handling

**Documentation**
- [ ] Agent developer guide
- [ ] Tool creation guide
- [ ] Workflow authoring guide
- [ ] API documentation

**Deliverable**: Framework production-ready, documented & tested, performance benchmarked.

---

## Part 5: Key Implementation Files

### 5.1 Core Framework
**File**: `apps/backend/src/services/agentic/core/agentic-framework.js`

See the generated file at that path for the full implementation. Key exports:
- `Agent` — Abstract base class all agents extend
- `ExecutionContext` — Immutable state passed through the pipeline
- `AgentResult` — Standardized response envelope
- `AGENT_ROLES` — Enum of valid role identifiers

### 5.2 Agent Registry
**File**: `apps/backend/src/services/agentic/core/agent-registry.js`

Manages agent lifecycle and discovery. Key methods:
- `register(agent)` — Add an agent to the global registry
- `getAgent(id)` — Look up by ID
- `getAgentsByRole(role)` — Find all agents with a given role
- `listAgents()` — Enumerate all agents with capabilities summary

### 5.3 Schema Normalizer
**File**: `apps/backend/src/services/schema/schema-normalizer.js`

Standardizes raw datasets into unified `SchemaProfile` objects. Key methods:
- `normalize(rows, metadata)` — Full pipeline: detect → classify → score → suggest
- `detectDomain(profile)` — Classify as ecommerce, finance, healthcare, etc.
- `inferColumnRole(column, profile)` — Assign key/time/measure/dimension
- `calculateQualityScore(columns, rows)` — 0-100 quality score
- `suggestMetrics(columns)` — Top-10 recommended metrics

---

## Part 6: Integration Points

### 6.1 New Main Endpoint

**`POST /api/agentic/analyze`**

```json
// Request
{
  "datasetId": "dataset-123",
  "goal": "Find revenue trends and top customers",
  "options": {
    "includeReasoning": true,
    "maxAgents": 5,
    "preferredProviders": ["ollama", "gemini"]
  }
}

// Response
{
  "ok": true,
  "requestId": "req-abc123",
  "dashboard": {
    "title": "Revenue & Customer Analysis",
    "cards": [
      {
        "id": "card-1",
        "metric": "Total Revenue",
        "value": "$1.5M",
        "trend": "+12%",
        "agentId": "analytics-planner",
        "reasoning": "Summed all transactions, calculated YoY growth"
      }
    ]
  },
  "agenticFlow": {
    "requestId": "req-abc123",
    "stages": [
      {
        "stage": 1,
        "agent": "schema-analyzer",
        "decision": "Detected ecommerce domain with customer + transaction structure",
        "latency": 245,
        "output": { "domain": "ecommerce", "columns": ["..."] }
      },
      {
        "stage": 2,
        "agent": "analytics-planner",
        "decision": "Planned 5 metrics: revenue, customers, avg_order_value, growth, top_customers",
        "latency": 523,
        "output": { "plan": ["..."] }
      }
    ],
    "totalLatency": 2341,
    "tokensUsed": 1453
  }
}
```

### 6.2 Frontend Integration

```tsx
// Frontend component to visualize agentic flow
<AgenticFlowVisualization
  requestId={result.requestId}
  stages={result.agenticFlow.stages}
  totalLatency={result.agenticFlow.totalLatency}
/>
```

---

## Part 7: Configuration Files

See generated config files:
- `apps/backend/src/config/agents.js` — All agent definitions with timeouts, retries, capabilities
- `apps/backend/src/config/tools.js` — Built-in tool catalog with cost estimates
- `apps/backend/src/config/workflows.js` — Workflow definitions for standard/custom/experimental flows

---

## Part 8: Testing Strategy

### 8.1 Unit Tests
**File**: `apps/backend/src/__tests__/agentic/agents.test.js`

Covers:
- Agent construction and property validation
- Metric recording
- Execution context trail immutability

### 8.2 Integration Tests
**File**: `apps/backend/src/__tests__/agentic/integration.test.js`

Covers:
- Full analysis workflow execution
- Agent failure graceful handling
- Audit trail completeness

---

## Part 9: Migration Guide

### 9.1 Backward Compatibility

All existing endpoints remain functional:
- ✅ `/api/datasets/:id/chat` — Wraps schema-trained-ai agent
- ✅ `/api/datasets/:id/analyze` — Wraps analytics service
- ✅ `/api/schema-agent/datasets/:id/train-schema` — Still works
- ✅ `/api/agentic-models/datasets/:id/analyze` — Still works

### 9.2 Gradual Migration Path

| Week | Action |
|------|--------|
| 1-2  | New agents run in parallel with old code (feature-flag) |
| 3-4  | Gradually route traffic to new agents |
| 5-6  | Phase out old implementations |
| 7+   | Fully agentic system |

---

## Part 10: Success Metrics

### 10.1 Quantitative

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Agent cohesion | Low (isolated) | High (orchestrated) | Week 4 |
| Reasoning explainability | 0% requests | 100% requests | Week 8 |
| Dashboard generation latency | 2-3s | 1-2s (with caching) | Week 9 |
| Schema reuse rate | ~20% | 60%+ | Week 6 |
| Agent success rate | N/A | 95%+ | Week 7 |
| New metric discovery | Manual | Automatic via agents | Week 5 |

### 10.2 Qualitative

- ✅ Code maintainability improved
- ✅ Agent reasoning transparent to users
- ✅ Easy to add new agents/tools
- ✅ Easy to understand agentic decisions
- ✅ Easy to debug failures

---

## Part 11: Common Pitfalls & Solutions

| Pitfall | Solution |
|---------|---------|
| Agents timeout on large datasets | Streaming results, lazy evaluation, chunking |
| Agents make redundant decisions | Cross-agent memory, result caching |
| LLM-based agents hallucinate metrics | Critic agent validation, deterministic checks |
| Coordination overhead too high | Parallel execution, tool batching, memoization |
| Hard to trace failures | Comprehensive logging, execution context propagation |
| Performance degradation under load | Agent pooling, request queuing, circuit breakers |

---

## Part 12: Conclusion & Next Steps

### Your Project Has:
- ✅ Strong schema detection foundation
- ✅ Multiple AI providers configured
- ✅ Scattered agentic capabilities

### You Need:
1. **Unified orchestration** — Connect agents properly
2. **Tool registry** — Make tools discoverable
3. **Memory layer** — Agents learn across requests
4. **Frontend visibility** — Show reasoning to users
5. **Monitoring** — Track agent performance

### Recommended Order:
1. Start with **Phase 1** (Framework core) — 2 weeks
2. Then **Phase 2** (Refactor agents) — 2 weeks
3. Then **Phase 3** (Provider integration) — 1 week
4. Iterate with phases 4–6 based on feedback

### Success Criteria:
- ✅ `/api/agentic/analyze` endpoint works end-to-end
- ✅ Agent reasoning visible in responses
- ✅ All existing endpoints still work
- ✅ Performance doesn't degrade
- ✅ New agents can be added without core changes
