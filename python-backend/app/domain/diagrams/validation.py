"""Check a reference diagram before it is stored.

A reference is shown to a learner as the correct answer and is what the grader
compares their drawing against, so a bad one is worse than none: it marks good
work wrong and teaches the wrong notation. Everything here is cheap and
mechanical, and each check corresponds to a way references have actually been
broken:

  parses            unescaped HTML in a label made all 106 references on the
                    first certification open as an empty canvas
  no dangling ends  an edge naming a cell that was never written draws nothing
  has substance     a two-box answer is not full marks on a professional paper
  labelled nodes    the grader compares labels, so a blank box grades nothing
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass, field

#: Mirrors Java's `DiagramGraphExtractor.isTextOnlyCell`. A labelled vertex
#: becomes a REQUIRED element in the mark scheme unless its style marks it
#: text-only, so annotations that are not part of the answer -- the legend, the
#: multiplicity labels -- must carry it or the learner is marked down for not
#: reproducing them.
_TEXT_ONLY_KEYS = ("text=1", "shape=label", "shape=text")

#: Mirrors Java's `DiagramGradingService.CARDINALITY`. Cardinality is graded
#: only where the EDGE'S OWN value carries one of these; multiplicity living
#: only in child label cells is invisible to the grader.
_CARDINALITY = re.compile(
    r"(?:^|\s)(0\.\.1|1\.\.1|0\.\.\*|1\.\.\*|0\.\.n|1\.\.n|1\.\.m|\*|n|m)(?:\s|$)"
)

#: A professional-scale model answer. Below this the reference is not wrong,
#: it is merely thin -- which on a certification paper is its own failure.
MIN_LABELLED_VERTICES = 4
MIN_EDGES = 3


@dataclass
class DiagramCheck:
    """Why a reference was or was not accepted."""

    ok: bool
    problems: list[str] = field(default_factory=list)
    labelled_vertices: int = 0
    edges: int = 0

    @property
    def summary(self) -> str:
        return "; ".join(self.problems) if self.problems else "ok"


def check_reference(xml: str | None) -> DiagramCheck:
    """Structural check on reference mxGraph XML."""
    text = (xml or "").strip()
    if not text:
        return DiagramCheck(False, ["empty"])
    if "<mxGraphModel" not in text:
        return DiagramCheck(False, ["not an mxGraphModel"])

    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        return DiagramCheck(False, [f"does not parse as XML: {error}"])

    cells = list(root.iter("mxCell"))
    ids = {cell.get("id") for cell in cells}
    problems: list[str] = []

    dangling = [
        cell.get("id") for cell in cells
        if (cell.get("source") and cell.get("source") not in ids)
        or (cell.get("target") and cell.get("target") not in ids)
    ]
    if dangling:
        problems.append(
            "edges point at cells that do not exist: " + ", ".join(filter(None, dangling))
        )

    # Counted the way the grader counts them: an annotation carrying text=1 is
    # not a required element, and everything else labelled is.
    graded_vertices = [
        cell for cell in cells
        if cell.get("vertex")
        and (cell.get("value") or "").strip()
        and not _is_text_only(cell.get("style"))
    ]
    labelled = len(graded_vertices)
    edge_cells = [cell for cell in cells if cell.get("edge")]
    edges = len(edge_cells)

    # Annotations that would be marked as answer elements. This is how the
    # legend and every multiplicity label ended up in the mark scheme.
    stray = [
        (cell.get("value") or "").strip()[:30] for cell in graded_vertices
        if _CARDINALITY.fullmatch((cell.get("value") or "").strip())
        or (cell.get("value") or "").strip().lower().startswith("&lt;b&gt;legend")
    ]
    if stray:
        problems.append(
            "annotation cells would be graded as required elements: "
            + ", ".join(stray)
        )

    if labelled < MIN_LABELLED_VERTICES:
        problems.append(
            f"only {labelled} labelled nodes; a model answer needs at least "
            f"{MIN_LABELLED_VERTICES}"
        )
    if edges < MIN_EDGES:
        problems.append(
            f"only {edges} relationships; a model answer needs at least {MIN_EDGES}"
        )

    return DiagramCheck(not problems, problems, labelled, edges)


def _parse_style(style: str | None) -> dict[str, str]:
    """Mirrors Java's `DiagramGraphExtractor.parseStyle`.

    A bare key is truthy: `text;html=1` means text=1. Substring matching gets
    this wrong in both directions, which matters because the answer decides
    whether a cell is part of the mark scheme.
    """
    parsed: dict[str, str] = {}
    for part in (style or "").split(";"):
        if not part.strip():
            continue
        key, _, value = part.partition("=")
        key = key.strip()
        if key:
            parsed[key] = value or "1"
    return parsed


def _is_text_only(style: str | None) -> bool:
    parsed = _parse_style(style)
    return parsed.get("text") == "1" or parsed.get("shape") in {"label", "text"}


def graded_shape(xml: str) -> tuple[list[str], list[str]]:
    """What the grader will actually require: element labels, and edge labels.

    Exposed so the shape of a reference can be asserted in a test rather than
    inferred, and so an admin previewing an item can be shown the mark scheme
    it will really be graded against.
    """
    root = ElementTree.fromstring(xml)
    cells = list(root.iter("mxCell"))
    nodes = [
        _clean(cell.get("value")) for cell in cells
        if cell.get("vertex")
        and cell.get("id") not in {"0", "1"}
        and (cell.get("value") or "").strip()
        and not _is_text_only(cell.get("style"))
    ]
    edges = [_clean(cell.get("value")) for cell in cells if cell.get("edge")]
    return nodes, edges


def _clean(value: str | None) -> str:
    """Mirrors Java's `cleanLabel`: strip tags, collapse whitespace."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", value or "")).strip()
