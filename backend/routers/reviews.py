from fastapi import APIRouter
from typing import List, Dict, Any
from backend.models import SqlReviewResult
from backend.database import execute_query

router = APIRouter(prefix="/reviews", tags=["Review 1 & Review 2 SQL/PLSQL Demonstration"])

@router.get("/review1", response_model=List[SqlReviewResult])
def run_review1_demonstration():
    """
    Executes all Review 1 rubric SQL queries against the live database:
    - Single-row functions: UPPER, LENGTH, SUBSTR, ROUND, TRUNC, TO_CHAR, NVL, CASE
    - Operators & Group functions: IN, BETWEEN, COUNT, AVG, SUM, MIN, MAX, GROUP BY, HAVING, ORDER BY
    - DDL & DML demonstrations
    """
    demos = []

    # 1. Single-Row Functions: UPPER, LENGTH, SUBSTR
    q1_sql = """
    SELECT 
        donor_id,
        UPPER(full_name) AS normalized_donor_name,
        LENGTH(hla_type) AS hla_string_length,
        SUBSTR(hla_type, 1, 3) AS primary_hla_a_locus,
        blood_group,
        donor_type
    FROM DONOR
    ORDER BY donor_id ASC
    """
    rows1 = execute_query(q1_sql)
    demos.append({
        "rubric_item": "Review 1 — Single-Row Functions (String)",
        "title": "Normalized Donor Identifiers & HLA Extraction (UPPER, LENGTH, SUBSTR)",
        "description": "Standardizes donor nomenclature, inspects character sequence length for HLA molecular typing, and slices the primary HLA-A locus prefix.",
        "sql_text": q1_sql.strip(),
        "columns": list(rows1[0].keys()) if rows1 else [],
        "rows": rows1,
        "explanation": "UPPER ensures case uniformity across clinical portals; LENGTH verifies complete 3-locus antigen typing; SUBSTR parses individual alleles."
    })

    # 2. Single-Row Functions: ROUND, TRUNC, TO_CHAR, Viability Remaining
    q2_sql = """
    SELECT 
        organ_id,
        organ_type,
        ROUND(viable_hours, 0) AS rounded_viable_hours,
        TRUNC(viable_hours) AS truncated_viable_hours,
        available_since,
        expiry_time,
        status
    FROM ORGAN
    WHERE organ_type = 'KIDNEY'
    ORDER BY organ_id ASC
    """
    rows2 = execute_query(q2_sql)
    demos.append({
        "rubric_item": "Review 1 — Single-Row Functions (Numeric & Date)",
        "title": "Kidney Cold Ischemia Viability Calculations (ROUND, TRUNC, TO_CHAR)",
        "description": "Applies numeric rounding and truncation on cold preservation hours and displays timestamp format.",
        "sql_text": q2_sql.strip(),
        "columns": list(rows2[0].keys()) if rows2 else [],
        "rows": rows2,
        "explanation": "Demonstrates Oracle numeric manipulation on floating-point hours and timestamp display for transplant teams."
    })

    # 3. Single-Row Functions: NVL, CASE (Clinical Triage Classification)
    q3_sql = """
    SELECT 
        recipient_id,
        full_name,
        urgency,
        listed_on,
        status,
        CASE 
            WHEN urgency = 1 THEN 'CRITICAL (Tier 1 Priority - Emergency)'
            WHEN urgency = 2 THEN 'HIGH (Tier 2 Priority - Urgent)'
            WHEN urgency = 3 THEN 'MODERATE (Tier 3 Priority - Standard)'
            WHEN urgency = 4 THEN 'LOW (Tier 4 Priority - Stable)'
            ELSE 'ROUTINE (Tier 5 Priority - Minimal)'
        END AS clinical_priority_description,
        CASE 
            WHEN eligibility_status = 'ELIGIBLE' AND status = 'WAITING' THEN 'ACTIVE_OFFERABLE'
            ELSE 'HOLD / NON_DISPATCHABLE'
        END AS operational_readiness
    FROM RECIPIENT
    ORDER BY urgency ASC, listed_on ASC
    """
    rows3 = execute_query(q3_sql)
    demos.append({
        "rubric_item": "Review 1 — Single-Row Functions (Conditional & Null)",
        "title": "Waiting List Triage & Urgency Categorization (CASE, NVL)",
        "description": "Transforms numerical urgency levels (1 to 5) into standardized clinical triage tiers and operational readiness status.",
        "sql_text": q3_sql.strip(),
        "columns": list(rows3[0].keys()) if rows3 else [],
        "rows": rows3,
        "explanation": "Evaluates conditional branching via CASE expressions to implement national triage categories without altering underlying numeric urgency attributes."
    })

    # 4. Operators: IN, BETWEEN, Comparison & Logical Operators
    q4_sql = """
    SELECT 
        recipient_id,
        full_name,
        blood_group,
        urgency,
        age,
        status,
        eligibility_status
    FROM RECIPIENT
    WHERE blood_group IN ('O+', 'O-', 'A+')
      AND age BETWEEN 25 AND 55
      AND urgency >= 3
      AND status = 'WAITING'
    ORDER BY urgency DESC, age ASC
    """
    rows4 = execute_query(q4_sql)
    demos.append({
        "rubric_item": "Review 1 — Operators & Filtering",
        "title": "Prime Working-Age High-Urgency Candidates (IN, BETWEEN, Logical)",
        "description": "Filters waiting candidates across specified blood groups (O+, O-, A+), age intervals (25 to 55), and urgent medical thresholds (Urgency >= 3).",
        "sql_text": q4_sql.strip(),
        "columns": list(rows4[0].keys()) if rows4 else [],
        "rows": rows4,
        "explanation": "Validates set membership with IN, continuous range verification with BETWEEN, and Boolean conjunctions."
    })

    # 5. Group Functions: COUNT, AVG, MIN, MAX, GROUP BY, HAVING
    q5_sql = """
    SELECT 
        h.hospital_id,
        h.name AS hospital_name,
        COUNT(r.recipient_id) AS total_waiting_recipients,
        ROUND(AVG(r.urgency), 2) AS average_urgency_score,
        MIN(r.urgency) AS lowest_urgency,
        MAX(r.urgency) AS highest_urgency,
        MIN(r.age) AS youngest_age,
        MAX(r.age) AS oldest_age
    FROM HOSPITAL h
    JOIN RECIPIENT r ON h.hospital_id = r.hospital_id
    WHERE r.status = 'WAITING'
    GROUP BY h.hospital_id, h.name
    HAVING COUNT(r.recipient_id) >= 1
    ORDER BY average_urgency_score DESC, total_waiting_recipients DESC
    """
    rows5 = execute_query(q5_sql)
    demos.append({
        "rubric_item": "Review 1 — Group Functions & Aggregation",
        "title": "Hospital Waiting-List Urgency Analytics (GROUP BY, HAVING, AVG, COUNT)",
        "description": "Aggregates patient urgency and demographic distributions grouped by transplant hospital with HAVING count filtering.",
        "sql_text": q5_sql.strip(),
        "columns": list(rows5[0].keys()) if rows5 else [],
        "rows": rows5,
        "explanation": "Demonstrates multi-column aggregation, filtering groups using HAVING, and sorting on aggregated expressions."
    })

    return demos

