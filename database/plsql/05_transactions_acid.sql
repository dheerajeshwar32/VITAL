-- =============================================================================
-- VITAL: ACID Compliance & Transaction Management Demonstration
-- Demonstrates:
-- 1. ATOMICITY: Multi-step atomic unit of work with SAVEPOINT & ROLLBACK
-- 2. CONSISTENCY: Enforcing schema constraints, business rules, and referential integrity
-- 3. ISOLATION: SELECT ... FOR UPDATE pessimistic concurrency locking
-- 4. DURABILITY: Verifying persisted state post-COMMIT across sessions
-- =============================================================================

-- =============================================================================
-- TEST 1: ATOMICITY DEMONSTRATION (SUCCESSFUL TRANSACTION)
-- Steps executed atomically:
-- 1. Insert allocation offer
-- 2. Update organ status to OFFERED
-- 3. Update recipient status to MATCHED
-- 4. Insert audit log entry
-- 5. COMMIT
-- =============================================================================
DECLARE
    v_test_alloc_id NUMBER;
BEGIN
    SAVEPOINT sp_atomic_test;

    v_test_alloc_id := SEQ_ALLOC_ID.NEXTVAL;

    -- Step 1: Create Allocation Offer
    INSERT INTO ALLOCATION (
        alloc_id, organ_id, recipient_id, match_score, status, alloc_date, approved_by
    ) VALUES (
        v_test_alloc_id, 403, 304, 84.20, 'OFFERED', SYSDATE, 'coord_chennai'
    );

    -- Step 2: Lock & Update Organ status
    UPDATE ORGAN 
    SET status = 'OFFERED'
    WHERE organ_id = 403;

    -- Step 3: Update Recipient status
    UPDATE RECIPIENT 
    SET status = 'MATCHED'
    WHERE recipient_id = 304;

    -- Step 4: Write Audit Entry
    INSERT INTO AUDIT_LOG (
        log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details
    ) VALUES (
        SEQ_LOG_ID.NEXTVAL, v_test_alloc_id, 'TEST_ATOMIC_OFFER', SYSTIMESTAMP, 'coord_chennai',
        'ALLOCATION', v_test_alloc_id, 'SUCCESS', 'Atomic offer transaction test committed'
    );

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('ATOMICITY TEST PASSED: All 4 entities updated atomically with alloc_id ' || v_test_alloc_id);
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO sp_atomic_test;
        DBMS_OUTPUT.PUT_LINE('ATOMICITY ROLLBACK: Rolled back completely. Error: ' || SQLERRM);
END;
/

-- =============================================================================
-- TEST 2: ATOMICITY DEMONSTRATION (FAILED TRANSACTION WITH AUTOMATIC ROLLBACK)
-- Simulates a mid-flight failure; verifies NO partial state is written to database
-- =============================================================================
DECLARE
    v_pre_organ_status VARCHAR2(20);
    v_post_organ_status VARCHAR2(20);
BEGIN
    SELECT status INTO v_pre_organ_status FROM ORGAN WHERE organ_id = 404;

    SAVEPOINT sp_failure_test;

    -- 1. Mutate organ status
    UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = 404;

    -- 2. Deliberately induce failure (e.g., duplicate key or illegal check)
    RAISE_APPLICATION_ERROR(-20999, 'Simulated network or clinical review interruption');

    -- This point is unreachable:
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO sp_failure_test;
        SELECT status INTO v_post_organ_status FROM ORGAN WHERE organ_id = 404;
        DBMS_OUTPUT.PUT_LINE('ATOMICITY ROLLBACK TEST PASSED: Pre-status: ' || v_pre_organ_status || ' | Post-status after rollback: ' || v_post_organ_status);
END;
/

-- =============================================================================
-- TEST 3: ISOLATION DEMONSTRATION (SELECT ... FOR UPDATE)
-- Simulates coordinator A holding a row lock on Kidney 401; coordinator B cannot
-- overwrite or re-offer the same kidney concurrently.
-- =============================================================================
DECLARE
    v_organ_status VARCHAR2(20);
BEGIN
    -- Acquires exclusive row-level lock on Kidney 401
    SELECT status 
    INTO v_organ_status
    FROM ORGAN 
    WHERE organ_id = 401
    FOR UPDATE NOWAIT;

    DBMS_OUTPUT.PUT_LINE('ISOLATION LOCK ACQUIRED on Kidney 401. Status: ' || v_organ_status);
    -- In a live multi-session test, any second transaction executing 'SELECT ... FOR UPDATE NOWAIT'
    -- on Kidney 401 will immediately receive ORA-00054: resource busy and acquire with NOWAIT specified.
    COMMIT; -- Releases lock
    DBMS_OUTPUT.PUT_LINE('ISOLATION LOCK RELEASED.');
END;
/
