"""Retrieval-Augmented Generation infrastructure.

Replaces the previous `app/services/ai/vector_db.py`, which had three
compounding defects:

1. `faiss` was never declared as a dependency, so every ingestion raised
   ImportError at runtime.
2. "Embeddings" were a 256-dim SHA-256 token-hashing bag-of-words with no
   semantic capability.
3. `FAISS.from_documents(...).save_local(shared_dir)` rebuilt the index from
   only the current chunks and overwrote one global directory, so ingesting
   a second certification silently erased the first.

This package fixes all three and keeps each concern in its own module so
loading, chunking, embedding, storage, and retrieval can be tested and
swapped independently.
"""

from app.rag.chunking import chunk_documents
from app.rag.loaders import (
    load_document,
    load_document_refs,
    load_upload,
    load_uploads,
    resolve_documents,
)
from app.rag.retriever import retrieve_context
from app.rag.store import add_documents, index_exists, load_index

__all__ = [
    "chunk_documents",
    "load_document",
    "load_document_refs",
    "load_upload",
    "load_uploads",
    "resolve_documents",
    "retrieve_context",
    "add_documents",
    "index_exists",
    "load_index",
]
