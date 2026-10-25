-- =============================================================================
-- VITAL: PL/SQL Stored Procedures (Review 2 Rubric - Component D)
-- Implements:
-- 1. REGISTER_KIDNEY
-- 2. GENERATE_KIDNEY_MATCHES
-- 3. CREATE_ALLOCATION_OFFER
-- 4. RESPOND_TO_OFFER
-- 5. EXPIRE_KIDNEYS
-- =============================================================================

-- =============================================================================
-- PROCEDURE 1: REGISTER_KIDNEY
-- Procures and registers a new kidney, calculates expiry timestamp, and logs audit
-- =============================================================================
CREATE OR REPLACE PROCEDURE REGISTER_KIDNEY (
    p_donor_id          IN NUMBER,
    p_viable_hours      IN NUMBER,
    p_hospital_id       IN NUMBER,
    p_user_id           IN VARCHAR2,
    o_organ_id          OUT NUMBER
) IS
    v_donor_count       NUMBER;
    v_donor_eval        VARCHAR2(20);
    v_donor_verif       VARCHAR2(20);
    v_organ_id          NUMBER;
    v_expiry_time       TIMESTAMP;
BEGIN
    -- Validate Donor existence and clinical clearance
    SELECT COUNT(*), MAX(evaluation_status), MAX(verification_status)
    INTO v_donor_count, v_donor_eval, v_donor_verif
    FROM DONOR
    WHERE donor_id = p_donor_id;

    IF v_donor_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Donor ID ' || p_donor_id || ' does not exist.');
    END IF;

    IF v_donor_eval != 'COMPLETED' OR v_donor_verif != 'VERIFIED' THEN
        RAISE_APPLICATION_ERROR(-20002, 'Donor clinical evaluation or verification is incomplete.');
    END IF;

    IF p_viable_hours <= 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Viable hours must be strictly positive.');
    END IF;

    -- Calculate expiry timestamp based on cold ischemia limit
    v_expiry_time := SYSTIMESTAMP + NUMTODSINTERVAL(p_viable_hours, 'HOUR');
    v_organ_id := SEQ_ORGAN_ID.NEXTVAL;

    INSERT INTO ORGAN (
        organ_id, donor_id, organ_type, viable_hours,
        available_since, expiry_time, status, current_hospital_id
    ) VALUES (
        v_organ_id, p_donor_id, 'KIDNEY', p_viable_hours,
        SYSTIMESTAMP, v_expiry_time, 'AVAILABLE', p_hospital_id
    );

    -- Record Audit Log entry
    INSERT INTO AUDIT_LOG (
        log_id, alloc_id, action, action_time, user_id,
        entity_type, entity_id, operation_result, details
    ) VALUES (
        SEQ_LOG_ID.NEXTVAL, NULL, 'REGISTER_KIDNEY', SYSTIMESTAMP, p_user_id,
        'ORGAN', v_organ_id, 'SUCCESS',
        'Registered Kidney ' || v_organ_id || ' from Donor ' || p_donor_id || ' with ' || p_viable_hours || 'h cold ischemia limit'
    );

    o_organ_id := v_organ_id;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END REGISTER_KIDNEY;
/

-- =============================================================================
-- PROCEDURE 2: GENERATE_KIDNEY_MATCHES
-- Evaluates candidate recipients for a given available kidney
-- =============================================================================
CREATE OR REPLACE PROCEDURE GENERATE_KIDNEY_MATCHES (
    p_organ_id         IN NUMBER,
    o_candidate_count  OUT NUMBER
) IS
    v_organ_status     VARCHAR2(20);
    v_is_expired       NUMBER;
    v_donor_bg         VARCHAR2(5);
    v_count            NUMBER := 0;
