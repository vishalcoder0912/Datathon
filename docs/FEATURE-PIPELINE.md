# InsightFlow Feature Development Pipeline

Every feature in InsightFlow goes through a **10-agent sequential pipeline**. Each agent reviews the previous agent's work before the next agent proceeds. No implementation starts until the previous review passes.

## Pipeline Diagram

```
┌──────────────┐
│  Research    │ ◄── investigates requirements, codebase, constraints
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Architect   │ ◄── designs solution architecture, API contracts
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Backend     │ ◄── implements API routes, services, middleware
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Frontend    │ ◄── implements components, pages, state management
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Database    │ ◄── migrations, indexes, schema, seed data
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Security    │ ◄── threat model, auth, input validation, data protection
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Performance │ ◄── query analysis, caching, bundle size, bottlenecks
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  QA          │ ◄── unit, integration, E2E, accessibility, load tests
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Reviewer    │ ◄── final code review, quality gate, sign-off
└──────┬───────┘
       │ reviews ▼
┌──────────────┐
│  Documen-    │ ◄── API docs, changelog, env vars, usage guides
│  tation      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  COMPLETE    │
└──────────────┘
```

## Agent Definitions

All agents are defined in `.opencode/agents/insightflow-pipeline__*.md`:

| # | Agent | Agent File | Produces |
|---|-------|-----------|----------|
| 01 | Research | `insightflow-pipeline__01-research-agent.md` | Research Brief |
| 02 | Architect | `insightflow-pipeline__02-architect-agent.md` | Architecture Design |
| 03 | Backend | `insightflow-pipeline__03-backend-agent.md` | Backend Implementation |
| 04 | Frontend | `insightflow-pipeline__04-frontend-agent.md` | Frontend Implementation |
| 05 | Database | `insightflow-pipeline__05-database-agent.md` | Database Changes |
| 06 | Security | `insightflow-pipeline__06-security-agent.md` | Security Audit |
| 07 | Performance | `insightflow-pipeline__07-performance-agent.md` | Performance Audit |
| 08 | QA | `insightflow-pipeline__08-qa-agent.md` | QA Report |
| 09 | Reviewer | `insightflow-pipeline__09-reviewer-agent.md` | Final Review / Sign-off |
| 10 | Documentation | `insightflow-pipeline__10-documentation-agent.md` | Documentation |

## Pipeline Artifacts

Each agent writes its output to `docs/pipeline/`:

```
docs/pipeline/
├── 01-research-brief.md
├── 02-architecture-design.md
├── 03-backend-implementation.md
├── 04-frontend-implementation.md
├── 05-database-implementation.md
├── 06-security-audit.md
├── 07-performance-audit.md
├── 08-qa-report.md
├── 09-final-review.md
└── 10-documentation.md
```

## How to Run

### Start a new feature

```
pipeline "Add AI-powered data visualization dashboard with real-time query suggestions"
```

This triggers the 10-agent pipeline sequentially.

### Resume from a specific stage

```
pipeline "Add data visualization dashboard" --resume-from 05
```

This resumes at the Database Agent, loading existing artifacts from `docs/pipeline/` for context.

### Run up to a stage and pause

```
pipeline "Add data visualization dashboard" --stage qa
```

This runs through the QA Agent, then pauses for manual intervention.

## Rejection Flow

1. Agent N+1 reviews Agent N's output
2. If rejected, produce a list of specific issues with file paths and line numbers
3. Return to Agent N with the rejection context
4. Agent N produces a revised output
5. Agent N+1 re-reviews
6. Pipeline continues when Agent N+1 approves

## Rules

| Rule | Description |
|------|-------------|
| **No skipping** | Every agent runs in order. Every review must pass. |
| **No implementation without architecture** | Backend Agent must not write code until Architect's design is approved. |
| **No merge without final review** | Pipeline produces a sign-off artifact before code is merge-ready. |
| **Specific rejections only** | Rejections must list every issue with file paths and line numbers. |
| **Revised artifacts overwrite** | Re-running an agent replaces its artifact. |
| **Tests must pass** | QA Agent must run all tests and report results. Failing tests block the pipeline. |

## Directory Structure

```
.opencode/
├── agents/
│   ├── insightflow-pipeline__01-research-agent.md
│   ├── insightflow-pipeline__02-architect-agent.md
│   ├── insightflow-pipeline__03-backend-agent.md
│   ├── insightflow-pipeline__04-frontend-agent.md
│   ├── insightflow-pipeline__05-database-agent.md
│   ├── insightflow-pipeline__06-security-agent.md
│   ├── insightflow-pipeline__07-performance-agent.md
│   ├── insightflow-pipeline__08-qa-agent.md
│   ├── insightflow-pipeline__09-reviewer-agent.md
│   └── insightflow-pipeline__10-documentation-agent.md
└── commands/
    └── insightflow-pipeline__pipeline.md
.claude/
└── skills/
    └── insightflow-pipeline/
        └── SKILL.md
docs/
├── FEATURE-PIPELINE.md          ← this file
└── pipeline/                    ← runtime artifacts (generated)
    ├── 01-research-brief.md
    ├── ...
    └── current-state.json
```
