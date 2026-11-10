from tests.eval import run


def test_labels_match_scorer():
    """Regression guard: a matrix or scorer edit that changes the sample answers fails here.
    If the new answer is better, update tests/eval/labels.json on purpose (and say so in the README)."""
    rows = run.scoring_eval()
    assert len(rows) == 6
    assert all(r["top1"] for r in rows), [r["id"] for r in rows if not r["top1"]]
    assert sum(r["precision"] for r in rows) / len(rows) >= 0.9


def test_every_sample_has_a_label():
    samples, labels = run.load()
    assert {s["id"] for s in samples} == set(labels)
