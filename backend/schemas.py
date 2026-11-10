from typing import Literal, get_args

import re

from pydantic import BaseModel, Field, field_validator, model_validator

ProjectType = Literal["adas", "infotainment", "ota", "bms", "telematics", "diagnostics", "other"]
Category = Literal[
	"functional", "functional-safety", "cybersecurity", "software-update", "performance",
	"reliability-availability", "usability-hmi", "data-privacy", "interface-integration",
	"regulatory-compliance", "process-quality", "operations-maintenance",
]
CATEGORIES = list(get_args(Category))
TRAITS = [
	"safety_level", "requirement_stability", "hardware_dependency", "regulatory_audit",
	"ota_frequency", "connectivity", "team_size", "timeline_pressure",
]
TRAIT_VALUES = ("low", "medium", "high", "not sure")

class Intake(BaseModel):
	name: str = Field(min_length=1, max_length=80)
	project_type: ProjectType
	description: str = Field(min_length=40, max_length=4000)
	traits: dict[str, str] = {}

	@field_validator("traits")
	@classmethod
	def known_traits(cls, v):
		bad = set(v) - set(TRAITS)
		if bad:
			raise ValueError(f"unknown traits {sorted(bad)}")
		v = {k: x.strip().lower() for k, x in v.items()}
		if any(x not in TRAIT_VALUES for x in v.values()):
			raise ValueError("trait values must be low, medium, high or not sure")
		return v

class Question(BaseModel):
	text: str
	why: str
	topic: str

class ClarifyOut(BaseModel):
	questions: list[Question]

class Candidate(BaseModel):
	statement: str
	categories: list[Category] = Field(min_length=1)
	priority: Literal["Must", "Should", "Could", "Won't"]
	acceptance_criteria: str
	source_quote: str
	flags: list[str] = []

class DraftOut(BaseModel):
	requirements: list[Candidate] = Field(min_length=1)

class AnswerIn(BaseModel):
	id: int
	answer: str | None = None

class AnswersIn(BaseModel):
	answers: list[AnswerIn] = []
	more: bool = False

class ReqPatch(BaseModel):
	action: Literal["accept", "reject", "edit"]
	statement: str | None = Field(None, min_length=10, max_length=600)
	priority: Literal["Must", "Should", "Could", "Won't"] | None = None
	acceptance_criteria: str | None = Field(None, max_length=600)
	categories: list[Category] | None = Field(None, min_length=1)


# --- project file (export JSON re-imported) ---
class FileQuestion(BaseModel):
	round: int = Field(1, ge=1, le=2)
	text: str = Field(max_length=500)
	why: str | None = Field(None, max_length=500)
	topic: str = Field("other", max_length=60)
	answer: str | None = Field(None, max_length=2000)
	skipped: bool = False

class FileReq(BaseModel):
	seq: int = Field(ge=1, le=999)
	statement: str = Field(min_length=10, max_length=600)
	categories: list[Category] = Field(min_length=1)
	priority: Literal["Must", "Should", "Could", "Won't"]
	acceptance_criteria: str | None = Field(None, max_length=600)
	citations: list[dict] = Field([], max_length=10)
	confidence: float = Field(0, ge=0, le=1)
	status: Literal["proposed", "accepted", "edited", "rejected"]
	source_quote: str | None = Field(None, max_length=600)
	quality_flags: list[dict] = Field([], max_length=20)
	original_statement: str | None = Field(None, max_length=600)

	@model_validator(mode="before")
	@classmethod
	def seq_from_id(cls, v):
		if isinstance(v, dict) and "seq" not in v:
			m = re.fullmatch(r"REQ-(\d{1,3})", str(v.get("id", "")))
			if m:
				v = {**v, "seq": int(m.group(1))}
		return v

class FileSdlc(BaseModel):
	factors: list[dict] = Field(max_length=20)
	ranking: list[dict] = Field(max_length=40)
	rationale: dict
	stale: bool = False

class FileProject(Intake):
	status: Literal["intake", "clarifying", "drafting", "review", "done"] = "intake"
	created_at: str | None = Field(None, max_length=30)

class ProjectFile(BaseModel):
	schema_version: Literal[1]
	project: FileProject
	generated_with: dict = {}
	questions: list[FileQuestion] = Field([], max_length=40)
	requirements: list[FileReq] = Field([], max_length=100)
	rejected: list[FileReq] = Field([], max_length=100)
	sdlc: FileSdlc | None = None
