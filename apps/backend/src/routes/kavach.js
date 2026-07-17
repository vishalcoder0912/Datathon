import { z } from 'zod';
import { detectMappings } from '@kavach/domain';
import { createFileDemoRepository } from '../kavach/repositories/repository-factory.js';
import { KavachRepository } from '../kavach/kavach-repository.js';
import { KavachServices } from '../kavach/kavach-services.js';
import { pdfReportFileName, readKavachPdfReport } from '../kavach/report-pdf.js';
import { COPILOT_OLLAMA_FALLBACK_MESSAGE, explainAuthorizedCopilotResult } from '../kavach/services/copilot-explainer.js';
import { validateKavachImport } from '../kavach/validators/import-validator.js';
import { parseKavachImportRequest } from '../kavach/validators/import-parser.js';
import { readJsonBody } from '../auth/http.js';
import { authenticateRequest, demoEvaluator, requireAuthentication } from '../middleware/authenticate.js';
import { authorize, scopeFromUser, validateRequestedScope } from '../middleware/authorize.js';
import { writeAuditEvent } from '../middleware/audit.js';
import { ensureRequestContext } from '../middleware/request-context.js';
import { sendError, sendJson, sendSuccess } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

const filterSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  date: z.string().date().optional(),
  district: z.string().trim().min(1).max(150).optional(),
  districtId: z.coerce.number().int().positive().optional(),
  policeStation: z.string().trim().min(1).max(200).optional(),
  stationId: z.coerce.number().int().positive().optional(),
  crimeType: z.string().trim().min(1).max(200).optional(),
  crimeHeadId: z.coerce.number().int().positive().optional(),
  crimeSubHeadId: z.coerce.number().int().positive().optional(),
  severity: z.string().trim().min(1).max(20).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  daypart: z.string().trim().min(1).max(30).optional(),
  timeOfDay: z.string().trim().min(1).max(30).optional(),
}).passthrough();

const alertStreamClients = new Set();
let repo = new KavachRepository();
let services = new KavachServices(repo);
let initializationPromise = null;
let activeDataSource = repo.mode || (repo.isPostgres ? 'postgres' : 'file-demo');
let fileDemoInitialized = false;

