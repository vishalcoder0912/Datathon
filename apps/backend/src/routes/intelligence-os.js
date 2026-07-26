import {z} from 'zod';
import {readJsonBody} from '../auth/http.js';
import {KavachRepository} from '../kavach/kavach-repository.js';
import {
  analyzeCrimeDataQuality,
  buildInvestigationPlan,
  CRIME_INTELLIGENCE_AGENTS,
  evaluateRealtimeAlertRule,
  explainGraphConnection,
  getCrimeIntelligenceOSManifest,
  inferCanonicalCrimeModel,
  planReportPackage,
  runPredictionSandbox,
} from '../kavach/services/crime-intelligence-os.js';
import {requireAuthentication} from '../middleware/authenticate.js';
import {authorize, scopeFromUser} from '../middleware/authorize.js';
import {writeAuditEvent} from '../middleware/audit.js';
import {ensureRequestContext} from '../middleware/request-context.js';
import {sendError, sendSuccess} from '../utils/response-utils.js';

const investigationRepository = new KavachRepository();
let investigationRepositoryLoaded = false;

const rowsSchema = z.object({
  rows: z.array(z.record(z.unknown())).max(10_000),
}).strict();

const investigationSchema = z.object({
  query: z.string().trim().min(3).max(2_000),
  filters: z.record(z.unknown()).default({}),
}).strict();

const graphExplainSchema = z.object({
  source: z.string().trim().max(250).nullable().optional(),
  target: z.string().trim().max(250).nullable().optional(),
  relationshipType: z.string().trim().max(100).optional(),
  evidence: z.array(z.unknown()).max(100).default([]),
  attributes: z.record(z.unknown()).default({}),
}).strict();

const alertSchema = z.object({
  events: z.array(z.record(z.unknown())).max(5_000),
  rule: z.object({
    thresholdCount: z.coerce.number().int().min(2).max(500).optional(),
    radiusKm: z.coerce.number().min(0.1).max(100).optional(),
    windowHours: z.coerce.number().min(0.25).max(168).optional(),
    channels: z.array(z.enum(['dashboard', 'email', 'sms', 'whatsapp'])).max(4).optional(),
  }).default({}),
}).strict();

const sandboxSchema = z.object({
  baselineRisk: z.coerce.number().min(0).max(100).optional(),
  patrolChangePercent: z.coerce.number().min(-100).max(100).optional(),
  festivalIntensity: z.coerce.number().min(0).max(100).optional(),
  recentTrendPercent: z.coerce.number().min(-100).max(200).optional(),
  reportingCoverageChange: z.coerce.number().min(-100).max(100).optional(),
}).strict();

const reportSchema = z.object({
  reportType: z.string().trim().min(2).max(100).optional(),
  formats: z.array(z.string().trim().min(2).max(30)).max(5).optional(),
  audiences: z.array(z.string().trim().min(2).max(100)).max(10).optional(),
  filters: z.record(z.unknown()).optional(),
}).strict();

async function requireAccess(request, response, permission) {
  const user = await requireAuthentication(request, response);
  if (!user) return null;
  if (!authorize(request, response, permission)) return null;
  return {user, scope: scopeFromUser(user)};
}

function invalidBody(response, parsed) {
  sendError(response, 400, parsed.error.issues.map((item) => item.message).join('; '), 'INVALID_INTELLIGENCE_OS_REQUEST');
  return true;
}

async function audit(request, action, entityType, result) {
  await writeAuditEvent(request, {
    action,
    entityType,
    entityId: request.context?.requestId || null,
    metadata: {
      resultStatus: result?.status || result?.direction || 'completed',
      humanVerificationRequired: result?.humanVerificationRequired ?? result?.safety?.humanVerificationRequired ?? true,
    },
  });
}

function dateFromMonths(months) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - Math.max(1, Number(months || 6)));
  return date.toISOString().slice(0, 10);
}

async function loadInvestigationRepository() {
  if (investigationRepositoryLoaded) return true;
  if (investigationRepository.isPostgres) {
    investigationRepositoryLoaded = await investigationRepository.initialize();
    return investigationRepositoryLoaded;
  }
  await Promise.resolve(investigationRepository.loadAll());
  investigationRepositoryLoaded = true;
  return true;
}

