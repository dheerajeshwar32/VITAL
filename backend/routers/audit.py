from fastapi import APIRouter
from typing import List, Optional
from backend.models import AuditLogResponse
from backend.database import execute_query

router = APIRouter(prefix="/audit", tags=["Audit Log & Regulatory Ledger"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None
):
    """
    Retrieves the chronological, immutable audit trail (BR5).
    Accessible to Regulators and Auditors. Modification or deletion of audit logs is prohibited.
    """
    sql = """
        SELECT 
            log_id, alloc_id, action, action_time, user_id,
            entity_type, entity_id, operation_result, details
        FROM AUDIT_LOG
        WHERE 1=1
    """
    params = []
    if entity_type:
        sql += " AND entity_type = ?"
        params.append(entity_type)
    if action:
        sql += " AND action LIKE ?"
        params.append(f"%{action}%")
    if user_id:
        sql += " AND user_id = ?"
        params.append(user_id)

    sql += " ORDER BY log_id DESC"
    return execute_query(sql, tuple(params))
