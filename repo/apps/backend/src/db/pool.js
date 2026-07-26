import 'dotenv/config';
import pg from 'pg';

const {Pool} = pg;

let pool;

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  if (!user || !password || !database) {
    return null;
  }

  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
};

export const isDatabaseConfigured = () => Boolean(getDatabaseUrl());

const createPool = () => {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD must be configured for PostgreSQL access.');
  }

  const useSsl = process.env.DATABASE_SSL === 'true';
  const nextPool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    min: Number.parseInt(process.env.DATABASE_POOL_MIN || '0', 10),
    idleTimeoutMillis: Number.parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: Number.parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '5000', 10),
    application_name: process.env.DATABASE_APPLICATION_NAME || 'kavach-backend',
    ssl: useSsl ? {rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'} : undefined,
  });

  nextPool.on('connect', (client) => {
    void client.query("SET TIME ZONE 'UTC'").catch(() => undefined);
  });
  nextPool.on('error', (error) => {
    console.error('[database] idle client error', {message: error.message});
  });

  return nextPool;
};

export const getPool = () => {
  if (!pool) {
    pool = createPool();
  }

  return pool;
};

export const query = (text, parameters) => (parameters === undefined
  ? getPool().query(text)
  : getPool().query(text, parameters));

export const closePool = async () => {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = undefined;
  await activePool.end();
};

export default {
  getPool,
  query,
  closePool,
  isDatabaseConfigured,
};