function safeIncidentPreview(row) {
  return {
    crimeNo: row.crimeNo || row.crime_no || row.fir_number || null,
    incidentDate: row.incidentDate || row.incident_date || null,
    district: row.district || null,
    policeStation: row.policeStation || row.police_station || null,
    crimeType: row.crimeType || row.crime_type || null,
    severity: row.severity || null,
    status: row.status || null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

async function executeApprovedInvestigation(plan, scope) {
  try {
    const available = await loadInvestigationRepository();
    if (!available) {
      return {
        status: 'planned_only',
        recordCount: 0,
        incidents: [],
        reason: investigationRepository.loadError || 'Authoritative KAVACH repository is unavailable.',
      };
    }

    const filters = {
      district: plan.parsedIntent.district || undefined,
      crimeType: plan.parsedIntent.crimeType || undefined,
      dateFrom: dateFromMonths(plan.parsedIntent.months),
      pageSize: 100,
    };
    const rows = await investigationRepository.getIncidents(filters, scope);
    const incidents = (Array.isArray(rows) ? rows : []).slice(0, 100).map(safeIncidentPreview);
    const categories = incidents.reduce((summary, incident) => {
      const key = incident.crimeType || 'Unknown';
      summary[key] = (summary[key] || 0) + 1;
      return summary;
    }, {});

    return {
      status: 'completed',
      dataSource: investigationRepository.mode || (investigationRepository.isPostgres ? 'postgres' : 'file-demo'),
      recordCount: incidents.length,
      incidents,
      categorySummary: categories,
      resultLimit: 100,
      note: 'The authoritative preview applies approved repository filters. Vehicle and graph-specific evidence remains in the graph stage and requires human verification.',
    };
  } catch (error) {
    return {
      status: 'degraded',
      recordCount: 0,
      incidents: [],
      reason: 'The approved query plan was created, but the authoritative repository preview could not be completed.',
    };
  }
}

export async function handleIntelligenceOSRoutes(request, response, pathname) {
  if (!pathname.startsWith('/api/kavach/intelligence-os')) return false;
  ensureRequestContext(request);

  try {
    if (pathname === '/api/kavach/intelligence-os/capabilities' && request.method === 'GET') {
      const access = await requireAccess(request, response, 'read:intelligence');
      if (!access) return true;
      sendSuccess(response, getCrimeIntelligenceOSManifest(), 'Crime Intelligence OS capabilities retrieved');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/agents' && request.method === 'GET') {
      const access = await requireAccess(request, response, 'read:intelligence');
      if (!access) return true;
      sendSuccess(response, CRIME_INTELLIGENCE_AGENTS, 'Crime Intelligence OS agents retrieved');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/schema/infer' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'manage:data');
      if (!access) return true;
      const parsed = rowsSchema.safeParse(await readJsonBody(request, 10 * 1024 * 1024));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = inferCanonicalCrimeModel(parsed.data.rows);
      await audit(request, 'SCHEMA_INTELLIGENCE_INFERRED', 'SCHEMA_MAPPING', result);
      sendSuccess(response, result, 'Canonical crime schema inferred');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/data-quality/analyze' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'manage:data');
      if (!access) return true;
      const parsed = rowsSchema.safeParse(await readJsonBody(request, 10 * 1024 * 1024));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = analyzeCrimeDataQuality(parsed.data.rows);
      await audit(request, 'DATA_QUALITY_ANALYZED', 'DATA_QUALITY_RUN', result);
      sendSuccess(response, result, 'Crime data quality analysis completed');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/investigate' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'read:intelligence');
      if (!access) return true;
      const parsed = investigationSchema.safeParse(await readJsonBody(request, 256_000));
      if (!parsed.success) return invalidBody(response, parsed);
      const plan = buildInvestigationPlan(parsed.data.query, {...parsed.data.filters, districtId: access.scope.districtId, stationId: access.scope.unitId});
      const authoritativeResult = await executeApprovedInvestigation(plan, access.scope);
      const result = {...plan, authoritativeResult};
      await audit(request, 'INVESTIGATION_QUERY_EXECUTED', 'INVESTIGATION_QUERY', result);
      sendSuccess(response, result, 'Investigation query planned and approved preview executed');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/graph/explain' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'read:intelligence');
      if (!access) return true;
      const parsed = graphExplainSchema.safeParse(await readJsonBody(request, 256_000));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = explainGraphConnection(parsed.data);
      await audit(request, 'GRAPH_CONNECTION_EXPLAINED', 'GRAPH_RELATIONSHIP', result);
      sendSuccess(response, result, 'Graph connection explanation generated');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/alerts/evaluate' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'read:intelligence');
      if (!access) return true;
      const parsed = alertSchema.safeParse(await readJsonBody(request, 10 * 1024 * 1024));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = evaluateRealtimeAlertRule(parsed.data.events, parsed.data.rule);
      await audit(request, 'REALTIME_ALERT_RULE_EVALUATED', 'ALERT_RULE', result);
      sendSuccess(response, result, 'Real-time alert rule evaluated');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/sandbox/simulate' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'read:intelligence');
      if (!access) return true;
      const parsed = sandboxSchema.safeParse(await readJsonBody(request, 256_000));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = runPredictionSandbox(parsed.data);
      await audit(request, 'PREDICTION_SANDBOX_SIMULATED', 'PREDICTION_SANDBOX', result);
      sendSuccess(response, result, 'Prediction sandbox scenario calculated');
      return true;
    }

    if (pathname === '/api/kavach/intelligence-os/reports/plan' && request.method === 'POST') {
      const access = await requireAccess(request, response, 'generate:reports');
      if (!access) return true;
      const parsed = reportSchema.safeParse(await readJsonBody(request, 256_000));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = planReportPackage(parsed.data);
      await audit(request, 'REPORT_PACKAGE_PLANNED', 'REPORT_PACKAGE', result);
      sendSuccess(response, result, 'Intelligence report package planned');
      return true;
    }

    sendError(response, 404, 'Crime Intelligence OS route not found.', 'INTELLIGENCE_OS_ROUTE_NOT_FOUND');
    return true;
  } catch (error) {
    sendError(response, 500, 'Crime Intelligence OS operation failed.', error.code || 'INTELLIGENCE_OS_ERROR');
    return true;
  }
}

export default {handleIntelligenceOSRoutes};
