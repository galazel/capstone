"""Per-certification FAISS index storage.

The previous implementation was destructive:

    vector_store = FAISS.from_documents(chunks, embeddings)  # only THESE chunks
    vector_store.save_local(PERSIST_DIRECTORY)               # one global path

`from_documents` builds a brand-new index containing only the chunks passed
in, and `PERSIST_DIRECTORY` was a single hardcoded `./faiss_db`. Ingesting
certification B therefore erased certification A, and the
`{"certification_name": ...}` retrieval filter was querying an index that
only ever held the most recent ingestion.

Two changes fix that: each certification gets its own index directory
(so writes can never collide), and ingestion loads-then-appends instead of
rebuilding (so re-ingesting a second document set for the same
certification is additive).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from app.core.config import get_settings
from app.rag.embeddings import resolve_embeddings

logger = logging.getLogger(__name__)


def namespace_for(certification_id: int | None = None, certification_name: str = "") -> str:
    """Stable, filesystem-safe index key.

    Prefers the numeric id (authoritative, immutable). Falls back to a slug
    of the name for callers that only have a title -- renaming a
    certification then orphans its index, which is why id is preferred.
    """
    if certification_id is not None:
        return f"cert_{certification_id}"
    slug = re.sub(r"[^a-z0-9]+", "-", (certification_name or "").lower()).strip("-")
    return f"cert-name-{slug}" if slug else "cert-unknown"


def index_dir(namespace: str) -> Path:
    return get_settings().rag_index_dir / namespace


def index_exists(namespace: str) -> bool:
    # FAISS.save_local writes index.faiss + index.pkl; both are required.
    directory = index_dir(namespace)
    return (directory / "index.faiss").exists() and (directory / "index.pkl").exists()


def load_index(namespace: str, embeddings: Embeddings | None = None) -> FAISS | None:
    """Loads an existing index, or returns None if this certification has
    never been ingested. Returning None (rather than raising) lets callers
    treat "no knowledge base yet" as a normal, non-fatal state."""
    if not index_exists(namespace):
        return None
    return FAISS.load_local(
        str(index_dir(namespace)),
        resolve_embeddings(embeddings),
        # Trusted input: these files are written by this service only.
        allow_dangerous_deserialization=True,
    )


def add_documents(
    namespace: str,
    documents: list[Document],
    embeddings: Embeddings | None = None,
) -> int:
    """Appends chunks to a certification's index, creating it on first use.

    Non-destructive by construction: an existing index is loaded and
    extended, never replaced. Returns the number of chunks added.
    """
    if not documents:
        return 0

    resolved = resolve_embeddings(embeddings)
    directory = index_dir(namespace)
    directory.parent.mkdir(parents=True, exist_ok=True)

    existing = load_index(namespace, resolved)
    if existing is None:
        index = FAISS.from_documents(documents, resolved)
        logger.info("Created FAISS index '%s' with %d chunks", namespace, len(documents))
    else:
        existing.add_documents(documents)
        index = existing
        logger.info("Appended %d chunks to existing FAISS index '%s'", len(documents), namespace)

    index.save_local(str(directory))
    return len(documents)


def delete_index(namespace: str) -> bool:
    """Removes a certification's index. Used when regenerating a
    certification from scratch, so stale chunks can't leak into the new run."""
    directory = index_dir(namespace)
    if not directory.exists():
        return False
    for child in directory.iterdir():
        child.unlink()
    directory.rmdir()
    logger.info("Deleted FAISS index '%s'", namespace)
    return True
