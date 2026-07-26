CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(32) PRIMARY KEY,
  name varchar(255) NOT NULL,
  checksum varchar(128) NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  execution_ms integer NOT NULL CHECK (execution_ms >= 0)
);

COMMENT ON SCHEMA analytics IS 'Read-optimised, privacy-aware compatibility views for KAVACH AI.';
