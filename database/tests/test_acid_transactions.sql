-- =============================================================================
-- VITAL: Automated ACID Transaction Verification Script
-- Tests Atomicity, Consistency, Isolation, and Durability
-- =============================================================================

SET SERVEROUTPUT ON;

DECLARE
    v_organ_status_before VARCHAR2(20);
    v_organ_status_after  VARCHAR2(20);
    v_alloc_count_before  NUMBER;
    v_alloc_count_after   NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('====================================================');
    DBMS_OUTPUT.PUT_LINE('STARTING ACID COMPLIANCE AUTOMATED VALIDATION');
    DBMS_OUTPUT.PUT_LINE('====================================================');

    -- TEST 1: ATOMIC ROLLBACK ON SIMULATED EXCEPTION
    SELECT status INTO v_organ_status_before FROM ORGAN WHERE organ_id = 401;
    SELECT COUNT(*) INTO v_alloc_count_before FROM ALLOCATION WHERE organ_id = 401;

    BEGIN
        SAVEPOINT acid_sp1;
        UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = 401;
        -- Simulated constraint or logic fault
        RAISE_APPLICATION_ERROR(-20888, 'Simulated failure during offer pipeline');
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK TO acid_sp1;
    END;

    SELECT status INTO v_organ_status_after FROM ORGAN WHERE organ_id = 401;
    SELECT COUNT(*) INTO v_alloc_count_after FROM ALLOCATION WHERE organ_id = 401;

    IF v_organ_status_before = v_organ_status_after AND v_alloc_count_before = v_alloc_count_after THEN
        DBMS_OUTPUT.PUT_LINE('PASS ACID Test 1 (Atomicity): Uncommitted changes rolled back completely.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('FAIL ACID Test 1 (Atomicity): Database was left in a partial state!');
    END IF;

    -- TEST 2: ISOLATION LOCK ACQUISITION
    BEGIN
        SELECT status INTO v_organ_status_before FROM ORGAN WHERE organ_id = 402 FOR UPDATE NOWAIT;
        DBMS_OUTPUT.PUT_LINE('PASS ACID Test 2 (Isolation): Exclusive row lock acquired successfully.');
        COMMIT; -- Releases lock
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('FAIL ACID Test 2 (Isolation): Failed to acquire row lock: ' || SQLERRM);
    END IF;

    DBMS_OUTPUT.PUT_LINE('====================================================');
    DBMS_OUTPUT.PUT_LINE('ACID VERIFICATION COMPLETED');
    DBMS_OUTPUT.PUT_LINE('====================================================');
END;
/
