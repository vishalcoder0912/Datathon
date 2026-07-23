/**
 * @file agents.test.js
 * @description Unit tests for the agentic framework core classes.
 *
 * Run with: npx vitest run src/__tests__/agentic/agents.test.js
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  Agent,
  ExecutionContext,
  AgentResult,
  AGENT_ROLES,
} from '../../services/agentic/core/agentic-framework.js';

// ---------------------------------------------------------------------------
// Concrete test agent (minimal implementation of abstract Agent)
// ---------------------------------------------------------------------------

class EchoAgent extends Agent {
  async process(context) {
    return new AgentResult({
      agentId:   this.id,
      agentName: this.name,
      status:    'success',
      output:    { echo: context.goal },
      reasoning: 'Echoing the goal back.',
    });
  }
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

describe('Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new EchoAgent('test-agent', 'Test Agent', AGENT_ROLES.EXECUTOR);
  });

  test('constructs with correct properties', () => {
    expect(agent.id).toBe('test-agent');
    expect(agent.name).toBe('Test Agent');
    expect(agent.role).toBe(AGENT_ROLES.EXECUTOR);
    expect(agent.capabilities).toEqual([]);
    expect(agent.memory).toBeInstanceOf(Map);
  });

  test('throws when id/name/role are missing', () => {
    expect(() => new EchoAgent('', 'Name', 'role')).toThrow();
    expect(() => new EchoAgent('id', '', 'role')).toThrow();
    expect(() => new EchoAgent('id', 'Name', '')).toThrow();
  });

  test('records metrics correctly', () => {
    agent.recordMetric(100, 'success');
    agent.recordMetric(200, 'error');

    expect(agent.metrics.invocationCount).toBe(2);
    expect(agent.metrics.totalLatencyMs).toBe(300);
    expect(agent.metrics.errorCount).toBe(1);
  });

  test('calculates average latency', () => {
    agent.recordMetric(100, 'success');
    agent.recordMetric(200, 'success');
    expect(agent.avgLatencyMs).toBe(150);
  });

  test('returns 0 for avgLatencyMs when never invoked', () => {
    expect(agent.avgLatencyMs).toBe(0);
  });

  test('memory helpers work', () => {
    agent.remember('key1', 'value1');
    expect(agent.recall('key1')).toBe('value1');
    expect(agent.recall('missing')).toBeUndefined();

    agent.forgetAll();
    expect(agent.recall('key1')).toBeUndefined();
  });

  test('run() fills in latency on result', async () => {
    const ctx = new ExecutionContext({ datasetId: 'ds-1', goal: 'test' });
    const result = await agent.run(ctx);
    expect(result.latency).toBeGreaterThanOrEqual(0);
    expect(result.status).toBe('success');
  });

  test('run() returns error result on unhandled exception', async () => {
    class BrokenAgent extends Agent {
      async process() { throw new Error('Boom'); }
    }
    const broken = new BrokenAgent('broken', 'Broken', AGENT_ROLES.EXECUTOR);
    const ctx    = new ExecutionContext({ datasetId: 'ds-1', goal: 'test' });
    const result = await broken.run(ctx);
    expect(result.status).toBe('error');
    expect(result.reasoning).toContain('Boom');
  });

  test('getStatus() returns expected shape', () => {
    const status = agent.getStatus();
    expect(status).toMatchObject({
      id:           'test-agent',
      name:         'Test Agent',
      role:         AGENT_ROLES.EXECUTOR,
      capabilities: [],
    });
    expect(status.metrics).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ExecutionContext
// ---------------------------------------------------------------------------

describe('ExecutionContext', () => {
  test('constructs with required datasetId', () => {
    const ctx = new ExecutionContext({ datasetId: 'ds-1', goal: 'my goal' });
    expect(ctx.datasetId).toBe('ds-1');
    expect(ctx.goal).toBe('my goal');
    expect(ctx.agentTrail).toEqual([]);
    expect(ctx.requestId).toBeTruthy();
  });

  test('throws when datasetId is missing', () => {
    expect(() => new ExecutionContext({})).toThrow('ExecutionContext requires datasetId');
  });

  test('is immutable (frozen)', () => {
    const ctx = new ExecutionContext({ datasetId: 'ds-1' });
    expect(() => { ctx.goal = 'hack'; }).toThrow(); // strict mode throws
    expect(ctx.goal).not.toBe('hack');
  });

  test('recordAgentStep returns NEW context with step appended', () => {
    const ctx  = new ExecutionContext({ datasetId: 'ds-1', goal: 'test' });
    const ctx2 = ctx.recordAgentStep('agent-1', 'did something', { result: 'ok' });

    // Original unchanged
    expect(ctx.agentTrail.length).toBe(0);

    // New context has the step
    expect(ctx2.agentTrail.length).toBe(1);
    expect(ctx2.agentTrail[0].agentId).toBe('agent-1');
    expect(ctx2.agentTrail[0].decision).toBe('did something');
  });

  test('stageCount reflects trail length', () => {
    let ctx = new ExecutionContext({ datasetId: 'ds-1' });
    expect(ctx.stageCount).toBe(0);

    ctx = ctx.recordAgentStep('a1', 'step 1', {});
    ctx = ctx.recordAgentStep('a2', 'step 2', {});
    expect(ctx.stageCount).toBe(2);
  });

  test('lastStep returns the most recent step', () => {
    let ctx = new ExecutionContext({ datasetId: 'ds-1' });
    expect(ctx.lastStep).toBeNull();

    ctx = ctx.recordAgentStep('a1', 'first', {});
    ctx = ctx.recordAgentStep('a2', 'second', {});
    expect(ctx.lastStep.agentId).toBe('a2');
  });

  test('toSummary() returns a safe object', () => {
    const ctx     = new ExecutionContext({ datasetId: 'ds-1', goal: 'test' });
    const summary = ctx.toSummary();
    expect(summary.datasetId).toBe('ds-1');
    expect(summary.goal).toBe('test');
    expect(summary.stageCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AgentResult
// ---------------------------------------------------------------------------

describe('AgentResult', () => {
  test('constructs with defaults', () => {
    const result = new AgentResult({
      agentId:   'test-agent',
      agentName: 'Test',
      output:    { value: 42 },
    });
    expect(result.status).toBe('success');
    expect(result.latency).toBe(0);
    expect(result.nextAgentIds).toEqual([]);
    expect(result.isSuccess).toBe(true);
    expect(result.isError).toBe(false);
    expect(result.isPartial).toBe(false);
  });

  test('status helpers work for error', () => {
    const result = new AgentResult({
      agentId: 'x', agentName: 'X', status: 'error', output: null,
    });
    expect(result.isError).toBe(true);
    expect(result.isSuccess).toBe(false);
  });

  test('toJSON() excludes raw output', () => {
    const result = new AgentResult({
      agentId: 'x', agentName: 'X', output: { secret: 'big-data' }, // audit-ignore: secret-leak
    });
    const json = result.toJSON();
    expect(json.output).toBeUndefined();
    expect(json.agentId).toBe('x');
  });
});
