import json

import pytest
from fastapi.testclient import TestClient

from backend import config, main
from backend.schemas import Intake
from tests.test_orchestrator import INTAKE, make

client = TestClient(main.app)


@pytest.fixture
def api(monkeypatch):
    o, _ = make(sdlc=json.dumps({"summary": "s", "top": [], "why_not": []}))
    monkeypatch.setattr(main, "orch", o)
    return client


def err(r, status, code):
    assert r.status_code == status and r.json()["error"]["code"] == code


def test_full_flow(api):
    r = api.post("/api/projects", json=INTAKE.model_dump())
    assert r.status_code == 201
    pid = r.json()["id"]
    base = f"/api/projects/{pid}"
    value = api.post(f"{base}/clarify").json()
    assert value["status"] == "clarifying"
    answers = {"answers": [{"id": value["questions"][0]["id"], "answer": "yes"}]}
    assert api.post(f"{base}/answers", json=answers).json()["status"] == "drafting"
    assert api.post(f"{base}/draft").json()["status"] == "review"
    assert api.patch(f"{base}/requirements/1", json={"action": "accept"}).status_code == 200
    edit = {"action": "edit", "statement": "The client shall start within 2 s."}
    assert api.patch(f"{base}/requirements/4", json=edit).json()["requirements"][3]["status"] == "edited"
    assert api.post(f"{base}/sdlc").json()["status"] == "done"
    assert [p["id"] for p in api.get("/api/projects").json()] == [pid]
    markdown = api.get(f"{base}/export?format=md")
    assert markdown.status_code == 200 and "REQ-001" in markdown.text
    assert "attachment" in markdown.headers["content-disposition"]
    report = api.get(f"{base}/export?format=json").json()
    assert report["generated_with"]["kb_version"] == "v1" and len(report["sdlc"]["ranking"]) == 22
    assert len(report["requirements"]) + len(report["rejected"]) == 4


def test_errors(api):
    err(api.get("/api/projects/nope"), 404, "not_found")
    pid = api.post("/api/projects", json=INTAKE.model_dump()).json()["id"]
    err(api.post(f"/api/projects/{pid}/draft"), 409, "wrong_stage")
    err(api.post("/api/projects", json={"name": "x", "project_type": "ota", "description": "short"}), 422, "invalid_input")
    err(api.get(f"/api/projects/{pid}/export?format=pdf"), 422, "invalid_input")
    err(api.patch(f"/api/projects/{pid}/requirements/1", json={"action": "nuke"}), 422, "invalid_input")


def test_llm_failure_is_502_and_state_unchanged(monkeypatch):
    o, _ = make(clarification="junk")
    monkeypatch.setattr(main, "orch", o)
    pid = client.post("/api/projects", json=INTAKE.model_dump()).json()["id"]
    response = client.post(f"/api/projects/{pid}/clarify")
    err(response, 502, "llm_error")
    assert response.json()["error"]["retryable"] is True
    assert client.get(f"/api/projects/{pid}").json()["status"] == "intake"


def test_samples_and_meta(api):
    samples = api.get("/api/samples").json()
    assert len(samples) >= 6
    for sample in samples:
        Intake(**{k: sample[k] for k in ("name", "project_type", "description", "traits")})
    response = api.post(f"/api/samples/{samples[0]['id']}/load")
    assert response.status_code == 201 and response.json()["status"] == "intake"
    err(api.post("/api/samples/nope/load"), 404, "not_found")
    meta = api.get("/api/meta").json()
    assert len(meta["traits"]) == 8 and len(meta["clarified"]) == 2 and "adas" in meta["project_types"]


def test_rate_limit(monkeypatch):
    monkeypatch.setattr(config, "RATE_LIMIT_PER_MIN", 2)
    main._hits.clear()
    assert [client.get("/api/llm/status").status_code for _ in range(3)] == [200, 200, 429]
    assert client.get("/api/health").status_code == 200
    main._hits.clear()


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_error_shape():
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert set(r.json()["error"]) == {"code", "message", "retryable"}


def test_delete_project(api):
    pid = api.post("/api/projects", json=INTAKE.model_dump()).json()["id"]
    api.post(f"/api/projects/{pid}/clarify")
    assert api.delete(f"/api/projects/{pid}").status_code == 204
    err(api.get(f"/api/projects/{pid}"), 404, "not_found")
    err(api.delete(f"/api/projects/{pid}"), 404, "not_found")
    assert api.get("/api/projects").json() == []
