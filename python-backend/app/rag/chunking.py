"""Semantic-boundary chunking.

The previous implementation sliced text into fixed 300-character windows
regardless of word or sentence boundaries:

    for start in range(0, len(text), chunk_size - overlap):
        chunks.append(text[start:start + chunk_size])

That routinely cut mid-word, and 300 chars (~75 tokens) is far too small to
carry a coherent concept -- retrieving k=5 of them gave a generation agent
~1500 characters of context to author an entire certification curriculum.

RecursiveCharacterTextSplitter instead prefers paragraph breaks, then line
breaks, then sentence enders, then words, only falling back to a hard cut
when a single token exceeds the window.
"""

from __future__ import annotations

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import get_settings

# Ordered most- to least-preferred split point.
_SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""]


def chunk_documents(
    documents: list[Document],
    *,
    certification_id: int | None = None,
    certification_name: str = "",
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[Document]:
    """Splits documents and stamps retrieval/citation metadata onto each chunk.

    Metadata carried per chunk: certification_id, certification_name,
    source_file, page, and chunk_index. The old version kept only
    certification_name + source_file, which made citation and
    neighbour-expansion impossible.
    """
    if not documents:
        return []

    settings = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size or settings.rag_chunk_size,
        chunk_overlap=chunk_overlap if chunk_overlap is not None else settings.rag_chunk_overlap,
        separators=_SEPARATORS,
        keep_separator=True,
    )

    chunks = splitter.split_documents(documents)

    for index, chunk in enumerate(chunks):
        chunk.metadata = {
            **chunk.metadata,
            "certification_id": certification_id,
            "certification_name": certification_name,
            "chunk_index": index,
        }

    return chunks
