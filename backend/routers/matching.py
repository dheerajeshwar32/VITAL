from fastapi import APIRouter, HTTPException
from backend.models import KidneyMatchReport
from backend.matching_engine import get_kidney_match_report

router = APIRouter(prefix="/matching", tags=["Kidney Matching Engine"])

@router.get("/{organ_id}", response_model=KidneyMatchReport)
def generate_matches(organ_id: int):
    """
    Executes the multi-factor kidney matching engine for a given kidney inventory ID.
    Enforces BR1 (ABO Compatibility), BR3 (Urgency Weighting), BR4 (Viability), and BR2 (Duplicate Offer Guard).
    Returns ranked candidate recipients with detailed scoring points and transparent inclusion/exclusion reasons.
    """
    try:
        report = get_kidney_match_report(organ_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matching engine error: {str(e)}")
