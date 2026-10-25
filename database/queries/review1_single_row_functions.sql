-- =============================================================================
-- VITAL: Single-Row Functions Demonstration (Review 1 Rubric)
-- Demonstrates: UPPER, LENGTH, SUBSTR, ROUND, TRUNC, TO_CHAR, ADD_MONTHS, NVL, CASE
-- Context: Kidney transplantation inventory, donor evaluation, and clinical urgency
-- =============================================================================

-- Query 1: UPPER, LENGTH, SUBSTR (String manipulation for standardized clinical reporting)
SELECT 
    donor_id,
    UPPER(full_name) AS normalized_donor_name,
    LENGTH(hla_type) AS hla_string_length,
    SUBSTR(hla_type, 1, INSTR(hla_type, '-') - 1) AS primary_hla_a_locus,
    blood_group
FROM DONOR
ORDER BY donor_id;

-- Query 2: ROUND, TRUNC, TO_CHAR (Numeric precision and date/time formatting for kidney viability)
SELECT 
    organ_id,
    organ_type,
    ROUND(viable_hours, 0) AS rounded_viable_hours,
    TRUNC(viable_hours) AS truncated_viable_hours,
    TO_CHAR(available_since, 'YYYY-MM-DD HH24:MI:SS') AS formatted_arrival,
    TO_CHAR(expiry_time, 'DD-Mon-YYYY HH12:MI AM') AS formatted_expiry_window,
    ROUND((CAST(expiry_time AS DATE) - CAST(SYSTIMESTAMP AS DATE)) * 24, 2) AS remaining_hours_calc
FROM ORGAN
WHERE status = 'AVAILABLE';

-- Query 3: ADD_MONTHS, NVL, CASE (Waiting list seniority, null handling, clinical triage priority)
SELECT 
    recipient_id,
    full_name,
    urgency,
    listed_on,
    ADD_MONTHS(listed_on, 6) AS six_month_clinical_reassessment_date,
    NVL(status, 'UNASSIGNED') AS safe_status,
    CASE 
        WHEN urgency = 1 THEN 'CRITICAL (Tier 1 Priority - Emergency)'
        WHEN urgency = 2 THEN 'HIGH (Tier 2 Priority - Urgent)'
        WHEN urgency = 3 THEN 'MODERATE (Tier 3 Priority - Standard)'
        WHEN urgency = 4 THEN 'LOW (Tier 4 Priority - Stable)'
        ELSE 'ROUTINE (Tier 5 Priority - Minimal)'
    END AS clinical_priority_description,
    CASE 
        WHEN eligibility_status = 'ELIGIBLE' AND status = 'WAITING' THEN 'ACTIVE_OFFERABLE'
        ELSE 'HOLD / NON_DISPATCHABLE'
    END AS operational_readiness
FROM RECIPIENT
ORDER BY urgency ASC, listed_on ASC;
