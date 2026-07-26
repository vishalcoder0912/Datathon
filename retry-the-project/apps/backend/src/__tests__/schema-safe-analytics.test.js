import { describe, it, expect } from 'vitest';
import { buildSchemaPacket, buildSchemaPacketV2, detectDomain, detectSemanticRoles, detectCategories, detectDateRanges, generateDataWarnings } from '../services/schema-packet-builder.js';
import { validateDashboardActions, validateAction, assessDashboardHealth } from '../services/guardian/dashboard-guardian.js';
import { calculateKPI, calculateChartData, calculateDashboardData } from '../services/analytics/local-calculation-engine.js';
import { SCHEMA_ONLY_SYSTEM_PROMPT, buildAnalystPrompt } from '../services/agentic/ai-analyst-prompts.js';

const sampleDataset = {
  id: 'test-123',
  name: 'Test Workforce',
  rowCount: 100,
  columns: [
    { name: 'country', type: 'category', sample: ['USA', 'UK', 'Canada'] },
    { name: 'salary', type: 'number', sample: [50000, 75000, 100000] },
    { name: 'experience', type: 'number', sample: [1, 5, 10] },
  ],
  rows: [
    { country: 'USA', salary: 50000, experience: 1 },
    { country: 'USA', salary: 75000, experience: 5 },
    { country: 'UK', salary: 60000, experience: 2 },
    { country: 'UK', salary: 65000, experience: 3 },
    { country: 'Canada', salary: 55000, experience: 2 },
    { country: 'Canada', salary: 70000, experience: 7 },
    { country: 'India', salary: 45000, experience: 1 },
    { country: 'India', salary: 50000, experience: 2 },
    { country: 'Germany', salary: 80000, experience: 8 },
    { country: 'Germany', salary: 85000, experience: 10 },
  ],
};

const simpleDataset = {
  id: 'test-simple',
  name: 'Simple Sales',
  rowCount: 5,
  columns: [
    { name: 'product', type: 'category' },
    { name: 'revenue', type: 'number' },
    { name: 'date', type: 'date' },
  ],
  rows: [
    { product: 'A', revenue: 100, date: '2024-01-01' },
    { product: 'B', revenue: 200, date: '2024-01-02' },
    { product: 'A', revenue: 150, date: '2024-01-03' },
    { product: 'C', revenue: 300, date: '2024-01-04' },
    { product: 'B', revenue: 250, date: '2024-01-05' },
  ],
};

