from pydantic import BaseModel

from backend.agents.base import Agent, data_block


class Cite(BaseModel):
    card_id: str
    reason: str = ""


class ComplianceOut(BaseModel):
    citations: list[Cite] = []


class ComplianceAgent(Agent):
    name = "compliance"
    output = ComplianceOut

    def build_user(self, s):
        r = s["requirement"]
        cards = "\n".join(f"[{h.card_id}] ({h.source}) {h.text}" for h in s["hits"])
        return "\n\n".join([
            data_block("REQUIREMENT", f"{r['statement']}\nCategories: {', '.join(r['categories'])}"),
            data_block("KB", cards),
        ])

    def run(self, s):
        """Returns (citations, top_similarity). Only ids that were actually retrieved survive."""
        r, i = s["requirement"], s["intake"]
        hits = self.search(r["statement"], families=["regulation", "standard"],
                           project_type=i.project_type, k=5)
        if not hits:
            return [], 0.0
        by = {h.card_id: h for h in hits}
        out = super().run({**s, "hits": hits})
        cites = []
        for c in out.citations:
            h = by.get(c.card_id)
            if h and all(x["card_id"] != h.card_id for x in cites):
                cites.append({"card_id": h.card_id, "source": h.source, "clause": h.clause,
                              "basis": h.basis, "reason": c.reason})
        cites = cites[:3]
        top = max((by[c["card_id"]].score for c in cites), default=0.0)
        return cites, top