BEGIN
    -- Check organ validity
    SELECT status, IS_KIDNEY_EXPIRED(organ_id), d.blood_group
    INTO v_organ_status, v_is_expired, v_donor_bg
    FROM ORGAN o
    JOIN DONOR d ON o.donor_id = d.donor_id
    WHERE o.organ_id = p_organ_id;

    IF v_organ_status != 'AVAILABLE' THEN
        RAISE_APPLICATION_ERROR(-20004, 'Organ ' || p_organ_id || ' is not AVAILABLE for matching.');
    END IF;

    IF v_is_expired = 1 THEN
        RAISE_APPLICATION_ERROR(-20005, 'Cannot match organ: Kidney ' || p_organ_id || ' has expired.');
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM RECIPIENT r
    WHERE r.status = 'WAITING'
      AND r.eligibility_status = 'ELIGIBLE'
      AND CHECK_BLOOD_GROUP_COMPATIBILITY(v_donor_bg, r.blood_group) = 1;

    o_candidate_count := v_count;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20006, 'Organ ID ' || p_organ_id || ' not found.');
    WHEN OTHERS THEN
        RAISE;
END GENERATE_KIDNEY_MATCHES;
/

-- =============================================================================
-- PROCEDURE 3: CREATE_ALLOCATION_OFFER
-- ACID Transaction: Locks organ row with SELECT FOR UPDATE, creates allocation,
-- sets organ status to OFFERED, and writes immutable audit entry.
-- =============================================================================
CREATE OR REPLACE PROCEDURE CREATE_ALLOCATION_OFFER (
    p_organ_id       IN NUMBER,
    p_recipient_id   IN NUMBER,
    p_user_id        IN VARCHAR2,
    o_alloc_id       OUT NUMBER
) IS
    v_organ_status   VARCHAR2(20);
    v_expiry_time    TIMESTAMP;
    v_donor_bg       VARCHAR2(5);
    v_donor_hla      VARCHAR2(100);
    v_recip_bg       VARCHAR2(5);
    v_recip_hla      VARCHAR2(100);
    v_recip_urgency  NUMBER;
    v_recip_status   VARCHAR2(25);
    v_recip_elig     VARCHAR2(20);
    v_listed_on      DATE;
    v_waiting_days   NUMBER;
    v_match_score    NUMBER(5,2);
    v_alloc_id       NUMBER;
    v_existing_offer NUMBER;
