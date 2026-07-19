-- 012_universal_data_gateway.sql
-- Secure connector metadata and ingestion job tracking for KAVACH AI.
-- Provider credentials are never stored here. Only a secret-manager reference is persisted.

CREATE TABLE IF NOT EXISTS kavach_data_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  provider varchar(50) NOT NULL,
  source_type varchar(50) NOT NULL,
  adapter varchar(50) NOT NULL,
  secret_ref text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(30) NOT NULL DEFAULT 'CONFIGURED',
  owner_user_id uuid,
  district_id integer,
  unit_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kavach_data_source_status_check CHECK (status IN ('CONFIGURED', 'READY', 'DISABLED', 'ERROR')),
  CONSTRAINT kavach_data_source_secret_check CHECK (
    adapter = 'native' OR secret_ref IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kavach_data_source_name_scope
  ON kavach_data_source (lower(name), COALESCE(district_id, 0), COALESCE(unit_id, 0));
CREATE INDEX IF NOT EXISTS idx_kavach_data_source_type ON kavach_data_source (source_type);
CREATE INDEX IF NOT EXISTS idx_kavach_data_source_scope ON kavach_data_source (district_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_kavach_data_source_status ON kavach_data_source (status);

CREATE TABLE IF NOT EXISTS kavach_schema_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES kavach_data_source(id) ON DELETE CASCADE,
  resource varchar(500),
  version integer NOT NULL DEFAULT 1,
  field_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  transformations jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  pii_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kavach_schema_mapping_approval_check CHECK (
    approved = false OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kavach_schema_mapping_version
  ON kavach_schema_mapping (data_source_id, COALESCE(resource, ''), version);
CREATE INDEX IF NOT EXISTS idx_kavach_schema_mapping_source ON kavach_schema_mapping (data_source_id);

CREATE TABLE IF NOT EXISTS kavach_ingestion_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES kavach_data_source(id) ON DELETE RESTRICT,
  schema_mapping_id uuid REFERENCES kavach_schema_mapping(id) ON DELETE SET NULL,
  resource varchar(500),
  sync_mode varchar(30) NOT NULL DEFAULT 'incremental',
  status varchar(40) NOT NULL DEFAULT 'QUEUED',
  external_job_id varchar(200),
  records_discovered integer NOT NULL DEFAULT 0,
  records_valid integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  records_committed integer NOT NULL DEFAULT 0,
  mapping_approved boolean NOT NULL DEFAULT false,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code varchar(100),
  error_message text,
  requested_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kavach_ingestion_job_mode_check CHECK (sync_mode IN ('full_refresh', 'incremental', 'manual')),
  CONSTRAINT kavach_ingestion_job_status_check CHECK (
    status IN ('QUEUED', 'RUNNING', 'MAPPING_REQUIRED', 'READY_TO_IMPORT', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')
  ),
  CONSTRAINT kavach_ingestion_job_counts_check CHECK (
    records_discovered >= 0 AND records_valid >= 0 AND records_rejected >= 0 AND records_committed >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_kavach_ingestion_job_source ON kavach_ingestion_job (data_source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kavach_ingestion_job_status ON kavach_ingestion_job (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kavach_ingestion_job_external ON kavach_ingestion_job (external_job_id) WHERE external_job_id IS NOT NULL;

COMMENT ON COLUMN kavach_data_source.secret_ref IS 'Reference to Secret Manager, Vault, or environment secret. Never store raw credentials.';
COMMENT ON TABLE kavach_schema_mapping IS 'Human-reviewed mapping from provider fields into the canonical KAVACH domain model.';
COMMENT ON TABLE kavach_ingestion_job IS 'Tracks provider synchronization without implying that discovered rows were committed into crime records.';
