"""Render draw.io/mxGraph XML from a declarative description.

Models are poor at emitting mxGraph directly. Asked for raw XML they produce
documents that do not parse, edges pointing at cells that were never written,
and -- worst, because it is invisible -- notation that is confidently wrong:
the composition diamond drawn on the part instead of the whole, the
generalisation triangle on the subclass instead of the superclass. A reference
answer that says the opposite of the truth is worse than none, because a
learner is shown it as correct.

So the model does not write XML here. It describes the model -- these classes,
these relationships, this kind, these multiplicities -- and this module renders
it. Everything that can be got wrong mechanically is then got right by
construction: escaping, cell ids, arrow ends, notation.

Relationship kinds carry the notation an examiner marks:
    "comp"  composition    filled diamond   -- the part dies with the whole
    "aggr"  aggregation    hollow diamond   -- the part survives
    "gen"   generalisation hollow triangle  -- "is a"
    "assoc" association    plain line
    "dep"   dependency     dashed open arrow
"""

from __future__ import annotations

from xml.sax.saxutils import escape


def html_label(value: str) -> str:
    """Plain text -> an HTML label body, newlines becoming line breaks."""
    return escape(value or "").replace("\n", "<br>")


def attr(body: str) -> str:
    """HTML label body -> a value safe inside an XML attribute.

    Double escaping is correct here, not a bug. There are two layers: draw.io
    unescapes the attribute to recover the HTML, then renders that HTML. Emit
    a raw `<b>` and the document is not well-formed XML and opens as a blank
    canvas -- which is precisely how the first hundred references were lost.
    """
    return escape(body or "", {'"': "&quot;"})


#: Every edge is written edge(whole, part) / edge(parent, child), so the
#: decorated end is the SOURCE. That means startArrow, not endArrow: UML puts
#: the diamond on the whole and the hollow triangle on the superclass. A
#: diamond drawn on the part states the opposite of what the question asks.
STYLES = {
    "comp": "startArrow=diamond;startFill=1;startSize=18;endArrow=none;html=1;rounded=0;",
    "aggr": "startArrow=diamond;startFill=0;startSize=18;endArrow=none;html=1;rounded=0;",
    "gen": "startArrow=block;startFill=0;startSize=12;endArrow=none;html=1;rounded=0;",
    "assoc": "endArrow=none;html=1;rounded=0;",
    "dep": "endArrow=open;dashed=1;html=1;rounded=0;",
}

BOX = ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;align=left;"
       "spacingLeft=6;spacingTop=2;fontSize=11;")

#: draw.io's own UML class shape. The cell's value is the class NAME only,
#: which is what the grader matches on; members go in child cells.
CLASS_BOX = ("swimlane;html=1;startSize=26;fontSize=12;fontStyle=1;align=center;"
             "verticalAlign=middle;horizontal=1;whiteSpace=wrap;")

#: A member line. `text=1` keeps it out of the mark scheme -- attributes are
#: shown to the learner but graded through their class, not as elements of
#: their own.
MEMBER_LINE = ("text;html=1;strokeColor=none;fillColor=none;align=left;"
               "verticalAlign=middle;spacingLeft=6;fontSize=11;")

