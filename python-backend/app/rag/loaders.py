"""Document loading.

Previously `load_document` lived inside `app/graphs/certification/nodes.py`,
which meant the question-bank graph had to import the *certification graph's
node module* just to parse a PDF -- transitively constructing every
certification agent and LLM client as a side effect. Parsing is
infrastructure, not orchestration, so it lives here.
"""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

import docx2txt
from langchain_core.documents import Document
from pypdf import PdfReader

logger = logging.getLogger(__name__)

PDF_CONTENT_TYPE = "application/pdf"
DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _normalize_whitespace(text: str) -> str:
    return " ".join((text or "").split())


def load_document(path: str, content_type: str, *, source_name: str = "") -> list[Document]:
    """Parses one file into per-page (PDF) or single (DOCX) Documents.

    Page numbers are preserved in metadata so retrieved chunks can be cited
    back to their origin -- the old implementation kept page only for PDFs
    and dropped it everywhere else.
    """
    if content_type == PDF_CONTENT_TYPE:
        reader = PdfReader(path)
        documents = []
        for index, page in enumerate(reader.pages):
            text = _normalize_whitespace(page.extract_text() or "")
            if not text:
                continue
            documents.append(
                Document(
                    page_content=text,
                    metadata={"page": index + 1, "source_file": source_name},
                )
            )
        return documents

    text = _normalize_whitespace(docx2txt.process(path) or "")
    if not text:
        return []
    return [Document(page_content=text, metadata={"page": 1, "source_file": source_name})]


def load_upload(content: bytes, content_type: str, filename: str = "") -> list[Document]:
    """Parses an in-memory upload by spilling to a temp file.

    pypdf/docx2txt are path-based, so the temp file is unavoidable; it is
    always removed, including on parse failure.
    """
    suffix = ".pdf" if content_type == PDF_CONTENT_TYPE else ".docx"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        return load_document(tmp_path, content_type, source_name=filename)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


def load_uploads(files: list[dict[str, Any]]) -> list[Document]:
    """Parses a list of `{filename, type, content}` dicts, skipping any file
    that fails rather than aborting the whole ingestion."""
    documents: list[Document] = []
    for file in files or []:
        try:
            documents.extend(
                load_upload(file["content"], file["type"], file.get("filename", ""))
            )
        except Exception:
            logger.exception("Failed to parse uploaded file %s", file.get("filename"))
    return documents


def fetch_document_ref(ref: dict[str, Any]) -> list[Document]:
    """Downloads one S3-backed document and parses it.

    A `ref` is `{s3_key, filename, content_type}` -- the small pointer that
    lives in graph state instead of the file's bytes.
    """
    # Imported here rather than at module scope so parsing stays usable
    # (and testable) without AWS configured.
    from app.storage.s3_client import fetch_object_bytes

    content = fetch_object_bytes(ref["s3_key"])
    return load_upload(content, ref["content_type"], ref.get("filename", ""))


def load_document_refs(refs: list[dict[str, Any]]) -> list[Document]:
    """Resolves S3-backed refs to parsed Documents, skipping any that fail."""
    documents: list[Document] = []
    for ref in refs or []:
        try:
            documents.extend(fetch_document_ref(ref))
        except Exception:
            logger.exception("Failed to fetch/parse S3 document %s", ref.get("s3_key"))
    return documents


def resolve_documents(
    refs: list[dict[str, Any]] | None,
    inline_files: list[dict[str, Any]] | None,
) -> list[Document]:
    """Resolves whichever source this run was started with.

    `refs` is the preferred form and the one the RabbitMQ consumers use --
    the bytes stay in S3 instead of being serialized into every LangGraph
    checkpoint. `inline_files` remains supported for the direct multipart
    upload route, where no S3 object exists yet.
    """
    if refs:
        return load_document_refs(refs)
    return load_uploads(inline_files or [])
