import re
from functools import lru_cache

import numpy as np
from pydantic import BaseModel

from backend.agents.base import Agent, data_block
from backend.llm import LLMError

VAGUE = ["fast", "quick", "quickly", "easy", "easily", "robust", "user-friendly", "flexible",
         "efficient", "adequate", "appropriate", "as needed", "reasonable", "minimal",
         "seamless", "scalable", "modern", "state-of-the-art", "etc", "and/or"]
VAGUE_RE = re.compile(r"\b(" + "|".join(map(re.escape, VAGUE)) + r")\b", re.I)
OBSERVABLE_RE = re.compile(
    r"\b(logged?|rejected?|displayed?|shown|returns?|stored|blocked|alert(ed)?|error|state|status|signal|acknowledg\w*)\b", re.I
)
REGULATED = {"regulatory-compliance", "functional-safety", "cybersecurity"}
SIMPLE = {"vague_term", "no_measurable_criteria", "no_category"}
DUP = 0.9
CONFLICT_MIN = 0.6
MAX_PAIRS = 8

FLAG_INFO = {
    "vague_term": ("medium", "Statement uses a vague term"),
    "no_measurable_criteria": ("high", "Acceptance criteria has no number, unit or observable state"),
    "no_category": ("medium", "No category assigned"),
    "quote_not_found": ("medium", "Source quote not found in user text"),
    "duplicate": ("medium", "Possible duplicate"),
    "conflict": ("high", "Possible conflict"),
    "unsupported": ("high", "Regulatory, safety or cyber requirement has no KB citation"),
    "compliance_failed": ("medium", "Citation lookup failed; retry or review manually"),
}


def flag(code, detail=""):
    sev, msg = FLAG_INFO[code]
    return {"code": code, "severity": sev, "message": f"{msg}: {detail}" if detail else msg}


def simple_flags(r):
    out = []
    if m := VAGUE_RE.search(r["statement"]):
        out.append(flag("vague_term", m.group(0)))
    ac = r.get("acceptance_criteria") or ""
    if not (re.search(r"\d", ac) or OBSERVABLE_RE.search(ac)):
        out.append(flag("no_measurable_criteria"))
    if not r["categories"]:
        out.append(flag("no_category"))
    return out


def unsupported_flag(r):
    return [flag("unsupported")] if REGULATED & set(r["categories"]) and not r["citations"] else []


def confidence(top_similarity, n_citations, quote_found):
    """Heuristic, disclosed in UI. Not the LLM's self-rating."""
    top = max(0.0, min(1.0, top_similarity))
    return round(0.5 * top + 0.3 * min(n_citations, 3) / 3 + 0.2 * (1 if quote_found else 0), 3)


def band(c):
    return "High" if c >= 0.7 else "Medium" if c >= 0.4 else "Low"


@lru_cache
def _ef():
    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

    return DefaultEmbeddingFunction()


def default_embed(texts):
    return _ef()(texts)


def similar_pairs(vecs):
    a = np.asarray(vecs, dtype=float)
    a = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-12)
    m = a @ a.T
    n = len(m)
    return [(i, j, float(m[i][j])) for i in range(n) for j in range(i + 1, n)]


class Conflict(BaseModel):
    a: int
    b: int
    reason: str = ""


class ConflictOut(BaseModel):
    conflicts: list[Conflict] = []


class QualityAgent(Agent):
    name = "quality"
    output = ConflictOut

    def __init__(self, chat=None, search=None, embed=None):
        super().__init__(chat, search)
        self.embed = embed or default_embed

    def build_user(self, s):
        return data_block(
            "PAIRS",
            "\n\n".join(f"REQ {a['seq']}: {a['statement']}\nREQ {b['seq']}: {b['statement']}" for a, b in s["pairs"]),
        )

    def run(self, s):
        """Returns {seq: [flags]}. Deterministic checks first; LLM only sees shortlisted pairs."""
        reqs = s["requirements"]
        flags = {r["seq"]: simple_flags(r) for r in reqs}
        if len(reqs) < 2:
            return flags
        pairs = similar_pairs(self.embed([r["statement"] for r in reqs]))
        for i, j, sim in pairs:
            if sim >= DUP:
                flags[reqs[j]["seq"]].append(flag("duplicate", f"REQ-{reqs[i]['seq']:03d}"))
        short = sorted((p for p in pairs if CONFLICT_MIN <= p[2] < DUP), key=lambda p: -p[2])[:MAX_PAIRS]
        if not short:
            return flags
        try:
            out = super().run({"pairs": [(reqs[i], reqs[j]) for i, j, _ in short]})
        except LLMError:
            return flags
        valid = {(reqs[i]["seq"], reqs[j]["seq"]) for i, j, _ in short}
        for c in out.conflicts:
            key = tuple(sorted((c.a, c.b)))
            if key in valid:
                for me, other in (key, key[::-1]):
                    flags[me].append(flag("conflict", f"with REQ-{other:03d}: {c.reason}"))
        return flags
