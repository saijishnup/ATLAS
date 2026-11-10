"""python -m tests.eval              scoring check (no LLM, no Chroma): top-1 hit and top-3 precision
python -m tests.eval --pipeline   full agents with the LLM in .env (needs key and Chroma): adds citation stats
python -m tests.eval --fake       full pipeline with canned fake LLM + fake search: plumbing check only
"""
import json
import sys

from tests.eval import run

args = set(sys.argv[1:])
print("Scoring check (traits only, no LLM)")
print(run.table(run.scoring_eval()))
if "--fake" in args:
    from tests.test_orchestrator import make

    orch, _ = make(sdlc=json.dumps({"summary": "fake", "top": [], "why_not": []}))
    orch.sdlc_agent.get_card = lambda cid: cid == "r156-x" or None
    print("\nPipeline check, FAKE LLM and search (citation numbers are meaningless here)")
    from backend import config

    config.DB_PATH = config.DB_PATH.parent / "eval_fake.db"
    print(run.table(run.pipeline_eval(orch), extra=True))
elif "--pipeline" in args:
    from backend import config, llm
    from backend.orchestrator import Orchestrator

    if not llm.status()["configured"]:
        sys.exit("LLM not configured: set LLM_BASE_URL, LLM_API_KEY, LLM_MODEL in .env")
    config.DB_PATH = config.DB_PATH.parent / "eval.db"
    print(f"\nPipeline check, model {config.LLM_MODEL}")
    print(run.table(run.pipeline_eval(Orchestrator()), extra=True))
