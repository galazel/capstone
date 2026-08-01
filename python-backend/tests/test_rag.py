"""RAG infrastructure tests.

These use a deterministic stub embedding so they run without downloading a
model or loading torch. They cover the structural guarantees that the old
`services/ai/vector_db.py` violated -- most importantly that ingesting a
second certification must not erase the first.
"""

from __future__ import annotations

import pytest
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from app.core.config import get_settings
from app.rag.chunking import chunk_documents
from app.rag.retriever import format_context, retrieve
from app.rag.store import (
    VectorStoreUnavailable,
    add_documents,
    count,
    delete_index,
    index_exists,
    load_index,
    namespace_for,
)


class StubEmbeddings(Embeddings):
    """Tiny deterministic embedding: one dimension per keyword.

    Not semantic -- it only needs to be consistent so index/store/retrieval
    mechanics can be asserted without a real model.
    """

    VOCAB = ["network", "database", "security", "python", "exam"]

    def _embed(self, text: str) -> list[float]:
        lowered = text.lower()
        vector = [float(lowered.count(word)) for word in self.VOCAB]
        norm = sum(value * value for value in vector) ** 0.5
        return [value / norm for value in vector] if norm else [1.0] + [0.0] * (len(self.VOCAB) - 1)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


@pytest.fixture()
def stub() -> StubEmbeddings:
    return StubEmbeddings()


@pytest.fixture()
def ns(monkeypatch):
    """Builds throwaway Qdrant collection names and drops them afterwards.

    Vectors moved from local files to a shared service, so isolation can no
    longer be a temp directory -- an unprefixed `cert_1` here would write into
    the real certification 1's collection. Only tests that actually touch the
    store request this fixture, which is also what scopes the skip below to
    them: the pure-function tests still run with no Qdrant at all.
    """
    import uuid

    from app.rag import store

    try:
        store.get_client().get_collections()
    except Exception:
        pytest.skip("Qdrant unreachable; start it with docker run -p 6333:6333 qdrant/qdrant")

    prefix = f"test-{uuid.uuid4().hex[:8]}-"
    created: set[str] = set()

    def make(certification_id: int) -> str:
        namespace = prefix + namespace_for(certification_id=certification_id)
        created.add(namespace)
        return namespace

    yield make

    for namespace in created:
        try:
            store.delete_index(namespace)
        except Exception:  # a leaked test collection is harmless
            pass


# --- chunking -------------------------------------------------------------

def test_chunking_respects_boundaries_and_stamps_metadata():
    text = ". ".join(f"Sentence number {i} about networking concepts" for i in range(60))
    documents = [Document(page_content=text, metadata={"page": 3, "source_file": "net.pdf"})]

    chunks = chunk_documents(
        documents, certification_id=7, certification_name="CCNA", chunk_size=300, chunk_overlap=50
    )

    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk.metadata["certification_id"] == 7
        assert chunk.metadata["certification_name"] == "CCNA"
        assert chunk.metadata["source_file"] == "net.pdf"
        assert chunk.metadata["page"] == 3
        assert "chunk_index" in chunk.metadata

    # Old implementation sliced blindly every N chars and cut mid-word.
    assert not any(chunk.page_content.startswith(" ") for chunk in chunks)


def test_chunking_empty_input_returns_empty():
    assert chunk_documents([]) == []


# --- namespacing ----------------------------------------------------------

def test_namespace_prefers_id_and_slugifies_name():
    assert namespace_for(certification_id=12) == "cert_12"
    assert namespace_for(certification_name="AWS Solutions Architect!") == "cert-name-aws-solutions-architect"
    assert namespace_for() == "cert-unknown"


# --- store ----------------------------------------------------------------

def test_add_documents_creates_then_appends(stub, ns):
    ns = ns(1)
    assert not index_exists(ns)

    add_documents(ns, [Document(page_content="network routing", metadata={})], embeddings=stub)
    assert index_exists(ns)

    add_documents(ns, [Document(page_content="database indexing", metadata={})], embeddings=stub)

    index = load_index(ns, stub)
    # Appended, not replaced: both chunks must survive.
    assert count(ns) == 2


def test_second_certification_does_not_erase_the_first(stub, ns):
    """The exact regression that made the old vector_db unusable."""
    cert_a = ns(1)
    cert_b = ns(2)

    add_documents(cert_a, [Document(page_content="network security", metadata={})], embeddings=stub)
    add_documents(cert_b, [Document(page_content="python database", metadata={})], embeddings=stub)

    assert index_exists(cert_a), "ingesting cert B destroyed cert A's index"
    assert count(cert_a) == 1
    assert count(cert_b) == 1


def test_load_index_missing_returns_none(stub, ns):
    assert load_index(ns(999), stub) is None


def test_delete_index(stub, ns):
    ns = ns(3)
    add_documents(ns, [Document(page_content="exam prep", metadata={})], embeddings=stub)
    assert delete_index(ns) is True
    assert not index_exists(ns)
    assert delete_index(ns) is False


# --- retrieval ------------------------------------------------------------

def test_retrieve_returns_scoped_results(stub, monkeypatch, ns):
    monkeypatch.setattr(get_settings(), "rag_rerank_enabled", False, raising=False)
    ns = ns(4)
    add_documents(
        ns,
        [
            Document(page_content="network routing protocols", metadata={"source_file": "a.pdf", "page": 1}),
            Document(page_content="database normalization forms", metadata={"source_file": "b.pdf", "page": 2}),
        ],
        embeddings=stub,
    )

    results = retrieve(ns, "network", top_k=1, fetch_k=5, embeddings=stub)
    assert len(results) == 1
    assert "network" in results[0].page_content


def test_retrieve_on_missing_index_returns_empty_not_error(stub, ns):
    assert retrieve(ns(888), "anything", embeddings=stub) == []


def test_format_context_includes_provenance_and_respects_budget():
    documents = [
        Document(page_content="alpha " * 50, metadata={"source_file": "a.pdf", "page": 2}),
        Document(page_content="beta " * 50, metadata={"source_file": "b.pdf", "page": 5}),
    ]

    full = format_context(documents, max_chars=10_000)
    assert "[a.pdf p.2]" in full and "[b.pdf p.5]" in full

    truncated = format_context(documents, max_chars=320)
    assert "[a.pdf p.2]" in truncated
    assert "[b.pdf p.5]" not in truncated


def test_format_context_empty():
    assert format_context([]) == ""
