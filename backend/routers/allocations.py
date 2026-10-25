from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from backend.models import AllocationResponse, AllocationCreate, AllocationRespond
from backend.database import execute_query, execute_dml, get_db
from backend.matching_engine import check_blood_group_compatibility, calculate_match_score

router = APIRouter(prefix="/allocations", tags=["Allocation Management & Workflow"])

@router.get("", response_model=List[AllocationResponse])
def get_allocations(status: Optional[str] = None):
    """
    Retrieves kidney allocation history and active offers.
    Joins ORGAN, DONOR, RECIPIENT, and HOSPITAL entities to present full clinical and decision context.
    """
    sql = """
        SELECT 
            a.alloc_id, a.organ_id, a.recipient_id, a.match_score, a.status,
            a.alloc_date, a.response_time, a.decision_reason, a.approved_by,
            o.status AS organ_status,
            d.donor_id, d.blood_group AS donor_blood,
            r.full_name AS recipient_name, r.blood_group AS recipient_blood, r.urgency AS recipient_urgency,
            h_donor.name AS donor_hospital,
            h_recip.name AS recipient_hospital
        FROM ALLOCATION a
        JOIN ORGAN o ON a.organ_id = o.organ_id
        JOIN DONOR d ON o.donor_id = d.donor_id
        JOIN RECIPIENT r ON a.recipient_id = r.recipient_id
        JOIN HOSPITAL h_donor ON o.current_hospital_id = h_donor.hospital_id
        JOIN HOSPITAL h_recip ON r.hospital_id = h_recip.hospital_id
        WHERE 1=1
    """
    params = []
    if status:
        sql += " AND a.status = ?"
        params.append(status)
    sql += " ORDER BY a.alloc_id DESC"

    return execute_query(sql, tuple(params))

