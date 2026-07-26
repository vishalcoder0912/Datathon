import {getPool} from './pool.js';

const isolationLevels = new Set([
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
]);

export const withTransaction = async (callback, options = {}) => {
  const isolationLevel = options.isolationLevel || 'READ COMMITTED';

  if (!isolationLevels.has(isolationLevel)) {
    throw new Error('Unsupported transaction isolation level.');
  }

  const client = await getPool().connect();

  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original database error is more useful to callers than a rollback error.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const withReadOnlyTransaction = async (callback, options = {}) => withTransaction(async (client) => {
  await client.query('SET TRANSACTION READ ONLY');
  return callback(client);
}, options);