function publishAlertEvent(event) {
  const payload = `id: ${Date.now()}\nevent: alert\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of [...alertStreamClients]) {
    try {
      client.response.write(payload);
    } catch {
      clearInterval(client.heartbeat);
      alertStreamClients.delete(client);
    }
  }
}

async function ensureDataSource() {
  if (!repo.isPostgres) {
    if (!fileDemoInitialized) {
      repo.loadAll();
      services.setStoredAlerts(services.generateAlerts());
      fileDemoInitialized = true;
    }
    return { repo, services, postgres: false };
  }
  if (!initializationPromise) {
    initializationPromise = repo.initialize();
  }
  const available = await initializationPromise;
  if (available) {
    activeDataSource = 'postgres';
    return { repo, services, postgres: true };
  }
  if (process.env.KAVACH_FILE_DEMO_FALLBACK === 'false') return { repo, services, postgres: true, unavailable: true };
  const fallback = createFileDemoRepository();
  fallback.loadAll();
  repo = fallback;
  services = new KavachServices(repo);
  services.setStoredAlerts(services.generateAlerts());
  fileDemoInitialized = true;
  activeDataSource = 'file-demo';
  return { repo, services, postgres: false, degraded: true };
}

function parseFilters(searchParams) {
  const raw = Object.fromEntries(searchParams?.entries?.() || []);
  const parsed = filterSchema.safeParse(raw);
  if (!parsed.success) {
    const error = new Error('Invalid query parameters.');
    error.code = 'INVALID_FILTERS';
    throw error;
  }
  return parsed.data;
}

async function requestAccess(request, response, filters, permission = 'read:intelligence') {
  const source = await ensureDataSource();
  let user;
  if (source.postgres) {
    if (source.unavailable) {
      sendError(response, 503, 'KAVACH PostgreSQL is unavailable. Set KAVACH_DATA_SOURCE=file-demo for an explicit offline demo.', 'DATABASE_UNAVAILABLE');
      return null;
    }
    user = await requireAuthentication(request, response);
    if (!user) return null;
  } else {
    user = await authenticateRequest(request) || demoEvaluator();
    request.auth = user;
  }
  if (!authorize(request, response, permission)) return null;
  const scope = scopeFromUser(user);
  if (!validateRequestedScope(filters, scope)) {
    sendError(response, 403, 'The requested district or station is outside your authorized scope.', 'SCOPE_DENIED');
    return null;
  }
  return { ...source, scope, user };
}

async function callKavach(source, method, args = []) {
  if (source.postgres) {
    if (typeof source.repo[method] !== 'function') throw new Error(`PostgreSQL KAVACH method '${method}' is not implemented.`);
    return source.repo[method](...args, source.scope);
  }
  if (typeof source.services[method] !== 'function') return null;
  return source.services[method](...args);
}

function attachCopilotExplanation(authoritativeResult, explanation) {
  const result = authoritativeResult && typeof authoritativeResult === 'object' ? authoritativeResult : { data: authoritativeResult };
  const toolUsed = result.toolUsed || result.type || 'approved_tool_router';
  const deterministicAnswer = result.answer || (result.message === COPILOT_OLLAMA_FALLBACK_MESSAGE ? null : result.message) || 'The approved analytical tool result is available below.';

  return {
    ...result,
    toolUsed,
    answer: deterministicAnswer,
    explanation: explanation.used ? {
      text: explanation.text,
      provider: 'local-ollama',
      model: explanation.model,
      authoritative: false,
    } : null,
    explanationProvider: explanation.used ? 'local-ollama' : 'deterministic-tool-router',
    explanationAuthoritative: false,
    modelStatus: explanation.used ? 'available' : 'unavailable',
    fallbackMessage: explanation.used ? null : COPILOT_OLLAMA_FALLBACK_MESSAGE,
    humanVerificationRequired: true,
  };
}

function paginationFromArray(items, filters = {}) {
  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 25);
  const total = items.length;
  return { data: items.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

async function fallbackCases(source, filters) {
  const items = source.repo.getIncidents(filters);
  return paginationFromArray(items.map((item) => ({
    crimeNo: item.fir_number, incidentDate: item.incident_date, incidentTime: item.incident_time,
    district: item.district, policeStation: item.police_station, crimeType: item.crime_type,
    severity: item.severity, status: item.status, latitude: item.latitude, longitude: item.longitude,
    briefFacts: item.brief_facts, modusOperandi: item.modus_operandi,
  })), filters);
}

async function fallbackStationList(source, filters) {
  const map = source.repo.getPoliceStations();
  const stations = Object.entries(map).flatMap(([district, values]) => (values || []).map((name, index) => ({ stationId: `${district}-${index}`, stationName: name, districtName: district, districtId: null, latitude: null, longitude: null })));
  return filters.district ? stations.filter((station) => station.districtName === filters.district) : stations;
}

async function fallbackSimilarMo(source, crimeNo, filters) {
  const current = source.repo.getIncidentById(crimeNo);
  if (!current) return null;
  const target = String(current.modus_operandi || '').toLowerCase();
  return source.repo.getIncidents(filters).filter((item) => item.fir_number !== crimeNo && String(item.modus_operandi || '').toLowerCase() === target).map((item) => ({
    crimeNo: item.fir_number, district: item.district, incidentDate: item.incident_date, crimeType: item.crime_type,
    modusOperandi: item.modus_operandi, similarityScore: 1, matchedFeatures: ['modus_operandi'],
    evidence: ['The synthetic records use the same recorded modus-operandi label.'], humanReviewRequired: true,
  }));
}

function routeNotFound(response, message, code) {
  sendError(response, HTTP_STATUS.NOT_FOUND, message, code);
  return true;
}

function sendPdfReport(response, pdfBuffer, fileName) {
  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Length': pdfBuffer.length,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(pdfBuffer);
}

function writeSse(request, response, scope) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.write(`event: connected\ndata: ${JSON.stringify({ dataSource: activeDataSource, scope: { districtId: scope.districtId, stationId: scope.unitId } })}\n\n`);
  const client = { response, scope, heartbeat: setInterval(() => { try { response.write(': heartbeat\n\n'); } catch {} }, 25_000) };
  alertStreamClients.add(client);
  request.on?.('close', () => { clearInterval(client.heartbeat); alertStreamClients.delete(client); });
}

export async function handleKavachRoutes(request, response, pathname) {
  if (!pathname.startsWith('/api/kavach')) return false;
  ensureRequestContext(request);

  try {
    const filters = parseFilters(request.searchParams || new URLSearchParams());

    if (pathname === '/api/kavach/alerts/stream' && request.method === 'GET') {
      const access = await requestAccess(request, response, filters);
      if (!access) return true;
      writeSse(request, response, access.scope);
      return true;
    }

    const permission = pathname.startsWith('/api/kavach/audit') ? 'read:audit'
      : pathname.includes('/imports') || pathname.includes('/data-quality/issues/') || (pathname === '/api/kavach/schema/map' && request.method === 'POST') ? 'manage:data'
        : pathname.includes('/alerts/') && request.method === 'PATCH' ? 'review:alerts'
          : pathname.startsWith('/api/kavach/reports') ? 'generate:reports'
            : 'read:intelligence';
    const access = await requestAccess(request, response, filters, permission);
    if (!access) return true;
    response.setHeader?.('X-Kavach-Data-Source', activeDataSource);

    if (pathname === '/api/kavach/overview' && request.method === 'GET') {
      const data = await callKavach(access, 'getOverview', [filters]);
      sendSuccess(response, data, 'Overview retrieved'); return true;
    }
    if (pathname === '/api/kavach/districts' && request.method === 'GET') {
      const data = await callKavach(access, 'getAllDistrictSummaries', [filters]);
      sendSuccess(response, data, 'District summaries retrieved'); return true;
    }
    const districtMatch = pathname.match(/^\/api\/kavach\/districts\/([^/]+)$/);
    if (districtMatch && request.method === 'GET') {
      const district = decodeURIComponent(districtMatch[1]);
      const data = await callKavach(access, 'getDistrictAnalysis', [district, filters]);
      if (!data) return routeNotFound(response, `District '${district}' not found`, 'DISTRICT_NOT_FOUND');
      sendSuccess(response, data, 'District analysis retrieved'); return true;
    }

    const trendRoutes = {
      '/api/kavach/trends/monthly': ['getMonthlyTrends', 'Monthly trends retrieved'],
      '/api/kavach/trends/weekly': ['getWeeklyTrends', 'Weekly trends retrieved'],
      '/api/kavach/trends/day-of-week': ['getDayOfWeekAnalysis', 'Day of week analysis retrieved'],
      '/api/kavach/trends/hour-of-day': ['getHourOfDayAnalysis', 'Hour of day analysis retrieved'],
      '/api/kavach/trends/daypart': ['getDaypartAnalysis', 'Daypart analysis retrieved'],
      '/api/kavach/trends/category-growth': ['getCategoryGrowth', 'Category growth retrieved'],
      '/api/kavach/trends/district-comparison': ['getDistrictComparison', 'District comparison retrieved'],
      '/api/kavach/trends/modus-operandi': ['getModusOperandiTrends', 'Modus operandi trends retrieved'],
      '/api/kavach/trends/period-comparison': ['getCurrentVsPrevious', 'Period comparison retrieved'],
    };
    if (request.method === 'GET' && trendRoutes[pathname]) {
      const [method, message] = trendRoutes[pathname];
      sendSuccess(response, await callKavach(access, method, [filters]), message); return true;
    }

    if (pathname === '/api/kavach/hotspots' && request.method === 'GET') {
      sendSuccess(response, await callKavach(access, 'getHotspots', [filters]), 'Hotspots retrieved'); return true;
    }
    const hotspotDistrictMatch = pathname.match(/^\/api\/kavach\/hotspots\/district\/([^/]+)$/);
    if (hotspotDistrictMatch && request.method === 'GET') {
      const district = decodeURIComponent(hotspotDistrictMatch[1]);
      sendSuccess(response, await callKavach(access, 'getDistrictHotspots', [district, filters]), 'District hotspots retrieved'); return true;
    }
    const hotspotMatch = pathname.match(/^\/api\/kavach\/hotspots\/([^/]+)$/);
    if (hotspotMatch && request.method === 'GET') {
      const data = await callKavach(access, 'getHotspotById', [decodeURIComponent(hotspotMatch[1])]);
      if (!data) return routeNotFound(response, `Hotspot '${hotspotMatch[1]}' not found`, 'HOTSPOT_NOT_FOUND');
      sendSuccess(response, data, 'Hotspot retrieved'); return true;
    }
    if (pathname === '/api/kavach/anomalies' && request.method === 'GET') {
      sendSuccess(response, await callKavach(access, 'detectAnomalies', [filters]), 'Anomalies detected'); return true;
    }

    if (pathname === '/api/kavach/network' && request.method === 'GET') {
      await writeAuditEvent(request, { action: 'NETWORK_QUERY', entityType: 'NETWORK' });
      sendSuccess(response, await callKavach(access, 'getNetworkGraph', [filters]), 'Network graph retrieved'); return true;
    }
    const networkPersonMatch = pathname.match(/^\/api\/kavach\/network\/person\/([^/]+)$/);
    if (networkPersonMatch && request.method === 'GET') {
      const data = await callKavach(access, 'getNetworkForPerson', [decodeURIComponent(networkPersonMatch[1])]);
      if (!data) return routeNotFound(response, 'Person not found', 'PERSON_NOT_FOUND');
      sendSuccess(response, data, 'Person network retrieved'); return true;
    }
    const networkIncidentMatch = pathname.match(/^\/api\/kavach\/network\/incident\/([^/]+)$/);
    if (networkIncidentMatch && request.method === 'GET') {
      const data = await callKavach(access, 'getNetworkForIncident', [decodeURIComponent(networkIncidentMatch[1])]);
      if (!data) return routeNotFound(response, 'Incident not found', 'INCIDENT_NOT_FOUND');
      sendSuccess(response, data, 'Incident network retrieved'); return true;
    }
    if (pathname === '/api/kavach/network/components' && request.method === 'GET') {
      sendSuccess(response, await callKavach(access, 'findConnectedComponents', [filters]), 'Connected components retrieved'); return true;
    }
    if (pathname === '/api/kavach/network/cross-district' && request.method === 'GET') {
      sendSuccess(response, await callKavach(access, 'findCrossDistrictNetworks', [filters]), 'Cross-district networks retrieved'); return true;
    }

    if (pathname === '/api/kavach/offenders' && request.method === 'GET') {
      sendSuccess(response, await callKavach(access, 'getOffenders', [filters]), 'Offenders retrieved'); return true;
    }
    const offenderMatch = pathname.match(/^\/api\/kavach\/offenders\/([^/]+)$/);
    if (offenderMatch && request.method === 'GET') {
      await writeAuditEvent(request, { action: 'OFFENDER_PROFILE_VIEW', entityType: 'PERSON', entityId: decodeURIComponent(offenderMatch[1]) });
      const data = await callKavach(access, 'getOffenderDetail', [decodeURIComponent(offenderMatch[1])]);
      if (!data) return routeNotFound(response, 'Person not found', 'OFFENDER_NOT_FOUND');
      sendSuccess(response, data, 'Offender detail retrieved'); return true;
    }

    if (pathname === '/api/kavach/risk/districts' && request.method === 'GET') { sendSuccess(response, await callKavach(access, 'calculateAllDistrictRisks', [filters]), 'District risks retrieved'); return true; }
    const riskMatch = pathname.match(/^\/api\/kavach\/risk\/districts\/([^/]+)$/);
    if (riskMatch && request.method === 'GET') {
      const district = decodeURIComponent(riskMatch[1]); const data = await callKavach(access, 'calculateDistrictRiskScore', [district, filters]);
      if (!data) return routeNotFound(response, `District '${district}' not found`, 'DISTRICT_NOT_FOUND');
      sendSuccess(response, data, 'District risk score retrieved'); return true;
    }
    if (pathname === '/api/kavach/risk/distribution' && request.method === 'GET') { sendSuccess(response, await callKavach(access, 'getRiskDistribution', [filters]), 'Risk distribution retrieved'); return true; }

    if (pathname === '/api/kavach/correlations' && request.method === 'GET') { sendSuccess(response, await callKavach(access, 'calculateCorrelations', [filters]), 'Correlations retrieved'); return true; }
    if (pathname === '/api/kavach/correlations/matrix' && request.method === 'GET') { sendSuccess(response, await callKavach(access, 'getCorrelationMatrix', [filters]), 'Correlation matrix retrieved'); return true; }
    if (pathname === '/api/kavach/correlations/ranked' && request.method === 'GET') { sendSuccess(response, await callKavach(access, 'getRankedCorrelations', [filters]), 'Ranked correlations retrieved'); return true; }

    if (pathname === '/api/kavach/alerts' && request.method === 'GET') {
      const alertFilters = { ...filters, type: request.searchParams?.get('type') || undefined, reviewed: request.searchParams?.has('reviewed') ? request.searchParams.get('reviewed') === 'true' : undefined, fromDate: request.searchParams?.get('fromDate') || undefined, toDate: request.searchParams?.get('toDate') || undefined };
      sendSuccess(response, await callKavach(access, 'getAlerts', [alertFilters]), 'Alerts retrieved'); return true;
    }
    const alertReviewMatch = pathname.match(/^\/api\/kavach\/alerts\/([^/]+)\/review$/);
    if (alertReviewMatch && request.method === 'PATCH') {
      const body = await readJsonBody(request, 32_000); const id = decodeURIComponent(alertReviewMatch[1]);
      const data = access.postgres ? await access.repo.markAlertReviewed(id, access.scope) : access.services.markAlertReviewed(id);
      if (!data) return routeNotFound(response, 'Alert not found', 'ALERT_NOT_FOUND');
      await writeAuditEvent(request, { action: 'ALERT_REVIEW', entityType: 'ALERT', entityId: id, afterData: { status: body.status || 'REVIEWED' } });
      publishAlertEvent({ id, status: data.status || 'ACKNOWLEDGED' });
      sendSuccess(response, data, 'Alert marked as reviewed'); return true;
    }
    const alertMatch = pathname.match(/^\/api\/kavach\/alerts\/([^/]+)$/);
    if (alertMatch && request.method === 'GET') {
      const data = await callKavach(access, 'getAlertById', [decodeURIComponent(alertMatch[1])]);
      if (!data) return routeNotFound(response, 'Alert not found', 'ALERT_NOT_FOUND');
      sendSuccess(response, data, 'Alert retrieved'); return true;
    }

    if (pathname === '/api/kavach/copilot/query' && request.method === 'POST') {
      const bodySchema = z.object({ query: z.string().trim().min(1).max(2000), filters: z.record(z.unknown()).optional() });
      const parsed = bodySchema.safeParse(await readJsonBody(request, 64_000));
      if (!parsed.success) { sendError(response, 400, 'A supported natural-language query is required.', 'INVALID_COPILOT_QUERY'); return true; }
      const authoritativeResult = await callKavach(access, 'processQuery', [parsed.data.query, { ...filters, ...(parsed.data.filters || {}) }]);
      const explanation = await explainAuthorizedCopilotResult({ question: parsed.data.query, authoritativeResult });
      const data = attachCopilotExplanation(authoritativeResult, explanation);
      await writeAuditEvent(request, {
        action: 'COPILOT_QUERY',
        entityType: 'COPILOT_QUERY',
        metadata: { toolUsed: data.toolUsed, localExplanationUsed: explanation.used },
      });
      sendSuccess(response, data, 'Query processed'); return true;
    }
    if (pathname === '/api/kavach/copilot/suggestions' && request.method === 'GET') { sendSuccess(response, await callKavach(access, 'getSuggestions', []), 'Suggestions retrieved'); return true; }

    if (pathname === '/api/kavach/reports' && request.method === 'POST') {
      const bodyResult = z.object({ filters: z.record(z.unknown()).optional(), format: z.enum(['html', 'pdf']).optional() }).safeParse(await readJsonBody(request, 64_000));
      if (!bodyResult.success) { sendError(response, 400, 'Invalid report request.', 'INVALID_REPORT_REQUEST'); return true; }
      const body = bodyResult.data; const data = await callKavach(access, 'generateReport', [{ ...filters, ...(body.filters || {}) }, body.format || 'html']);
      await writeAuditEvent(request, { action: 'REPORT_GENERATION', entityType: 'INTELLIGENCE_REPORT', entityId: data?.reportId || null });
      sendSuccess(response, data, 'Report generated'); return true;
    }
    const reportDownloadMatch = pathname.match(/^\/api\/kavach\/reports\/([^/]+)\/download$/);
    if (reportDownloadMatch && request.method === 'GET') {
      if (!access.postgres) return routeNotFound(response, 'Report not found', 'REPORT_NOT_FOUND');
      const report = await access.repo.getReport(decodeURIComponent(reportDownloadMatch[1]), access.scope);
      if (!report?.reportPath) return routeNotFound(response, 'Report not found', 'REPORT_NOT_FOUND');
      const pdfBuffer = await readKavachPdfReport(report.reportPath);
      if (!pdfBuffer) return routeNotFound(response, 'Report file not found', 'REPORT_FILE_NOT_FOUND');
      await writeAuditEvent(request, { action: 'REPORT_DOWNLOAD', entityType: 'INTELLIGENCE_REPORT', entityId: report.id });
      sendPdfReport(response, pdfBuffer, pdfReportFileName(report.id));
      return true;
    }
    const reportMatch = pathname.match(/^\/api\/kavach\/reports\/([^/]+)$/);
    if (reportMatch && request.method === 'GET') {
      if (!access.postgres) return routeNotFound(response, 'Report not found', 'REPORT_NOT_FOUND');
      const report = await access.repo.getReport(decodeURIComponent(reportMatch[1]), access.scope);
      if (!report) return routeNotFound(response, 'Report not found', 'REPORT_NOT_FOUND');
      await writeAuditEvent(request, { action: 'REPORT_VIEW', entityType: 'INTELLIGENCE_REPORT', entityId: report.id });
      sendSuccess(response, { ...report, downloadUrl: report.reportPath ? `/api/kavach/reports/${report.id}/download` : null }, 'Report retrieved'); return true;
    }

    if (pathname === '/api/kavach/police-stations' && request.method === 'GET') {
      const data = access.postgres ? await access.repo.getPoliceStations(filters, access.scope) : await fallbackStationList(access, filters);
      sendSuccess(response, data, 'Police stations retrieved'); return true;
    }
    const stationTrendsMatch = pathname.match(/^\/api\/kavach\/police-stations\/([^/]+)\/trends$/);
    if (stationTrendsMatch && request.method === 'GET') { const id = decodeURIComponent(stationTrendsMatch[1]); const data = access.postgres ? await access.repo.getPoliceStationTrends(id, filters, access.scope) : await callKavach(access, 'getMonthlyTrends', [{ ...filters, policeStation: id }]); sendSuccess(response, data, 'Station trends retrieved'); return true; }
    const stationHotspotsMatch = pathname.match(/^\/api\/kavach\/police-stations\/([^/]+)\/hotspots$/);
    if (stationHotspotsMatch && request.method === 'GET') { const id = decodeURIComponent(stationHotspotsMatch[1]); const data = access.postgres ? await access.repo.getPoliceStationHotspots(id, filters, access.scope) : await callKavach(access, 'getHotspots', [{ ...filters, policeStation: id }]); sendSuccess(response, data, 'Station hotspots retrieved'); return true; }
    const stationMatch = pathname.match(/^\/api\/kavach\/police-stations\/([^/]+)$/);
    if (stationMatch && request.method === 'GET') {
      const id = decodeURIComponent(stationMatch[1]); const data = access.postgres ? await access.repo.getPoliceStation(id, access.scope) : (await fallbackStationList(access, filters)).find((station) => String(station.stationId) === id || station.stationName === id) || null;
      if (!data) return routeNotFound(response, 'Police station not found', 'STATION_NOT_FOUND');
      sendSuccess(response, data, 'Police station retrieved'); return true;
    }

    if (pathname === '/api/kavach/cases' && request.method === 'GET') { const data = access.postgres ? await access.repo.listCases(filters, access.scope) : await fallbackCases(access, filters); sendSuccess(response, data, 'Cases retrieved'); return true; }
    const caseNetworkMatch = pathname.match(/^\/api\/kavach\/cases\/([^/]+)\/network$/);
    if (caseNetworkMatch && request.method === 'GET') { const id = decodeURIComponent(caseNetworkMatch[1]); const data = access.postgres ? await access.repo.getCaseNetwork(id, access.scope) : await callKavach(access, 'getNetworkForIncident', [id]); if (!data) return routeNotFound(response, 'Case not found', 'CASE_NOT_FOUND'); sendSuccess(response, data, 'Case network retrieved'); return true; }
    const similarMoMatch = pathname.match(/^\/api\/kavach\/cases\/([^/]+)\/similar-mo$/);
    if (similarMoMatch && request.method === 'GET') { const id = decodeURIComponent(similarMoMatch[1]); const data = access.postgres ? await access.repo.getSimilarModusOperandi(id, access.scope) : await fallbackSimilarMo(access, id, filters); if (!data) return routeNotFound(response, 'Case not found', 'CASE_NOT_FOUND'); sendSuccess(response, data, 'Similar modus-operandi cases retrieved'); return true; }
    const caseMatch = pathname.match(/^\/api\/kavach\/cases\/([^/]+)$/);
    if (caseMatch && request.method === 'GET') {
      const id = decodeURIComponent(caseMatch[1]); const data = access.postgres ? await access.repo.getCaseByCrimeNo(id, access.scope) : access.repo.getIncidentById(id);
      if (!data) return routeNotFound(response, 'Case not found', 'CASE_NOT_FOUND');
      await writeAuditEvent(request, { action: 'CASE_VIEW', entityType: 'CASE', entityId: id }); sendSuccess(response, data, 'Case retrieved'); return true;
    }

    if (pathname === '/api/kavach/data-quality/summary' && request.method === 'GET') {
      const data = access.postgres ? await access.repo.getDataQualitySummary(filters, access.scope) : { overallQualityScore: 100, missingCoordinateCount: 0, duplicateCrimeNumberCount: 0, unresolvedIssueCount: 0, issues: [] };
      sendSuccess(response, data, 'Data quality summary retrieved'); return true;
    }
    if (pathname === '/api/kavach/data-quality/issues' && request.method === 'GET') {
      const data = access.postgres ? await access.repo.getDataQualityIssues(filters, access.scope) : { data: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } };
      sendSuccess(response, data, 'Data quality issues retrieved'); return true;
    }
    const issueMatch = pathname.match(/^\/api\/kavach\/data-quality\/issues\/([^/]+)$/);
    if (issueMatch && request.method === 'PATCH') {
      const bodyResult = z.object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']).optional() }).safeParse(await readJsonBody(request, 32_000));
      if (!bodyResult.success) { sendError(response, 400, 'Invalid data quality issue status.', 'INVALID_QUALITY_ISSUE'); return true; }
      const data = access.postgres ? await access.repo.reviewDataQualityIssue(decodeURIComponent(issueMatch[1]), bodyResult.data, access.scope) : null;
      if (!data) return routeNotFound(response, 'Data quality issue not found', 'QUALITY_ISSUE_NOT_FOUND');
      await writeAuditEvent(request, { action: 'DATA_CORRECTION', entityType: 'DATA_QUALITY_ISSUE', entityId: data.id }); sendSuccess(response, data, 'Data quality issue updated'); return true;
    }

    if (pathname === '/api/kavach/imports' && request.method === 'POST') {
      if (!access.postgres) { sendError(response, 503, 'Imports require PostgreSQL mode.', 'IMPORTS_REQUIRE_POSTGRES'); return true; }
      const body = await parseKavachImportRequest(request);
      const validation = validateKavachImport(body);
      if (!validation.valid) { sendError(response, 400, 'The import payload is invalid.', 'INVALID_IMPORT_PAYLOAD'); return true; }
      const data = await access.repo.createImport({ ...validation.payload, ...validation }, access.scope);
      await writeAuditEvent(request, { action: 'DATA_IMPORT', entityType: 'DATA_IMPORT', entityId: data.id, metadata: { sourceType: validation.payload.sourceType, acceptedRows: validation.acceptedRows, rejectedRows: validation.rejectedRows } });
      sendSuccess(response, { ...data, previewRows: validation.previewRows, errors: validation.errors.slice(0, 100) }, 'Import validation created'); return true;
    }
    const importErrorsMatch = pathname.match(/^\/api\/kavach\/imports\/([^/]+)\/errors$/);
    if (importErrorsMatch && request.method === 'GET') { const data = access.postgres ? await access.repo.getImportErrors(decodeURIComponent(importErrorsMatch[1]), access.scope) : []; sendSuccess(response, data, 'Import errors retrieved'); return true; }
    const importCommitMatch = pathname.match(/^\/api\/kavach\/imports\/([^/]+)\/commit$/);
    if (importCommitMatch && request.method === 'POST') { const data = access.postgres ? await access.repo.commitImport(decodeURIComponent(importCommitMatch[1]), access.scope) : null; if (!data) return routeNotFound(response, 'Import not found', 'IMPORT_NOT_FOUND'); await writeAuditEvent(request, { action: 'DATA_IMPORT_COMMIT', entityType: 'DATA_IMPORT', entityId: data.id }); sendSuccess(response, data, 'Import committed'); return true; }
    const importMatch = pathname.match(/^\/api\/kavach\/imports\/([^/]+)$/);
    if (importMatch && request.method === 'GET') { const data = access.postgres ? await access.repo.getImport(decodeURIComponent(importMatch[1]), access.scope) : null; if (!data) return routeNotFound(response, 'Import not found', 'IMPORT_NOT_FOUND'); sendSuccess(response, data, 'Import retrieved'); return true; }

    if (pathname === '/api/kavach/models' && request.method === 'GET') { sendSuccess(response, access.postgres ? await access.repo.getModels() : [], 'Models retrieved'); return true; }
    if (pathname === '/api/kavach/models/runs' && request.method === 'GET') { sendSuccess(response, access.postgres ? await access.repo.getModelRuns() : [], 'Model runs retrieved'); return true; }
    if (pathname === '/api/kavach/audit' && request.method === 'GET') { sendSuccess(response, access.postgres ? await access.repo.getAudit(filters, access.scope) : { data: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }, 'Audit events retrieved'); return true; }

    if (pathname === '/api/kavach/data/load' && request.method === 'GET') {
      if (access.postgres) await access.repo.loadAll(); else access.repo.loadAll();
      sendSuccess(response, { loaded: access.repo.loaded, dataSource: activeDataSource, error: access.repo.loadError || null }, 'Data source status retrieved'); return true;
    }
    if (pathname === '/api/kavach/schema/map' && request.method === 'GET') {
      const incidents = access.postgres ? await access.repo.getIncidents({}, access.scope) : access.repo.getIncidents();
      const columns = Object.keys(incidents[0] || {}); sendSuccess(response, { columns, mappings: detectMappings(columns) }, 'Schema mapping retrieved'); return true;
    }
    if (pathname === '/api/kavach/schema/map' && request.method === 'POST') { const body = await readJsonBody(request, 64_000); sendSuccess(response, { mapped: true, mappings: body }, 'Schema mapping updated'); return true; }

    return false;
  } catch (error) {
    if (error.code === 'INVALID_FILTERS' || error.code === 'INVALID_JSON') {
      sendError(response, 400, error.message, error.code); return true;
    }
    if (error.code === 'BODY_TOO_LARGE') { sendError(response, 413, error.message, error.code); return true; }
    console.error('[KavachRoutes] Error:', error.message);
    sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error', 'KAVACH_ERROR');
    return true;
  }
}

export { publishAlertEvent };
export default { handleKavachRoutes };
