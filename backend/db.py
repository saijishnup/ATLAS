import json
import sqlite3
import time
import uuid
from contextlib import contextmanager

from backend import config

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, project_type TEXT NOT NULL,
  description TEXT NOT NULL, traits_json TEXT NOT NULL, status TEXT NOT NULL,
  llm_provider TEXT, kb_version TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  round INTEGER NOT NULL, text TEXT NOT NULL, why TEXT, topic TEXT NOT NULL,
  answer TEXT, skipped INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS requirements (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, statement TEXT NOT NULL, original_statement TEXT,
  categories_json TEXT NOT NULL, priority TEXT NOT NULL, acceptance_criteria TEXT,
  citations_json TEXT NOT NULL DEFAULT '[]', confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed', source_quote TEXT,
  quality_flags_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (project_id, seq));
CREATE TABLE IF NOT EXISTS sdlc_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  factors_json TEXT NOT NULL, ranking_json TEXT NOT NULL, rationale_json TEXT NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0, created_at TEXT);
"""

_REQ_FIELDS = {"statement", "original_statement", "priority", "acceptance_criteria",
               "confidence", "status", "source_quote"}
_REQ_JSON = {"categories", "citations", "quality_flags"}


@contextmanager
def conn():
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# --- projects ---
def create_project(intake, provider):
    pid, now = uuid.uuid4().hex[:12], _now()
    with conn() as c:
        c.execute(
            "INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?)",
            (pid, intake.name, intake.project_type, intake.description,
             json.dumps(intake.traits), "intake", provider, None, now, now),
        )
    return pid


def get_project(pid):
    with conn() as c:
        r = c.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d["traits"] = json.loads(d.pop("traits_json"))
    return d


def delete_project(pid):
    with conn() as c:  # questions, requirements, sdlc_runs go too (ON DELETE CASCADE)
        return c.execute("DELETE FROM projects WHERE id=?", (pid,)).rowcount > 0


def list_projects():
    with conn() as c:
        rows = c.execute(
            "SELECT id, name, project_type, status, updated_at FROM projects ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def set_status(pid, status, kb_version=None):
    with conn() as c:
        c.execute(
            "UPDATE projects SET status=?, kb_version=COALESCE(?, kb_version), updated_at=? WHERE id=?",
            (status, kb_version, _now(), pid),
        )


# --- questions ---
def add_questions(pid, rnd, qs):
    with conn() as c:
        c.executemany(
            "INSERT INTO questions (project_id, round, text, why, topic) VALUES (?,?,?,?,?)",
            [(pid, rnd, q.text, q.why, q.topic) for q in qs],
        )


def get_questions(pid):
    with conn() as c:
        rows = c.execute("SELECT * FROM questions WHERE project_id=? ORDER BY id", (pid,)).fetchall()
    return [{**dict(r), "skipped": bool(r["skipped"])} for r in rows]


def save_answers(pid, answers):  # [{id, answer, skipped}]
    with conn() as c:
        c.executemany(
            "UPDATE questions SET answer=?, skipped=? WHERE id=? AND project_id=?",
            [(a["answer"], int(a["skipped"]), a["id"], pid) for a in answers],
        )


# --- requirements ---
def _req(r):
    d = dict(r)
    for k in _REQ_JSON:
        d[k] = json.loads(d.pop(f"{k}_json"))
    return d


def _insert_reqs(c, pid, reqs):
    c.executemany(
        "INSERT INTO requirements (project_id, seq, statement, original_statement, categories_json,"
        " priority, acceptance_criteria, citations_json, confidence, status, source_quote,"
        " quality_flags_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [(pid, r["seq"], r["statement"], r["original_statement"], json.dumps(r["categories"]),
          r["priority"], r["acceptance_criteria"], json.dumps(r["citations"]), r["confidence"],
          r["status"], r["source_quote"], json.dumps(r["quality_flags"])) for r in reqs],
    )


def replace_requirements(pid, reqs):
    with conn() as c:
        c.execute("DELETE FROM requirements WHERE project_id=?", (pid,))
        _insert_reqs(c, pid, reqs)


def import_project(p, provider, kb_version, questions, reqs, sdlc):
    """One transaction: a half-imported project is never left behind. Always a new id."""
    pid, now = uuid.uuid4().hex[:12], _now()
    with conn() as c:
        c.execute(
            "INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?)",
            (pid, p["name"], p["project_type"], p["description"], json.dumps(p["traits"]),
             p["status"], provider, kb_version, p["created_at"] or now, now),
        )
        c.executemany(
            "INSERT INTO questions (project_id, round, text, why, topic, answer, skipped) VALUES (?,?,?,?,?,?,?)",
            [(pid, q["round"], q["text"], q["why"], q["topic"], q["answer"], int(q["skipped"])) for q in questions],
        )
        _insert_reqs(c, pid, reqs)
        if sdlc:
            c.execute(
                "INSERT INTO sdlc_runs (project_id, factors_json, ranking_json, rationale_json, stale, created_at)"
                " VALUES (?,?,?,?,?,?)",
                (pid, json.dumps(sdlc["factors"]), json.dumps(sdlc["ranking"]),
                 json.dumps(sdlc["rationale"]), int(sdlc["stale"]), now),
            )
    return pid


def get_requirements(pid):
    with conn() as c:
        rows = c.execute("SELECT * FROM requirements WHERE project_id=? ORDER BY seq", (pid,)).fetchall()
    return [_req(r) for r in rows]


def update_requirement(pid, seq, **f):
    sets, vals = [], []
    for k, v in f.items():
        if k in _REQ_JSON:
            sets.append(f"{k}_json=?")
            vals.append(json.dumps(v))
        elif k in _REQ_FIELDS:
            sets.append(f"{k}=?")
            vals.append(v)
        else:
            raise KeyError(k)
    with conn() as c:
        c.execute(f"UPDATE requirements SET {', '.join(sets)} WHERE project_id=? AND seq=?", (*vals, pid, seq))


# --- sdlc runs ---
def add_sdlc_run(pid, factors, ranking, rationale):
    with conn() as c:
        c.execute(
            "INSERT INTO sdlc_runs (project_id, factors_json, ranking_json, rationale_json, stale, created_at)"
            " VALUES (?,?,?,?,0,?)",
            (pid, json.dumps(factors), json.dumps(ranking), json.dumps(rationale), _now()),
        )


def latest_sdlc_run(pid):
    with conn() as c:
        r = c.execute("SELECT * FROM sdlc_runs WHERE project_id=? ORDER BY id DESC LIMIT 1", (pid,)).fetchone()
    if not r:
        return None
    return {"factors": json.loads(r["factors_json"]), "ranking": json.loads(r["ranking_json"]),
            "rationale": json.loads(r["rationale_json"]), "stale": bool(r["stale"]),
            "created_at": r["created_at"]}


def mark_sdlc_stale(pid):
    with conn() as c:
        c.execute("UPDATE sdlc_runs SET stale=1 WHERE project_id=?", (pid,))
