# KAVACH AI Database Schema

The schema uses snake_case table names and PostgreSQL foreign keys. All people and cases in the demo are synthetic.

## Core reference and case data

- `state`, `district`, `unit_type`, `police_unit`, `gender`, `case_category`, `case_status`, `gravity_offence`, `crime_head`, `crime_sub_head`, `act`, and `legal_section` normalize the FIR-shaped source data.
- `case_master` contains the generated valid `crime_no`, registration/incident timestamps, station, classification, legal/status references, and PostGIS incident point.
- `complainant_details`, `victim`, `accused`, `act_section_association`, `arrest_surrender`, `chargesheet_details`, and `case_status_history` retain role-specific facts.
- `crime_number_counter` plus `generate_crime_number(...)` atomically generate `category + district + station + year + serial` identifiers.

## Identity, location, and graph data

- `person`, `person_alias`, `case_person_role`, and `person_identity_match` maintain canonical identity suggestions without automatic low-confidence merging.
- `location`, `case_location`, `vehicle`, and `case_vehicle` create explainable case links.
- `modus_operandi` stores structured fields, text, extracted features, confidence, and verification state.

## Analytics and governance data

- `alert`, `alert_evidence`, `model_version`, `model_run`, `prediction`, and `prediction_factor` preserve explainable operational outputs.
- `district_socioeconomic_indicator` is restricted to aggregate synthetic correlation research.
- `data_import`, `data_import_error`, and `data_quality_issue` implement validation-before-commit.
- `audit_log`, `intelligence_report`, and `copilot_query` provide accountability.
- `user_account`, `refresh_token`, `role_permission`, and `user_case_assignment` implement local access control.

## Safety-relevant views

- `analytics.v_incidents` preserves the legacy incident API shape.
- `analytics.v_incident_persons` provides role links.
- `analytics.v_persons_masked` avoids raw phone, address, identifier hashes, DOB, and complainant data.
- `analytics.v_district_indicators` exposes aggregate research fields only.
- `analytics.v_case_network_edges` gives case-backed edge evidence to graph consumers.

Religion and caste compatibility tables are never used as risk, hotspot, network, or predictive features.