describe('Schema-Safe Analytics', () => {
  describe('buildSchemaPacketV2 - No Raw Rows', () => {
    it('buildSchemaPacketV2 contains no raw rows', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(packet.rows).toBeUndefined();
      expect(packet.rawRows).toBeUndefined();
      expect(packet.data).toBeUndefined();
      expect(packet.columns).toBeDefined();
      expect(Array.isArray(packet.columns)).toBe(true);
    });

    it('buildSchemaPacketV2 has correct metadata', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(packet.datasetName).toBe('Test Workforce');
      expect(packet.rowCount).toBe(10);
      expect(packet.columnCount).toBe(3);
      expect(packet.datasetId).toBe('test-123');
    });

    it('buildSchemaPacketV2 detects numeric columns', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(packet.numericColumns).toContain('salary');
      expect(packet.numericColumns).toContain('experience');
    });

    it('buildSchemaPacketV2 detects categorical columns', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(packet.categoricalColumns).toContain('country');
    });

    it('buildSchemaPacketV2 detects domain', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(packet.detectedDomain).toBe('workforce_salary');
    });

    it('buildSchemaPacketV2 has quality score', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(packet.qualityScore).toBeGreaterThanOrEqual(0);
      expect(packet.qualityScore).toBeLessThanOrEqual(100);
    });

    it('buildSchemaPacketV2 contains warnings', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      expect(Array.isArray(packet.warnings)).toBe(true);
    });
  });

  describe('detectDomain', () => {
    it('detects workforce_salary domain', () => {
      const domain = detectDomain(sampleDataset);
      expect(domain).toBe('workforce_salary');
    });

    it('detects generic domain for unknown data', () => {
      const generic = { columns: [{ name: 'foo' }, { name: 'bar' }] };
      const domain = detectDomain(generic);
      expect(domain).toBe('generic');
    });

    it('detects finance domain', () => {
      const finance = { columns: [{ name: 'revenue' }, { name: 'cost' }, { name: 'profit' }] };
      const domain = detectDomain(finance);
      expect(domain).toBe('finance');
    });
  });

  describe('detectSemanticRoles', () => {
    it('assigns correct roles to columns', () => {
      const roles = detectSemanticRoles(simpleDataset);
      expect(roles.metrics).toContain('revenue');
      expect(roles.dates).toContain('date');
      expect(roles.dimensions).toContain('product');
    });
  });

  describe('detectCategories', () => {
    it('detects category options', () => {
      const cats = detectCategories(simpleDataset);
      expect(cats.product).toBeDefined();
      expect(cats.product.length).toBe(3);
      expect(cats.product).toContain('A');
      expect(cats.product).toContain('B');
      expect(cats.product).toContain('C');
    });
  });

  describe('detectDateRanges', () => {
    it('detects date range', () => {
      const ranges = detectDateRanges(simpleDataset);
      expect(ranges.date).toBeDefined();
      expect(ranges.date.min).toBe('2024-01-01');
      expect(ranges.date.max).toBe('2024-01-05');
    });
  });

  describe('validateDashboardActions', () => {
    it('rejects actions referencing invalid columns', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'create_chart', chart_type: 'bar', x: 'nonexistent', y: 'salary', aggregation: 'avg' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].action).toBe('create_chart');
    });

    it('accepts valid chart actions', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'create_chart', chart_type: 'bar', x: 'country', y: 'salary', aggregation: 'avg', title: 'Salary by Country', id: 'c1' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(true);
      expect(result.validatedActions).toHaveLength(1);
    });

    it('accepts valid KPI actions', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'create_kpi', title: 'Avg Salary', metric: 'salary', aggregation: 'avg', id: 'k1' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(true);
      expect(result.validatedActions).toHaveLength(1);
    });

    it('rejects KPI from non-numeric column', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'create_kpi', title: 'Country KPI', metric: 'country', aggregation: 'avg', id: 'k1' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('rejects unknown action types', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'unknown_action', title: 'Test' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(false);
    });

    it('accepts row_count KPI even without column', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'create_kpi', title: 'Row Count', metric: '__row_count__', aggregation: 'count', id: 'k1' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(true);
    });

    it('detects duplicate KPIs', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const dashboardState = {
        kpis: [{ metric: 'salary', aggregation: 'avg' }],
      };
      const actions = [
        { action: 'create_kpi', title: 'Avg Salary', metric: 'salary', aggregation: 'avg', id: 'k1' },
      ];
      const result = validateDashboardActions(packet, dashboardState, actions);
      expect(result.valid).toBe(false);
    });

    it('normalizes chart types', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const actions = [
        { action: 'create_chart', chart_type: 'doughnut', x: 'country', y: 'count', aggregation: 'count', title: 'Test', id: 'c1' },
      ];
      const result = validateDashboardActions(packet, {}, actions);
      expect(result.valid).toBe(true);
      expect(result.validatedActions[0].chart_type).toBe('pie');
    });

    it('handles empty actions array', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const result = validateDashboardActions(packet, {}, []);
      expect(result.valid).toBe(true);
      expect(result.validatedActions).toHaveLength(0);
    });

    it('handles null/undefined actions gracefully', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const result = validateDashboardActions(packet, {}, null);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validateAction', () => {
    it('validates filter action with valid column', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const result = validateAction({ action: 'create_filter', column: 'country' }, packet, {});
      expect(result.valid).toBe(true);
    });

    it('rejects filter action with invalid column', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const result = validateAction({ action: 'create_filter', column: 'ghost' }, packet, {});
      expect(result.valid).toBe(false);
    });

    it('accepts clear_filters action', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const result = validateAction({ action: 'clear_filters' }, packet, {});
      expect(result.valid).toBe(true);
    });

    it('accepts remove_chart action', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const result = validateAction({ action: 'remove_chart' }, packet, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateKPI', () => {
    it('calculates average correctly', () => {
      const result = calculateKPI(simpleDataset, { metric: 'revenue', aggregation: 'avg' });
      expect(result.calculated).toBe(true);
      expect(result.value).toBeCloseTo(200, 1);
    });

    it('calculates sum correctly', () => {
      const result = calculateKPI(simpleDataset, { metric: 'revenue', aggregation: 'sum' });
      expect(result.value).toBe(1000);
    });

    it('calculates min correctly', () => {
      const result = calculateKPI(simpleDataset, { metric: 'revenue', aggregation: 'min' });
      expect(result.value).toBe(100);
    });

    it('calculates max correctly', () => {
      const result = calculateKPI(simpleDataset, { metric: 'revenue', aggregation: 'max' });
      expect(result.value).toBe(300);
    });

    it('calculates count correctly', () => {
      const result = calculateKPI(simpleDataset, { metric: 'revenue', aggregation: 'count' });
      expect(result.value).toBe(5);
    });

    it('calculates row count', () => {
      const result = calculateKPI(simpleDataset, { metric: '__row_count__', aggregation: 'count' });
      expect(result.value).toBe(5);
    });

    it('handles empty dataset gracefully', () => {
      const result = calculateKPI({ rows: [] }, { metric: 'revenue', aggregation: 'avg' });
      expect(result.calculated).toBe(false);
    });

    it('handles null values in data', () => {
      const datasetWithNulls = {
        rows: [
          { val: 100 },
          { val: null },
          { val: 200 },
          { val: undefined },
          { val: 300 },
        ],
      };
      const result = calculateKPI(datasetWithNulls, { metric: 'val', aggregation: 'avg' });
      expect(result.value).toBe(200);
      expect(result.missingValuesSkipped).toBe(2);
    });
  });

  describe('calculateChartData', () => {
    it('groups and aggregates correctly', () => {
      const result = calculateChartData(simpleDataset, { x: 'product', y: 'revenue', chart_type: 'bar', aggregation: 'avg' });
      expect(result.data).toHaveLength(3);
      expect(result.groupsCreated).toBe(3);
      expect(result.groupsShown).toBe(3);
    });

    it('applies limit correctly', () => {
      const result = calculateChartData(sampleDataset, { x: 'country', y: 'salary', chart_type: 'bar', aggregation: 'avg', limit: 2 });
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    it('handles count aggregation', () => {
      const result = calculateChartData(simpleDataset, { x: 'product', chart_type: 'bar', aggregation: 'count' });
      expect(result.data).toHaveLength(3);
      const productA = result.data.find(d => d.product === 'A');
      expect(productA.count).toBe(2);
    });

    it('handles empty dataset gracefully', () => {
      const result = calculateChartData({ rows: [] }, { x: 'product', y: 'revenue', chart_type: 'bar', aggregation: 'avg' });
      expect(result.data).toHaveLength(0);
      expect(result.rowsProcessed).toBe(0);
    });

    it('returns error when no X column specified', () => {
      const result = calculateChartData(simpleDataset, { y: 'revenue', chart_type: 'bar', aggregation: 'avg' });
      expect(result.error).toBeDefined();
    });
  });

  describe('calculateDashboardData', () => {
    it('calculates multiple KPIs and charts', () => {
      const actions = [
        { action: 'create_kpi', id: 'k1', title: 'Avg Revenue', metric: 'revenue', aggregation: 'avg' },
        { action: 'create_chart', id: 'c1', title: 'Revenue by Product', chart_type: 'bar', x: 'product', y: 'revenue', aggregation: 'sum' },
      ];
      const result = calculateDashboardData(simpleDataset, actions);
      expect(result.kpiResults.k1).toBeDefined();
      expect(result.kpiResults.k1.value).toBeCloseTo(200, 1);
      expect(result.chartResults.c1).toBeDefined();
      expect(result.chartResults.c1.data).toHaveLength(3);
    });

    it('skips non-action items', () => {
      const actions = [
        { action: 'create_kpi', id: 'k1', title: 'Sum Revenue', metric: 'revenue', aggregation: 'sum' },
      ];
      const result = calculateDashboardData(simpleDataset, actions);
      expect(Object.keys(result.kpiResults)).toHaveLength(1);
      expect(Object.keys(result.chartResults)).toHaveLength(0);
    });
  });

  describe('assessDashboardHealth', () => {
    it('returns healthy for valid dashboard', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const health = assessDashboardHealth(packet, {
        kpis: [{ title: 'Avg Salary', metric: 'salary', aggregation: 'avg' }],
        charts: [{ title: 'Chart', xKey: 'country', yKey: 'salary', type: 'bar' }],
      });
      expect(health.status).toBe('healthy');
      expect(health.score).toBeGreaterThan(0);
    });

    it('returns failed for empty dashboard', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const health = assessDashboardHealth(packet, { kpis: [], charts: [] });
      expect(health.status).toBe('failed');
    });

    it('warns about invalid chart columns', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const health = assessDashboardHealth(packet, {
        kpis: [],
        charts: [{ title: 'Bad Chart', xKey: 'ghost', type: 'bar' }],
      });
      expect(health.warnings.some(w => w.type === 'invalid_chart_column')).toBe(true);
    });
  });

  describe('AI Prompts', () => {
    it('SCHEMA_ONLY_SYSTEM_PROMPT prohibits row-level insights', () => {
      expect(SCHEMA_ONLY_SYSTEM_PROMPT).toContain('NEVER');
      expect(SCHEMA_ONLY_SYSTEM_PROMPT).toContain('schema');
    });

    it('buildAnalystPrompt returns valid JSON', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const prompt = buildAnalystPrompt(packet, 'Build a dashboard', {});
      const parsed = JSON.parse(prompt);
      expect(parsed.system).toBeDefined();
      expect(parsed.dataset).toBeDefined();
      expect(parsed.userQuery).toBe('Build a dashboard');
    });

    it('buildAnalystPrompt includes no raw data', () => {
      const packet = buildSchemaPacketV2(sampleDataset);
      const prompt = buildAnalystPrompt(packet, 'Analyze', {});
      expect(prompt).not.toContain('50000');
      expect(prompt).not.toContain('USA'); // May be in categories, but not as raw values
    });
  });
});
