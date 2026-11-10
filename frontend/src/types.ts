// Mirrors backend/schemas.py and Orchestrator.view(). Keep in sync by hand.
export type ProjectType = "adas" | "infotainment" | "ota" | "bms" | "telematics" | "diagnostics" | "other";
export type Category =
  | "functional" | "functional-safety" | "cybersecurity" | "software-update" | "performance"
  | "reliability-availability" | "usability-hmi" | "data-privacy" | "interface-integration"
  | "regulatory-compliance" | "process-quality" | "operations-maintenance";
export type Level = "low" | "medium" | "high" | "not sure";
export type Priority = "Must" | "Should" | "Could" | "Won't";
export type Status = "intake" | "clarifying" | "drafting" | "review" | "done";
export type ReqStatus = "proposed" | "accepted" | "edited" | "rejected";

export interface Intake {
  name: string;
  project_type: ProjectType;
  description: string;
  traits: Record<string, Level>;
}
export interface Sample extends Intake {
  id: string;
}

export interface Question {
  id: number;
  round: number;
  text: string;
  why: string;
  topic: string;
  answer: string | null;
  skipped: boolean;
}

export interface Citation {
  card_id: string;
  source: string;
  clause: string;
  basis: "primary-text" | "secondary-summary";
  reason: string;
}
export interface Flag {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
}
export interface Requirement {
  seq: number;
  id: string; // "REQ-001" display only; PATCH uses seq
  statement: string;
  original_statement: string | null;
  categories: Category[];
  priority: Priority;
  acceptance_criteria: string;
  citations: Citation[];
  confidence: number;
  confidence_band: "High" | "Medium" | "Low";
  status: ReqStatus;
  source_quote: string;
  quality_flags: Flag[];
}

export interface FactorRow {
  factor: string;
  label: string;
  level: Level;
  tag: "user-stated" | "inferred" | "not sure";
  note: string;
  conflict: { suggested: Level; reason: string } | null;
}
export interface RankRow {
  rank: number;
  model: string;
  name: string;
  family: string;
  card: string;
  score: number;
  fits: Record<string, number>;
}
export interface Note {
  model: string;
  name: string;
  text: string;
  cards: string[];
  source: "llm" | "rule";
}
export interface SdlcRun {
  factors: FactorRow[];
  ranking: RankRow[];
  rationale: { summary: string; top: Note[]; why_not: Note[] };
  stale: boolean;
  created_at: string;
  confidence?: { margin: number; label: string; user_stated: number; total: number; text: string };
}

export interface Project {
  id: string;
  name: string;
  project_type: ProjectType;
  description: string;
  traits: Record<string, Level>;
  status: Status;
  llm_provider: string | null;
  kb_version: string | null;
  created_at: string;
  updated_at: string;
  questions: Question[];
  requirements: Requirement[];
  sdlc: SdlcRun | null;
}
export interface ProjectRow {
  id: string;
  name: string;
  project_type: ProjectType;
  status: Status;
  updated_at: string;
}

export interface FactorMeta {
  id: string;
  label: string;
  weight: number;
  levels: Record<"low" | "medium" | "high", string>;
}
export interface Meta {
  project_types: ProjectType[];
  categories: Category[];
  traits: (FactorMeta & { trait: string })[];
  clarified: FactorMeta[];
  matrix_note: string;
}
export interface LlmStatus {
  provider: string;
  model: string;
  fallbacks?: number;
  mode: "hosted" | "local";
  configured: boolean;
}
