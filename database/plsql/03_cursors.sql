-- =============================================================================
-- VITAL: Explicit Cursors Demonstration (Review 2 Rubric - Component F)
-- Demonstrates:
-- 1. Explicit Cursor Declaration
-- 2. OPEN, FETCH with %FOUND/%NOTFOUND loop, and CLOSE
-- 3. Cursor FOR Loop for automated row iteration
-- 4. Parameterized Cursor for Organ-Specific Candidate Ranking
-- =============================================================================

-- =============================================================================
-- SCRIPT 1: EXPLICIT CURSOR (OPEN, FETCH, CLOSE) WITH CLINICAL SCORING
-- Iterates through active candidates, performs multi-criteria evaluation,
-- and outputs ranked candidate details using DBMS_OUTPUT.
-- =============================================================================
CREATE OR REPLACE PROCEDURE DEMO_EXPLICIT_CURSOR_RANKING (
    p_organ_id IN NUMBER
) IS
    -- Variable definitions
    v_donor_id       NUMBER;
    v_donor_bg       VARCHAR2(5);
    v_donor_hla      VARCHAR2(100);
    v_organ_status   VARCHAR2(20);
    v_rank           NUMBER := 0;
    v_match_score    NUMBER(5,2);
    v_waiting_days   NUMBER;

    -- STEP 1: EXPLICIT CURSOR DECLARATION
    -- Filters active waiting list candidates from the RECIPIENT table
    CURSOR cur_candidates IS
        SELECT 
            r.recipient_id,
            r.full_name,
            r.blood_group,
            r.hla_type,
            r.urgency,
            r.listed_on,
            h.name AS hospital_name
        FROM RECIPIENT r
        JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
        WHERE r.status = 'WAITING'
          AND r.eligibility_status = 'ELIGIBLE'
        ORDER BY r.urgency DESC, r.listed_on ASC;

    -- Record variable matching cursor row definition
    v_candidate_rec cur_candidates%ROWTYPE;

BEGIN
    -- Retrieve donor organ details
    SELECT o.donor_id, d.blood_group, d.hla_type, o.status
    INTO v_donor_id, v_donor_bg, v_donor_hla, v_organ_status
    FROM ORGAN o
    JOIN DONOR d ON o.donor_id = d.donor_id
    WHERE o.organ_id = p_organ_id;

    DBMS_OUTPUT.PUT_LINE('=============================================================================');
    DBMS_OUTPUT.PUT_LINE('VITAL EXPLICIT CURSOR MATCHING FOR ORGAN ID: ' || p_organ_id || ' (Donor ' || v_donor_bg || ')');
    DBMS_OUTPUT.PUT_LINE('=============================================================================');

    -- STEP 2: OPEN CURSOR
    OPEN cur_candidates;

    -- STEP 3: FETCH ROWS IN A LOOP
    LOOP
        FETCH cur_candidates INTO v_candidate_rec;
        EXIT WHEN cur_candidates%NOTFOUND;

        -- Apply Business Rule 1 (Blood-group compatibility)
        IF CHECK_BLOOD_GROUP_COMPATIBILITY(v_donor_bg, v_candidate_rec.blood_group) = 1 THEN
            v_rank := v_rank + 1;
            v_waiting_days := ROUND(SYSDATE - v_candidate_rec.listed_on);

            -- Calculate transparent score using stored function
            v_match_score := CALCULATE_MATCH_SCORE(
                v_donor_bg,
                v_candidate_rec.blood_group,
                v_donor_hla,
                v_candidate_rec.hla_type,
                v_candidate_rec.urgency,
                v_waiting_days
            );

            DBMS_OUTPUT.PUT_LINE(
                'Rank #' || v_rank || ' | Recipient: ' || RPAD(v_candidate_rec.full_name, 22) ||
                ' | Urgency: ' || v_candidate_rec.urgency ||
                ' | BG: ' || RPAD(v_candidate_rec.blood_group, 3) ||
                ' | Score: ' || TO_CHAR(v_match_score, '990.99') ||
                ' | Center: ' || v_candidate_rec.hospital_name
            );
        END IF;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Total Eligible Recipients Evaluated via Cursor: ' || v_rank);
    DBMS_OUTPUT.PUT_LINE('Total Cursor Rows Processed: ' || cur_candidates%ROWCOUNT);

    -- STEP 4: CLOSE CURSOR
    CLOSE cur_candidates;

EXCEPTION
    WHEN OTHERS THEN
        IF cur_candidates%ISOPEN THEN
            CLOSE cur_candidates;
        END IF;
        RAISE;
END DEMO_EXPLICIT_CURSOR_RANKING;
/

-- =============================================================================
-- SCRIPT 2: PARAMETERIZED CURSOR WITH FOR LOOP
-- Concise PL/SQL construct for automated iteration without manual open/close
-- =============================================================================
CREATE OR REPLACE PROCEDURE DEMO_CURSOR_FOR_LOOP (
    p_min_urgency IN NUMBER
) IS
    -- Parameterized cursor declaration
    CURSOR cur_urgent_patients (cp_min_urgency NUMBER) IS
        SELECT recipient_id, full_name, blood_group, urgency, listed_on
        FROM RECIPIENT
        WHERE status = 'WAITING'
          AND urgency >= cp_min_urgency
        ORDER BY urgency DESC, listed_on ASC;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- High Urgency Recipients (Urgency >= ' || p_min_urgency || ') ---');
    -- Cursor FOR loop automatically handles OPEN, FETCH, and CLOSE
    FOR recip IN cur_urgent_patients(p_min_urgency) LOOP
        DBMS_OUTPUT.PUT_LINE(
            'ID: ' || recip.recipient_id ||
            ' | Name: ' || recip.full_name ||
            ' | Urgency: ' || recip.urgency ||
            ' | Listed: ' || TO_CHAR(recip.listed_on, 'YYYY-MM-DD')
        );
    END LOOP;
END DEMO_CURSOR_FOR_LOOP;
/
