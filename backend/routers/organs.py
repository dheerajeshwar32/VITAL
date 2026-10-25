from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from backend.models import OrganResponse, OrganCreate
from backend.database import execute_query, execute_dml

router = APIRouter(prefix="/organs", tags=["Kidney Inventory Management"])

@router.get("", response_model=List[OrganResponse])
def get_organs(status: Optional[str] = None):
    """
    Retrieves kidney inventory records.
    Strictly scoped to organ_type = 'KIDNEY'. Calculates real-time cold ischemia remaining hours.
    """
    sql = """
        SELECT 
            o.organ_id, o.donor_id, o.organ_type, o.viable_hours,
            o.available_since, o.expiry_time, o.status, o.current_hospital_id,
            d.full_name AS donor_name, d.blood_group AS donor_blood_group,
            d.hla_type AS donor_hla, d.donor_type,
            h.name AS hospital_name
        FROM ORGAN o
        JOIN DONOR d ON o.donor_id = d.donor_id
        JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
        WHERE o.organ_type = 'KIDNEY'
    """
    params = []
    if status:
        sql += " AND o.status = ?"
        params.append(status)
    sql += " ORDER BY o.organ_id DESC"

    rows = execute_query(sql, tuple(params))
    now = datetime.now()
    results = []
    for r in rows:
        try:
            exp_dt = datetime.fromisoformat(r["expiry_time"].replace(" ", "T"))
            hrs_rem = round((exp_dt - now).total_seconds() / 3600.0, 2)
            is_exp = hrs_rem <= 0 or r["status"] == "EXPIRED"
        except Exception:
            hrs_rem = 0.0
            is_exp = False
        results.append({
            **r,
            "hours_remaining": hrs_rem,
            "is_expired": is_exp
        })
    return results

@router.get("/{organ_id}", response_model=OrganResponse)
def get_organ(organ_id: int):
    """Retrieves a single kidney inventory record."""
    rows = execute_query("""
        SELECT 
            o.organ_id, o.donor_id, o.organ_type, o.viable_hours,
            o.available_since, o.expiry_time, o.status, o.current_hospital_id,
            d.full_name AS donor_name, d.blood_group AS donor_blood_group,
            d.hla_type AS donor_hla, d.donor_type,
            h.name AS hospital_name
        FROM ORGAN o
        JOIN DONOR d ON o.donor_id = d.donor_id
        JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
        WHERE o.organ_id = ?
    """, (organ_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Kidney graft not found")

    r = rows[0]
    exp_dt = datetime.fromisoformat(r["expiry_time"].replace(" ", "T"))
    now = datetime.now()
    hrs_rem = round((exp_dt - now).total_seconds() / 3600.0, 2)
    is_exp = hrs_rem <= 0 or r["status"] == "EXPIRED"
    return {**r, "hours_remaining": hrs_rem, "is_expired": is_exp}

@router.post("", response_model=OrganResponse, status_code=201)
def register_kidney(payload: OrganCreate):
    """
    Procures and registers a new kidney into inventory.
    Strictly enforces organ_type = 'KIDNEY'. Checks donor clinical clearance.
    """
    if payload.organ_type.upper() != "KIDNEY":
        raise HTTPException(
            status_code=400, 
            detail="VITAL Strict Scope Error: Only KIDNEY transplantation is supported. Rejection for non-kidney types is enforced by database schema."
        )

    # Verify donor existence & clinical readiness
    donor_rows = execute_query("""
        SELECT donor_id, evaluation_status, verification_status, blood_group, hla_type, donor_type, full_name
        FROM DONOR WHERE donor_id = ?
    """, (payload.donor_id,))
    if not donor_rows:
        raise HTTPException(status_code=400, detail="Referenced donor ID does not exist.")

    donor = donor_rows[0]
    if donor["evaluation_status"] != "COMPLETED" or donor["verification_status"] != "VERIFIED":
        raise HTTPException(status_code=400, detail="Cannot procure kidney: Donor clinical evaluation or verification is incomplete.")

    hosp = execute_query("SELECT name FROM HOSPITAL WHERE hospital_id = ?", (payload.current_hospital_id,))
    if not hosp:
        raise HTTPException(status_code=400, detail="Referenced hospital does not exist.")

    next_id_row = execute_query("SELECT COALESCE(MAX(organ_id), 400) + 1 AS next_id FROM ORGAN")
    next_id = next_id_row[0]["next_id"]

    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    expiry_dt = now + timedelta(hours=payload.viable_hours)
    expiry_str = expiry_dt.strftime("%Y-%m-%d %H:%M:%S")

    execute_dml("""
        INSERT INTO ORGAN (
            organ_id, donor_id, organ_type, viable_hours,
            available_since, expiry_time, status, current_hospital_id
        ) VALUES (?, ?, 'KIDNEY', ?, ?, ?, 'AVAILABLE', ?)
    """, (next_id, payload.donor_id, payload.viable_hours, now_str, expiry_str, payload.current_hospital_id))

    # Audit log (BR5)
    execute_dml("""
        INSERT INTO AUDIT_LOG (log_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
        VALUES (
            (SELECT COALESCE(MAX(log_id), 1000) + 1 FROM AUDIT_LOG),
            'ORGAN_RETRIEVAL', CURRENT_TIMESTAMP, 'TRANSPLANT_COORDINATOR', 'ORGAN', ?, 'SUCCESS', ?
        )
    """, (next_id, f"Procured Kidney {next_id} from Donor {payload.donor_id} with {payload.viable_hours}h cold ischemia limit"))

    return {
        "organ_id": next_id,
        "donor_id": payload.donor_id,
        "organ_type": "KIDNEY",
        "viable_hours": payload.viable_hours,
        "available_since": now_str,
        "expiry_time": expiry_str,
        "status": "AVAILABLE",
        "current_hospital_id": payload.current_hospital_id,
        "donor_name": donor["full_name"],
        "donor_blood_group": donor["blood_group"],
        "donor_hla": donor["hla_type"],
        "donor_type": donor["donor_type"],
        "hospital_name": hosp[0]["name"],
        "hours_remaining": payload.viable_hours,
        "is_expired": False
    }

@router.post("/batch-expire", response_model=dict)
def trigger_batch_expiry():
    """
    Executes automated cold ischemia batch expiration check (Simulates PL/SQL procedure EXPIRE_KIDNEYS).
    Transitions all unallocated kidneys past their expiry window to EXPIRED status and writes an audit log.
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    expired_rows = execute_query("""
        SELECT organ_id FROM ORGAN 
        WHERE organ_type = 'KIDNEY' AND status = 'AVAILABLE' AND expiry_time <= ?
    """, (now_str,))
    count = len(expired_rows)

    if count > 0:
        execute_dml("""
            UPDATE ORGAN SET status = 'EXPIRED' 
            WHERE organ_type = 'KIDNEY' AND status = 'AVAILABLE' AND expiry_time <= ?
        """, (now_str,))

        execute_dml("""
            INSERT INTO AUDIT_LOG (log_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
            VALUES (
                (SELECT COALESCE(MAX(log_id), 1000) + 1 FROM AUDIT_LOG),
                'BATCH_EXPIRE_KIDNEYS', CURRENT_TIMESTAMP, 'SYSTEM_SCHEDULER', 'ORGAN', NULL, 'SUCCESS', ?
            )
        """, (f"Automated cold ischemia check marked {count} kidney(s) as EXPIRED",))

    return {
        "status": "SUCCESS",
        "expired_count": count,
        "message": f"Evaluated kidney inventory. {count} organ(s) transitioned to EXPIRED state."
    }
