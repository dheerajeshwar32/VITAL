-- =============================================================================
-- VITAL: Seed Data - Allocations & Audit Logs
-- Demonstrates resolved M:N relationship, decision tracking, and BR5 audit history
-- =============================================================================

-- Allocation 501: Completed allocation for Kidney 405
INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date, response_time, decision_reason, approved_by)
VALUES (501, 405, 305, 94.50, 'COMPLETED', SYSDATE - 2, SYSTIMESTAMP - INTERVAL '36' HOUR, 'Optimal 6-antigen HLA match with urgency tier 2 compatibility', 'Dr. Sandeep Hegde');

-- Allocation 502: Declined offer (demonstrating clinical reviewer declination and preservation of history)
INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date, response_time, decision_reason, approved_by)
VALUES (502, 402, 306, 76.00, 'DECLINED', SYSDATE - 1, SYSTIMESTAMP - INTERVAL '18' HOUR, 'Recipient temporarily febrile; delayed for acute antibiotic therapy', 'Dr. Radhika Raman');

-- Initial Immutable Audit Log Entries (BR5: Audit Trail)
INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
VALUES (1001, NULL, 'SYSTEM_INITIALIZATION', SYSTIMESTAMP - INTERVAL '5' DAY, 'SYSTEM', 'DATABASE', 1, 'SUCCESS', 'VITAL Schema initialized with strict kidney transplantation parameters');

INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
VALUES (1002, NULL, 'DONOR_REGISTRATION', SYSTIMESTAMP - INTERVAL '5' DAY, 'coord_chennai', 'DONOR', 201, 'SUCCESS', 'Registered deceased donor Ref-K201 (O+). Consent and clinical review verified');

INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
VALUES (1003, NULL, 'ORGAN_RETRIEVAL', SYSTIMESTAMP - INTERVAL '4' HOUR, 'coord_chennai', 'ORGAN', 401, 'SUCCESS', 'Procured Kidney 401 from Donor 201; 28 hours cold ischemia limit recorded');

INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
VALUES (1004, 501, 'ALLOCATION_COMPLETED', SYSTIMESTAMP - INTERVAL '36' HOUR, 'surgeon_manipal', 'ALLOCATION', 501, 'SUCCESS', 'Transplant completed successfully for Recipient 305. Organ 405 marked ALLOCATED');

INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
VALUES (1005, 502, 'OFFER_DECLINED', SYSTIMESTAMP - INTERVAL '18' HOUR, 'coord_chennai', 'ALLOCATION', 502, 'SUCCESS', 'Offer declined by clinical reviewer for Recipient 306; kidney returned to active pool');

COMMIT;
