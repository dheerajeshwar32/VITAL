import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from backend.database import execute_query

logger = logging.getLogger("vital.matching")

def check_blood_group_compatibility(donor_bg: str, recip_bg: str) -> bool:
    """Evaluates ABO and Rh compatibility for kidney transplantation."""
    if not donor_bg or not recip_bg:
        return False
    
    donor_rh = donor_bg[-1]
    donor_abo = donor_bg[:-1]
    recip_rh = recip_bg[-1]
    recip_abo = recip_bg[:-1]

    # Rh compatibility: Rh+ cannot donate to Rh-
    if donor_rh == '+' and recip_rh == '-':
        return False

    # ABO compatibility
    if donor_abo == 'O':
        return True # Universal donor
    elif donor_abo == 'A':
        return recip_abo in ['A', 'AB']
    elif donor_abo == 'B':
        return recip_abo in ['B', 'AB']
    elif donor_abo == 'AB':
        return recip_abo == 'AB'
    return False


def calculate_match_score(
    donor_bg: str, 
    recip_bg: str, 
    donor_hla: str, 
    recip_hla: str, 
    urgency: int, 
    waiting_days: int
) -> Dict[str, float]:
    """
    Calculates a transparent demonstration match score (0 to 100)
    Returns point breakdown across clinical criteria.
    """
    if not check_blood_group_compatibility(donor_bg, recip_bg):
        return {
            "urgency_points": 0.0,
            "seniority_points": 0.0,
            "abo_bonus_points": 0.0,
            "hla_proximity_points": 0.0,
            "total_score": 0.0
        }

    # 1. Medical Urgency (Max 40 points: Tier 1 = highest urgency = 40 pts down to Tier 5 = lowest = 8 pts)
    urgency_points = float((6 - min(max(urgency, 1), 5)) * 8.0)

    # 2. Waiting List Seniority (Max 25 points, scaled up to 3 years / 1095 days)
    seniority_points = round(min(max(waiting_days, 0) / 1095.0 * 25.0, 25.0), 2)

    # 3. ABO Exact Match Bonus (15 points for identical blood group; 10 for compatible O donor)
    abo_bonus_points = 15.0 if donor_bg == recip_bg else 10.0

    # 4. HLA Locus Compatibility Proximity (Max 20 points)
    hla_proximity_points = 5.0
    if donor_hla and recip_hla:
        if donor_hla == recip_hla:
            hla_proximity_points = 20.0
        elif donor_hla[:3] == recip_hla[:3]:
            hla_proximity_points = 12.0
        else:
            hla_proximity_points = 5.0

    total_score = round(min(max(urgency_points + seniority_points + abo_bonus_points + hla_proximity_points, 0.0), 100.0), 2)

    return {
        "urgency_points": urgency_points,
        "seniority_points": seniority_points,
        "abo_bonus_points": abo_bonus_points,
        "hla_proximity_points": hla_proximity_points,
        "total_score": total_score
    }


