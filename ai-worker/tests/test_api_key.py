import os

from fastapi.testclient import TestClient

from main import app

client = TestClient(app, base_url="http://localhost")
API_KEY = os.getenv("API_KEY") or "test-internal-api-key"


def test_health_rejects_missing_api_key():
    response = client.get("/api/v1/ai/health")
    assert response.status_code == 401


def test_health_rejects_wrong_api_key():
    response = client.get(
        "/api/v1/ai/health",
        headers={"X-Internal-Api-Key": "wrong"},
    )
    assert response.status_code == 401


def test_health_accepts_configured_api_key():
    response = client.get(
        "/api/v1/ai/health",
        headers={"X-Internal-Api-Key": API_KEY},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
