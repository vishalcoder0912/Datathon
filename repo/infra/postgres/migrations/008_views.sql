CREATE OR REPLACE VIEW analytics.v_incidents AS
SELECT
  cm.crime_no AS fir_number,
  cm.case_master_id,
  (COALESCE(cm.incident_from_at, cm.crime_registered_at) AT TIME ZONE 'Asia/Kolkata')::date AS incident_date,
  to_char(COALESCE(cm.incident_from_at, cm.crime_registered_at) AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS incident_time,
  (cm.crime_registered_at AT TIME ZONE 'Asia/Kolkata')::date AS registered_date,
  d.district_name AS district,
  d.district_id,
  pu.unit_name AS police_station,
  pu.unit_id AS police_station_id,
  COALESCE(ch.crime_group_name, 'Uncategorized') AS crime_type,
  ch.crime_group_name AS crime_major_head,
  csh.crime_head_name AS crime_sub_head,
  go.lookup_value AS severity,
  cs.case_status_name AS status,
  cm.latitude,
  cm.longitude,
  cm.brief_facts,
  mo.modus_operandi,
  court.court_name,
  csd.chargesheet_status
FROM case_master cm
JOIN police_unit pu ON pu.unit_id = cm.police_station_id
LEFT JOIN district d ON d.district_id = pu.district_id
LEFT JOIN crime_head ch ON ch.crime_head_id = cm.crime_major_head_id
LEFT JOIN crime_sub_head csh ON csh.crime_sub_head_id = cm.crime_minor_head_id
LEFT JOIN gravity_offence go ON go.gravity_offence_id = cm.gravity_offence_id
LEFT JOIN case_status cs ON cs.case_status_id = cm.case_status_id
LEFT JOIN court ON court.court_id = cm.court_id
LEFT JOIN LATERAL (
  SELECT COALESCE(NULLIF(mo_text, ''), NULLIF(entry_method, ''), 'Not recorded') AS modus_operandi
  FROM modus_operandi
  WHERE case_master_id = cm.case_master_id
  ORDER BY (verification_status = 'VERIFIED') DESC, confidence DESC, created_at ASC
  LIMIT 1
) mo ON true
LEFT JOIN LATERAL (
  SELECT string_agg(
    CASE report_type
      WHEN 'A' THEN 'CHARGESHEET'
      WHEN 'B' THEN 'FALSE_CASE'
      WHEN 'C' THEN 'UNDETECTED'
    END,
    ', ' ORDER BY chargesheet_at DESC NULLS LAST
  ) AS chargesheet_status
  FROM chargesheet_details
  WHERE case_master_id = cm.case_master_id
) csd ON true;

CREATE OR REPLACE VIEW analytics.v_incident_persons AS
SELECT
  cpr.case_master_id AS incident_id,
  cpr.case_master_id,
  cpr.person_id,
  cpr.role_type AS role,
  cpr.confidence,
  cpr.is_verified
FROM case_person_role cpr;

CREATE OR REPLACE VIEW analytics.v_persons_masked AS
WITH person_activity AS (
  SELECT
    p.person_id,
    p.full_name,
    p.date_of_birth,
    p.estimated_birth_year,
    g.code AS gender_code,
    count(DISTINCT cpr.case_master_id) AS case_count,
    count(DISTINCT d.district_id) AS district_count,
    max(COALESCE(cm.incident_from_at, cm.crime_registered_at)) AS last_activity_at
  FROM person p
  LEFT JOIN gender g ON g.gender_id = p.gender_id
  LEFT JOIN case_person_role cpr ON cpr.person_id = p.person_id
  LEFT JOIN case_master cm ON cm.case_master_id = cpr.case_master_id
  LEFT JOIN police_unit pu ON pu.unit_id = cm.police_station_id
  LEFT JOIN district d ON d.district_id = pu.district_id
  GROUP BY p.person_id, p.full_name, p.date_of_birth, p.estimated_birth_year, g.code
), with_age AS (
  SELECT
    *,
    COALESCE(
      extract(year FROM age(current_date, date_of_birth))::integer,
      extract(year FROM current_date)::integer - estimated_birth_year
    ) AS estimated_age
  FROM person_activity
)
SELECT
  person_id,
  CASE
    WHEN full_name IS NULL OR btrim(full_name) = '' THEN 'Masked person'
    ELSE concat(
      left(split_part(btrim(full_name), ' ', 1), 1),
      '*** ',
      left(regexp_replace(btrim(full_name), '^.*[[:space:]]+', ''), 1),
      '***'
    )
  END AS masked_name,
  CASE
    WHEN estimated_age IS NULL THEN 'UNKNOWN'
    WHEN estimated_age < 18 THEN 'UNDER_18'
    WHEN estimated_age < 25 THEN '18_24'
    WHEN estimated_age < 45 THEN '25_44'
    WHEN estimated_age < 65 THEN '45_64'
    ELSE '65_PLUS'
  END AS age_band,
  gender_code,
  CASE
    WHEN case_count >= 2 AND district_count > 1 THEN 'CROSS_DISTRICT_LINKS'
    WHEN case_count >= 2 THEN 'MULTIPLE_CASE_LINKS'
    ELSE 'SINGLE_CASE_LINK'
  END AS risk_label,
  case_count,
  district_count,
  last_activity_at
FROM with_age;

CREATE OR REPLACE VIEW analytics.v_district_indicators AS
SELECT
  d.district_id,
  d.district_code,
  d.district_name AS district,
  d.state_id,
  i.period_start,
  i.period_end,
  i.population,
  i.population_density,
  i.urbanization_rate,
  i.literacy_rate,
  i.unemployment_rate,
  i.poverty_rate,
  i.police_presence,
  i.street_light_coverage,
  i.public_transport_access,
  i.source_name,
  i.is_synthetic,
  'Correlation does not establish causation.'::text AS correlation_notice
FROM district d
LEFT JOIN LATERAL (
  SELECT *
  FROM district_socioeconomic_indicator indicator
  WHERE indicator.district_id = d.district_id
  ORDER BY indicator.period_end DESC, indicator.created_at DESC
  LIMIT 1
) i ON true;

CREATE OR REPLACE VIEW analytics.v_case_network_edges AS
SELECT
  concat('person:', cpr.person_id::text) AS source_id,
  'PERSON'::text AS source_type,
  concat('case:', cpr.case_master_id::text) AS target_id,
  'CASE'::text AS target_type,
  CASE cpr.role_type
    WHEN 'ACCUSED' THEN 'ACCUSED_IN'
    WHEN 'VICTIM' THEN 'VICTIM_IN'
    WHEN 'COMPLAINANT' THEN 'COMPLAINANT_IN'
    WHEN 'ARRESTED_PERSON' THEN 'ARRESTED_IN'
    ELSE 'ASSOCIATED_WITH'
  END::text AS relationship_type,
  1::numeric AS weight,
  cpr.case_master_id,
  jsonb_build_array(jsonb_build_object(
    'caseMasterId', cpr.case_master_id,
    'reason', concat(cpr.role_type, ' role recorded for this case.'),
    'confidence', cpr.confidence
  )) AS evidence
FROM case_person_role cpr

UNION ALL

SELECT
  concat('case:', cl.case_master_id::text),
  'CASE'::text,
  concat('location:', cl.location_id::text),
  'LOCATION'::text,
  CASE WHEN cl.relationship_type = 'INCIDENT_LOCATION' THEN 'OCCURRED_AT' ELSE 'SHARED_LOCATION' END::text,
  1::numeric,
  cl.case_master_id,
  jsonb_build_array(jsonb_build_object(
    'caseMasterId', cl.case_master_id,
    'reason', replace(lower(cl.relationship_type), '_', ' '),
    'confidence', cl.confidence
  ))
FROM case_location cl

UNION ALL

SELECT
  concat('case:', cm.case_master_id::text),
  'CASE'::text,
  concat('station:', cm.police_station_id::text),
  'POLICE_STATION'::text,
  'REGISTERED_AT'::text,
  1::numeric,
  cm.case_master_id,
  jsonb_build_array(jsonb_build_object('caseMasterId', cm.case_master_id, 'reason', 'Case registered by this police station.'))
FROM case_master cm

UNION ALL

SELECT
  concat('station:', pu.unit_id::text),
  'POLICE_STATION'::text,
  concat('district:', d.district_id::text),
  'DISTRICT'::text,
  'IN_DISTRICT'::text,
  1::numeric,
  NULL::bigint,
  jsonb_build_array(jsonb_build_object('districtId', d.district_id, 'reason', 'Police station belongs to this district.'))
FROM police_unit pu
JOIN district d ON d.district_id = pu.district_id

UNION ALL

SELECT
  concat('case:', mo.case_master_id::text),
  'CASE'::text,
  concat('mo:', mo.mo_id::text),
  'MODUS_OPERANDI'::text,
  'USES_MO'::text,
  1::numeric,
  mo.case_master_id,
  jsonb_build_array(jsonb_build_object(
    'caseMasterId', mo.case_master_id,
    'reason', 'Modus operandi record linked to this case.',
    'confidence', mo.confidence
  ))
FROM modus_operandi mo

UNION ALL

SELECT
  concat('case:', asa.case_master_id::text),
  'CASE'::text,
  concat('section:', asa.act_code, ':', asa.section_code),
  'ACT_SECTION'::text,
  'INVOKES_SECTION'::text,
  1::numeric,
  asa.case_master_id,
  jsonb_build_array(jsonb_build_object(
    'caseMasterId', asa.case_master_id,
    'reason', concat(asa.act_code, ' section ', asa.section_code, ' associated with this case.')
  ))
FROM act_section_association asa

UNION ALL

SELECT
  concat('case:', cv.case_master_id::text),
  'CASE'::text,
  concat('vehicle:', cv.vehicle_id::text),
  'VEHICLE'::text,
  'USES_VEHICLE'::text,
  1::numeric,
  cv.case_master_id,
  jsonb_build_array(jsonb_build_object(
    'caseMasterId', cv.case_master_id,
    'reason', concat('Vehicle relationship: ', cv.relationship_type),
    'confidence', cv.confidence
  ))
FROM case_vehicle cv

UNION ALL

SELECT
  concat('person:', co_accused.source_person_id),
  'PERSON'::text,
  concat('person:', co_accused.target_person_id),
  'PERSON'::text,
  'CO_ACCUSED_WITH'::text,
  co_accused.weight,
  co_accused.first_case_master_id,
  co_accused.evidence
FROM (
  SELECT
    least(left_role.person_id::text, right_role.person_id::text) AS source_person_id,
    greatest(left_role.person_id::text, right_role.person_id::text) AS target_person_id,
    count(DISTINCT left_role.case_master_id)::numeric AS weight,
    min(left_role.case_master_id) AS first_case_master_id,
    jsonb_agg(
      jsonb_build_object(
        'caseMasterId', left_role.case_master_id,
        'reason', 'Both persons were listed as accused in this case.'
      ) ORDER BY left_role.case_master_id
    ) AS evidence
  FROM case_person_role left_role
  JOIN case_person_role right_role
    ON right_role.case_master_id = left_role.case_master_id
   AND right_role.role_type = 'ACCUSED'
   AND right_role.person_id::text > left_role.person_id::text
  WHERE left_role.role_type = 'ACCUSED'
  GROUP BY least(left_role.person_id::text, right_role.person_id::text), greatest(left_role.person_id::text, right_role.person_id::text)
) co_accused;

CREATE OR REPLACE VIEW analytics.v_district_hotspot_aggregation AS
SELECT
  d.district_id,
  d.district_name,
  date_trunc('month', COALESCE(cm.incident_from_at, cm.crime_registered_at)) AS period_start,
  ST_SnapToGrid(cm.incident_location, 0.01) AS grid_cell,
  ST_Centroid(ST_Collect(cm.incident_location))::geometry(Point, 4326) AS centroid,
  count(*) AS incident_count,
  array_remove(array_agg(DISTINCT ch.crime_group_name), NULL) AS crime_categories
FROM case_master cm
JOIN police_unit pu ON pu.unit_id = cm.police_station_id
JOIN district d ON d.district_id = pu.district_id
LEFT JOIN crime_head ch ON ch.crime_head_id = cm.crime_major_head_id
WHERE cm.incident_location IS NOT NULL
GROUP BY
  d.district_id,
  d.district_name,
  date_trunc('month', COALESCE(cm.incident_from_at, cm.crime_registered_at)),
  ST_SnapToGrid(cm.incident_location, 0.01);

CREATE OR REPLACE VIEW analytics.v_station_hotspot_aggregation AS
SELECT
  pu.unit_id AS police_station_id,
  pu.unit_name AS police_station,
  pu.district_id,
  date_trunc('month', COALESCE(cm.incident_from_at, cm.crime_registered_at)) AS period_start,
  ST_SnapToGrid(cm.incident_location, 0.01) AS grid_cell,
  ST_Centroid(ST_Collect(cm.incident_location))::geometry(Point, 4326) AS centroid,
  count(*) AS incident_count,
  array_remove(array_agg(DISTINCT ch.crime_group_name), NULL) AS crime_categories
FROM case_master cm
JOIN police_unit pu ON pu.unit_id = cm.police_station_id
LEFT JOIN crime_head ch ON ch.crime_head_id = cm.crime_major_head_id
WHERE cm.incident_location IS NOT NULL
GROUP BY
  pu.unit_id,
  pu.unit_name,
  pu.district_id,
  date_trunc('month', COALESCE(cm.incident_from_at, cm.crime_registered_at)),
  ST_SnapToGrid(cm.incident_location, 0.01);

CREATE OR REPLACE VIEW alerts AS
SELECT *
FROM alert;
