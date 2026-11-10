from pydantic import BaseModel

from backend.agents.base import Agent, data_block
from backend.scoring import strong_text, weak_text

WHY_NOT_LLM = 10


class Note(BaseModel):
    model: str
    text: str = ""
    cards: list[str] = []


class SdlcOut(BaseModel):
    summary: str = ""
    top: list[Note] = []
    why_not: list[Note] = []


def _default_get_card(card_id):
    from backend.kb.search import get_card

    return get_card(card_id)


class SdlcAgent(Agent):
    name = "sdlc"
    output = SdlcOut

    def __init__(self, chat=None, search=None, get_card=None):
        super().__init__(chat, search)
        self.get_card = get_card or _default_get_card

    def _cards(self, s):
        cards = {}
        for row in s["ranking"][:WHY_NOT_LLM]:
            card = self.get_card(row["card"])
            if card:
                cards[card.id] = f"{card.title}: {card.body}"
        stated = [f["label"] for f in s["factors"] if f["level"] != "not sure"]
        if stated:
            for hit in self.search("; ".join(stated), families=["factor"], k=4):
                cards[hit.card_id] = hit.text
        return cards

    def build_user(self, s):
        factors = "\n".join(f"{x['label']}: {x['level']} ({x['tag']})" for x in s["factors"])
        ranking = "\n".join(f"{x['rank']}. {x['model']} ({x['name']})" for x in s["ranking"][:WHY_NOT_LLM])
        cards = "\n".join(f"[{cid}] {text}" for cid, text in s["cards"].items()) or "none"
        return "\n\n".join([data_block("FACTORS", factors), data_block("RANKING", ranking), data_block("KB", cards)])

    def assemble(self, s, out, allowed):
        ranking, factors = s["ranking"], s["factors"]
        notes = {note.model: note for note in (out.top + out.why_not)} if out else {}

        def one(row, rule):
            note = notes.get(row["model"])
            if note and note.text.strip():
                return {"model": row["model"], "name": row["name"], "text": note.text.strip(),
                        "cards": [card for card in note.cards if card in allowed], "source": "llm"}
            own = [row["card"]] if self.get_card(row["card"]) else []
            return {"model": row["model"], "name": row["name"], "text": rule(row, factors),
                    "cards": own, "source": "rule"}

        return {
            "summary": (out.summary.strip() if out and out.summary.strip()
                        else "Explanation unavailable. Showing rule-based notes from the fit matrix."),
            "top": [one(row, strong_text) for row in ranking[:3]],
            "why_not": [one(row, weak_text) for row in ranking[3:]],
        }

    def run(self, s):
        cards = self._cards(s)
        out = super().run({**s, "cards": cards})
        return self.assemble(s, out, set(cards))

    def fallback(self, s):
        return self.assemble(s, None, set())
