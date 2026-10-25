from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from backend.models import RecipientResponse, RecipientCreate
from backend.database import execute_query, execute_dml

router = APIRouter(prefix="/recipients", tags=["Recipient Management (Waiting List)"])

@router.get("", response_model=List[RecipientResponse])
def get_recipients(
    status: Optional[str] = None, 
    blood_group: Optional[str] = None,
    min_urgency: Optional[int] = None,
    urgency: Optional[int] = None,
    sort_order: Optional[str] = "asc"
):
    """Retrieves patients on the kidney transplant waiting list."""
    sql = """
        SELECT 
            r.recipient_id, r.hospital_id, r.full_name, r.age, r.blood_group,
            r.hla_type, r.urgency, r.status, r.listed_on, r.eligibility_status,
            h.name AS hospital_name
        FROM RECIPIENT r
        JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
        WHERE 1=1
    """
    params = []
    if status:
        sql += " AND r.status = ?"
        params.append(status)
    if blood_group:
        sql += " AND r.blood_group = ?"
        params.append(blood_group)
    if urgency is not None:
        sql += " AND r.urgency = ?"
        params.append(urgency)
    elif min_urgency is not None:
        sql += " AND r.urgency >= ?"
        params.append(min_urgency)

    order_dir = "DESC" if sort_order and sort_order.lower() == "desc" else "ASC"
    sql += f" ORDER BY r.urgency {order_dir}, r.listed_on ASC"
    
    rows = execute_query(sql, tuple(params))
    now = datetime.now()
    results = []
    for r in rows:
        try:
            listed_dt = datetime.fromisoformat(r["listed_on"].replace(" ", "T"))
            w_days = max((now - listed_dt).days, 0)
        except Exception:
            w_days = 30
        results.append({
            **r,
            "waiting_days": w_days
        })
    return results

@router.get("/{recipient_id}", response_model=RecipientResponse)
def get_recipient(recipient_id: int):
    """Retrieves a single recipient by ID."""
    rows = execute_query("""
        SELECT 
            r.recipient_id, r.hospital_id, r.full_name, r.age, r.blood_group,
            r.hla_type, r.urgency, r.status, r.listed_on, r.eligibility_status,
            h.name AS hospital_name
        FROM RECIPIENT r
        JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
        WHERE r.recipient_id = ?
    """, (recipient_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    r = rows[0]
    try:
        listed_dt = datetime.fromisoformat(r["listed_on"].replace(" ", "T"))
        w_days = max((datetime.now() - listed_dt).days, 0)
    except Exception:
        w_days = 30
    return {**r, "waiting_days": w_days}

@router.post("", response_model=RecipientResponse, status_code=201)
def create_recipient(payload: RecipientCreate):
    """Enrolls a new patient onto the active kidney transplant waiting list."""
    # Check hospital
    hosp = execute_query("SELECT name FROM HOSPITAL WHERE hospital_id = ?", (payload.hospital_id,))
    if not hosp:
        raise HTTPException(status_code=400, detail="Referenced hospital does not exist.")

    next_id_row = execute_query("SELECT COALESCE(MAX(recipient_id), 300) + 1 AS next_id FROM RECIPIENT")
    next_id = next_id_row[0]["next_id"]
    now_str = datetime.now().strftime("%Y-%m-%d")

    execute_dml("""
        INSERT INTO RECIPIENT (
            recipient_id, hospital_id, full_name, age, blood_group,
            hla_type, urgency, status, listed_on, eligibility_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        next_id, payload.hospital_id, payload.full_name, payload.age, payload.blood_group,
        payload.hla_type, payload.urgency, payload.status, now_str, payload.eligibility_status
    ))

    # Audit log
    execute_dml("""
        INSERT INTO AUDIT_LOG (log_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
        VALUES (
            (SELECT COALESCE(MAX(log_id), 1000) + 1 FROM AUDIT_LOG),
            'RECIPIENT_ENROLLMENT', CURRENT_TIMESTAMP, 'HOSPITAL_ADMIN', 'RECIPIENT', ?, 'SUCCESS', ?
        )
    """, (next_id, f"Enrolled recipient: {payload.full_name} ({payload.blood_group}, Urgency {payload.urgency})"))

    return {
        "recipient_id": next_id,
        "hospital_id": payload.hospital_id,
        "full_name": payload.full_name,
        "age": payload.age,
        "blood_group": payload.blood_group,
        "hla_type": payload.hla_type,
        "urgency": payload.urgency,
        "status": payload.status,
        "listed_on": now_str,
        "waiting_days": 0,
        "eligibility_status": payload.eligibility_status,
        "hospital_name": hosp[0]["name"]
    }
