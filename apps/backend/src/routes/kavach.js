import { sendSuccess, sendError, sendJson } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';
import { detectMappings } from '@kavach/domain';
import { KavachRepository } from '../kavach/kavach-repository.js';
import { KavachServices } from '../kavach/kavach-services.js';

const repo = new KavachRepository();
const services = new KavachServices(repo);

repo.loadAll();
repo.getIncidents(); // warm up
const generatedAlerts = services.generateAlerts();
services.setStoredAlerts(generatedAlerts);

function parseFilters(searchParams) {
  const filters = {};
  if (searchParams.has('dateFrom')) filters.dateFrom = searchParams.get('dateFrom');
  if (searchParams.has('dateTo')) filters.dateTo = searchParams.get('dateTo');
  if (searchParams.has('district')) filters.district = searchParams.get('district');
  if (searchParams.has('policeStation')) filters.policeStation = searchParams.get('policeStation');
  if (searchParams.has('crimeType')) filters.crimeType = searchParams.get('crimeType');
  if (searchParams.has('severity')) filters.severity = searchParams.get('severity');
  if (searchParams.has('status')) filters.status = searchParams.get('status');
  if (searchParams.has('timeOfDay')) filters.timeOfDay = searchParams.get('timeOfDay');
  return filters;
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
  }
  return body;
}

