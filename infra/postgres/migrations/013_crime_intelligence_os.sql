-- 013_crime_intelligence_os.sql
-- Durable records for orchestrated investigations, data-quality analysis,
-- explainable alerts, scenario simulations, and multi-format reports.

CREATE TABLE IF NOT EXISTS intelligence_query_run (
  query_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text NOT NULL,
  parsed_intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES user_account(user_id),
  district_id integer REFERENCES district(district_id),
  unit_id integer REFERENCES police_unit(unit_id),
  status varchar(30) NOT NULL DEFAULT 'PLANNED',
  human_verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES user_account(user_id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intelligence_query_run_status_check CHECK (status IN ('PLANNED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'REVIEWED')),
  CONSTRAINT intelligence_query_verification_check CHECK (
    (human_verified = false AND verified_by IS NULL AND verified_at IS NULL) OR
    (human_verified = true AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS data_quality_analysis_run (
  analysis_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid REFERENCES kavach_data_source(id) ON DELETE SET NULL,
  import_id uuid REFERENCES data_import(import_id) ON DELETE SET NULL,
  total_rows integer NOT NULL DEFAULT 0,
  quality_score numeric(5,2) NOT NULL DEFAULT 0,
  issue_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  corrections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES user_account(user_id),
  approved_by uuid REFERENCES user_account(user_id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_quality_analysis_rows_check CHECK (total_rows >= 0),
  CONSTRAINT data_quality_analysis_score_check CHECK (quality_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS intelligence_alert_rule (
  alert_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  rule_type varchar(80) NOT NULL,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['dashboard']::text[],
  district_id integer REFERENCES district(district_id),
  unit_id integer REFERENCES police_unit(unit_id),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES user_account(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intelligence_alert_rule_type_check CHECK (rule_type IN ('SPATIOTEMPORAL_CLUSTER', 'CATEGORY_SPIKE', 'RARE_MO', 'CROSS_DISTRICT_NETWORK', 'DATA_QUALITY')),
  CONSTRAINT intelligence_alert_channels_check CHECK (channels <@ ARRAY['dashboard', 'email', 'sms', 'whatsapp']::text[])
);

CREATE TABLE IF NOT EXISTS prediction_sandbox_run (
  sandbox_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_score numeric(6,2) NOT NULL,
  simulated_score numeric(6,2) NOT NULL,
  factor_contributions jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  district_id integer REFERENCES district(district_id),
  created_by uuid REFERENCES user_account(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prediction_sandbox_scores_check CHECK (baseline_score BETWEEN 0 AND 100 AND simulated_score BETWEEN 0 AND 100),
  CONSTRAINT prediction_sandbox_confidence_check CHECK (confidence BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS intelligence_report_package (
  report_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type varchar(100) NOT NULL,
  formats text[] NOT NULL DEFAULT ARRAY['PDF']::text[],
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  audiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(30) NOT NULL DEFAULT 'PLANNED',
  generated_by uuid REFERENCES user_account(user_id),
  approved_by uuid REFERENCES user_account(user_id),
  approved_at timestamptz,
  storage_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intelligence_report_package_formats_check CHECK (formats <@ ARRAY['PDF', 'POWERPOINT', 'EXCEL', 'HTML', 'JSON']::text[]),
  CONSTRAINT intelligence_report_package_status_check CHECK (status IN ('PLANNED', 'GENERATING', 'READY_FOR_REVIEW', 'APPROVED', 'FAILED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_intelligence_query_run_created_at ON intelligence_query_run(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_query_run_scope ON intelligence_query_run(district_id, unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_quality_analysis_source ON data_quality_analysis_run(data_source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_alert_rule_active ON intelligence_alert_rule(active, rule_type);
CREATE INDEX IF NOT EXISTS idx_prediction_sandbox_run_district ON prediction_sandbox_run(district_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_report_package_status ON intelligence_report_package(status, created_at DESC);
