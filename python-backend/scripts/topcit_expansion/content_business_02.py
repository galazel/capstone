"""Understanding of IT Business -> IT Business Fundamentals (MID 126).

Completes the category at five lessons: how IT capability is acquired, and who
does the work. Rebuilt to the format the system's own lessons use -- roughly
4,900 words over 28-40 sections, about 46 blocks, diagrams where a picture does
the explaining, and no coloured card grids.

Scoped deliberately away from Project Management's "Technical Proposal
Evaluation" (403) and "Partnership and Subcontract Management" (404), which
cover evaluating a bid and running a subcontract. These lessons cover the
decision made before either.

Written against TOPCIT ESSENCE Business Field (Ver.2), section "Understanding
of IT Business Adoption".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_BIZ_FUNDAMENTALS = 126

SDLC_DIAGRAM = "/lesson-media/total-cost-of-ownership.svg"
OUTSOURCE_DIAGRAM = "/lesson-media/outsourcing-drivers.svg"
# ===========================================================================
# IT Business Adoption: In-House Development versus Packages
# ===========================================================================

_adopt_sections = [
    ("The Decision Before Every Other Decision", [
        desc(
            "Before an organisation can plan a delivery, it must decide how "
            "the capability will be obtained at all: written from scratch, "
            "bought as a package, subscribed to as a service, or assembled "
            "from some mixture of the three."
        ),
        desc(
            "Everything downstream follows from that choice -- cost profile, "
            "timeline, risk, the skills the organisation must retain, and how "
            "hard it will be to leave in five years. It is frequently made by "
            "default rather than deliberately, by whoever happens to be asked "
            "first."
        ),
    ]),

    ("Four Options, Not Two", [
        desc(
            "Framing this as build-versus-buy hides two options that are often "
            "the right answer, so it is worth naming all four explicitly."
        ),
        sub("In-house development"),
        desc(
            "Written by the organisation's own staff. Maximum fit and maximum "
            "control, and permanent ownership of every line of it -- including "
            "security patching, dependency updates and retaining people who "
            "understand it after the authors leave."
        ),
        sub("Commercial package"),
        desc(
            "Licensed software installed and configured. Embodies industry "
            "practice, comes with a support arrangement and a predictable "
            "upgrade path, and requires the organisation to adapt to how the "
            "package thinks."
        ),
        sub("Software as a service"),
        desc(
            "Subscribed rather than installed. Lowest operational burden and "
            "fastest to start; least control over the roadmap, the data "
            "location and the commercial terms, all of which the vendor may "
            "change."
        ),
        sub("Contracted development"),
        desc(
            "Bespoke software built by a supplier. The fit of in-house work "
            "without needing a standing team, at the cost of having to specify "
            "it well enough for somebody outside the organisation to build it "
            "correctly."
        ),
    ]),

    ("What Actually Drives the Choice", [
        ul([
            "Differentiation: is this process what makes the organisation "
            "competitive, or the same work every organisation does?",
            "Fit: how far is the standard package from what is genuinely "
            "required, as opposed to merely from what is familiar?",
            "Time: a package can be live in months and bespoke development "
            "rarely can",
            "Total cost over the whole life, not the purchase price -- "
            "licences and support recur, and so does maintaining your own code",
            "Capability: does the organisation have, and want to keep, the "
            "skills to build and maintain this for a decade?",
            "Exit: how hard would it be to move away in five years, and what "
            "would that cost?",
        ]),
    ]),

    ("The Differentiation Test", [
        desc(
            "The single most useful question is whether the process is a "
            "source of competitive advantage. Payroll, general ledger and "
            "expense claims are the same in every organisation, and one doing "
            "them differently is not winning -- it is merely different, and "
            "paying for the privilege."
        ),
        desc(
            "A pricing engine, a proprietary routing algorithm or a "
            "distinctive customer experience may genuinely be what the "
            "business competes on. Buying a package for those means acquiring "
            "the same capability every competitor can buy, which surrenders "
            "the advantage in exchange for a support contract."
        ),
    ]),

    ("Applying the Test Honestly", [
        desc(
            "Applied consistently, this test resolves most build-buy "
            "arguments, because the honest answer is that very few processes "
            "in any organisation are actually differentiating."
        ),
        desc(
            "The difficulty is that everyone believes their own area is the "
            "exception, and 'our business is different' is said in every "
            "organisation about every process. The test only works if somebody "
            "with authority is prepared to say no to that claim and ask what "
            "specifically the difference wins."
        ),
    ]),

    ("Fit-Gap Analysis", [
        desc(
            "A fit-gap analysis compares required capability against what a "
            "candidate package provides. Its value lies entirely in honesty "
            "about which gaps matter, and its failure mode is that every gap "
            "is classified as critical by whoever raised it."
        ),
        ol([
            "Fit: the package does this as required, with no change",
            "Configuration gap: closed by configuring the package as its "
            "designers intended -- cheap and upgrade-safe",
            "Workaround gap: closed by changing the business process instead, "
            "which costs nothing in licence terms and costs real change "
            "management effort",
            "Customisation gap: closed only by modifying the package, which is "
            "expensive up front and again at every upgrade",
            "Genuine blocker: the package cannot do it and the requirement "
            "cannot move, which should eliminate that package from "
            "consideration entirely",
        ]),
    ]),

    ("Mandatory and Desirable", [
        desc(
            "The classification only means something if mandatory and "
            "desirable requirements were separated BEFORE the evaluation "
            "began. Made afterwards, that judgement bends to whichever answer "
            "the room already wants."
        ),
        desc(
            "If everything is mandatory then scoring is meaningless and every "
            "candidate fails, so the exercise becomes a negotiation about "
            "which requirements to quietly downgrade -- which is precisely the "
            "conversation the separation was supposed to have forced earlier "
            "and more honestly."
        ),
    ]),

    ("The Customisation Trap", [
        desc(
            "The pattern is consistent enough to be predictable. An "
            "organisation selects a package specifically for its embodied best "
            "practice, then customises it extensively to preserve existing "
            "processes -- thereby paying to keep the very inefficiency the "
            "purchase was meant to remove."
        ),
        desc(
            "Every subsequent vendor upgrade must then be reconciled with the "
            "modifications and retested, which turns a routine upgrade into a "
            "project. Deferred often enough, the installation freezes several "
            "versions behind, losing security patches and eventually vendor "
            "support entirely."
        ),
    ]),

    ("The Discipline That Avoids It", [
        desc(
            "Change the process to fit the package unless the process is "
            "genuinely differentiating. The rule is stated easily and applied "
            "rarely, because applying it means telling departments that their "
            "established way of working is going to change."
        ),
        desc(
            "Where an organisation cannot bring itself to do that, the honest "
            "conclusion is usually that it should have built rather than "
            "bought. Heavy customisation is the worst of both options: you pay "
            "to build AND inherit somebody else's upgrade cycle."
        ),
    ]),

    ("Total Cost of Ownership", [
        desc(
            "Comparing a licence fee against a development estimate compares "
            "two things that are not comparable. Total cost of ownership "
            "counts everything over the life of the system, and the SHAPE of "
            "the two cost curves differs as much as their totals."
        ),
        image(SDLC_DIAGRAM),
    ]),

    ("The Three Cost Shapes", [
        tabs([
            ("Build", "In-house or contracted build",
             "High initial cost concentrated in development, then a permanent "
             "maintenance obligation: bug fixes, dependency updates, security "
             "patching, and the staff who understand it. The cost never ends, "
             "and it depends on retaining knowledge that walks out of the door "
             "at intervals."),
            ("Buy", "Licensed package",
             "Lower initial build cost but licence, support and upgrade fees "
             "recurring indefinitely, plus substantial implementation and "
             "configuration effort. Predictable, and largely outside your "
             "control once the organisation depends on it."),
            ("Subscribe", "Software as a service",
             "Little up-front cost and a per-user or per-usage fee that scales "
             "with the business -- pleasant while small and occasionally "
             "alarming later. Upgrades are included and unavoidable, and "
             "pricing changes are the vendor's decision rather than a "
             "negotiation."),
        ]),
    ]),

    ("ISO/IEC 12207", [
        desc(
            "ISO/IEC 12207 is the international standard for software life "
            "cycle processes. It matters in this lesson because it provides a "
            "common vocabulary between an acquirer and a supplier."
        ),
        desc(
            "Both sides can point at the same named processes rather than "
            "arguing about what a phase includes or whose responsibility a "
            "particular activity was -- a dispute that consumes a remarkable "
            "amount of contract management time when no shared definition "
            "exists."
        ),
    ]),

    ("The Process Groups", [
        accordion([
            ("Agreement processes",
             "Acquisition and supply: how a customer acquires a product or "
             "service and how a supplier provides it. This is the pair that "
             "governs the buy decision itself and the relationship that "
             "follows."),
            ("Organisational project-enabling processes",
             "Infrastructure, portfolio, human resource and quality "
             "management -- the standing capabilities that make individual "
             "projects possible at all, and whose absence makes every project "
             "reinvent them."),
            ("Technical management processes",
             "Project planning, assessment and control, decision management, "
             "risk, configuration and information management."),
            ("Technical processes",
             "The engineering work itself: requirements, architecture, design, "
             "implementation, integration, verification, transition, "
             "operation, maintenance and disposal."),
        ]),
    ]),

    ("Tailoring", [
        desc(
            "The standard is explicit that its processes are to be tailored: "
            "selected, adapted and scaled to the project rather than applied "
            "wholesale. A two-month internal tool and a national payments "
            "platform do not warrant the same process weight."
        ),
        desc(
            "Applying the full standard to the former is exactly the sort of "
            "ceremony that discredits process altogether and teaches teams to "
            "route around it. Tailoring is a feature of the standard rather "
            "than a compromise of it."
        ),
    ]),

    ("Tailoring Must Be Recorded", [
        desc(
            "'Tailored' should mean deliberately reduced with a stated reason, "
            "not quietly skipped because nobody had time. The difference is "
            "invisible while things go well and extremely visible during an "
            "audit or a dispute."
        ),
        desc(
            "A recorded tailoring decision -- this process is omitted because "
            "the project is small and the risk is low, approved by this person "
            "-- is a defensible judgement. An unrecorded omission is "
            "indistinguishable from negligence after an incident, regardless "
            "of how sensible it was at the time."
        ),
    ]),

    ("The Acquisition Process", [
        ol([
            "Define the need in business terms, before any product is under "
            "discussion",
            "Establish requirements, distinguishing mandatory from desirable "
            "so that scoring means something",
            "Survey the market and shortlist realistic candidates",
            "Issue a request for information or proposal and evaluate against "
            "the stated criteria",
            "Perform fit-gap analysis and, where possible, a proof of concept "
            "against real data rather than a vendor demonstration",
            "Negotiate and contract, covering support, upgrades, data "
            "ownership and exit",
            "Implement, migrate and transition into operation",
        ]),
    ]),

    ("Requirements Written Around a Product", [
        desc(
            "A recurring failure is writing requirements AFTER a preferred "
            "product has been chosen, which produces a specification only that "
            "product satisfies. It happens more often than anyone admits, "
            "usually because a senior person saw a demonstration."
        ),
        desc(
            "It wastes every other bidder's time, produces a procurement that "
            "cannot withstand scrutiny, and -- most damaging of all -- means "
            "nobody ever established what was actually needed. Requirements "
            "must precede product selection and be written in terms of "
            "capability rather than of features named in a brochure."
        ),
    ]),

    ("Exit and Lock-In", [
        desc(
            "Lock-in is the cost of leaving, and it is almost never assessed "
            "at purchase because leaving is not on anyone's mind while a "
            "contract is being signed and a project is being celebrated."
        ),
        desc(
            "It accumulates quietly through proprietary data formats, "
            "integrations built against a specific API, staff whose skills "
            "become product-specific, and contractual terms that make "
            "extraction slow or expensive."
        ),
    ]),

    ("Managing Lock-In Deliberately", [
        ul([
            "Establish who owns the data and in what format it can be "
            "extracted -- in the contract, rather than discovering it "
            "afterwards",
            "Prefer open or documented formats and standard interfaces where "
            "the choice exists",
            "Ask what a migration away would cost before signing, while you "
            "still have negotiating leverage",
            "Recognise that lock-in is sometimes an acceptable trade: what is "
            "required is an informed decision rather than avoidance at any "
            "price",
        ]),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Comparing licence cost against development cost",
             "These are different shapes as well as different totals. Total "
             "cost of ownership over the system's life is the only comparable "
             "figure, and it must include maintenance for the build option and "
             "recurring fees for the buy option."),
            ("Customising a package to preserve existing processes",
             "This capitalises the inefficiency the package was bought to "
             "remove and makes every upgrade a reconciliation exercise. If the "
             "process truly cannot change, the organisation should have "
             "built."),
            ("Writing requirements after choosing the product",
             "It produces a specification only one product meets, and means "
             "nobody established the actual need. Requirements come first, "
             "expressed as capabilities."),
            ("Treating desirable requirements as mandatory",
             "If everything is mandatory, scoring is meaningless and every "
             "candidate fails. The separation must be made before the "
             "evaluation, not during it."),
            ("Ignoring exit cost at purchase",
             "Leverage is at its maximum before signing and its minimum "
             "afterwards. Data ownership and extraction terms belong in the "
             "original contract."),
            ("Assuming 'our business is different'",
             "It is said in every organisation about every process. The test "
             "is what specifically the difference wins, and the honest answer "
             "is usually nothing."),
        ]),
    ]),

    ("Practical Example: A Package That Fits 80%", [
        desc(
            "An organisation evaluates a package against 200 requirements. It "
            "meets 160 outright, 25 through configuration, 10 through a "
            "process change, and misses 5 entirely."
        ),
        desc(
            "Every instinct in the user community is to customise for the 15 "
            "that are not clean fits, and a vendor happy to quote for that "
            "work will encourage it. Working through the categories properly "
            "produces a different answer."
        ),
    ]),

    ("Working Through the Gaps", [
        ul([
            "The 25 configuration gaps are free in the sense that matters: "
            "they use the package as designed and survive upgrades untouched",
            "The 10 workaround gaps cost change management rather than money, "
            "and each should be tested against the differentiation question -- "
            "is this process actually special, or merely familiar?",
            "The 5 genuine misses are the decision point. If any is truly "
            "mandatory and truly cannot move, this package is eliminated, and "
            "no amount of customisation budget changes that conclusion "
            "honestly",
            "If all 5 turn out to be desirable rather than mandatory, the "
            "package is a good fit and the remaining discussion is really "
            "about reluctance to change",
        ]),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "The four acquisition options and their trade-offs",
            "The differentiation test applied to a scenario",
            "Fit-gap categories, especially configuration versus customisation",
            "Why heavy customisation defeats the purpose of buying",
            "Total cost of ownership versus purchase price",
            "ISO/IEC 12207 process groups and the purpose of tailoring",
            "Why requirements must precede product selection",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Four acquisition options: in-house, package, SaaS, contracted "
            "development",
            "Buy for commodity processes, build only for differentiating ones",
            "Fit-gap classifies each requirement as fit, configuration, "
            "workaround, customisation or blocker",
            "Heavy customisation defeats the purpose of buying and freezes you "
            "behind on versions",
            "ISO/IEC 12207 defines software life cycle processes and is "
            "explicitly intended to be tailored -- and the tailoring recorded",
            "Compare total cost of ownership, never purchase price against a "
            "build estimate",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "How capability is acquired determines cost shape, risk and exit "
            "options, and is often decided by default",
            "The differentiation test resolves most build-buy arguments, and "
            "very few processes are genuinely differentiating",
            "Fit-gap analysis is only useful if mandatory and desirable were "
            "separated beforehand",
            "Customising a package to preserve existing processes is the "
            "characteristic expensive mistake, and freezes you behind on "
            "versions",
            "ISO/IEC 12207 gives acquirer and supplier a shared vocabulary, "
            "tailored to the project's weight and recorded",
            "Requirements precede product selection, and exit terms are "
            "negotiated while you still have leverage",
        ]),
    ]),
]

_adopt_quiz = [
    mcq("EASY",
        "Which question best resolves whether to build software in-house or "
        "buy a package?",
        [("Is this process a source of competitive advantage, or the same work "
          "every organisation does?", True),
         ("Which option has the lower purchase price this financial "
          "year?", False),
         ("Does the organisation currently employ developers with spare "
          "capacity?", False),
         ("Has a competitor already implemented a similar system?", False)],
        "Buying a package means adopting the same capability competitors can "
        "buy, which is entirely fine for commodity processes and damaging for "
        "the ones you compete on. Purchase price ignores lifetime cost, spare "
        "developer capacity is a temporary condition rather than a strategy, "
        "and what a competitor did tells you nothing about your own "
        "differentiation."),
    mcq("EASY",
        "In a fit-gap analysis, which gap category is closed by configuring "
        "the package as its designers intended?",
        [("Configuration gap", True), ("Customisation gap", False),
         ("Workaround gap", False), ("Blocker", False)],
        "A configuration gap uses supported settings, so it is cheap and "
        "survives upgrades untouched. A customisation gap requires modifying "
        "the package itself, a workaround gap is closed by changing the "
        "business process, and a blocker means the package cannot meet a "
        "mandatory requirement at all and should eliminate it."),
    mcq("AVERAGE",
        "Why does heavy customisation of a purchased package tend to leave an "
        "organisation several versions behind?",
        [("Every vendor upgrade must be reconciled with the modifications and "
          "retested, so upgrades become expensive enough to defer.", True),
         ("Vendors withdraw support for customised installations "
          "entirely.", False),
         ("Customised modules are technically incompatible with any newer "
          "version.", False),
         ("Licence terms prohibit upgrading a modified installation.", False)],
        "Each modification is code sitting between the organisation and the "
        "vendor's release, and reapplying and retesting it turns a routine "
        "upgrade into a project. Deferred often enough, the gap becomes large "
        "enough that upgrading is effectively a migration. Vendors generally "
        "still support the base product, incompatibility is not absolute, and "
        "licences do not forbid it."),
    mcq("AVERAGE",
        "An organisation compares a package's licence fee against the "
        "estimated cost of building the same capability.\n\nWhat is wrong with "
        "this comparison?",
        [("It omits lifetime costs on both sides: recurring support and "
          "upgrade fees for the package, and permanent maintenance for the "
          "build.", True),
         ("Licence fees are commercially confidential and cannot be compared "
          "fairly.", False),
         ("Build estimates are always understated, so the comparison "
          "systematically favours building.", False),
         ("The comparison is sound provided both figures cover the first "
          "year.", False)],
        "Neither figure is the real cost. A package carries support, upgrade "
        "and implementation costs indefinitely; bespoke software carries a "
        "permanent maintenance obligation including security patching and "
        "retaining people who understand it. Total cost of ownership over the "
        "system's life is the only comparable measure, and a single year "
        "captures the least representative part of either curve."),
    mcq("AVERAGE",
        "Why must requirements be defined before a preferred product is "
        "selected?",
        [("Requirements written afterwards describe the chosen product rather "
          "than the actual need, so nobody establishes what was really "
          "required.", True),
         ("Procurement regulations require requirements to be dated before any "
          "vendor contact.", False),
         ("Vendors will not respond to a proposal unless requirements are "
          "supplied first.", False),
         ("Requirements written after selection cannot be used in the "
          "contract.", False)],
        "Reverse-engineering a specification from a chosen product produces "
        "criteria only that product satisfies, which makes the evaluation "
        "theatre, wastes every other bidder's time, and leaves the genuine "
        "need unexamined. Requirements should state capabilities in business "
        "terms. The other options describe procedural obstacles rather than "
        "the substantive problem."),
    mcq("AVERAGE",
        "What is the purpose of tailoring in ISO/IEC 12207?",
        [("Selecting, adapting and scaling the standard's processes to suit "
          "the size and risk of the particular project", True),
         ("Customising the delivered software to match the customer's existing "
          "processes", False),
         ("Adjusting the contract price as requirements change during "
          "delivery", False),
         ("Translating the standard into the acquirer's national "
          "language", False)],
        "The standard explicitly expects tailoring, because a two-month "
        "internal tool and a national payments platform do not warrant the "
        "same process weight -- and applying the full standard to the former "
        "is the sort of ceremony that discredits process entirely. Tailoring "
        "concerns the process rather than the software, the price or the "
        "language, and the decisions should be recorded."),
    mcq("HARD",
        "A package meets 160 of 200 requirements outright, 25 by "
        "configuration, 10 by process change, and misses 5.\n\nWhat determines "
        "whether it should be selected?",
        [("Whether any of the 5 misses is genuinely mandatory and genuinely "
          "cannot move", True),
         ("Whether the customisation budget can cover all 15 non-fitting "
          "requirements", False),
         ("Whether 80% outright fit exceeds the organisation's minimum "
          "threshold", False),
         ("Whether the 10 process changes can be avoided through "
          "configuration", False)],
        "Configuration gaps and workarounds are normal and manageable. The "
        "decision turns entirely on the genuine misses: if one is truly "
        "mandatory and truly immovable, the package is eliminated regardless "
        "of how well it scores elsewhere. Sizing a customisation budget to "
        "close them is precisely the trap. A percentage threshold treats all "
        "requirements as equal, which they are not."),
    mcq("HARD",
        "Why should exit and data extraction terms be negotiated before "
        "signing rather than when leaving?",
        [("Negotiating leverage is at its maximum before commitment and "
          "minimal once the organisation depends on the system.", True),
         ("Contract law prevents adding extraction clauses after "
          "signature.", False),
         ("Data formats cannot be changed once a system holds production "
          "data.", False),
         ("Regulators require exit terms to be agreed at "
          "procurement.", False)],
        "Before signing, the vendor wants the business and terms are "
        "negotiable; afterwards, the organisation's data, processes and "
        "trained staff are inside the product and the vendor knows migration "
        "is expensive and slow. Terms can be renegotiated later in principle, "
        "but from a far weaker position. Format and regulation are not the "
        "governing constraints."),
    short_answer("EASY",
        "Which international standard defines software life cycle processes "
        "and provides shared vocabulary between acquirer and supplier?",
        "ISO/IEC 12207",
        ["iso/iec 12207", "iso 12207", "iso/iec12207", "12207"]),
    short_answer("AVERAGE",
        "What term describes selecting, adapting and scaling a standard's "
        "processes to suit a particular project?",
        "Tailoring",
        ["tailoring", "tailor", "process tailoring", "tailoring process"]),
    descriptive("HARD",
        "Explain the differentiation test for build-versus-buy decisions, and "
        "describe what goes wrong when an organisation buys a package and then "
        "customises it heavily.",
        "The differentiation test asks whether the process in question is a "
        "genuine source of competitive advantage or work that every "
        "organisation in the sector performs in much the same way. Payroll, "
        "general ledger, expense claims and similar functions are commodity: "
        "doing them differently wins nothing, so a package embodying standard "
        "practice is the right choice, and the organisation gains supported "
        "software, a predictable upgrade path and a far shorter timeline. "
        "Where a process genuinely differentiates -- a proprietary pricing "
        "engine, a distinctive customer experience, an algorithm that is the "
        "reason customers choose you -- buying a package means acquiring "
        "exactly the same capability every competitor can buy, which "
        "surrenders the advantage in exchange for a support contract. Applied "
        "honestly the test resolves most build-buy arguments, because very few "
        "processes in any organisation are actually differentiating, though "
        "everyone believes their own area is the exception. Heavy "
        "customisation is what happens when the test is not applied honestly. "
        "An organisation selects a package specifically for its embodied best "
        "practice, then modifies it extensively so that existing processes can "
        "continue unchanged. This fails twice over. First, it pays substantial "
        "money to preserve precisely the inefficiency the purchase was "
        "intended to remove, so the benefits in the business case never "
        "arrive. Second, every subsequent vendor upgrade must be reconciled "
        "with the modifications and retested, which turns routine upgrades "
        "into projects; deferred repeatedly, the installation drifts several "
        "versions behind, losing security patches and eventually vendor "
        "support, and requiring a migration rather than an upgrade to recover. "
        "The organisation ends with the costs of building and the constraints "
        "of buying. If the processes truly cannot change, the honest "
        "conclusion was that it should have built in the first place.",
        [("Explains the differentiation test and applies it to commodity "
          "versus competitive processes", 4),
         ("Explains that customisation preserves the inefficiency the purchase "
          "was to remove", 3),
         ("Explains the upgrade reconciliation burden and version drift", 3)]),
]

LESSON_ADOPTION = {
    "middle": MID_BIZ_FUNDAMENTALS,
    "name": "IT Business Adoption: In-House Development versus Packages",
    "quiz": _adopt_quiz,
    "structure": lesson_structure(
        "IT Business Adoption: In-House Development versus Packages",
        "Before anything is planned or delivered, an organisation has to "
        "decide how the capability will be obtained at all -- and that choice "
        "determines cost shape, timeline, risk and exit options more than any "
        "later decision does. This lesson covers the four acquisition options, "
        "the differentiation test that resolves most build-buy arguments and "
        "why it is so often dodged, how fit-gap analysis works and where "
        "organisations deceive themselves with it, why customising a purchased "
        "package is the characteristic expensive mistake, what total cost of "
        "ownership actually includes, and the acquisition process ISO/IEC "
        "12207 gives a shared vocabulary for.",
        [
            "Identify the four ways IT capability is acquired and the "
            "trade-offs of each",
            "Apply the differentiation test to a build-versus-buy decision and "
            "recognise when it is being dodged",
            "Perform a fit-gap analysis and classify gaps correctly",
            "Explain why mandatory and desirable must be separated before "
            "evaluation",
            "Explain why heavy customisation defeats the purpose of buying a "
            "package",
            "Compare options on total cost of ownership rather than purchase "
            "price, including the shape of each cost curve",
            "Describe ISO/IEC 12207's process groups and why tailoring must be "
            "recorded",
            "Explain why requirements must precede product selection",
            "Explain lock-in and when exit terms must be negotiated",
        ],
        55,
        _adopt_sections,
        [
            ("In-house development",
             "Software written by the organisation's own staff: maximum fit "
             "and control, permanent ownership of maintenance."),
            ("Commercial package",
             "Licensed software embodying industry practice, with support and "
             "an upgrade path, requiring adaptation to how it works."),
            ("Software as a service",
             "Subscribed rather than installed: lowest operational burden, "
             "least control over roadmap, data location and pricing."),
            ("Fit-gap analysis",
             "Comparing requirements against a package, classifying each as "
             "fit, configuration, workaround, customisation or blocker."),
            ("Customisation trap",
             "Modifying a package to preserve existing processes, paying to "
             "keep the inefficiency and making every upgrade a reconciliation "
             "exercise."),
            ("Total cost of ownership",
             "All costs over the system's life, including maintenance for "
             "builds and recurring licence and support fees for packages."),
            ("ISO/IEC 12207",
             "The international standard for software life cycle processes, "
             "giving acquirer and supplier a shared vocabulary."),
            ("Tailoring",
             "Selecting, adapting and scaling a standard's processes to the "
             "project -- deliberately reduced with a recorded reason, not "
             "quietly skipped."),
            ("Differentiation test",
             "Asking whether a process is a competitive advantage or commodity "
             "work, which resolves most build-buy arguments."),
            ("Lock-in",
             "The accumulated cost of leaving a product: proprietary formats, "
             "bespoke integrations, product-specific skills and contract "
             "terms."),
        ],
        "How capability is acquired -- built in-house, contracted out, "
        "licensed as a package or subscribed as a service -- shapes cost, risk "
        "and exit far more than later decisions do, and it is frequently made "
        "by default. The differentiation test settles most of it: buy where "
        "you are the same as everyone else, build only where the process is "
        "genuinely why customers choose you, and be sceptical of every claim "
        "that a routine process is somehow special. Fit-gap analysis then "
        "classifies each requirement, and it only yields an honest answer if "
        "mandatory and desirable were separated beforehand rather than "
        "negotiated during. The characteristic failure is buying a package for "
        "its embodied practice and then customising it to preserve existing "
        "habits, which pays to keep the inefficiency and leaves the "
        "installation stranded several versions behind, unsupported. Compare "
        "options on total cost of ownership rather than purchase price, write "
        "requirements before choosing a product, tailor the process standard "
        "deliberately and record it, and negotiate the exit while you still "
        "have the leverage to do so."),
}


# ===========================================================================
# IT Outsourcing and Sourcing Models
# ===========================================================================

_out_sections = [
    ("Deciding Who Does the Work", [
        desc(
            "The previous lesson decided what to acquire. This one decides who "
            "performs the work: the organisation's own staff, a supplier, or "
            "some arrangement between the two."
        ),
        desc(
            "Outsourcing is a sourcing decision rather than a technology one, "
            "and it fails most often for reasons that have nothing to do with "
            "technology at all -- unclear requirements, absent governance, and "
            "an organisation that can no longer evaluate what it is being "
            "told."
        ),
    ]),

    ("Why Organisations Outsource", [
        ul([
            "Cost: converting fixed staffing cost into variable contracted "
            "cost, and accessing lower-cost labour markets",
            "Capability: obtaining skills the organisation does not have and "
            "could not justify employing permanently",
            "Focus: concentrating internal attention on what actually "
            "differentiates the business",
            "Capacity: scaling delivery up and down considerably faster than "
            "hiring and redundancy allow",
            "Risk transfer: moving delivery risk to a supplier -- which works "
            "far less completely than people expect",
        ]),
        image(OUTSOURCE_DIAGRAM),
    ]),

    ("Why Risk Transfer Disappoints", [
        desc(
            "Contracts transfer financial consequence. They do not transfer "
            "accountability, and the distinction becomes painfully clear "
            "during an incident."
        ),
        desc(
            "If an outsourced payroll run fails, the supplier may owe service "
            "credits -- but the organisation still has unpaid staff, a "
            "regulatory exposure and a reputational problem. Its employees and "
            "its regulator do not care whose contract was breached. "
            "Outsourcing changes who performs the work; it does not change who "
            "is answerable for it."
        ),
    ]),

    ("Sourcing Models by Location", [
        tabs([
            ("Onshore", "Onshore / domestic sourcing",
             "The supplier is in the same country. Highest labour cost and the "
             "fewest obstacles: same time zone, same language, same legal "
             "system, and face-to-face contact is practical when something "
             "goes badly wrong -- which is worth more than it sounds."),
            ("Nearshore", "Nearshore sourcing",
             "A nearby country with overlapping working hours and reasonably "
             "close culture and legal framework. The usual compromise: "
             "meaningful cost saving with most of the collaboration intact and "
             "a working day that overlaps enough for real conversation."),
            ("Offshore", "Offshore sourcing",
             "A distant, lower-cost country. Largest saving on rates and the "
             "largest coordination cost -- limited hour overlap, cultural and "
             "language distance, and different legal and data protection "
             "regimes that may complicate what data can be sent at all."),
            ("Multi-sourcing", "Multi-sourcing",
             "Distributing work across several suppliers deliberately, to "
             "avoid dependence on one and to use each where it is strongest. "
             "Costs considerably more to manage, and integration between "
             "suppliers becomes the client's problem by default."),
        ]),
    ]),

    ("Sourcing Models by Relationship", [
        desc("Where the supplier sits is a logistics question. How the "
             "relationship is structured is the question that decides who is "
             "accountable when delivery goes wrong, and it matters far more. "
             "The three common structures differ chiefly in how much delivery "
             "risk actually moves to the supplier."),
        accordion([
            ("Staff augmentation",
             "Contracted individuals work under the client's direction, "
             "filling gaps in a team the client still manages. Simple, "
             "flexible, and it transfers no delivery risk whatever -- if the "
             "project fails it is the client's failure, since the client made "
             "every decision."),
            ("Managed service",
             "The supplier delivers a defined service to agreed levels and "
             "decides how. The client specifies outcomes rather than methods, "
             "which is what makes real risk transfer possible -- and which "
             "requires the outcomes to be specified well enough to be "
             "measured."),
            ("Project outsourcing",
             "A defined scope delivered for a defined price. Works when "
             "requirements are stable and specifiable, and produces a stream "
             "of change requests and disputes when they are not, which is "
             "most of the time."),
            ("Business process outsourcing",
             "An entire business function -- payroll, service desk, claims "
             "handling -- is operated by the supplier. The deepest form, "
             "creating the greatest dependency and the hardest to reverse."),
            ("Build-operate-transfer",
             "The supplier establishes and runs a capability, then transfers "
             "it to the client after an agreed period. Used to enter a new "
             "market or establish a new site without permanent dependence on "
             "the supplier."),
        ]),
    ]),

    ("What Should Not Be Outsourced", [
        desc(
            "The differentiation test from the previous lesson applies again, "
            "with an important addition. Beyond genuinely competitive "
            "processes, an organisation must retain enough capability to be an "
            "intelligent customer."
        ),
        desc(
            "That means people who understand the domain well enough to "
            "specify work, judge quality, evaluate estimates, and recognise "
            "when they are being told something convenient rather than "
            "something true."
        ),
    ]),

    ("The Hollowing-Out Failure", [
        desc(
            "An organisation that outsources every technical role loses the "
            "ability to evaluate its supplier's proposals, estimates and "
            "explanations. When told that something is difficult and expensive, "
            "it has no basis on which to disagree."
        ),
        desc(
            "It becomes dependent in a way no contract clause repairs, because "
            "the missing thing is judgement rather than a deliverable. "
            "Retained capability is not overhead -- it is what makes the "
            "arrangement governable, and removing it is the decision that "
            "cannot be reversed cheaply."
        ),
    ]),

    ("Service Level Agreements", [
        desc(
            "An SLA states measurable service commitments and the consequence "
            "of missing them. Its entire value lies in being specific: "
            "'reasonable efforts to respond promptly' is unenforceable, and "
            "everyone signing it knows that perfectly well."
        ),
        ol([
            "Define each service precisely, including what is explicitly out "
            "of scope",
            "State metrics with numbers: availability percentage, response and "
            "resolution times by severity, throughput",
            "Define severity levels and who classifies an incident, since that "
            "judgement decides which target applies",
            "State the measurement method and who measures -- a target "
            "measured by the supplier from its own logs is weaker than it "
            "appears",
            "State remedies: service credits, escalation, and the threshold at "
            "which repeated failure permits termination",
            "Agree exclusions honestly, so that the target still means "
            "something in the circumstances where it matters most",
        ]),
    ]),

    ("The Watermelon SLA", [
        desc(
            "The first characteristic SLA failure is green on the outside and "
            "red on the inside: every metric is met while users are plainly "
            "and vocally unhappy."
        ),
        desc(
            "It happens because the metrics measure supplier ACTIVITY rather "
            "than user OUTCOME. Ticket response time can be excellent while "
            "nothing is ever actually fixed, and closure rate can be excellent "
            "if tickets are closed and immediately reopened -- which counts as "
            "two closures and one new ticket rather than one failure."
        ),
    ]),

    ("Measuring What Is Easy Rather Than What Matters", [
        desc(
            "The second failure is related and equally common. Availability of "
            "a server is easy to measure and largely irrelevant; whether the "
            "business process it supports could actually be completed is what "
            "the client cares about and is considerably harder to instrument."
        ),
        desc(
            "An SLA that optimises the supplier toward the wrong behaviour is "
            "worse than no SLA at all, because it makes the wrong behaviour "
            "contractually correct -- and a supplier behaving exactly as "
            "instructed cannot reasonably be blamed for the result."
        ),
    ]),

    ("eSCM", [
        desc(
            "The eSourcing Capability Model is a maturity framework for "
            "sourcing relationships, and unusually it comes in two halves. "
            "eSCM-SP assesses a service PROVIDER's capability to deliver "
            "sourced services; eSCM-CL assesses a CLIENT organisation's "
            "capability to source them well."
        ),
        desc(
            "That second half is the interesting one, because it names "
            "something organisations prefer not to discuss: outsourcing "
            "failures are frequently the client's fault. Unclear requirements, "
            "absent governance, no retained capability and unmanaged change "
            "produce failure regardless of how competent the supplier is, and "
            "a maturity model assessing only suppliers would miss it "
            "entirely."
        ),
    ]),

    ("The Sourcing Life Cycle", [
        ol([
            "Analysis: decide what to source and why, and establish the "
            "baseline cost and performance of doing it internally",
            "Initiation: select the supplier and negotiate the contract and "
            "service levels",
            "Delivery: manage the relationship, monitor performance and handle "
            "change",
            "Completion: transfer the service back in-house or to another "
            "supplier at the end of the term",
        ]),
    ]),

    ("Why the Baseline Matters", [
        desc(
            "The baseline established in the first stage is what makes "
            "evaluation possible later, and it is the stage most often "
            "skipped because it is unglamorous and slightly awkward."
        ),
        desc(
            "Without knowing what the function cost and how well it performed "
            "internally, an organisation cannot say afterwards whether "
            "outsourcing helped -- and most cannot. The result is renewal "
            "decisions made on impression rather than evidence, in both "
            "directions."
        ),
    ]),

    ("Governance of the Relationship", [
        desc(
            "Relationships fail when everything is escalated to one forum, or "
            "when there is no forum above the day-to-day. Three layers are "
            "needed and each does a different job."
        ),
        sub("Operational"),
        desc(
            "Day-to-day delivery, incidents and routine change. Meets "
            "frequently, resolves the great majority of matters, and should "
            "not be escalating routinely -- if it is, the layer above is not "
            "working."
        ),
        sub("Tactical"),
        desc(
            "Service performance against the SLA, capacity, continuous "
            "improvement, and problems the operational layer could not settle. "
            "Monthly is typical."
        ),
        sub("Strategic"),
        desc(
            "Whether the relationship still serves the organisation's "
            "direction, the commercial terms, and renewal or termination. "
            "Meets quarterly and is the layer most often absent -- which is "
            "why relationships drift on unexamined for years."
        ),
    ]),

    ("Transition In", [
        desc(
            "The two ends of a sourcing arrangement carry most of its risk, "
            "and both are chronically under-planned relative to the middle."
        ),
        desc(
            "Transition in is where knowledge must move from the people who "
            "hold it to the supplier -- and it must happen while those people "
            "are still employed and still motivated, which is not automatic "
            "when they know their own work is being outsourced. Retention "
            "arrangements for staff whose roles are ending are a practical "
            "necessity rather than a courtesy."
        ),
    ]),

    ("Transition Out", [
        ul([
            "Exit provisions belong in the original contract: notice periods, "
            "transfer assistance obligations, data return format and "
            "documentation standards",
            "Documentation must be maintained throughout the term rather than "
            "produced at the end, or the exit will discover it does not exist",
            "Knowledge transfer needs a plan, a defined period and named "
            "people on both sides -- at both ends of the arrangement",
            "Exit terms negotiated at the end are negotiated from no position "
            "at all, because the supplier holds the data, the documentation "
            "and the operational knowledge",
        ]),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Expecting to transfer accountability",
             "A contract transfers financial consequence. The organisation "
             "remains answerable to its customers and regulators regardless of "
             "who performs the work."),
            ("Outsourcing a process nobody has documented",
             "If it is not understood internally it cannot be specified, and "
             "the supplier will implement its own interpretation -- discovered "
             "later, and expensively."),
            ("Retaining no internal capability",
             "An organisation with no domain knowledge cannot evaluate "
             "proposals, estimates or explanations, and becomes dependent in a "
             "way no clause repairs."),
            ("Measuring supplier activity rather than user outcome",
             "The watermelon SLA -- green metrics, unhappy users -- is the "
             "predictable result, and the supplier is behaving exactly as the "
             "contract instructs it to."),
            ("Planning transition in but not out",
             "Exit terms negotiated at the end are negotiated from no "
             "position. They belong in the original contract while the "
             "supplier still wants the business."),
            ("Never establishing a baseline",
             "Without knowing the internal cost and performance beforehand, "
             "nobody can demonstrate afterwards whether the arrangement "
             "helped, and renewal becomes a matter of impression."),
        ]),
    ]),

    ("Practical Example: A Service Desk That Meets Every Target", [
        desc(
            "An outsourced service desk reports 98% of calls answered within "
            "30 seconds and 95% of tickets closed within SLA. On paper the "
            "contract is being delivered comfortably and the supplier is "
            "meeting every commitment."
        ),
        desc(
            "Users report that nothing gets fixed, that tickets are closed and "
            "immediately reopened, and that they have started contacting a "
            "remaining internal engineer directly rather than raising tickets "
            "at all."
        ),
    ]),

    ("Diagnosing It", [
        desc(
            "The supplier is not cheating. It is optimising exactly what the "
            "contract rewards, which is what any rational supplier does. "
            "Answer speed and closure rate are activity metrics, and closing a "
            "ticket is entirely within the supplier's control in a way that "
            "solving the underlying problem is not."
        ),
        desc(
            "Reopened tickets count as new, so the same unresolved failure "
            "improves the numbers twice. The contract is producing precisely "
            "the behaviour it specifies, and the fault lies with whoever "
            "specified it."
        ),
    ]),

    ("Fixing It", [
        ul([
            "Add first-contact resolution and reopen rate, which make closing "
            "without fixing immediately visible in the numbers",
            "Measure user satisfaction independently of the supplier's own "
            "reporting, so the measurement is not marking its own homework",
            "Introduce problem management targets, so recurring incidents must "
            "be eliminated rather than repeatedly closed",
            "Recognise the shadow support route as evidence rather than "
            "indiscipline: users route around a service that does not work, "
            "and the workaround is data about the service",
        ]),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Why accountability cannot be transferred by contract",
            "Location models and the cost/coordination trade-off",
            "Which relationship models transfer delivery risk and which do not",
            "What retained capability is for",
            "SLA components, and the watermelon failure",
            "eSCM's two halves and why a client-side model exists",
            "Why exit terms belong in the original contract",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Outsourcing transfers financial consequence, never "
            "accountability",
            "Onshore, nearshore, offshore trade cost against coordination; "
            "multi-sourcing avoids dependence at the cost of integration",
            "Staff augmentation transfers no delivery risk; a managed service "
            "specifies outcomes and can",
            "eSCM has two halves -- SP for providers, CL for clients",
            "An SLA needs metrics, severity definitions, measurement method "
            "and remedies",
            "Retained capability is what makes an organisation an intelligent "
            "customer",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Sourcing decides who performs the work, and fails for "
            "organisational rather than technical reasons",
            "Accountability stays with the organisation whatever the contract "
            "says",
            "Location models trade rate against coordination cost; "
            "relationship models trade control against risk transfer",
            "Never outsource to the point of being unable to evaluate your own "
            "supplier",
            "SLAs measuring supplier activity rather than user outcome produce "
            "green metrics and unhappy users -- and the supplier is not to "
            "blame for that",
            "eSCM-CL exists because outsourcing failures are frequently the "
            "client's doing",
            "Both transition in and transition out must be planned while there "
            "is still leverage and knowledge to plan with",
        ]),
    ]),
]

_out_quiz = [
    mcq("EASY",
        "Which sourcing model places the supplier in a nearby country with "
        "overlapping working hours?",
        [("Nearshore", True), ("Offshore", False), ("Onshore", False),
         ("Multi-sourcing", False)],
        "Nearshore is the compromise between cost and collaboration: "
        "meaningful savings with substantial working-hour overlap and closer "
        "cultural and legal alignment. Offshore is distant and cheapest per "
        "hour, onshore is domestic, and multi-sourcing describes using several "
        "suppliers rather than any particular location."),
    mcq("EASY",
        "What does an organisation retain when it outsources a business "
        "function?",
        [("Accountability to its customers and regulators for the "
          "outcome", True),
         ("Nothing, provided the contract transfers all delivery "
          "obligations", False),
         ("Only the cost, since the supplier assumes all other "
          "responsibilities", False),
         ("Responsibility for the supplier's internal staffing "
          "decisions", False)],
        "A contract can transfer financial consequence through service "
        "credits, but customers and regulators hold the organisation "
        "answerable regardless of who performed the work -- unpaid staff and a "
        "regulatory breach remain the organisation's problem. It does not, "
        "however, become responsible for how the supplier staffs itself."),
    mcq("AVERAGE",
        "Which sourcing relationship transfers essentially no delivery risk to "
        "the supplier?",
        [("Staff augmentation, because contracted individuals work under the "
          "client's direction and the client owns the outcome", True),
         ("Managed service, because the supplier only agrees to service levels "
          "rather than to deliverables", False),
         ("Business process outsourcing, because the client retains the "
          "process design", False),
         ("Project outsourcing, because scope changes are inevitable", False)],
        "Augmented staff are additional hands in a team the client still "
        "manages and directs, so if the project fails it is the client's "
        "failure -- the client made every decision. A managed service "
        "specifies outcomes and levels, which is what makes genuine risk "
        "transfer possible; BPO transfers an entire function; and project "
        "outsourcing transfers delivery of a defined scope."),
    mcq("AVERAGE",
        "An outsourced service desk reports 98% of calls answered within 30 "
        "seconds and 95% of tickets closed within SLA, while users say nothing "
        "gets fixed.\n\nWhat is happening?",
        [("The SLA measures supplier activity rather than user outcome, so the "
          "supplier is optimising exactly what the contract rewards.", True),
         ("The supplier is falsifying its performance reports.", False),
         ("Users are raising tickets incorrectly, so they fall outside the "
          "measured categories.", False),
         ("The SLA targets are set too low and should be tightened.", False)],
        "Answer speed and closure rate are entirely within the supplier's "
        "control; actually resolving the underlying problem is not. Closing "
        "tickets that are then reopened improves both numbers twice over. This "
        "is the watermelon SLA -- green outside, red inside -- and the remedy "
        "is outcome metrics such as first-contact resolution and reopen rate, "
        "not accusations or tighter versions of the wrong targets."),
    mcq("AVERAGE",
        "Why does eSCM include a client-side model (eSCM-CL) as well as a "
        "provider-side one?",
        [("Because outsourcing failures frequently originate with the client: "
          "unclear requirements, absent governance and no retained "
          "capability.", True),
         ("Because clients must be certified before providers may bid for "
          "their work.", False),
         ("Because the two models are alternatives and an organisation adopts "
          "one or the other.", False),
         ("Because regulators require both parties to hold the same maturity "
          "level.", False)],
        "A maturity model assessing only suppliers would attribute every "
        "failure to them, and that is not where the causes lie. A client that "
        "cannot specify what it wants, does not govern the relationship and "
        "has retained nobody able to judge the work will get poor outcomes "
        "from a highly capable supplier. The two models are complementary and "
        "neither is a regulatory requirement."),
    mcq("AVERAGE",
        "Why should the baseline cost and performance of a function be "
        "established before it is outsourced?",
        [("Without it, nobody can demonstrate afterwards whether the "
          "arrangement improved anything.", True),
         ("Suppliers are contractually required to match the internal cost "
          "exactly.", False),
         ("The baseline determines which sourcing location must be "
          "used.", False),
         ("Auditors will not approve an outsourcing contract without "
          "one.", False)],
        "The baseline is what makes evaluation possible at renewal. Without "
        "knowing what the function cost and how well it performed internally, "
        "the organisation is left comparing the supplier's performance against "
        "an impression, and renewal decisions get made on feeling in either "
        "direction. It is the most commonly skipped stage of the sourcing life "
        "cycle."),
    mcq("HARD",
        "Why is retaining internal technical capability important even when a "
        "function is fully outsourced?",
        [("Without domain knowledge the organisation cannot specify work, "
          "judge quality or evaluate the supplier's proposals and "
          "estimates.", True),
         ("Contracts are void unless the client employs staff qualified in the "
          "outsourced discipline.", False),
         ("Retained staff are needed to perform the work during the supplier's "
          "holidays.", False),
         ("Auditors require a minimum internal headcount for outsourced "
          "functions.", False)],
        "The capability being retained is judgement rather than labour. An "
        "organisation that has hollowed out its technical knowledge must "
        "accept whatever it is told about feasibility, effort and quality, and "
        "cannot negotiate from an informed position -- a dependency no "
        "contract clause repairs, because the missing thing is not a "
        "deliverable. It is not a legal, staffing-cover or audit requirement."),
    mcq("HARD",
        "Why must exit provisions be written into the original outsourcing "
        "contract rather than negotiated at the end of the term?",
        [("At the end the organisation's data, processes and knowledge sit "
          "with the supplier, leaving it no negotiating position.", True),
         ("Exit clauses added later are unenforceable in most "
          "jurisdictions.", False),
         ("Suppliers are contractually prohibited from discussing exit during "
          "an active term.", False),
         ("The exit cost cannot be estimated once a service is "
          "operational.", False)],
        "Leverage exists only before commitment. By the end of a term the "
        "supplier holds the data, the documentation and the operational "
        "knowledge, and knows perfectly well that transferring elsewhere is "
        "expensive and slow. Notice periods, transfer assistance, data return "
        "format and documentation standards must be agreed while the supplier "
        "still wants the business. Later clauses are enforceable in principle "
        "-- they are simply very hard to obtain."),
    short_answer("EASY",
        "Which maturity model assesses a CLIENT organisation's capability to "
        "source services effectively? Give the full designation.",
        "eSCM-CL",
        ["escm-cl", "escm cl", "esourcing capability model for client "
         "organizations", "esourcing capability model for client "
         "organisations"]),
    short_answer("AVERAGE",
        "What informal term describes an SLA whose metrics are all met while "
        "users remain dissatisfied?",
        "Watermelon SLA",
        ["watermelon sla", "watermelon", "watermelon effect", "watermelon "
         "reporting"]),
    descriptive("HARD",
        "An organisation is considering outsourcing its entire IT function to "
        "reduce cost. Explain the principal risks and what it should retain.",
        "The most fundamental error would be assuming that accountability "
        "moves with the work. A contract can transfer financial consequence "
        "through service credits, but customers and regulators continue to "
        "hold the organisation answerable for outcomes; if an outsourced "
        "system fails, the organisation still has the outage, the regulatory "
        "exposure and the reputational damage, and nobody outside cares whose "
        "contract was breached. The second major risk is hollowing out. An "
        "organisation that outsources every technical role loses the ability "
        "to specify work precisely, to judge whether delivered quality is "
        "adequate, and to evaluate the supplier's proposals, estimates and "
        "explanations of why something is difficult. It then negotiates from "
        "ignorance and becomes dependent in a way no contract clause repairs, "
        "because the missing capability is judgement rather than a "
        "deliverable. Third, cost savings are frequently overstated, because "
        "the coordination, governance and contract management overhead is "
        "omitted from the comparison and because no baseline of internal cost "
        "and performance was established beforehand -- so nobody can "
        "demonstrate afterwards whether the arrangement helped. Fourth, "
        "service levels written around supplier activity rather than user "
        "outcome produce the watermelon effect: every metric green while users "
        "route around the service entirely, with the supplier behaving exactly "
        "as instructed. Finally, exit risk accumulates silently unless notice "
        "periods, transfer assistance, data return formats and documentation "
        "standards are agreed at the outset, while the organisation still has "
        "leverage. What it should retain is enough capability to be an "
        "intelligent customer: architecture and design authority, security and "
        "risk oversight, supplier and contract management, and sufficient "
        "domain knowledge to challenge what it is told. It should also retain "
        "anything genuinely differentiating, since outsourcing a competitive "
        "capability hands it to a supplier who may well also serve "
        "competitors.",
        [("Identifies that accountability is not transferred", 3),
         ("Identifies loss of internal capability and its consequence", 3),
         ("Names further risks and states what should be retained", 4)]),
]

LESSON_OUTSOURCING = {
    "middle": MID_BIZ_FUNDAMENTALS,
    "name": "IT Outsourcing and Sourcing Models",
    "quiz": _out_quiz,
    "structure": lesson_structure(
        "IT Outsourcing and Sourcing Models",
        "Having decided what to acquire, an organisation must decide who "
        "performs the work. This lesson covers sourcing as an organisational "
        "decision rather than a technical one: why organisations outsource and "
        "why risk transfer disappoints, the location and relationship models "
        "and what each trades away, why retained capability is what makes the "
        "arrangement governable at all, how to write a service level agreement "
        "that measures outcomes instead of activity, why eSCM assesses clients "
        "as well as providers, and why transition in and transition out carry "
        "most of the risk while receiving least of the planning.",
        [
            "State the motivations for outsourcing and explain why "
            "accountability cannot be transferred",
            "Compare onshore, nearshore, offshore and multi-sourcing by cost "
            "and coordination",
            "Distinguish staff augmentation, managed service, project "
            "outsourcing, BPO and build-operate-transfer by how much risk each "
            "transfers",
            "Explain what capability an organisation must retain and what "
            "hollowing out costs",
            "Describe the components of an effective SLA",
            "Recognise the watermelon SLA and explain how outcome metrics "
            "address it",
            "Explain eSCM's two models and why a client-side model exists",
            "Describe the sourcing life cycle and why the baseline matters",
            "Describe the three governance layers a relationship needs",
        ],
        60,
        _out_sections,
        [
            ("Onshore / nearshore / offshore",
             "Supplier located domestically, in a nearby country, or in a "
             "distant lower-cost one -- trading labour rate against "
             "coordination cost."),
            ("Multi-sourcing",
             "Deliberately distributing work across several suppliers, "
             "avoiding dependence at the cost of integration effort falling to "
             "the client."),
            ("Staff augmentation",
             "Contracted individuals working under the client's direction. "
             "Transfers no delivery risk."),
            ("Managed service",
             "The supplier delivers a defined service to agreed levels and "
             "decides how, which is what allows genuine risk transfer."),
            ("Business process outsourcing",
             "An entire business function operated by the supplier: deepest "
             "dependency, hardest to reverse."),
            ("Build-operate-transfer",
             "The supplier establishes and runs a capability, then hands it "
             "over after an agreed period."),
            ("Retained capability",
             "The internal knowledge needed to specify work, judge quality and "
             "evaluate a supplier -- judgement rather than labour."),
            ("Service Level Agreement",
             "Measurable service commitments with defined metrics, severity "
             "levels, measurement method and remedies."),
            ("Watermelon SLA",
             "Green metrics and unhappy users: the result of measuring "
             "supplier activity rather than user outcome."),
            ("eSCM-SP / eSCM-CL",
             "eSourcing Capability Model for service providers and for client "
             "organisations respectively."),
            ("Baseline",
             "The internal cost and performance recorded before outsourcing, "
             "without which no later evaluation is possible."),
        ],
        "Sourcing decides who performs the work, and it succeeds or fails on "
        "organisational grounds rather than technical ones. A contract shifts "
        "financial consequence but never accountability -- customers and "
        "regulators still hold the organisation answerable, and they do not "
        "care whose contract was breached. Location models trade labour rate "
        "against coordination cost, and relationship models trade control "
        "against genuine risk transfer, with staff augmentation transferring "
        "none and a managed service transferring real risk provided outcomes "
        "are specified well enough to measure. The capability an organisation "
        "must keep is judgement: enough domain knowledge to specify work, "
        "assess quality and challenge what it is told, without which it is "
        "dependent in a way no clause repairs. SLAs must measure user outcome "
        "rather than supplier activity or they produce green reports and users "
        "who route around the service -- with the supplier behaving exactly as "
        "instructed. And both ends of the arrangement, transition in and exit, "
        "must be planned while there is still leverage and knowledge available "
        "to plan them with."),
}

LESSONS = [LESSON_ADOPTION, LESSON_OUTSOURCING]
