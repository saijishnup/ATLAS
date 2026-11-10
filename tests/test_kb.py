from pathlib import Path

import pytest

from backend.kb.loader import load_cards, parse_card
from backend.kb.search import KB

CARDS = Path(__file__).resolve().parent.parent / "kb" / "cards"


def test_cards_valid():
    cards = load_cards(CARDS)
    assert len(cards) >= 10


def test_bad_card(tmp_path):
    p = tmp_path / "x.md"
    p.write_text('+++\ntitle = "t"\n+++\nbody', encoding="utf-8")
    with pytest.raises(ValueError):
        parse_card(p)


@pytest.fixture(scope="module")
def kb(tmp_path_factory):
    return KB(chroma_dir=tmp_path_factory.mktemp("chroma"))


def test_search_expected(kb):
    ids = [h.card_id for h in kb.search("test phase paired with each design phase", k=3)]
    assert "sdlc-v-model" in ids
    ids = [h.card_id for h in kb.search("ASIL level A to D", k=3)]
    assert "term-asil" in ids


def test_family_filter(kb):
    hits = kb.search("how often do requirements change", families=["factor"], k=3)
    assert hits and all(h.family == "factor" for h in hits)

def test_search_regulation(kb):
    ids = [h.card_id for h in kb.search("restore previous version after failed or interrupted update", k=5)]
    assert "r156-ota-safe-05" in ids
    ids = [h.card_id for h in kb.search("threat analysis and risk assessment attack feasibility", k=5)]
    assert "iso21434-02" in ids
