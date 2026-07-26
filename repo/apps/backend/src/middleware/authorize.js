import { sendError } from '../utils/response-utils.js';

const ROLE_PERMISSIONS = Object.freeze({
  STATE_ADMIN: new Set(['read:intelligence', 'review:alerts', 'read:audit', 'manage:users', 'manage:data', 'generate:reports']),
  SCRB_ANALYST: new Set(['read:intelligence', 'review:alerts', 'generate:reports']),
  DISTRICT_OFFICER: new Set(['read:intelligence', 'review:alerts', 'generate:reports']),
  STATION_OFFICER: new Set(['read:intelligence', 'review:alerts', 'generate:reports']),
  INVESTIGATOR: new Set(['read:intelligence', 'generate:reports']),
  EVALUATOR: new Set(['read:intelligence', 'generate:reports']),
  AUDITOR: new Set(['read:audit', 'generate:reports']),
  DATA_ENGINEER: new Set(['read:intelligence', 'manage:data', 'generate:reports']),
});

export function hasPermission(user, permission) {
  return Boolean(user?.roleCode && ROLE_PERMISSIONS[user.roleCode]?.has(permission));
}

export function authorize(request, response, permission) {
  if (hasPermission(request.auth, permission)) return true;
  sendError(response, 403, 'You do not have permission to perform this action.', 'FORBIDDEN');
  return false;
}

export function scopeFromUser(user) {
  return {
    userId: user?.userId || null,
    roleCode: user?.roleCode || 'EVALUATOR',
    districtId: user?.districtId || null,
    unitId: user?.unitId || null,
    clearanceLevel: user?.clearanceLevel || null,
  };
}

export function validateRequestedScope(filters = {}, scope = {}) {
  if (scope.roleCode === 'DISTRICT_OFFICER' && scope.districtId && filters.districtId && Number(filters.districtId) !== Number(scope.districtId)) return false;
  if (['STATION_OFFICER', 'INVESTIGATOR'].includes(scope.roleCode) && scope.unitId && filters.stationId && Number(filters.stationId) !== Number(scope.unitId)) return false;
  return true;
}

export { ROLE_PERMISSIONS };

