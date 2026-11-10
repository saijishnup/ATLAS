import json

from backend import config, scoring

DISCLAIMER = (
    "Drafts for human review, not compliance advice. The SDLC fit matrix is expert judgement, "
    "not an empirical benchmark. Knowledge cards marked 'secondary-summary' are own-words "
    "summaries: verify against the standard."
)
REQ_FIELDS = ("id", "seq", "statement", "categories", "priority", "acceptance_criteria", "citations",
              "confidence", "confidence_band", "status", "source_quote", "quality_flags",
              "original_statement")


def build_report(v):
    reqs = [{k: r.get(k) for k in REQ_FIELDS} for r in v["requirements"]]
    s = v.get("sdlc")
    return {
        "schema_version": 1,  # project file: this JSON can be re-imported (POST /api/projects/import)
        "disclaimer": DISCLAIMER,
        "project": {k: v[k] for k in ("id", "name", "project_type", "description", "traits", "status", "created_at")},
        "generated_with": {"provider": v["llm_provider"], "model": config.LLM_MODEL.split(",")[0].strip(), "kb_version": v["kb_version"]},
        "questions": [{"round": q["round"], "text": q["text"], "why": q["why"], "topic": q["topic"],
                       "answer": q["answer"], "skipped": q["skipped"]}
                      for q in v["questions"]],
        "requirements": [r for r in reqs if r["status"] != "rejected"],
        "rejected": [r for r in reqs if r["status"] == "rejected"],
        "sdlc": None if not s else {
            "stale": s["stale"], "created_at": s["created_at"], "confidence": s.get("confidence"),
            "factors": s["factors"], "ranking": s["ranking"], "rationale": s["rationale"],
            "matrix_note": scoring.load_matrix()["note"],
        },
    }


def to_json(rep):
    return json.dumps(rep, indent=2, ensure_ascii=False)


def _cell(x):
    return str(x).replace("|", "\\|").replace("\n", " ")


def _table(head, rows):
    return (["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
            + ["| " + " | ".join(_cell(c) for c in row) + " |" for row in rows] + [""])


def _cite(c):
    where = c["source"] + (f", {c['clause']}" if c["clause"] else "")
    tail = " [summary, verify against standard]" if c["basis"] == "secondary-summary" else ""
    return f"{c['card_id']} ({where}){tail}"


def to_markdown(rep):
    p, g = rep["project"], rep["generated_with"]
    traits = ", ".join(f"{k}={v}" for k, v in p["traits"].items()) or "none"
    lines = [f"# {p['name']}: requirements and SDLC report", "", f"> {rep['disclaimer']}", "",
             f"- Project type: {p['project_type']}", f"- Status: {p['status']}",
             f"- LLM: {g['provider']} / {g['model'] or 'n/a'}",
             f"- Knowledge base version: {g['kb_version'] or 'n/a'}",
             f"- Traits: {traits}", "", "## Description", "", p["description"], ""]
    if rep["questions"]:
        lines += ["## Clarification", ""]
        for q in rep["questions"]:
            lines.append(f"- **Q:** {q['text']}  \n  **A:** {q['answer'] or '(skipped)'}")
        lines.append("")
    lines += [f"## Requirements ({len(rep['requirements'])})", ""]
    for q in rep["requirements"]:
        quote = f'"{q["source_quote"]}"' if q["source_quote"] else "none"
        cites = "; ".join(_cite(c) for c in q["citations"]) or "none"
        lines += [f"### {q['id']} · {q['priority']} · {q['status']}", "", q["statement"], "",
                  f"- Categories: {', '.join(q['categories'])}",
                  f"- Acceptance criteria: {q['acceptance_criteria'] or 'n/a'}",
                  f"- Source quote: {quote}", f"- Confidence: {q['confidence_band']} ({q['confidence']})",
                      f"- Citations: {cites}"]
        lines += [f"- Flag [{f['severity']}]: {f['message']}" for f in q["quality_flags"]]
        if q["original_statement"]:
            lines.append(f"- Edited from: {q['original_statement']}")
        lines.append("")
    if rep["rejected"]:
        lines += ["## Rejected requirements", ""]
        lines += [f"- {q['id']}: {q['statement']}" for q in rep["rejected"]] + [""]
    lines += ["## SDLC recommendation", ""]
    s = rep["sdlc"]
    if not s:
        lines.append("No SDLC analysis yet: accept at least one requirement and run the SDLC step.")
        return "\n".join(lines) + "\n"
    if s["stale"]:
        lines += ["> **Stale:** requirements changed after this analysis. Re-run the SDLC step.", ""]
    rationale, ranking = s["rationale"], s["ranking"]
    lines += [f"**Ranking confidence:** {s['confidence']['text']}", "", rationale["summary"], "", "### Top choices", ""]
    for i, note in enumerate(rationale["top"], 1):
        score = next(x["score"] for x in ranking if x["model"] == note["model"])
        cards = f" (cards: {', '.join(note['cards'])})" if note["cards"] else ""
        lines.append(f"{i}. **{note['name']}** ({score}): {note['text']}{cards}")
    lines += ["", "### Factors", ""]
    lines += _table(["Factor", "Level", "Source", "Detail"], [
        [f["label"], f["level"], f["tag"],
         f"conflict: suggest {f['conflict']['suggested']} ({f['conflict']['reason']})" if f["conflict"] else f["note"]]
        for f in s["factors"]])
    lines += ["### Ranking", ""]
    lines += _table(["Rank", "Model", "Score"], [[x["rank"], x["name"], x["score"]] for x in ranking])
    lines += ["### Why not the others", ""]
    for note in rationale["why_not"]:
        cards = f" (cards: {', '.join(note['cards'])})" if note["cards"] else ""
        lines.append(f"- **{note['name']}:** {note['text']}{cards}")
    lines += ["", f"> {s['matrix_note']}", ""]
    return "\n".join(lines) + "\n"
