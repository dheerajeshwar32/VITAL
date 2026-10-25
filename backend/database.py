import logging
import sqlite3
import os
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from contextlib import contextmanager
from backend.config import settings

logger = logging.getLogger("vital.database")
logging.basicConfig(level=logging.INFO)

try:
    import oracledb
except ImportError:
    oracledb = None

DB_STATE = {
    "driver": "DISCONNECTED",
    "oracle_connected": False,
    "oracle_dsn": settings.ORACLE_DSN,
    "oracle_user": settings.ORACLE_USER,
    "error_message": None,
    "initialized_at": None,
    "mirror_active": False
}

SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "vital_local.db")

# Helper functions for SQLite mirror to emulate Oracle PL/SQL functions
def sqlite_compat_check(donor_bg: str, recip_bg: str) -> int:
    if not donor_bg or not recip_bg:
        return 0
    donor_rh = donor_bg[-1]
    donor_abo = donor_bg[:-1]
    recip_rh = recip_bg[-1]
    recip_abo = recip_bg[:-1]

    if donor_rh == '+' and recip_rh == '-':
        return 0

    if donor_abo == 'O':
        return 1
    elif donor_abo == 'A':
        return 1 if recip_abo in ['A', 'AB'] else 0
    elif donor_abo == 'B':
        return 1 if recip_abo in ['B', 'AB'] else 0
    elif donor_abo == 'AB':
        return 1 if recip_abo == 'AB' else 0
    return 0

def sqlite_calculate_score(donor_bg: str, recip_bg: str, donor_hla: str, recip_hla: str, urgency: int, waiting_days: int) -> float:
    if sqlite_compat_check(donor_bg, recip_bg) == 0:
        return 0.0
    
    score = 0.0
    # 1. Urgency (Max 40 points)
    score += (urgency or 1) * 8.0
    
    # 2. Seniority (Max 25 points)
    score += min(((waiting_days or 0) / 1095.0) * 25.0, 25.0)
    
    # 3. ABO Exact Match Bonus
    if donor_bg == recip_bg:
        score += 15.0
    else:
        score += 10.0
        
    # 4. HLA Proximity (Max 20 points)
    if donor_hla and recip_hla:
        if donor_hla == recip_hla:
            score += 20.0
        elif donor_hla[:3] == recip_hla[:3]:
            score += 12.0
        else:
            score += 5.0
    else:
        score += 5.0
        
    return round(min(max(score, 0.0), 100.0), 2)

def sqlite_is_expired(expiry_str: str, status: str) -> int:
    if status == 'EXPIRED':
        return 1
    if not expiry_str:
        return 0
    try:
        dt = datetime.fromisoformat(expiry_str.replace(" ", "T"))
        return 1 if dt <= datetime.now() else 0
    except Exception:
        return 0