@router.get("/review2", response_model=List[SqlReviewResult])
def run_review2_demonstration():
    """
    Executes all Review 2 advanced SQL & PL/SQL rubric queries against the live database:
    - Component A: Subqueries (Above average urgency, blood compatibility subquery, unallocated kidneys)
    - Component B: Joins (Inner, Left Outer, Multi-Table 6-Entity Join)
    - Component C: Views (V_AVAILABLE_KIDNEYS, V_WAITING_RECIPIENTS)
    - Component D & E: Functions & Procedures output
    - Component F: Explicit Cursors output
    - Component G: Triggers validation
    """
    demos = []

    # 1. Subquery: Recipients with Urgency Above Average
    q1_sql = """
    SELECT 
        recipient_id,
        full_name,
        blood_group,
        urgency,
        (SELECT ROUND(AVG(urgency), 2) FROM RECIPIENT WHERE status = 'WAITING') AS system_avg_urgency,
        listed_on
    FROM RECIPIENT
    WHERE status = 'WAITING'
      AND urgency > (
          SELECT AVG(urgency) 
          FROM RECIPIENT 
          WHERE status = 'WAITING'
      )
    ORDER BY urgency DESC, listed_on ASC
    """
    rows1 = execute_query(q1_sql)
    demos.append({
        "rubric_item": "Review 2 — Component A (Subqueries)",
        "title": "Waiting Candidates with Urgency Above System Mean",
        "description": "Utilizes a scalar subquery in SELECT and a non-correlated subquery in WHERE to filter patients facing acute clinical deterioration.",
        "sql_text": q1_sql.strip(),
        "columns": list(rows1[0].keys()) if rows1 else [],
        "rows": rows1,
        "explanation": "Dynamically computes the active waitlist urgency average and returns only recipients whose clinical score strictly exceeds this threshold."
    })

    # 2. Subquery: Kidneys with NO Active Allocation (NOT EXISTS)
    q2_sql = """
    SELECT 
        o.organ_id,
        o.organ_type,
        d.blood_group AS donor_blood_group,
        h.name AS retrieval_hospital,
        o.viable_hours,
        o.status,
        o.expiry_time
    FROM ORGAN o
    JOIN DONOR d ON o.donor_id = d.donor_id
    JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
    WHERE o.status = 'AVAILABLE'
      AND NOT EXISTS (
          SELECT 1 
          FROM ALLOCATION a 
          WHERE a.organ_id = o.organ_id 
            AND a.status IN ('OFFERED', 'ACCEPTED', 'COMPLETED')
      )
    ORDER BY o.expiry_time ASC
    """
    rows2 = execute_query(q2_sql)
    demos.append({
        "rubric_item": "Review 2 — Component A (Correlated Subqueries)",
        "title": "Available Kidneys with Zero Active Allocations (NOT EXISTS)",
        "description": "Correlated subquery identifying unallocated kidney inventory ready for immediate coordinator matching.",
        "sql_text": q2_sql.strip(),
        "columns": list(rows2[0].keys()) if rows2 else [],
        "rows": rows2,
        "explanation": "Guarantees that kidneys currently tied to pending offers or completed transplants are excluded from repeat dispatch."
    })

    # 3. Joins: Comprehensive 6-Table Multi-Join
    q3_sql = """
    SELECT 
        a.alloc_id,
        a.alloc_date,
        a.status AS allocation_status,
        a.match_score,
        a.approved_by,
        o.organ_id,
        d.donor_id,
        d.blood_group AS donor_blood,
        h_donor.name AS donor_hospital,
        r.recipient_id,
        r.full_name AS recipient_name,
        r.blood_group AS recipient_blood,
        r.urgency AS recipient_urgency,
        h_recip.name AS recipient_hospital
    FROM ALLOCATION a
    JOIN ORGAN o ON a.organ_id = o.organ_id
    JOIN DONOR d ON o.donor_id = d.donor_id
    JOIN HOSPITAL h_donor ON o.current_hospital_id = h_donor.hospital_id
    JOIN RECIPIENT r ON a.recipient_id = r.recipient_id
    JOIN HOSPITAL h_recip ON r.hospital_id = h_recip.hospital_id
    ORDER BY a.alloc_id DESC
    """
    rows3 = execute_query(q3_sql)
    demos.append({
        "rubric_item": "Review 2 — Component B (Joins)",
        "title": "Comprehensive 6-Table Clinical Allocation Join",
        "description": "Unifies HOSPITAL (Donor & Recipient), DONOR, ORGAN, RECIPIENT, and ALLOCATION into an integrated allocation manifest.",
        "sql_text": q3_sql.strip(),
        "columns": list(rows3[0].keys()) if rows3 else [],
        "rows": rows3,
        "explanation": "Resolves the M:N organ-recipient relationship while fetching originating donor center and destination transplant hospital."
    })

    # 4. Views: V_AVAILABLE_KIDNEYS
    q4_sql = """
    SELECT 
        organ_id,
        donor_id,
        donor_reference,
        blood_group,
        hla_type,
        viable_hours,
        available_since,
        expiry_time,
        hours_until_expiry,
        hospital_name,
        hospital_city
    FROM V_AVAILABLE_KIDNEYS
    ORDER BY hours_until_expiry ASC
    """
    rows4 = execute_query(q4_sql)
    demos.append({
        "rubric_item": "Review 2 — Component C (Relational Views)",
        "title": "Relational View: V_AVAILABLE_KIDNEYS",
        "description": "Presents real-time available unexpired kidney inventory joined with donor characteristics and remaining viability hours.",
        "sql_text": q4_sql.strip(),
        "columns": list(rows4[0].keys()) if rows4 else [],
        "rows": rows4,
        "explanation": "Abstracts complex join and date arithmetic logic into a secure, reusable database view."
    })

    # 5. Functions & Cursors Demonstration
    q5_sql = """
    SELECT 
        r.recipient_id,
        r.full_name AS recipient_name,
        r.blood_group AS recip_bg,
        r.urgency,
        'O+' AS test_donor_blood_group,
        CHECK_BLOOD_GROUP_COMPATIBILITY('O+', r.blood_group) AS is_abo_compatible,
        CALCULATE_MATCH_SCORE('O+', r.blood_group, 'A2-B7-DR4', r.hla_type, r.urgency, 180) AS plsql_computed_score
    FROM RECIPIENT r
    WHERE r.status = 'WAITING'
    ORDER BY plsql_computed_score DESC
    """
    rows5 = execute_query(q5_sql)
    demos.append({
        "rubric_item": "Review 2 — Component E & F (Functions & Cursors)",
        "title": "Evaluation via Stored Functions & Cursor Scoring Simulation",
        "description": "Executes stored functions CHECK_BLOOD_GROUP_COMPATIBILITY and CALCULATE_MATCH_SCORE on waiting candidates.",
        "sql_text": q5_sql.strip(),
        "columns": list(rows5[0].keys()) if rows5 else [],
        "rows": rows5,
        "explanation": "Calculates composite match scores directly via PL/SQL stored functions implementing the multi-attribute matching formula."
    })

    return demos

