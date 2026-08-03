"""Retrieval: fetch wide, rerank, assemble a bounded context.

Previously retrieval was a single `k=5` similarity call over 300-character
chunks -- roughly 1,500 characters of context to author an entire
certification curriculum, which is a large part of why generated curricula
were thin. Here a wider candidate set (`fetch_k`) is narrowed by an optional
cross-encoder reranker to `top_k`, then assembled under a character budget.

The reranker is optional and degrades gracefully: if the model can't be
loaded, retrieval still returns similarity-ordered results rather than
failing the whole generation run.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from app.core.config import get_settings
from app.rag.store import load_index

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_reranker():
    """Lazily loads the cross-encoder. Returns None (and warns once) if the
    backend is unavailable, so a missing reranker degrades quality rather
    than breaking retrieval."""
    settings = get_settings()
    if not settings.rag_rerank_enabled:
        return None
    try:
        from sentence_transformers import CrossEncoder

        return CrossEncoder(settings.rag_rerank_model)
    except Exception as error:
        logger.warning(
            "Cross-encoder reranker unavailable (%s); falling back to "
            "similarity ordering. Retrieval still works, but precision is lower.",
            error,
        )
        return None


def _rerank(query: str, documents: list[Document], top_k: int) -> list[Document]:
    reranker = _get_reranker()
    if reranker is None or not documents:
        return documents[:top_k]
    try:
        scores = reranker.predict([(query, doc.page_content) for doc in documents])
        ranked = sorted(zip(documents, scores), key=lambda pair: pair[1], reverse=True)
        return [doc for doc, _ in ranked[:top_k]]
    except Exception:
        logger.exception("Reranking failed; falling back to similarity ordering")
        return documents[:top_k]


def retrieve(
    namespace: str,
    query: str,
    *,
    top_k: int | None = None,
    fetch_k: int | None = None,
    embeddings: Embeddings | None = None,
) -> list[Document]:
    """Returns the most relevant chunks for a query within one certification.

    An empty list means "this certification has no knowledge base yet",
    which callers should treat as a degraded-but-valid state rather than an
    error -- the old code silently swallowed this case with a bare except.
    """
    settings = get_settings()
    top_k = top_k or settings.rag_top_k
    fetch_k = fetch_k or settings.rag_fetch_k

    index = load_index(namespace, embeddings)
    if index is None:
        logger.info("Nothing indexed for namespace '%s'; returning no context", namespace)
        return []

    # No metadata filter needed: the index itself is scoped to one
    # certification, so cross-certification bleed is structurally impossible.
    candidates = index.similarity_search(query, k=fetch_k)
    return _rerank(query, candidates, top_k)


def format_context(documents: list[Document], max_chars: int | None = None) -> str:
    """Joins chunks into a context block with provenance headers, capped at
    a character budget so a large retrieval can't blow the model's window."""
    if not documents:
        return ""

    budget = max_chars or get_settings().rag_max_context_chars
    pieces: list[str] = []
    used = 0

    for doc in documents:
        source = doc.metadata.get("source_file") or "source"
        page = doc.metadata.get("page")
        header = f"[{source}" + (f" p.{page}]" if page else "]")
        piece = f"{header}\n{doc.page_content}"

        if used + len(piece) > budget:
            break
        pieces.append(piece)
        used += len(piece)

    return "\n\n---\n\n".join(pieces)


def retrieve_context(
    namespace: str,
    query: str,
    *,
    top_k: int | None = None,
    fetch_k: int | None = None,
    max_chars: int | None = None,
    embeddings: Embeddings | None = None,
) -> str:
    """Convenience wrapper: retrieve then format. Returns "" when the
    certification has no indexed knowledge."""
    documents = retrieve(namespace, query, top_k=top_k, fetch_k=fetch_k, embeddings=embeddings)
    return format_context(documents, max_chars)
