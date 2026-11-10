"""Run the real API with a fake LLM and fake KB search: no API key, no Chroma model download.

    python -m tests.dev_fake_server          # serves on :8000, then `npm run dev` in frontend/
    FAKE_DELAY=0 python -m tests.dev_fake_server   # no artificial latency

Uses its own database file (var/dev_fake.db). For manual UI checks only; pytest does not import this.
"""
import json
import os
import time

from backend import config

config.DB_PATH = config.DB_PATH.parent / "dev_fake.db"
config.RATE_LIMIT_PER_MIN = 0
config.LLM_BASE_URL, config.LLM_API_KEY, config.LLM_MODEL = "http://fake.local/v1", "fake", "fake-model"

import tests.test_orchestrator as canned  # noqa: E402  (after config tweaks)
from backend import main  # noqa: E402
from tests.fake_llm import FakeLLM  # noqa: E402

DELAY = float(os.getenv("FAKE_DELAY", "1.5"))


class Slow(FakeLLM):
    def __call__(self, *args, **kwargs):
        time.sleep(DELAY)  # lets the stage tracker show something
        return super().__call__(*args, **kwargs)


canned.FakeLLM = Slow
main.orch, _ = canned.make(sdlc=json.dumps({"summary": "Fake explanation for UI testing.", "top": [], "why_not": []}))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(main.app, host="127.0.0.1", port=8000)