BEGIN
    -- STEP 1: CONCURRENCY LOCK (SELECT FOR UPDATE)
    -- Prevents double allocation by locking the organ record in this transaction
    SELECT o.status, o.expiry_time, d.blood_group, d.hla_type
    INTO v_organ_status, v_expiry_time, v_donor_bg, v_donor_hla
    FROM ORGAN o
    JOIN DONOR d ON o.donor_id = d.donor_id
    WHERE o.organ_id = p_organ_id
    FOR UPDATE;

    -- Verify organ is available
    IF v_organ_status != 'AVAILABLE' THEN
        RAISE_APPLICATION_ERROR(-20010, 'Concurrency Lock Failed: Organ ' || p_organ_id || ' is currently ' || v_organ_status || '.');
    END IF;

    -- Verify organ is not expired (BR4)
    IF v_expiry_time <= SYSTIMESTAMP THEN
        UPDATE ORGAN SET status = 'EXPIRED' WHERE organ_id = p_organ_id;
        COMMIT;
        RAISE_APPLICATION_ERROR(-20011, 'BR4 Expiry Violation: Kidney ' || p_organ_id || ' has expired and cannot be offered.');
    END IF;

    -- STEP 2: LOCK AND VALIDATE RECIPIENT
    SELECT blood_group, hla_type, urgency, status, eligibility_status, listed_on
    INTO v_recip_bg, v_recip_hla, v_recip_urgency, v_recip_status, v_recip_elig, v_listed_on
    FROM RECIPIENT
    WHERE recipient_id = p_recipient_id
    FOR UPDATE;

    IF v_recip_status != 'WAITING' THEN
        RAISE_APPLICATION_ERROR(-20012, 'Recipient ' || p_recipient_id || ' is not currently WAITING (Status: ' || v_recip_status || ').');
    END IF;

    IF v_recip_elig != 'ELIGIBLE' THEN
        RAISE_APPLICATION_ERROR(-20013, 'Recipient eligibility check failed (Status: ' || v_recip_elig || ').');
    END IF;

    -- STEP 3: BLOOD GROUP COMPATIBILITY (BR1)
    IF CHECK_BLOOD_GROUP_COMPATIBILITY(v_donor_bg, v_recip_bg) = 0 THEN
        RAISE_APPLICATION_ERROR(-20014, 'BR1 Incompatibility: Donor ' || v_donor_bg || ' is incompatible with Recipient ' || v_recip_bg || '.');
    END IF;

    -- STEP 4: CHECK PREVIOUS OFFER (BR2)
    SELECT COUNT(*)
    INTO v_existing_offer
    FROM ALLOCATION
    WHERE organ_id = p_organ_id AND recipient_id = p_recipient_id;

    IF v_existing_offer > 0 THEN
        RAISE_APPLICATION_ERROR(-20015, 'BR2 Duplicate Offer Violation: Organ ' || p_organ_id || ' was already offered to Recipient ' || p_recipient_id || '.');
    END IF;

    -- STEP 5: CALCULATE SCORE AND INSERT ALLOCATION
    v_waiting_days := ROUND(SYSDATE - v_listed_on);
    v_match_score := CALCULATE_MATCH_SCORE(v_donor_bg, v_recip_bg, v_donor_hla, v_recip_hla, v_recip_urgency, v_waiting_days);
    v_alloc_id := SEQ_ALLOC_ID.NEXTVAL;

    INSERT INTO ALLOCATION (
        alloc_id, organ_id, recipient_id, match_score, status, alloc_date, approved_by
    ) VALUES (
        v_alloc_id, p_organ_id, p_recipient_id, v_match_score, 'OFFERED', SYSDATE, p_user_id
    );

    -- Update Organ state to OFFERED to prevent concurrent claims
    UPDATE ORGAN 
    SET status = 'OFFERED'
    WHERE organ_id = p_organ_id;

    -- Update Recipient status
    UPDATE RECIPIENT
    SET status = 'MATCHED'
    WHERE recipient_id = p_recipient_id;

    -- STEP 6: IMMUTABLE AUDIT LOG (BR5)
    INSERT INTO AUDIT_LOG (
        log_id, alloc_id, action, action_time, user_id,
        entity_type, entity_id, operation_result, details
    ) VALUES (
        SEQ_LOG_ID.NEXTVAL, v_alloc_id, 'CREATE_OFFER', SYSTIMESTAMP, p_user_id,
        'ALLOCATION', v_alloc_id, 'SUCCESS',
        'Offer created: Organ ' || p_organ_id || ' to Recipient ' || p_recipient_id || ' (Score: ' || v_match_score || ')'
    );

    o_alloc_id := v_alloc_id;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END CREATE_ALLOCATION_OFFER;
/

-- =============================================================================
-- PROCEDURE 4: RESPOND_TO_OFFER
-- Clinical Reviewer response (ACCEPTED / DECLINED)
-- Handles acceptance into COMPLETED or declination with release back to pool
-- =============================================================================
CREATE OR REPLACE PROCEDURE RESPOND_TO_OFFER (
    p_alloc_id      IN NUMBER,
    p_decision      IN VARCHAR2,  -- 'ACCEPTED' or 'DECLINED'
    p_reason        IN VARCHAR2,
    p_reviewer      IN VARCHAR2
) IS
    v_organ_id      NUMBER;
    v_recipient_id  NUMBER;
    v_current_status VARCHAR2(20);
