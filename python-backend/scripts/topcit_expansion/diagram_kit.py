"""A tiny SVG diagram kit, so lesson figures stop being other people's URLs.

Every picture in the hand-written TOPCIT lessons was a hotlink, and every one
of them broke: the host 403s embedding. Searching for replacements only moves
the problem -- the next host can withdraw just as easily, the licence is never
actually checked, and a keyword search will cheerfully return a photograph of
Elizabeth Stride's grave for a lesson on STRIDE threat modelling.

Drawing them here removes all three failure modes at once. The figures cannot
rot, need no credits and no attribution, and are guaranteed to depict the thing
the section is about, because we decide what they contain.

The kit is deliberately small: a handful of archetypes that between them cover
what these lessons actually need to show -- layered stacks, left-to-right
flows, cycles, side-by-side comparisons, tables, hub-and-spoke and tiered
topologies, split-field bit layouts and a recovery timeline. Colours are the
REBYU tokens so the figures sit inside the lesson rather than on top of it.
"""

INK = "#4b4b4b"        # rb-eel
MUTED = "#777777"      # rb-wolf
FAINT = "#afafaf"      # rb-hare
LINE = "#e5e5e5"       # rb-swan
BLUE = "#1cb0f6"       # rb-macaw
DEEP = "#1b6ef3"       # rb-feather
RED = "#ff4b4b"        # rb-cardinal
ORANGE = "#ff9600"     # rb-fox
TEAL = "#00b8d4"       # rb-bee
PAPER = "#ffffff"
WASH = "#f7f9fc"

FONT = ("system-ui, -apple-system, 'Segoe UI', Nunito, "
        "'Helvetica Neue', Arial, sans-serif")

WIDTH = 900


def _escape(text):
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def text(x, y, body, size=14, weight=400, fill=INK, anchor="start", opacity=None):
    extra = ' opacity="%s"' % opacity if opacity else ""
    return ('<text x="%s" y="%s" font-size="%s" font-weight="%s" fill="%s" '
            'text-anchor="%s"%s>%s</text>'
            % (x, y, size, weight, fill, anchor, extra, _escape(body)))


def wrap(body, lines, x, y, size, weight, fill, anchor, line_height):
    out = []
    for index, line in enumerate(lines):
        out.append(text(x, y + index * line_height, line, size, weight, fill, anchor))
    return "".join(out)


def split_words(body, per_line):
    """Naive greedy wrap -- labels here are short, so character count is enough."""
    words, lines, current = str(body).split(), [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if len(candidate) > per_line and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def box(x, y, w, h, fill=PAPER, stroke=LINE, radius=12, stroke_width=2):
    return ('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" '
            'stroke="%s" stroke-width="%s"/>' % (x, y, w, h, radius, fill, stroke, stroke_width))


def label_box(x, y, w, h, title, subtitle=None, fill=PAPER, stroke=LINE, accent=None):
    parts = [box(x, y, w, h, fill, stroke)]
    if accent:
        parts.append('<rect x="%s" y="%s" width="6" height="%s" rx="3" fill="%s"/>'
                     % (x, y + 10, h - 20, accent))
    cx = x + w / 2
    title_lines = split_words(title, max(10, int(w / 8)))
    if subtitle:
        sub_lines = split_words(subtitle, max(14, int(w / 6.2)))
        block = len(title_lines) * 17 + len(sub_lines) * 14
        top = y + (h - block) / 2 + 13
        parts.append(wrap(None, title_lines, cx, top, 14, 700, INK, "middle", 17))
        parts.append(wrap(None, sub_lines, cx, top + len(title_lines) * 17 + 2,
                          12, 400, MUTED, "middle", 14))
    else:
        top = y + (h - len(title_lines) * 17) / 2 + 13
        parts.append(wrap(None, title_lines, cx, top, 14, 700, INK, "middle", 17))
    return "".join(parts)


def arrow(x1, y1, x2, y2, colour=FAINT, dashed=False, width=2):
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    return ('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s '
            'marker-end="url(#tip)"/>' % (x1, y1, x2, y2, colour, width, dash))


def plain_line(x1, y1, x2, y2, colour=LINE, dashed=False, width=2):
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    return ('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>'
            % (x1, y1, x2, y2, colour, width, dash))


def render(height, body, title, caption=None):
    head = text(28, 40, title, 19, 800, INK)
    sub = text(28, 62, caption, 13, 400, MUTED) if caption else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
        'width="%d" height="%d" font-family="%s" role="img" aria-label="%s">'
        '<defs><marker id="tip" viewBox="0 0 10 10" refX="9" refY="5" '
        'markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        '<path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker></defs>'
        '<rect width="%d" height="%d" fill="%s"/>%s%s%s</svg>'
        % (WIDTH, height, WIDTH, height, FONT, _escape(title), FAINT,
           WIDTH, height, PAPER, head, sub, body)
    )


