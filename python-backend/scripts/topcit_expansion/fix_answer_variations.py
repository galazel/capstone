"""Repairs short-answer grading across the TOPCIT bank.

Two separate defects, both of which mark correct answers wrong:

  1. 106 EXACT_MATCH questions carry no accepted variations at all, so the
     learner must reproduce the stored string. A question whose answer is
     "Logical Link Control (LLC)" rejects "LLC".

  2. Every one of the 20 questions that DOES have variations stored them
     comma-joined. AssessmentAttemptService.matchesTextAnswer splits on a
     newline, so the whole list is compared as one long string and none of
     the variations has ever matched anything.

The matcher trims and lowercases before comparing, so nothing here needs case
or whitespace variants -- only genuinely different forms: acronym against
expansion, with and without an article, singular against plural, and the
alternate names a learner would reasonably write.

Dry run by default; --apply writes.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

CERTIFICATION_ID = 13
SEPARATOR = "\n"

#: question_id -> accepted forms. The stored correct answer is always accepted
#: by the matcher, so it need not be repeated here, though several entries do
#: repeat it harmlessly for readability.
VARIATIONS = {
    2178: ["problem domain", "the problem domain", "problem space"],
    2189: ["observation", "observing", "user observation", "field observation"],
    2200: ["shall", "the word shall", "\"shall\""],
    2201: ["user story", "user stories", "a user story"],
    2212: ["inspection", "inspections", "formal inspection",
           "software inspection"],
    2213: ["are we building the right system", "are we building the right "
           "system?", "are we building the right product",
           "are we building the right product?"],
    2214: ["homonym", "homonyms", "a homonym"],
    2225: ["rtm", "requirements traceability matrix", "traceability matrix"],
    2232: ["organization and prioritization", "organisation and "
           "prioritisation", "organizing and prioritizing",
           "prioritization and organization"],
    2238: ["encapsulation", "information hiding", "data encapsulation"],
    2250: ["layered architecture", "layering", "layered",
           "layered architectural style", "layered pattern"],
    2262: ["pascalcase", "pascal case", "upper camel case", "uppercamelcase"],
    2272: ["verify individual components in isolation",
           "to verify individual components in isolation",
           "test individual components in isolation",
           "testing components in isolation"],
    2273: ["acceptance testing", "acceptance test",
           "user acceptance testing", "uat"],
    2283: ["adaptive maintenance", "adaptive"],
    2284: ["perfective maintenance", "perfective"],
    2311: ["testable", "testability", "verifiable"],
    2312: ["interview", "interviews", "interviewing",
           "stakeholder interview"],
    2313: ["change control", "change management", "change control process"],
    2334: ["abstraction", "abstracting"],
    2336: ["design principles", "design principle",
           "software design principles"],
    2352: ["uniqueness", "unique", "unique identification"],
    2359: ["requirements specification document",
           "requirements specification", "srs",
           "software requirements specification"],
    2362: ["rework", "reworking", "the rework", "rework cost"],
    2372: ["entity-relationship model", "entity relationship model",
           "er model", "e-r model", "erd"],
    2373: ["derived attribute", "derived", "a derived attribute"],
    2385: ["derived attribute", "derived", "a derived attribute"],
    2395: ["generalization", "generalisation",
           "generalization/specialization"],
    2407: ["physical layer", "the physical layer", "layer 1", "l1"],
    2408: ["to reduce electromagnetic interference",
           "reduce electromagnetic interference", "to reduce emi",
           "reduce emi", "to reduce interference"],
    2417: ["mac address", "mac", "media access control address",
           "physical address", "hardware address"],
    2422: ["llc", "logical link control", "logical link control (llc)",
           "llc sublayer", "the llc sublayer"],
    2430: ["service id", "serviceid", "service identifier"],
    2431: ["transport layer", "the transport layer", "layer 4", "l4"],
    2443: ["machine-to-machine", "machine to machine", "m2m"],
    2444: ["ts 102 692", "etsi ts 102 692", "102 692"],
    2489: ["layered architecture", "layering", "layered",
           "layered architectural style", "layered pattern"],
    2503: ["validation", "validating", "requirements validation"],
    2506: ["layered architecture", "layering", "layered",
           "layered architectural style", "layered pattern"],
    2508: ["elicitation", "requirements elicitation", "eliciting"],
    2509: ["project failure or misaligned solutions", "project failure",
           "misaligned solutions", "project failure and misaligned solutions"],
    2510: ["abstraction", "abstracting"],
    2568: ["logical data modeling", "logical data modelling",
           "logical modeling", "logical model"],
    2569: ["weak entity", "weak entity type", "a weak entity"],
    2576: ["uri", "uniform resource identifier"],
    2577: ["<contentinstance>", "contentinstance", "content instance",
           "contentinstance resource"],
    2587: ["confidentiality", "confidential"],
    2588: ["authentication", "authenticating", "user authentication"],
    2599: ["asset identification", "identifying assets",
           "identification of assets", "asset identification and valuation"],
    2609: ["top-down method", "top down method", "top-down",
           "top-down approach"],
    2623: ["seven", "7"],
    2634: ["do phase", "do", "the do phase"],
    2654: ["resource management", "it resource management",
           "resource management function"],
    2655: ["chief information officer", "cio"],
    2658: ["matrix it structure", "matrix structure", "matrix",
           "matrix organization", "matrix organisation"],
    2666: ["relevant", "relevance", "r in smart"],
    2667: ["leading indicator", "leading indicators", "a leading indicator"],
    2671: ["monthly revenue", "revenue per month", "monthly sales revenue"],
    2680: ["5 whys technique", "5 whys", "five whys", "the 5 whys", "5-whys"],
    2691: ["technical architecture document", "architecture document", "tad"],
    2692: ["archival", "archiving", "archive", "archival phase"],
    2723: ["ts 102 690", "etsi ts 102 690", "102 690"],
    2750: ["integrity", "data integrity"],
    2751: ["availability", "available"],
    2778: ["iso/iec 27001", "iso 27001", "iso27001", "iso/iec27001", "27001"],
    2779: ["plan-do-check-act", "plan do check act", "pdca", "pdca cycle",
           "the pdca cycle"],
    2803: ["it governance", "governance"],
    2804: ["service delivery", "it service delivery",
           "service delivery function"],
    2823: ["alignment with strategic goals", "strategic alignment",
           "alignment with strategy", "alignment to strategic goals"],
    2824: ["to measure progress toward business objectives",
           "measure progress toward business objectives",
           "to measure progress towards business objectives",
           "measure progress towards business objectives"],
    2849: ["business problem", "a business problem", "business problems"],
    2850: ["strategic problem", "a strategic problem", "strategic problems"],
    2851: ["define the problem", "defining the problem", "problem definition",
           "define problem"],
    2872: ["physical layer", "the physical layer", "layer 1", "l1"],
    2873: ["mac address", "mac", "media access control address",
           "physical address", "hardware address"],
    2927: ["implement corrective and preventive actions",
           "corrective and preventive actions",
           "corrective and preventive action",
           "take corrective and preventive actions", "capa"],
    2928: ["define the scope and boundaries",
           "defining the scope and boundaries",
           "define scope and boundaries", "scope and boundaries"],
    2952: ["key performance indicator", "kpi", "key performance indicators",
           "kpis"],
    2954: ["strategic problems", "strategic problem"],
    2973: ["it governance", "governance"],
    2989: ["rfq", "request for quote", "request for quotation",
           "request for quote (rfq)"],
    3001: ["pest analysis", "pest", "pestle analysis", "pestel analysis"],
    3002: ["appendices", "appendix", "the appendices"],
    3012: ["problem or opportunity statement", "problem statement",
           "opportunity statement", "problem/opportunity statement"],
    3013: ["cto", "chief technology officer", "chief technical officer"],
    3023: ["resource strategy", "resourcing strategy",
           "resource management strategy"],
    3025: ["risk and uncertainty", "risks and uncertainties", "risk",
           "uncertainty"],
    3035: ["finish-to-start", "finish to start", "fs",
           "finish-to-start (fs)"],
    3036: ["float", "slack", "total float", "float or slack"],
    3046: ["system requirements specification", "srs",
           "system requirement specification"],
    3047: ["shall", "the word shall", "\"shall\""],
    3056: ["reliability", "reliable"],
    3060: ["mtbf / (mtbf + mttr)", "mtbf/(mtbf+mttr)", "mtbf / (mtbf+mttr)",
           "mtbf/(mtbf + mttr)"],
    3084: ["requirements document", "requirements documentation",
           "the requirements document"],
    3085: ["fr:", "fr", "fr-", "\"fr:\""],
    3086: ["process and procedure document",
           "process and procedures document", "process document",
           "procedure document"],
    3087: ["requirements state what, design describes how",
           "requirements state what design describes how",
           "requirements say what, design says how", "what vs how"],
    3125: ["agile", "agile methodology", "agile method",
           "agile development"],
    3126: ["requirements specification", "requirement specification", "srs",
           "requirements specification document"],
    3128: ["schedule baseline", "the schedule baseline", "baseline schedule"],
    3151: ["response time", "response-time", "system response time"],
    3152: ["system requirements specification", "srs",
           "system requirement specification"],
    3177: ["requirements document", "requirements documentation",
           "the requirements document"],
    3179: ["market analysis", "market analysis section",
           "the market analysis"],
    3192: ["design and specification documents",
           "design and specification document", "design and specification",
           "design documents and specification documents"],
    3194: ["requirements phase", "the requirements phase",
           "requirements gathering phase", "requirement phase"],
}


def main():
    apply_changes = "--apply" in sys.argv
    db = SessionLocal()
    print("mode: %s\n" % ("APPLY" if apply_changes else "DRY RUN"))

    rows = db.execute(text("""
        select q.question_id, c.correct_answer, c.accepted_variations
          from public.text_question_configs c
          join public.questions q on q.question_id = c.question_id
          join public.lessons l on l.lesson_id = q.lesson_id
          join public.middle_categories mi
            on mi.middle_category_id = l.middle_category_id
          join public.major_categories mj
            on mj.major_category_id = mi.major_category_id
         where mj.certification_id = :c and c.checking_method = 'EXACT_MATCH'
         order by q.question_id"""), {"c": CERTIFICATION_ID}).fetchall()

    resplit = added = untouched = missing = 0

    for question_id, answer, stored in rows:
        if stored and SEPARATOR not in stored and "," in stored:
            # Written comma-joined by an earlier script, so the grader has been
            # comparing the whole line as a single variation. Split it back out.
            parts = [p.strip() for p in stored.split(",") if p.strip()]
            new_value = SEPARATOR.join(parts)
            resplit += 1
            print("q%-6s re-split %d comma-joined variation(s)"
                  % (question_id, len(parts)))
            if apply_changes:
                db.execute(text("""
                    update public.text_question_configs
                       set accepted_variations = :v
                     where question_id = :q"""),
                    {"v": new_value, "q": question_id})
            continue

        if stored:
            untouched += 1
            continue

        forms = VARIATIONS.get(question_id)
        if not forms:
            missing += 1
            print("q%-6s NO VARIATIONS AUTHORED for %r" % (question_id, answer))
            continue

        added += 1
        print("q%-6s %-38s + %d form(s)"
              % (question_id, answer[:38], len(forms)))
        if apply_changes:
            db.execute(text("""
                update public.text_question_configs
                   set accepted_variations = :v
                 where question_id = :q"""),
                {"v": SEPARATOR.join(forms), "q": question_id})

    if apply_changes:
        db.commit()

    print("\n%d re-split, %d given variations, %d already correct, "
          "%d still without" % (resplit, added, untouched, missing))
    if not apply_changes:
        print("dry run -- re-run with --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
