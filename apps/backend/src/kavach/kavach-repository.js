import { createKavachRepository } from './repositories/repository-factory.js';

/**
 * Backward-compatible constructor used by older KAVACH service tests.
 * New production code should use `createKavachRepository` directly.
 */
export class KavachRepository {
  constructor(options = {}) {
    return createKavachRepository(options);
  }
}

export { createKavachRepository } from './repositories/repository-factory.js';
export { FileKavachRepository } from './repositories/file-kavach-repository.js';
export { PostgresKavachRepository } from './repositories/postgres-kavach-repository.js';

export default KavachRepository;
