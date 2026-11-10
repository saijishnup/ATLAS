import hashlib
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

FAMILIES = {"regulation", "standard", "terminology", "sdlc", "factor"}
BASES = {"primary-text", "secondary-summary"}
REQUIRED = {"id", "family", "title", "source", "basis"}


@dataclass
class Card:
    id: str
    family: str
    title: str
    source: str
    basis: str
    body: str
    clause: str = ""
    version: str = ""
    last_verified: str = ""
    project_types: list[str] = field(default_factory=list)  # empty = all types
    sdlc_relevance: list[str] = field(default_factory=list)


def parse_card(path) -> Card:
    _, front, body = Path(path).read_text(encoding="utf-8").split("+++", 2)
    meta = tomllib.loads(front)
    if missing := REQUIRED - meta.keys():
        raise ValueError(f"{path}: missing {sorted(missing)}")
    if meta["family"] not in FAMILIES or meta["basis"] not in BASES:
        raise ValueError(f"{path}: bad family/basis")
    return Card(body=body.strip(), **meta)


def load_cards(root) -> list[Card]:
    cards = [parse_card(p) for p in sorted(Path(root).rglob("*.md"))]
    ids = [c.id for c in cards]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate card ids")
    return cards


def kb_version(root) -> str:
    h = hashlib.sha256()
    for p in sorted(Path(root).rglob("*.md")):
        h.update(p.name.encode() + p.read_bytes())
    return h.hexdigest()[:12]