@router.get("/{alloc_id}", response_model=AllocationResponse)
def get_allocation(alloc_id: int):
    """Retrieves a single allocation record."""
    rows = execute_query("""
        SELECT 
            a.alloc_id, a.organ_id, a.recipient_id, a.match_score, a.status,
            a.alloc_date, a.response_time, a.decision_reason, a.approved_by,
            o.status AS organ_status,
            d.donor_id, d.blood_group AS donor_blood,
            r.full_name AS recipient_name, r.blood_group AS recipient_blood, r.urgency AS recipient_urgency,
            h_donor.name AS donor_hospital,
            h_recip.name AS recipient_hospital
        FROM ALLOCATION a
        JOIN ORGAN o ON a.organ_id = o.organ_id
        JOIN DONOR d ON o.donor_id = d.donor_id
        JOIN RECIPIENT r ON a.recipient_id = r.recipient_id
        JOIN HOSPITAL h_donor ON o.current_hospital_id = h_donor.hospital_id
        JOIN HOSPITAL h_recip ON r.hospital_id = h_recip.hospital_id
        WHERE a.alloc_id = ?
    """, (alloc_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Allocation record not found")
    return rows[0]

@router.post("", response_model=AllocationResponse, status_code=201)
def create_allocation_offer(payload: AllocationCreate):
    """
    Creates a new kidney allocation offer.
    Implements ACID transactional concurrency control:
    - Verifies organ is AVAILABLE and unexpired (BR4)
    - Verifies recipient is WAITING and ELIGIBLE
    - Validates blood-group compatibility (BR1)
    - Enforces composite uniqueness (BR2: No repeat offers)
    - Updates Organ to OFFERED and Recipient to MATCHED
    - Creates an immutable audit log record (BR5)
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Fetch & Lock Organ
        cursor.execute("""
            SELECT o.organ_id, o.status, o.expiry_time, d.blood_group, d.hla_type, h.name AS donor_hosp
            FROM ORGAN o
            JOIN DONOR d ON o.donor_id = d.donor_id
            JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
            WHERE o.organ_id = ?
        """, (payload.organ_id,))
        organ_row = cursor.fetchone()
        if not organ_row:
            raise HTTPException(status_code=404, detail=f"Organ ID {payload.organ_id} does not exist.")
        
        organ = dict(organ_row)
        if organ["status"] != "AVAILABLE":
            raise HTTPException(status_code=400, detail=f"Concurrency Conflict: Organ {payload.organ_id} is currently '{organ['status']}' and cannot be offered.")

        # Check BR4 expiry
        now = datetime.now()
        exp_dt = datetime.fromisoformat(organ["expiry_time"].replace(" ", "T"))
        if exp_dt <= now:
            cursor.execute("UPDATE ORGAN SET status = 'EXPIRED' WHERE organ_id = ?", (payload.organ_id,))
            conn.commit()
            raise HTTPException(status_code=400, detail=f"BR4 Expiry Violation: Kidney {payload.organ_id} has passed its cold ischemia expiry window.")

        # 2. Fetch Recipient
        cursor.execute("""
            SELECT r.recipient_id, r.full_name, r.blood_group, r.hla_type, r.urgency, r.status, r.listed_on, r.eligibility_status, h.name AS recip_hosp
            FROM RECIPIENT r
            JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
            WHERE r.recipient_id = ?
        """, (payload.recipient_id,))
        recip_row = cursor.fetchone()
        if not recip_row:
            raise HTTPException(status_code=404, detail=f"Recipient ID {payload.recipient_id} does not exist.")

        recip = dict(recip_row)
        if recip["status"] != "WAITING":
            raise HTTPException(status_code=400, detail=f"Recipient {payload.recipient_id} status is '{recip['status']}' (Must be WAITING).")

        if recip["eligibility_status"] != "ELIGIBLE":
            raise HTTPException(status_code=400, detail=f"Recipient eligibility verification is '{recip['eligibility_status']}' (Requires clinical clearance).")

        # 3. Check BR1 Blood Group Compatibility
        if not check_blood_group_compatibility(organ["blood_group"], recip["blood_group"]):
            raise HTTPException(status_code=400, detail=f"BR1 Compatibility Failure: Donor blood group {organ['blood_group']} is incompatible with Recipient {recip['blood_group']}.")

        # 4. Check BR2 Duplicate Offer
        cursor.execute("SELECT alloc_id, status FROM ALLOCATION WHERE organ_id = ? AND recipient_id = ?", (payload.organ_id, payload.recipient_id))
        past_alloc = cursor.fetchone()
        if past_alloc:
            raise HTTPException(status_code=400, detail=f"BR2 Duplicate Offer Violation: Organ {payload.organ_id} was already offered to Recipient {payload.recipient_id} (Status: {past_alloc['status']}).")

        # 5. Calculate Score
        try:
            listed_dt = datetime.fromisoformat(recip["listed_on"].replace(" ", "T"))
            waiting_days = max((now - listed_dt).days, 0)
        except Exception:
            waiting_days = 30
        
        breakdown = calculate_match_score(organ["blood_group"], recip["blood_group"], organ["hla_type"], recip["hla_type"], recip["urgency"], waiting_days)
        match_score = breakdown["total_score"]

        # 6. Execute atomic creation
        cursor.execute("SELECT COALESCE(MAX(alloc_id), 500) + 1 AS next_id FROM ALLOCATION")
        next_alloc_id = cursor.fetchone()["next_id"]
        now_date_str = now.strftime("%Y-%m-%d")

        cursor.execute("""
            INSERT INTO ALLOCATION (
                alloc_id, organ_id, recipient_id, match_score, status, alloc_date, approved_by
            ) VALUES (?, ?, ?, ?, 'OFFERED', ?, ?)
        """, (next_alloc_id, payload.organ_id, payload.recipient_id, match_score, now_date_str, payload.approved_by))

        # Update Organ status to OFFERED
        cursor.execute("UPDATE ORGAN SET status = 'OFFERED' WHERE organ_id = ?", (payload.organ_id,))

        # Update Recipient status to MATCHED
        cursor.execute("UPDATE RECIPIENT SET status = 'MATCHED' WHERE recipient_id = ?", (payload.recipient_id,))

        # 7. Write Audit Log (BR5)
        cursor.execute("SELECT COALESCE(MAX(log_id), 1000) + 1 AS next_id FROM AUDIT_LOG")
        next_log_id = cursor.fetchone()["next_id"]
        now_ts_str = now.strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO AUDIT_LOG (
                log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details
            ) VALUES (?, ?, 'CREATE_OFFER', ?, ?, 'ALLOCATION', ?, 'SUCCESS', ?)
        """, (
            next_log_id, next_alloc_id, now_ts_str, payload.approved_by, next_alloc_id,
            f"Offer created: Kidney {payload.organ_id} ({organ['blood_group']}) to Recipient {payload.recipient_id} ({recip['blood_group']}) with match score {match_score}"
        ))

        conn.commit()

        return {
            "alloc_id": next_alloc_id,
            "organ_id": payload.organ_id,
            "recipient_id": payload.recipient_id,
            "match_score": match_score,
            "status": "OFFERED",
            "alloc_date": now_date_str,
            "response_time": None,
            "decision_reason": None,
            "approved_by": payload.approved_by,
            "organ_status": "OFFERED",
            "donor_id": None,
            "donor_blood": organ["blood_group"],
            "recipient_name": recip["full_name"],
            "recipient_blood": recip["blood_group"],
            "recipient_urgency": recip["urgency"],
            "donor_hospital": organ["donor_hosp"],
            "recipient_hospital": recip["recip_hosp"]
        }

@router.post("/{alloc_id}/respond", response_model=AllocationResponse)
def respond_to_offer(alloc_id: int, payload: AllocationRespond):
    """
    Records an authorized Transplant Surgeon / Reviewer decision (ACCEPTED / DECLINED).
    - If ACCEPTED: Transitions allocation to COMPLETED, organ to ALLOCATED, recipient to TRANSPLANTED.
    - If DECLINED: Allocation remains DECLINED (preserving full audit history!), organ is returned to AVAILABLE, recipient resets to WAITING.
    - Generates immutable audit log entry.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM ALLOCATION WHERE alloc_id = ?", (alloc_id,))
        alloc_row = cursor.fetchone()
        if not alloc_row:
            raise HTTPException(status_code=404, detail="Allocation record not found")

        alloc = dict(alloc_row)
        if alloc["status"] != "OFFERED":
            raise HTTPException(status_code=400, detail=f"Cannot respond to offer: Current status is '{alloc['status']}'.")

        now = datetime.now()
        now_ts = now.strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("SELECT COALESCE(MAX(log_id), 1000) + 1 AS next_id FROM AUDIT_LOG")
        next_log_id = cursor.fetchone()["next_id"]

        if payload.decision == "ACCEPTED":
            cursor.execute("""
                UPDATE ALLOCATION 
                SET status = 'COMPLETED', response_time = ?, decision_reason = ?, approved_by = ?
                WHERE alloc_id = ?
            """, (now_ts, payload.decision_reason, payload.reviewer, alloc_id))

            cursor.execute("UPDATE ORGAN SET status = 'ALLOCATED' WHERE organ_id = ?", (alloc["organ_id"],))
            cursor.execute("UPDATE RECIPIENT SET status = 'TRANSPLANTED' WHERE recipient_id = ?", (alloc["recipient_id"],))

            cursor.execute("""
                INSERT INTO AUDIT_LOG (
                    log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details
                ) VALUES (?, ?, 'OFFER_ACCEPTED', ?, ?, 'ALLOCATION', ?, 'SUCCESS', ?)
            """, (
                next_log_id, alloc_id, now_ts, payload.reviewer, alloc_id,
                f"Offer accepted by reviewer {payload.reviewer}. Kidney {alloc['organ_id']} allocated to Recipient {alloc['recipient_id']}. Rationale: {payload.decision_reason}"
            ))

        else: # DECLINED
            cursor.execute("""
                UPDATE ALLOCATION 
                SET status = 'DECLINED', response_time = ?, decision_reason = ?, approved_by = ?
                WHERE alloc_id = ?
            """, (now_ts, payload.decision_reason, payload.reviewer, alloc_id))

            # Check if organ has expired in the interim
            cursor.execute("SELECT expiry_time FROM ORGAN WHERE organ_id = ?", (alloc["organ_id"],))
            org_exp = cursor.fetchone()["expiry_time"]
            exp_dt = datetime.fromisoformat(org_exp.replace(" ", "T"))
            
            if exp_dt <= now:
                cursor.execute("UPDATE ORGAN SET status = 'EXPIRED' WHERE organ_id = ?", (alloc["organ_id"],))
            else:
                cursor.execute("UPDATE ORGAN SET status = 'AVAILABLE' WHERE organ_id = ?", (alloc["organ_id"],))

            # Return recipient back to WAITING list
            cursor.execute("UPDATE RECIPIENT SET status = 'WAITING' WHERE recipient_id = ?", (alloc["recipient_id"],))

            cursor.execute("""
                INSERT INTO AUDIT_LOG (
                    log_id, alloc_id, action, action_time, user_id, entity_type, entity_id, operation_result, details
                ) VALUES (?, ?, 'OFFER_DECLINED', ?, ?, 'ALLOCATION', ?, 'SUCCESS', ?)
            """, (
                next_log_id, alloc_id, now_ts, payload.reviewer, alloc_id,
                f"Offer declined: {payload.decision_reason}. Kidney {alloc['organ_id']} released back to inventory pool."
            ))

        conn.commit()

    return get_allocation(alloc_id)
