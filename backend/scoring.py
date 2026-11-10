import json
from functools import lru_cache
from pathlib import Path

LEVELS = ("low", "medium", "high")
MATRIX = Path(__file__).parent / "data" / "fit_matrix.json"
TRAIT_TO_FACTOR = {
    "safety_level": "safety_criticality", "requirement_stability": "requirement_stability",
    "hardware_dependency": "hardware_dependency", "regulatory_audit": "regulatory_audit",
    "ota_frequency": "ota_frequency", "connectivity": "cyber_exposure",
    "team_size": "team_size", "timeline_pressure": "timeline_pressure",
}
CLARIFIED = ("stakeholder_availability", "supplier_complexity")
TIE = 2.0
ORDER_SAFE = ("plan", "hybrid", "agile", "adhoc")
ORDER_FAST = ("agile", "hybrid", "plan", "adhoc")
CONFLICT_RULES = [
    ("hardware_dependency", "low", "interface-integration", 3, "medium"),
    ("safety_criticality", "low", "functional-safety", 2, "medium"),
    ("ota_frequency", "low", "software-update", 3, "medium"),
]


@lru_cache
def load_matrix():
    return json.loads(MATRIX.read_text(encoding="utf-8"))


def _norm(v):
    v = (v or "").strip().lower()
    return v if v in LEVELS else "not sure"


def build_factors(traits, extra, reqs):
    def n(cat):
        return sum(cat in r["categories"] for r in reqs)

    by = {TRAIT_TO_FACTOR[t]: _norm(v) for t, v in traits.items() if t in TRAIT_TO_FACTOR}
    out = []
    for f in load_matrix()["factors"]:
        fid, note = f["id"], ""
        if fid in CLARIFIED:
            level = _norm(extra.get(fid))
            tag = "user-stated" if level != "not sure" else "not sure"
        elif fid == "cyber_exposure":
            base, c = by.get(fid, "not sure"), n("cybersecurity")
            raised = "high" if c >= 4 else "medium" if c >= 2 else None
            if base in LEVELS and not (raised and LEVELS.index(raised) > LEVELS.index(base)):
                level, tag = base, "user-stated"
            elif raised:
                level, tag = raised, "inferred"
                note = f"{c} cybersecurity requirements" + (f" (stated: {base})" if base in LEVELS else "")
            else:
                level, tag = "not sure", "not sure"
        else:
            level = by.get(fid, "not sure")
            tag = "user-stated" if level != "not sure" else "not sure"
        conflict = None
        for cfac, lv, cat, minimum, suggestion in CONFLICT_RULES:
            if fid == cfac and level == lv and tag == "user-stated" and n(cat) >= minimum:
                conflict = {"suggested": suggestion, "reason": f"{n(cat)} accepted requirements are {cat}"}
        out.append({"factor": fid, "label": f["label"], "level": level, "tag": tag,
                    "note": note, "conflict": conflict})
    return out


def rank(levels, matrix=None):
    m = matrix or load_matrix()
    factors, total = m["factors"], sum(f["weight"] for f in m["factors"])
    rows = []
    for model, details in m["models"].items():
        fits, numerator = {}, 0.0
        for factor, triple in zip(factors, details["fit"]):
            level = levels.get(factor["id"], "not sure")
            value = triple[LEVELS.index(level)] if level in LEVELS else sum(triple) / 3
            fits[factor["id"]] = round(value, 3)
            numerator += factor["weight"] * value
        rows.append({"model": model, "name": details["name"], "family": details["family"],
                     "card": details["card"], "score": round(100 * numerator / total, 1), "fits": fits})
    order = ORDER_SAFE if levels.get("safety_criticality") == "high" else ORDER_FAST
    rows.sort(key=lambda row: (-row["score"], row["model"]))
    result = []
    while rows:
        bucket = [row for row in rows if row["score"] >= rows[0]["score"] - TIE]
        bucket.sort(key=lambda row: (order.index(row["family"]), row["model"]))
        result += bucket
        rows = rows[len(bucket):]
    for index, row in enumerate(result, 1):
        row["rank"] = index
    return result


def confidence(ranking, factors):
    margin = max(0.0, round(ranking[0]["score"] - ranking[1]["score"], 1))
    label = "clear lead" if margin >= 5 else "moderate lead" if margin >= 2 else "close call"
    stated = sum(f["tag"] == "user-stated" for f in factors)
    return {"margin": margin, "label": label, "user_stated": stated, "total": len(factors),
            "text": f"{label.capitalize()}: #1 leads #2 by {margin} points; "
                    f"{stated} of {len(factors)} factors were stated by you."}


def _notes(entry, factors, count, strong):
    known = [f for f in factors if f["level"] != "not sure"]
    known = sorted(known, key=lambda f: entry["fits"][f["factor"]] * (-1 if strong else 1))[:count]
    return "; ".join(f"{f['label']} ({f['level']}) fit {entry['fits'][f['factor']]:.1f}" for f in known)


def strong_text(entry, factors, n=2):
    notes = _notes(entry, factors, n, True)
    return f"Strongest fit on: {notes}." if notes else "No stated factors to compare; score uses average fit."


def weak_text(entry, factors, n=2):
    notes = _notes(entry, factors, n, False)
    return f"Weakest fit on: {notes}." if notes else "No stated factors to compare; score uses average fit."
