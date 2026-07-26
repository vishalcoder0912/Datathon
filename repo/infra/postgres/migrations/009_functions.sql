CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_case_incident_geometry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.incident_location = NULL;
  ELSE
    NEW.incident_location = ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_location_geometry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.geometry = NULL;
  ELSE
    NEW.geometry = ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_police_unit_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.location = NULL;
  ELSE
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_district_centroid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.boundary IS NOT NULL THEN
    NEW.centroid = ST_PointOnSurface(NEW.boundary)::geometry(Point, 4326);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION current_app_employee_id()
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  configured_value text;
BEGIN
  configured_value = nullif(current_setting('app.current_employee_id', true), '');
  IF configured_value ~ '^[0-9]+$' THEN
    RETURN configured_value::bigint;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION record_case_status_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.case_status_id IS DISTINCT FROM OLD.case_status_id THEN
    INSERT INTO case_status_history (
      case_master_id,
      previous_status_id,
      new_status_id,
      changed_by_employee_id,
      reason
    ) VALUES (
      NEW.case_master_id,
      OLD.case_status_id,
      NEW.case_status_id,
      current_app_employee_id(),
      nullif(current_setting('app.case_status_change_reason', true), '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION generate_crime_number(
  p_case_category_id integer,
  p_district_id integer,
  p_police_station_id integer,
  p_year integer
)
RETURNS TABLE (crime_no varchar(30), case_no varchar(20), running_serial integer)
LANGUAGE plpgsql
AS $$
DECLARE
  next_serial integer;
  category_code text;
  district_code text;
  station_code text;
BEGIN
  IF p_year NOT BETWEEN 2000 AND 9999 THEN
    RAISE EXCEPTION 'Case year must be between 2000 and 9999.' USING ERRCODE = '22023';
  END IF;

  SELECT btrim(cc.category_code) INTO category_code
  FROM case_category cc
  WHERE cc.case_category_id = p_case_category_id AND cc.active = true;

  SELECT btrim(d.district_code) INTO district_code
  FROM district d
  WHERE d.district_id = p_district_id AND d.active = true;

  SELECT btrim(pu.unit_code) INTO station_code
  FROM police_unit pu
  WHERE pu.unit_id = p_police_station_id
    AND pu.district_id = p_district_id
    AND pu.active = true;

  IF category_code IS NULL OR district_code IS NULL OR station_code IS NULL THEN
    RAISE EXCEPTION 'A valid active case category, district, and police station are required.' USING ERRCODE = '23503';
  END IF;

  INSERT INTO crime_number_counter (
    case_category_id,
    district_id,
    police_station_id,
    case_year,
    last_serial
  ) VALUES (
    p_case_category_id,
    p_district_id,
    p_police_station_id,
    p_year,
    1
  )
  ON CONFLICT (case_category_id, district_id, police_station_id, case_year)
  DO UPDATE SET
    last_serial = crime_number_counter.last_serial + 1,
    updated_at = now()
  RETURNING last_serial INTO next_serial;

  IF next_serial > 99999 THEN
    RAISE EXCEPTION 'Crime number serial capacity has been reached for this category, district, station, and year.' USING ERRCODE = '22003';
  END IF;

  running_serial = next_serial;
  crime_no = concat(category_code, district_code, station_code, lpad(p_year::text, 4, '0'), lpad(next_serial::text, 5, '0'));
  case_no = concat(lpad(p_year::text, 4, '0'), lpad(next_serial::text, 5, '0'));
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION normalise_person_name(input_value text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT nullif(regexp_replace(lower(unaccent(btrim(input_value))), '[[:space:]]+', ' ', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION district_for_point(
  p_longitude numeric,
  p_latitude numeric
)
RETURNS TABLE (district_id integer, district_name varchar(150))
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT ST_SetSRID(ST_MakePoint(p_longitude::double precision, p_latitude::double precision), 4326) AS point
  )
  SELECT d.district_id, d.district_name
  FROM district d
  CROSS JOIN target
  WHERE d.boundary IS NOT NULL
    AND ST_Covers(d.boundary, target.point)
  ORDER BY ST_Area(d.boundary) ASC
$$;

CREATE OR REPLACE FUNCTION police_stations_for_point(
  p_longitude numeric,
  p_latitude numeric
)
RETURNS TABLE (police_station_id integer, police_station_name varchar(200), district_id integer)
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT ST_SetSRID(ST_MakePoint(p_longitude::double precision, p_latitude::double precision), 4326) AS point
  )
  SELECT pu.unit_id, pu.unit_name, pu.district_id
  FROM police_unit pu
  JOIN unit_type ut ON ut.unit_type_id = pu.type_id
  CROSS JOIN target
  WHERE ut.unit_type_name = 'POLICE_STATION'
    AND pu.jurisdiction IS NOT NULL
    AND ST_Covers(pu.jurisdiction, target.point)
  ORDER BY pu.unit_name
$$;

CREATE OR REPLACE FUNCTION incidents_within_radius(
  p_longitude numeric,
  p_latitude numeric,
  p_radius_meters numeric,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (case_master_id bigint, crime_no varchar(30), distance_meters double precision)
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT ST_SetSRID(ST_MakePoint(p_longitude::double precision, p_latitude::double precision), 4326) AS point
  )
  SELECT
    cm.case_master_id,
    cm.crime_no,
    ST_Distance(cm.incident_location::geography, target.point::geography) AS distance_meters
  FROM case_master cm
  CROSS JOIN target
  WHERE p_radius_meters > 0
    AND cm.incident_location IS NOT NULL
    AND (p_date_from IS NULL OR cm.incident_from_at >= p_date_from)
    AND (p_date_to IS NULL OR cm.incident_from_at <= p_date_to)
    AND ST_DWithin(cm.incident_location::geography, target.point::geography, p_radius_meters)
  ORDER BY cm.incident_location <-> target.point
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 5000)
$$;

CREATE OR REPLACE FUNCTION incidents_in_bounds(
  p_min_longitude numeric,
  p_min_latitude numeric,
  p_max_longitude numeric,
  p_max_latitude numeric,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (case_master_id bigint, crime_no varchar(30), incident_location geometry(Point, 4326))
LANGUAGE sql
STABLE
AS $$
  WITH bounds AS (
    SELECT ST_MakeEnvelope(
      p_min_longitude::double precision,
      p_min_latitude::double precision,
      p_max_longitude::double precision,
      p_max_latitude::double precision,
      4326
    ) AS geometry
  )
  SELECT cm.case_master_id, cm.crime_no, cm.incident_location
  FROM case_master cm
  CROSS JOIN bounds
  WHERE p_min_longitude <= p_max_longitude
    AND p_min_latitude <= p_max_latitude
    AND cm.incident_location IS NOT NULL
    AND (p_date_from IS NULL OR cm.incident_from_at >= p_date_from)
    AND (p_date_to IS NULL OR cm.incident_from_at <= p_date_to)
    AND cm.incident_location && bounds.geometry
    AND ST_Intersects(cm.incident_location, bounds.geometry)
  ORDER BY COALESCE(cm.incident_from_at, cm.crime_registered_at) DESC
  LIMIT least(greatest(coalesce(p_limit, 1000), 1), 5000)
$$;

CREATE OR REPLACE FUNCTION neighbouring_districts(p_district_id integer)
RETURNS TABLE (district_id integer, district_name varchar(150))
LANGUAGE sql
STABLE
AS $$
  SELECT neighbour.district_id, neighbour.district_name
  FROM district origin
  JOIN district neighbour
    ON neighbour.district_id <> origin.district_id
   AND neighbour.boundary IS NOT NULL
   AND ST_Touches(origin.boundary, neighbour.boundary)
  WHERE origin.district_id = p_district_id
    AND origin.boundary IS NOT NULL
  ORDER BY neighbour.district_name
$$;

CREATE OR REPLACE FUNCTION nearest_police_station(
  p_longitude numeric,
  p_latitude numeric,
  p_limit integer DEFAULT 1
)
RETURNS TABLE (police_station_id integer, police_station_name varchar(200), district_id integer, distance_meters double precision)
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT ST_SetSRID(ST_MakePoint(p_longitude::double precision, p_latitude::double precision), 4326) AS point
  )
  SELECT
    pu.unit_id,
    pu.unit_name,
    pu.district_id,
    ST_Distance(pu.location::geography, target.point::geography) AS distance_meters
  FROM police_unit pu
  JOIN unit_type ut ON ut.unit_type_id = pu.type_id
  CROSS JOIN target
  WHERE ut.unit_type_name = 'POLICE_STATION'
    AND pu.location IS NOT NULL
  ORDER BY pu.location <-> target.point
  LIMIT least(greatest(coalesce(p_limit, 1), 1), 25)
$$;

DROP TRIGGER IF EXISTS trg_district_centroid ON district;
CREATE TRIGGER trg_district_centroid
BEFORE INSERT OR UPDATE OF boundary ON district
FOR EACH ROW EXECUTE FUNCTION set_district_centroid();

DROP TRIGGER IF EXISTS trg_police_unit_location ON police_unit;
CREATE TRIGGER trg_police_unit_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON police_unit
FOR EACH ROW EXECUTE FUNCTION set_police_unit_location();

DROP TRIGGER IF EXISTS trg_case_master_incident_geometry ON case_master;
CREATE TRIGGER trg_case_master_incident_geometry
BEFORE INSERT OR UPDATE OF latitude, longitude ON case_master
FOR EACH ROW EXECUTE FUNCTION set_case_incident_geometry();

DROP TRIGGER IF EXISTS trg_location_geometry ON location;
CREATE TRIGGER trg_location_geometry
BEFORE INSERT OR UPDATE OF latitude, longitude ON location
FOR EACH ROW EXECUTE FUNCTION set_location_geometry();

DROP TRIGGER IF EXISTS trg_case_status_history ON case_master;
CREATE TRIGGER trg_case_status_history
AFTER UPDATE OF case_status_id ON case_master
FOR EACH ROW EXECUTE FUNCTION record_case_status_history();

DROP TRIGGER IF EXISTS trg_state_updated_at ON state;
CREATE TRIGGER trg_state_updated_at
BEFORE UPDATE ON state
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_district_updated_at ON district;
CREATE TRIGGER trg_district_updated_at
BEFORE UPDATE ON district
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_police_unit_updated_at ON police_unit;
CREATE TRIGGER trg_police_unit_updated_at
BEFORE UPDATE ON police_unit
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_employee_updated_at ON employee;
CREATE TRIGGER trg_employee_updated_at
BEFORE UPDATE ON employee
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_case_master_updated_at ON case_master;
CREATE TRIGGER trg_case_master_updated_at
BEFORE UPDATE ON case_master
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_person_updated_at ON person;
CREATE TRIGGER trg_person_updated_at
BEFORE UPDATE ON person
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_modus_operandi_updated_at ON modus_operandi;
CREATE TRIGGER trg_modus_operandi_updated_at
BEFORE UPDATE ON modus_operandi
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_account_updated_at ON user_account;
CREATE TRIGGER trg_user_account_updated_at
BEFORE UPDATE ON user_account
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
