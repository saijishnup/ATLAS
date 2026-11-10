import re
from pathlib import Path

from pydantic import ValidationError

from backend import llm
from backend.llm import LLMError

PROMPTS = Path(__file__).resolve().parent.parent / "prompts"

def data_block(label: str, text: str) -> str:
	return f"<<<{label}\n{text}\n>>>"

def intake_block(i) -> str:
	traits = ", ".join(f"{k}={v}" for k, v in i.traits.items()) or "none"
	return data_block(
		"PROJECT", f"Name: {i.name}\nType: {i.project_type}\nTraits: {traits}\nDescription: {i.description}"
	)

def answers_block(answers) -> str:
	if not answers:
		return data_block("ANSWERS", "none")
	return data_block(
		"ANSWERS", "\n".join(f"Q: {a['text']}\nA: {a.get('answer') or '(skipped)'}" for a in answers)
	)

def kb_context(hits) -> str:
	return "\n".join(f"[{h.card_id}] {h.text}" for h in hits) or "none"

def extract_json(raw: str) -> str:
	raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
	i, j = raw.find("{"), raw.rfind("}")
	if i < 0 or j < i:
		raise ValueError("no JSON object in output")
	return raw[i : j + 1]

def _default_search(*a, **kw):
	from backend.kb.search import search  # lazy: keeps Chroma out of agent tests

	return search(*a, **kw)

class Agent:
	name = ""
	output = None  # pydantic model

	def __init__(self, chat=None, search=None):
		self.chat = chat or llm.chat
		self.search = search or _default_search

	def build_user(self, state) -> str:
		raise NotImplementedError

	def run(self, state):
		system = (PROMPTS / f"{self.name}.txt").read_text(encoding="utf-8")
		user, err = self.build_user(state), ""
		for _ in range(2):  # one retry, per NFR-3
			hint = f"\n\nYour previous output was invalid ({err}). Return valid JSON only." if err else ""
			raw = self.chat(self.name, system, user + hint)
			try:
				return self.output.model_validate_json(extract_json(raw))
			except (ValidationError, ValueError) as e:
				err = str(e)[:300]
		raise LLMError(f"{self.name}: invalid output after retry")
