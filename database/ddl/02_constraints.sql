-- =============================================================================
-- VITAL: Constraint Analysis & Demonstration Script
-- Review 1 Requirement: Primary Key, Foreign Key, Unique, Not Null, Check, Default
-- =============================================================================

-- =============================================================================
-- 1. SUMMARY OF CONSTRAINTS CONFIGURED IN VITAL
-- =============================================================================
-- PK (Primary Key):
--   - pk_hospital      ON HOSPITAL(hospital_id)
--   - pk_app_user      ON APP_USER(user_id)
--   - pk_donor         ON DONOR(donor_id)
--   - pk_recipient     ON RECIPIENT(recipient_id)
--   - pk_organ         ON ORGAN(organ_id)
--   - pk_allocation    ON ALLOCATION(alloc_id)
--   - pk_audit_log     ON AUDIT_LOG(log_id)
--
-- FK (Foreign Key):
--   - fk_donor_hospital     DONOR(hospital_id) -> HOSPITAL(hospital_id)
--   - fk_recipient_hospital RECIPIENT(hospital_id) -> HOSPITAL(hospital_id)
--   - fk_organ_donor        ORGAN(donor_id) -> DONOR(donor_id)
--   - fk_organ_hospital     ORGAN(current_hospital_id) -> HOSPITAL(hospital_id)
--   - fk_alloc_organ        ALLOCATION(organ_id) -> ORGAN(organ_id)
--   - fk_alloc_recipient    ALLOCATION(recipient_id) -> RECIPIENT(recipient_id)
--   - fk_audit_allocation   AUDIT_LOG(alloc_id) -> ALLOCATION(alloc_id)
--
-- UQ (Unique):
--   - uq_alloc_organ_recipient ALLOCATION(organ_id, recipient_id)  [BR2: No repeat offers]
--
-- CHK (Check Constraints):
--   - chk_hospital_is_center     HOSPITAL.is_center IN ('Y', 'N')
--   - chk_donor_age              DONOR.age BETWEEN 18 AND 85
--   - chk_donor_blood_group      DONOR.blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
--   - chk_donor_type             DONOR.donor_type IN ('LIVING', 'DECEASED')
--   - chk_recipient_age          RECIPIENT.age BETWEEN 1 AND 95
--   - chk_recipient_blood_group  RECIPIENT.blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
--   - chk_recipient_urgency      RECIPIENT.urgency BETWEEN 1 AND 5 [BR3]
--   - chk_organ_type_kidney      ORGAN.organ_type = 'KIDNEY' [Strict Kidney Scope]
--   - chk_organ_viable_hours     ORGAN.viable_hours > 0
--   - chk_alloc_match_score      ALLOCATION.match_score BETWEEN 0 AND 100
--
-- DEFAULT Constraints:
--   - HOSPITAL.is_center DEFAULT 'Y'
--   - DONOR.reg_date DEFAULT SYSDATE
--   - RECIPIENT.listed_on DEFAULT SYSDATE
--   - ORGAN.organ_type DEFAULT 'KIDNEY'
--   - ORGAN.available_since DEFAULT SYSTIMESTAMP
--   - ALLOCATION.status DEFAULT 'OFFERED'
--   - ALLOCATION.alloc_date DEFAULT SYSDATE
--   - AUDIT_LOG.action_time DEFAULT SYSTIMESTAMP
--   - AUDIT_LOG.operation_result DEFAULT 'SUCCESS'

-- =============================================================================
-- 2. CONSTRAINT VIOLATION TESTS (EXPECTED FAILURES)
-- =============================================================================

-- TEST A: Check Constraint Violation (Attempting to insert a non-kidney organ e.g. LIVER)
-- ORA-02290: check constraint (VITAL.CHK_ORGAN_TYPE_KIDNEY) violated
/*
INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
VALUES (999, 201, 'LIVER', 12.0, SYSTIMESTAMP, SYSTIMESTAMP + INTERVAL '12' HOUR, 'AVAILABLE', 101);
*/

-- TEST B: Check Constraint Violation (Recipient urgency outside 1 to 5 range)
-- ORA-02290: check constraint (VITAL.CHK_RECIPIENT_URGENCY) violated
/*
INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (999, 101, 'Invalid Urgency Patient', 45, 'O+', 'A2-B7-DR4', 7, 'WAITING', SYSDATE, 'ELIGIBLE');
*/

-- TEST C: Unique Constraint Violation (Duplicate offer of same kidney to same recipient)
-- ORA-00001: unique constraint (VITAL.UQ_ALLOC_ORGAN_RECIPIENT) violated
/*
INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date)
VALUES (998, 401, 301, 88.5, 'OFFERED', SYSDATE);
-- Second attempt:
INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date)
VALUES (999, 401, 301, 88.5, 'OFFERED', SYSDATE);
*/

-- TEST D: Foreign Key Constraint Violation (Non-existent hospital)
-- ORA-02291: integrity constraint (VITAL.FK_DONOR_HOSPITAL) violated - parent key not found
/*
INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date)
VALUES (999, 99999, 'Orphan Donor', 35, 'A+', 'A1-B8-DR3', 'DECEASED', SYSDATE);
*/

-- TEST E: Not Null Constraint Violation (Missing recipient blood group)
-- ORA-01400: cannot insert NULL into ("VITAL"."RECIPIENT"."BLOOD_GROUP")
/*
INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (999, 101, 'Missing Blood Group', 45, NULL, 'A2-B7-DR4', 3, 'WAITING', SYSDATE, 'ELIGIBLE');
*/
