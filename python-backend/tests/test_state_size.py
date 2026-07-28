"""Checkpoint-size tests (Phase 2a step 5).

LangGraph serializes the whole state into Postgres on *every* superstep, so
anything large living in state is re-persisted dozens of times per run. The
old `uploaded_files` field carried raw file bytes, meaning a 10 MB PDF was
written on each of ~20 checkpoints.

These tests measure serialized state size rather than just asserting the
code changed shape.
"""

from __future__ import annotations

import pickle

import pytest
from langchain_core.documents import Document
from langgraph.checkpoint.memory import InMemorySaver

from app.ai import invocation
from app.core.config import get_settings
from app.graphs.certification import nodes as cert_nodes
from app.graphs.question_bank import nodes as qb_nodes
from app.rag import loaders


ONE_MB = b"x" * (1024 * 1024)


@pytest.fixture(autouse=True)
def isolated_index_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "rag_index_dir", tmp_path / "faiss_db", raising=False)


def _size(obj) -> int:
    return len(pickle.dumps(obj))


# --- ref resolution -------------------------------------------------------

def test_refs_are_orders_of_magnitude_smaller_than_inline_bytes():
    inline = [{"filename": "a.pdf", "type": "application/pdf", "content": ONE_MB}]
    refs = [{"s3_key": "docs/a.pdf", "filename": "a.pdf", "content_type": "application/pdf"}]

    assert _size(refs) < 1000
    assert _size(inline) > 1_000_000
    # Every checkpoint pays this difference.
    assert _size(inline) / _size(refs) > 1000


def test_resolve_documents_prefers_refs(monkeypatch):
    monkeypatch.setattr(
        loaders, "load_document_refs", lambda refs: [Document(page_content="from-s3")]
    )
    monkeypatch.setattr(
        loaders, "load_uploads", lambda files: [Document(page_content="from-inline")]
    )

    docs = loaders.resolve_documents(
        [{"s3_key": "k", "filename": "f", "content_type": "application/pdf"}],
        [{"filename": "f", "type": "application/pdf", "content": b"bytes"}],
    )
    assert docs[0].page_content == "from-s3"


def test_resolve_documents_falls_back_to_inline(monkeypatch):
    monkeypatch.setattr(loaders, "load_uploads", lambda files: [Document(page_content="from-inline")])

    docs = loaders.resolve_documents(None, [{"filename": "f", "type": "application/pdf", "content": b"b"}])
    assert docs[0].page_content == "from-inline"


def test_resolve_documents_with_neither_source_is_empty():
    assert loaders.resolve_documents(None, None) == []


def test_load_document_refs_skips_a_failing_ref(monkeypatch):
    """One unreadable S3 object must not abort ingestion of the rest."""
    def _fetch(ref):
        if ref["s3_key"] == "bad":
            raise RuntimeError("gone")
        return [Document(page_content="ok")]

    monkeypatch.setattr(loaders, "fetch_document_ref", _fetch)

    docs = loaders.load_document_refs([{"s3_key": "bad"}, {"s3_key": "good"}])
    assert len(docs) == 1


# --- nodes drop inline bytes once consumed --------------------------------

async def test_ingestion_clears_inline_bytes_from_state(monkeypatch):
    monkeypatch.setattr(
        cert_nodes, "resolve_documents", lambda refs, inline: [Document(page_content="text")]
    )
    monkeypatch.setattr(cert_nodes, "chunk_documents", lambda docs, **kw: [Document(page_content="c")])
    monkeypatch.setattr(cert_nodes, "add_documents", lambda ns, chunks: len(chunks))

    result = await cert_nodes.document_ingestion_node({
        "certification_id": 1,
        "certification_name": "C",
        "uploaded_files": [{"filename": "a.pdf", "type": "application/pdf", "content": ONE_MB}],
    })

    assert result["uploaded_files"] == [], "inline bytes must not survive ingestion"
    assert _size(result) < 10_000


async def test_resolve_scope_clears_inline_bytes_from_state(monkeypatch):
    monkeypatch.setattr(
        qb_nodes, "resolve_documents", lambda refs, inline: [Document(page_content="text")]
    )
    monkeypatch.setattr(qb_nodes, "retrieve_context", lambda ns, q: "")

    result = await qb_nodes.resolve_scope_node({
        "certification_name": "C",
        "uploaded_files": [{"filename": "a.pdf", "type": "application/pdf", "content": ONE_MB}],
    })

    assert result["uploaded_files"] == []
    assert _size(result) < 10_000


# --- end-to-end: checkpoints stay small across a full paused run ----------

async def _run_question_bank(monkeypatch, initial_state, thread_id):
    from app.graphs.question_bank.workflow import build_question_bank_graph
    from app.schemas.certification.question_schema import QuestionBatch, QuestionDraft

    batch = QuestionBatch(
        scope="s",
        questions=[QuestionDraft(question_type="MCQ", question="Q", choices=list("abcd"),
                                 correct_choice_index=0)],
    )

    class _Stub:
        async def ainvoke(self, payload):
            return {"structured_response": batch}

    # Takes the model argument `app.ai.router` passes when it builds the agent.
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: _Stub())
    monkeypatch.setattr(qb_nodes, "retrieve_context", lambda ns, q: "")
    # This test measures state size, not parsing.
    monkeypatch.setattr(qb_nodes, "resolve_documents", lambda refs, inline: [])

    saver = InMemorySaver()
    graph = build_question_bank_graph(checkpointer=saver)
    config = {"configurable": {"thread_id": thread_id}}
    await graph.ainvoke(initial_state, config=config)
    return [_size(cp.checkpoint) for cp in saver.list(config)]


async def test_inline_upload_bloat_is_bounded_to_the_entry_checkpoints(monkeypatch):
    """With a direct multipart upload the bytes unavoidably appear in the
    caller's input state, but must be dropped as soon as they are consumed.

    Before this change they persisted for the whole run; here at most the
    two entry checkpoints carry the payload and everything after is tiny.
    """
    sizes = await _run_question_bank(
        monkeypatch,
        {
            "certification_name": "C",
            "target_total": 1,
            "batch_size": 1,
            "uploaded_files": [
                {"filename": "big.pdf", "type": "application/pdf", "content": ONE_MB}
            ],
        },
        "inline-run",
    )

    big = [s for s in sizes if s > 500_000]
    small = [s for s in sizes if s <= 500_000]

    assert len(big) <= 2, f"payload survived into {len(big)} checkpoints: {sizes}"
    assert small, "expected post-ingestion checkpoints to be small"
    assert max(small) < 50_000


async def test_ref_based_run_never_writes_a_large_checkpoint(monkeypatch):
    """The production path (RabbitMQ consumers) passes S3 refs, so *no*
    checkpoint should ever be large."""
    sizes = await _run_question_bank(
        monkeypatch,
        {
            "certification_name": "C",
            "target_total": 1,
            "batch_size": 1,
            "document_refs": [
                {"s3_key": "docs/big.pdf", "filename": "big.pdf",
                 "content_type": "application/pdf"}
            ],
        },
        "ref-run",
    )

    assert max(sizes) < 50_000, f"a checkpoint was unexpectedly large: {sizes}"
