import asyncio
import concurrent.futures as cf

from backend import config, db, llm, scoring
from backend.agents.clarification import ClarificationAgent
from backend.agents.compliance import ComplianceAgent
from backend.agents.quality import SIMPLE, QualityAgent, band, confidence, flag, simple_flags, unsupported_flag
from backend.agents.requirement import RequirementAgent
from backend.agents.sdlc import SdlcAgent
from backend.llm import LLMError
from backend.schemas import Intake

MAX_ROUNDS = 2


class StageError(Exception):
    pass


class NotFound(Exception):
    pass


class BadInput(Exception):
    pass


def _kb_version():
    from backend.kb.search import get_kb

    return get_kb().version


def _run_all(tasks):
    """Run zero-argument callables in parallel, preserving result order."""
    if config.CONCURRENCY == "asyncio":
        async def go():
            sem = asyncio.Semaphore(config.WORKERS)

            async def one(task):
                async with sem:
                    return await asyncio.to_thread(task)

            return await asyncio.gather(*(one(task) for task in tasks))

        return list(asyncio.run(go()))
    with cf.ThreadPoolExecutor(config.WORKERS) as ex:
        return [future.result() for future in [ex.submit(task) for task in tasks]]


class Orchestrator:
    """Stage runner + status machine. LLM calls happen BEFORE db writes, so a failure leaves state unchanged."""

    def __init__(self, chat=None, search=None, embed=None, kb_version=_kb_version, get_card=None):
        self.clar = ClarificationAgent(chat=chat, search=search)
        self.req = RequirementAgent(chat=chat, search=search)
        self.comp = ComplianceAgent(chat=chat, search=search)
        self.qual = QualityAgent(chat=chat, search=search, embed=embed)
        self.sdlc_agent = SdlcAgent(chat=chat, search=search, get_card=get_card)
        self.kb_version = kb_version

    def _get(self, pid, *allowed):
        p = db.get_project(pid)
        if not p:
            raise NotFound(pid)
        if allowed and p["status"] not in allowed:
            raise StageError(f"project is '{p['status']}', needs {' or '.join(allowed)}")
        return p

    @staticmethod
    def _intake(p):
        return Intake(name=p["name"], project_type=p["project_type"],
                      description=p["description"], traits=p["traits"])

    @staticmethod
    def _answered(qs):
        return [q for q in qs if q["answer"] or q["skipped"]]

    def view(self, pid):
        p = self._get(pid)
        p["questions"] = db.get_questions(pid)
        reqs = db.get_requirements(pid)
        for r in reqs:
            r["id"] = f"REQ-{r['seq']:03d}"
            r["confidence_band"] = band(r["confidence"])
        p["requirements"] = reqs
        p["sdlc"] = db.latest_sdlc_run(pid)
        if p["sdlc"] and len(p["sdlc"]["ranking"]) >= 2:
            p["sdlc"]["confidence"] = scoring.confidence(p["sdlc"]["ranking"], p["sdlc"]["factors"])
        return p

    def create(self, intake):
        return db.create_project(intake, llm.status()["provider"])

    def import_project(self, f):
        """Rebuild a project from an exported JSON file. The file is untrusted: validated by Pydantic,
        citations re-checked against the current KB, new id always, status made consistent."""
        get_card = self.sdlc_agent.get_card  # injected in tests, KB lookup otherwise
        notes, reqs, dropped = [], [], 0
        for r in sorted(f.requirements + f.rejected, key=lambda x: x.seq):
            d = r.model_dump()
            kept = [c for c in d["citations"] if isinstance(c.get("card_id"), str) and get_card(c["card_id"])]
            dropped += len(d["citations"]) - len(kept)
            d["citations"] = kept
            if not any(x.get("code") == "unsupported" for x in d["quality_flags"]):
                d["quality_flags"] += unsupported_flag(d)
            reqs.append(d)
        if len({r["seq"] for r in reqs}) != len(reqs):
            raise BadInput("duplicate requirement numbers in file")
        if dropped:
            notes.append(f"{dropped} citation(s) removed: card not in this server's knowledge base.")
        p = f.project.model_dump()
        sdlc = f.sdlc.model_dump() if f.sdlc else None
        if p["status"] == "done" and not sdlc:
            p["status"] = "review"
        if p["status"] in ("review", "done") and not reqs:
            p["status"] = "drafting"
        if sdlc:
            notes.append("SDLC result restored from the file, not recomputed.")
        old, now = f.generated_with.get("kb_version"), self.kb_version()
        if old and old != now:
            notes.append("Knowledge base version differs from the one used when this file was saved.")
        qs = [{**q.model_dump(), "why": q.why or ""} for q in f.questions]
        pid = db.import_project(p, f.generated_with.get("provider") or "imported", old, qs, reqs, sdlc)
        v = self.view(pid)
        v["import_notes"] = notes
        return v

    def clarify(self, pid):
        p = self._get(pid, "intake")
        qs = self.clar.run({"intake": self._intake(p), "answers": [], "round": 1})
        db.add_questions(pid, 1, qs)
        db.set_status(pid, "clarifying" if qs else "drafting")
        return self.view(pid)

    def answer(self, pid, answers, more=False):
        p = self._get(pid, "clarifying")
        qs = db.get_questions(pid)
        if any(a.get("id") not in {q["id"] for q in qs} for a in answers):
            raise BadInput("unknown question id")
        rnd = max(q["round"] for q in qs)
        given = {a["id"]: a for a in answers}
        final = []
        for q in qs:
            if q["id"] not in given and q["round"] != rnd:
                continue
            text = ((given.get(q["id"]) or {}).get("answer") or "").strip()
            final.append({"id": q["id"], "answer": text or None, "skipped": not text})
        done = {f["id"]: f for f in final}
        known = self._answered([{**q, **done.get(q["id"], {})} for q in qs])
        new = []
        if more and rnd < MAX_ROUNDS:
            new = self.clar.run({"intake": self._intake(p), "answers": known, "round": rnd + 1})
        db.save_answers(pid, final)
        if new:
            db.add_questions(pid, rnd + 1, new)
        db.set_status(pid, "clarifying" if new else "drafting")
        return self.view(pid)

    def _comply(self, intake, r):
        try:
            cites, top = self.comp.run({"intake": intake, "requirement": r})
            return cites, top, False
        except LLMError:
            return [], 0.0, True

    def draft(self, pid):
        p = self._get(pid, "drafting")
        intake = self._intake(p)
        cands = self.req.run({"intake": intake, "answers": self._answered(db.get_questions(pid))})
        reqs = [{
            "seq": n, "statement": c.statement, "original_statement": None,
            "categories": list(c.categories), "priority": c.priority,
            "acceptance_criteria": c.acceptance_criteria, "source_quote": c.source_quote,
            "citations": [], "confidence": 0.0, "status": "proposed",
            "quality_flags": [flag(f) for f in c.flags],
        } for n, c in enumerate(cands, 1)]
        tasks = [lambda: self.qual.run({"requirements": reqs})] + [
            (lambda r=r: self._comply(intake, r)) for r in reqs
        ]
        qflags, *results = _run_all(tasks)
        for r, (cites, top, failed) in zip(reqs, results):
            r["citations"] = cites
            r["quality_flags"] += qflags[r["seq"]]
            if failed:
                r["quality_flags"].append(flag("compliance_failed"))
            r["quality_flags"] += unsupported_flag(r)
            quote_ok = all(f["code"] != "quote_not_found" for f in r["quality_flags"])
            r["confidence"] = confidence(top, len(cites), quote_ok)
        db.replace_requirements(pid, reqs)
        db.set_status(pid, "review", kb_version=self.kb_version())
        return self.view(pid)

    def patch_requirement(self, pid, seq, action, **edit):
        p = self._get(pid, "review", "done")
        r = next((x for x in db.get_requirements(pid) if x["seq"] == seq), None)
        if not r:
            raise NotFound(f"REQ {seq}")
        if action == "accept":
            f = {"status": "accepted"}
        elif action == "reject":
            f = {"status": "rejected"}
        elif action == "edit":
            f = self._edit(r, edit)
        else:
            raise BadInput(f"unknown action '{action}'")
        db.update_requirement(pid, seq, **f)
        if p["status"] == "done":
            db.mark_sdlc_stale(pid)
            db.set_status(pid, "review")
        return self.view(pid)

    @staticmethod
    def _edit(r, e):
        f = {"status": "edited"}
        if e.get("statement"):
            f["statement"] = e["statement"]
            f["original_statement"] = r["original_statement"] or r["statement"]
        for k in ("priority", "acceptance_criteria", "categories"):
            if e.get(k) is not None:
                f[k] = e[k]
        if len(f) == 1:
            raise BadInput("nothing to edit")
        keep = [x for x in r["quality_flags"] if x["code"] not in SIMPLE]
        f["quality_flags"] = keep + simple_flags({**r, **f})
        return f

    def sdlc(self, pid):
        p = self._get(pid, "review")
        reqs = [r for r in db.get_requirements(pid) if r["status"] in ("accepted", "edited")]
        if not reqs:
            raise StageError("accept at least one requirement first")
        extra = {q["topic"]: q["answer"] for q in db.get_questions(pid)
                 if q["topic"] in scoring.CLARIFIED}
        factors = scoring.build_factors(p["traits"], extra, reqs)
        ranking = scoring.rank({f["factor"]: f["level"] for f in factors})
        state = {"factors": factors, "ranking": ranking}
        try:
            rationale = self.sdlc_agent.run(state)
        except LLMError:
            rationale = self.sdlc_agent.fallback(state)
        db.add_sdlc_run(pid, factors, ranking, rationale)
        db.set_status(pid, "done")
        return self.view(pid)
