from fastapi import APIRouter
from typing import List
from backend.models import AcidTestResult
from backend.acid_tester import run_acid_test_suite

router = APIRouter(prefix="/acid", tags=["ACID Transaction Verification"])

@router.get("/run", response_model=List[AcidTestResult])
def execute_acid_tests():
    """
    Executes automated tests validating Atomicity, Consistency, Isolation, and Durability.
    Verifies actual database pre-state and post-state for each test.
    """
    return run_acid_test_suite()
