CREATE INDEX IF NOT EXISTS idx_district_state_id ON district(state_id);
CREATE INDEX IF NOT EXISTS idx_police_unit_district_id ON police_unit(district_id);
CREATE INDEX IF NOT EXISTS idx_police_unit_parent_unit_id ON police_unit(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_employee_district_unit ON employee(district_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_case_master_crime_registered_at ON case_master(crime_registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_master_incident_from_at ON case_master(incident_from_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_master_police_station_id ON case_master(police_station_id);
CREATE INDEX IF NOT EXISTS idx_case_master_case_status_id ON case_master(case_status_id);
CREATE INDEX IF NOT EXISTS idx_case_master_crime_major_head_id ON case_master(crime_major_head_id);
CREATE INDEX IF NOT EXISTS idx_case_master_crime_minor_head_id ON case_master(crime_minor_head_id);
CREATE INDEX IF NOT EXISTS idx_case_master_source_record ON case_master(source_system, source_record_id) WHERE source_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_master_active_window ON case_master(police_station_id, incident_from_at DESC) WHERE case_status_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_complainant_details_case_master_id ON complainant_details(case_master_id);
CREATE INDEX IF NOT EXISTS idx_victim_case_master_id ON victim(case_master_id);
CREATE INDEX IF NOT EXISTS idx_accused_case_master_id ON accused(case_master_id);
CREATE INDEX IF NOT EXISTS idx_accused_canonical_person_id ON accused(canonical_person_id) WHERE canonical_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_person_role_person_id ON case_person_role(person_id);
CREATE INDEX IF NOT EXISTS idx_case_person_role_case_master_id ON case_person_role(case_master_id);
CREATE INDEX IF NOT EXISTS idx_case_person_role_case_role ON case_person_role(case_master_id, role_type);
CREATE INDEX IF NOT EXISTS idx_arrest_surrender_case_master_id ON arrest_surrender(case_master_id);
CREATE INDEX IF NOT EXISTS idx_arrest_surrender_district_id ON arrest_surrender(district_id);
CREATE INDEX IF NOT EXISTS idx_chargesheet_details_case_master_id ON chargesheet_details(case_master_id);
CREATE INDEX IF NOT EXISTS idx_case_status_history_case_changed_at ON case_status_history(case_master_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_act_section_association_case_master_id ON act_section_association(case_master_id);
CREATE INDEX IF NOT EXISTS idx_case_location_location_id ON case_location(location_id);
CREATE INDEX IF NOT EXISTS idx_case_vehicle_vehicle_id ON case_vehicle(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_alert_status ON alert(status);
CREATE INDEX IF NOT EXISTS idx_alert_severity ON alert(severity);
CREATE INDEX IF NOT EXISTS idx_alert_detected_at ON alert(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_district_id ON alert(district_id);
CREATE INDEX IF NOT EXISTS idx_alert_open_feed ON alert(detected_at DESC, district_id, police_station_id) WHERE status IN ('OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW');
CREATE INDEX IF NOT EXISTS idx_alert_evidence_alert_id ON alert_evidence(alert_id);
CREATE INDEX IF NOT EXISTS idx_prediction_district_forecast ON prediction(district_id, forecast_start DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_risk_band ON prediction(risk_band);
CREATE INDEX IF NOT EXISTS idx_prediction_station_forecast ON prediction(police_station_id, forecast_start DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_factor_prediction_id ON prediction_factor(prediction_id);
CREATE INDEX IF NOT EXISTS idx_model_run_model_version_started ON model_run(model_version_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created_at ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created_at ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_import_status ON data_import(status);
CREATE INDEX IF NOT EXISTS idx_data_import_error_import_id ON data_import_error(import_id, row_number);
CREATE INDEX IF NOT EXISTS idx_data_quality_issue_status ON data_quality_issue(status);
CREATE INDEX IF NOT EXISTS idx_data_quality_issue_type ON data_quality_issue(issue_type);
CREATE INDEX IF NOT EXISTS idx_data_quality_issue_import ON data_quality_issue(import_id) WHERE import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_source_record_map_lookup ON source_record_map(source_system, source_record_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_copilot_query_user_created_at ON copilot_query(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_generated_by ON intelligence_report(generated_by, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_token_active ON refresh_token(user_id, expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_account_scope ON user_account(district_id, unit_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_auth_login_attempt_window ON auth_login_attempt(email_hash, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_person_normalized_name_trgm ON person USING gin(normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_person_alias_normalized_alias_trgm ON person_alias USING gin(normalized_alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_modus_operandi_text_trgm ON modus_operandi USING gin(mo_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_case_master_brief_facts_trgm ON case_master USING gin(brief_facts gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_case_master_incident_location_gist ON case_master USING gist(incident_location);
CREATE INDEX IF NOT EXISTS idx_location_geometry_gist ON location USING gist(geometry);
CREATE INDEX IF NOT EXISTS idx_district_boundary_gist ON district USING gist(boundary);
CREATE INDEX IF NOT EXISTS idx_police_unit_jurisdiction_gist ON police_unit USING gist(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_police_unit_location_gist ON police_unit USING gist(location);
