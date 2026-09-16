import json

import os

import main
from fastapi.testclient import TestClient

API_KEY = os.getenv("API_KEY") or "test-internal-api-key"
client = TestClient(main.app, base_url="http://localhost")
AUTH = {"X-Internal-Api-Key": API_KEY}


class Chunk:
    def __init__(self, document_id, content):
        self.document_id = document_id
        self.content = content


def _in_values(criterion):
    right = getattr(criterion, "right", None)
    if right is None:
        return None
    value = getattr(right, "value", None)
    if value is not None:
        return set(value)
    effective = getattr(right, "effective_value", None)
    if effective is not None:
        return set(effective)
    return None


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows
        self.selected_ids = None
        self._limit = 5

    def filter(self, criterion):
        ids = _in_values(criterion)
        if ids is not None:
            self.selected_ids = ids
        return self

    def order_by(self, *_args, **_kwargs):
        return self

    def limit(self, n):
        self._limit = n
        return self

    def all(self):
        rows = self.rows
        if self.selected_ids is not None:
            rows = [row for row in rows if row.document_id in self.selected_ids]
        return rows[: self._limit]


class FakeSession:
    def __init__(self, rows):
        self.rows = rows

    def query(self, _model):
        return FakeQuery(self.rows)

    def close(self):
        return None


async def fake_embed(_query):
    return [0.1] * 768


async def fake_generate(_prompt):
    yield "grounded "


def test_query_requires_api_key():
    response = client.post("/api/v1/ai/query", json={"query": "hi", "document_ids": ["a"]})
    assert response.status_code == 401


def test_query_rejects_missing_document_ids():
    response = client.post(
        "/api/v1/ai/query",
        headers=AUTH,
        json={"query": "hi"},
    )
    assert response.status_code == 422


def test_query_empty_index_returns_json(monkeypatch):
    monkeypatch.setattr(main.embedding_service, "embed_query", fake_embed)
    monkeypatch.setattr(main, "SessionLocal", lambda: FakeSession([]))

    response = client.post(
        "/api/v1/ai/query",
        headers=AUTH,
        json={"query": "what is the policy?", "document_ids": ["doc-1"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sources"] == []
    assert "uploaded" in body["answer"].lower()


def test_query_filters_chunks_to_requested_document_ids(monkeypatch):
    rows = [
        Chunk("allowed", "The refund window is 30 days."),
        Chunk("secret", "Internal salary band is confidential."),
    ]
    monkeypatch.setattr(main.embedding_service, "embed_query", fake_embed)
    monkeypatch.setattr(main, "SessionLocal", lambda: FakeSession(rows))
    monkeypatch.setattr(main.generative_service, "generate_content", fake_generate)

    response = client.post(
        "/api/v1/ai/query",
        headers=AUTH,
        json={"query": "refund window?", "document_ids": ["allowed"]},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    events = []
    for block in response.text.strip().split("\n\n"):
        if block.startswith("data:"):
            events.append(json.loads(block[5:]))

    sources = next(event for event in events if event["type"] == "sources")
    assert sources["sources"] == ["allowed"]
    assert "secret" not in response.text
    assert any(event.get("type") == "token" and event.get("token") == "grounded " for event in events)
    assert events[-1] == {"type": "end"}
