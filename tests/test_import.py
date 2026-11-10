import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import config, export, main
from backend.orchestrator import Orchestrator
from tests.test_api import err
from tests.test_orchestrator import flow, make

client = TestClient(main.app)
SDLC = json.dumps({"summary": "s", "top": [], "why_not": []})


def orch(known=("r156-x",)):
    o, fake = make(sdlc=SDLC)
    o.sdlc_agent.get_card = lambda cid: cid in known or None
    return o


def finished():
    o = orch()
    pid = flow(o)
    o.draft(pid)
    for seq, act in ((1, "accept"), (2, "reject"), (3, "accept")):
        o.patch_requirement(pid, seq, act)
    o.sdlc(pid)
    return o, pid


def as_file(o, pid):
    return export.to_json(export.build_report(o.view(pid)))


def post(raw, o):
    main.orch = o
    return client.post("/api/projects/import", content=raw)


@pytest.fixture(autouse=True)
def restore_orch():
    old = main.orch
    yield
    main.orch = old


def test_roundtrip():
    o, pid = finished()
    raw = as_file(o, pid)
    r = post(raw, orch())
    assert r.status_code == 201
    v, a = r.json(), o.view(pid)
    assert v["id"] != pid and v["status"] == "done" and v["name"] == a["name"]
    assert [(x["seq"], x["status"], x["statement"]) for x in v["requirements"]] == \
           [(x["seq"], x["status"], x["statement"]) for x in a["requirements"]]
    assert [c["card_id"] for c in v["requirements"][0]["citations"]] == ["r156-x"]
    assert v["sdlc"]["ranking"] == a["sdlc"]["ranking"]
    assert [(q["text"], q["why"], q["topic"]) for q in v["questions"]] == \
           [(q["text"], q["why"], q["topic"]) for q in a["questions"]]
    assert any("not recomputed" in n for n in v["import_notes"])
    assert as_file(orch(), v["id"]) is not None  # still exportable


def test_unknown_citation_dropped_and_flagged():
    o, pid = finished()
    v = post(as_file(o, pid), orch(known=())).json()
    r1 = v["requirements"][0]
    assert r1["citations"] == [] and any(f["code"] == "unsupported" for f in r1["quality_flags"])
    assert any("citation" in n for n in v["import_notes"])


def test_done_without_sdlc_falls_back_to_review():
    o, pid = finished()
    d = json.loads(as_file(o, pid))
    d["sdlc"] = None
    assert post(json.dumps(d), orch()).json()["status"] == "review"


@pytest.mark.parametrize("mutate", [
    lambda d: d.update(schema_version=2),
    lambda d: d["project"].update(project_type="boat"),
    lambda d: d["requirements"][0].update(categories=[]),
    lambda d: d["requirements"][0].update(statement="short"),
    lambda d: d["project"].update(traits={"safety_level": "extreme"}),
])
def test_invalid_file_is_422(mutate):
    o, pid = finished()
    d = json.loads(as_file(o, pid))
    mutate(d)
    err(post(json.dumps(d), orch()), 422, "invalid_file")


def test_garbage_and_oversize():
    err(post("not json", orch()), 422, "invalid_file")
    err(post(b"x" * 1_000_001, orch()), 413, "file_too_large")


def test_json_export_is_named_as_project_file():
    o, pid = finished()
    main.orch = o
    r = client.get(f"/api/projects/{pid}/export?format=json")
    assert r.headers["content-disposition"].endswith('.atlas.json"')


def test_duplicate_seq_rejected():
    o, pid = finished()
    d = json.loads(as_file(o, pid))
    d["requirements"][1]["seq"] = d["requirements"][0]["seq"]
    err(post(json.dumps(d), orch()), 422, "invalid_input")


def test_client_ip_uses_trusted_hop_only(monkeypatch):
    class Req:
        client = type("C", (), {"host": "10.0.0.1"})()
        headers = {"x-forwarded-for": "6.6.6.6, 1.2.3.4"}  # left entry is spoofable

    monkeypatch.setattr(config, "TRUST_PROXY_HOPS", 0)
    assert main._client_ip(Req) == "10.0.0.1"
    monkeypatch.setattr(config, "TRUST_PROXY_HOPS", 1)
    assert main._client_ip(Req) == "1.2.3.4"
    monkeypatch.setattr(config, "TRUST_PROXY_HOPS", 3)  # fewer hops than expected: fall back to socket
    assert main._client_ip(Req) == "10.0.0.1"


def test_frontend_mount(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "a.js").write_text("x")
    (tmp_path / "index.html").write_text("<html>shell</html>")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    app = FastAPI()
    main.mount_frontend(app, tmp_path)
    c = TestClient(app, follow_redirects=False)
    assert c.get("/").status_code in (302, 307) and c.get("/").headers["location"] == "/app"
    assert "shell" in c.get("/app").text and "shell" in c.get("/app/p/abc123").text
    assert c.get("/assets/a.js").text == "x" and c.get("/favicon.svg").status_code == 200
    assert c.get("/..%2Fsecret").status_code == 404 and c.get("/nope").status_code == 404
