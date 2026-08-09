"""Capturing figures, diagrams, tables, and charts out of source documents.

`app/rag/loaders.py` only ever pulls flat text out of a PDF/DOCX -- a figure
on page 12 becomes whitespace where its caption used to be. This module
renders the *image itself* (raster crop of the page region, not a
description) so a captured visual can later be placed back next to the
lesson content it illustrates, or attached to a question that asks about it.

PDF and DOCX take genuinely different routes to the same output:

* **PDF** — figures are *rendered*. A page is rasterized and cropped to the
  figure's rectangle, so what is captured includes vector drawings, overlaid
  labels and anything else painted in that region, not just embedded raster
  data.
* **DOCX** — figures are *extracted*. A .docx is a zip, and its images already
  sit in `word/media/` as complete files, so there is nothing to crop; the
  original bytes are lifted out and normalized to PNG. This is why the DOCX
  path needs no page geometry, which is what previously made it look
  impossible: `docx2txt` has no position concept, but the zip does not need
  one.

Both emit the same capture dict, so downstream code never branches on format.
`bbox` is None for DOCX (there is no page to have coordinates on) and `page` is
always 1, matching how `loaders.load_document` returns a DOCX as a single
Document rather than one per page.
"""

from __future__ import annotations

import logging
import uuid
import zipfile
from io import BytesIO
from typing import Any
from xml.etree import ElementTree

import pymupdf as fitz  # `fitz` is the deprecated import name for the same package

logger = logging.getLogger(__name__)

PDF_CONTENT_TYPE = "application/pdf"
DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

#: OOXML namespaces needed to walk a .docx body in document order.
#: `r:embed` (DrawingML, modern Word) and `r:id` (VML, images from older Word
#: versions and some converters) both name a relationship rather than a file,
#: which is why the .rels part has to be resolved first.
_NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
_NS_OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_NS_DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main"
_NS_VML = "urn:schemas-microsoft-com:vml"

#: Below this pixel area, an embedded image is almost always a logo, bullet
#: icon, or page-header ornament -- not a figure worth capturing.
_MIN_IMAGE_PIXELS = 120 * 120

#: Padding (in PDF points) added around a figure's bounding box before
#: cropping, so a tight caption sitting just outside the raw image rect isn't
#: cut off.
_CROP_PADDING = 12

#: Render resolution multiplier over the PDF's native 72 DPI. 2x keeps
#: screenshots legible for diagrams with small embedded labels without
#: producing multi-megabyte PNGs for every figure.
_RENDER_ZOOM = 2.0


def _capture_page_images(
    doc: "fitz.Document", page_index: int, source_name: str
) -> list[dict[str, Any]]:
    page = doc[page_index]
    captures = []

    for image_index, image in enumerate(page.get_images(full=True)):
        xref = image[0]
        rects = page.get_image_rects(xref)
        if not rects:
            continue
        rect = rects[0]
        crop = rect + (-_CROP_PADDING, -_CROP_PADDING, _CROP_PADDING, _CROP_PADDING)
        crop = crop & page.rect  # clamp to page bounds

        pixmap = page.get_pixmap(matrix=fitz.Matrix(_RENDER_ZOOM, _RENDER_ZOOM), clip=crop)
        if pixmap.width * pixmap.height < _MIN_IMAGE_PIXELS:
            continue

        captures.append(
            {
                "content": pixmap.tobytes("png"),
                "content_type": "image/png",
                "source_file": source_name,
                "page": page_index + 1,
                "figure_index": image_index,
                "bbox": [crop.x0, crop.y0, crop.x1, crop.y1],
                "width": pixmap.width,
                "height": pixmap.height,
            }
        )

    return captures


def capture_pdf_visuals(content: bytes, source_name: str) -> list[dict[str, Any]]:
    """Extracts one screenshot per embedded figure on every page of a PDF.

    Returns capture dicts still holding raw PNG bytes under `content`; the
    caller (a graph node, with S3 access) uploads and replaces `content` with
    an `s3_key` before this leaves memory for good -- state should carry
    references, not images, for the same reason `document_refs` replaced
    inline file bytes (see `app/graphs/certification/state.py`).
    """
    captures: list[dict[str, Any]] = []
    try:
        with fitz.open(stream=content, filetype="pdf") as doc:
            for page_index in range(doc.page_count):
                try:
                    captures.extend(_capture_page_images(doc, page_index, source_name))
                except Exception:
                    logger.exception(
                        "Failed to capture figures on %s page %d", source_name, page_index + 1
                    )
    except Exception:
        logger.exception("Failed to open %s for figure capture", source_name)
    return captures


def _docx_relationship_targets(archive: zipfile.ZipFile) -> dict[str, str]:
    """Maps each relationship id in `word/document.xml.rels` to its part path.

    Image elements in the body reference a relationship id, never a filename,
    so without this map the document order recovered below cannot be turned
    back into bytes.
    """
    try:
        rels = ElementTree.fromstring(archive.read("word/_rels/document.xml.rels"))
    except KeyError:
        return {}

    targets: dict[str, str] = {}
    for rel in rels.iter(f"{{{_NS_REL}}}Relationship"):
        rel_id = rel.get("Id")
        target = rel.get("Target", "")
        if not rel_id or not target:
            continue
        # External images are a URL, not a part in this archive -- there is
        # nothing to extract and fetching one would reach out to the network
        # mid-ingestion.
        if rel.get("TargetMode") == "External":
            continue
        targets[rel_id] = f"word/{target.lstrip('/').removeprefix('word/')}"
    return targets


