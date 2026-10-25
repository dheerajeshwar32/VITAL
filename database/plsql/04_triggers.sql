-- =============================================================================
-- VITAL: Database Triggers (Review 2 Rubric - Component G)
-- Implements:
-- 1. TRG_ENFORCE_KIDNEY_TYPE (Ensures organ_type is strictly 'KIDNEY')
-- 2. TRG_PREVENT_EXPIRED_ALLOCATION (Enforces BR4: Expired organs cannot be allocated)
-- 3. TRG_AUDIT_ALLOCATION_STATUS (Enforces BR5: Automatically logs status changes)
-- 4. TRG_ENFORCE_VALID_STATUS_TRANSITIONS (Guards clinical lifecycle state transitions)
-- =============================================================================

-- =============================================================================
-- TRIGGER 1: TRG_ENFORCE_KIDNEY_TYPE
-- Prevents insertion or update of any organ type other than KIDNEY
-- =============================================================================
CREATE OR REPLACE TRIGGER TRG_ENFORCE_KIDNEY_TYPE
BEFORE INSERT OR UPDATE OF organ_type ON ORGAN
FOR EACH ROW
BEGIN
    IF UPPER(:NEW.organ_type) != 'KIDNEY' THEN
        RAISE_APPLICATION_ERROR(-20030, 'VITAL Strict Scope Error: Only KIDNEY transplantation is supported. Detected organ_type: ' || :NEW.organ_type);
    END IF;
    -- Standardize casing
    :NEW.organ_type := 'KIDNEY';
END;
/

-- =============================================================================
-- TRIGGER 2: TRG_PREVENT_EXPIRED_ALLOCATION
-- Enforces BR4: Prevents creating or accepting an allocation for an expired kidney
-- =============================================================================
CREATE OR REPLACE TRIGGER TRG_PREVENT_EXPIRED_ALLOCATION
BEFORE INSERT ON ALLOCATION
FOR EACH ROW
DECLARE
    v_expiry_time TIMESTAMP;
    v_organ_status VARCHAR2(20);
BEGIN
    SELECT expiry_time, status
    INTO v_expiry_time, v_organ_status
    FROM ORGAN
    WHERE organ_id = :NEW.organ_id;

    IF v_organ_status = 'EXPIRED' OR v_expiry_time <= SYSTIMESTAMP THEN
        RAISE_APPLICATION_ERROR(-20031, 'BR4 Expiry Violation: Kidney ' || :NEW.organ_id || ' has expired and cannot be allocated.');
    END IF;

    IF v_organ_status != 'AVAILABLE' THEN
        RAISE_APPLICATION_ERROR(-20032, 'Concurrency Protection: Kidney ' || :NEW.organ_id || ' is currently ' || v_organ_status || ' and unavailable.');
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20033, 'Referenced Organ ID ' || :NEW.organ_id || ' does not exist.');
END;
/

-- =============================================================================
-- TRIGGER 3: TRG_AUDIT_ALLOCATION_STATUS
-- Enforces BR5: Automatically creates immutable audit log entries when allocation
-- status transitions occur (OFFERED -> ACCEPTED / DECLINED / COMPLETED)
-- =============================================================================
CREATE OR REPLACE TRIGGER TRG_AUDIT_ALLOCATION_STATUS
AFTER UPDATE OF status ON ALLOCATION
FOR EACH ROW
BEGIN
    IF :OLD.status != :NEW.status THEN
        INSERT INTO AUDIT_LOG (
            log_id,
            alloc_id,
            action,
            action_time,
            user_id,
            entity_type,
            entity_id,
            operation_result,
            details
        ) VALUES (
            SEQ_LOG_ID.NEXTVAL,
            :NEW.alloc_id,
            'STATUS_CHANGE_' || :NEW.status,
            SYSTIMESTAMP,
            NVL(:NEW.approved_by, 'SYSTEM_TRIGGER'),
            'ALLOCATION',
            :NEW.alloc_id,
            'SUCCESS',
            'Allocation status transitioned from ' || :OLD.status || ' to ' || :NEW.status || '. Reason: ' || NVL(:NEW.decision_reason, 'N/A')
        );
    END IF;
END;
/

-- =============================================================================
-- TRIGGER 4: TRG_ENFORCE_VALID_STATUS_TRANSITIONS
-- Enforces strict finite state machine on ALLOCATION table:
-- OFFERED -> ACCEPTED, DECLINED, or CANCELLED
-- ACCEPTED -> COMPLETED
-- DECLINED -> (Terminal)
-- COMPLETED -> (Terminal)
-- =============================================================================
CREATE OR REPLACE TRIGGER TRG_ENFORCE_STATUS_TRANSITIONS
BEFORE UPDATE OF status ON ALLOCATION
FOR EACH ROW
BEGIN
    IF :OLD.status IN ('COMPLETED', 'DECLINED', 'CANCELLED') THEN
        RAISE_APPLICATION_ERROR(-20034, 'Illegal State Transition: Terminal allocation status ' || :OLD.status || ' cannot be altered.');
    END IF;

    IF :OLD.status = 'OFFERED' AND :NEW.status NOT IN ('ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED') THEN
        RAISE_APPLICATION_ERROR(-20035, 'Illegal State Transition: OFFERED status can only transition to ACCEPTED, DECLINED, CANCELLED, or COMPLETED.');
    END IF;
END;
/
