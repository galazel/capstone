"""Figure capture out of source documents.

The DOCX path is the one worth testing hard. PDF figures are rendered from page
geometry, which PyMuPDF is responsible for; DOCX figures are recovered by
walking OOXML by hand, so the parts that can silently go wrong -- reading order,
relationship resolution, reused images, formats Word accepts but PyMuPDF cannot
decode -- are this module's own logic rather than a library's.

Documents are built in-memory rather than committed as binary fixtures, so what
each test exercises is visible in the test itself.
"""

from __future__ import annotations

import io
import zipfile

import pymupdf as fitz
import pytest

from app.rag.visuals import (
    DOCX_CONTENT_TYPE,
    PDF_CONTENT_TYPE,
    _CAPTURERS,
    capture_docx_visuals,
    capture_pdf_visuals,
)

_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def _png(width: int, height: int, colour: tuple[int, int, int] = (200, 40, 90)) -> bytes:
    pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, width, height))
    pixmap.set_rect(pixmap.irect, colour)
    return pixmap.tobytes("png")


def _drawingml(rel_id: str) -> str:
    """One inline DrawingML image -- what modern Word writes."""
    return (
        f'<w:p><w:r><w:drawing><wp:inline><a:blip xmlns:a='
        f'"http://schemas.openxmlformats.org/drawingml/2006/main" '
        f'r:embed="{rel_id}"/></wp:inline></w:drawing></w:r></w:p>'
    )


def _vml(rel_id: str) -> str:
    """One VML image -- what older Word and some converters still write."""
    return (
        f'<w:p><w:r><w:pict><v:shape><v:imagedata r:id="{rel_id}"/>'
        f"</v:shape></w:pict></w:r></w:p>"
    )


def _docx(body: str, relationships: str, media: dict[str, bytes]) -> bytes:
    document = (
        '<?xml version="1.0"?><w:document xmlns:w="w" xmlns:wp="wp" '
        'xmlns:v="urn:schemas-microsoft-com:vml" '
        f'xmlns:r="{_REL_NS}"><w:body>{body}</w:body></w:document>'
    )
    rels = (
        '<?xml version="1.0"?><Relationships xmlns='
        '"http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{relationships}</Relationships>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", document)
        archive.writestr("word/_rels/document.xml.rels", rels)
        for name, content in media.items():
            archive.writestr(f"word/media/{name}", content)
    return buffer.getvalue()


def _rel(rel_id: str, target: str, external: bool = False) -> str:
    mode = ' TargetMode="External"' if external else ""
    return f'<Relationship Id="{rel_id}" Target="{target}"{mode}/>'


def test_docx_captures_embedded_figure_with_dimensions():
    docx = _docx(
        _drawingml("rId1"),
        _rel("rId1", "media/image1.png"),
        {"image1.png": _png(400, 300)},
    )

    captures = capture_docx_visuals(docx, "sample.docx")

    assert len(captures) == 1
    capture = captures[0]
    assert capture["width"] == 400
    assert capture["height"] == 300
    assert capture["content_type"] == "image/png"
    assert capture["source_file"] == "sample.docx"
    # A DOCX has no pages until layout, and `loaders` calls the whole file page
    # 1 -- visuals must agree or a figure cannot be tied back to its text.
    assert capture["page"] == 1
    assert capture["bbox"] is None


def test_docx_deduplicates_a_reused_image():
    """A figure placed twice is one figure, not two uploads."""
    docx = _docx(
        _drawingml("rId1") + _drawingml("rId1"),
        _rel("rId1", "media/image1.png"),
        {"image1.png": _png(400, 300)},
    )

    assert len(capture_docx_visuals(docx, "repeat.docx")) == 1


def test_docx_skips_images_below_the_figure_size_floor():
    """Logos and bullet icons are embedded images too, and are not figures."""
    docx = _docx(
        _drawingml("rId1") + _drawingml("rId2"),
        _rel("rId1", "media/figure.png") + _rel("rId2", "media/icon.png"),
        {"figure.png": _png(400, 300), "icon.png": _png(40, 40)},
    )

    captures = capture_docx_visuals(docx, "mixed.docx")

    assert [c["width"] for c in captures] == [400]


def test_docx_reads_vml_images_from_older_word():
    docx = _docx(
        _vml("rId1"),
        _rel("rId1", "media/image1.png"),
        {"image1.png": _png(400, 300)},
    )

    assert len(capture_docx_visuals(docx, "legacy.docx")) == 1


def test_docx_preserves_reading_order_across_drawingml_and_vml():
    """Order is the only positional signal a .docx offers, so a mixed document
    must not group by element kind -- that would misalign every figure after
    the first VML image."""
    docx = _docx(
        _drawingml("rId1") + _vml("rId2") + _drawingml("rId3"),
        _rel("rId1", "media/a.png") + _rel("rId2", "media/b.png") + _rel("rId3", "media/c.png"),
        {"a.png": _png(400, 300), "b.png": _png(410, 300), "c.png": _png(420, 300)},
    )

    captures = capture_docx_visuals(docx, "mixed.docx")

    assert [c["width"] for c in captures] == [400, 410, 420]
    assert [c["figure_index"] for c in captures] == [0, 1, 2]


def test_docx_ignores_externally_linked_images():
    """An external image is a URL, not a part. Fetching one would reach the
    network mid-ingestion, so it is not a figure this can capture."""
    docx = _docx(
        _drawingml("rId1"),
        _rel("rId1", "https://example.invalid/figure.png", external=True),
        {},
    )

    assert capture_docx_visuals(docx, "linked.docx") == []


def test_docx_survives_a_missing_or_undecodable_part():
    """One bad figure must not cost the document its good ones."""
    docx = _docx(
        _drawingml("rId1") + _drawingml("rId2") + _drawingml("rId3"),
        _rel("rId1", "media/good.png")
        + _rel("rId2", "media/absent.png")
        + _rel("rId3", "media/vector.emf"),
        {"good.png": _png(400, 300), "vector.emf": b"not a decodable image"},
    )

    captures = capture_docx_visuals(docx, "damaged.docx")

    assert len(captures) == 1
    assert captures[0]["width"] == 400


@pytest.mark.parametrize("content", [b"", b"this is not a zip archive"])
def test_docx_capture_returns_empty_for_unreadable_upload(content):
    """Bad input is skipped, never raised -- losing figures must not fail the
    whole ingestion run."""
    assert capture_docx_visuals(content, "junk.docx") == []


def test_pdf_capture_still_reports_page_geometry():
    """The PDF path is crop-based, so unlike DOCX it must carry a real bbox."""
    pdf = fitz.open()
    page = pdf.new_page()
    pixmap = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 400, 300))
    pixmap.set_rect(pixmap.irect, (200, 40, 90))
    page.insert_image(fitz.Rect(50, 50, 450, 350), pixmap=pixmap)

    captures = capture_pdf_visuals(pdf.tobytes(), "sample.pdf")

    assert len(captures) == 1
    assert captures[0]["page"] == 1
    assert captures[0]["bbox"] is not None


def test_both_formats_are_dispatchable():
    """Format support is declared once; the dispatcher is what ingestion reads,
    so a capturer that exists but is unregistered would never run."""
    assert set(_CAPTURERS) == {PDF_CONTENT_TYPE, DOCX_CONTENT_TYPE}