# --------------------------------------------------------------------------
# Archetypes
# --------------------------------------------------------------------------

def stack(title, layers, caption=None, numbered=True, right_note=None):
    """Vertical layered model -- OSI, a policy hierarchy, architecture tiers."""
    top, row, gap = 88, 46, 8
    body, y = [], top
    label_width = 640 if right_note else 780
    for index, layer in enumerate(layers):
        name, note = (layer if isinstance(layer, (list, tuple)) else (layer, None))
        shade = [BLUE, DEEP, TEAL][index % 3]
        body.append(box(28, y, label_width, row, WASH, LINE))
        body.append('<rect x="28" y="%s" width="6" height="%s" rx="3" fill="%s"/>'
                    % (y, row, shade))
        if numbered:
            body.append('<circle cx="62" cy="%s" r="14" fill="%s"/>' % (y + row / 2, shade))
            body.append(text(62, y + row / 2 + 5, len(layers) - index, 13, 800, PAPER, "middle"))
            body.append(text(88, y + row / 2 + 5, name, 14, 700, INK))
        else:
            body.append(text(50, y + row / 2 + 5, name, 14, 700, INK))
        if note:
            body.append(text(label_width + 16, y + row / 2 + 5, note, 12, 400, MUTED, "end"))
        y += row + gap
    if right_note:
        body.append(box(688, top, 184, y - top - gap, PAPER, LINE))
        lines = split_words(right_note, 26)
        body.append(wrap(None, lines, 780, top + 26, 12, 400, MUTED, "middle", 16))
    return render(y + 16, "".join(body), title, caption)


def flow(title, steps, caption=None, note=None):
    """Left-to-right pipeline with arrows between stages."""
    top = 92
    count = len(steps)
    gap = 26
    width = (WIDTH - 56 - gap * (count - 1)) / count
    height = 86
    body = []
    for index, step in enumerate(steps):
        name, sub = (step if isinstance(step, (list, tuple)) else (step, None))
        x = 28 + index * (width + gap)
        accent = [BLUE, TEAL, DEEP, ORANGE][index % 4]
        body.append(label_box(x, top, width, height, name, sub, PAPER, LINE, accent))
        if index < count - 1:
            body.append(arrow(x + width + 5, top + height / 2,
                              x + width + gap - 5, top + height / 2))
    bottom = top + height
    if note:
        body.append(box(28, bottom + 20, WIDTH - 56, 46, WASH, LINE))
        body.append(text(WIDTH / 2, bottom + 48, note, 12.5, 400, MUTED, "middle"))
        bottom += 66
    return render(bottom + 24, "".join(body), title, caption)


