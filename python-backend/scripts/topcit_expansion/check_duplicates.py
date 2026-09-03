"""Reports what a content batch would duplicate, without writing anything.

Run this before seed.py. The bank is not empty -- 42 lessons and over a
thousand questions already exist on TOPCIT -- so a new batch can collide in
three separate ways, and only the first of them is caught by the seeder's own
idempotency check:

  1. Lesson name. A lesson with the same name in the same middle category.
     seed.py skips these, but you want to know before you run it.

  2. Section overlap. A new lesson whose section headings substantially repeat
     an existing lesson's is a duplicate in substance even when its name is
     new -- that is how a curriculum ends up teaching the OSI model three
     times. Reported as a percentage of the new lesson's own sections.

  3. Question text. Near-identical stems across the certification. Compared on
     a normalised bag of words rather than exact text, because two questions
     that differ by a comma are still the same question.

Usage:

    docker compose exec -T python-api \
        python /app/scripts/topcit_expansion/check_duplicates.py network_01
"""

import importlib
import re
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

from sqlalchemy import text

from app.db.session import SessionLocal

CERTIFICATION_ID = 13

#: Words too common in exam prose to carry any signal about what a question
#: is actually about. Without this every stem looks 30% similar to every other.
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "can", "for",
    "from", "has", "have", "in", "into", "is", "it", "its", "of", "on", "or",
    "that", "the", "their", "them", "then", "there", "these", "they", "this",
    "to", "was", "were", "what", "when", "which", "while", "who", "why",
    "will", "with", "would", "you", "your", "following", "best", "most",
    "correct", "describes", "statement", "true", "about",
}

#: Above this Jaccard overlap two question stems are reported as the same
#: question. Tuned by hand against the existing bank: genuine duplicates land
#: near 0.75, questions that merely share a topic land around 0.3.
QUESTION_SIMILARITY = 0.6

#: Above this share of repeated section headings a lesson is reported as
#: covering ground an existing lesson already covers.
SECTION_OVERLAP = 0.34

#: Section headings every lesson in the bank carries. They are scaffolding,
#: not subject matter, and counting them made two lessons on entirely
#: different topics look 41% identical -- which is a report nobody can act on.
#: Normalised the same way section headings are, so word order does not matter.
STRUCTURAL_SECTIONS = {
    "introduction",
    "learning objectives",
    "key terms",
    "key takeaways",
    "summary",
    "common mistakes",
    "certification exam tips",
    "best practices",
    "practical example",
    "prerequisites",
    "conclusion",
}


def words(value):
    return {w for w in re.findall(r"[a-z0-9]+", value.lower())
            if w not in STOPWORDS and len(w) > 2}


def jaccard(left, right):
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def normalise_section(name):
    """Strips the ordinal scaffolding lessons use around their headings.

    "Part 3: UICC-Based Authentication" and "UICC-Based Authentication" are the
    same section, and one lesson in this certification numbers its sections
    while the others do not.
    """
    name = re.sub(r"^(part|section|step)\s*\d+\s*[:.-]\s*", "", name.strip(),
                  flags=re.IGNORECASE)
    normalised = " ".join(sorted(words(name)))

    # Scaffolding is dropped rather than compared. A heading may be phrased
    # loosely ("Key Takeaways for ISMS Frameworks"), so a normalised structural
    # name is treated as a match when it is contained in the heading.
    structural = {" ".join(sorted(words(s))) for s in STRUCTURAL_SECTIONS}
    heading_words = words(name)
    for candidate in structural:
        candidate_words = set(candidate.split())
        if candidate_words and candidate_words <= heading_words:
            return ""

    return normalised


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    db = SessionLocal()

    existing_lessons = db.execute(text("""
        select l.lesson_id, l.name, l.middle_category_id, mi.title,
               l.lesson_component_structure
          from public.lessons l
          join public.middle_categories mi
            on mi.middle_category_id = l.middle_category_id
          join public.major_categories mj
            on mj.major_category_id = mi.major_category_id
         where mj.certification_id = :c"""), {"c": CERTIFICATION_ID}).fetchall()

    by_name = {}
    section_index = []
    for lesson_id, name, middle_id, middle_title, structure in existing_lessons:
        by_name.setdefault((middle_id, name.strip().lower()), lesson_id)
        sections = {normalise_section(s.get("sectionName", ""))
                    for s in (structure or [])}
        sections.discard("")
        section_index.append((lesson_id, name, middle_title, sections))

    existing_questions = db.execute(text("""
        select q.question_id, q.question_text
          from public.questions q
          join public.lessons l on l.lesson_id = q.lesson_id
          join public.middle_categories mi
            on mi.middle_category_id = l.middle_category_id
          join public.major_categories mj
            on mj.major_category_id = mi.major_category_id
         where mj.certification_id = :c"""), {"c": CERTIFICATION_ID}).fetchall()
    question_index = [(qid, words(qtext), qtext) for qid, qtext in existing_questions]

    print("checking against %d existing lessons and %d existing questions\n"
          % (len(existing_lessons), len(question_index)))

    findings = 0
    for batch in sys.argv[1:]:
        module = importlib.import_module("content_%s" % batch)
        print("== %s" % batch)

        # A batch may introduce several lessons at once, so new lessons are
        # compared against each other as well as against the database.
        batch_sections = []
        batch_questions = []

        for spec in module.LESSONS:
            name = spec["name"]
            middle = spec["middle"]
            print("\n  %s" % name)

            if isinstance(middle, int):
                clash = by_name.get((middle, name.strip().lower()))
                if clash:
                    findings += 1
                    print("    ! lesson name already exists as lesson %s" % clash)

            new_sections = {normalise_section(s.get("sectionName", ""))
                            for s in spec["structure"]}
            new_sections.discard("")

            worst = []
            for lesson_id, other_name, middle_title, sections in section_index + batch_sections:
                if not sections:
                    continue
                shared = new_sections & sections
                # Measured against the NEW lesson's own size: the question is
                # how much of what this lesson teaches is already taught, not
                # how much of the old lesson it happens to touch.
                ratio = len(shared) / max(len(new_sections), 1)
                if ratio >= SECTION_OVERLAP:
                    worst.append((ratio, other_name, middle_title, sorted(shared)[:6]))
            for ratio, other_name, middle_title, shared in sorted(worst, reverse=True)[:3]:
                findings += 1
                print("    ! %.0f%% of sections also appear in \"%s\" (%s)"
                      % (ratio * 100, other_name, middle_title))
                print("      shared: %s" % "; ".join(shared))

            if not worst:
                print("    section coverage looks distinct (%d sections)"
                      % len(new_sections))

            for item in spec["quiz"]:
                stem = words(item["question"])
                hits = [(jaccard(stem, other), qid, qtext)
                        for qid, other, qtext in question_index + batch_questions]
                hits = [h for h in hits if h[0] >= QUESTION_SIMILARITY]
                for score, qid, qtext in sorted(hits, reverse=True)[:1]:
                    findings += 1
                    print("    ! question %.0f%% similar to question %s"
                          % (score * 100, qid))
                    print("      new: %s" % item["question"][:100].replace("\n", " "))
                    print("      old: %s" % qtext[:100].replace("\n", " "))
                batch_questions.append((("new:" + name), stem, item["question"]))

            batch_sections.append((None, name + " (this batch)", "new", new_sections))

    print("\n%d finding(s)" % findings)
    return 0


if __name__ == "__main__":
    sys.exit(main())
