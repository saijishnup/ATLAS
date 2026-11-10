"""Eval helpers. Scoring check needs no LLM and no Chroma; the pipeline check runs the real agents."""
import json
from pathlib import Path

from backend import scoring
from backend.schemas import Intake

HERE = Path(__file__).parent
SAMPLES = Path(__file__).resolve().parents[2] / "backend" / "data" / "samples.json"


def load():
    labels = json.loads((HERE / "labels.json").read_text(encoding="utf-8"))["samples"]
    samples = json.loads(SAMPLES.read_text(encoding="utf-8"))
    return samples, labels


def top3(ranking):
    return [r["model"] for r in ranking[:3]]


def judge(sid, labels, ranking):
    lab, t3 = labels[sid], top3(ranking)
    return {"top1": ranking[0]["model"] in lab["top1"],
            "precision": sum(m in lab["shortlist"] for m in t3) / 3, "top3": t3}


def static_ranking(sample):
    """Form traits only; the two clarification factors stay 'not sure', no accepted requirements."""
    factors = scoring.build_factors(sample["traits"], {}, [])
    return scoring.rank({f["factor"]: f["level"] for f in factors})


def scoring_eval():
    samples, labels = load()
    return [{"id": s["id"], **judge(s["id"], labels, static_ranking(s))} for s in samples]


def pipeline_eval(orch):
    """Real agents, no human: no answers, accept every requirement, then SDLC."""
    samples, labels = load()
    out = []
    for s in samples:
        pid = orch.create(Intake(**{k: s[k] for k in ("name", "project_type", "description", "traits")}))
        orch.clarify(pid)
        orch.answer(pid, [], False)
        v = orch.draft(pid)
        for r in v["requirements"]:
            orch.patch_requirement(pid, r["seq"], "accept")
        v = orch.sdlc(pid)
        cites = [c["card_id"] for r in v["requirements"] for c in r["citations"]]
        valid = [c for c in cites if orch.sdlc_agent.get_card(c)]
        out.append({"id": s["id"], **judge(s["id"], labels, v["sdlc"]["ranking"]),
                    "reqs": len(v["requirements"]),
                    "with_cite": sum(bool(r["citations"]) for r in v["requirements"]),
                    "cites": len(cites), "valid": len(valid)})
    return out


def table(rows, extra=False):
    head = f"{'sample':20} {'top1':5} {'prec':5} top3" + ("   reqs  cited  cites-valid" if extra else "")
    lines = [head]
    for r in rows:
        line = f"{r['id']:20} {'yes' if r['top1'] else 'NO':5} {r['precision']:.2f}  {', '.join(r['top3'])}"
        if extra:
            line += f"   {r['reqs']:4}  {r['with_cite']:5}  {r['valid']}/{r['cites']}"
        lines.append(line)
    n = len(rows)
    lines.append(f"top-1 hit {sum(r['top1'] for r in rows)}/{n}   mean top-3 precision {sum(r['precision'] for r in rows) / n:.2f}")
    if extra:
        reqs, cited = sum(r["reqs"] for r in rows), sum(r["with_cite"] for r in rows)
        cites, valid = sum(r["cites"] for r in rows), sum(r["valid"] for r in rows)
        lines.append(f"requirements with >=1 citation {cited}/{reqs}   citations that resolve to a card {valid}/{cites}")
    return "\n".join(lines)
