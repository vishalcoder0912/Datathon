import { FileKavachRepository } from './file-kavach-repository.js';
import { PostgresKavachRepository } from './postgres-kavach-repository.js';

function isTestRuntime() {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}

/**
 * Creates the KAVACH source of truth. File data remains available only as a
 * deliberate demo/testing source or a local degraded-mode fallback.
 */
export function createKavachRepository(options = {}) {
  const requestedSource = options.dataSource || process.env.KAVACH_DATA_SOURCE || (isTestRuntime() ? 'file-demo' : 'postgres');

  if (requestedSource === 'file-demo') {
    return new FileKavachRepository(options);
  }

  if (requestedSource !== 'postgres') {
    throw new Error(`Unsupported KAVACH_DATA_SOURCE: ${requestedSource}`);
  }

  return new PostgresKavachRepository(options);
}

export function createFileDemoRepository(options = {}) {
  return new FileKavachRepository(options);
}

export default createKavachRepository;
