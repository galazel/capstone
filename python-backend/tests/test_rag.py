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
from app.rag.store import add_documents, delete_index, index_exists, load_index, namespace_for


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


@pytest.fixture(autouse=True)
def isolated_index_dir(tmp_path, monkeypatch):
    """Points the index at a temp dir so tests never touch a real faiss_db."""
    settings = get_settings()
    monkeypatch.setattr(settings, "rag_index_dir", tmp_path / "faiss_db", raising=False)
    yield


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

def test_add_documents_creates_then_appends(stub):
    ns = namespace_for(certification_id=1)
    assert not index_exists(ns)

    add_documents(ns, [Document(page_content="network routing", metadata={})], embeddings=stub)
    assert index_exists(ns)

    add_documents(ns, [Document(page_content="database indexing", metadata={})], embeddings=stub)

    index = load_index(ns, stub)
    # Appended, not replaced: both chunks must survive.
    assert index.index.ntotal == 2


def test_second_certification_does_not_erase_the_first(stub):
    """The exact regression that made the old vector_db unusable."""
    cert_a = namespace_for(certification_id=1)
    cert_b = namespace_for(certification_id=2)

    add_documents(cert_a, [Document(page_content="network security", metadata={})], embeddings=stub)
    add_documents(cert_b, [Document(page_content="python database", metadata={})], embeddings=stub)

    assert index_exists(cert_a), "ingesting cert B destroyed cert A's index"
    assert load_index(cert_a, stub).index.ntotal == 1
    assert load_index(cert_b, stub).index.ntotal == 1


def test_load_index_missing_returns_none(stub):
    assert load_index(namespace_for(certification_id=999), stub) is None


def test_delete_index(stub):
    ns = namespace_for(certification_id=3)
    add_documents(ns, [Document(page_content="exam prep", metadata={})], embeddings=stub)
    assert delete_index(ns) is True
    assert not index_exists(ns)
    assert delete_index(ns) is False


# --- retrieval ------------------------------------------------------------

def test_retrieve_returns_scoped_results(stub, monkeypatch):
    monkeypatch.setattr(get_settings(), "rag_rerank_enabled", False, raising=False)
    ns = namespace_for(certification_id=4)
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


def test_retrieve_on_missing_index_returns_empty_not_error(stub):
    assert retrieve(namespace_for(certification_id=888), "anything", embeddings=stub) == []


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