def get_kidney_match_report(organ_id: int) -> Dict[str, Any]:
    """
    Generates a full match report for a specific kidney graft.
    Retrieves organ data, checks cold ischemia viability, filters active recipients,
    ranks eligible candidates, and details exclusion reasons.
    """
    organs = execute_query("""
        SELECT 
            o.organ_id, o.donor_id, o.organ_type, o.viable_hours, 
            o.available_since, o.expiry_time, o.status AS organ_status,
            d.full_name AS donor_name, d.blood_group AS donor_blood_group, 
            d.hla_type AS donor_hla, d.donor_type,
            h.name AS retrieval_hospital
        FROM ORGAN o
        JOIN DONOR d ON o.donor_id = d.donor_id
        JOIN HOSPITAL h ON o.current_hospital_id = h.hospital_id
        WHERE o.organ_id = ?
    """, (organ_id,))

    if not organs:
        raise ValueError(f"Organ with ID {organ_id} not found.")

    organ = organs[0]
    
    # Calculate time remaining until cold ischemia expiry
    expiry_dt = datetime.fromisoformat(organ["expiry_time"].replace(" ", "T"))
    now = datetime.now()
    hours_remaining = round((expiry_dt - now).total_seconds() / 3600.0, 2)
    is_expired = hours_remaining <= 0 or organ["organ_status"] == 'EXPIRED'

    # Retrieve all recipients from waiting list
    recipients = execute_query("""
        SELECT 
            r.recipient_id, r.hospital_id, r.full_name AS recipient_name,
            r.age, r.blood_group, r.hla_type, r.urgency, r.status,
            r.listed_on, r.eligibility_status,
            h.name AS hospital_name
        FROM RECIPIENT r
        JOIN HOSPITAL h ON r.hospital_id = h.hospital_id
        ORDER BY r.urgency DESC, r.listed_on ASC
    """)

    ranked_candidates = []

    for r in recipients:
        # Calculate waiting days
        try:
            listed_dt = datetime.fromisoformat(r["listed_on"].replace(" ", "T"))
            waiting_days = max((now - listed_dt).days, 0)
        except Exception:
            waiting_days = 30

        is_compat = check_blood_group_compatibility(organ["donor_blood_group"], r["blood_group"])
        breakdown = calculate_match_score(
            organ["donor_blood_group"],
            r["blood_group"],
            organ["donor_hla"],
            r["hla_type"],
            r["urgency"],
            waiting_days
        )

        # Exclusion checks
        exclusion_reason = None
        is_eligible = True

        if not is_compat:
            is_eligible = False
            exclusion_reason = f"ABO Incompatible (Donor {organ['donor_blood_group']} cannot donate to Recipient {r['blood_group']})"
        elif r["status"] != "WAITING":
            is_eligible = False
            exclusion_reason = f"Recipient state is {r['status']} (Not on active waiting list)"
        elif r["eligibility_status"] != "ELIGIBLE":
            is_eligible = False
            exclusion_reason = f"Clinical eligibility flag is {r['eligibility_status']} (Review pending)"
        elif is_expired:
            is_eligible = False
            exclusion_reason = "BR4 Viability Error: Kidney graft has exceeded cold ischemia threshold"

        # Check if already offered (BR2)
        past_allocs = execute_query("""
            SELECT status FROM ALLOCATION 
            WHERE organ_id = ? AND recipient_id = ?
        """, (organ_id, r["recipient_id"]))
        if past_allocs:
            is_eligible = False
            exclusion_reason = f"BR2 Duplicate Offer Violation: Organ previously {past_allocs[0]['status']} to this recipient"

        abo_label = "EXACT_MATCH" if organ["donor_blood_group"] == r["blood_group"] else ("COMPATIBLE_DONOR" if is_compat else "INCOMPATIBLE")

        candidate_info = {
            "recipient_id": r["recipient_id"],
            "recipient_name": r["recipient_name"],
            "blood_group": r["blood_group"],
            "urgency": r["urgency"],
            "waiting_days": waiting_days,
            "hla_type": r["hla_type"],
            "hospital_name": r["hospital_name"],
            "hospital_id": r["hospital_id"],
            "abo_compatibility": abo_label,
            "urgency_points": breakdown["urgency_points"],
            "seniority_points": breakdown["seniority_points"],
            "abo_bonus_points": breakdown["abo_bonus_points"],
            "hla_proximity_points": breakdown["hla_proximity_points"],
            "total_match_score": breakdown["total_score"],
            "eligibility_status": r["eligibility_status"],
            "is_eligible": is_eligible,
            "exclusion_reason": exclusion_reason
        }
        ranked_candidates.append(candidate_info)

    # Sort: Eligible candidates first ordered by total_match_score descending, then excluded candidates
    ranked_candidates.sort(key=lambda c: (1 if c["is_eligible"] else 0, c["total_match_score"]), reverse=True)

    return {
        "organ_id": organ["organ_id"],
        "donor_id": organ["donor_id"],
        "donor_name": organ["donor_name"],
        "donor_blood_group": organ["donor_blood_group"],
        "donor_hla": organ["donor_hla"],
        "organ_status": organ["organ_status"],
        "hours_remaining": hours_remaining,
        "is_expired": is_expired,
        "retrieval_hospital": organ["retrieval_hospital"],
        "ranked_candidates": ranked_candidates
    }
