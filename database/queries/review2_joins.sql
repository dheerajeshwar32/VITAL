-- =============================================================================
-- VITAL: Joins Demonstration (Review 2 Rubric - Component B)
-- Demonstrates: Inner Joins, Left Outer Joins, and Comprehensive 6-Table Joins
-- Connects: HOSPITAL, DONOR, ORGAN, RECIPIENT, ALLOCATION, AUDIT_LOG
-- =============================================================================

-- Join 1: INNER JOIN (Connecting active Organ inventory to Donor and Retrieving Hospital)
SELECT 
    o.organ_id,
    o.organ_type,
    o.status AS organ_status,
    d.donor_id,
    d.full_name AS donor_name,
    d.blood_group AS donor_blood_group,
    d.donor_type,
    h.name AS retrieval_hospital_name,
    h.city AS hospital_city
FROM ORGAN o
INNER JOIN DONOR d ON o.donor_id = d.donor_id
INNER JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
ORDER BY o.organ_id ASC;

-- Join 2: LEFT OUTER JOIN (All waiting recipients and their historical or active offers, if any)
SELECT 
    r.recipient_id,
    r.full_name AS recipient_name,
    r.blood_group,
    r.urgency,
    r.status AS recipient_status,
    NVL(TO_CHAR(a.alloc_id), 'NO_OFFER_YET') AS allocation_id,
    NVL(a.status, 'UNOFFERED') AS offer_status,
    a.match_score,
    a.alloc_date
FROM RECIPIENT r
LEFT OUTER JOIN ALLOCATION a ON r.recipient_id = a.recipient_id
ORDER BY r.urgency DESC, r.recipient_id ASC;

-- Join 3: COMPREHENSIVE 6-TABLE MULTI-JOIN (Complete audit and allocation ledger)
-- Joins: ALLOCATION -> ORGAN -> DONOR -> HOSPITAL (Donor Center) 
--                   -> RECIPIENT -> HOSPITAL (Recipient Center)
--                   -> AUDIT_LOG
SELECT 
    a.alloc_id,
    a.alloc_date,
    a.status AS allocation_status,
    a.match_score,
    a.approved_by,
    o.organ_id,
    o.organ_type,
    d.donor_id,
    d.blood_group AS donor_blood,
    h_donor.name AS donor_hospital,
    r.recipient_id,
    r.full_name AS recipient_name,
    r.blood_group AS recipient_blood,
    r.urgency AS recipient_urgency,
    h_recip.name AS recipient_hospital,
    log.log_id,
    log.action AS audit_action,
    log.action_time,
    log.operation_result
FROM ALLOCATION a
JOIN ORGAN o ON a.organ_id = o.organ_id
JOIN DONOR d ON o.donor_id = d.donor_id
JOIN HOSPITAL h_donor ON o.current_hospital_id = h_donor.hospital_id
JOIN RECIPIENT r ON a.recipient_id = r.recipient_id
JOIN HOSPITAL h_recip ON r.hospital_id = h_recip.hospital_id
LEFT JOIN AUDIT_LOG log ON a.alloc_id = log.alloc_id
ORDER BY a.alloc_id DESC, log.action_time DESC;
