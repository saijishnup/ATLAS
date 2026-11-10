import json

from backend.agents.quality import QualityAgent, band, confidence, simple_flags, unsupported_flag
from tests.fake_llm import FakeLLM


def R(seq, st, ac="Returns error 403 within 2 s", cats=("functional",), cites=()):
    return {"seq": seq, "statement": st, "acceptance_criteria": ac,
            "categories": list(cats), "citations": list(cites)}


def codes(flags):
    return {f["code"] for f in flags}


def test_simple_flags():
    assert simple_flags(R(1, "The client shall reject unsigned packages.")) == []
    assert codes(simple_flags(R(2, "The UI shall be user-friendly.", ac="Looks good"))) == {
        "vague_term", "no_measurable_criteria"}
    assert codes(simple_flags(R(3, "x shall y", cats=()))) == {"no_category"}


def test_unsupported_and_confidence():
    r = R(1, "s", cats=("cybersecurity",))
    assert codes(unsupported_flag(r)) == {"unsupported"}
    assert unsupported_flag({**r, "citations": [{"card_id": "a"}]}) == []
    assert unsupported_flag(R(2, "s")) == []
    assert confidence(0.9, 1, True) == 0.75
    assert (band(0.75), band(0.5), band(0.1)) == ("High", "Medium", "Low")


VEC = {"A": [1, 0], "B": [0.7, 0.714]}


def embed(texts):
    return [VEC[t] for t in texts]


def test_conflicts_only_from_shortlist():
    bad = json.dumps({"conflicts": [{"a": 1, "b": 2, "reason": "clash"}, {"a": 1, "b": 9, "reason": "invented"}]})
    q = QualityAgent(chat=FakeLLM({"quality": bad}), embed=embed)
    f = q.run({"requirements": [R(1, "A"), R(2, "B")]})
    assert codes(f[1]) == {"conflict"} and codes(f[2]) == {"conflict"}
    assert len([x for x in f[1] if x["code"] == "conflict"]) == 1


def test_conflict_llm_failure_is_ignored():
    q = QualityAgent(chat=FakeLLM({"quality": "junk"}), embed=embed)
    f = q.run({"requirements": [R(1, "A"), R(2, "B")]})
    assert f == {1: [], 2: []}
