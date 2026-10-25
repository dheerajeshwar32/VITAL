from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# --- Hospital Models ---
class HospitalBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Apollo Speciality Transplant Institute"})
    city: str = Field(..., json_schema_extra={"example": "Chennai"})
    is_center: str = Field("Y", pattern="^[YN]$", json_schema_extra={"example": "Y"})
    contact_information: Optional[str] = Field(None, json_schema_extra={"example": "transplant@apollo-chennai.org"})

class HospitalCreate(HospitalBase):
    pass

class HospitalResponse(HospitalBase):
    hospital_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Donor Models ---
class DonorBase(BaseModel):
    hospital_id: int = Field(..., json_schema_extra={"example": 101})
    full_name: str = Field(..., json_schema_extra={"example": "Donor Ref-K208 (Living)"})
    age: int = Field(..., ge=18, le=85, json_schema_extra={"example": 38})
    blood_group: str = Field(..., pattern="^(A|B|AB|O)[+-]$", json_schema_extra={"example": "O+"})
    hla_type: str = Field(..., json_schema_extra={"example": "A2-B7-DR4"})
    donor_type: str = Field(..., pattern="^(LIVING|DECEASED)$", json_schema_extra={"example": "LIVING"})
    consent_status: str = Field("CONSENTED", pattern="^(CONSENTED|WITHDRAWN|PENDING)$")
    evaluation_status: str = Field("COMPLETED", pattern="^(PENDING|IN_PROGRESS|COMPLETED|REJECTED)$")
    verification_status: str = Field("VERIFIED", pattern="^(PENDING|VERIFIED|FAILED)$")

class DonorCreate(DonorBase):
    pass

class DonorResponse(DonorBase):
    donor_id: int
    reg_date: Optional[str] = None
    hospital_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Recipient Models ---
class RecipientBase(BaseModel):
    hospital_id: int = Field(..., json_schema_extra={"example": 101})
    full_name: str = Field(..., json_schema_extra={"example": "Patient Rec-R311"})
    age: int = Field(..., ge=1, le=95, json_schema_extra={"example": 45})
    blood_group: str = Field(..., pattern="^(A|B|AB|O)[+-]$", json_schema_extra={"example": "O+"})
    hla_type: str = Field(..., json_schema_extra={"example": "A2-B7-DR4"})
    urgency: int = Field(..., ge=1, le=5, json_schema_extra={"example": 4})
    status: str = Field("WAITING", pattern="^(WAITING|MATCHED|TRANSPLANTED|INACTIVE|SUSPENDED)$")
    eligibility_status: str = Field("ELIGIBLE", pattern="^(ELIGIBLE|INELIGIBLE|PENDING_REVIEW)$")

class RecipientCreate(RecipientBase):
    pass

class RecipientResponse(RecipientBase):
    recipient_id: int
    listed_on: Optional[str] = None
    waiting_days: Optional[int] = None
    hospital_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Organ (Kidney Only) Models ---
class OrganBase(BaseModel):
    donor_id: int = Field(..., json_schema_extra={"example": 201})
    organ_type: str = Field("KIDNEY", pattern="^KIDNEY$", description="Strictly restricted to KIDNEY only")
    viable_hours: float = Field(..., gt=0, le=72.0, json_schema_extra={"example": 28.0})
    current_hospital_id: int = Field(..., json_schema_extra={"example": 101})

class OrganCreate(OrganBase):
    pass

class OrganResponse(OrganBase):
    organ_id: int
    available_since: Optional[str] = None
    expiry_time: Optional[str] = None
    status: str
    donor_name: Optional[str] = None
    donor_blood_group: Optional[str] = None
    donor_hla: Optional[str] = None
    donor_type: Optional[str] = None
    hospital_name: Optional[str] = None
    hours_remaining: Optional[float] = None
    is_expired: Optional[bool] = False
    model_config = ConfigDict(from_attributes=True)

# --- Allocation Models ---
class AllocationCreate(BaseModel):
    organ_id: int = Field(..., json_schema_extra={"example": 401})
    recipient_id: int = Field(..., json_schema_extra={"example": 301})
    approved_by: Optional[str] = Field("coord_chennai", json_schema_extra={"example": "coord_chennai"})

class AllocationRespond(BaseModel):
    decision: str = Field(..., pattern="^(ACCEPTED|DECLINED)$", json_schema_extra={"example": "ACCEPTED"})
    decision_reason: str = Field(..., json_schema_extra={"example": "Recipient cleared for emergency kidney transplantation"})
    reviewer: str = Field(..., json_schema_extra={"example": "Dr. Sandeep Hegde"})

class AllocationResponse(BaseModel):
    alloc_id: int
    organ_id: int
    recipient_id: int
    match_score: float
    status: str
    alloc_date: Optional[str] = None
    response_time: Optional[str] = None
    decision_reason: Optional[str] = None
    approved_by: Optional[str] = None
    organ_status: Optional[str] = None
    donor_id: Optional[int] = None
    donor_blood: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_blood: Optional[str] = None
    recipient_urgency: Optional[int] = None
    donor_hospital: Optional[str] = None
    recipient_hospital: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Matching Candidate Models ---
class CandidateMatch(BaseModel):
    recipient_id: int
    recipient_name: str
    blood_group: str
    urgency: int
    waiting_days: int
    hla_type: str
    hospital_name: str
    hospital_id: int
    abo_compatibility: str
    urgency_points: float
    seniority_points: float
    abo_bonus_points: float
    hla_proximity_points: float
    total_match_score: float
    eligibility_status: str
    is_eligible: bool
    exclusion_reason: Optional[str] = None

class KidneyMatchReport(BaseModel):
    organ_id: int
    donor_id: int
    donor_name: str
    donor_blood_group: str
    donor_hla: str
    organ_status: str
    hours_remaining: float
    is_expired: bool
    retrieval_hospital: str
    ranked_candidates: List[CandidateMatch]

# --- Audit Log Models ---
class AuditLogResponse(BaseModel):
    log_id: int
    alloc_id: Optional[int] = None
    action: str
    action_time: str
    user_id: Optional[str] = None
    entity_type: str
    entity_id: Optional[int] = None
    operation_result: str
    details: Optional[str] = None

# --- User & Auth Models ---
class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: str
    full_name: str
    role: str
    hospital_id: Optional[int] = None
    email: str
    token: Optional[str] = None

# --- Demonstration & Diagnostic Models ---
class AcidTestResult(BaseModel):
    test_name: str
    category: str
    description: str
    pre_state: Dict[str, Any]
    post_state: Dict[str, Any]
    sql_executed: str
    outcome: str
    message: str
    duration_ms: float

class SqlReviewResult(BaseModel):
    rubric_item: str
    title: str
    description: str
    sql_text: str
    columns: List[str]
    rows: List[Dict[str, Any]]
    explanation: str
