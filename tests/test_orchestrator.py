import json
from types import SimpleNamespace

import pytest

from backend import db
from backend.llm import LLMError
from backend.orchestrator import BadInput, NotFound, Orchestrator, StageError
from backend.schemas import Intake
from tests.fake_llm import FakeLLM

INTAKE = Intake(
    name="OTA", project_type="ota", traits={"safety_level": "low"},
    description="OTA update client for a telematics unit that downloads signed packages and installs them.",
)


def qs(*topics):
    return json.dumps({"questions": [{"text": f"{t}?", "why": "gap", "topic": t} for t in topics]})


def req(st, cats, ac, quote):
    return {"statement": st, "categories": cats, "priority": "Must",
            "acceptance_criteria": ac, "source_quote": quote}


SIG = "The client shall verify the package signature before installation."
REQS = json.dumps({"requirements": [
    req(SIG, ["software-update", "cybersecurity"], "Unsigned package is rejected and an error is logged.", "downloads signed packages"),
    req("The client shall encrypt stored keys.", ["cybersecurity"], "Keys are stored encrypted.", "made up quote"),
    req(SIG, ["software-update"], "Unsigned package is rejected within 2 s.", "installs them"),
    req("The client shall be fast.", ["performance"], "Feels quick", "telematics unit"),
]})
CITE = json.dumps({"citations": [{"card_id": "r156-x", "reason": "update rules"}, {"card_id": "fake-id", "reason": "?"}]})
VEC = {SIG: [1, 0, 0], "The client shall encrypt stored keys.": [0, 1, 0], "The client shall be fast.": [0, 0, 1]}


def search(query, **kw):
    if "encrypt" in query:
        return []
    return [SimpleNamespace(card_id="r156-x", family="regulation", clause="5.1", text="t",
                            score=0.9, source="UNECE R156", basis="primary-text")]


def make(**resp):
    fake = FakeLLM({"clarification": qs("rollback", "signing", "stakeholder_availability"),
                    "requirement": REQS, "compliance": CITE, **resp})
    return Orchestrator(chat=fake, search=search, embed=lambda ts: [VEC[t] for t in ts],
                        kb_version=lambda: "v1", get_card=lambda cid: None), fake


@pytest.mark.parametrize("mode,workers", [("threads", 4), ("threads", 1), ("asyncio", 4)])
def test_concurrency_modes(monkeypatch, mode, workers):
    from backend import config

    monkeypatch.setattr(config, "CONCURRENCY", mode)
    monkeypatch.setattr(config, "WORKERS", workers)
    o, _ = make()
    v = o.draft(flow(o))
    assert v["status"] == "review" and len(v["requirements"]) == 4


def flow(o):
    pid = o.create(INTAKE)
    o.clarify(pid)
    first = db.get_questions(pid)[0]["id"]
    o.answer(pid, [{"id": first, "answer": "Yes, rollback within 60 s"}])
    return pid


def codes(r):
    return {f["code"] for f in r["quality_flags"]}


def test_full_flow():
    o, _ = make()
    pid = flow(o)
    v = o.view(pid)
    assert v["status"] == "drafting" and [q["skipped"] for q in v["questions"]] == [False, True, True]
    v = o.draft(pid)
    assert v["status"] == "review" and v["kb_version"] == "v1"
    r = {x["seq"]: x for x in v["requirements"]}
    assert len(r) == 4 and r[1]["id"] == "REQ-001"
    assert [c["card_id"] for c in r[1]["citations"]] == ["r156-x"]
    assert r[1]["confidence_band"] == "High"
    assert {"unsupported", "quote_not_found"} <= codes(r[2])
    assert "duplicate" in codes(r[3])
    assert {"vague_term", "no_measurable_criteria"} <= codes(r[4])


def test_round_two():
    o, _ = make(clarification=[qs("rollback", "signing"), qs("data_retention")])
    pid = o.create(INTAKE)
    o.clarify(pid)
    v = o.answer(pid, [], more=True)
    assert v["status"] == "clarifying" and {q["round"] for q in v["questions"]} == {1, 2}
    assert o.answer(pid, [], more=True)["status"] == "drafting"


def test_guards():
    o, _ = make()
    pid = o.create(INTAKE)
    for call in (lambda: o.draft(pid), lambda: o.answer(pid, []), lambda: o.patch_requirement(pid, 1, "accept")):
        with pytest.raises(StageError):
            call()
    o.clarify(pid)
    with pytest.raises(StageError):
        o.clarify(pid)
    with pytest.raises(NotFound):
        o.view("nope")
    with pytest.raises(BadInput):
        o.answer(pid, [{"id": 9999, "answer": "x"}])


def test_llm_failure_keeps_state():
    o, _ = make(requirement="junk")
    pid = flow(o)
    with pytest.raises(LLMError):
        o.draft(pid)
    assert db.get_project(pid)["status"] == "drafting" and db.get_requirements(pid) == []


def test_compliance_failure_degrades():
    o, _ = make(compliance="junk")
    v = o.draft(flow(o))
    assert v["status"] == "review" and "compliance_failed" in codes(v["requirements"][0])


def test_patch_and_stale():
    o, _ = make()
    pid = flow(o)
    o.draft(pid)
    o.patch_requirement(pid, 1, "accept")
    v = o.patch_requirement(pid, 4, "edit", statement="The client shall start within 2 s.",
                            acceptance_criteria="Start time <= 2 s")
    r4 = v["requirements"][3]
    assert r4["status"] == "edited" and r4["original_statement"] == "The client shall be fast."
    assert not ({"vague_term", "no_measurable_criteria"} & codes(r4))
    o.patch_requirement(pid, 2, "reject")
    with pytest.raises(BadInput):
        o.patch_requirement(pid, 3, "edit")
    with pytest.raises(NotFound):
        o.patch_requirement(pid, 99, "accept")
    db.add_sdlc_run(pid, {}, [], {})
    db.set_status(pid, "done")
    v = o.patch_requirement(pid, 3, "accept")
    assert v["status"] == "review" and v["sdlc"]["stale"] is True
