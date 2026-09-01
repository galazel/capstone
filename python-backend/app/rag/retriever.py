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


def _source_of(document: Document) -> str:
    return str((document.metadata or {}).get("source_file") or "?")


def retrieve_balanced(
    namespace: str,
    query: str,
    *,
    top_k: int | None = None,
    fetch_k: int | None = None,
    embeddings: Embeddings | None = None,
) -> list[Document]:
    """Retrieval that gives every uploaded document a turn.

    `retrieve` ranks the whole corpus by similarity and takes the best
    `top_k`, which is right when the question has an answer somewhere and
    wrong when the question is "what does this corpus cover". Ranking is
    winner-take-all across files: one long, densely-worded document can hold
    every one of the 24 slots, and the planner then designs a curriculum for
    the only material it was shown.

    That is not hypothetical. TOPCIT was uploaded as six documents, one per
    domain -- Software, Database, System Architecture, Information Security,
    IT Business and Ethics, Project Management -- and the planner produced
    three major categories, having never seen the other three files. The
    documents were indexed and healthy; they simply lost the ranking.

    So this keeps the ranking but spends it round-robin: the best unused chunk
    from file A, then from file B, and so on, wrapping until `top_k` is full.
    Every file that put anything in the candidate pool is represented before
    any file gets a second chunk, and a file with more relevant material still
    ends up with more slots once every file has one.
    """
    settings = get_settings()
    top_k = top_k or settings.rag_top_k
    # Wider than the plain path: round-robin can only include a document that
    # made the candidate pool, so the pool has to be broad enough to contain
    # every file rather than merely the best-matching ones.
    fetch_k = fetch_k or max(settings.rag_fetch_k, top_k * 10)

    index = load_index(namespace, embeddings)
    if index is None:
        logger.info("Nothing indexed for namespace '%s'; returning no context", namespace)
        return []

    candidates = index.similarity_search(query, k=fetch_k)
    ranked = _rerank(query, candidates, len(candidates))

    by_source: dict[str, list[Document]] = {}
    for document in ranked:
        by_source.setdefault(_source_of(document), []).append(document)

    if len(by_source) <= 1:
        return ranked[:top_k]

    selected: list[Document] = []
    round_index = 0
    # Sources in first-appearance order, so the best-matching file still leads.
    while len(selected) < top_k:
        added = False
        for source in list(by_source):
            chunks = by_source[source]
            if round_index < len(chunks):
                selected.append(chunks[round_index])
                added = True
                if len(selected) >= top_k:
                    break
        if not added:
            break  # every source exhausted
        round_index += 1

    logger.info(
        "Balanced retrieval over %d document(s): %s",
        len(by_source),
        ", ".join(
            f"{source}={sum(1 for d in selected if _source_of(d) == source)}"
            for source in by_source
        ),
    )
    return selected


def retrieve_balanced_context(
    namespace: str,
    query: str,
    *,
    top_k: int | None = None,
    max_chars: int | None = None,
) -> str:
    """`retrieve_balanced`, formatted. See `retrieve_context`."""
    return format_context(retrieve_balanced(namespace, query, top_k=top_k), max_chars)


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
