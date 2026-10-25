-- =============================================================================
-- VITAL: Vital Information Transplant Allocation & Logistics
-- Oracle Database Schema Definition (DDL)
-- Target: Oracle Database XE / 19c / 21c / 23c / Free
-- Strict Scope: Kidney Transplantation Only
-- =============================================================================

-- Drop tables in reverse foreign-key dependency order (if they exist)
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE AUDIT_LOG CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE ALLOCATION CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE ORGAN CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE RECIPIENT CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE DONOR CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE APP_USER CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE HOSPITAL CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

-- Drop existing sequences
BEGIN
    FOR seq IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN 
               ('SEQ_HOSPITAL_ID', 'SEQ_DONOR_ID', 'SEQ_RECIPIENT_ID', 'SEQ_ORGAN_ID', 'SEQ_ALLOC_ID', 'SEQ_LOG_ID')) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || seq.sequence_name;
    END LOOP;
END;
/

-- Sequences for Primary Keys
CREATE SEQUENCE SEQ_HOSPITAL_ID START WITH 101 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_DONOR_ID START WITH 201 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_RECIPIENT_ID START WITH 301 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_ORGAN_ID START WITH 401 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_ALLOC_ID START WITH 501 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_LOG_ID START WITH 1001 INCREMENT BY 1 NOCACHE;

-- =============================================================================
-- 1. HOSPITAL TABLE
-- =============================================================================
CREATE TABLE HOSPITAL (
    hospital_id         NUMBER(10)          DEFAULT SEQ_HOSPITAL_ID.NEXTVAL CONSTRAINT pk_hospital PRIMARY KEY,
    name                VARCHAR2(150)       NOT NULL,
    city                VARCHAR2(100)       NOT NULL,
    is_center           VARCHAR2(1)         DEFAULT 'Y' NOT NULL CONSTRAINT chk_hospital_is_center CHECK (is_center IN ('Y', 'N')),
    contact_information VARCHAR2(255)
);

COMMENT ON TABLE HOSPITAL IS 'Participating healthcare facilities and certified transplant centers';
COMMENT ON COLUMN HOSPITAL.is_center IS 'Flag indicating if hospital is a designated organ retrieval/transplant center (Y/N)';

-- =============================================================================
-- 2. APP_USER TABLE (Authentication and RBAC Support)
-- =============================================================================
CREATE TABLE APP_USER (
    user_id             VARCHAR2(50)        CONSTRAINT pk_app_user PRIMARY KEY,
    password_hash       VARCHAR2(255)       NOT NULL,
    full_name           VARCHAR2(120)       NOT NULL,
    role                VARCHAR2(35)        NOT NULL CONSTRAINT chk_user_role CHECK (role IN (
                            'TRANSPLANT_COORDINATOR',
                            'HOSPITAL_ADMINISTRATOR',
                            'TRANSPLANT_SURGEON',
                            'REGULATOR_AUDITOR'
                        )),
    hospital_id         NUMBER(10)          CONSTRAINT fk_user_hospital REFERENCES HOSPITAL(hospital_id),
    email               VARCHAR2(120)       NOT NULL,
    is_active           VARCHAR2(1)         DEFAULT 'Y' NOT NULL CONSTRAINT chk_user_active CHECK (is_active IN ('Y', 'N')),
    created_at          DATE                DEFAULT SYSDATE NOT NULL
);

COMMENT ON TABLE APP_USER IS 'Authorized system users categorized by hospital role';

