import json
from types import SimpleNamespace

import pytest

from backend.agents.sdlc import SdlcAgent
from backend.orchestrator import StageError
from backend.scoring import build_factors, rank
from tests.fake_llm import FakeLLM
from tests.test_orchestrator import flow, make


def test_agent_keeps_order_and_filters_cards():
    ranking, factors = rank({}), build_factors({}, {}, [])
    first, second = ranking[0]["model"], ranking[1]["model"]
    out = json.dumps({
        "summary": "s",
        "top": [{"model": second, "text": "B text", "cards": [f"sdlc-{second}", "bogus"]},
                {"model": first, "text": "A text", "cards": []}],
        "why_not": [{"model": ranking[5]["model"], "text": "w", "cards": []}],
    })
    agent = SdlcAgent(chat=FakeLLM({"sdlc": out}), search=lambda *a, **k: [],
                      get_card=lambda cid: SimpleNamespace(id=cid, title=cid, body="b"))
    result = agent.run({"factors": factors, "ranking": ranking})
    assert [n["model"] for n in result["top"]] == [r["model"] for r in ranking[:3]]
    assert result["top"][1]["source"] == "llm" and result["top"][1]["cards"] == [f"sdlc-{second}"]
    assert result["top"][2]["source"] == "rule"
    assert len(result["why_not"]) == 19 and result["why_not"][2]["source"] == "llm"


def test_sdlc_flow_and_guard():
    o, _ = make(sdlc=json.dumps({"summary": "s", "top": [], "why_not": []}))
    pid = flow(o)
    o.draft(pid)
    with pytest.raises(StageError):
        o.sdlc(pid)
    o.patch_requirement(pid, 1, "accept")
    value = o.sdlc(pid)
    assert value["status"] == "done" and len(value["sdlc"]["ranking"]) == 22
    assert value["sdlc"]["rationale"]["top"][0]["model"] == value["sdlc"]["ranking"][0]["model"]
    assert value["sdlc"]["confidence"]["total"] == 10 and value["sdlc"]["stale"] is False
    with pytest.raises(StageError):
        o.sdlc(pid)


def test_sdlc_degrades_without_llm():
    o, _ = make(sdlc="junk")
    pid = flow(o)
    o.draft(pid)
    o.patch_requirement(pid, 1, "accept")
    value = o.sdlc(pid)
    assert value["status"] == "done"
    assert all(note["source"] == "rule" for note in value["sdlc"]["rationale"]["top"])