def cycle(title, steps, caption=None, centre=None):
    """Closed loop of stages, drawn as a ring."""
    import math
    cx, cy, radius = WIDTH / 2, 250, 150
    body = []
    count = len(steps)
    positions = []
    for index in range(count):
        angle = -math.pi / 2 + index * 2 * math.pi / count
        positions.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))

    for index in range(count):
        x1, y1 = positions[index]
        x2, y2 = positions[(index + 1) % count]
        dx, dy = x2 - x1, y2 - y1
        length = max((dx * dx + dy * dy) ** 0.5, 1)
        pad = 62
        body.append(arrow(x1 + dx / length * pad, y1 + dy / length * pad,
                          x2 - dx / length * pad, y2 - dy / length * pad, FAINT))

    if centre:
        body.append('<circle cx="%s" cy="%s" r="62" fill="%s" stroke="%s" stroke-width="2"/>'
                    % (cx, cy, WASH, LINE))
        body.append(wrap(None, split_words(centre, 14), cx, cy - 4, 13, 700, MUTED, "middle", 16))

    for index, step in enumerate(steps):
        name = step[0] if isinstance(step, (list, tuple)) else step
        x, y = positions[index]
        accent = [BLUE, TEAL, DEEP, ORANGE, RED][index % 5]
        body.append('<circle cx="%s" cy="%s" r="52" fill="%s" stroke="%s" stroke-width="2"/>'
                    % (x, y, PAPER, accent))
        body.append('<circle cx="%s" cy="%s" r="16" fill="%s"/>' % (x, y - 26, accent))
        body.append(text(x, y - 21, index + 1, 12, 800, PAPER, "middle"))
        # The subtitle is deliberately not drawn: a 52px circle cannot hold it
        # without spilling over its own edge and across the arrows. The stage
        # name is what the figure needs to carry; the detail is in the prose.
        body.append(wrap(None, split_words(name, 13), x, y + 4, 11.5, 700, INK, "middle", 13))
    return render(440, "".join(body), title, caption)


def compare(title, columns, caption=None, footer=None):
    """Two or three labelled columns of bullet points."""
    top = 92
    count = len(columns)
    gap = 22
    width = (WIDTH - 56 - gap * (count - 1)) / count
    rows = max(len(items) for _h, _s, items in columns)
    height = 62 + rows * 26 + 16
    body = []
    for index, (heading, subtitle, items) in enumerate(columns):
        x = 28 + index * (width + gap)
        accent = [BLUE, ORANGE, TEAL][index % 3]
        body.append(box(x, top, width, height, PAPER, LINE))
        body.append('<rect x="%s" y="%s" width="%s" height="42" rx="12" fill="%s"/>'
                    % (x, top, width, accent))
        body.append('<rect x="%s" y="%s" width="%s" height="16" fill="%s"/>'
                    % (x, top + 26, width, accent))
        body.append(text(x + width / 2, top + 27, heading, 14, 800, PAPER, "middle"))
        if subtitle:
            body.append(text(x + width / 2, top + 60, subtitle, 11.5, 400, MUTED, "middle"))
        y = top + (78 if subtitle else 64)
        for item in items:
            body.append('<circle cx="%s" cy="%s" r="3" fill="%s"/>' % (x + 18, y - 4, accent))
            for line_index, line in enumerate(split_words(item, int(width / 6.4))):
                body.append(text(x + 30, y + line_index * 14, line, 12, 400, INK))
            y += 26
    bottom = top + height
    if footer:
        body.append(box(28, bottom + 18, WIDTH - 56, 44, WASH, LINE))
        body.append(text(WIDTH / 2, bottom + 45, footer, 12.5, 400, MUTED, "middle"))
        bottom += 62
    return render(bottom + 22, "".join(body), title, caption)


def table(title, headers, rows, caption=None, widths=None, footer=None):
    """Plain comparison table -- classes, prefixes, model summaries."""
    top = 92
    total = WIDTH - 56
    widths = widths or [1.0 / len(headers)] * len(headers)
    columns = [total * w for w in widths]
    header_height, row_height = 40, 38
    body = [box(28, top, total, header_height + len(rows) * row_height, PAPER, LINE)]
    body.append('<rect x="28" y="%s" width="%s" height="%s" rx="12" fill="%s"/>'
                % (top, total, header_height, WASH))
    body.append('<rect x="28" y="%s" width="%s" height="12" fill="%s"/>'
                % (top + header_height - 12, total, WASH))
    x = 28
    for index, heading in enumerate(headers):
        body.append(text(x + 14, top + 25, heading, 12.5, 800, INK))
        x += columns[index]
    y = top + header_height
    for row_index, row in enumerate(rows):
        if row_index % 2:
            body.append('<rect x="28" y="%s" width="%s" height="%s" fill="%s"/>'
                        % (y, total, row_height, WASH))
        body.append(plain_line(28, y, 28 + total, y, LINE))
        x = 28
        for index, cell in enumerate(row):
            weight = 700 if index == 0 else 400
            colour = INK if index == 0 else MUTED
            body.append(text(x + 14, y + 24, cell, 12, weight, colour))
            x += columns[index]
        y += row_height
    body.append(box(28, top, total, header_height + len(rows) * row_height, "none", LINE))
    bottom = y
    if footer:
        body.append(box(28, bottom + 18, total, 44, WASH, LINE))
        body.append(text(WIDTH / 2, bottom + 45, footer, 12.5, 400, MUTED, "middle"))
        bottom += 62
    return render(bottom + 22, "".join(body), title, caption)


