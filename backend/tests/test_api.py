import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_database

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_database()

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "database" in data
    assert data["database"]["counts"]["available_kidneys"] > 0

def test_hospitals():
    response = client.get("/api/hospitals")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    assert any(h["name"].startswith("Apollo") for h in data)

def test_donors():
    response = client.get("/api/donors")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5

def test_recipients():
    response = client.get("/api/recipients")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    # Urgency must be between 1 and 5
    for r in data:
        assert 1 <= r["urgency"] <= 5

def test_organs_strict_kidney():
    response = client.get("/api/organs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    for o in data:
        assert o["organ_type"] == "KIDNEY"

def test_matching_engine():
    response = client.get("/api/matching/401")
    assert response.status_code == 200
    data = response.json()
    assert data["organ_id"] == 401
    assert len(data["ranked_candidates"]) > 0
    # Top ranked candidate should be eligible and have positive score
    top = data["ranked_candidates"][0]
    assert top["is_eligible"] is True
    assert top["total_match_score"] > 0

def test_allocations():
    response = client.get("/api/allocations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

def test_reviews_review1():
    response = client.get("/api/reviews/review1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    for item in data:
        assert "columns" in item
        assert "rows" in item
        assert len(item["rows"]) > 0

def test_reviews_review2():
    response = client.get("/api/reviews/review2")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4

def test_acid_test_suite():
    response = client.get("/api/acid/run")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    for t in data:
        assert t["outcome"] == "PASSED"

def test_reports_summary():
    response = client.get("/api/reports/summary")
    assert response.status_code == 200
    data = response.json()
    assert "kpi" in data
    assert data["kpi"]["total_donors"] > 0
    assert data["kpi"]["available_kidneys"] > 0
