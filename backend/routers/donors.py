from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from backend.models import DonorResponse, DonorCreate
from backend.database import execute_query, execute_dml

router = APIRouter(prefix="/donors", tags=["Donor Management"])

@router.get("", response_model=List[DonorResponse])
def get_donors(blood_group: Optional[str] = None, donor_type: Optional[str] = None):
    """Retrieves registered kidney donors with clinical evaluation and verification statuses."""
    sql = """
        SELECT 
            d.donor_id, d.hospital_id, d.full_name, d.age, d.blood_group,
            d.hla_type, d.donor_type, d.reg_date, d.consent_status,
            d.evaluation_status, d.verification_status,
            h.name AS hospital_name
        FROM DONOR d
        JOIN HOSPITAL h ON d.hospital_id = h.hospital_id
        WHERE 1=1
    """
    params = []
    if blood_group:
        sql += " AND d.blood_group = ?"
        params.append(blood_group)
    if donor_type:
        sql += " AND d.donor_type = ?"
        params.append(donor_type)
    sql += " ORDER BY d.donor_id DESC"
    
    return execute_query(sql, tuple(params))

@router.get("/{donor_id}", response_model=DonorResponse)
def get_donor(donor_id: int):
    """Retrieves a single donor record by ID."""
    rows = execute_query("""
        SELECT 
            d.donor_id, d.hospital_id, d.full_name, d.age, d.blood_group,
            d.hla_type, d.donor_type, d.reg_date, d.consent_status,
            d.evaluation_status, d.verification_status,
            h.name AS hospital_name
        FROM DONOR d
        JOIN HOSPITAL h ON d.hospital_id = h.hospital_id
        WHERE d.donor_id = ?
    """, (donor_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Donor not found")
    return rows[0]

@router.post("", response_model=DonorResponse, status_code=201)
def create_donor(payload: DonorCreate):
    """Registers a new kidney donor with consent and clinical evaluation."""
    # Check hospital exists
    hosp = execute_query("SELECT name FROM HOSPITAL WHERE hospital_id = ?", (payload.hospital_id,))
    if not hosp:
        raise HTTPException(status_code=400, detail="Referenced hospital does not exist.")

    next_id_row = execute_query("SELECT COALESCE(MAX(donor_id), 200) + 1 AS next_id FROM DONOR")
    next_id = next_id_row[0]["next_id"]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    execute_dml("""
        INSERT INTO DONOR (
            donor_id, hospital_id, full_name, age, blood_group,
            hla_type, donor_type, reg_date, consent_status,
            evaluation_status, verification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        next_id, payload.hospital_id, payload.full_name, payload.age, payload.blood_group,
        payload.hla_type, payload.donor_type, now_str, payload.consent_status,
        payload.evaluation_status, payload.verification_status
    ))

    # Audit log
    execute_dml("""
        INSERT INTO AUDIT_LOG (log_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
        VALUES (
            (SELECT COALESCE(MAX(log_id), 1000) + 1 FROM AUDIT_LOG),
            'DONOR_REGISTRATION', CURRENT_TIMESTAMP, 'HOSPITAL_ADMIN', 'DONOR', ?, 'SUCCESS', ?
        )
    """, (next_id, f"Registered {payload.donor_type.lower()} donor: {payload.full_name} ({payload.blood_group})"))

    return {
        "donor_id": next_id,
        "hospital_id": payload.hospital_id,
        "full_name": payload.full_name,
        "age": payload.age,
        "blood_group": payload.blood_group,
        "hla_type": payload.hla_type,
        "donor_type": payload.donor_type,
        "reg_date": now_str,
        "consent_status": payload.consent_status,
        "evaluation_status": payload.evaluation_status,
        "verification_status": payload.verification_status,
        "hospital_name": hosp[0]["name"]
    }
