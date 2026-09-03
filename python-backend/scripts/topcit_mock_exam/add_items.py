"""Bring the TOPCIT mock exam up to the certification's own exam structure.

`certifications.exam_structure` is what the planner researched about the real
paper, and it is the authority on what a mock exam should look like:

    total_items 65, duration 150 minutes, and a coverage split of
    Software Development 20%, Database 15%, Network 15%, Security 15%,
    Technical Communications 15%, IT Business 10%, Project Management 10%.

The exam that was generated has 50 items in 90 minutes, because it was built
before the planner wrote that structure and fell back to the configured
`mock_exam_questions` default. Its coverage is off in the same way: Software
Development carries 6 items where the weights ask for 13.

This adds the 15 missing items and corrects the duration and declared total.
It ADDS rather than rebalances: the exam is PUBLISHED and learners have sat it,
so deleting items would invalidate attempts already recorded against them. The
additions are placed where the shortfall is worst, which lands every major
either on its target or within two items of it.

The questions are written by hand, not generated -- same standard as the
diagram briefs: a scenario a practitioner would recognise, distractors that are
wrong for a stateable reason rather than obviously silly, and an explanation
that says why the right answer is right.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

EXAM_ID = 192
CERTIFICATION_ID = 13

#: The structure the additions are aiming at, from `exam_structure`.
TARGET_ITEMS = 65
TARGET_DURATION_MINUTES = 150


def mcq(lesson, difficulty, question, choices, explanation):
    """choices: list of (text, is_correct). Exactly one correct."""
    return {
        "type": "MCQ", "lesson": lesson, "difficulty": difficulty,
        "question": question, "choices": choices, "explanation": explanation,
    }


def short_answer(lesson, difficulty, question, answer, variations):
    return {
        "type": "SHORT_ANSWER", "lesson": lesson, "difficulty": difficulty,
        "question": question, "answer": answer, "variations": variations,
    }


def descriptive(lesson, difficulty, question, answer, rubric):
    return {
        "type": "DESCRIPTIVE", "lesson": lesson, "difficulty": difficulty,
        "question": question, "answer": answer, "rubric": rubric,
    }


def programming(lesson, difficulty, question, starter, tests):
    return {
        "type": "PROGRAMMING", "lesson": lesson, "difficulty": difficulty,
        "question": question, "starter": starter, "tests": tests,
    }


ITEMS = [
    # ---------------------------------------------- Software Development (+7)
    mcq(
        363, "AVERAGE",
        "A stakeholder tells the analyst: \"The system must be fast.\" The "
        "analyst rewrites it as: \"95% of search requests must return within "
        "2 seconds under a load of 500 concurrent users.\"\n\n"
        "Which quality of a good requirement did the rewrite primarily "
        "introduce?",
        [
            ("Verifiability — the requirement can now be tested against a "
             "measurable threshold.", True),
            ("Traceability — the requirement can now be linked back to its "
             "source.", False),
            ("Feasibility — the requirement is now known to be achievable "
             "within budget.", False),
            ("Atomicity — the requirement now describes exactly one need.", False),
        ],
        "\"Fast\" cannot be passed or failed; \"95% within 2 seconds at 500 "
        "concurrent users\" can, so a tester can decide the outcome without "
        "argument. Traceability concerns the link to a source, which the "
        "rewrite did not add. Feasibility is about whether it can be built, "
        "which the rewrite does not establish. The original was already "
        "atomic — a single need, merely an unmeasurable one.",
    ),
    mcq(
        367, "HARD",
        "Midway through development, a customer asks for a change to a "
        "requirement that has already been baselined. The change board "
        "assesses it and approves it.\n\n"
        "What must happen to the baseline?",
        [
            ("A new baseline version is created containing the amended "
             "requirement; the previous baseline is retained.", True),
            ("The existing baseline is edited in place so the specification "
             "always reflects the current agreement.", False),
            ("The baseline is left untouched and the change is tracked only "
             "in the change request log.", False),
            ("The baseline is deleted and re-created once all outstanding "
             "changes have been approved.", False),
        ],
        "A baseline is a fixed reference point: its value is that you can ask "
        "what the agreement was on a given date. Editing it in place destroys "
        "exactly that, so an approved change produces a NEW baseline version "
        "while the old one is retained. Tracking the change only in the log "
        "leaves the specification disagreeing with the agreement, and deleting "
        "a baseline discards the audit trail entirely.",
    ),
    mcq(
        368, "AVERAGE",
        "A module reads a configuration file, computes payroll tax, and "
        "renders an HTML report.\n\n"
        "Which design property is weakest, and what is the consequence?",
        [
            ("Cohesion is weak — the module has three unrelated "
             "responsibilities, so a change to any one of them forces the "
             "module to be retested as a whole.", True),
            ("Coupling is weak — the module depends on too many other "
             "modules, so it cannot be reused.", False),
            ("Abstraction is weak — the module exposes its internal data "
             "structures to its callers.", False),
            ("Encapsulation is weak — the module's fields can be modified "
             "from outside it.", False),
        ],
        "Cohesion measures how closely a module's responsibilities belong "
        "together. File I/O, tax arithmetic and HTML rendering have nothing to "
        "do with one another, so this module is coincidentally cohesive — the "
        "weakest kind. Coupling is about dependencies BETWEEN modules and "
        "nothing here describes them; abstraction and encapsulation concern "
        "what the module exposes, which the scenario does not state.",
    ),
    mcq(
        371, "AVERAGE",
        "A team runs unit tests, then integration tests, then system tests.\n\n"
        "Which defect is integration testing designed to find that unit "
        "testing cannot?",
        [
            ("A mismatch in the interface between two components, such as one "
             "passing a date as a string where the other expects a timestamp.",
             True),
            ("An off-by-one error in a loop inside a single method.", False),
            ("A requirement that was never implemented at all.", False),
            ("A performance problem that appears only under production load.",
             False),
        ],
        "Unit tests exercise a component against a test double, so both sides "
        "of an interface are assumed rather than checked; integration testing "
        "puts real components together and is where a contract mismatch "
        "surfaces. An off-by-one error inside one method is exactly what a "
        "unit test catches. A missing requirement is found by system or "
        "acceptance testing against the specification, and load-related "
        "problems by performance testing.",
    ),
    descriptive(
        372, "HARD",
        "A payroll system in production must be changed for three separate "
        "reasons in the same quarter:\n\n"
        "  (i)   the tax authority has published new rates effective in April;\n"
        "  (ii)  a defect causes overtime to be rounded down by one minute;\n"
        "  (iii) the database vendor is withdrawing support for the version "
        "in use, so the system must move to a newer release with no change to "
        "what users see.\n\n"
        "Classify each as corrective, adaptive, perfective or preventive "
        "maintenance, and justify each classification in one sentence. Then "
        "state which of the three carries the highest regression risk and why.",
        "(i) is ADAPTIVE. The system's own requirements have not changed — it "
        "was always meant to apply the prevailing tax rates — but the "
        "environment it operates in has moved, which is what distinguishes "
        "adaptive from perfective. A learner who argues PERFECTIVE on the "
        "grounds that the business asked for new rates should be credited only "
        "if they address why a legislated change is environmental.\n"
        "(ii) is CORRECTIVE: it repairs a defect in delivered behaviour — the "
        "system is not doing what it was specified to do.\n"
        "(iii) is ADAPTIVE for the same reason as (i): the platform beneath "
        "the system is moving while its requirements are unchanged. PREVENTIVE "
        "is also defensible where the move is made ahead of an actual failure "
        "to avoid future trouble; either classification earns the mark if it "
        "is justified on that basis.\n\n"
        "Highest regression risk is (iii). The change is invisible to users, "
        "so there is no new behaviour to test against, yet it moves the "
        "platform under every existing function — meaning the whole regression "
        "suite is the only evidence that nothing broke, and any gap in that "
        "suite is an undetected fault.",
        [
            ("Classifies (i) correctly with a justification tied to the "
             "environment rather than to user requirements", 2),
            ("Classifies (ii) as corrective, tied to delivered behaviour "
             "failing its specification", 2),
            ("Classifies (iii) as adaptive or preventive with a defensible "
             "justification", 2),
            ("Identifies (iii) as the highest regression risk and explains "
             "why an invisible change is harder to test", 2),
        ],
    ),
    programming(
        364, "HARD",
        "Requirements are often written with duplicated intent: two "
        "stakeholders raise the same need in different words, and both end up "
        "in the backlog.\n\n"
        "Write a function `duplicate_groups(requirements)` that takes a list "
        "of requirement strings and returns the groups of requirements that "
        "are duplicates of one another.\n\n"
        "Two requirements are duplicates when, after lowercasing and removing "
        "punctuation, they contain exactly the same set of words (order and "
        "repetition do not matter).\n\n"
        "Return a list of groups. Each group is the list of duplicate "
        "requirements in the order they appeared in the input. Include only "
        "groups with two or more members, and order the groups by the position "
        "of their first member. Return an empty list when there are no "
        "duplicates.\n\n"
        "Input is one requirement per line. Print each group on its own line "
        "as the requirements joined by ' | '. Print nothing when there are no "
        "duplicate groups.",
        "import sys, re\n\n"
        "def duplicate_groups(requirements):\n"
        "    # your code here\n"
        "    return []\n\n"
        "lines = [l.rstrip('\\n') for l in sys.stdin if l.strip()]\n"
        "for group in duplicate_groups(lines):\n"
        "    print(' | '.join(group))\n",
        [
            ("The system must log every failed login.\n"
             "Every failed login must be logged by the system.\n"
             "Users can reset their password by email.",
             "The system must log every failed login. | Every failed login "
             "must be logged by the system.", True),
            ("Export the report as PDF.\nExport the report as CSV.",
             "", True),
            ("A must B.\nB must A.\nb MUST a!!!\nUnrelated requirement here.",
             "A must B. | B must A. | b MUST a!!!", False),
        ],
    ),
    short_answer(
        369, "AVERAGE",
        "In a layered architecture, the presentation layer calls the service "
        "layer, which calls the data access layer. A developer adds a call "
        "from the data access layer back into the service layer to reuse a "
        "validation routine.\n\n"
        "Name the architectural principle this violates.",
        "layering",
        ["layered architecture", "strict layering", "one-way dependency",
         "acyclic dependencies", "layer isolation", "dependency direction",
         "unidirectional dependency"],
    ),

    # ----------------------------------------------- Understanding of Network (+4)
    mcq(
        379, "AVERAGE",
        "A switch receives a frame whose destination MAC address is not in "
        "its MAC address table.\n\n"
        "What does it do?",
        [
            ("Floods the frame out of every port except the one it arrived "
             "on.", True),
            ("Discards the frame and sends an error back to the source.", False),
            ("Broadcasts an ARP request to discover which port owns the "
             "address.", False),
            ("Forwards the frame to its default gateway for routing.", False),
        ],
        "An unknown unicast is flooded: the switch has no entry saying which "
        "port the address is behind, so it sends the frame everywhere except "
        "back where it came from, and learns the address when a reply comes "
        "back. Discarding it would break connectivity for every new host. ARP "
        "resolves an IP address to a MAC address and is a layer 3 concern, not "
        "how a switch fills its table. A default gateway is also layer 3; a "
        "switch forwarding at layer 2 does not consult one.",
    ),
    mcq(
        378, "AVERAGE",
        "A campus is cabling a 400 m run between two buildings and needs "
        "1 Gbps.\n\n"
        "Why is single-mode fibre chosen over Cat 6 copper?",
        [
            ("Copper Ethernet is limited to about 100 m per run, which the "
             "400 m distance exceeds.", True),
            ("Copper cannot carry 1 Gbps at any distance.", False),
            ("Fibre is required because the link crosses a building "
             "boundary.", False),
            ("Copper would need a different connector type at each end.", False),
        ],
        "The governing constraint is distance: twisted-pair Ethernet is "
        "specified to roughly 100 m including patch leads, and 400 m is four "
        "times that, so the run needs fibre regardless of speed. Copper "
        "carries 1 Gbps perfectly well within its distance limit. Crossing a "
        "building boundary often motivates fibre for isolation and lightning "
        "protection, but it is not itself the rule, and connector type is not "
        "the deciding factor.",
    ),
    short_answer(
        380, "AVERAGE",
        "A client is configured with an IP address, a subnet mask and a "
        "default gateway, and can reach hosts on its own subnet and on the "
        "internet by IP address — but every attempt to reach a host by name "
        "fails.\n\n"
        "Which network service is misconfigured or unreachable?",
        "DNS",
        ["dns", "domain name system", "the dns server", "name resolution",
         "dns service", "domain name service"],
    ),
    descriptive(
        381, "HARD",
        "A water utility monitors 3,000 unattended sites over a cellular link "
        "that is frequently unavailable for hours at a time. Each site reads a "
        "flow sensor every 30 seconds. A fault at a site must raise an alarm "
        "within one second.\n\n"
        "Explain why sending every reading directly to the cloud and deciding "
        "alarms there would fail BOTH requirements, and describe the two "
        "architectural mechanisms that address them. State clearly which "
        "mechanism solves which requirement.",
        "Sending everything to the cloud fails the outage requirement because "
        "readings taken while the link is down have nowhere to go and are lost "
        "— a store-and-forward buffer at the edge is what preserves them, "
        "holding readings locally and draining them when the uplink returns. "
        "It fails the alarm requirement because a decision made in the cloud "
        "cannot be reached at all while the link is down, and even when it is "
        "up, the round trip over a cellular link is unlikely to fit inside one "
        "second — edge inference, evaluating the alarm rule locally on the "
        "gateway, is what meets the deadline, because the decision never "
        "leaves the site.\n\n"
        "The two are independent: buffering solves data loss, edge evaluation "
        "solves latency. Buffering alone would still miss the alarm deadline, "
        "and edge evaluation alone would still lose the historical readings.",
        [
            ("Explains why cloud-side alarm decisions cannot meet a one-second "
             "deadline over an intermittent link", 3),
            ("Explains why readings are lost during an outage without local "
             "storage", 2),
            ("Names store-and-forward buffering and edge inference (or "
             "equivalent) as the two mechanisms", 3),
            ("States correctly which mechanism addresses which requirement", 2),
        ],
    ),

    # --------------------------------------------- Technical Communications (+2)
    mcq(
        394, "AVERAGE",
        "A buyer knows it needs a document management system but does not yet "
        "know what the market offers, what such systems typically cost, or "
        "which suppliers are credible.\n\n"
        "Which instrument should it issue, and why?",
        [
            ("A Request for Information, because the requirement is not yet "
             "understood well enough to be specified for pricing.", True),
            ("A Request for Proposal, because suppliers will describe their "
             "solutions and quote for them.", False),
            ("A Request for Quotation, because the buyer needs to compare "
             "prices before deciding.", False),
            ("An Invitation to Tender, because a formal competitive process "
             "protects the buyer.", False),
        ],
        "An RFI gathers market intelligence when the requirement is still "
        "being formed; that is precisely the buyer's position. An RFP and an "
        "ITT both ask suppliers to respond against a specification the buyer "
        "cannot yet write, which wastes supplier effort and produces "
        "incomparable responses. An RFQ assumes the item is already specified "
        "and only price is at issue.",
    ),
    mcq(
        392, "AVERAGE",
        "A technical author must write a document whose reader has to carry "
        "out an unfamiliar task correctly, in order, without supervision.\n\n"
        "Which document type fits, and on what basis is the choice made?",
        [
            ("A procedure or work instruction, chosen on what the reader must "
             "DO with the information.", True),
            ("A specification, chosen because the task must be performed "
             "exactly as defined.", False),
            ("A design description, chosen because the reader needs to "
             "understand how the system works.", False),
            ("A report, chosen because a record of the task is required.", False),
        ],
        "Document type follows from what the reader has to do. A reader "
        "performing steps needs a procedure; a reader deciding whether "
        "something meets a need reads a specification; a reader who must "
        "understand internal workings reads a design description; a reader "
        "wanting a record of what happened reads a report. Choosing on the "
        "author's material rather than the reader's task is what produces "
        "documents labelled \"report\" that are really instructions.",
    ),

    # -------------------------------------- Database Construction and Management (+1)
    mcq(
        377, "HARD",
        "A retail warehouse stores a product's category on the sales fact "
        "row. A product moves from \"Snacks\" to \"Confectionery\", and the "
        "team updates the product's category everywhere.\n\n"
        "What has gone wrong with historical reporting, and which technique "
        "prevents it?",
        [
            ("Sales made before the move now report under the new category; a "
             "Type 2 slowly changing dimension preserves the category in force "
             "at the time of each sale.", True),
            ("Sales made before the move are now orphaned; a foreign key "
             "constraint prevents the category from being changed.", False),
            ("Sales are double counted across both categories; a bridge table "
             "prevents the duplication.", False),
            ("Nothing has gone wrong; a fact table is expected to reflect the "
             "current state of its dimensions.", False),
        ],
        "Overwriting the category rewrites history: last year's sales silently "
        "move to a category they were never sold under. A Type 2 dimension "
        "inserts a new dimension row with validFrom/validTo and a current "
        "flag, so each fact keeps pointing at the row that was current when it "
        "occurred. Nothing is orphaned and nothing is double counted — the "
        "figures still add up, which is what makes the error hard to notice.",
    ),

    # ------------------------------------------- Understanding of Security (+1)
    mcq(
        385, "HARD",
        "A risk has a single loss expectancy of 40,000 and an annual rate of "
        "occurrence of 0.25. A proposed safeguard costs 12,000 per year and "
        "would reduce the annual rate of occurrence to 0.05.\n\n"
        "Is the safeguard justified on a quantitative basis?",
        [
            ("No — it reduces annual loss expectancy by 8,000, which is less "
             "than its 12,000 annual cost.", True),
            ("Yes — it reduces annual loss expectancy by 30,000, comfortably "
             "exceeding its cost.", False),
            ("Yes — any safeguard that reduces the annual rate of occurrence "
             "by 80% is justified.", False),
            ("There is not enough information; the asset value must be known "
             "as well.", False),
        ],
        "Annual loss expectancy is single loss expectancy multiplied by the "
        "annual rate of occurrence: before, 40,000 × 0.25 = 10,000; after, "
        "40,000 × 0.05 = 2,000. The reduction is 8,000 a year against a cost "
        "of 12,000, so the safeguard loses 4,000 a year and is not justified "
        "on these figures alone. The percentage reduction is irrelevant "
        "without the money behind it, and asset value is already reflected in "
        "the single loss expectancy.",
    ),
]


def insert_question(db, item, order, points=1):
    """Writes the question, its type-specific config, and the exam link."""
    question_id = db.execute(text("""
        insert into public.questions
            (question_text, question_type, total_points, difficulty_level, lesson_id, created_at)
        values (:t, :qt, :p, :d, :l, now())
        returning question_id"""), {
        "t": item["question"],
        "qt": "CRITICAL_THINKING" if item["type"] == "PROGRAMMING" else item["type"],
        "p": points, "d": item["difficulty"], "l": item["lesson"],
    }).scalar()

    if item["type"] == "MCQ":
        for choice_text, is_correct in item["choices"]:
            db.execute(text("""
                insert into public.choices (choice_text, is_correct, explanation, question_id)
                values (:c, :ok, :e, :q)"""), {
                "c": choice_text, "ok": is_correct,
                "e": item["explanation"] if is_correct else None,
                "q": question_id,
            })

    elif item["type"] in ("SHORT_ANSWER", "DESCRIPTIVE"):
        # The two types are graded differently and the existing bank is
        # consistent about it: every SHORT_ANSWER row is EXACT_MATCH with a
        # variation list, every DESCRIPTIVE row is AI_SEMANTIC. A short answer
        # graded semantically would accept a paragraph where one term was
        # asked for.
        if item["type"] == "SHORT_ANSWER":
            method = "EXACT_MATCH"
            # Newline-joined, not comma-joined: the grader splits accepted
            # variations on a newline, so a comma-joined list is one dead
            # string rather than several accepted answers.
            variations = chr(10).join(item["variations"])
        else:
            method = "AI_SEMANTIC"
            variations = None
        answer = item["answer"]
        db.execute(text("""
            insert into public.text_question_configs
                (checking_method, correct_answer, accepted_variations, question_id)
            values (:m, :a, :v, :q)"""), {
            "m": method, "a": answer, "v": variations, "q": question_id,
        })
        for order_index, (name, max_points) in enumerate(item.get("rubric", []), start=1):
            db.execute(text("""
                insert into public.question_rubric_criteria
                    (display_order, max_points, name, question_id)
                values (:o, :mp, :n, :q)"""), {
                "o": order_index, "mp": max_points, "n": name, "q": question_id,
            })

    elif item["type"] == "PROGRAMMING":
        config_id = db.execute(text("""
            insert into public.programming_question_configs (starter_code, question_id)
            values (:s, :q) returning programming_question_config_id"""), {
            "s": item["starter"], "q": question_id,
        }).scalar()
        for input_data, expected, is_sample in item["tests"]:
            db.execute(text("""
                insert into public.programming_test_cases
                    (expected_output, input_data, is_sample, programming_question_config_id)
                values (:e, :i, :s, :c)"""), {
                "e": expected, "i": input_data, "s": is_sample, "c": config_id,
            })

    db.execute(text("""
        insert into public.exam_questions (display_order, points, exam_id, question_id)
        values (:o, :p, :e, :q)"""), {
        "o": order, "p": points, "e": EXAM_ID, "q": question_id,
    })
    return question_id


def main():
    db = SessionLocal()

    existing = db.execute(text(
        "select count(*) from public.exam_questions where exam_id = :e"),
        {"e": EXAM_ID}).scalar()
    if existing >= TARGET_ITEMS:
        print("exam already has %d items; nothing to add" % existing)
        return

    next_order = db.execute(text(
        "select coalesce(max(display_order), 0) from public.exam_questions where exam_id = :e"),
        {"e": EXAM_ID}).scalar()

    for item in ITEMS:
        next_order += 1
        question_id = insert_question(db, item, next_order)
        print("  %-14s lesson %-4s order %-3s -> question %s"
              % (item["type"], item["lesson"], next_order, question_id))

    total = db.execute(text(
        "select count(*) from public.exam_questions where exam_id = :e"),
        {"e": EXAM_ID}).scalar()
    db.execute(text("""
        update public.exams
           set total_questions = :n, duration_minutes = :d, updated_at = now()
         where exam_id = :e"""),
        {"n": total, "d": TARGET_DURATION_MINUTES, "e": EXAM_ID})
    db.commit()

    print()
    print("added %d items; exam now declares %d questions over %d minutes"
          % (len(ITEMS), total, TARGET_DURATION_MINUTES))


if __name__ == "__main__":
    main()