def get_sqlite_connection():
    conn = sqlite3.connect(SQLITE_DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    # Register Oracle-compatible functions
    conn.create_function("CHECK_BLOOD_GROUP_COMPATIBILITY", 2, sqlite_compat_check)
    conn.create_function("CALCULATE_MATCH_SCORE", 6, sqlite_calculate_score)
    conn.create_function("IS_KIDNEY_EXPIRED", 2, sqlite_is_expired)
    return conn


def init_sqlite_schema():
    """Initializes the relational schema and seed data in SQLite mirror mode."""
    logger.info("Initializing relational schema in ACID Mirror Engine...")
    conn = get_sqlite_connection()
    cursor = conn.cursor()

    # Drop existing tables
    tables = ["AUDIT_LOG", "ALLOCATION", "ORGAN", "RECIPIENT", "DONOR", "APP_USER", "HOSPITAL"]
    for table in tables:
        cursor.execute(f"DROP TABLE IF EXISTS {table};")

    # 1. HOSPITAL
    cursor.execute("""
    CREATE TABLE HOSPITAL (
        hospital_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        is_center TEXT NOT NULL DEFAULT 'Y' CHECK (is_center IN ('Y', 'N')),
        contact_information TEXT
    );
    """)

    # 2. APP_USER
    cursor.execute("""
    CREATE TABLE APP_USER (
        user_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN (
            'TRANSPLANT_COORDINATOR',
            'HOSPITAL_ADMINISTRATOR',
            'TRANSPLANT_SURGEON',
            'REGULATOR_AUDITOR'
        )),
        hospital_id INTEGER REFERENCES HOSPITAL(hospital_id),
        email TEXT NOT NULL,
        is_active TEXT NOT NULL DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
        created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );
    """)

    # 3. DONOR
    cursor.execute("""
    CREATE TABLE DONOR (
        donor_id INTEGER PRIMARY KEY,
        hospital_id INTEGER NOT NULL REFERENCES HOSPITAL(hospital_id),
        full_name TEXT NOT NULL,
        age INTEGER NOT NULL CHECK (age >= 18 AND age <= 85),
        blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
        hla_type TEXT NOT NULL,
        donor_type TEXT NOT NULL CHECK (donor_type IN ('LIVING', 'DECEASED')),
        reg_date TEXT NOT NULL DEFAULT (DATETIME('now')),
        consent_status TEXT NOT NULL DEFAULT 'CONSENTED' CHECK (consent_status IN ('CONSENTED', 'WITHDRAWN', 'PENDING')),
        evaluation_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (evaluation_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
        verification_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED'))
    );
    """)

    # 4. RECIPIENT
    cursor.execute("""
    CREATE TABLE RECIPIENT (
        recipient_id INTEGER PRIMARY KEY,
        hospital_id INTEGER NOT NULL REFERENCES HOSPITAL(hospital_id),
        full_name TEXT NOT NULL,
        age INTEGER NOT NULL CHECK (age >= 1 AND age <= 95),
        blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
        hla_type TEXT NOT NULL,
        urgency INTEGER NOT NULL CHECK (urgency BETWEEN 1 AND 5),
        status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'MATCHED', 'TRANSPLANTED', 'INACTIVE', 'SUSPENDED')),
        listed_on TEXT NOT NULL DEFAULT (DATETIME('now')),
        eligibility_status TEXT NOT NULL DEFAULT 'ELIGIBLE' CHECK (eligibility_status IN ('ELIGIBLE', 'INELIGIBLE', 'PENDING_REVIEW'))
    );
    """)

    # 5. ORGAN (Strict Kidney-Only)
    cursor.execute("""
    CREATE TABLE ORGAN (
        organ_id INTEGER PRIMARY KEY,
        donor_id INTEGER NOT NULL REFERENCES DONOR(donor_id),
        organ_type TEXT NOT NULL DEFAULT 'KIDNEY' CHECK (organ_type = 'KIDNEY'),
        viable_hours REAL NOT NULL CHECK (viable_hours > 0),
        available_since TEXT NOT NULL DEFAULT (DATETIME('now')),
        expiry_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OFFERED', 'ALLOCATED', 'EXPIRED', 'DISCARDED')),
        current_hospital_id INTEGER NOT NULL REFERENCES HOSPITAL(hospital_id)
    );
    """)

    # 6. ALLOCATION (Resolves M:N and prevents duplicates)
    cursor.execute("""
    CREATE TABLE ALLOCATION (
        alloc_id INTEGER PRIMARY KEY,
        organ_id INTEGER NOT NULL REFERENCES ORGAN(organ_id),
        recipient_id INTEGER NOT NULL REFERENCES RECIPIENT(recipient_id),
        match_score REAL NOT NULL CHECK (match_score BETWEEN 0 AND 100),
        status TEXT NOT NULL DEFAULT 'OFFERED' CHECK (status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED')),
        alloc_date TEXT NOT NULL DEFAULT (DATETIME('now')),
        response_time TEXT,
        decision_reason TEXT,
        approved_by TEXT,
        UNIQUE (organ_id, recipient_id)
    );
    """)

    # 7. AUDIT_LOG
    cursor.execute("""
    CREATE TABLE AUDIT_LOG (
        log_id INTEGER PRIMARY KEY,
        alloc_id INTEGER REFERENCES ALLOCATION(alloc_id),
        action TEXT NOT NULL,
        action_time TEXT NOT NULL DEFAULT (DATETIME('now')),
        user_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        operation_result TEXT NOT NULL DEFAULT 'SUCCESS',
        details TEXT
    );
    """)

    # Views for Review 2
    cursor.execute("""
    CREATE VIEW IF NOT EXISTS V_AVAILABLE_KIDNEYS AS
    SELECT 
        o.organ_id,
        o.donor_id,
        d.full_name AS donor_reference,
        d.blood_group,
        d.hla_type,
        d.donor_type,
        o.viable_hours,
        o.available_since,
        o.expiry_time,
        ROUND((JULIANDAY(o.expiry_time) - JULIANDAY('now')) * 24, 2) AS hours_until_expiry,
        o.current_hospital_id,
        h.name AS hospital_name,
        h.city AS hospital_city
    FROM ORGAN o
    JOIN DONOR d ON o.donor_id = d.donor_id
    JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
    WHERE o.organ_type = 'KIDNEY'
      AND o.status = 'AVAILABLE'
      AND o.expiry_time > DATETIME('now');
    """)

    cursor.execute("""
    CREATE VIEW IF NOT EXISTS V_WAITING_RECIPIENTS AS
    SELECT 
        r.recipient_id,
        r.full_name,
        r.age,
        r.blood_group,
        r.hla_type,
        r.urgency,
        r.status,
        r.listed_on,
        ROUND(JULIANDAY('now') - JULIANDAY(r.listed_on)) AS waiting_days,
        r.eligibility_status,
        r.hospital_id,
        h.name AS hospital_name,
        h.city AS hospital_city
    FROM RECIPIENT r
    JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
    WHERE r.status = 'WAITING'
      AND r.eligibility_status = 'ELIGIBLE';
    """)

    # Insert Seed Hospitals
    hospitals = [
        (101, 'Apollo Speciality Transplant Institute', 'Chennai', 'Y', 'organs@apollo-chennai.org | +91 44 2829 0200'),
        (102, 'AIIMS Organ Retrieval and Banking Org', 'New Delhi', 'Y', 'orbo@aiims.edu | +91 11 2658 8500'),
        (103, 'Fortis Memorial Research Institute', 'Gurugram', 'Y', 'transplant@fortis.com | +91 124 492 1021'),
        (104, 'Manipal Comprehensive Kidney Center', 'Bengaluru', 'Y', 'kidney@manipal.edu | +91 80 2502 4444'),
        (105, 'King Edward Memorial Regional Hospital', 'Mumbai', 'Y', 'kemtransplant@mcgm.gov.in | +91 22 2410 7000'),
        (106, 'Coimbatore District Healthcare Facility', 'Coimbatore', 'N', 'admin@coimbatore-health.org | +91 422 230 1122'),
    ]
    cursor.executemany("INSERT INTO HOSPITAL VALUES (?, ?, ?, ?, ?);", hospitals)

    # Insert Seed Users
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    users = [
        ('coord_chennai', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Dr. Radhika Raman (Coordinator)', 'TRANSPLANT_COORDINATOR', 101, 'radhika.raman@apollo-chennai.org', 'Y', now_str),
        ('admin_aiims', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Arjun Verma (Hospital Admin)', 'HOSPITAL_ADMINISTRATOR', 102, 'admin.verma@aiims.edu', 'Y', now_str),
        ('surgeon_manipal', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Dr. Sandeep Hegde (Chief Surgeon)', 'TRANSPLANT_SURGEON', 104, 'sandeep.hegde@manipal.edu', 'Y', now_str),
        ('auditor_national', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Priya Kulkarni (National Regulator)', 'REGULATOR_AUDITOR', 102, 'auditor@notto.gov.in', 'Y', now_str)
    ]
    cursor.executemany("INSERT INTO APP_USER VALUES (?, ?, ?, ?, ?, ?, ?, ?);", users)

    # Insert Seed Donors
    donors = [
        (201, 101, 'Donor Ref-K201 (Deceased)', 34, 'O+', 'A2-B7-DR4', 'DECEASED', (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'COMPLETED', 'VERIFIED'),
        (202, 102, 'Donor Ref-K202 (Living)', 42, 'A+', 'A1-B8-DR3', 'LIVING', (datetime.now() - timedelta(days=12)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'COMPLETED', 'VERIFIED'),
        (203, 104, 'Donor Ref-K203 (Deceased)', 28, 'B+', 'A24-B44-DR7', 'DECEASED', (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'COMPLETED', 'VERIFIED'),
        (204, 103, 'Donor Ref-K204 (Living)', 50, 'AB+', 'A3-B35-DR15', 'LIVING', (datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'COMPLETED', 'VERIFIED'),
        (205, 105, 'Donor Ref-K205 (Deceased)', 61, 'O-', 'A2-B44-DR4', 'DECEASED', (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'COMPLETED', 'VERIFIED'),
        (206, 101, 'Donor Ref-K206 (Pending Eval)', 39, 'A-', 'A11-B51-DR1', 'DECEASED', (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'PENDING', 'PENDING'),
        (207, 104, 'Donor Ref-K207 (Deceased)', 45, 'B-', 'A2-B18-DR11', 'DECEASED', (datetime.now() - timedelta(days=8)).strftime("%Y-%m-%d %H:%M:%S"), 'CONSENTED', 'COMPLETED', 'VERIFIED'),
    ]
    cursor.executemany("INSERT INTO DONOR VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", donors)

    # Insert Seed Recipients
    recipients = [
        (301, 101, 'Patient Rec-R301', 48, 'O+', 'A2-B7-DR4', 5, 'WAITING', (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (302, 102, 'Patient Rec-R302', 36, 'O+', 'A2-B8-DR4', 4, 'WAITING', (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (303, 104, 'Patient Rec-R303', 55, 'A+', 'A1-B8-DR3', 4, 'WAITING', (datetime.now() - timedelta(days=240)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (304, 103, 'Patient Rec-R304', 29, 'B+', 'A24-B44-DR7', 3, 'WAITING', (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (305, 105, 'Patient Rec-R305', 62, 'AB+', 'A3-B35-DR15', 2, 'WAITING', (datetime.now() - timedelta(days=320)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (306, 101, 'Patient Rec-R306', 41, 'A-', 'A1-B8-DR4', 3, 'WAITING', (datetime.now() - timedelta(days=110)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (307, 102, 'Patient Rec-R307', 50, 'O-', 'A2-B44-DR4', 5, 'WAITING', (datetime.now() - timedelta(days=400)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (308, 104, 'Patient Rec-R308', 33, 'B-', 'A2-B18-DR11', 1, 'WAITING', (datetime.now() - timedelta(days=45)).strftime("%Y-%m-%d"), 'ELIGIBLE'),
        (309, 103, 'Patient Rec-R309 (Review Required)', 47, 'O+', 'A2-B7-DR15', 4, 'WAITING', (datetime.now() - timedelta(days=80)).strftime("%Y-%m-%d"), 'PENDING_REVIEW'),
        (310, 105, 'Patient Rec-R310 (Inactive)', 59, 'A+', 'A1-B35-DR3', 2, 'INACTIVE', (datetime.now() - timedelta(days=500)).strftime("%Y-%m-%d"), 'INELIGIBLE'),
    ]
    cursor.executemany("INSERT INTO RECIPIENT VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", recipients)

    # Insert Seed Organs (Strict Kidney Only)
    organs = [
        (401, 201, 'KIDNEY', 28.0, (datetime.now() - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"), (datetime.now() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S"), 'AVAILABLE', 101),
        (402, 202, 'KIDNEY', 30.0, (datetime.now() - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"), (datetime.now() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S"), 'AVAILABLE', 102),
        (403, 203, 'KIDNEY', 24.0, (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), (datetime.now() + timedelta(hours=22)).strftime("%Y-%m-%d %H:%M:%S"), 'AVAILABLE', 104),
        (404, 205, 'KIDNEY', 36.0, (datetime.now() - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"), (datetime.now() + timedelta(hours=28)).strftime("%Y-%m-%d %H:%M:%S"), 'AVAILABLE', 105),
        (405, 204, 'KIDNEY', 24.0, (datetime.now() - timedelta(hours=40)).strftime("%Y-%m-%d %H:%M:%S"), (datetime.now() - timedelta(hours=16)).strftime("%Y-%m-%d %H:%M:%S"), 'ALLOCATED', 103),
        (406, 207, 'KIDNEY', 20.0, (datetime.now() - timedelta(hours=30)).strftime("%Y-%m-%d %H:%M:%S"), (datetime.now() - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"), 'EXPIRED', 104),
    ]
    cursor.executemany("INSERT INTO ORGAN VALUES (?, ?, ?, ?, ?, ?, ?, ?);", organs)

    # Insert Seed Allocations
    allocations = [
        (501, 405, 305, 94.50, 'COMPLETED', (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"), (datetime.now() - timedelta(hours=36)).strftime("%Y-%m-%d %H:%M:%S"), 'Optimal 6-antigen HLA match with urgency tier 2 compatibility', 'Dr. Sandeep Hegde'),
        (502, 402, 306, 76.00, 'DECLINED', (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"), (datetime.now() - timedelta(hours=18)).strftime("%Y-%m-%d %H:%M:%S"), 'Recipient temporarily febrile; delayed for acute antibiotic therapy', 'Dr. Radhika Raman'),
    ]
    cursor.executemany("INSERT INTO ALLOCATION VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", allocations)

    # Insert Seed Audit Logs
    audit_logs = [
        (1001, None, 'SYSTEM_INITIALIZATION', (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"), 'SYSTEM', 'DATABASE', 1, 'SUCCESS', 'VITAL Schema initialized with strict kidney transplantation parameters'),
        (1002, None, 'DONOR_REGISTRATION', (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"), 'coord_chennai', 'DONOR', 201, 'SUCCESS', 'Registered deceased donor Ref-K201 (O+). Consent and clinical review verified'),
        (1003, None, 'ORGAN_RETRIEVAL', (datetime.now() - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"), 'coord_chennai', 'ORGAN', 401, 'SUCCESS', 'Procured Kidney 401 from Donor 201; 28 hours cold ischemia limit recorded'),
        (1004, 501, 'ALLOCATION_COMPLETED', (datetime.now() - timedelta(hours=36)).strftime("%Y-%m-%d %H:%M:%S"), 'surgeon_manipal', 'ALLOCATION', 501, 'SUCCESS', 'Transplant completed successfully for Recipient 305. Organ 405 marked ALLOCATED'),
        (1005, 502, 'OFFER_DECLINED', (datetime.now() - timedelta(hours=18)).strftime("%Y-%m-%d %H:%M:%S"), 'coord_chennai', 'ALLOCATION', 502, 'SUCCESS', 'Offer declined by clinical reviewer for Recipient 306; kidney returned to active pool'),
    ]
    cursor.executemany("INSERT INTO AUDIT_LOG VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", audit_logs)

    conn.commit()
    conn.close()
    logger.info("Relational schema and seed data successfully initialized.")


def init_database():
    """Attempts Oracle Database connection; falls back to ACID mirror if unreachable."""
    global DB_STATE
    DB_STATE["initialized_at"] = datetime.now().isoformat()
    
    if oracledb:
        try:
            logger.info(f"Attempting connection to Oracle Database at {settings.ORACLE_DSN} as {settings.ORACLE_USER}...")
            # Set connection timeout to 3 seconds so server startup is not blocked if Oracle is down
            conn = oracledb.connect(
                user=settings.ORACLE_USER,
                password=settings.ORACLE_PASSWORD,
                dsn=settings.ORACLE_DSN,
                expire_time=3
            )
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM DUAL")
            res = cursor.fetchone()
            conn.close()
            
            DB_STATE["driver"] = "ORACLE_XE"
            DB_STATE["oracle_connected"] = True
            DB_STATE["mirror_active"] = False
            logger.info("CONNECTED TO ORACLE DATABASE XE / 19c / 21c / 23c SUCCESSFULLY!")
            return
        except Exception as e:
            logger.warning(f"Could not connect to Oracle Database at {settings.ORACLE_DSN}: {str(e)}")
            DB_STATE["error_message"] = str(e)

    # If Oracle not reachable, activate ACID mirror driver
    DB_STATE["driver"] = "SQLITE_MIRROR"
    DB_STATE["oracle_connected"] = False
    DB_STATE["mirror_active"] = True
    init_sqlite_schema()
    logger.info("Operating in ACID Relational Mirror Mode. All ACID transactions, constraints, and queries active.")


@contextmanager
def get_db():
    """Context manager yielding active database connection (Oracle or ACID Mirror)."""
    if DB_STATE["oracle_connected"] and oracledb:
        conn = oracledb.connect(
            user=settings.ORACLE_USER,
            password=settings.ORACLE_PASSWORD,
            dsn=settings.ORACLE_DSN
        )
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = get_sqlite_connection()
        try:
            yield conn
        finally:
            conn.close()


def execute_query(sql: str, params: Optional[Tuple] = None) -> List[Dict[str, Any]]:
    """Executes a SELECT query and returns rows as dictionaries."""
    with get_db() as conn:
        cursor = conn.cursor()
        if DB_STATE["oracle_connected"]:
            cursor.execute(sql, params or ())
            cols = [d[0].lower() for d in cursor.description]
            rows = []
            for r in cursor.fetchall():
                rows.append(dict(zip(cols, r)))
            return rows
        else:
            # Mirror Mode
            cursor.execute(sql, params or ())
            rows = cursor.fetchall()
            return [dict(row) for row in rows]


def execute_dml(sql: str, params: Optional[Tuple] = None) -> int:
    """Executes an INSERT, UPDATE, or DELETE and returns affected row count."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        conn.commit()
        return cursor.rowcount


def get_db_status() -> Dict[str, Any]:
    """Returns database connection status and entity counts."""
    counts = {}
    try:
        counts["hospitals"] = execute_query("SELECT COUNT(*) AS c FROM HOSPITAL")[0]["c"]
        counts["donors"] = execute_query("SELECT COUNT(*) AS c FROM DONOR")[0]["c"]
        counts["recipients"] = execute_query("SELECT COUNT(*) AS c FROM RECIPIENT")[0]["c"]
        counts["organs"] = execute_query("SELECT COUNT(*) AS c FROM ORGAN")[0]["c"]
        counts["available_kidneys"] = execute_query("SELECT COUNT(*) AS c FROM ORGAN WHERE status = 'AVAILABLE'")[0]["c"]
        counts["allocations"] = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION")[0]["c"]
        counts["audit_logs"] = execute_query("SELECT COUNT(*) AS c FROM AUDIT_LOG")[0]["c"]
    except Exception as e:
        logger.error(f"Error fetching counts: {e}")

    return {
        **DB_STATE,
        "counts": counts
    }
