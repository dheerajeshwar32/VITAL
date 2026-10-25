-- =============================================================================
-- VITAL: DML Operations Demonstration Script (Review 1 Rubric)
-- Demonstrates INSERT, UPDATE, and DELETE (using disposable test records)
-- Preserves actual clinical, allocation, and audit history
-- =============================================================================

-- Step 1: Demonstrate INSERT on a disposable test recipient
INSERT INTO RECIPIENT (
    recipient_id, hospital_id, full_name, age, blood_group, hla_type, 
    urgency, status, listed_on, eligibility_status
) VALUES (
    999, 101, 'Disposable Test Recipient R999', 44, 'B+', 'A2-B44-DR4', 
    3, 'WAITING', SYSDATE, 'ELIGIBLE'
);

-- Step 2: Demonstrate UPDATE - Modifying urgency & eligibility status
UPDATE RECIPIENT 
SET urgency = 4, 
    eligibility_status = 'PENDING_REVIEW'
WHERE recipient_id = 999;

-- Step 3: Demonstrate controlled DELETE on disposable test recipient
DELETE FROM RECIPIENT 
WHERE recipient_id = 999;

-- Step 4: Verify rollback/commit behavior
COMMIT;
