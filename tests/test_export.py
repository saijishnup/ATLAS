import json

from backend.export import build_report, to_json, to_markdown
from tests.test_orchestrator import flow, make


def test_export_before_sdlc():
    o, _ = make()
    pid = flow(o)
    o.draft(pid)
    o.patch_requirement(pid, 2, "reject")
    report = build_report(o.view(pid))
    assert report["sdlc"] is None and [r["id"] for r in report["rejected"]] == ["REQ-002"]
    markdown = to_markdown(report)
    assert "No SDLC analysis yet" in markdown and "## Rejected requirements" in markdown
    assert "Possible duplicate" in markdown
    assert json.loads(to_json(report)) == report


def test_export_with_sdlc_and_stale():
    import json
    o, _ = make(sdlc=json.dumps({"summary": "Because.", "top": [], "why_not": []}))
    pid = flow(o)
    o.draft(pid)
    o.patch_requirement(pid, 1, "accept")
    o.sdlc(pid)
    markdown = to_markdown(build_report(o.view(pid)))
    assert "Because." in markdown and "| Rank |" in markdown and "stale" not in markdown.lower()
    o.patch_requirement(pid, 3, "accept")
    assert "Stale" in to_markdown(build_report(o.view(pid)))
