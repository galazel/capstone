"""Restores SHORT_ANSWER to questions a substring bug typed as DESCRIPTIVE.

`QuestionDraft._reclassify_open_ended_short_answers` turns an open-ended
SHORT_ANSWER into a DESCRIPTIVE, because SHORT_ANSWER is graded by exact string
match and an essay question can never be matched. That repair is right. The
list it matched on was not: verbs like "describe" and "explain" sat in it as
bare substrings, so any stem merely *containing* one was reclassified --

    "Which term describes the process of conducting business transactions
     over computer networks, such as the internet?"        -> E-commerce

is a one-term answer that shipped as an essay question, and the learner meets a
textarea where a text box belongs. Recall sessions, which reassemble existing
questions rather than authoring new ones, inherit it.

The schema now matches those verbs as whole words in imperative position. This
fixes the rows written before that.

A row is repaired only when all of these hold, so a question the model
deliberately wrote as DESCRIPTIVE is never touched:

  * it is DESCRIPTIVE with an AI_SEMANTIC text config;
  * the stem contains a directive verb as a bare substring -- i.e. the old rule
    fired on it, which is what makes this row *this bug's* doing;
  * the fixed rule does not fire: no open-ended phrase, no directive in
    imperative position, no enumeration, no counted set;
  * the stored answer is within SHORT_ANSWER_MAX_WORDS, so exact matching is
    actually possible against it.

The tests are imported from the schema module rather than restated, so this can
never drift from what generation now does.

    python scripts/repair_short_answer_typing.py            # preview only
    python scripts/repair_short_answer_typing.py --apply    # write
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.db.session import SessionLocal
from app.domain.persistence import CHECKING_METHOD_EXACT, CHECKING_METHOD_SEMANTIC
from app.schemas.certification.question_schema import (
    SHORT_ANSWER_MAX_WORDS,
    _COUNTED_SET_PATTERN,
    _ENUMERATION_STEMS,
    _OPEN_ENDED_DIRECTIVE_PATTERN,
    _OPEN_ENDED_DIRECTIVES,
    _OPEN_ENDED_PHRASES,
)


def _old_rule_fired(stem: str) -> str | None:
    """What the bare-substring list would have matched. The bug's fingerprint."""
    return next((verb for verb in _OPEN_ENDED_DIRECTIVES if verb in stem), None)


def _still_open_ended(stem: str) -> bool:
    """Whether the *fixed* rule considers this question open-ended after all."""
    if any(phrase in stem for phrase in _OPEN_ENDED_PHRASES):
        return True
    if _OPEN_ENDED_DIRECTIVE_PATTERN.search(stem):
        return True
    if any(phrase in stem for phrase in _ENUMERATION_STEMS):
        return True
    return bool(_COUNTED_SET_PATTERN.search(stem))


def main(apply: bool) -> int:
    fixed = 0
    examined = 0

    with SessionLocal() as session:
        rows = session.execute(
            text(
                "SELECT q.question_id, q.question_text, c.text_question_config_id, "
                "       c.correct_answer "
                "FROM questions q "
                "JOIN text_question_configs c ON c.question_id = q.question_id "
                "WHERE q.question_type = 'DESCRIPTIVE' "
                "  AND c.checking_method = :semantic "
                "ORDER BY q.question_id"
            ),
            {"semantic": CHECKING_METHOD_SEMANTIC},
        ).all()

        for question_id, question_text, config_id, correct_answer in rows:
            examined += 1
            stem = (question_text or "").strip().lower()
            answer = (correct_answer or "").strip()

            verb = _old_rule_fired(stem)
            if verb is None:
                continue
            if _still_open_ended(stem):
                continue
            if not answer or len(answer.split()) > SHORT_ANSWER_MAX_WORDS:
                # No answer short enough to exact-match. The type may well be
                # wrong, but this script cannot supply the missing answer and
                # will not guess one.
                continue

            fixed += 1
            print(
                f"  #{question_id}  {verb!r} matched as a substring\n"
                f"      {question_text.strip()[:100]}\n"
                f"      -> SHORT_ANSWER, exact match on {answer!r}"
            )

            if apply:
                session.execute(
                    text(
                        "UPDATE questions SET question_type = 'SHORT_ANSWER' "
                        "WHERE question_id = :qid"
                    ),
                    {"qid": question_id},
                )
                session.execute(
                    text(
                        "UPDATE text_question_configs SET checking_method = :exact "
                        "WHERE text_question_config_id = :cid"
                    ),
                    {"exact": CHECKING_METHOD_EXACT, "cid": config_id},
                )

        if apply:
            session.commit()

    print(
        f"\n{examined} semantic-graded DESCRIPTIVE question(s) examined; "
        f"{fixed} mistyped by the substring rule."
    )
    if fixed and not apply:
        print("Nothing written. Re-run with --apply to repair them.")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the repairs; without it the run only reports what it would change",
    )
    raise SystemExit(main(parser.parse_args().apply))
