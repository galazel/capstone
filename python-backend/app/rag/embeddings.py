"""Embedding model access.

Replaces `HashEmbeddings`, which hashed tokens into 256 buckets with
SHA-256 and counted them. That is a hashing bag-of-words vectorizer: it has
no semantic capability (`"authentication"` and `"login"` shared no signal),
and at 256 dimensions collisions were frequent enough to inject false
positives. Every "grounded generation" claim in the system rested on it.

The model is resolved lazily and cached, so importing this module never
downloads weights or loads native libraries -- that matters because the
graph modules import transitively from here at collection time in tests.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from langchain_core.embeddings import Embeddings

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_MISSING_BACKEND_HINT = (
    "Semantic embeddings require `sentence-transformers` (which pulls torch).\n"
    "  Install:  pip install -r requirements.txt\n"
    "  On Windows torch additionally needs the Microsoft Visual C++ "
    "Redistributable v14.38 or newer; an older runtime fails with "
    "'WinError 1114 ... c10.dll'."
)


class EmbeddingBackendUnavailable(RuntimeError):
    """Raised when the embedding model cannot be constructed.

    Deliberately explicit: the previous implementation silently fell back to
    a non-semantic stand-in, so retrieval quality could collapse without any
    visible failure. Failing loudly is the point.
    """


@lru_cache(maxsize=1)
def get_embeddings() -> Embeddings:
    settings = get_settings()
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
    except Exception as error:  # pragma: no cover - import-environment dependent
        raise EmbeddingBackendUnavailable(
            f"Could not import HuggingFaceEmbeddings.\n{_MISSING_BACKEND_HINT}"
        ) from error

    try:
        return HuggingFaceEmbeddings(
            model_name=settings.rag_embedding_model,
            model_kwargs={"device": settings.rag_embedding_device},
            # Unit-normalized vectors make FAISS inner-product scores read
            # directly as cosine similarity.
            encode_kwargs={"normalize_embeddings": True},
        )
    except Exception as error:
        raise EmbeddingBackendUnavailable(
            f"Could not load embedding model "
            f"'{settings.rag_embedding_model}'.\n{_MISSING_BACKEND_HINT}"
        ) from error


def resolve_embeddings(embeddings: Embeddings | None = None) -> Embeddings:
    """Returns the injected embeddings, or the configured default.

    Every store/retriever entry point takes an optional `embeddings` so
    tests can substitute a deterministic stub without a model download.
    """
    return embeddings if embeddings is not None else get_embeddings()
