export const APPROVED_COPILOT_TOOLS = Object.freeze([
  'getOverview',
  'getCrimeTrend',
  'getDistrictSummary',
  'getPoliceStationSummary',
  'compareDistricts',
  'findHotspots',
  'detectCrimeSpike',
  'findRepeatOffenders',
  'getOffenderProfile',
  'getCaseSummary',
  'getCaseNetwork',
  'findRelatedCases',
  'findSimilarModusOperandi',
  'getRegistrationDelay',
  'getChargesheetDelay',
  'getHighRiskAreas',
  'getDataQualitySummary',
  'generateIntelligenceBrief',
]);

const caseReferencePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/;

function safeCaseReference(value) {
  const candidate = String(value || '').trim();
  return caseReferencePattern.test(candidate) ? candidate : null;
}

function caseReferenceFromQuestion(question) {
  const explicitReference = question.match(/\b(?:fir(?:\s*(?:no\.?|number))?|crime\s*(?:no\.?|number)|case\s*(?:no\.?|number))\s*(?:is\s+)?[:#=-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,29})\b/i)?.[1];
  if (explicitReference) return safeCaseReference(explicitReference);
  const firReference = question.match(/\bFIR[A-Za-z0-9_-]{2,29}\b/i)?.[0];
  return safeCaseReference(firReference);
}

function readCaseReference(question, filters) {
  const fromFilters = filters?.crimeNo || filters?.caseNo || filters?.firNumber;
  return safeCaseReference(fromFilters) || caseReferenceFromQuestion(question);
}

function readStationId(filters) {
  const candidate = Number(filters?.stationId || filters?.policeStationId);
  return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

function matches(question, pattern) {
  return pattern.test(question);
}

function approved(toolUsed, context) {
  return { toolUsed, matched: true, ...context };
}

export function legacyCopilotTypeForTool(toolUsed, matched = true) {
  if (!matched) return 'unknown';
  const types = {
    getOverview: 'overview',
    getCrimeTrend: 'trends',
    getDistrictSummary: 'districts',
    getPoliceStationSummary: 'stations',
    compareDistricts: 'districtComparison',
    findHotspots: 'hotspots',
    detectCrimeSpike: 'alerts',
    findRepeatOffenders: 'offenders',
    getOffenderProfile: 'offenderProfile',
    getCaseSummary: 'case',
    getCaseNetwork: 'network',
    findRelatedCases: 'relatedCases',
    findSimilarModusOperandi: 'similarMo',
    getRegistrationDelay: 'registrationDelay',
    getChargesheetDelay: 'chargesheetDelay',
    getHighRiskAreas: 'risk',
    getDataQualitySummary: 'dataQuality',
    generateIntelligenceBrief: 'intelligenceBrief',
  };
  return types[toolUsed] || 'overview';
}

export function resolveApprovedCopilotIntent(query, filters = {}) {
  const question = String(query || '').trim();
  const normalized = question.toLowerCase();
  const context = {
    caseNo: readCaseReference(question, filters),
    stationId: readStationId(filters),
  };

  if (matches(normalized, /\b(?:intelligence\s+(?:brief|report)|generate\s+(?:an?\s+)?(?:intelligence\s+)?brief)\b/)) return approved('generateIntelligenceBrief', context);
  if (matches(normalized, /\b(?:charge\s*sheet|chargesheet)\s+delay\b|\bdelay\s+(?:for\s+)?(?:charge\s*sheet|chargesheet)\b/)) return approved('getChargesheetDelay', context);
  if (matches(normalized, /\bregistration\s+delay\b|\bdelay\s+(?:for\s+)?registration\b/)) return approved('getRegistrationDelay', context);
  if (matches(normalized, /\b(?:similar|related)\s+(?:modus\s+operandi|mo)\b|\bmodus\s+operandi\s+(?:similarity|similar|related)\b/)) return approved('findSimilarModusOperandi', context);
  if (matches(normalized, /\b(?:related|linked|associated)\s+cases?\b/)) return approved('findRelatedCases', context);
  if (matches(normalized, /\bcase\s+(?:network|graph)\b|\bnetwork\s+(?:for\s+)?case\b/)) return approved('getCaseNetwork', context);
  if (matches(normalized, /\bcase\s+(?:summary|details?|detail)\b/)) return approved('getCaseSummary', context);
  if (matches(normalized, /\b(?:police\s+)?station\s+(?:summary|overview|details?|detail|drill\s*-?down)\b/)) return approved('getPoliceStationSummary', context);
  if (matches(normalized, /\bdistrict\s+(?:summary|overview|details?|detail|drill\s*-?down)\b/)) return approved('getDistrictSummary', context);
  if (matches(normalized, /\b(?:crime|incident|emerging)\s+(?:spike|alert)\b|\b(?:spike\s+(?:alert|detect)|detect\s+(?:crime|incident)\s+spike)\b/)) return approved('detectCrimeSpike', context);
  if (matches(normalized, /\bcompare\s+districts?\b|\bdistrict\s+comparison\b/)) return approved('compareDistricts', context);
  if (matches(normalized, /\bdata\s+quality\b|\bquality\s+(?:issues?|summary)\b/)) return approved('getDataQualitySummary', context);
  if (matches(normalized, /\b(?:high\s+)?risk\s+(?:areas?|districts?)\b|\brisk\s+(?:areas?|districts?)\b/)) return approved('getHighRiskAreas', context);
  if (matches(normalized, /\b(?:repeat\s+offenders?|multiple\s+case\s+links?)\b/)) return approved('findRepeatOffenders', context);
  if (matches(normalized, /\boffender\s+(?:profile|details?|detail)\b/)) return approved('getOffenderProfile', context);
  if (matches(normalized, /\bhot\s*spots?\b/)) return approved('findHotspots', context);
  if (matches(normalized, /\b(?:crime\s+)?trends?\b|\btrending\b/)) return approved('getCrimeTrend', context);
  if (matches(normalized, /\b(?:overview|summary|dashboard)\b/)) return approved('getOverview', context);
  return { toolUsed: 'getOverview', matched: false, ...context };
}

export function requiresCaseReference(toolUsed) {
  return ['getCaseSummary', 'getCaseNetwork', 'findRelatedCases', 'findSimilarModusOperandi'].includes(toolUsed);
}
