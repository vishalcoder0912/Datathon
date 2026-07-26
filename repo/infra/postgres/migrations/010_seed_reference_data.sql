INSERT INTO gender (gender_id, code, name, active) VALUES
  (1, 'M', 'Male', true),
  (2, 'F', 'Female', true),
  (3, 'T', 'Transgender', true),
  (4, 'U', 'Unspecified', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active;

INSERT INTO state (state_id, state_name, nationality_id, active) VALUES
  (29, 'Karnataka', 356, true)
ON CONFLICT (state_name) DO UPDATE SET nationality_id = EXCLUDED.nationality_id, active = EXCLUDED.active;

INSERT INTO unit_type (unit_type_id, unit_type_name, operational_level, hierarchy, active) VALUES
  (1, 'POLICE_STATION', 'STATION', 4, true),
  (2, 'SUB_DIVISION', 'SUB_DIVISION', 3, true),
  (3, 'DISTRICT_POLICE', 'DISTRICT', 2, true),
  (4, 'STATE_POLICE', 'STATE', 1, true)
ON CONFLICT (unit_type_name) DO UPDATE SET
  operational_level = EXCLUDED.operational_level,
  hierarchy = EXCLUDED.hierarchy,
  active = EXCLUDED.active;

INSERT INTO police_rank (rank_id, rank_name, hierarchy, active) VALUES
  (1, 'Constable', 10, true),
  (2, 'Head Constable', 20, true),
  (3, 'Sub Inspector', 30, true),
  (4, 'Inspector', 40, true),
  (5, 'Deputy Superintendent', 50, true),
  (6, 'Superintendent', 60, true)
ON CONFLICT (rank_name) DO UPDATE SET hierarchy = EXCLUDED.hierarchy, active = EXCLUDED.active;

INSERT INTO designation (designation_id, designation_name, active, sort_order) VALUES
  (1, 'Investigating Officer', true, 10),
  (2, 'Station House Officer', true, 20),
  (3, 'District Analyst', true, 30),
  (4, 'Data Engineer', true, 40)
ON CONFLICT (designation_name) DO UPDATE SET active = EXCLUDED.active, sort_order = EXCLUDED.sort_order;

INSERT INTO case_category (case_category_id, category_code, lookup_value, active) VALUES
  (1, '1', 'FIR', true),
  (3, '3', 'UDR', true),
  (4, '4', 'PAR', true),
  (8, '8', 'ZERO_FIR', true)
ON CONFLICT (category_code) DO UPDATE SET lookup_value = EXCLUDED.lookup_value, active = EXCLUDED.active;

INSERT INTO gravity_offence (gravity_offence_id, lookup_value, severity_weight, active) VALUES
  (1, 'LOW', 1.00, true),
  (2, 'MEDIUM', 2.00, true),
  (3, 'HIGH', 3.00, true),
  (4, 'CRITICAL', 4.00, true)
ON CONFLICT (lookup_value) DO UPDATE SET severity_weight = EXCLUDED.severity_weight, active = EXCLUDED.active;

INSERT INTO case_status (case_status_id, case_status_name, is_terminal, active) VALUES
  (1, 'PENDING', false, true),
  (2, 'UNDER_INVESTIGATION', false, true),
  (3, 'CHARGESHEETED', true, true),
  (4, 'CLOSED', true, true),
  (5, 'COLD', false, true),
  (6, 'FALSE_CASE', true, true),
  (7, 'UNDETECTED', true, true)
ON CONFLICT (case_status_name) DO UPDATE SET is_terminal = EXCLUDED.is_terminal, active = EXCLUDED.active;

INSERT INTO occupation_master (occupation_id, occupation_name, active) VALUES
  (1, 'NOT_RECORDED', true),
  (2, 'STUDENT', true),
  (3, 'SELF_EMPLOYED', true),
  (4, 'PRIVATE_EMPLOYEE', true),
  (5, 'PUBLIC_EMPLOYEE', true),
  (6, 'HOMEMAKER', true)
ON CONFLICT (occupation_name) DO UPDATE SET active = EXCLUDED.active;

INSERT INTO religion_master (religion_id, religion_name, active, source_compatibility_only) VALUES
  (1, 'NOT_RECORDED', true, true)
ON CONFLICT (religion_name) DO UPDATE SET active = EXCLUDED.active, source_compatibility_only = true;

INSERT INTO caste_master (caste_id, caste_name, active, source_compatibility_only) VALUES
  (1, 'NOT_RECORDED', true, true)
ON CONFLICT (caste_name) DO UPDATE SET active = EXCLUDED.active, source_compatibility_only = true;

INSERT INTO act (act_code, act_description, short_name, active) VALUES
  ('SYNTHETIC', 'Synthetic demonstration act used only for KAVACH prototype records.', 'Synthetic demo act', true)
ON CONFLICT (act_code) DO UPDATE SET act_description = EXCLUDED.act_description, short_name = EXCLUDED.short_name, active = EXCLUDED.active;

INSERT INTO legal_section (act_code, section_code, section_description, active) VALUES
  ('SYNTHETIC', 'GEN', 'Synthetic prototype section; not a real legal provision.', true)
ON CONFLICT (act_code, section_code) DO UPDATE SET section_description = EXCLUDED.section_description, active = EXCLUDED.active;

INSERT INTO crime_head (crime_head_id, crime_group_name, active) VALUES
  (101, 'Assault', true),
  (102, 'Burglary', true),
  (103, 'Cybercrime', true),
  (104, 'Drug Offence', true),
  (105, 'Chain Snatching', true),
  (106, 'Criminal Trespass', true),
  (107, 'Kidnapping', true),
  (108, 'Fraud', true),
  (109, 'Arson', true),
  (110, 'Vehicle Theft', true),
  (111, 'Pickpocketing', true),
  (112, 'Domestic Violence', true),
  (113, 'Robbery', true),
  (114, 'Murder', true),
  (115, 'Sexual Offence', true)
ON CONFLICT (crime_group_name) DO UPDATE SET active = EXCLUDED.active;

INSERT INTO crime_sub_head (crime_sub_head_id, crime_head_id, crime_head_name, seq_id, active) VALUES
  (201, 101, 'Assault', 1, true),
  (202, 102, 'Burglary', 1, true),
  (203, 103, 'Cybercrime', 1, true),
  (204, 104, 'Drug Offence', 1, true),
  (205, 105, 'Chain Snatching', 1, true),
  (206, 106, 'Criminal Trespass', 1, true),
  (207, 107, 'Kidnapping', 1, true),
  (208, 108, 'Fraud', 1, true),
  (209, 109, 'Arson', 1, true),
  (210, 110, 'Vehicle Theft', 1, true),
  (211, 111, 'Pickpocketing', 1, true),
  (212, 112, 'Domestic Violence', 1, true),
  (213, 113, 'Robbery', 1, true),
  (214, 114, 'Murder', 1, true),
  (215, 115, 'Sexual Offence', 1, true)
ON CONFLICT (crime_sub_head_id) DO UPDATE SET
  crime_head_id = EXCLUDED.crime_head_id,
  crime_head_name = EXCLUDED.crime_head_name,
  seq_id = EXCLUDED.seq_id,
  active = EXCLUDED.active;

INSERT INTO crime_head_act_section (crime_head_id, act_code, section_code)
SELECT crime_head_id, 'SYNTHETIC', 'GEN'
FROM crime_head
ON CONFLICT DO NOTHING;

INSERT INTO role_permission (role_code, permission_code) VALUES
  ('STATE_ADMIN', 'ADMIN_ALL'),
  ('SCRB_ANALYST', 'INTELLIGENCE_READ_AGGREGATE'),
  ('DISTRICT_OFFICER', 'DISTRICT_INTELLIGENCE_READ'),
  ('STATION_OFFICER', 'STATION_INTELLIGENCE_READ'),
  ('INVESTIGATOR', 'ASSIGNED_CASE_READ'),
  ('EVALUATOR', 'SYNTHETIC_READ_MASKED'),
  ('AUDITOR', 'AUDIT_READ'),
  ('DATA_ENGINEER', 'DATA_MANAGEMENT')
ON CONFLICT DO NOTHING;

INSERT INTO model_version (
  model_name,
  model_type,
  version,
  feature_schema,
  parameters,
  metrics,
  training_period,
  active
) VALUES (
  'district-risk',
  'TRANSPARENT_COMPOSITE',
  'district-risk-1.0.0',
  '["recent_trend_increase", "historical_frequency", "serious_offence_concentration", "night_time_concentration", "hotspot_persistence", "cross_district_network_activity", "repeat_offender_case_links", "data_quality_penalty"]'::jsonb,
  '{"recentTrendIncrease":0.25,"historicalFrequency":0.20,"seriousOffenceConcentration":0.15,"nightTimeConcentration":0.10,"hotspotPersistence":0.10,"crossDistrictNetworkActivity":0.10,"repeatOffenderCaseLinks":0.05,"dataQualityPenalty":0.05}'::jsonb,
  '{"status":"baseline","humanReviewRequired":true}'::jsonb,
  '{"synthetic":true}'::jsonb,
  true
)
ON CONFLICT (model_name, version) DO UPDATE SET
  feature_schema = EXCLUDED.feature_schema,
  parameters = EXCLUDED.parameters,
  metrics = EXCLUDED.metrics,
  training_period = EXCLUDED.training_period,
  active = EXCLUDED.active;

SELECT setval(pg_get_serial_sequence('gender', 'gender_id'), greatest((SELECT max(gender_id) FROM gender), 1), true);
SELECT setval(pg_get_serial_sequence('state', 'state_id'), greatest((SELECT max(state_id) FROM state), 1), true);
SELECT setval(pg_get_serial_sequence('unit_type', 'unit_type_id'), greatest((SELECT max(unit_type_id) FROM unit_type), 1), true);
SELECT setval(pg_get_serial_sequence('police_rank', 'rank_id'), greatest((SELECT max(rank_id) FROM police_rank), 1), true);
SELECT setval(pg_get_serial_sequence('designation', 'designation_id'), greatest((SELECT max(designation_id) FROM designation), 1), true);
SELECT setval(pg_get_serial_sequence('case_category', 'case_category_id'), greatest((SELECT max(case_category_id) FROM case_category), 1), true);
SELECT setval(pg_get_serial_sequence('gravity_offence', 'gravity_offence_id'), greatest((SELECT max(gravity_offence_id) FROM gravity_offence), 1), true);
SELECT setval(pg_get_serial_sequence('case_status', 'case_status_id'), greatest((SELECT max(case_status_id) FROM case_status), 1), true);
SELECT setval(pg_get_serial_sequence('occupation_master', 'occupation_id'), greatest((SELECT max(occupation_id) FROM occupation_master), 1), true);
SELECT setval(pg_get_serial_sequence('religion_master', 'religion_id'), greatest((SELECT max(religion_id) FROM religion_master), 1), true);
SELECT setval(pg_get_serial_sequence('caste_master', 'caste_id'), greatest((SELECT max(caste_id) FROM caste_master), 1), true);
SELECT setval(pg_get_serial_sequence('crime_head', 'crime_head_id'), greatest((SELECT max(crime_head_id) FROM crime_head), 1), true);
SELECT setval(pg_get_serial_sequence('crime_sub_head', 'crime_sub_head_id'), greatest((SELECT max(crime_sub_head_id) FROM crime_sub_head), 1), true);
