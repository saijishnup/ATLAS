import json

import pytest

from backend.agents.clarification import ClarificationAgent
from backend.agents.requirement import RequirementAgent
from backend.llm import LLMError
from backend.schemas import Intake
from tests.fake_llm import FakeLLM

INTAKE = Intake(
	name="OTA",
	project_type="ota",
	description="OTA update client for a telematics unit that downloads signed packages and installs them.",
	traits={"safety_level": "low", "ota_frequency": "not sure"},
)

def nosearch(*a, **k):
	return []

def qs(*topics):
	return json.dumps({"questions": [{"text": f"{t}?", "why": "gap", "topic": t} for t in topics]})

def req(quote):
	return {
		"statement": "The client shall roll back a failed install.",
		"categories": ["software-update"],
		"priority": "Must",
		"acceptance_criteria": "Rollback completes within 60 s.",
		"source_quote": quote,
	}

def test_clarify_drops_known_topics():
	fake = FakeLLM({"clarification": qs("safety_level", "rollback", "signing")})
	out = ClarificationAgent(chat=fake, search=nosearch).run({"intake": INTAKE})
	assert [q.topic for q in out] == ["rollback", "signing"]

def test_clarify_skipped_not_reasked():
	fake = FakeLLM({"clarification": qs("rollback", "signing")})
	answers = [{"text": "rollback?", "topic": "rollback", "answer": None}]
	out = ClarificationAgent(chat=fake, search=nosearch).run({"intake": INTAKE, "answers": answers})
	assert [q.topic for q in out] == ["signing"]

def test_retry_then_ok():
	fake = FakeLLM({"clarification": ["not json", qs("rollback")]})
	out = ClarificationAgent(chat=fake, search=nosearch).run({"intake": INTAKE})
	assert len(out) == 1 and len(fake.calls) == 2
	assert "invalid" in fake.calls[1][2]

def test_two_failures_raise():
	fake = FakeLLM({"clarification": "nope"})
	with pytest.raises(LLMError):
		ClarificationAgent(chat=fake, search=nosearch).run({"intake": INTAKE})

def test_user_text_is_delimited():
	fake = FakeLLM({"clarification": qs("rollback")})
	ClarificationAgent(chat=fake, search=nosearch).run({"intake": INTAKE})
	assert "<<<PROJECT" in fake.calls[0][2]

def test_quote_check():
	body = json.dumps({"requirements": [req("downloads signed packages"), req("made up quote")]})
	fake = FakeLLM({"requirement": body})
	out = RequirementAgent(chat=fake, search=nosearch).run({"intake": INTAKE})
	assert out[0].flags == [] and out[1].flags == ["quote_not_found"]

def test_bad_category_retries():
	bad = {**req("x"), "categories": ["nonsense"]}
	fake = FakeLLM({"requirement": [json.dumps({"requirements": [bad]}), json.dumps({"requirements": [req("x")]})]})
	RequirementAgent(chat=fake, search=nosearch).run({"intake": INTAKE})
	assert len(fake.calls) == 2
