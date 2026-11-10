from backend.agents.base import Agent, answers_block, data_block, intake_block, kb_context
from backend.schemas import CATEGORIES, DraftOut

def _norm(t: str) -> str:
	return " ".join(t.lower().split())

class RequirementAgent(Agent):
	name = "requirement"
	output = DraftOut

	def build_user(self, s) -> str:
		i = s["intake"]
		hits = self.search(
			i.description, families=["regulation", "standard", "terminology"],
			project_type=i.project_type, k=5,
		)
		return "\n\n".join([
			intake_block(i),
			answers_block(s.get("answers", [])),
			data_block("KB", kb_context(hits)),
			f"ALLOWED_CATEGORIES: {', '.join(CATEGORIES)}",
		])

	def run(self, s):
		reqs = super().run(s).requirements
		src = _norm(s["intake"].description + " " + " ".join(a.get("answer") or "" for a in s.get("answers", [])))
		for r in reqs:
			r.flags = []
			q = _norm(r.source_quote)
			if not q or q not in src:
				r.flags.append("quote_not_found")
		return reqs
