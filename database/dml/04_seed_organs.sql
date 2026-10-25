-- =============================================================================
-- VITAL: Seed Data - Kidneys in Inventory
-- Strict Scope: organ_type = 'KIDNEY' only
-- Expiry calculations simulate cold ischemia time limits
-- =============================================================================

-- Kidney 401: Available, unexpired, 28 hours viable
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (401, 201, 'KIDNEY', 28.0, SYSTIMESTAMP - INTERVAL '4' HOUR, SYSTIMESTAMP + INTERVAL '24' HOUR, 'AVAILABLE', 101);

-- Kidney 402: Available, unexpired, 30 hours viable
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (402, 202, 'KIDNEY', 30.0, SYSTIMESTAMP - INTERVAL '6' HOUR, SYSTIMESTAMP + INTERVAL '24' HOUR, 'AVAILABLE', 102);

-- Kidney 403: Available, unexpired, 24 hours viable
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (403, 203, 'KIDNEY', 24.0, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP + INTERVAL '22' HOUR, 'AVAILABLE', 104);

-- Kidney 404: Available, universal donor (O-), 36 hours viable
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (404, 205, 'KIDNEY', 36.0, SYSTIMESTAMP - INTERVAL '8' HOUR, SYSTIMESTAMP + INTERVAL '28' HOUR, 'AVAILABLE', 105);

-- Kidney 405: Already allocated in previous successful match
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (405, 204, 'KIDNEY', 24.0, SYSTIMESTAMP - INTERVAL '40' HOUR, SYSTIMESTAMP - INTERVAL '16' HOUR, 'ALLOCATED', 103);

-- Kidney 406: Expired (exceeded cold ischemia threshold - demonstrates BR4 expiry rule)
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (406, 207, 'KIDNEY', 20.0, SYSTIMESTAMP - INTERVAL '30' HOUR, SYSTIMESTAMP - INTERVAL '10' HOUR, 'EXPIRED', 104);

COMMIT;