BEGIN
    IF p_decision NOT IN ('ACCEPTED', 'DECLINED') THEN
        RAISE_APPLICATION_ERROR(-20020, 'Invalid decision. Must be ACCEPTED or DECLINED.');
    END IF;

    -- Lock allocation row
    SELECT organ_id, recipient_id, status
    INTO v_organ_id, v_recipient_id, v_current_status
    FROM ALLOCATION
    WHERE alloc_id = p_alloc_id
    FOR UPDATE;

    IF v_current_status != 'OFFERED' THEN
        RAISE_APPLICATION_ERROR(-20021, 'Cannot respond to offer: Current status is ' || v_current_status || '.');
    END IF;

    IF p_decision = 'ACCEPTED' THEN
        -- Mark allocation COMPLETED (or ACCEPTED)
        UPDATE ALLOCATION
        SET status = 'COMPLETED',
            response_time = SYSTIMESTAMP,
            decision_reason = p_reason,
            approved_by = p_reviewer
        WHERE alloc_id = p_alloc_id;

        -- Bind Organ to ALLOCATED
        UPDATE ORGAN
        SET status = 'ALLOCATED'
        WHERE organ_id = v_organ_id;

        -- Update Recipient to TRANSPLANTED
        UPDATE RECIPIENT
        SET status = 'TRANSPLANTED'
        WHERE recipient_id = v_recipient_id;

        INSERT INTO AUDIT_LOG (
            log_id, alloc_id, action, action_time, user_id,
            entity_type, entity_id, operation_result, details
        ) VALUES (
            SEQ_LOG_ID.NEXTVAL, p_alloc_id, 'OFFER_ACCEPTED', SYSTIMESTAMP, p_reviewer,
            'ALLOCATION', p_alloc_id, 'SUCCESS',
            'Transplant offer accepted by reviewer ' || p_reviewer || '. Organ ' || v_organ_id || ' allocated.'
        );

    ELSE -- DECLINED
        UPDATE ALLOCATION
        SET status = 'DECLINED',
            response_time = SYSTIMESTAMP,
            decision_reason = p_reason,
            approved_by = p_reviewer
        WHERE alloc_id = p_alloc_id;

        -- Release organ back to AVAILABLE if not expired
        IF IS_KIDNEY_EXPIRED(v_organ_id) = 1 THEN
            UPDATE ORGAN SET status = 'EXPIRED' WHERE organ_id = v_organ_id;
        ELSE
            UPDATE ORGAN SET status = 'AVAILABLE' WHERE organ_id = v_organ_id;
        END IF;

        -- Reset recipient back to WAITING list
        UPDATE RECIPIENT
        SET status = 'WAITING'
        WHERE recipient_id = v_recipient_id;

        INSERT INTO AUDIT_LOG (
            log_id, alloc_id, action, action_time, user_id,
            entity_type, entity_id, operation_result, details
        ) VALUES (
            SEQ_LOG_ID.NEXTVAL, p_alloc_id, 'OFFER_DECLINED', SYSTIMESTAMP, p_reviewer,
            'ALLOCATION', p_alloc_id, 'SUCCESS',
            'Offer declined: ' || p_reason || '. Organ ' || v_organ_id || ' returned to inventory pool.'
        );
    END IF;

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END RESPOND_TO_OFFER;
/

-- =============================================================================
-- PROCEDURE 5: EXPIRE_KIDNEYS
-- Batch procedure to update status of kidneys that have passed cold ischemia limit
-- =============================================================================
CREATE OR REPLACE PROCEDURE EXPIRE_KIDNEYS (
    o_expired_count OUT NUMBER
) IS
    v_count NUMBER := 0;
BEGIN
    UPDATE ORGAN
    SET status = 'EXPIRED'
    WHERE organ_type = 'KIDNEY'
      AND status = 'AVAILABLE'
      AND expiry_time <= SYSTIMESTAMP;

    v_count := SQL%ROWCOUNT;

    IF v_count > 0 THEN
        INSERT INTO AUDIT_LOG (
            log_id, alloc_id, action, action_time, user_id,
            entity_type, entity_id, operation_result, details
        ) VALUES (
            SEQ_LOG_ID.NEXTVAL, NULL, 'BATCH_EXPIRE_KIDNEYS', SYSTIMESTAMP, 'SYSTEM_SCHEDULER',
            'ORGAN', NULL, 'SUCCESS',
            'Automated cold ischemia check marked ' || v_count || ' kidney(s) as EXPIRED'
        );
    END IF;

    o_expired_count := v_count;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END EXPIRE_KIDNEYS;
/