export async function handleKavachRoutes(request, response, pathname) {
  const { method } = request;
  const searchParams = request.searchParams || new URLSearchParams();
  const filters = parseFilters(searchParams);

  if (!pathname.startsWith('/api/kavach')) {
    return false;
  }

  try {
    // GET /api/kavach/overview
    if (pathname === '/api/kavach/overview' && method === 'GET') {
      const data = services.getOverview(filters);
      sendSuccess(response, data, 'Overview retrieved');
      return true;
    }

    // GET /api/kavach/districts
    if (pathname === '/api/kavach/districts' && method === 'GET') {
      const data = services.getAllDistrictSummaries(filters);
      sendSuccess(response, data, 'District summaries retrieved');
      return true;
    }

    // GET /api/kavach/districts/:district
    const districtMatch = pathname.match(/^\/api\/kavach\/districts\/([^/]+)$/);
    if (districtMatch && method === 'GET') {
      const district = decodeURIComponent(districtMatch[1]);
      const data = services.getDistrictAnalysis(district, filters);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `District '${district}' not found`, 'DISTRICT_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'District analysis retrieved');
      }
      return true;
    }

    // GET /api/kavach/trends/monthly
    if (pathname === '/api/kavach/trends/monthly' && method === 'GET') {
      const data = services.getMonthlyTrends(filters);
      sendSuccess(response, data, 'Monthly trends retrieved');
      return true;
    }

    // GET /api/kavach/trends/weekly
    if (pathname === '/api/kavach/trends/weekly' && method === 'GET') {
      const data = services.getWeeklyTrends(filters);
      sendSuccess(response, data, 'Weekly trends retrieved');
      return true;
    }

    // GET /api/kavach/trends/day-of-week
    if (pathname === '/api/kavach/trends/day-of-week' && method === 'GET') {
      const data = services.getDayOfWeekAnalysis(filters);
      sendSuccess(response, data, 'Day of week analysis retrieved');
      return true;
    }

    // GET /api/kavach/trends/hour-of-day
    if (pathname === '/api/kavach/trends/hour-of-day' && method === 'GET') {
      const data = services.getHourOfDayAnalysis(filters);
      sendSuccess(response, data, 'Hour of day analysis retrieved');
      return true;
    }

    // GET /api/kavach/trends/daypart
    if (pathname === '/api/kavach/trends/daypart' && method === 'GET') {
      const data = services.getDaypartAnalysis(filters);
      sendSuccess(response, data, 'Daypart analysis retrieved');
      return true;
    }

    // GET /api/kavach/trends/category-growth
    if (pathname === '/api/kavach/trends/category-growth' && method === 'GET') {
      const data = services.getCategoryGrowth(filters);
      sendSuccess(response, data, 'Category growth retrieved');
      return true;
    }

    // GET /api/kavach/trends/district-comparison
    if (pathname === '/api/kavach/trends/district-comparison' && method === 'GET') {
      const data = services.getDistrictComparison(filters);
      sendSuccess(response, data, 'District comparison retrieved');
      return true;
    }

    // GET /api/kavach/trends/modus-operandi
    if (pathname === '/api/kavach/trends/modus-operandi' && method === 'GET') {
      const data = services.getModusOperandiTrends(filters);
      sendSuccess(response, data, 'Modus operandi trends retrieved');
      return true;
    }

    // GET /api/kavach/trends/period-comparison
    if (pathname === '/api/kavach/trends/period-comparison' && method === 'GET') {
      const data = services.getCurrentVsPrevious(filters);
      sendSuccess(response, data, 'Period comparison retrieved');
      return true;
    }

    // GET /api/kavach/hotspots
    if (pathname === '/api/kavach/hotspots' && method === 'GET') {
      const data = services.getHotspots(filters);
      sendSuccess(response, data, 'Hotspots retrieved');
      return true;
    }

    // GET /api/kavach/hotspots/:id
    const hotspotIdMatch = pathname.match(/^\/api\/kavach\/hotspots\/([^/]+)$/);
    if (hotspotIdMatch && method === 'GET') {
      const id = hotspotIdMatch[1];
      const data = services.getHotspotById(id);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `Hotspot '${id}' not found`, 'HOTSPOT_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'Hotspot retrieved');
      }
      return true;
    }

    // GET /api/kavach/hotspots/district/:district
    const hotspotDistrictMatch = pathname.match(/^\/api\/kavach\/hotspots\/district\/([^/]+)$/);
    if (hotspotDistrictMatch && method === 'GET') {
      const district = decodeURIComponent(hotspotDistrictMatch[1]);
      const data = services.getDistrictHotspots(district, filters);
      sendSuccess(response, data, 'District hotspots retrieved');
      return true;
    }

    // GET /api/kavach/anomalies
    if (pathname === '/api/kavach/anomalies' && method === 'GET') {
      const data = services.detectAnomalies(filters);
      sendSuccess(response, data, 'Anomalies detected');
      return true;
    }

    // GET /api/kavach/network
    if (pathname === '/api/kavach/network' && method === 'GET') {
      const data = services.getNetworkGraph(filters);
      sendSuccess(response, data, 'Network graph retrieved');
      return true;
    }

    // GET /api/kavach/network/person/:personId
    const networkPersonMatch = pathname.match(/^\/api\/kavach\/network\/person\/([^/]+)$/);
    if (networkPersonMatch && method === 'GET') {
      const personId = networkPersonMatch[1];
      const data = services.getNetworkForPerson(personId);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `Person '${personId}' not found`, 'PERSON_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'Person network retrieved');
      }
      return true;
    }

    // GET /api/kavach/network/incident/:firNumber
    const networkIncidentMatch = pathname.match(/^\/api\/kavach\/network\/incident\/([^/]+)$/);
    if (networkIncidentMatch && method === 'GET') {
      const firNumber = networkIncidentMatch[1];
      const data = services.getNetworkForIncident(firNumber);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `Incident '${firNumber}' not found`, 'INCIDENT_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'Incident network retrieved');
      }
      return true;
    }

    // GET /api/kavach/network/components
    if (pathname === '/api/kavach/network/components' && method === 'GET') {
      const data = services.findConnectedComponents();
      sendSuccess(response, data, 'Connected components retrieved');
      return true;
    }

    // GET /api/kavach/network/cross-district
    if (pathname === '/api/kavach/network/cross-district' && method === 'GET') {
      const data = services.findCrossDistrictNetworks();
      sendSuccess(response, data, 'Cross-district networks retrieved');
      return true;
    }

    // GET /api/kavach/offenders
    if (pathname === '/api/kavach/offenders' && method === 'GET') {
      const data = services.getOffenders(filters);
      sendSuccess(response, data, 'Offenders retrieved');
      return true;
    }

    // GET /api/kavach/offenders/:offenderId
    const offenderDetailMatch = pathname.match(/^\/api\/kavach\/offenders\/([^/]+)$/);
    if (offenderDetailMatch && method === 'GET') {
      const offenderId = offenderDetailMatch[1];
      const data = services.getOffenderDetail(offenderId);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `Offender '${offenderId}' not found`, 'OFFENDER_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'Offender detail retrieved');
      }
      return true;
    }

    // GET /api/kavach/risk/districts
    if (pathname === '/api/kavach/risk/districts' && method === 'GET') {
      const data = services.calculateAllDistrictRisks(filters);
      sendSuccess(response, data, 'District risks retrieved');
      return true;
    }

    // GET /api/kavach/risk/districts/:district
    const riskDistrictMatch = pathname.match(/^\/api\/kavach\/risk\/districts\/([^/]+)$/);
    if (riskDistrictMatch && method === 'GET') {
      const district = decodeURIComponent(riskDistrictMatch[1]);
      const data = services.calculateDistrictRiskScore(district, filters);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `District '${district}' not found`, 'DISTRICT_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'District risk score retrieved');
      }
      return true;
    }

    // GET /api/kavach/risk/distribution
    if (pathname === '/api/kavach/risk/distribution' && method === 'GET') {
      const data = services.getRiskDistribution();
      sendSuccess(response, data, 'Risk distribution retrieved');
      return true;
    }

    // GET /api/kavach/correlations
    if (pathname === '/api/kavach/correlations' && method === 'GET') {
      const data = services.calculateCorrelations();
      sendSuccess(response, data, 'Correlations retrieved');
      return true;
    }

    // GET /api/kavach/correlations/matrix
    if (pathname === '/api/kavach/correlations/matrix' && method === 'GET') {
      const data = services.getCorrelationMatrix();
      sendSuccess(response, data, 'Correlation matrix retrieved');
      return true;
    }

    // GET /api/kavach/correlations/ranked
    if (pathname === '/api/kavach/correlations/ranked' && method === 'GET') {
      const data = services.getRankedCorrelations();
      sendSuccess(response, data, 'Ranked correlations retrieved');
      return true;
    }

    // GET /api/kavach/alerts
    if (pathname === '/api/kavach/alerts' && method === 'GET') {
      const alertFilters = {};
      if (searchParams.has('type')) alertFilters.type = searchParams.get('type');
      if (searchParams.has('severity')) alertFilters.severity = searchParams.get('severity');
      if (searchParams.has('district')) alertFilters.district = searchParams.get('district');
      if (searchParams.has('reviewed')) alertFilters.reviewed = searchParams.get('reviewed') === 'true';
      if (searchParams.has('fromDate')) alertFilters.fromDate = searchParams.get('fromDate');
      if (searchParams.has('toDate')) alertFilters.toDate = searchParams.get('toDate');
      const data = services.getAlerts(alertFilters);
      sendSuccess(response, data, 'Alerts retrieved');
      return true;
    }

    // GET /api/kavach/alerts/:id
    const alertIdMatch = pathname.match(/^\/api\/kavach\/alerts\/([^/]+)$/);
    if (alertIdMatch && method === 'GET') {
      const id = alertIdMatch[1];
      const data = services.getAlertById(id);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `Alert '${id}' not found`, 'ALERT_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'Alert retrieved');
      }
      return true;
    }

    // PATCH /api/kavach/alerts/:id/review
    const alertReviewMatch = pathname.match(/^\/api\/kavach\/alerts\/([^/]+)\/review$/);
    if (alertReviewMatch && method === 'PATCH') {
      const id = alertReviewMatch[1];
      const data = services.markAlertReviewed(id);
      if (!data) {
        sendError(response, HTTP_STATUS.NOT_FOUND, `Alert '${id}' not found`, 'ALERT_NOT_FOUND');
      } else {
        sendSuccess(response, data, 'Alert marked as reviewed');
      }
      return true;
    }

    // POST /api/kavach/copilot/query
    if (pathname === '/api/kavach/copilot/query' && method === 'POST') {
      const body = await readBody(request);
      const parsed = JSON.parse(body);
      const query = parsed.query || '';
      const data = services.processQuery(query, filters);
      sendSuccess(response, data, 'Query processed');
      return true;
    }

    // GET /api/kavach/copilot/suggestions
    if (pathname === '/api/kavach/copilot/suggestions' && method === 'GET') {
      const data = services.getSuggestions();
      sendSuccess(response, data, 'Suggestions retrieved');
      return true;
    }

    // POST /api/kavach/reports
    if (pathname === '/api/kavach/reports' && method === 'POST') {
      const data = services.generateReport(filters, 'html');
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${data.filename}"`,
        'Cache-Control': 'no-cache',
      });
      response.end(data.html);
      return true;
    }

    // GET /api/kavach/data/load
    if (pathname === '/api/kavach/data/load' && method === 'GET') {
      repo.loadAll();
      sendSuccess(response, { loaded: repo.loaded, incidents: repo.incidents.length, persons: repo.persons.length, relationships: repo.relationships.length, error: repo.loadError }, 'Data loaded');
      return true;
    }

    // GET /api/kavach/schema/map
    if (pathname === '/api/kavach/schema/map' && method === 'GET') {
      const columns = Object.keys(repo.incidents[0] || {});
      const mappings = detectMappings(columns);
      sendSuccess(response, { columns, mappings }, 'Schema mapping retrieved');
      return true;
    }

    // POST /api/kavach/schema/map
    if (pathname === '/api/kavach/schema/map' && method === 'POST') {
      const body = await readBody(request);
      const parsed = JSON.parse(body);
      sendSuccess(response, { mapped: true, mappings: parsed }, 'Schema mapping updated');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[KavachRoutes] Error:', error);
    sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error', 'KAVACH_ERROR');
    return true;
  }
}

export default {
  handleKavachRoutes,
};
