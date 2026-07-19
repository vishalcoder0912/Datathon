import {z} from 'zod';
import {readJsonBody} from '../auth/http.js';
import {listConnectorProviders} from '../kavach/connectors/connector-catalog.js';
import {UniversalDataGateway} from '../kavach/connectors/universal-data-gateway.js';
import {requireAuthentication} from '../middleware/authenticate.js';
import {authorize, scopeFromUser} from '../middleware/authorize.js';
import {writeAuditEvent} from '../middleware/audit.js';
import {ensureRequestContext} from '../middleware/request-context.js';
import {sendCreated, sendError, sendSuccess} from '../utils/response-utils.js';

const gateway = new UniversalDataGateway();

const sourceSchema = z.object({
  name: z.string().trim().min(3).max(150),
  sourceType: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  secretRef: z.string().trim().min(3).max(500).nullable().optional(),
  config: z.record(z.unknown()).default({}),
  districtId: z.coerce.number().int().positive().nullable().optional(),
  unitId: z.coerce.number().int().positive().nullable().optional(),
}).strict();

const operationSchema = z.object({
  resource: z.string().trim().max(500).nullable().optional(),
  rows: z.array(z.record(z.unknown())).max(500).optional(),
  schema: z.array(z.record(z.unknown())).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  mode: z.enum(['full_refresh', 'incremental', 'manual']).optional(),
  mappingApproved: z.boolean().optional(),
}).passthrough();

function sourceIdFrom(pathname, suffix) {
  const match = pathname.match(new RegExp(`^/api/kavach/data-sources/([0-9a-f-]+)${suffix}$`, 'i'));
  return match?.[1] || null;
}

function jobIdFrom(pathname) {
  const match = pathname.match(/^\/api\/kavach\/ingestion-jobs\/([0-9a-f-]+)$/i);
  return match?.[1] || null;
}

async function requireDataManager(request, response) {
  const user = await requireAuthentication(request, response);
  if (!user) return null;
  if (!authorize(request, response, 'manage:data')) return null;
  return {user, scope: scopeFromUser(user)};
}

function invalidBody(response, parsed) {
  sendError(response, 400, parsed.error.issues.map((issue) => issue.message).join('; '), 'INVALID_DATA_GATEWAY_REQUEST');
  return true;
}

export async function handleDataGatewayRoutes(request, response, pathname) {
  if (!pathname.startsWith('/api/kavach/data-sources') && !pathname.startsWith('/api/kavach/ingestion-jobs')) return false;
  ensureRequestContext(request);

  try {
    const access = await requireDataManager(request, response);
    if (!access) return true;

    if (pathname === '/api/kavach/data-sources/providers' && request.method === 'GET') {
      sendSuccess(response, listConnectorProviders(), 'Connector providers retrieved');
      return true;
    }

    if (pathname === '/api/kavach/data-sources' && request.method === 'GET') {
      const sources = await gateway.listSources(access.scope);
      sendSuccess(response, sources, 'Data sources retrieved');
      return true;
    }

    if (pathname === '/api/kavach/data-sources' && request.method === 'POST') {
      const parsed = sourceSchema.safeParse(await readJsonBody(request, 256_000));
      if (!parsed.success) return invalidBody(response, parsed);
      const source = await gateway.registerSource(parsed.data, access.scope);
      await writeAuditEvent(request, {
        action: 'DATA_SOURCE_REGISTERED',
        entityType: 'DATA_SOURCE',
        entityId: source.id,
        afterData: {...source, secretRef: source.secretRef ? '[secret-reference]' : null},
      });
      sendCreated(response, source, 'Data source registered');
      return true;
    }

    const operations = [
      {suffix: '/test', method: 'testConnection', message: 'Connection configuration validated'},
      {suffix: '/discover', method: 'discoverSchema', message: 'Source schema discovery completed'},
      {suffix: '/preview', method: 'preview', message: 'Masked source preview generated'},
      {suffix: '/sync', method: 'startSync', message: 'Ingestion job created'},
    ];

    for (const operation of operations) {
      const sourceId = sourceIdFrom(pathname, operation.suffix);
      if (!sourceId || request.method !== 'POST') continue;
      const source = await gateway.getSource(sourceId);
      if (!source) {
        sendError(response, 404, 'Data source was not found.', 'DATA_SOURCE_NOT_FOUND');
        return true;
      }
      const parsed = operationSchema.safeParse(await readJsonBody(request, 10 * 1024 * 1024));
      if (!parsed.success) return invalidBody(response, parsed);
      const result = operation.method === 'startSync'
        ? await gateway[operation.method](source, parsed.data, access.scope)
        : await gateway[operation.method](source, parsed.data);
      await writeAuditEvent(request, {
        action: `DATA_GATEWAY_${operation.method.toUpperCase()}`,
        entityType: operation.method === 'startSync' ? 'INGESTION_JOB' : 'DATA_SOURCE',
        entityId: operation.method === 'startSync' ? result.id : source.id,
        metadata: {sourceId: source.id, status: result.status},
      });
      if (operation.method === 'startSync') sendCreated(response, result, operation.message);
      else sendSuccess(response, result, operation.message);
      return true;
    }

    const jobId = jobIdFrom(pathname);
    if (jobId && request.method === 'GET') {
      const job = await gateway.getJob(jobId);
      if (!job) {
        sendError(response, 404, 'Ingestion job was not found.', 'INGESTION_JOB_NOT_FOUND');
        return true;
      }
      sendSuccess(response, job, 'Ingestion job retrieved');
      return true;
    }

    sendError(response, 404, 'Universal Data Gateway route not found.', 'DATA_GATEWAY_ROUTE_NOT_FOUND');
    return true;
  } catch (error) {
    const status = error.code === 'INVALID_CONNECTOR_CONFIGURATION' ? 400 : 500;
    sendError(response, status, status === 400 ? error.message : 'Universal Data Gateway operation failed.', error.code || 'DATA_GATEWAY_ERROR');
    return true;
  }
}

export default {handleDataGatewayRoutes};