#: Process and structural notation. A decision drawn as a rectangle is not a
#: decision: the shape IS the answer to part of the question, so it cannot be
#: left to whatever the model happened to type into a style string.
SHAPES = {
    "action": "rounded=1;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontSize=11;",
    "decision": "rhombus;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontSize=10;",
    "start": ("ellipse;whiteSpace=wrap;html=1;align=center;fillColor=#000000;"
              "fontColor=#ffffff;fontSize=10;"),
    "end": "ellipse;shape=endState;whiteSpace=wrap;html=1;align=center;fontSize=10;",
    "terminator": "shape=terminator;whiteSpace=wrap;html=1;align=center;fontSize=11;",
    "bar": "shape=line;direction=south;strokeWidth=6;html=1;",
    "data": ("shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;"
             "html=1;fontSize=10;"),
    "actor": "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fontSize=10;",
    "usecase": "ellipse;whiteSpace=wrap;html=1;align=center;fontSize=11;",
    "component": ("shape=component;align=left;spacingLeft=28;whiteSpace=wrap;html=1;"
                  "verticalAlign=top;fontSize=11;"),
    "lifeline": ("shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;"
                 "container=1;collapsible=0;recursiveResize=0;outlineConnect=0;fontSize=11;"),
    "provided": ("shape=providedRequiredInterface;html=1;verticalLabelPosition=bottom;"
                 "verticalAlign=top;fontSize=10;"),
    "required": ("shape=requiredInterface;html=1;verticalLabelPosition=bottom;"
                 "verticalAlign=top;fontSize=10;"),
    "package": ("shape=folder;tabWidth=70;tabHeight=20;tabPosition=left;html=1;"
                "verticalAlign=top;align=left;spacingLeft=8;fontSize=11;"),
    # The system boundary is the point of a use case diagram: it says which
    # actors are outside the system and which behaviour is inside it.
    "boundary": ("rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;align=center;"
                 "fillColor=none;fontSize=13;fontStyle=1;spacingTop=4;"),
}

TITLE = "text;html=1;fontSize=16;fontStyle=1;align=left;verticalAlign=middle;"
SUB = "text;html=1;fontSize=10;align=left;verticalAlign=middle;fontColor=#666666;"
#: `text=1` is not cosmetic. The grader's extractor treats any labelled vertex
#: as a required element unless the style marks it text-only, so without it the
#: legend becomes a node the learner is required to reproduce -- and is marked
#: down for missing.
NOTE = ("shape=note;whiteSpace=wrap;html=1;fontSize=10;align=left;"
        "verticalAlign=top;spacingLeft=6;size=14;text=1;")

#: Same reason, and the worse case: every multiplicity is a vertex, so a class
#: diagram with nine relationships added eighteen phantom "1" and "0..*" nodes
#: to the mark scheme.
EDGE_LABEL = ("edgeLabel;html=1;align=center;verticalAlign=middle;fontSize=10;"
              "text=1;")

UML_LEGEND = [
    "filled diamond = composition (part dies with the whole)",
    "hollow diamond = aggregation (part survives)",
    "hollow triangle = generalisation (is-a)",
    "plain line = association",
    "italic name = abstract class",
]

ERD_LEGEND = [
    "PK = primary key, FK = foreign key",
    "1 / 0..* / 1..* = cardinality at that end",
    "filled diamond = identifying (weak entity)",
    "plain line = non-identifying relationship",
]

PROCESS_LEGEND = [
    "stadium = start / end",
    "rounded box = action or process step",
    "rhombus = decision, every branch carries its guard",
    "thick bar = fork / join (concurrent paths)",
]

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
]

SEQUENCE_LEGEND = [
    "solid arrow = synchronous call",
    "dashed arrow = return",
    "open arrow = asynchronous message",
    "alt / loop box = combined fragment, guard in brackets",
]

USECASE_LEGEND = [
    "stick figure = actor, outside the system",
    "ellipse = use case, inside the boundary",
    "rectangle = system boundary",
    "dashed arrow marked <<include>> = always performed",
    "dashed arrow marked <<extend>> = performed conditionally",
]

#: The legend that explains the notation each diagram type actually uses.
LEGEND_FOR_TYPE = {
    "UML_CLASS": UML_LEGEND,
    "ERD": ERD_LEGEND,
    "UML_COMPONENT": COMPONENT_LEGEND,
    "SEQUENCE_DIAGRAM": SEQUENCE_LEGEND,
    "USE_CASE": USECASE_LEGEND,
    "ACTIVITY_DIAGRAM": PROCESS_LEGEND,
    "FLOWCHART": PROCESS_LEGEND,
}