def hub_spoke(title, hub, spokes, caption=None, hub_note=None):
    """One shared centre with satellites -- ERP, SIEM, a certificate authority."""
    import math
    cx, cy = WIDTH / 2, 250
    body = []
    count = len(spokes)
    for index, spoke in enumerate(spokes):
        angle = -math.pi / 2 + index * 2 * math.pi / count
        x, y = cx + 268 * math.cos(angle), cy + 150 * math.sin(angle)
        body.append(plain_line(cx + 96 * math.cos(angle), cy + 62 * math.sin(angle),
                               x - 62 * math.cos(angle), y - 34 * math.sin(angle), LINE))
        body.append(label_box(x - 82, y - 28, 164, 56, spoke, None, PAPER, LINE,
                              [BLUE, TEAL, DEEP, ORANGE, RED][index % 5]))
    body.append('<ellipse cx="%s" cy="%s" rx="104" ry="62" fill="%s" stroke="%s" '
                'stroke-width="3"/>' % (cx, cy, WASH, DEEP))
    body.append(wrap(None, split_words(hub, 16), cx, cy - 4, 14, 800, INK, "middle", 17))
    if hub_note:
        body.append(text(cx, cy + 30, hub_note, 11, 400, MUTED, "middle"))
    return render(452, "".join(body), title, caption)


def tiers(title, rows, caption=None, footer=None):
    """Horizontal bands of nodes with full mesh between the first two -- fabrics."""
    top = 96
    band = 108
    body = []
    centres = []
    for row_index, (label, nodes) in enumerate(rows):
        y = top + row_index * band
        body.append(text(28, y + 30, label, 12, 800, MUTED))
        count = len(nodes)
        span = WIDTH - 220
        width = min(140, (span - (count - 1) * 18) / count)
        start = 170 + (span - (count * width + (count - 1) * 18)) / 2
        row_centres = []
        for index, node in enumerate(nodes):
            x = start + index * (width + 18)
            accent = [DEEP, BLUE, TEAL][row_index % 3]
            body.append(label_box(x, y, width, 56, node, None, PAPER, LINE, accent))
            row_centres.append((x + width / 2, y, y + 56))
        centres.append(row_centres)
    links = []
    for row_index in range(len(centres) - 1):
        for upper in centres[row_index]:
            for lower in centres[row_index + 1]:
                links.append(plain_line(upper[0], upper[2], lower[0], lower[1], LINE))
    body = links + body
    bottom = top + len(rows) * band - band + 56
    if footer:
        body.append(box(28, bottom + 18, WIDTH - 56, 44, WASH, LINE))
        body.append(text(WIDTH / 2, bottom + 45, footer, 12.5, 400, MUTED, "middle"))
        bottom += 62
    return render(bottom + 22, "".join(body), title, caption)


def fields(title, segments, caption=None, footer=None):
    """A bit/byte layout split into labelled runs -- MAC, a subnet mask."""
    top = 100
    total = WIDTH - 56
    units = sum(weight for _n, _s, weight, _c in segments)
    body, x = [], 28
    for name, sample, weight, colour in segments:
        width = total * weight / units
        body.append(box(x, top, width, 74, WASH, colour, 12))
        body.append('<rect x="%s" y="%s" width="%s" height="26" rx="12" fill="%s"/>'
                    % (x, top, width, colour))
        body.append('<rect x="%s" y="%s" width="%s" height="12" fill="%s"/>'
                    % (x, top + 14, width, colour))
        body.append(text(x + width / 2, top + 18, name, 12, 800, PAPER, "middle"))
        body.append(text(x + width / 2, top + 55, sample, 13.5, 700, INK, "middle"))
        x += width
    bottom = top + 74
    if footer:
        body.append(box(28, bottom + 20, total, 46, PAPER, LINE))
        body.append(text(WIDTH / 2, bottom + 48, footer, 12.5, 400, MUTED, "middle"))
        bottom += 66
    return render(bottom + 22, "".join(body), title, caption)


