"""Card hygiene. No Chroma, no network: runs anywhere."""
import json
from pathlib import Path

from backend.kb.loader import load_cards

ROOT = Path(__file__).resolve().parent.parent
CARDS = load_cards(ROOT / "kb" / "cards")  # also fails on bad front matter / duplicate ids


def test_every_matrix_model_has_a_card():
    ids = {c.id for c in CARDS}
    models = json.load(open(ROOT / "backend/data/fit_matrix.json"))["models"]
    assert [m for m in models if f"sdlc-{m}" not in ids] == []


def test_body_length_sane():
    for c in CARDS:
        assert 40 <= len(c.body.split()) <= 220, c.id


def test_primary_text_has_clause_and_secondary_is_marked():
    for c in CARDS:
        if c.basis == "primary-text":
            assert c.clause, c.id
        if c.family == "standard":
            assert c.basis == "secondary-summary" and "verify" in c.source, c.id


def test_regulation_cards_exist():
    fam = {c.family for c in CARDS}
    assert {"regulation", "standard", "sdlc", "factor", "terminology"} <= fam
    assert sum(c.id.startswith("r155-") for c in CARDS) >= 6
    assert sum(c.id.startswith("r156-") for c in CARDS) >= 6
