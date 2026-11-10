import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
VAR = ROOT / "var"
VAR.mkdir(exist_ok=True)

KB_DIR = ROOT / "kb"
DB_PATH = Path(os.getenv("DB_PATH", VAR / "atlas.db"))
CHROMA_DIR = Path(os.getenv("CHROMA_DIR", VAR / "chroma"))

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")
LLM_MODE = os.getenv("LLM_MODE", "hosted")
LLM_JSON_MODE = os.getenv("LLM_JSON_MODE", "on").strip().lower() != "off"  # off for gateways whose upstreams reject response_format
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "300" if LLM_MODE == "local" else "60"))
LLM_PROVIDER_LABEL = os.getenv("LLM_PROVIDER_LABEL", "")  # shown in the UI badge, e.g. omniroute

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "30"))
DAILY_LLM_CAP = int(os.getenv("DAILY_LLM_CAP", "0"))
TRUST_PROXY_HOPS = int(os.getenv("TRUST_PROXY_HOPS", "0"))
CONCURRENCY = os.getenv("CONCURRENCY", "threads")
WORKERS = int(os.getenv("WORKERS", "4"))