def timeline(title, before, after, caption=None, footer=None):
    """An incident on an axis with a window either side -- RPO and RTO."""
    top = 130
    axis = top + 70
    centre = WIDTH / 2
    body = [plain_line(48, axis, WIDTH - 48, axis, FAINT, width=3)]

    body.append('<rect x="%s" y="%s" width="%s" height="44" rx="10" fill="%s" opacity="0.16"/>'
                % (centre - 300, axis - 52, 300, ORANGE))
    body.append('<rect x="%s" y="%s" width="%s" height="44" rx="10" fill="%s" opacity="0.16"/>'
                % (centre, axis - 52, 300, BLUE))
    body.append(text(centre - 150, axis - 24, before[0], 13.5, 800, ORANGE, "middle"))
    body.append(text(centre - 150, axis - 8, before[1], 11.5, 400, MUTED, "middle"))
    body.append(text(centre + 150, axis - 24, after[0], 13.5, 800, DEEP, "middle"))
    body.append(text(centre + 150, axis - 8, after[1], 11.5, 400, MUTED, "middle"))

    body.append(plain_line(centre, axis - 62, centre, axis + 34, RED, width=3))
    body.append('<circle cx="%s" cy="%s" r="9" fill="%s"/>' % (centre, axis, RED))
    body.append(text(centre, axis + 54, "incident", 13, 800, RED, "middle"))
    body.append(text(centre - 300, axis + 30, "last good backup", 11.5, 400, MUTED, "middle"))
    body.append(text(centre + 300, axis + 30, "service restored", 11.5, 400, MUTED, "middle"))
    body.append('<circle cx="%s" cy="%s" r="6" fill="%s"/>' % (centre - 300, axis, ORANGE))
    body.append('<circle cx="%s" cy="%s" r="6" fill="%s"/>' % (centre + 300, axis, DEEP))

    bottom = axis + 70
    if footer:
        body.append(box(28, bottom, WIDTH - 56, 46, WASH, LINE))
        body.append(text(WIDTH / 2, bottom + 28, footer, 12.5, 400, MUTED, "middle"))
        bottom += 66
    return render(bottom + 20, "".join(body), title, caption)


def split_planes(title, left, right, caption=None, footer=None):
    """Before/after architecture panels -- traditional networking versus SDN."""
    top = 92
    width = (WIDTH - 56 - 26) / 2
    height = 0
    body = []
    for index, (heading, subtitle, bands) in enumerate((left, right)):
        x = 28 + index * (width + 26)
        panel_height = 56 + len(bands) * 62
        height = max(height, panel_height)
        accent = ORANGE if index == 0 else DEEP
        body.append(box(x, top, width, panel_height, PAPER, LINE))
        body.append('<rect x="%s" y="%s" width="%s" height="40" rx="12" fill="%s"/>'
                    % (x, top, width, accent))
        body.append('<rect x="%s" y="%s" width="%s" height="14" fill="%s"/>'
                    % (x, top + 26, width, accent))
        body.append(text(x + width / 2, top + 26, heading, 14, 800, PAPER, "middle"))
        y = top + 52
        for band_name, band_note in bands:
            body.append(box(x + 14, y, width - 28, 50, WASH, LINE, 10))
            body.append(text(x + width / 2, y + 22, band_name, 12.5, 700, INK, "middle"))
            body.append(text(x + width / 2, y + 39, band_note, 11, 400, MUTED, "middle"))
            y += 62
        body.append(text(x + width / 2, top + panel_height + 20, subtitle, 11.5, 400, MUTED, "middle"))
    bottom = top + height + 34
    if footer:
        body.append(box(28, bottom, WIDTH - 56, 46, WASH, LINE))
        body.append(text(WIDTH / 2, bottom + 28, footer, 12.5, 400, MUTED, "middle"))
        bottom += 66
    return render(bottom + 20, "".join(body), title, caption)
