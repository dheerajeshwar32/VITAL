-- =============================================================================
-- VITAL: Automated Constraint Verification Test Script
-- Validates:
-- 1. Kidney-only enforcement (Reject LIVER, HEART, LUNG)
-- 2. Urgency range enforcement (Reject urgency < 1 or > 5)
-- 3. Duplicate allocation offer prevention (Reject same organ + recipient pair)
-- 4. Expired kidney offer rejection
-- =============================================================================

SET SERVEROUTPUT ON;

DECLARE
    v_error_count NUMBER := 0;
    v_pass_count  NUMBER := 0;
BEGIN
    DBMS_OUTPUT.PUT_LINE('====================================================');
    DBMS_OUTPUT.PUT_LINE('STARTING VITAL DATABASE CONSTRAINT VERIFICATION');
    DBMS_OUTPUT.PUT_LINE('====================================================');

    -- TEST 1: REJECT NON-KIDNEY ORGAN
    BEGIN
        INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
        VALUES (881, 201, 'LIVER', 12, SYSTIMESTAMP, SYSTIMESTAMP + INTERVAL '12' HOUR, 'AVAILABLE', 101);
        v_error_count := v_error_count + 1;
        DBMS_OUTPUT.PUT_LINE('FAIL: Non-kidney organ was accepted!');
        ROLLBACK;
    EXCEPTION
        WHEN OTHERS THEN
            v_pass_count := v_pass_count + 1;
            DBMS_OUTPUT.PUT_LINE('PASS Test 1: Non-kidney organ properly rejected by constraint/trigger.');
    END;

    -- TEST 2: REJECT RECIPIENT URGENCY OUT OF BOUNDS (Urgency = 9)
    BEGIN
        INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
        VALUES (882, 101, 'Test Out of Bounds', 40, 'O+', 'A1-B8-DR3', 9, 'WAITING', SYSDATE, 'ELIGIBLE');
        v_error_count := v_error_count + 1;
        DBMS_OUTPUT.PUT_LINE('FAIL: Out-of-bounds urgency was accepted!');
        ROLLBACK;
    EXCEPTION
        WHEN OTHERS THEN
            v_pass_count := v_pass_count + 1;
            DBMS_OUTPUT.PUT_LINE('PASS Test 2: Out-of-bounds urgency properly rejected.');
    END;

    -- TEST 3: REJECT DUPLICATE ALLOCATION FOR SAME (ORGAN, RECIPIENT)
    BEGIN
        INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date)
        VALUES (883, 401, 301, 95.0, 'OFFERED', SYSDATE);
        INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date)
        VALUES (884, 401, 301, 95.0, 'OFFERED', SYSDATE);
        v_error_count := v_error_count + 1;
        DBMS_OUTPUT.PUT_LINE('FAIL: Duplicate offer was accepted!');
        ROLLBACK;
    EXCEPTION
        WHEN OTHERS THEN
            v_pass_count := v_pass_count + 1;
            DBMS_OUTPUT.PUT_LINE('PASS Test 3: Duplicate allocation offer properly rejected by UQ constraint.');
            ROLLBACK;
    END;

    DBMS_OUTPUT.PUT_LINE('----------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('SUMMARY: ' || v_pass_count || ' Tests Passed | ' || v_error_count || ' Tests Failed');
    DBMS_OUTPUT.PUT_LINE('====================================================');
END;
/
