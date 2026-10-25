from fastapi import APIRouter, HTTPException
from typing import List
from backend.models import HospitalResponse, HospitalCreate
from backend.database import execute_query, execute_dml

router = APIRouter(prefix="/hospitals", tags=["Hospital Management"])

@router.get("", response_model=List[HospitalResponse])
def get_hospitals():
    """Retrieves all participating hospitals and designated transplant centers."""
    return execute_query("SELECT hospital_id, name, city, is_center, contact_information FROM HOSPITAL ORDER BY hospital_id")

@router.get("/{hospital_id}", response_model=HospitalResponse)
def get_hospital(hospital_id: int):
    """Retrieves a single hospital by ID."""
    rows = execute_query("SELECT hospital_id, name, city, is_center, contact_information FROM HOSPITAL WHERE hospital_id = ?", (hospital_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return rows[0]

@router.post("", response_model=HospitalResponse, status_code=201)
def create_hospital(payload: HospitalCreate):
    """Registers a new hospital or transplant facility."""
    next_id_row = execute_query("SELECT COALESCE(MAX(hospital_id), 100) + 1 AS next_id FROM HOSPITAL")
    next_id = next_id_row[0]["next_id"]
    
    execute_dml("""
        INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
        VALUES (?, ?, ?, ?, ?)
    """, (next_id, payload.name, payload.city, payload.is_center, payload.contact_information))

    # Audit log
    execute_dml("""
        INSERT INTO AUDIT_LOG (log_id, action, action_time, user_id, entity_type, entity_id, operation_result, details)
        VALUES (
            (SELECT COALESCE(MAX(log_id), 1000) + 1 FROM AUDIT_LOG),
            'REGISTER_HOSPITAL', CURRENT_TIMESTAMP, 'SYSTEM_ADMIN', 'HOSPITAL', ?, 'SUCCESS', ?
        )
    """, (next_id, f"Registered hospital: {payload.name} in {payload.city}"))

    return {
        "hospital_id": next_id,
        "name": payload.name,
        "city": payload.city,
        "is_center": payload.is_center,
        "contact_information": payload.contact_information
    }