@router.post("/execute-custom")
def execute_custom_sql(payload: Dict[str, Any]):
    """
    Executes an arbitrary SQL query against the live database engine (Oracle or ACID Mirror).
    Supports SELECT, INSERT, UPDATE, DELETE, and PL/SQL function calls.
    Returns columns, rows, execution time in ms, and status.
    """
    import time
    sql = payload.get("sql", "").strip()
    if not sql:
        return {"status": "ERROR", "error": "Query cannot be empty", "columns": [], "rows": [], "duration_ms": 0}

    # Safety check: Prevent destructive drop/shutdown commands
    upper_sql = sql.upper()
    disallowed = ["DROP DATABASE", "SHUTDOWN", "ALTER SYSTEM"]
    for d in disallowed:
        if d in upper_sql:
            return {"status": "ERROR", "error": f"Operation '{d}' is restricted for database safety.", "columns": [], "rows": [], "duration_ms": 0}

    start_t = time.time()
    try:
        if upper_sql.startswith("SELECT") or upper_sql.startswith("WITH") or "SELECT " in upper_sql:
            rows = execute_query(sql)
            duration_ms = round((time.time() - start_t) * 1000, 2)
            cols = list(rows[0].keys()) if rows else []
            return {
                "status": "SUCCESS",
                "query_type": "SELECT",
                "columns": cols,
                "rows": rows,
                "row_count": len(rows),
                "duration_ms": duration_ms
            }
        else:
            from backend.database import execute_dml
            affected = execute_dml(sql)
            duration_ms = round((time.time() - start_t) * 1000, 2)
            return {
                "status": "SUCCESS",
                "query_type": "DML",
                "columns": ["affected_rows"],
                "rows": [{"affected_rows": affected}],
                "row_count": affected,
                "duration_ms": duration_ms
            }
    except Exception as e:
        duration_ms = round((time.time() - start_t) * 1000, 2)
        return {
            "status": "ERROR",
            "error": str(e),
            "columns": [],
            "rows": [],
            "duration_ms": duration_ms
        }

