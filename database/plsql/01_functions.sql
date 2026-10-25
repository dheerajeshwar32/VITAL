-- =============================================================================
-- VITAL: PL/SQL Stored Functions (Review 2 Rubric - Component E)
-- Implements:
-- 1. CHECK_BLOOD_GROUP_COMPATIBILITY
-- 2. CALCULATE_MATCH_SCORE
-- 3. IS_KIDNEY_EXPIRED
-- =============================================================================

-- =============================================================================
-- FUNCTION 1: CHECK_BLOOD_GROUP_COMPATIBILITY
-- Evaluates clinical ABO compatibility for kidney transplantation
-- Returns: 1 (Compatible), 0 (Incompatible)
-- Standard Rule:
-- O can donate to O, A, B, AB (Universal Donor)
-- A can donate to A, AB
-- B can donate to B, AB
-- AB can donate to AB only
-- Rh factor (+/-): Rh- can donate to Rh+ and Rh-; Rh+ strictly to Rh+
-- =============================================================================
CREATE OR REPLACE FUNCTION CHECK_BLOOD_GROUP_COMPATIBILITY (
    p_donor_bg IN VARCHAR2,
    p_recip_bg IN VARCHAR2
) RETURN NUMBER IS
    v_donor_abo VARCHAR2(2);
    v_donor_rh  VARCHAR2(1);
    v_recip_abo VARCHAR2(2);
    v_recip_rh  VARCHAR2(1);
BEGIN
    IF p_donor_bg IS NULL OR p_recip_bg IS NULL THEN
        RETURN 0;
    END IF;

    -- Extract ABO and Rh components
    v_donor_rh := SUBSTR(p_donor_bg, -1);
    v_donor_abo := SUBSTR(p_donor_bg, 1, LENGTH(p_donor_bg) - 1);
    v_recip_rh := SUBSTR(p_recip_bg, -1);
    v_recip_abo := SUBSTR(p_recip_bg, 1, LENGTH(p_recip_bg) - 1);

    -- Rh Compatibility Check: Rh+ cannot donate to Rh-
    IF v_donor_rh = '+' AND v_recip_rh = '-' THEN
        RETURN 0;
    END IF;

    -- ABO Compatibility Check
    IF v_donor_abo = 'O' THEN
        RETURN 1; -- Universal ABO donor
    ELSIF v_donor_abo = 'A' THEN
        IF v_recip_abo IN ('A', 'AB') THEN
            RETURN 1;
        ELSE
            RETURN 0;
        END IF;
    ELSIF v_donor_abo = 'B' THEN
        IF v_recip_abo IN ('B', 'AB') THEN
            RETURN 1;
        ELSE
            RETURN 0;
        END IF;
    ELSIF v_donor_abo = 'AB' THEN
        IF v_recip_abo = 'AB' THEN
            RETURN 1;
        ELSE
            RETURN 0;
        END IF;
    END IF;

    RETURN 0;
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END CHECK_BLOOD_GROUP_COMPATIBILITY;
/

-- =============================================================================
-- FUNCTION 2: CALCULATE_MATCH_SCORE
-- Calculates a transparent demonstration match score between 0.00 and 100.00
-- Factors:
-- 1. Urgency tier (1 to 5) -> Up to 40 points
-- 2. Waiting List Seniority -> Up to 25 points
-- 3. ABO Exact Match Bonus -> Up to 15 points
-- 4. HLA Compatibility Proximity -> Up to 20 points
-- =============================================================================
CREATE OR REPLACE FUNCTION CALCULATE_MATCH_SCORE (
    p_donor_bg     IN VARCHAR2,
    p_recip_bg     IN VARCHAR2,
    p_donor_hla    IN VARCHAR2,
    p_recip_hla    IN VARCHAR2,
    p_urgency      IN NUMBER,
    p_waiting_days IN NUMBER
) RETURN NUMBER IS
    v_score NUMBER(5,2) := 0.0;
    v_is_compatible NUMBER;
BEGIN
    -- Verify base blood group compatibility
    v_is_compatible := CHECK_BLOOD_GROUP_COMPATIBILITY(p_donor_bg, p_recip_bg);
    IF v_is_compatible = 0 THEN
        RETURN 0.00;
    END IF;

    -- 1. Urgency Contribution (Max 40 points: 8 points per urgency level)
    v_score := v_score + (NVL(p_urgency, 1) * 8.0);

    -- 2. Waiting List Seniority (Max 25 points, capped at 3 years / 1095 days)
    v_score := v_score + LEAST(NVL(p_waiting_days, 0) / 1095.0 * 25.0, 25.0);

    -- 3. ABO Compatibility Bonus (15 points for identical blood group, 10 for compatible O)
    IF p_donor_bg = p_recip_bg THEN
        v_score := v_score + 15.0;
    ELSE
        v_score := v_score + 10.0;
    END IF;

    -- 4. Demonstration HLA Locus Proximity (Max 20 points)
    IF p_donor_hla IS NOT NULL AND p_recip_hla IS NOT NULL THEN
        IF p_donor_hla = p_recip_hla THEN
            v_score := v_score + 20.0;
        ELSIF SUBSTR(p_donor_hla, 1, 3) = SUBSTR(p_recip_hla, 1, 3) THEN
            v_score := v_score + 12.0;
        ELSE
            v_score := v_score + 5.0;
        END IF;
    ELSE
        v_score := v_score + 5.0;
    END IF;

    -- Ensure final score is strictly clamped between 0 and 100
    IF v_score > 100.0 THEN
        v_score := 100.0;
    ELSIF v_score < 0.0 THEN
        v_score := 0.0;
    END IF;

    RETURN ROUND(v_score, 2);
END CALCULATE_MATCH_SCORE;
/

-- =============================================================================
-- FUNCTION 3: IS_KIDNEY_EXPIRED
-- Returns 1 if organ has passed its cold ischemia expiry timestamp or is marked EXPIRED, 0 otherwise
-- =============================================================================
CREATE OR REPLACE FUNCTION IS_KIDNEY_EXPIRED (
    p_organ_id IN NUMBER
) RETURN NUMBER IS
    v_expiry TIMESTAMP;
    v_status VARCHAR2(20);
BEGIN
    SELECT expiry_time, status 
    INTO v_expiry, v_status
    FROM ORGAN
    WHERE organ_id = p_organ_id;

    IF v_status = 'EXPIRED' OR v_expiry <= SYSTIMESTAMP THEN
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 1;
    WHEN OTHERS THEN
        RETURN 1;
END IS_KIDNEY_EXPIRED;
/
