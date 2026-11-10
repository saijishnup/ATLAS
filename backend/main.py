import json
import re
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import get_args

from fastapi import FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend import config, db, export, llm, scoring
from backend.llm import CapError, LLMError, NotConfigured
from backend.orchestrator import BadInput, NotFound, Orchestrator, StageError
from backend.schemas import CATEGORIES, TRAITS, AnswersIn, Intake, ProjectFile, ProjectType, ReqPatch

app = FastAPI(title="ATLAS")
orch = Orchestrator()
SAMPLES = Path(__file__).parent / "data" / "samples.json"

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _err(status: int, code: str, message: str, retryable: bool = False):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "retryable": retryable}},
    )

_hits: dict[str, deque] = defaultdict(deque)
MAX_IMPORT_BYTES = 1_000_000


def _client_ip(request: Request) -> str:
    """Socket IP, or behind N trusted proxies the Nth entry from the right of X-Forwarded-For.
    The left side is client-controlled, so never read it. TRUST_PROXY_HOPS=0 means no proxy."""
    hops = config.TRUST_PROXY_HOPS
    if hops > 0:
        parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if len(parts) >= hops:
            return parts[-hops]
    return request.client.host if request.client else "?"


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if config.RATE_LIMIT_PER_MIN > 0 and path.startswith("/api/") and path != "/api/health":
        ip = _client_ip(request)
        now, queue = time.monotonic(), _hits[ip]
        while queue and now - queue[0] > 60:
            queue.popleft()
        if len(queue) >= config.RATE_LIMIT_PER_MIN:
            return _err(429, "rate_limited", "Too many requests. Slow down and retry.", True)
        queue.append(now)
    return await call_next(request)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return _err(exc.status_code, f"http_{exc.status_code}", str(exc.detail), exc.status_code in (429, 502))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    return _err(422, "invalid_input", str(exc.errors()[0]["msg"]))


@app.exception_handler(StageError)
async def stage_error(_: Request, exc: StageError):
    return _err(409, "wrong_stage", str(exc))


@app.exception_handler(NotFound)
async def not_found(_: Request, exc: NotFound):
    return _err(404, "not_found", f"Not found: {exc}")


@app.exception_handler(BadInput)
async def bad_input(_: Request, exc: BadInput):
    return _err(422, "invalid_input", str(exc))


@app.exception_handler(LLMError)
async def llm_error(_: Request, exc: LLMError):
    if isinstance(exc, NotConfigured):
        return _err(502, "llm_not_configured", str(exc), False)
    return _err(502, "llm_error", "The language model call failed. Try again.", True)


@app.exception_handler(CapError)
async def cap_error(_: Request, exc: CapError):
    return _err(429, "daily_cap", "Daily LLM call limit reached. Try again tomorrow.", False)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/llm/status")
def llm_status():
    return llm.status()


@app.get("/api/meta")
def meta():
    matrix = scoring.load_matrix()
    by = {f["id"]: f for f in matrix["factors"]}
    return {"project_types": list(get_args(ProjectType)), "categories": CATEGORIES,
            "traits": [{"trait": t, **by[scoring.TRAIT_TO_FACTOR[t]]} for t in TRAITS],
            "clarified": [by[f] for f in scoring.CLARIFIED], "matrix_note": matrix["note"]}


def _samples():
    return json.loads(SAMPLES.read_text(encoding="utf-8"))


@app.get("/api/samples")
def samples():
    return _samples()


@app.post("/api/samples/{sid}/load", status_code=201)
def load_sample(sid: str):
    sample = next((x for x in _samples() if x["id"] == sid), None)
    if not sample:
        raise NotFound(sid)
    intake = Intake(**{k: sample[k] for k in ("name", "project_type", "description", "traits")})
    return orch.view(orch.create(intake))


@app.post("/api/projects/import", status_code=201)
async def import_project(request: Request):
    raw = await request.body()
    if len(raw) > MAX_IMPORT_BYTES:
        return _err(413, "file_too_large", "Project file is over 1 MB.")
    try:
        f = ProjectFile.model_validate_json(raw)
    except ValidationError as e:
        err = e.errors()[0]
        where = ".".join(str(x) for x in err["loc"])
        return _err(422, "invalid_file", f"Not a valid ATLAS project file ({where}: {err['msg']}).")
    return orch.import_project(f)


@app.post("/api/projects", status_code=201)
def create_project(intake: Intake):
    return orch.view(orch.create(intake))


@app.get("/api/projects")
def list_projects():
    return db.list_projects()


@app.get("/api/projects/{pid}")
def get_project(pid: str):
    return orch.view(pid)


@app.delete("/api/projects/{pid}", status_code=204)
def delete_project(pid: str):
    if not db.delete_project(pid):
        raise NotFound(pid)


@app.post("/api/projects/{pid}/clarify")
def clarify(pid: str):
    return orch.clarify(pid)


@app.post("/api/projects/{pid}/answers")
def answers(pid: str, body: AnswersIn):
    return orch.answer(pid, [a.model_dump() for a in body.answers], body.more)


@app.post("/api/projects/{pid}/draft")
def draft(pid: str):
    return orch.draft(pid)


@app.patch("/api/projects/{pid}/requirements/{rid}")
def patch_requirement(pid: str, rid: int, body: ReqPatch):
    edit = body.model_dump(exclude={"action"}, exclude_none=True)
    return orch.patch_requirement(pid, rid, body.action, **edit)


@app.post("/api/projects/{pid}/sdlc")
def sdlc(pid: str):
    return orch.sdlc(pid)


@app.get("/api/projects/{pid}/export")
def export_project(pid: str, format: str = Query("json", pattern="^(json|md)$")):
    report = export.build_report(orch.view(pid))
    slug = re.sub(r"[^a-z0-9]+", "-", report["project"]["name"].lower()).strip("-") or "project"
    if format == "json":
        body, media_type = export.to_json(report), "application/json"
    else:
        body, media_type = export.to_markdown(report), "text/markdown; charset=utf-8"
    return Response(body, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{slug}.atlas.json"' if format == "json"
                 else f'attachment; filename="atlas-{slug}.md"'})


# --- single-process demo / hosted: serve the built frontend ---
def mount_frontend(app: FastAPI, dist: Path):
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse("/app")

    @app.get("/app", include_in_schema=False)
    @app.get("/app/{path:path}", include_in_schema=False)
    def spa(path: str = ""):
        return FileResponse(dist / "index.html")  # client-side routes fall back to the SPA shell

    @app.get("/{name}", include_in_schema=False)
    def root_file(name: str):  # favicon etc. directly under dist/
        f = dist / name
        if f.is_file() and f.parent == dist:
            return FileResponse(f)
        raise StarletteHTTPException(404, "Not found")


DIST = config.ROOT / "frontend" / "dist"
if (DIST / "index.html").is_file():  # absent in dev (Vite serves the UI) and in tests
    mount_frontend(app, DIST)