class Diagram:
    """Accumulates cells and renders the mxGraphModel."""

    def __init__(self, title: str, subtitle: str = ""):
        self.cells: list[str] = []
        self.next_id = 2
        self.ids: dict[str, str] = {}
        self.x_of: dict[str, int] = {}
        self._text(title, 40, 20, 700, 30, TITLE)
        if subtitle:
            self._text(subtitle, 40, 48, 700, 18, SUB)

    def _new_id(self) -> str:
        value = str(self.next_id)
        self.next_id += 1
        return value

    def _text(self, value, x, y, w, h, style):
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="1">'
            '<mxGeometry x="%d" y="%d" width="%d" height="%d" as="geometry"/></mxCell>'
            % (self._new_id(), attr(html_label(value)), style, x, y, w, h))

    def node(self, key, title, lines=(), x=0, y=0, w=210, abstract=False):
        """A class or entity: name in the cell, members in compartments below.

        The members are CHILD cells rather than more text in the parent's
        label, and that is a grading decision, not a cosmetic one. The grader
        matches nodes by comparing labels, so folding the attribute list into
        the label means a learner who writes `Hotel` is compared against
        `Hotel - hotelId: String - name: String ...` and scores 0.61 -- a WEAK
        match worth 40% -- while a learner who writes their own attributes
        scores zero. Name in the value, members in `text;` children that the
        extractor skips, and the same answer matches exactly.
        """
        name = escape(title or "")
        if abstract:
            name = "<i>%s</i>" % name
        header = 26
        height = header + 15 * len(lines) + (6 if lines else 0)
        cell_id = self._new_id()
        self.ids[key] = cell_id
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="1">'
            '<mxGeometry x="%d" y="%d" width="%d" height="%d" as="geometry"/></mxCell>'
            % (cell_id, attr(name), CLASS_BOX, x, y, w, height))
        for index, line in enumerate(lines):
            self.cells.append(
                '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="%s">'
                '<mxGeometry y="%d" width="%d" height="15" as="geometry"/></mxCell>'
                % (self._new_id(), attr(escape(line)), MEMBER_LINE, cell_id,
                   header + index * 15, w))

    def shape(self, key, label, kind, x=0, y=0, w=160, h=60):
        """A node whose OUTLINE carries meaning: decision, terminator, actor.

        Separate from `node` because a decision is a rhombus and a terminator
        is a stadium; drawing either as a rectangle loses the notation mark the
        question is asking the learner for.
        """
        cell_id = self._new_id()
        self.ids[key] = cell_id
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="1">'
            '<mxGeometry x="%d" y="%d" width="%d" height="%d" as="geometry"/></mxCell>'
            % (cell_id, attr(html_label(label)), SHAPES[kind], x, y, w, h))

    def flow(self, a, b, guard=""):
        """A directed control-flow arrow, with its guard where it has one."""
        self.cells.append(
            '<mxCell id="%s" value="%s" style="endArrow=block;endFill=1;html=1;rounded=0;" '
            'edge="1" parent="1" source="%s" target="%s">'
            '<mxGeometry relative="1" as="geometry"/></mxCell>'
            % (self._new_id(), attr(html_label(guard)), self.ids[a], self.ids[b]))

    def lifeline(self, key, label, x, y=100, w=150, h=760):
        """A sequence-diagram participant: head box plus its dashed lifeline."""
        cell_id = self._new_id()
        self.ids[key] = cell_id
        self.x_of[key] = x + w // 2
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="1">'
            '<mxGeometry x="%d" y="%d" width="%d" height="%d" as="geometry"/></mxCell>'
            % (cell_id, attr(html_label(label)), SHAPES["lifeline"], x, y, w, h))

    def msg(self, a, b, label, y, kind="call"):
        """A message between two lifelines at a fixed vertical position.

        Anchored on explicit points rather than on the lifeline cells: an edge
        routed to a cell attaches to the head box, which stacks every message
        at the top of the diagram and destroys the ordering the question is
        entirely about.
        """
        style = {
            "call": "html=1;endArrow=block;endFill=1;rounded=0;",
            "return": "html=1;endArrow=open;endFill=0;dashed=1;rounded=0;",
            "async": "html=1;endArrow=open;endFill=0;rounded=0;",
        }[kind]
        x1, x2 = self.x_of[a], self.x_of[b]
        if a == b:  # self-call: a small loop back into the same lifeline
            self.cells.append(
                '<mxCell id="%s" value="%s" style="%s" edge="1" parent="1">'
                '<mxGeometry relative="1" as="geometry">'
                '<mxPoint x="%d" y="%d" as="sourcePoint"/>'
                '<mxPoint x="%d" y="%d" as="targetPoint"/>'
                '<Array as="points"><mxPoint x="%d" y="%d"/><mxPoint x="%d" y="%d"/></Array>'
                '</mxGeometry></mxCell>'
                % (self._new_id(), attr(html_label(label)), style, x1, y, x1, y + 40,
                   x1 + 70, y, x1 + 70, y + 40))
            return
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" edge="1" parent="1">'
            '<mxGeometry relative="1" as="geometry">'
            '<mxPoint x="%d" y="%d" as="sourcePoint"/>'
            '<mxPoint x="%d" y="%d" as="targetPoint"/></mxGeometry></mxCell>'
            % (self._new_id(), attr(html_label(label)), style, x1, y, x2, y))

    def frame(self, label, x, y, w, h):
        """A combined fragment box -- alt, loop, opt -- with its operator."""
        self.cells.append(
            # A 60px label corner wraps "alt [stock available]" into unreadable
            # slivers; the operator and its guard have to fit on one line.
            '<mxCell id="%s" value="%s" style="shape=umlFrame;whiteSpace=wrap;html=1;'
            'width=230;height=24;fontSize=10;align=left;verticalAlign=top;fillColor=none;" '
            'vertex="1" parent="1"><mxGeometry x="%d" y="%d" width="%d" height="%d" '
            'as="geometry"/></mxCell>'
            % (self._new_id(), attr(html_label(label)), x, y, w, h))

    def edge(self, a, b, kind="assoc", label="", src_mult="", dst_mult=""):
        """A relationship, with multiplicity written at BOTH ends.

        The multiplicity goes in two places, deliberately. The child cells at
        each end are what a reader sees. The target multiplicity is ALSO folded
        into the edge's own value, because that is the only place the grader
        looks for a cardinality token -- with it in child cells alone,
        cardinality silently went ungraded, which on these questions is most of
        the mark.
        """
        edge_id = self._new_id()
        value = " ".join(part for part in (label, dst_mult) if part).strip()
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" edge="1" parent="1" source="%s" '
            'target="%s"><mxGeometry relative="1" as="geometry"/></mxCell>'
            % (edge_id, attr(html_label(value)), STYLES[kind], self.ids[a], self.ids[b]))
        # Nudged in from the ends and pushed off the line: at -0.75 the source
        # multiplicity sits exactly under the composition diamond and vanishes.
        for mult, xpos in ((src_mult, -0.62), (dst_mult, 0.62)):
            if not mult:
                continue
            self.cells.append(
                '<mxCell id="%s" value="%s" style="%s" vertex="1" connectable="0" '
                'parent="%s"><mxGeometry x="%s" relative="1" as="geometry">'
                '<mxPoint x="14" y="-10" as="offset"/></mxGeometry></mxCell>'
                % (self._new_id(), attr(html_label(mult)), EDGE_LABEL, edge_id, xpos))

    def legend(self, entries, x=40, y=None):
        """A key to the notation, so the diagram explains its own symbols."""
        text = "<b>Legend</b><br/>" + "<br/>".join(escape(e) for e in entries)
        self.cells.append(
            '<mxCell id="%s" value="%s" style="%s" vertex="1" parent="1">'
            '<mxGeometry x="%d" y="%d" width="260" height="%d" as="geometry"/></mxCell>'
            % (self._new_id(), attr(text), NOTE, x, y or 40, 34 + 15 * len(entries)))

    def xml(self) -> str:
        return ('<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" page="1" '
                'pageWidth="1600" pageHeight="1100"><root>'
                '<mxCell id="0"/><mxCell id="1" parent="0"/>'
                + "".join(self.cells) + "</root></mxGraphModel>")
