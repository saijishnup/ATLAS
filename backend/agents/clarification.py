from backend.agents.base import Agent, answers_block, data_block, intake_block, kb_context
from backend.schemas import TRAITS, ClarifyOut

EXTRA = ["stakeholder_availability", "supplier_complexity"]

class ClarificationAgent(Agent):
	name = "clarification"
	output = ClarifyOut

	def _known(self, s) -> set[str]:
		traits = s["intake"].traits
		stated = {t for t in TRAITS if traits.get(t, "not sure").lower() != "not sure"}
		return stated | {a["topic"] for a in s.get("answers", [])}  # skipped topics not re-asked

	def build_user(self, s) -> str:
		i, known = s["intake"], self._known(s)
		unknown = [t for t in TRAITS + EXTRA if t not in known]
		hits = self.search(
			f"{i.project_type} {i.description[:200]}",
			families=["terminology", "factor"], project_type=i.project_type, k=4,
		)
		return "\n\n".join([
			intake_block(i),
			answers_block(s.get("answers", [])),
			f"UNKNOWN_FACTORS: {', '.join(unknown) or 'none'}",
			data_block("KB", kb_context(hits)),
			f"ROUND: {s.get('round', 1)}",
		])

	def run(self, s):
		known = self._known(s)
		return [q for q in super().run(s).questions if q.topic not in known][:6]
