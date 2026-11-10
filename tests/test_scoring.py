from backend.scoring import CLARIFIED, TRAIT_TO_FACTOR, build_factors, confidence, load_matrix, rank


def levels(**kw):
    base = {f["id"]: "not sure" for f in load_matrix()["factors"]}
    return {**base, **kw}


ADAS = dict(safety_criticality="high", requirement_stability="medium", hardware_dependency="high",
            regulatory_audit="high", ota_frequency="low", cyber_exposure="medium", team_size="high",
            timeline_pressure="medium", stakeholder_availability="medium", supplier_complexity="high")
OTA = dict(safety_criticality="low", requirement_stability="medium", hardware_dependency="medium",
           regulatory_audit="medium", ota_frequency="high", cyber_exposure="high", team_size="low",
           timeline_pressure="medium", stakeholder_availability="high", supplier_complexity="medium")


def test_matrix_shape():
    m = load_matrix()
    ids = [f["id"] for f in m["factors"]]
    assert len(ids) == 10 and set(ids) == set(TRAIT_TO_FACTOR.values()) | set(CLARIFIED)
    assert len(m["models"]) == 22
    for mid, md in m["models"].items():
        assert md["card"] == f"sdlc-{mid}" and len(md["fit"]) == 10, mid
        assert all(len(t) == 3 and all(0 <= x <= 1 for x in t) for t in md["fit"]), mid


def test_deterministic_and_complete():
    a, b = rank(levels(**ADAS)), rank(levels(**ADAS))
    assert a == b and [r["rank"] for r in a] == list(range(1, 23))


def test_not_sure_is_mean_fit():
    m = load_matrix()
    total = sum(f["weight"] for f in m["factors"])
    expected = 100 * sum(f["weight"] * sum(t) / 3 for f, t in zip(m["factors"], m["models"]["waterfall"]["fit"])) / total
    assert next(r for r in rank(levels()) if r["model"] == "waterfall")["score"] == round(expected, 1)


def test_sanity_profiles():
    adas = rank(levels(**ADAS))
    assert adas[0]["family"] in ("plan", "hybrid")
    assert all(r["family"] != "agile" for r in adas[:3])
    ota = rank(levels(**OTA))
    assert "devsecops" in [r["model"] for r in ota[:3]]
    assert ota[-1]["model"] == "big-bang"


def test_tie_break():
    row = lambda name, fam: {"name": name, "family": fam, "card": "c", "fit": [[0.5, 0.5, 0.5]]}
    m = {"factors": [{"id": "safety_criticality", "label": "S", "weight": 1, "levels": {}}],
         "models": {"zeta": row("Z", "agile"), "alpha": row("A", "plan"), "mid": row("M", "hybrid")}}
    assert [r["model"] for r in rank({"safety_criticality": "high"}, m)] == ["alpha", "mid", "zeta"]
    assert [r["model"] for r in rank({"safety_criticality": "low"}, m)] == ["zeta", "mid", "alpha"]


def test_factors_derived_and_conflicts():
    reqs = [{"categories": ["cybersecurity"]}] * 4 + [{"categories": ["interface-integration"]}] * 3
    f = {x["factor"]: x for x in build_factors({"connectivity": "low", "hardware_dependency": "low"}, {}, reqs)}
    assert f["cyber_exposure"]["level"] == "high" and f["cyber_exposure"]["tag"] == "inferred"
    assert f["hardware_dependency"]["level"] == "low"
    assert f["hardware_dependency"]["conflict"]["suggested"] == "medium"
    assert f["team_size"]["tag"] == "not sure"
    g = {x["factor"]: x for x in build_factors({}, {"stakeholder_availability": " HIGH ", "supplier_complexity": "lots"}, [])}
    assert g["stakeholder_availability"]["level"] == "high" and g["stakeholder_availability"]["tag"] == "user-stated"
    assert g["supplier_complexity"]["tag"] == "not sure"


def test_confidence():
    f = build_factors({"safety_level": "high"}, {}, [])
    c = confidence(rank(levels(safety_criticality="high")), f)
    assert c["total"] == 10 and c["user_stated"] == 1
    assert c["label"] in ("clear lead", "moderate lead", "close call")
