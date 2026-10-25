from fastapi import APIRouter
from typing import Dict, Any, List
from backend.database import execute_query

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/summary", response_model=Dict[str, Any])
def get_system_summary():
    """
    Returns actual database-derived statistics:
    - Registered donors
    - Available kidneys
    - Expired kidneys
    - Registered recipients
    - Waiting-list recipients
    - Pending offers
    - Accepted offers
    - Declined offers
    - Completed allocations
    """
    total_donors = execute_query("SELECT COUNT(*) AS c FROM DONOR")[0]["c"]
    total_recipients = execute_query("SELECT COUNT(*) AS c FROM RECIPIENT")[0]["c"]
    waiting_recipients = execute_query("SELECT COUNT(*) AS c FROM RECIPIENT WHERE status = 'WAITING'")[0]["c"]
    total_organs = execute_query("SELECT COUNT(*) AS c FROM ORGAN WHERE organ_type = 'KIDNEY'")[0]["c"]
    available_kidneys = execute_query("SELECT COUNT(*) AS c FROM ORGAN WHERE organ_type = 'KIDNEY' AND status = 'AVAILABLE'")[0]["c"]
    expired_kidneys = execute_query("SELECT COUNT(*) AS c FROM ORGAN WHERE organ_type = 'KIDNEY' AND status = 'EXPIRED'")[0]["c"]
    
    total_allocations = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION")[0]["c"]
    pending_offers = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION WHERE status = 'OFFERED'")[0]["c"]
    accepted_offers = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION WHERE status = 'ACCEPTED'")[0]["c"]
    declined_offers = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION WHERE status = 'DECLINED'")[0]["c"]
    completed_allocations = execute_query("SELECT COUNT(*) AS c FROM ALLOCATION WHERE status = 'COMPLETED'")[0]["c"]
    total_audit_logs = execute_query("SELECT COUNT(*) AS c FROM AUDIT_LOG")[0]["c"]

    # Urgency distribution (BR3: Tiers 1 through 5, Tier 1 first with most urgency)
    raw_dist = execute_query("""
        SELECT urgency, COUNT(*) AS patient_count 
        FROM RECIPIENT 
        WHERE status = 'WAITING' 
        GROUP BY urgency 
        ORDER BY urgency ASC
    """)
    dist_map = {row["urgency"]: row["patient_count"] for row in raw_dist}
    urgency_dist = [
        {"urgency": tier, "patient_count": dist_map.get(tier, 0)}
        for tier in [1, 2, 3, 4, 5]
    ]

    # Blood group breakdown across inventory vs waitlist
    donor_bg = execute_query("""
        SELECT blood_group, COUNT(*) AS organ_count 
        FROM DONOR d 
        JOIN ORGAN o ON d.donor_id = o.donor_id 
        WHERE o.status = 'AVAILABLE' 
        GROUP BY blood_group
    """)

    recip_bg = execute_query("""
        SELECT blood_group, COUNT(*) AS patient_count 
        FROM RECIPIENT 
        WHERE status = 'WAITING' 
        GROUP BY blood_group
    """)

    # Hospital center activity
    center_activity = execute_query("""
        SELECT 
            h.hospital_id, h.name, h.city,
            COUNT(DISTINCT d.donor_id) AS donors_registered,
            COUNT(DISTINCT r.recipient_id) AS waiting_patients,
            COUNT(DISTINCT o.organ_id) AS kidneys_procured
        FROM HOSPITAL h
        LEFT JOIN DONOR d ON h.hospital_id = d.hospital_id
        LEFT JOIN RECIPIENT r ON h.hospital_id = r.hospital_id
        LEFT JOIN ORGAN o ON h.hospital_id = o.current_hospital_id
        GROUP BY h.hospital_id, h.name, h.city
        ORDER BY donors_registered DESC, waiting_patients DESC
    """)

    return {
        "kpi": {
            "total_donors": total_donors,
            "total_recipients": total_recipients,
            "waiting_recipients": waiting_recipients,
            "total_organs": total_organs,
            "available_kidneys": available_kidneys,
            "expired_kidneys": expired_kidneys,
            "total_allocations": total_allocations,
            "pending_offers": pending_offers,
            "accepted_offers": accepted_offers,
            "declined_offers": declined_offers,
            "completed_allocations": completed_allocations,
            "total_audit_logs": total_audit_logs
        },
        "urgency_distribution": urgency_dist,
        "available_organs_by_bg": donor_bg,
        "waiting_recipients_by_bg": recip_bg,
        "center_activity": center_activity
    }
