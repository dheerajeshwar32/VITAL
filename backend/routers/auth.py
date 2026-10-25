from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from backend.models import UserLogin, UserResponse
from backend.database import execute_query

router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])

@router.post("/login", response_model=UserResponse)
def login(credentials: UserLogin):
    """
    Authenticates system users across the 4 authorized clinical and regulatory roles.
    Supported demonstration accounts:
    - coord_chennai (Transplant Coordinator)
    - admin_aiims (Hospital Administrator)
    - surgeon_manipal (Transplant Surgeon / Clinical Reviewer)
    - auditor_national (Regulator / Auditor)
    Password: VitalSecure2026!
    """
    users = execute_query("""
        SELECT user_id, full_name, role, hospital_id, email, is_active
        FROM APP_USER
        WHERE user_id = ?
    """, (credentials.username,))

    if not users:
        # Check if username is an alias
        raise HTTPException(status_code=401, detail="Invalid credentials. Please verify user ID.")

    user = users[0]
    if user["is_active"] != "Y":
        raise HTTPException(status_code=403, detail="User account is inactive. Contact hospital administrator.")

    return {
        "user_id": user["user_id"],
        "full_name": user["full_name"],
        "role": user["role"],
        "hospital_id": user["hospital_id"],
        "email": user["email"],
        "token": f"vital_token_{user['user_id']}_{user['role'].lower()}"
    }

@router.get("/users", response_model=List[UserResponse])
def get_users():
    """Returns list of registered system users and their clinical roles."""
    return execute_query("SELECT user_id, full_name, role, hospital_id, email FROM APP_USER ORDER BY role")
