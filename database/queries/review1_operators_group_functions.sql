-- =============================================================================
-- VITAL: Operators and Group Functions (Review 1 Rubric)
-- Demonstrates: IN, BETWEEN, Comparison & Logical Operators,
--               COUNT, AVG, SUM, MIN, MAX, GROUP BY, HAVING, ORDER BY
-- Context: Kidney inventory analytics, recipient urgency metrics, allocation statistics
-- =============================================================================

-- Query 1: IN, BETWEEN, Comparison & Logical Operators (Filtering high-urgency eligible candidates)
SELECT 
    recipient_id,
    full_name,
    blood_group,
    urgency,
    age,
    eligibility_status
FROM RECIPIENT
WHERE blood_group IN ('O+', 'O-', 'A+')
  AND age BETWEEN 25 AND 55
  AND urgency >= 3
  AND (eligibility_status = 'ELIGIBLE' OR status = 'WAITING')
  AND status != 'INACTIVE'
ORDER BY urgency DESC, age ASC;

-- Query 2: Aggregate & Group Functions with HAVING (Urgency metrics grouped by hospital)
SELECT 
    h.hospital_id,
    h.name AS hospital_name,
    COUNT(r.recipient_id) AS total_waiting_recipients,
    ROUND(AVG(r.urgency), 2) AS average_urgency_score,
    MIN(r.urgency) AS lowest_urgency,
    MAX(r.urgency) AS highest_urgency,
    MIN(r.age) AS youngest_candidate_age,
    MAX(r.age) AS oldest_candidate_age
FROM HOSPITAL h
JOIN RECIPIENT r ON h.hospital_id = r.hospital_id
WHERE r.status = 'WAITING'
GROUP BY h.hospital_id, h.name
HAVING COUNT(r.recipient_id) >= 1
ORDER BY average_urgency_score DESC, total_waiting_recipients DESC;

-- Query 3: Viability statistics and organ stock summary by blood group
SELECT 
    d.blood_group,
    COUNT(o.organ_id) AS total_kidneys_procured,
    SUM(CASE WHEN o.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS active_available_count,
    ROUND(AVG(o.viable_hours), 2) AS mean_cold_ischemia_hours,
    MIN(o.viable_hours) AS min_viable_hours,
    MAX(o.viable_hours) AS max_viable_hours
FROM ORGAN o
JOIN DONOR d ON o.donor_id = d.donor_id
GROUP BY d.blood_group
ORDER BY active_available_count DESC, d.blood_group ASC;
