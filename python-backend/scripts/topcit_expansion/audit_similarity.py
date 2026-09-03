"""Audits EVERY lesson and question already in the database for overlap.

check_duplicates.py answers "would this new batch collide with anything?".
This answers the harder question: "is anything in the bank already a duplicate
of anything else?" -- including pairs that predate this expansion entirely.

Three passes:

  1. Lesson names, compared across the whole certification. Two lessons named
     almost the same thing in different middle categories is a real defect even
     though nothing in the schema forbids it.

  2. Section headings, pairwise across every lesson. Scaffolding headings
     (Introduction, Key Terms, Summary and friends) are excluded, because
     every lesson has them and counting them makes every pair look related.
     What is left is the actual subject matter.

  3. Question stems, pairwise across the whole bank. Compared on a normalised
     bag of words, so two questions differing only in punctuation still match.

Nothing is written. Usage:

    docker compose exec -T python-api \
        python /app/scripts/topcit_expansion/audit_similarity.py
"""

import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

from sqlalchemy import text

from app.db.session import SessionLocal
from check_duplicates import jaccard, normalise_section, words

CERTIFICATION_ID = 13

#: Report a lesson pair whose subject-matter headings overlap this much. Set
#: lower than the incoming-batch threshold on purpose: this pass is meant to
#: surface anything worth a human look, not just certain duplicates.
LESSON_OVERLAP = 0.25

#: Report a lesson name pair this similar.
NAME_SIMILARITY = 0.5

#: Report a question pair this similar. Two stems that share this much
#: vocabulary are testing the same thing even when the numbers differ.
QUESTION_SIMILARITY = 0.7


def main():
    db = SessionLocal()

    lessons = db.execute(text("""
        select l.lesson_id, l.name, mi.title, mj.title,
               l.lesson_component_structure
          from public.lessons l
          join public.middle_categories mi
            on mi.middle_category_id = l.middle_category_id
          join public.major_categories mj
            on mj.major_category_id = mi.major_category_id
         where mj.certification_id = :c
         order by l.lesson_id"""), {"c": CERTIFICATION_ID}).fetchall()

    prepared = []
    for lesson_id, name, middle, major, structure in lessons:
        sections = {normalise_section(s.get("sectionName", ""))
                    for s in (structure or [])}
        sections.discard("")
        prepared.append({
            "id": lesson_id, "name": name, "middle": middle, "major": major,
            "sections": sections, "name_words": words(name),
            "size": len(structure or []),
        })

    print("auditing %d lessons\n" % len(prepared))

    print("=" * 72)
    print("1. LESSON NAMES")
    print("=" * 72)
    name_hits = 0
    for i, left in enumerate(prepared):
        for right in prepared[i + 1:]:
            score = jaccard(left["name_words"], right["name_words"])
            if score >= NAME_SIMILARITY:
                name_hits += 1
                print("  %.0f%%  %s (%s)\n        %s (%s)"
                      % (score * 100, left["name"], left["middle"],
                         right["name"], right["middle"]))
    if not name_hits:
        print("  no lesson names overlap above %.0f%%" % (NAME_SIMILARITY * 100))

    print()
    print("=" * 72)
    print("2. SECTION CONTENT")
    print("=" * 72)
    pairs = []
    for i, left in enumerate(prepared):
        for right in prepared[i + 1:]:
            if not left["sections"] or not right["sections"]:
                continue
            shared = left["sections"] & right["sections"]
            if not shared:
                continue
            # Symmetric measure: two lessons of very different length that
            # share a few headings should not be reported just because the
            # shared set is a large fraction of the shorter one.
            score = jaccard(left["sections"], right["sections"])
            if score >= LESSON_OVERLAP:
                pairs.append((score, left, right, sorted(shared)))

    for score, left, right, shared in sorted(pairs, reverse=True):
        print("  %.0f%%  %s [%s]\n        %s [%s]"
              % (score * 100, left["name"], left["major"],
                 right["name"], right["major"]))
        print("        shared headings: %s" % "; ".join(shared[:8]))
    if not pairs:
        print("  no lesson pair shares more than %.0f%% of its subject-matter "
              "headings" % (LESSON_OVERLAP * 100))

    print()
    print("=" * 72)
    print("3. QUESTION STEMS")
    print("=" * 72)
    questions = db.execute(text("""
        select q.question_id, q.question_text, l.name
          from public.questions q
          join public.lessons l on l.lesson_id = q.lesson_id
          join public.middle_categories mi
            on mi.middle_category_id = l.middle_category_id
          join public.major_categories mj
            on mj.major_category_id = mi.major_category_id
         where mj.certification_id = :c
         order by q.question_id"""), {"c": CERTIFICATION_ID}).fetchall()

    print("  comparing %d questions" % len(questions))
    prepared_q = [(qid, words(qtext), qtext, lesson)
                  for qid, qtext, lesson in questions]

    question_hits = 0
    for i, (left_id, left_words, left_text, left_lesson) in enumerate(prepared_q):
        for right_id, right_words, right_text, right_lesson in prepared_q[i + 1:]:
            score = jaccard(left_words, right_words)
            if score >= QUESTION_SIMILARITY:
                question_hits += 1
                print("\n  %.0f%%  q%s [%s]\n         %s"
                      % (score * 100, left_id, left_lesson,
                         left_text[:110].replace("\n", " ")))
                print("         q%s [%s]\n         %s"
                      % (right_id, right_lesson,
                         right_text[:110].replace("\n", " ")))
    if not question_hits:
        print("  no question pair overlaps above %.0f%%"
              % (QUESTION_SIMILARITY * 100))

    print()
    print("=" * 72)
    print("lesson name pairs: %d | section pairs: %d | question pairs: %d"
          % (name_hits, len(pairs), question_hits))
    return 0


if __name__ == "__main__":
    sys.exit(main())
