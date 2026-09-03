"""Builders for a lesson's `lesson_component_structure` and its quiz items.

The column is a JSON array of sections, each `{sectionName, content}`, and
`content` is a list of typed blocks the lesson renderer understands
(frontend/src/components/certifications/lesson-content-renderer.jsx). The block
shapes are fiddly and easy to get subtly wrong -- an accordion whose body sits
under `description` instead of `content` renders as a stack of titles with
nothing beneath them -- so nothing in a content module writes them by hand.

Ids are uuid4 because that is what the existing lessons carry; the renderer
only uses them as React keys, but staying consistent means a hand-written
lesson and a generated one are indistinguishable in the database.
"""

import uuid


def _id():
    return str(uuid.uuid4())


# ---------------------------------------------------------------- blocks

def desc(text):
    return {"type": "description", "data": {"text": text}}


def sub(text):
    return {"type": "subheading", "data": {"text": text}}


def ul(items):
    return {"type": "unordered-list",
            "data": {"items": [{"id": _id(), "text": t} for t in items]}}


def ol(items):
    return {"type": "ordered-list",
            "data": {"items": [{"id": _id(), "text": t} for t in items]}}


def image(url, source_url=None, source_name=None):
    """A standalone diagram.

    `imageKey` holds a full URL rather than an S3 key in every lesson this
    bank already contains -- the generator hotlinked diagrams from third-party
    sites and recorded the origin in `imageSourceUrl` / `imageSourceName`.
    These modules follow the same convention so the new lessons behave like
    the rest, and the attribution fields are always populated.
    """
    return {"type": "image",
            "data": {"file": None, "imageKey": url,
                     "imageSourceUrl": source_url,
                     "imageSourceName": source_name}}


def image_text(url, title, body, side="left", source_url=None,
               source_name=None):
    """A diagram beside explanatory prose. `side` is "left" or "right"."""
    return {"type": "image-%s-text" % side,
            "data": {"file": None, "imageKey": url, "title": title,
                     "description": body, "imageSourceUrl": source_url,
                     "imageSourceName": source_name}}


def accordion(pairs):
    """pairs: [(title, body)] -- collapsed rows, first one open."""
    return {"type": "accordion",
            "data": {"items": [{"id": _id(), "title": t, "content": b}
                               for t, b in pairs]}}


def tabs(triples):
    """triples: [(label, title, body)] -- a pill strip over one panel."""
    return {"type": "tabs",
            "data": {"items": [{"id": _id(), "label": lb, "title": ti,
                                "description": bo}
                               for lb, ti, bo in triples]}}


def cards(small_header, description, triples):
    """triples: [(front, back, body)] -- expanded to plain subheading + prose.

    This used to emit a `review-card-grid`, which the renderer draws as a grid
    of coloured flip cards. Measured against the 42 lessons that predate this
    expansion, that block appears 0.10 times per lesson; these modules were
    using it 0.45 times, and the coloured-card blocks together made the new
    lessons look nothing like the rest of the bank.

    Returning a flat sequence instead also raises the block count, which was
    the second half of the same problem: the new lessons averaged 29.5 blocks
    against the existing 46.5.
    """
    blocks = [desc(description)]
    for front, back, body in triples:
        blocks.append(sub("%s: %s" % (front, back)))
        blocks.append(desc(body))
    return blocks


def grid(small_header, description, pairs):
    """pairs: [(title, body)] -- expanded to plain subheading + prose.

    Same reasoning as `cards`. `header-description-grid` runs at 0.50 per
    lesson in the existing bank and was running at 1.09 here.
    """
    blocks = [desc(description)]
    for title, body in pairs:
        blocks.append(sub(title))
        blocks.append(desc(body))
    return blocks


# ---------------------------------------------------------------- lesson

def lesson_structure(name, intro, objectives, minutes, sections,
                     key_terms, summary):
    """Assembles the section list in the order every existing lesson uses.

    The first section carries the lesson's own name and no content -- that is
    the convention in the bank, and the renderer relies on it for the title
    block -- then Introduction, Learning Objectives, the body, Key Terms and
    Summary.
    """
    structure = [
        {"sectionName": name, "content": []},
        {"sectionName": "Introduction", "content": [desc(intro)]},
        {"sectionName": "Learning Objectives",
         "content": [ul(objectives),
                     desc("Estimated study time: %d minutes" % minutes)]},
    ]
    for section_name, blocks in sections:
        # `grid` and `cards` each return a LIST of blocks now rather than one
        # block, so a section's content may arrive with lists nested inside
        # it. Flattening here keeps every content module unchanged.
        flattened = []
        for block in blocks:
            if isinstance(block, list):
                flattened.extend(block)
            else:
                flattened.append(block)
        structure.append({"sectionName": section_name, "content": flattened})
    structure.append({"sectionName": "Key Terms",
                      "content": [accordion(key_terms)]})
    structure.append({"sectionName": "Summary", "content": [desc(summary)]})
    return structure


# ---------------------------------------------------------------- questions

def mcq(difficulty, question, choices, explanation):
    """choices: [(text, is_correct)] with exactly one correct."""
    correct = [c for c in choices if c[1]]
    assert len(correct) == 1, "MCQ needs exactly one correct choice: %r" % question[:60]
    return {"type": "MCQ", "difficulty": difficulty, "question": question,
            "choices": choices, "explanation": explanation}


def short_answer(difficulty, question, answer, variations):
    return {"type": "SHORT_ANSWER", "difficulty": difficulty,
            "question": question, "answer": answer, "variations": variations}


def descriptive(difficulty, question, answer, rubric):
    """rubric: [(criterion, max_points)]."""
    return {"type": "DESCRIPTIVE", "difficulty": difficulty,
            "question": question, "answer": answer, "rubric": rubric}
