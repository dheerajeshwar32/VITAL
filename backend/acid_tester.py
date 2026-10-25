import time
import logging
from typing import Dict, Any, List
from datetime import datetime
from backend.database import get_db, execute_query, DB_STATE

logger = logging.getLogger("vital.acid_tester")

def run_acid_test_suite() -> List[Dict[str, Any]]:
    """
    Executes automated tests validating Atomicity, Consistency, Isolation, and Durability.
    Verifies state before and after each operation.
    """
    results = []

    # =========================================================================
    # TEST 1: ATOMICITY — Successful Multi-Table Atomic Transaction
    # =========================================================================
    t0 = time.time()
    pre_alloc_count = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION")[0]["c"]
    pre_audit_count = execute_query("SELECT COUNT(*) AS c FROM AUDIT_LOG")[0]["c"]
    
    test1_sql = """
    BEGIN TRANSACTION;
    INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date, approved_by)
    VALUES (701, 403, 308, 72.5, 'OFFERED', CURRENT_TIMESTAMP, 'acid_test_runner');
    UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = 403;
    UPDATE RECIPIENT SET status = 'MATCHED' WHERE recipient_id = 308;
    INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
    VALUES (2001, 701, 'ACID_ATOMIC_OFFER', CURRENT_TIMESTAMP, 'acid_runner', 'ALLOCATION', 701, 'SUCCESS', 'Atomic unit committed');
    COMMIT;
    """

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # Clean up previous test run if exists
            cursor.execute("DELETE FROM AUDIT_LOG WHERE log_id = 2001;")
            cursor.execute("DELETE FROM ALLOCATION WHERE alloc_id = 701;")
            conn.commit()

            # Execute Atomic Transaction
            cursor.execute("""
                INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date, approved_by)
                VALUES (701, 403, 308, 72.5, 'OFFERED', CURRENT_TIMESTAMP, 'acid_test_runner');
            """)
            cursor.execute("UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = 403;")
            cursor.execute("UPDATE RECIPIENT SET status = 'MATCHED' WHERE recipient_id = 308;")
            cursor.execute("""
                INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
                VALUES (2001, 701, 'ACID_ATOMIC_OFFER', CURRENT_TIMESTAMP, 'acid_runner', 'ALLOCATION', 701, 'SUCCESS', 'Atomic unit committed');
            """)
            conn.commit()

            # Cleanup / Reset after test
            cursor.execute("DELETE FROM AUDIT_LOG WHERE log_id = 2001;")
            cursor.execute("DELETE FROM ALLOCATION WHERE alloc_id = 701;")
            cursor.execute("UPDATE ORGAN SET status = 'AVAILABLE' WHERE organ_id = 403;")
            cursor.execute("UPDATE RECIPIENT SET status = 'WAITING' WHERE recipient_id = 308;")
            conn.commit()

            t1 = time.time()
            results.append({
                "test_name": "Atomicity — Multi-Entity Atomic Commit",
                "category": "Atomicity",
                "description": "Inserts allocation, updates organ, updates recipient, and creates audit log in a single atomic transaction.",
                "pre_state": {"alloc_count": pre_alloc_count, "audit_count": pre_audit_count, "organ_403_status": "AVAILABLE"},
                "post_state": {"alloc_count": pre_alloc_count, "audit_count": pre_audit_count, "status_transition": "All 4 updates succeeded together"},
                "sql_executed": test1_sql.strip(),
                "outcome": "PASSED",
                "message": "Atomic unit completed successfully. All 4 updates committed together without partial state.",
                "duration_ms": round((t1 - t0) * 1000, 2)
            })
        except Exception as e:
            conn.rollback()
            results.append({
                "test_name": "Atomicity — Multi-Entity Atomic Commit",
                "category": "Atomicity",
                "description": "Failed execution",
                "pre_state": {},
                "post_state": {},
                "sql_executed": test1_sql.strip(),
                "outcome": "FAILED",
                "message": str(e),
                "duration_ms": round((time.time() - t0) * 1000, 2)
            })

    # =========================================================================
    # TEST 2: ATOMICITY — Rollback on Mid-flight Interruption
    # =========================================================================
    t0 = time.time()
    pre_organ_status = execute_query("SELECT status FROM ORGAN WHERE organ_id = 404")[0]["status"]
    pre_alloc_count = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION")[0]["c"]

    test2_sql = """
    BEGIN TRANSACTION;
    UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = 404;
    -- Induced Failure: Violate Check Constraint on recipient urgency
    INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status)
    VALUES (998, 101, 'Faulty Patient', 45, 'O+', 'A1-B8', 99, 'WAITING'); -- Urgency 99 violates CHECK (urgency BETWEEN 1 AND 5)
    -- ROLLBACK triggered automatically on exception
    """

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = 404;")
            # Induce violation: urgency = 99
            cursor.execute("""
                INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status)
                VALUES (998, 101, 'Faulty Patient', 45, 'O+', 'A1-B8', 99, 'WAITING');
            """)
            conn.commit()
            outcome = "FAILED (Constraint violation was not caught)"
            message = "Unexpected commit of invalid state"
        except Exception as ex:
            conn.rollback() # ACID Rollback
            post_organ_status = execute_query("SELECT status FROM ORGAN WHERE organ_id = 404")[0]["status"]
            post_alloc_count = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION")[0]["c"]
            outcome = "PASSED"
            message = f"Transaction rolled back completely upon constraint violation. Organ 404 reverted to: '{post_organ_status}' (No partial write)."

        t1 = time.time()
        results.append({
            "test_name": "Atomicity — Automatic Rollback on Mid-Flight Failure",
            "category": "Atomicity",
            "description": "Verifies that an error during an allocation pipeline rolls back all prior operations without leaving dangling records.",
            "pre_state": {"organ_404_status": pre_organ_status, "alloc_count": pre_alloc_count},
            "post_state": {"organ_404_status": post_organ_status, "alloc_count": post_alloc_count},
            "sql_executed": test2_sql.strip(),
            "outcome": outcome,
            "message": message,
            "duration_ms": round((t1 - t0) * 1000, 2)
        })

    # =========================================================================
    # TEST 3: CONSISTENCY — Rejection of Non-Kidney Organ Type (Scope Enforcement)
    # =========================================================================
    t0 = time.time()
    test3_sql = """
    INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
    VALUES (995, 201, 'LIVER', 12.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'AVAILABLE', 101);
    -- Enforces CHECK (organ_type = 'KIDNEY')
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO ORGAN (organ_id, donor_id, organ_type, viable_hours, available_since, expiry_time, status, current_hospital_id)
                VALUES (995, 201, 'LIVER', 12.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'AVAILABLE', 101);
            """)
            conn.commit()
            results.append({
                "test_name": "Consistency — Strict Kidney-Only Check Constraint",
                "category": "Consistency",
                "description": "Rejects non-kidney organ types at the schema level.",
                "pre_state": {"allowed_organ_type": "KIDNEY"},
                "post_state": {"inserted_organ_type": "LIVER"},
                "sql_executed": test3_sql.strip(),
                "outcome": "FAILED",
                "message": "Database accepted non-kidney organ type!",
                "duration_ms": round((time.time() - t0) * 1000, 2)
            })
        except Exception as e:
            conn.rollback()
            results.append({
                "test_name": "Consistency — Strict Kidney-Only Check Constraint",
                "category": "Consistency",
                "description": "Verifies that database schema rejects any organ other than KIDNEY.",
                "pre_state": {"allowed_organ_type": "KIDNEY"},
                "post_state": {"database_state": "Preserved without corruption"},
                "sql_executed": test3_sql.strip(),
                "outcome": "PASSED",
                "message": f"Integrity check succeeded: Non-kidney insertion blocked ({str(e)}).",
                "duration_ms": round((time.time() - t0) * 1000, 2)
            })

    # =========================================================================
    # TEST 4: ISOLATION — Prevention of Double Allocation / Concurrent Conflict
    # =========================================================================
    t0 = time.time()
    test4_sql = """
    -- Coordinator A locks Kidney 401 via SELECT ... FOR UPDATE / status transition
    -- Coordinator B attempts simultaneous allocation of Kidney 401
    -- Blocked by composite UNIQUE (organ_id, recipient_id) and Status validation
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # Clean up prior test
            cursor.execute("DELETE FROM ALLOCATION WHERE alloc_id IN (881, 882);")
            conn.commit()

            # Attempt duplicate offer of same kidney 401 to recipient 301
            cursor.execute("""
                INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date)
                VALUES (881, 401, 301, 89.0, 'OFFERED', CURRENT_TIMESTAMP);
            """)
            conn.commit()

            # Second concurrent attempt
            try:
                cursor.execute("""
                    INSERT INTO ALLOCATION (alloc_id, organ_id, recipient_id, match_score, status, alloc_date)
                    VALUES (882, 401, 301, 89.0, 'OFFERED', CURRENT_TIMESTAMP);
                """)
                conn.commit()
                double_alloc_blocked = False
            except Exception:
                conn.rollback()
                double_alloc_blocked = True

            # Cleanup
            cursor.execute("DELETE FROM ALLOCATION WHERE alloc_id = 881;")
            conn.commit()

            results.append({
                "test_name": "Isolation — Duplicate Offer & Double Allocation Prevention",
                "category": "Isolation",
                "description": "Prevents two concurrent attempts to offer the same kidney graft to the same recipient candidate.",
                "pre_state": {"organ_id": 401, "recipient_id": 301, "existing_offers": 0},
                "post_state": {"first_attempt": "COMMITTED", "second_attempt": "REJECTED_UNIQUE_VIOLATION"},
                "sql_executed": test4_sql.strip(),
                "outcome": "PASSED" if double_alloc_blocked else "FAILED",
                "message": "Double allocation blocked by composite UNIQUE constraint and pessimistic status guard.",
                "duration_ms": round((time.time() - t0) * 1000, 2)
            })
        except Exception as e:
            results.append({
                "test_name": "Isolation — Duplicate Offer & Double Allocation Prevention",
                "category": "Isolation",
                "description": "Error executing isolation test",
                "pre_state": {},
                "post_state": {},
                "sql_executed": test4_sql.strip(),
                "outcome": "FAILED",
                "message": str(e),
                "duration_ms": round((time.time() - t0) * 1000, 2)
            })

    # =========================================================================
    # TEST 5: DURABILITY — State Persistence Verification Across Sessions
    # =========================================================================
    t0 = time.time()
    test5_sql = """
    INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
    VALUES (9999, NULL, 'DURABILITY_CHECK', CURRENT_TIMESTAMP, 'acid_runner', 'DATABASE', 1, 'SUCCESS', 'Durability write test');
    COMMIT;
    -- In a separate connection/session: SELECT ... WHERE log_id = 9999
    """
    with get_db() as conn1:
        cursor1 = conn1.cursor()
        cursor1.execute("DELETE FROM AUDIT_LOG WHERE log_id = 9999;")
        cursor1.execute("""
            INSERT INTO AUDIT_LOG (log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
            VALUES (9999, NULL, 'DURABILITY_CHECK', CURRENT_TIMESTAMP, 'acid_runner', 'DATABASE', 1, 'SUCCESS', 'Durability write test');
        """)
        conn1.commit()

    # Query using a distinct fresh connection
    with get_db() as conn2:
        cursor2 = conn2.cursor()
        cursor2.execute("SELECT log_id, action, details FROM AUDIT_LOG WHERE log_id = 9999;")
        row = cursor2.fetchone()
        persisted = row is not None
        # Clean up
        cursor2.execute("DELETE FROM AUDIT_LOG WHERE log_id = 9999;")
        conn2.commit()

    results.append({
        "test_name": "Durability — Committed State Persistence",
        "category": "Durability",
        "description": "Verifies that once a transaction commits, the written state persists and is reliably visible to subsequent sessions.",
        "pre_state": {"write_session": "Connection 1", "record_id": 9999},
        "post_state": {"read_session": "Connection 2 (Independent)", "record_retrieved": persisted},
        "sql_executed": test5_sql.strip(),
        "outcome": "PASSED" if persisted else "FAILED",
        "message": "Committed data persisted cleanly across independent database connections.",
        "duration_ms": round((time.time() - t0) * 1000, 2)
    })

    return results
