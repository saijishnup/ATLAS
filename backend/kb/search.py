from dataclasses import dataclass
from functools import lru_cache

import chromadb

from backend import config
from backend.kb.loader import kb_version, load_cards


@dataclass
class Hit:
    card_id: str
    family: str
    clause: str
    text: str
    score: float  # cosine similarity, 0-1
    source: str
    basis: str


class KB:
    def __init__(self, cards_dir=None, chroma_dir=None):
        cards_dir = cards_dir or config.KB_DIR / "cards"
        self.cards = {c.id: c for c in load_cards(cards_dir)}
        self.version = kb_version(cards_dir)
        client = chromadb.PersistentClient(path=str(chroma_dir or config.CHROMA_DIR))
        try:
            col = client.get_collection("atlas_kb")
        except Exception:
            col = None
        if col is None or (col.metadata or {}).get("kb_version") != self.version:
            if col:
                client.delete_collection("atlas_kb")
            col = client.create_collection(
                "atlas_kb", metadata={"hnsw:space": "cosine", "kb_version": self.version}
            )
            cs = list(self.cards.values())
            col.add(
                ids=[c.id for c in cs],
                documents=[f"{c.title}. {c.body}" for c in cs],
                metadatas=[{"family": c.family} for c in cs],
            )
        self.col = col

    def search(self, query, families=None, project_type=None, k=5) -> list[Hit]:
        where = {"family": {"$in": list(families)}} if families else None
        res = self.col.query(
            query_texts=[query], n_results=min(len(self.cards), k * 4), where=where
        )
        hits = []
        for cid, dist in zip(res["ids"][0], res["distances"][0]):
            c = self.cards[cid]
            # ponytail: project_type filtered post-query (chroma has no list-contains); fine at ~60 cards
            if project_type and c.project_types and project_type not in c.project_types:
                continue
            hits.append(Hit(c.id, c.family, c.clause, c.body, round(1 - dist, 3), c.source, c.basis))
            if len(hits) == k:
                break
        return hits


@lru_cache
def get_kb() -> KB:
    return KB()


def search(query, families=None, project_type=None, k=5) -> list[Hit]:
    return get_kb().search(query, families, project_type, k)


def get_card(card_id):
    return get_kb().cards.get(card_id)