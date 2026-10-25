-- =============================================================================
-- VITAL: Subqueries Demonstration (Review 2 Rubric - Component A)
-- 1. Recipients with urgency above average
-- 2. Recipients with suitable compatibility assessments (e.g., matching blood group of available organs)
-- 3. Kidneys with no active allocation
-- 4. Highest-ranked eligible recipient for an available kidney
-- =============================================================================

-- Subquery 1: Recipients with urgency strictly above the global average urgency
SELECT 
    recipient_id,
    full_name,
    blood_group,
    urgency,
    (SELECT ROUND(AVG(urgency), 2) FROM RECIPIENT WHERE status = 'WAITING') AS system_avg_urgency,
    listed_on
FROM RECIPIENT
WHERE status = 'WAITING'
  AND urgency > (
      SELECT AVG(urgency) 
      FROM RECIPIENT 
      WHERE status = 'WAITING'
  )
ORDER BY urgency DESC, listed_on ASC;

-- Subquery 2: Recipients with suitable ABO compatibility for currently available kidneys (IN subquery)
SELECT 
    r.recipient_id,
    r.full_name,
    r.blood_group,
    r.urgency,
    r.status
FROM RECIPIENT r
WHERE r.status = 'WAITING'
  AND r.eligibility_status = 'ELIGIBLE'
  AND r.blood_group IN (
      -- Extract blood groups compatible with unexpired, available donor kidneys
      SELECT DISTINCT d.blood_group
      FROM ORGAN o
      JOIN DONOR d ON o.donor_id = d.donor_id
      WHERE o.status = 'AVAILABLE'
        AND o.expiry_time > SYSTIMESTAMP
  )
ORDER BY r.urgency DESC;

-- Subquery 3: Kidneys with NO active allocation (NOT EXISTS correlated subquery)
SELECT 
    o.organ_id,
    o.organ_type,
    d.blood_group AS donor_blood_group,
    h.name AS retrieval_hospital,
    o.viable_hours,
    o.expiry_time
FROM ORGAN o
JOIN DONOR d ON o.donor_id = d.donor_id
JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
WHERE o.status = 'AVAILABLE'
  AND NOT EXISTS (
      SELECT 1 
      FROM ALLOCATION a 
      WHERE a.organ_id = o.organ_id 
        AND a.status IN ('OFFERED', 'ACCEPTED', 'COMPLETED')
  )
ORDER BY o.expiry_time ASC;

-- Subquery 4: Highest-ranked candidate recipient for Kidney 401 using correlated subquery
SELECT 
    r.recipient_id,
    r.full_name,
    r.blood_group,
    r.urgency,
    r.listed_on
FROM RECIPIENT r
WHERE r.status = 'WAITING'
  AND r.eligibility_status = 'ELIGIBLE'
  AND r.blood_group = (
      SELECT d.blood_group 
      FROM ORGAN o 
      JOIN DONOR d ON o.donor_id = d.donor_id 
      WHERE o.organ_id = 401
  )
  AND r.urgency = (
      SELECT MAX(r2.urgency)
      FROM RECIPIENT r2
      WHERE r2.status = 'WAITING'
        AND r2.eligibility_status = 'ELIGIBLE'
        AND r2.blood_group = (
            SELECT d2.blood_group 
            FROM ORGAN o2 
            JOIN DONOR d2 ON o2.donor_id = d2.donor_id 
            WHERE o2.organ_id = 401
        )
  )
  AND ROWNUM = 1;