-- =============================================================================
-- 3. DONOR TABLE
-- =============================================================================
CREATE TABLE DONOR (
    donor_id            NUMBER(10)          DEFAULT SEQ_DONOR_ID.NEXTVAL CONSTRAINT pk_donor PRIMARY KEY,
    hospital_id         NUMBER(10)          NOT NULL CONSTRAINT fk_donor_hospital REFERENCES HOSPITAL(hospital_id),
    full_name           VARCHAR2(120)       NOT NULL,
    age                 NUMBER(3)           NOT NULL CONSTRAINT chk_donor_age CHECK (age >= 18 AND age <= 85),
    blood_group         VARCHAR2(5)         NOT NULL CONSTRAINT chk_donor_blood_group CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    hla_type            VARCHAR2(100)       NOT NULL,
    donor_type          VARCHAR2(20)        NOT NULL CONSTRAINT chk_donor_type CHECK (donor_type IN ('LIVING', 'DECEASED')),
    reg_date            DATE                DEFAULT SYSDATE NOT NULL,
    consent_status      VARCHAR2(20)        DEFAULT 'CONSENTED' NOT NULL CONSTRAINT chk_donor_consent CHECK (consent_status IN ('CONSENTED', 'WITHDRAWN', 'PENDING')),
    evaluation_status   VARCHAR2(20)        DEFAULT 'COMPLETED' NOT NULL CONSTRAINT chk_donor_eval CHECK (evaluation_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    verification_status VARCHAR2(20)        DEFAULT 'VERIFIED' NOT NULL CONSTRAINT chk_donor_verif CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED'))
);

COMMENT ON TABLE DONOR IS 'Kidney donors registered with verified clinical profiles and legal consent';

-- =============================================================================
-- 4. RECIPIENT TABLE
-- =============================================================================
CREATE TABLE RECIPIENT (
    recipient_id        NUMBER(10)          DEFAULT SEQ_RECIPIENT_ID.NEXTVAL CONSTRAINT pk_recipient PRIMARY KEY,
    hospital_id         NUMBER(10)          NOT NULL CONSTRAINT fk_recipient_hospital REFERENCES HOSPITAL(hospital_id),
    full_name           VARCHAR2(120)       NOT NULL,
    age                 NUMBER(3)           NOT NULL CONSTRAINT chk_recipient_age CHECK (age >= 1 AND age <= 95),
    blood_group         VARCHAR2(5)         NOT NULL CONSTRAINT chk_recipient_blood_group CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    hla_type            VARCHAR2(100)       NOT NULL,
    urgency             NUMBER(1)           NOT NULL CONSTRAINT chk_recipient_urgency CHECK (urgency BETWEEN 1 AND 5),
    status              VARCHAR2(25)        DEFAULT 'WAITING' NOT NULL CONSTRAINT chk_recipient_status CHECK (status IN ('WAITING', 'MATCHED', 'TRANSPLANTED', 'INACTIVE', 'SUSPENDED')),
    listed_on           DATE                DEFAULT SYSDATE NOT NULL,
    eligibility_status  VARCHAR2(20)        DEFAULT 'ELIGIBLE' NOT NULL CONSTRAINT chk_recipient_eligibility CHECK (eligibility_status IN ('ELIGIBLE', 'INELIGIBLE', 'PENDING_REVIEW'))
);

COMMENT ON TABLE RECIPIENT IS 'Patients registered on the official kidney waiting list';
COMMENT ON COLUMN RECIPIENT.urgency IS 'Medical urgency score from 1 (Low) to 5 (Critical - BR3)';

-- =============================================================================
-- 5. ORGAN TABLE (STRICT KIDNEY-ONLY ENFORCEMENT)
-- =============================================================================
CREATE TABLE ORGAN (
    organ_id            NUMBER(10)          DEFAULT SEQ_ORGAN_ID.NEXTVAL CONSTRAINT pk_organ PRIMARY KEY,
    donor_id            NUMBER(10)          NOT NULL CONSTRAINT fk_organ_donor REFERENCES DONOR(donor_id),
    organ_type          VARCHAR2(20)        DEFAULT 'KIDNEY' NOT NULL CONSTRAINT chk_organ_type_kidney CHECK (organ_type = 'KIDNEY'),
    viable_hours        NUMBER(4,1)         NOT NULL CONSTRAINT chk_organ_viable_hours CHECK (viable_hours > 0),
    available_since     TIMESTAMP           DEFAULT SYSTIMESTAMP NOT NULL,
    expiry_time         TIMESTAMP           NOT NULL,
    status              VARCHAR2(20)        DEFAULT 'AVAILABLE' NOT NULL CONSTRAINT chk_organ_status CHECK (status IN ('AVAILABLE', 'OFFERED', 'ALLOCATED', 'EXPIRED', 'DISCARDED')),
    current_hospital_id NUMBER(10)          NOT NULL CONSTRAINT fk_organ_hospital REFERENCES HOSPITAL(hospital_id)
);

COMMENT ON TABLE ORGAN IS 'Procured kidney inventory monitored for viability and allocation state';
COMMENT ON COLUMN ORGAN.organ_type IS 'Organ type strictly restricted to KIDNEY only';
COMMENT ON COLUMN ORGAN.expiry_time IS 'Calculated timestamp after which cold ischemia limits prevent transplant (BR4)';

-- =============================================================================
-- 6. ALLOCATION TABLE (RESOLVES M:N BETWEEN ORGAN AND RECIPIENT)
-- =============================================================================
CREATE TABLE ALLOCATION (
    alloc_id            NUMBER(10)          DEFAULT SEQ_ALLOC_ID.NEXTVAL CONSTRAINT pk_allocation PRIMARY KEY,
    organ_id            NUMBER(10)          NOT NULL CONSTRAINT fk_alloc_organ REFERENCES ORGAN(organ_id),
    recipient_id        NUMBER(10)          NOT NULL CONSTRAINT fk_alloc_recipient REFERENCES RECIPIENT(recipient_id),
    match_score         NUMBER(5,2)         NOT NULL CONSTRAINT chk_alloc_match_score CHECK (match_score BETWEEN 0 AND 100),
    status              VARCHAR2(20)        DEFAULT 'OFFERED' NOT NULL CONSTRAINT chk_alloc_status CHECK (status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED')),
    alloc_date          DATE                DEFAULT SYSDATE NOT NULL,
    response_time       TIMESTAMP,
    decision_reason     VARCHAR2(255),
    approved_by         VARCHAR2(100),
    CONSTRAINT uq_alloc_organ_recipient UNIQUE (organ_id, recipient_id)
);

COMMENT ON TABLE ALLOCATION IS 'Allocation offers and binding decisions linking an organ to a recipient';
COMMENT ON CONSTRAINT ALLOCATION.uq_alloc_organ_recipient IS 'BR2: Prevents duplicate offers for the same organ to the same candidate';

-- =============================================================================
-- 7. AUDIT_LOG TABLE (IMMUTABLE AUDIT TRAIL)
-- =============================================================================
CREATE TABLE AUDIT_LOG (
    log_id              NUMBER(10)          DEFAULT SEQ_LOG_ID.NEXTVAL CONSTRAINT pk_audit_log PRIMARY KEY,
    alloc_id            NUMBER(10)          CONSTRAINT fk_audit_allocation REFERENCES ALLOCATION(alloc_id),
    action              VARCHAR2(50)        NOT NULL,
    action_time         TIMESTAMP           DEFAULT SYSTIMESTAMP NOT NULL,
    user_id             VARCHAR2(100),
    entity_type         VARCHAR2(50)        NOT NULL,
    entity_id           NUMBER(10),
    operation_result    VARCHAR2(20)        DEFAULT 'SUCCESS' NOT NULL,
    details             VARCHAR2(1000)
);

COMMENT ON TABLE AUDIT_LOG IS 'BR5: Immutable, chronological ledger of all clinical, allocation, and lifecycle events';
