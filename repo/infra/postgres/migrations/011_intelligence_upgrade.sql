-- 011_intelligence_upgrade.sql
-- Additive KAVACH AI Intelligence Upgrade Schema Migration

-- Core Entities
CREATE TABLE IF NOT EXISTS weapons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(100) NOT NULL,
  subtype varchar(100),
  description text,
  source varchar(100),
  verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL UNIQUE,
  organization_type varchar(100),
  description text,
  source varchar(100),
  verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communication_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type varchar(50) NOT NULL, -- 'phone', 'email', 'device', 'account'
  encrypted_value text NOT NULL,
  hashed_value varchar(128) NOT NULL UNIQUE,
  masked_value varchar(150) NOT NULL,
  source varchar(100),
  verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_profile (
  profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  source_organization varchar(150),
  version varchar(30) DEFAULT '1.0.0',
  source_type varchar(50) NOT NULL,
  column_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  transformations jsonb NOT NULL DEFAULT '{}'::jsonb,
  category_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  geographic_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Socioeconomic Intelligence Layer
CREATE TABLE IF NOT EXISTS socioeconomic_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  unit varchar(30),
  source_name varchar(200),
  source_url text,
  year integer,
  allowed_for_risk_model boolean DEFAULT true,
  sensitivity_classification varchar(30) DEFAULT 'INTERNAL',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS area_socioeconomic_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES socioeconomic_indicators(id) ON DELETE CASCADE,
  district_id integer REFERENCES district(district_id),
  police_station_id integer REFERENCES police_unit(unit_id),
  value numeric(18, 4) NOT NULL,
  year integer NOT NULL,
  source varchar(200),
  data_quality_score numeric(5, 4) DEFAULT 1.0000,
  geometry_scope varchar(50) DEFAULT 'DISTRICT',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT area_socioeconomic_values_scope CHECK (geometry_scope IN ('DISTRICT', 'STATION')),
  CONSTRAINT area_socioeconomic_values_target_check CHECK (
    (geometry_scope = 'DISTRICT' AND district_id IS NOT NULL AND police_station_id IS NULL) OR
    (geometry_scope = 'STATION' AND police_station_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS socioeconomic_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  method varchar(50) NOT NULL,
  indicators_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_period jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Relationship tables with provenance/evidence attributes
CREATE TABLE IF NOT EXISTS incident_vehicle (
  case_master_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (case_master_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS incident_weapon (
  case_master_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  weapon_id uuid NOT NULL REFERENCES weapons(id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (case_master_id, weapon_id)
);

CREATE TABLE IF NOT EXISTS incident_location (
  case_master_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (case_master_id, location_id)
);

CREATE TABLE IF NOT EXISTS incident_organization (
  case_master_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (case_master_id, organization_id)
);

CREATE TABLE IF NOT EXISTS incident_modus_operandi (
  case_master_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  mo_id uuid NOT NULL REFERENCES modus_operandi(mo_id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (case_master_id, mo_id)
);

CREATE TABLE IF NOT EXISTS person_vehicle (
  person_id uuid NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (person_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS person_communication_identifier (
  person_id uuid NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  communication_id uuid NOT NULL REFERENCES communication_identifiers(id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (person_id, communication_id)
);

CREATE TABLE IF NOT EXISTS person_location (
  person_id uuid NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (person_id, location_id)
);

CREATE TABLE IF NOT EXISTS person_organization (
  person_id uuid NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (person_id, organization_id)
);

CREATE TABLE IF NOT EXISTS person_person_relationship (
  person_a_id uuid NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  person_b_id uuid NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  relationship_type varchar(50) NOT NULL,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (person_a_id, person_b_id, relationship_type),
  CONSTRAINT ppr_distinct CHECK (person_a_id <> person_b_id)
);

CREATE TABLE IF NOT EXISTS incident_incident_relationship (
  incident_a_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  incident_b_id bigint NOT NULL REFERENCES case_master(case_master_id) ON DELETE CASCADE,
  relationship_type varchar(50) NOT NULL,
  source varchar(100),
  confidence numeric(5,4) NOT NULL DEFAULT 0.5000,
  verified boolean DEFAULT false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  evidence_type varchar(50),
  evidence_reference varchar(255),
  source_record_id varchar(150),
  analyst_verified boolean DEFAULT false,
  confidence_score numeric(5,4) DEFAULT 0.5000,
  explanation text,
  PRIMARY KEY (incident_a_id, incident_b_id, relationship_type),
  CONSTRAINT iir_distinct CHECK (incident_a_id <> incident_b_id)
);

-- Advanced Indexes
CREATE INDEX IF NOT EXISTS idx_weapons_category ON weapons(category);
CREATE INDEX IF NOT EXISTS idx_comm_ids_hashed ON communication_identifiers(hashed_value);
CREATE INDEX IF NOT EXISTS idx_import_profile_active ON import_profile(active);
CREATE INDEX IF NOT EXISTS idx_area_socio_indicator ON area_socioeconomic_values(indicator_id);
CREATE INDEX IF NOT EXISTS idx_area_socio_district ON area_socioeconomic_values(district_id) WHERE district_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_area_socio_ps ON area_socioeconomic_values(police_station_id) WHERE police_station_id IS NOT NULL;

-- Views
CREATE OR REPLACE VIEW analytics.v_repeat_offender_summaries AS
SELECT 
  cpr.person_id AS person_id,
  pm.masked_name AS masked_name,
  count(DISTINCT cpr.case_master_id) AS incident_count,
  string_agg(DISTINCT vi.crime_type, ', ') AS crime_categories,
  string_agg(DISTINCT vi.district, ', ') AS jurisdictions,
  min(vi.incident_date) AS first_incident_date,
  max(vi.incident_date) AS latest_incident_date
FROM case_person_role cpr
JOIN analytics.v_incidents vi ON vi.case_master_id = cpr.case_master_id
JOIN analytics.v_persons_masked pm ON pm.person_id = cpr.person_id
WHERE cpr.role_type = 'ACCUSED'
GROUP BY cpr.person_id, pm.masked_name;
