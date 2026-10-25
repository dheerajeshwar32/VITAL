-- =============================================================================
-- VITAL: Relational Views (Review 2 Rubric - Component C)
-- Implements:
-- 1. V_AVAILABLE_KIDNEYS
-- 2. V_WAITING_RECIPIENTS
-- 3. V_KIDNEY_MATCH_RESULTS
-- 4. V_ALLOCATION_HISTORY
-- 5. V_ALLOCATION_AUDIT
-- =============================================================================

-- View 1: Available, unexpired kidneys with cold ischemia time remaining
CREATE OR REPLACE VIEW V_AVAILABLE_KIDNEYS AS
SELECT 
    o.organ_id,
    o.donor_id,
    d.full_name AS donor_reference,
    d.blood_group,
    d.hla_type,
    d.donor_type,
    o.viable_hours,
    o.available_since,
    o.expiry_time,
    ROUND((CAST(o.expiry_time AS DATE) - CAST(SYSTIMESTAMP AS DATE)) * 24, 2) AS hours_until_expiry,
    o.current_hospital_id,
    h.name AS hospital_name,
    h.city AS hospital_city
FROM ORGAN o
JOIN DONOR d ON o.donor_id = d.donor_id
JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
WHERE o.organ_type = 'KIDNEY'
  AND o.status = 'AVAILABLE'
  AND o.expiry_time > SYSTIMESTAMP;

-- View 2: Active recipients waiting for a kidney transplant
CREATE OR REPLACE VIEW V_WAITING_RECIPIENTS AS
SELECT 
    r.recipient_id,
    r.full_name,
    r.age,
    r.blood_group,
    r.hla_type,
    r.urgency,
    r.status,
    r.listed_on,
    ROUND(SYSDATE - r.listed_on) AS waiting_days,
    r.eligibility_status,
    r.hospital_id,
    h.name AS hospital_name,
    h.city AS hospital_city
FROM RECIPIENT r
JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
WHERE r.status = 'WAITING'
  AND r.eligibility_status = 'ELIGIBLE';

-- View 3: Potential match combinations with transparent matching score criteria
CREATE OR REPLACE VIEW V_KIDNEY_MATCH_RESULTS AS
SELECT 
    k.organ_id,
    k.blood_group AS donor_blood_group,
    k.donor_reference,
    k.hours_until_expiry,
    r.recipient_id,
    r.full_name AS recipient_name,
    r.blood_group AS recipient_blood_group,
    r.urgency,
    r.waiting_days,
    r.hospital_name AS recipient_hospital,
    -- Compatibility flag (Identical ABO or O universal donor to non-O)
    CASE 
        WHEN k.blood_group = r.blood_group THEN 'EXACT_MATCH'
        WHEN k.blood_group IN ('O-', 'O+') AND r.blood_group IN ('A+', 'B+', 'AB+', 'A-', 'B-', 'AB-') THEN 'COMPATIBLE_DONOR'
        ELSE 'INCOMPATIBLE'
    END AS abo_compatibility,
    -- Transparent match score: Urgency (40%), Waiting Days (30%), HLA Proximity (30%)
    -- Tier 1 = highest urgency (40 pts), Tier 5 = lowest (8 pts)
    ROUND(
        ((6 - r.urgency) * 8.0) + 
        (LEAST(r.waiting_days, 365) / 365.0 * 30.0) + 
        (CASE WHEN k.blood_group = r.blood_group THEN 30.0 ELSE 20.0 END), 
        2
    ) AS estimated_match_score
FROM V_AVAILABLE_KIDNEYS k
CROSS JOIN V_WAITING_RECIPIENTS r
WHERE (
    k.blood_group = r.blood_group OR 
    (k.blood_group = 'O+' AND r.blood_group IN ('A+', 'B+', 'AB+')) OR
    (k.blood_group = 'O-')
);

-- View 4: Complete allocation history and clinical decisions
CREATE OR REPLACE VIEW V_ALLOCATION_HISTORY AS
SELECT 
    a.alloc_id,
    a.organ_id,
    o.status AS organ_status,
    d.donor_id,
    d.blood_group AS donor_blood,
    a.recipient_id,
    r.full_name AS recipient_name,
    r.blood_group AS recipient_blood,
    r.urgency,
    a.match_score,
    a.status AS allocation_status,
    a.alloc_date,
    a.response_time,
    a.decision_reason,
    a.approved_by,
    h_donor.name AS donor_hospital,
    h_recip.name AS recipient_hospital
FROM ALLOCATION a
JOIN ORGAN o ON a.organ_id = o.organ_id
JOIN DONOR d ON o.donor_id = d.donor_id
JOIN RECIPIENT r ON a.recipient_id = r.recipient_id
JOIN HOSPITAL h_donor ON o.current_hospital_id = h_donor.hospital_id
JOIN HOSPITAL h_recip ON r.hospital_id = h_recip.hospital_id;

-- View 5: Chronological allocation audit trail
CREATE OR REPLACE VIEW V_ALLOCATION_AUDIT AS
SELECT 
    log.log_id,
    log.alloc_id,
    log.action,
    log.action_time,
    log.user_id,
    log.entity_type,
    log.entity_id,
    log.operation_result,
    log.details,
    a.status AS current_allocation_status,
    a.match_score
FROM AUDIT_LOG log
LEFT JOIN ALLOCATION a ON log.alloc_id = a.alloc_id;