def _docx_image_order(archive: zipfile.ZipFile) -> list[str]:
    """Relationship ids of every image in `word/document.xml`, in reading order.

    Order is the only positional signal a .docx offers, and it is what lets a
    captured figure be matched back to the text around it. `iter()` is a
    document-order walk, so DrawingML and VML images interleave correctly
    rather than being grouped by kind.
    """
    try:
        document = ElementTree.fromstring(archive.read("word/document.xml"))
    except KeyError:
        return []

    ordered: list[str] = []
    for element in document.iter():
        if element.tag == f"{{{_NS_DRAWING}}}blip":
            rel_id = element.get(f"{{{_NS_OFFICE_REL}}}embed")
        elif element.tag == f"{{{_NS_VML}}}imagedata":
            rel_id = element.get(f"{{{_NS_OFFICE_REL}}}id")
        else:
            continue
        if rel_id:
            ordered.append(rel_id)
    return ordered


def _to_png(content: bytes) -> "fitz.Pixmap | None":
    """Decodes an embedded image to a PNG-ready pixmap, or None if unreadable.

    Word accepts formats PyMuPDF cannot decode (EMF/WMF vector metafiles being
    the common one in documents converted from older Office versions). Those
    are skipped rather than raising: one unreadable figure must not cost the
    document its other figures.
    """
    try:
        pixmap = fitz.Pixmap(content)
    except Exception:
        return None
    # CMYK and other >3-channel spaces cannot be written as PNG directly.
    if pixmap.colorspace is not None and pixmap.n - pixmap.alpha > 3:
        pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
    return pixmap


def capture_docx_visuals(content: bytes, source_name: str) -> list[dict[str, Any]]:
    """Extracts every embedded figure from a DOCX, in document order.

    Mirrors `capture_pdf_visuals`: same dict shape, same raw-PNG-under-`content`
    contract for the caller to upload and strip.
    """
    captures: list[dict[str, Any]] = []
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            targets = _docx_relationship_targets(archive)
            seen: set[str] = set()

            for rel_id in _docx_image_order(archive):
                part = targets.get(rel_id)
                # A figure reused across the document (a repeated diagram, a
                # header mark) is one figure, not several -- dedupe by part so
                # it is captured and uploaded once.
                if not part or part in seen:
                    continue
                seen.add(part)

                try:
                    raw = archive.read(part)
                except KeyError:
                    logger.warning("%s references missing image part %s", source_name, part)
                    continue

                pixmap = _to_png(raw)
                if pixmap is None:
                    logger.info("Skipped undecodable image %s in %s", part, source_name)
                    continue
                if pixmap.width * pixmap.height < _MIN_IMAGE_PIXELS:
                    continue

                captures.append(
                    {
                        "content": pixmap.tobytes("png"),
                        "content_type": "image/png",
                        "source_file": source_name,
                        # DOCX has no pages until it is laid out; `loaders`
                        # calls the whole file page 1, so visuals agree with it.
                        "page": 1,
                        "figure_index": len(captures),
                        "bbox": None,
                        "width": pixmap.width,
                        "height": pixmap.height,
                    }
                )
    except zipfile.BadZipFile:
        # An upload that is not really a .docx is bad input, not a bug -- log it
        # without a traceback so real failures stay findable in the log.
        logger.warning("%s is not a readable DOCX archive; no figures captured", source_name)
    except Exception:
        logger.exception("Failed to open %s for figure capture", source_name)
    return captures


#: Content type -> capture function. A single table so support for a format is
#: declared in one place: the two membership tests below and the dispatch all
#: read from it, which is what previously let "PDF only" drift between the
#: docstring and three separate `!= PDF_CONTENT_TYPE` checks.
_CAPTURERS = {
    PDF_CONTENT_TYPE: capture_pdf_visuals,
    DOCX_CONTENT_TYPE: capture_docx_visuals,
}


def capture_document_visuals(
    refs: list[dict[str, Any]] | None,
    inline_files: list[dict[str, Any]] | None,
    *,
    certification_id: int | None,
) -> list[dict[str, Any]]:
    """Captures figures from every PDF and DOCX in this run's documents and
    persists each one to S3, returning lightweight refs (never raw bytes) ready
    to sit in graph state.

    Documents in any other format are skipped with a log line rather than
    raising -- losing one file's figures must not fail document ingestion,
    exactly like `load_uploads`/`load_document_refs` skip a single unparseable
    file.
    """
    from app.storage.s3_client import fetch_object_bytes, upload_object_bytes

    raw_documents: list[tuple[bytes, str, str]] = []  # (content, content_type, filename)

    for ref in refs or []:
        content_type = ref.get("content_type", "")
        if content_type not in _CAPTURERS:
            continue
        try:
            raw_documents.append(
                (fetch_object_bytes(ref["s3_key"]), content_type, ref.get("filename", ""))
            )
        except Exception:
            logger.exception("Failed to fetch %s for figure capture", ref.get("s3_key"))

    for file in inline_files or []:
        content_type = file.get("type", "")
        if content_type not in _CAPTURERS:
            continue
        raw_documents.append((file["content"], content_type, file.get("filename", "")))

    visuals: list[dict[str, Any]] = []
    for content, content_type, filename in raw_documents:
        for capture in _CAPTURERS[content_type](content, filename):
            s3_key = f"ai-documents/visuals/{certification_id or 'unscoped'}/{uuid.uuid4()}.png"
            try:
                upload_object_bytes(s3_key, capture.pop("content"), capture.pop("content_type"))
            except Exception:
                logger.exception("Failed to upload captured figure for %s", filename)
                continue
            visuals.append({**capture, "s3_key": s3_key})

    return visuals
