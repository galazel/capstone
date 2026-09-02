"""The structured description a model writes instead of raw mxGraph XML.

The model answers with a `DiagramSpec`: the classes, the relationships, their
kinds and multiplicities. `render` turns that into draw.io XML deterministically
via `mxgraph`, and lays it out on a grid.

The point is what the model is no longer asked to do. It does not escape XML,
allocate cell ids, remember that a composition diamond belongs on the whole, or
place a box so it does not overlap its neighbour. Those are the four things it
reliably got wrong, and none of them is a judgement call -- they are mechanical,
so they belong in code. What is left for the model is the part only it can do:
deciding that a Room cannot outlive its Hotel, and that the relationship is
therefore composition.

It also means a malformed answer fails loudly at parse time, as a Pydantic
validation error naming the bad field, instead of silently producing a document
that opens as an empty canvas.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.domain.diagrams.mxgraph import (
    LEGEND_FOR_TYPE,
    Diagram,
)

#: Relationship notations, in the model's vocabulary rather than draw.io's.
EdgeKind = Literal["association", "aggregation", "composition",
                   "generalisation", "dependency"]

#: Node shapes for process, component and use case diagrams.
NodeShape = Literal["box", "action", "decision", "start", "end", "terminator",
                    "bar", "actor", "usecase", "component", "boundary"]

_EDGE_KIND_TO_STYLE = {
    "association": "assoc",
    "aggregation": "aggr",
    "composition": "comp",
    "generalisation": "gen",
    "dependency": "dep",
}

#: Diagram types drawn as a top-down process rather than a free layout. These
#: read down the page, so the renderer stacks them and puts branch targets to
#: the right instead of using the general grid.
_PROCESS_TYPES = {"ACTIVITY_DIAGRAM", "FLOWCHART"}


class DiagramNode(BaseModel):
    """One box, ellipse, diamond or actor."""

    key: str = Field(description="Short unique id used by edges, e.g. 'hotel'")
    label: str = Field(description="What the node is called, e.g. 'Hotel'")
    lines: list[str] = Field(
        default_factory=list,
        description=(
            "Attribute and operation lines for a class or entity, one per "
            "string, e.g. '- roomId: String' or 'PK hotelId: String' or "
            "'+ isAvailable(): boolean'. Empty for process and use case nodes."
        ),
    )
    shape: NodeShape = Field(
        default="box",
        description=(
            "'box' for a class or entity; 'action'/'decision'/'start'/'end'/"
            "'terminator'/'bar' for process steps; 'actor'/'usecase'/"
            "'boundary' for use case diagrams; 'component' for components."
        ),
    )
    abstract: bool = Field(
        default=False,
        description="True for an abstract class; renders the name in italic.",
    )


class DiagramEdge(BaseModel):
    """One relationship between two nodes."""

    source: str = Field(
        description=(
            "The key of the WHOLE, the PARENT, or the node that DEPENDS. "
            "For composition and aggregation this is the containing side; "
            "for generalisation it is the superclass."
        )
    )
    target: str = Field(
        description=(
            "The key of the PART, the CHILD, or the node depended upon."
        )
    )
    kind: EdgeKind = Field(default="association")
    label: str = Field(
        default="",
        description="Relationship name or guard, e.g. 'owns' or '[yes]'",
    )
    source_multiplicity: str = Field(
        default="",
        description="Multiplicity at the source end: '1', '0..*', '1..*', '0..1'",
    )
    target_multiplicity: str = Field(
        default="",
        description="Multiplicity at the target end: '1', '0..*', '1..*', '0..1'",
    )


class DiagramSpec(BaseModel):
    """The model answer, described rather than drawn."""

    title: str = Field(description="Diagram title, e.g. 'Sunrise Hotels - Class Model'")
    nodes: list[DiagramNode] = Field(min_length=2)
    edges: list[DiagramEdge] = Field(default_factory=list)
    subtitle: Optional[str] = None

    def render(self, diagram_type: str) -> str:
        """Lay the spec out and return draw.io XML."""
        subtitle = self.subtitle or _default_subtitle(diagram_type)
        diagram = Diagram(self.title, subtitle)

        positions = _layout(self.nodes, diagram_type)
        for node in self.nodes:
            x, y, width = positions[node.key]
            if node.shape == "box":
                diagram.node(node.key, node.label, node.lines, x, y, width,
                             abstract=node.abstract)
            elif node.shape == "boundary":
                # A boundary contains the others, so it is sized generously
                # and drawn first-come; overlap here is intended.
                diagram.shape(node.key, node.label, "boundary", x, y, 520, 620)
            elif node.shape == "bar":
                diagram.shape(node.key, "", "bar", x, y, 10, 180)
            else:
                diagram.shape(node.key, node.label, node.shape, x, y, width,
                              _shape_height(node.shape))

        known = {node.key for node in self.nodes}
        for edge in self.edges:
            # Dropped rather than raised on: one edge naming a node that was
            # never declared should not cost the whole reference.
            if edge.source not in known or edge.target not in known:
                continue
            diagram.edge(
                edge.source, edge.target,
                _EDGE_KIND_TO_STYLE[edge.kind],
                edge.label,
                edge.source_multiplicity,
                edge.target_multiplicity,
            )

        entries = LEGEND_FOR_TYPE.get(diagram_type)
        if entries:
            diagram.legend(entries, x=40, y=_legend_y(positions))
        return diagram.xml()


def _default_subtitle(diagram_type: str) -> str:
    readable = diagram_type.replace("_", " ").lower()
    return f"{readable} (model answer)"


def _shape_height(shape: str) -> int:
    if shape == "decision":
        return 90
    if shape in {"start", "end"}:
        return 40
    if shape == "actor":
        return 70
    return 60


def _shape_width(shape: str) -> int:
    if shape in {"start", "end"}:
        return 40
    if shape == "actor":
        return 40
    if shape == "decision":
        return 170
    if shape == "box":
        return 240
    return 200


def _layout(nodes, diagram_type) -> dict[str, tuple[int, int, int]]:
    """Place nodes so nothing overlaps and the diagram reads in its usual direction.

    Process diagrams read top to bottom, so they get a single column with
    decisions' side branches offset to the right. Everything else gets a grid
    wide enough that a class box's attribute list does not run into its
    neighbour.
    """
    positions: dict[str, tuple[int, int, int]] = {}

    if diagram_type in _PROCESS_TYPES:
        y = 100
        for node in nodes:
            width = _shape_width(node.shape)
            positions[node.key] = (120, y, width)
            y += _shape_height(node.shape) + 45
        return positions

    # Grid. Row height follows the tallest box in the row, so a ten-attribute
    # class does not overlap whatever is below it.
    columns = 4 if len(nodes) > 6 else 3
    x_step, y_cursor, row_height, column = 300, 100, 0, 0
    for node in nodes:
        width = _shape_width(node.shape)
        if node.shape == "boundary":
            positions[node.key] = (340, 90, width)
            continue
        height = 34 + 15 * len(node.lines) if node.shape == "box" \
            else _shape_height(node.shape)
        positions[node.key] = (40 + column * x_step, y_cursor, width)
        row_height = max(row_height, height)
        column += 1
        if column >= columns:
            column, y_cursor, row_height = 0, y_cursor + row_height + 60, 0
    return positions


def _legend_y(positions) -> int:
    """Below everything else, so the key never sits on top of the model."""
    if not positions:
        return 100
    return max(y for _, y, _ in positions.values()) + 220
