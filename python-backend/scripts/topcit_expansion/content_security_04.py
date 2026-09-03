"""Understanding of Security -> MID 124 and MID 125.

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
and no coloured card grids.

  * Business Continuity and Disaster Recovery finishes Risk Management and
    Assessment. It is the risk response the other lessons do not cover: what
    you do when prevention has already failed.

  * Security Policies, Standards and Procedures joins Information Security
    Management Systems. The existing three lessons cover ISMS frameworks,
    implementation and monitoring, but not the document hierarchy an ISMS is
    actually made of.
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_RISK = 124
MID_ISMS = 125

RTO_DIAGRAM = "/lesson-media/rto-rpo.svg"
BACKUP_DIAGRAM = "/lesson-media/backup-strategies.svg"
POLICY_DIAGRAM = "/lesson-media/policy-hierarchy.svg"
# ===========================================================================
# Business Continuity and Disaster Recovery Planning
# ===========================================================================

_bcp_sections = [
    ("Planning for Failure Rather Than Against It", [
        desc(
            "Every other lesson in this category is about reducing the chance "
            "of something going wrong. This one assumes it already has, which "
            "is a genuinely different mindset and one organisations find "
            "uncomfortable."
        ),
        desc(
            "Business continuity and disaster recovery are the disciplines of "
            "carrying on -- and of getting back -- after a fire, a flood, a "
            "ransomware encryption, a supplier collapse, or a contractor "
            "cutting a fibre in a street two miles away. None of those is "
            "preventable by the organisation experiencing them."
        ),
    ]),

    ("Business Continuity Is Not Disaster Recovery", [
        desc(
            "The two are routinely conflated and exams test the difference "
            "directly, so it is worth stating precisely."
        ),
        sub("Business continuity"),
        desc(
            "Keeping the ORGANISATION functioning during a disruption. It is "
            "broad: people, premises, suppliers, communications, processes and "
            "customers. Its output is how the business keeps serving customers "
            "when normal operations are unavailable, including manual "
            "workarounds that do not involve computers at all."
        ),
        sub("Disaster recovery"),
        desc(
            "Restoring IT SYSTEMS and data after a disruption. Narrow and "
            "technical: failover, restoration from backup, rebuilding "
            "infrastructure, reconnecting networks. It is a subset of "
            "continuity rather than a synonym for it."
        ),
    ]),

    ("Why Having Only One Is Visible", [
        desc(
            "An organisation with a flawless disaster recovery plan and no "
            "continuity plan can restore its systems in four hours and still "
            "have no idea what staff should do during those four hours, how to "
            "tell customers anything, or who is authorised to speak to the "
            "press."
        ),
        desc(
            "The reverse is equally awkward: a continuity plan describing "
            "manual workarounds is worth little if nobody has established how "
            "long the systems will actually be gone. The two plans answer "
            "different halves of the same question and are written together."
        ),
    ]),

    ("Business Impact Analysis", [
        desc(
            "A business impact analysis is where continuity planning begins, "
            "and its purpose is to replace opinion with evidence about what "
            "actually matters. It identifies each business process, what it "
            "depends on, and what it would cost the organisation for that "
            "process to be unavailable for an hour, a day, a week."
        ),
        desc(
            "Without it, recovery priorities get set by whoever argues "
            "loudest, and every department is entirely certain that its own "
            "system is the critical one. The analysis converts that argument "
            "into an ordered list with numbers attached."
        ),
    ]),

    ("What the Analysis Measures", [
        ul([
            "Financial loss: lost revenue, contractual service credits, "
            "penalties, and the cost of recovery itself",
            "Regulatory consequence: reporting obligations and fines that "
            "begin at fixed intervals regardless of whether service is "
            "restored",
            "Reputational damage, which is slow to appear, slow to repair and "
            "hardest to quantify",
            "Dependencies: a process that looks minor may be what three "
            "critical processes silently rely on",
            "Peak-time sensitivity: payroll matters enormously on one day a "
            "month and very little on the others, and an annual figure hides "
            "that entirely",
        ]),
    ]),

    ("Why the Analysis Justifies the Spend", [
        desc(
            "The second function of the impact analysis is commercial. An "
            "organisation will not fund a hot standby site on a feeling, and "
            "the security team asking for one has no standing to insist."
        ),
        desc(
            "It will fund one against a demonstrated hourly loss, because that "
            "converts the request from a technical preference into a business "
            "calculation any finance director can evaluate. Continuity "
            "investment is one of the few security expenditures with a "
            "genuinely quantifiable justification, and the analysis is what "
            "produces it."
        ),
    ]),

    ("RTO and RPO", [
        desc(
            "Two objectives fall out of the impact analysis, and they are the "
            "most examined pair in the topic. Both are stated per process "
            "rather than for the organisation as a whole, because different "
            "processes genuinely warrant different answers."
        ),
        image(RTO_DIAGRAM),
    ]),

    ("Reading the Two Objectives", [
        sub("RTO - Recovery Time Objective"),
        desc(
            "The maximum tolerable duration of the outage. An RTO of four "
            "hours means the process must be functioning again within four "
            "hours of the disruption beginning. It drives investment in "
            "failover capability, standby capacity and rehearsed procedure."
        ),
        sub("RPO - Recovery Point Objective"),
        desc(
            "The maximum tolerable amount of data loss, expressed as a period "
            "of time. An RPO of fifteen minutes means at most the last fifteen "
            "minutes of work may be lost. It drives backup frequency and "
            "replication design."
        ),
        sub("MTD - Maximum Tolerable Downtime"),
        desc(
            "The point beyond which the disruption threatens the "
            "organisation's survival rather than merely costing it money. RTO "
            "must sit comfortably inside MTD, with room for the recovery "
            "itself to go imperfectly -- because it will."
        ),
    ]),

    ("Holding the Two Apart", [
        desc(
            "A useful framing: RPO looks BACKWARDS from the moment of failure "
            "and asks how much work you are prepared to redo. RTO looks "
            "FORWARDS and asks how long you are prepared to be down."
        ),
        desc(
            "They are independent, and improving one does nothing at all for "
            "the other. Nightly backups give an RPO of up to 24 hours "
            "regardless of how fast you can restore, and a four-hour restore "
            "gives an RTO of four hours regardless of how recent the backup "
            "is. An organisation can have an excellent RTO and a terrible RPO "
            "simultaneously, and frequently does."
        ),
    ]),

    ("Backup Strategies", [
        desc(
            "Backup type determines restore complexity as much as capture "
            "speed, and the trade-off between the two is what the choice is "
            "actually about."
        ),
        image(BACKUP_DIAGRAM),
    ]),

    ("The Four Types", [
        accordion([
            ("Full backup",
             "Copies everything each time. Simplest to restore -- one set of "
             "media, one operation, nothing to sequence -- but slowest to take "
             "and heaviest on storage. Most schemes take one periodically as "
             "the base for the others."),
            ("Incremental backup",
             "Copies what changed since the LAST backup of any kind. Fastest "
             "to take and smallest, but restoration needs the last full backup "
             "plus every incremental since, applied in order -- so a single "
             "damaged link in that chain breaks the restore entirely."),
            ("Differential backup",
             "Copies what changed since the last FULL backup. Grows steadily "
             "through the week, but restoration needs only the full backup "
             "plus the most recent differential -- two sets rather than many, "
             "and no chain to break."),
            ("Synthetic full",
             "The backup system merges a previous full and its subsequent "
             "increments into a new full without touching the source at all, "
             "giving incremental-speed capture with full-backup restore "
             "simplicity. The merge happens on the backup infrastructure "
             "rather than the production system."),
        ]),
    ]),

    ("The 3-2-1 Rule", [
        desc(
            "Three copies of the data, on two different media types, with one "
            "copy off site. It is a rule of thumb rather than a standard, and "
            "it survives because each clause defends against a different "
            "failure."
        ),
        ul([
            "The third copy protects against silent corruption of one copy, "
            "which is more common than outright loss",
            "The second medium protects against a fault common to a whole "
            "device class or firmware version",
            "The off-site copy protects against fire, flood or theft affecting "
            "the entire building",
            "Ransomware added a fourth requirement in practice: one copy must "
            "be offline or immutable",
        ]),
    ]),

    ("Why Ransomware Changed the Rule", [
        desc(
            "Backups reachable and writable from the network are encrypted "
            "along with everything else, because the attacker holding domain "
            "credentials can reach them exactly as the backup software can."
        ),
        desc(
            "Organisations discover this at precisely the wrong moment -- "
            "during the recovery attempt, when the backup server turns out to "
            "hold encrypted files with a ransom note in the directory. An "
            "offline copy, or one on write-once storage the attacker cannot "
            "alter even with valid credentials, is now considered essential "
            "rather than cautious."
        ),
    ]),

    ("Recovery Site Options", [
        tabs([
            ("Cold site", "Cold site - days to weeks, cheapest",
             "Space, power and connectivity but no equipment and no data. "
             "Everything must be procured, delivered, installed, configured "
             "and restored before any work can resume. Suitable only where the "
             "MTD is measured in weeks."),
            ("Warm site", "Warm site - hours to a day, moderate cost",
             "Hardware and connectivity already in place, with data restored "
             "periodically rather than continuously. Recovery needs a restore "
             "and a cutover, but not a procurement exercise -- which removes "
             "the least predictable part of the timeline."),
            ("Hot site", "Hot site - minutes, most expensive",
             "Fully equipped and continuously synchronised, ready to take load "
             "almost immediately. The cost is running a second estate that "
             "mostly does nothing, which is why it is reserved for processes "
             "whose hourly loss justifies it."),
            ("Cloud", "Cloud recovery and reciprocal agreements",
             "A reciprocal agreement trades capacity with another organisation "
             "-- cheap, and unreliable in a regional event affecting both. "
             "Cloud recovery has largely displaced these, since capacity can "
             "be provisioned on demand and paid for only when used."),
        ]),
    ]),

    ("Testing the Plan", [
        desc(
            "An untested plan is a document rather than a capability, and the "
            "difference only becomes apparent during an incident -- which is "
            "the worst possible moment to discover it."
        ),
        ol([
            "Plan review: read it through and check it is current. Catches "
            "departed staff, retired systems and stale phone numbers",
            "Tabletop exercise: talk through a scenario together. Catches "
            "unclear responsibilities and decisions nobody has authority to "
            "make",
            "Walkthrough or simulation: perform the steps without affecting "
            "production. Catches procedures that do not work as written",
            "Parallel test: bring up recovery systems alongside production and "
            "compare. Catches capacity shortfalls and data problems",
            "Full interruption test: fail over for real. Catches everything "
            "else, and carries genuine risk, so it is rare and carefully "
            "scheduled",
        ]),
    ]),

    ("What Testing Reliably Finds", [
        desc(
            "The recurring discoveries are unglamorous and remarkably "
            "consistent across organisations, which is what makes them worth "
            "listing in advance."
        ),
        ul([
            "Backups that completed successfully for months and cannot "
            "actually be restored",
            "A recovery procedure that depends on a system which is itself "
            "down -- a circular dependency invisible on paper",
            "Credentials stored only in the environment being recovered",
            "Contact lists reachable only through the failed mail server",
            "An RTO that was never physically achievable with the equipment "
            "available",
            "Staff who have left, systems that have been retired, and "
            "procedures for hardware nobody owns any more",
        ]),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Using business continuity and disaster recovery as synonyms",
             "Continuity keeps the organisation operating; disaster recovery "
             "restores IT systems. DR is one component of BC, and a plan with "
             "only DR leaves staff with no instructions during the very hours "
             "they need them."),
            ("Confusing RTO with RPO",
             "RTO is time to restore service; RPO is acceptable data loss. "
             "They are independent, and improving one does nothing for the "
             "other."),
            ("Backups that are never restored",
             "A backup job reporting success proves the job ran, not that the "
             "data is recoverable. Restoration must be tested to the point of "
             "a working system rather than a readable file."),
            ("Leaving every backup online and writable",
             "Ransomware encrypts what it can reach, and network-attached "
             "backups are exactly that. One copy must be offline or "
             "immutable."),
            ("Writing the plan and shelving it",
             "Systems, staff and suppliers change continuously. An unrevised "
             "plan describes an organisation that no longer exists, and it "
             "will be discovered stale under maximum pressure."),
            ("Setting RTO equal to MTD",
             "MTD is the survival limit rather than a target. Real recoveries "
             "encounter surprises, and a plan with no margin fails the moment "
             "anything deviates."),
        ]),
    ]),

    ("Practical Example: Setting Objectives for Two Systems", [
        desc(
            "An online retailer runs an order-taking site and an internal "
            "reporting warehouse. The impact analysis shows the site loses "
            "revenue continuously while down and that customers go elsewhere "
            "within hours; the warehouse produces reports consumed weekly by a "
            "handful of managers."
        ),
        desc(
            "These are the same organisation, the same IT department and the "
            "same budget, and they warrant entirely different designs."
        ),
    ]),

    ("The Objectives That Follow", [
        ul([
            "Order site: RTO of one hour and RPO of five minutes, requiring "
            "replicated infrastructure and near-continuous replication -- an "
            "order confirmed to a customer and then lost is worse than an "
            "outage, because the customer believes it exists",
            "Reporting warehouse: RTO of three days and RPO of 24 hours, "
            "served adequately by nightly backups and rebuilding on new "
            "hardware",
            "The cost difference between the two designs is very large, and it "
            "is justified entirely by the impact analysis rather than by "
            "either team's opinion of its own importance",
        ]),
        desc(
            "Applying the site's objectives to the warehouse would waste a "
            "great deal of money on capability nobody needs. Applying the "
            "warehouse's objectives to the site would end the business. That "
            "contrast is the argument for doing the analysis first, in one "
            "example."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "BC versus DR, usually as a definition or a scenario",
            "RTO versus RPO -- the most reliably asked pair in the topic",
            "Incremental versus differential restore requirements",
            "The 3-2-1 rule and the ransomware addition",
            "Cold, warm and hot site characteristics",
            "Why testing matters and what each level of test finds",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "BC keeps the organisation running; DR restores IT. DR is a subset "
            "of BC",
            "The business impact analysis comes first and drives everything "
            "else",
            "RTO = time to restore service. RPO = tolerable data loss. Expect "
            "a question distinguishing them",
            "Incremental restores need the full plus every increment; "
            "differential needs the full plus the latest differential only",
            "3-2-1: three copies, two media, one off site -- plus one offline "
            "or immutable against ransomware",
            "Cold, warm and hot sites trade cost against recovery time",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Continuity and recovery answer different questions and both are "
            "needed",
            "The business impact analysis converts departmental opinion into "
            "an ordered, costed list -- and justifies the spend",
            "RTO and RPO are independent, are set per process, and drive "
            "different investments",
            "Backup type determines restore complexity as much as capture "
            "speed",
            "A backup that has never been restored is an assumption rather "
            "than a control",
            "One backup copy must now be beyond a ransomware attacker's reach",
            "An untested plan is a document; testing is what turns it into a "
            "capability",
        ]),
    ]),
]

_bcp_quiz = [
    mcq("EASY",
        "What does Recovery Point Objective (RPO) specify?",
        [("The maximum amount of data loss, expressed as a period of time, "
          "that is acceptable", True),
         ("The maximum time within which a service must be restored", False),
         ("The point at which an outage threatens the organisation's "
          "survival", False),
         ("The frequency with which the recovery plan must be tested", False)],
        "RPO looks backwards from the failure and asks how much work may be "
        "lost, which is what drives backup and replication frequency. The "
        "maximum outage duration is RTO, the survival threshold is maximum "
        "tolerable downtime, and testing frequency is a policy decision "
        "unrelated to either objective."),
    mcq("EASY",
        "Which statement correctly relates business continuity and disaster "
        "recovery?",
        [("Disaster recovery is a subset of business continuity, focused on "
          "restoring IT systems and data.", True),
         ("Business continuity is a subset of disaster recovery, focused on "
          "restoring staff functions.", False),
         ("They are two names for the same discipline.", False),
         ("Business continuity applies to natural disasters and disaster "
          "recovery to cyber attacks.", False)],
        "Continuity covers the whole organisation -- people, premises, "
        "suppliers, processes, communications -- while disaster recovery "
        "covers the technical restoration of systems and data within it. "
        "Neither is defined by the type of disaster causing the disruption."),
    mcq("AVERAGE",
        "An organisation takes a full backup on Sunday and incremental backups "
        "each weekday. A failure occurs on Thursday afternoon.\n\nWhat is "
        "needed to restore?",
        [("The Sunday full backup plus the Monday, Tuesday and Wednesday "
          "incrementals, in order", True),
         ("The Sunday full backup plus the Wednesday incremental only", False),
         ("The Wednesday incremental only, since it contains all "
          "changes", False),
         ("The Sunday full backup only, since incrementals are copies of "
          "it", False)],
        "An incremental contains only what changed since the previous backup "
        "of any kind, so the full and every subsequent incremental are "
        "required, applied in sequence -- and any one of them being damaged or "
        "missing breaks the chain entirely. Needing only the full plus the "
        "latest would describe a differential scheme."),
    mcq("AVERAGE",
        "An organisation's backups run nightly and a full restore takes eight "
        "hours. What are its effective RPO and RTO?",
        [("RPO up to 24 hours, RTO about 8 hours", True),
         ("RPO about 8 hours, RTO up to 24 hours", False),
         ("RPO and RTO both 24 hours", False),
         ("RPO and RTO both 8 hours", False)],
        "The backup interval bounds data loss, so a failure just before the "
        "nightly run loses up to a day's work -- that is the RPO. The "
        "restoration duration bounds how long the service is unavailable, "
        "giving an RTO of around eight hours. The two are independent, which "
        "is the point of the question: faster restores do not reduce data loss "
        "and more frequent backups do not shorten the outage."),
    mcq("AVERAGE",
        "Why has an 'offline or immutable copy' become a standard addition to "
        "the 3-2-1 backup rule?",
        [("Ransomware encrypts everything it can reach over the network, "
          "including backups stored on writable network shares.", True),
         ("Offline media has a longer physical shelf life than disk.", False),
         ("Regulations require at least one copy to be held on tape.", False),
         ("Immutable storage is cheaper than conventional backup "
          "storage.", False)],
        "The classic rule defends against hardware failure, media faults and "
        "site loss, but not against an attacker with valid credentials "
        "deliberately destroying the recovery options. An offline or "
        "write-once copy is out of reach of the encryption even for an "
        "attacker holding domain administrator rights. Shelf life, regulation "
        "and cost are not the driver."),
    mcq("AVERAGE",
        "Which level of continuity testing is most likely to reveal that two "
        "departments each believe the other is responsible for a recovery "
        "step?",
        [("A tabletop exercise, where the scenario is talked through "
          "together", True),
         ("A plan review, where the document is read for currency", False),
         ("A full interruption test, where systems are actually failed "
          "over", False),
         ("A parallel test, where recovery systems run alongside "
          "production", False)],
        "Unclear ownership is a human and organisational gap rather than a "
        "technical one, and it surfaces as soon as people walk through a "
        "scenario together and both look at each other at the same step. A "
        "plan review checks currency rather than understanding, and the more "
        "expensive technical tests would find it too -- at far greater cost "
        "for a problem a two-hour discussion reveals."),
    mcq("HARD",
        "A disaster recovery test discovers that the recovery runbook requires "
        "credentials stored in a password manager hosted on the failed "
        "infrastructure.\n\nWhat class of problem is this, and what does it "
        "illustrate?",
        [("A circular dependency in the recovery plan, illustrating why plans "
          "must be tested rather than merely written.", True),
         ("An access control failure, illustrating the need for stronger "
          "authentication.", False),
         ("An RPO failure, illustrating insufficient backup frequency.", False),
         ("A capacity problem, illustrating undersized recovery "
          "infrastructure.", False)],
        "The recovery procedure depends on something unavailable precisely "
        "when the procedure is needed -- a circular dependency, and one of the "
        "most common findings in real tests. It is invisible on paper because "
        "each step looks entirely reasonable in isolation, and only executing "
        "the sequence reveals it. Nothing here concerns authentication "
        "strength, backup frequency or capacity."),
    mcq("HARD",
        "Why must the Recovery Time Objective be set comfortably shorter than "
        "the Maximum Tolerable Downtime rather than equal to it?",
        [("Recovery rarely proceeds perfectly, and an RTO equal to MTD leaves "
          "no margin before the outage becomes existential.", True),
         ("MTD is measured in business days while RTO is measured in clock "
          "hours.", False),
         ("Regulators require a fixed percentage gap between the two "
          "figures.", False),
         ("RTO applies only to IT systems while MTD applies to the whole "
          "organisation.", False)],
        "MTD is the point at which the organisation's survival is threatened, "
        "so it is a limit rather than a target. Real recoveries encounter "
        "surprises -- a failed restore, a missing dependency, staff "
        "unavailability, a supplier who cannot deliver on a Sunday -- and a "
        "plan with no margin fails the moment anything deviates. The units are "
        "the same, no regulation fixes a ratio, and both figures are set per "
        "business process."),
    short_answer("EASY",
        "What analysis identifies critical business processes and the cost of "
        "their unavailability, forming the basis of continuity planning? Give "
        "the term or its acronym.",
        "Business Impact Analysis",
        ["business impact analysis", "bia", "impact analysis"]),
    short_answer("AVERAGE",
        "Which type of recovery site is fully equipped and continuously "
        "synchronised, allowing recovery within minutes?",
        "Hot site",
        ["hot site", "hot-site", "a hot site", "hot standby site"]),
    descriptive("HARD",
        "Explain the difference between Recovery Time Objective and Recovery "
        "Point Objective, and describe how each drives a different part of the "
        "recovery design.",
        "Recovery Time Objective is the maximum tolerable duration of an "
        "outage: how long the organisation can function with the service "
        "unavailable before the consequences become unacceptable. Recovery "
        "Point Objective is the maximum tolerable data loss, expressed as a "
        "period of time: how much recent work the organisation is prepared to "
        "redo. A useful framing is that RPO looks backwards from the moment of "
        "failure and RTO looks forwards from it. They are independent, and "
        "improving one does nothing whatever for the other -- an organisation "
        "with nightly backups and an eight-hour restore has an RPO of up to 24 "
        "hours and an RTO of about eight, and halving the restore time leaves "
        "the potential data loss exactly where it was. The two drive different "
        "investments. RPO drives how often data is captured and how it is "
        "replicated: a fifteen-minute RPO cannot be met by nightly backups "
        "under any circumstances and requires frequent snapshots or continuous "
        "replication to a second location. RTO drives standby capability and "
        "rehearsed procedure: a one-hour RTO cannot be met by procuring "
        "hardware and restoring from tape, and requires warm or hot standby "
        "infrastructure with a tested failover that people have actually "
        "performed. Because both objectives are derived per business process "
        "from the business impact analysis, a single organisation will "
        "legitimately run very different designs side by side -- replicated "
        "infrastructure with continuous replication for an order-taking system "
        "whose customers leave within hours, and nightly backups restored onto "
        "new hardware for a reporting warehouse read once a week. Applying "
        "either design to the other process would be a serious error, in one "
        "direction wasteful and in the other fatal.",
        [("Defines RTO and RPO correctly and distinguishes them", 4),
         ("Explains that they are independent, with a worked example", 3),
         ("Links each objective to the design decision it drives", 3)]),
]

LESSON_BCP = {
    "middle": MID_RISK,
    "name": "Business Continuity and Disaster Recovery Planning",
    "quiz": _bcp_quiz,
    "structure": lesson_structure(
        "Business Continuity and Disaster Recovery Planning",
        "The rest of this category is about reducing the chance of something "
        "going wrong. This lesson assumes it already has. You will learn why "
        "business continuity and disaster recovery are different disciplines "
        "and why having only one leaves a visible gap, how a business impact "
        "analysis converts departmental opinion into an ordered and costed "
        "list that also justifies the spending, the difference between RTO and "
        "RPO and the different investments each drives, how backup strategies "
        "trade capture speed against restore complexity, what ransomware "
        "changed about the 3-2-1 rule, what the recovery site options cost, "
        "and why an untested plan is a document rather than a capability.",
        [
            "Distinguish business continuity from disaster recovery and "
            "explain their relationship",
            "Explain the purpose of a business impact analysis, what it "
            "measures, and how it justifies investment",
            "Define RTO, RPO and MTD, and explain why RTO must sit inside MTD",
            "Explain why RTO and RPO are independent, with a worked example",
            "Compare full, incremental, differential and synthetic full "
            "backups by capture cost and restore complexity",
            "State the 3-2-1 rule and explain the additional requirement "
            "ransomware introduced",
            "Compare cold, warm, hot and cloud recovery options",
            "Describe the five levels of continuity testing and the class of "
            "problem each finds",
        ],
        55,
        _bcp_sections,
        [
            ("Business continuity",
             "Keeping the organisation operating during a disruption: people, "
             "premises, suppliers, processes and communications."),
            ("Disaster recovery",
             "Restoring IT systems and data after a disruption. A subset of "
             "business continuity."),
            ("Business Impact Analysis",
             "The study identifying critical processes, their dependencies and "
             "the cost of their unavailability over time."),
            ("RTO",
             "Recovery Time Objective: the maximum tolerable outage duration. "
             "Drives standby capability."),
            ("RPO",
             "Recovery Point Objective: the maximum tolerable data loss, "
             "expressed as time. Drives backup and replication frequency."),
            ("MTD",
             "Maximum Tolerable Downtime: the point at which an outage "
             "threatens organisational survival. RTO must sit comfortably "
             "inside it."),
            ("Incremental / differential backup",
             "Incremental copies changes since the last backup of any kind; "
             "differential copies changes since the last full backup. The "
             "difference shows at restore time."),
            ("Synthetic full backup",
             "A full backup assembled by the backup system from an existing "
             "full plus increments, without touching the source."),
            ("3-2-1 rule",
             "Three copies, two media types, one off site -- now commonly "
             "extended with one offline or immutable copy."),
            ("Cold / warm / hot site",
             "Standby facilities of increasing readiness and cost, giving "
             "recovery in days, hours or minutes respectively."),
            ("Tabletop exercise",
             "A discussion-based walkthrough of a scenario, which finds "
             "unclear responsibilities very cheaply."),
        ],
        "Business continuity keeps the organisation functioning and disaster "
        "recovery restores its systems; the second is part of the first, and a "
        "plan holding only the technical half leaves staff without "
        "instructions during the very hours they need them. The business "
        "impact analysis comes first because it replaces every department's "
        "certainty about its own importance with costed evidence -- and "
        "because that evidence is what persuades a finance director to fund "
        "standby capability. From it come the two objectives driving the whole "
        "design: RTO for how long you may be down, RPO for how much work you "
        "may lose. They are independent, and each buys a different thing: "
        "replication frequency for one, standby capability for the other. "
        "Backup type determines restore complexity as much as capture cost, "
        "one copy must now be beyond a ransomware attacker's reach even when "
        "that attacker holds valid credentials, and none of it is real until a "
        "test has proved it -- because the failures testing finds, like a "
        "runbook needing credentials from the system that is down, are "
        "invisible on paper."),
}


# ===========================================================================
# Security Policies, Standards, and Procedures
# ===========================================================================

_pol_sections = [
    ("The Documents an ISMS Is Made Of", [
        desc(
            "The other lessons in this category cover ISMS frameworks, "
            "implementation and monitoring. This one covers what an ISMS "
            "actually consists of on paper: a hierarchy of documents that "
            "translate an intention into something an employee can follow and "
            "an auditor can check."
        ),
        desc(
            "That translation is the whole job. An intention nobody can act on "
            "changes nothing, and an instruction with no stated authority "
            "behind it is advice."
        ),
    ]),

    ("Why the Hierarchy Exists", [
        desc(
            "Each level answers a different question and, crucially, has a "
            "different lifetime and a different approval requirement."
        ),
        desc(
            "Confusing them produces one of two failures: a policy so detailed "
            "that it must be reapproved at executive level every time a tool "
            "changes -- and which therefore stops being maintained -- or a "
            "procedure so vague that nobody can act on it and everyone "
            "improvises differently."
        ),
        image(POLICY_DIAGRAM),
    ]),

    ("The Four Levels", [
        sub("Policy"),
        desc(
            "A short statement of intent and mandate, approved at executive "
            "level. It says WHAT must be true and WHY, and never how. It "
            "changes rarely, and every lower document traces back to one."
        ),
        sub("Standard"),
        desc(
            "A mandatory specification giving the measurable requirement: "
            "which algorithms, which minimum versions, which settings, which "
            "thresholds. It says WHAT SPECIFICALLY, and it is what compliance "
            "is actually tested against."
        ),
        sub("Procedure"),
        desc(
            "Step-by-step instructions for performing a task, written for "
            "whoever performs it. It says HOW, in enough detail that two "
            "different people following it produce the same result."
        ),
        sub("Guideline"),
        desc(
            "Recommended practice that is advisory rather than mandatory. It "
            "says WHAT IS SUGGESTED, for situations where judgement is "
            "legitimately required and a single rule would be wrong as often "
            "as right."
        ),
    ]),

    ("A Worked Example of the Hierarchy", [
        ol([
            "Policy: 'Information classified as Confidential must be protected "
            "in transit and at rest.'",
            "Standard: 'Data at rest must be encrypted with AES-256; data in "
            "transit must use TLS 1.2 or above with approved cipher suites.'",
            "Procedure: 'To enable database encryption: log in to the console, "
            "select the instance, choose Encryption, select the managed key "
            "named...'",
            "Guideline: 'Where a service offers both AES-256-GCM and "
            "AES-256-CBC, GCM is preferred for its integrity protection.'",
        ]),
        desc(
            "Notice what survives what. The policy survives a change of cloud "
            "provider, a change of cipher and a change of console. The "
            "standard survives a change of console. Only the procedure has to "
            "be rewritten when a screen moves. That is the entire reason for "
            "separating them, and it is the answer to any exam question asking "
            "why the hierarchy exists."
        ),
    ]),

    ("Mandatory and Advisory", [
        desc(
            "Policies, standards and procedures are mandatory; guidelines are "
            "not. This distinction has real consequences rather than being a "
            "matter of tone."
        ),
        desc(
            "An auditor can raise a finding against a breach of a standard and "
            "cannot against a departure from a guideline. A disciplinary "
            "process can rest on the former and not the latter. Writing "
            "something as a guideline when it needs to be enforced is "
            "therefore a decision not to require it, whether or not the author "
            "intended that -- and it is a common and quiet failure."
        ),
    ]),

    ("What Belongs in a Policy", [
        ul([
            "Purpose: why the policy exists and what risk it addresses",
            "Scope: which systems, people, locations and data it covers, "
            "explicitly including contractors and third parties",
            "Roles and responsibilities: who must do what, named by role "
            "rather than by person so it survives staff changes",
            "Policy statements: the mandatory requirements themselves",
            "Exceptions: how a departure is requested, who may approve it, and "
            "for how long",
            "Enforcement: the consequence of non-compliance, which is what "
            "makes it a policy rather than an aspiration",
            "Review cycle and owner: who keeps it current and how often it is "
            "revisited",
        ]),
    ]),

    ("Why the Exception Process Matters", [
        desc(
            "A policy with no exception route is a policy people quietly "
            "ignore, because reality eventually produces a case the author did "
            "not anticipate and the work still has to be done."
        ),
        desc(
            "A documented exception -- with a business justification, a named "
            "approver, compensating controls and an expiry date -- keeps the "
            "departure visible and time-bounded, and puts it on the risk "
            "register where it belongs. Undocumented exceptions are "
            "indistinguishable from non-compliance, they accumulate silently, "
            "and the organisation gradually loses any accurate picture of its "
            "own risk position."
        ),
    ]),

    ("The Policies Most Organisations Need", [
        accordion([
            ("Acceptable Use Policy",
             "What staff may and may not do with organisational systems, "
             "including personal use, prohibited activity and the extent of "
             "monitoring. Usually the one every employee signs, and the basis "
             "on which misuse can be acted upon."),
            ("Access Control Policy",
             "How access is requested, approved, reviewed and revoked. Its "
             "most-breached clause is almost always the periodic review, "
             "because leavers and movers accumulate rights that nobody has an "
             "incentive to remove."),
            ("Data Classification and Handling Policy",
             "The classification levels and what each requires for storage, "
             "transmission, sharing and destruction. Without it, every other "
             "data policy has no way to say which data it means."),
            ("Incident Response Policy",
             "What counts as an incident, who must be told, within what "
             "timeframe, and who has authority to act -- including authority "
             "to take a production system offline without a meeting."),
            ("Third Party and Supplier Policy",
             "Security requirements imposed on suppliers, right-to-audit "
             "clauses, and what happens at contract end. Increasingly the "
             "route by which breaches actually arrive."),
            ("Business Continuity Policy",
             "The mandate for continuity planning, the required testing "
             "frequency, and who owns the plans -- which connects directly to "
             "the previous lesson."),
        ]),
    ]),

    ("Writing Policy People Will Follow", [
        desc(
            "Policy documents fail for predictable reasons, and almost all of "
            "them are about the reader rather than the content. A forty-page "
            "document written in legal register and distributed once by email "
            "will not change anyone's behaviour."
        ),
        desc(
            "Worse, its existence will be cited afterwards as evidence that "
            "staff were informed -- which converts a communication failure "
            "into a compliance defence and removes the incentive to fix it."
        ),
    ]),

    ("Practical Drafting Rules", [
        ul([
            "Write for the person who must comply, not for the auditor who "
            "will read it once",
            "State the reason: people follow rules they understand far more "
            "reliably than rules they merely receive",
            "Keep policy short and push detail into standards and procedures, "
            "where it can change without executive reapproval",
            "Make the compliant path the easy path -- if the secure route is "
            "slower, the policy is competing with a deadline and will lose",
            "Distribute through training and acknowledgement rather than by "
            "publication alone",
            "Say what happens when it is breached, because a rule with no "
            "consequence is a suggestion",
        ]),
    ]),

    ("Document Lifecycle", [
        ol([
            "Draft, with the people who will have to comply consulted rather "
            "than merely informed",
            "Review by legal, technical and operational stakeholders",
            "Approve at the level the document's authority requires -- a "
            "policy needs executive sign-off, a procedure does not",
            "Publish and communicate, recording acknowledgement where the "
            "document requires it",
            "Review on a defined cycle and on any significant change to "
            "systems, structure or regulation",
            "Retire deliberately, because a superseded document still in "
            "circulation is worse than none",
        ]),
    ]),

    ("Version Control and Auditability", [
        desc(
            "Every controlled document needs a version number, an owner, an "
            "approval date and a review date on its face. This is not "
            "bureaucracy -- it is what makes the document evidence."
        ),
        desc(
            "An auditor's first question is not what the policy says but "
            "whether it is the current version, who approved it, and whether "
            "the review actually happened on schedule. A well-written policy "
            "whose review date passed two years ago is a finding regardless of "
            "how sound its content is, because nobody has confirmed it still "
            "matches the estate."
        ),
    ]),

    ("Where Policy Meets Enforcement", [
        desc(
            "A policy existing only as text depends entirely on human "
            "compliance: it is followed by those who read it, remembered it, "
            "and are not currently under pressure to do otherwise."
        ),
        desc(
            "Wherever possible the requirement should be enforced technically, "
            "so that the policy describes what the system already guarantees "
            "rather than what people are asked to remember. A password "
            "standard enforced by configuration is obeyed by everyone, always; "
            "the same standard in a document is obeyed by whoever read it."
        ),
    ]),

    ("The Test of a Meaningful Clause", [
        desc(
            "This also gives an honest test of whether a policy statement is "
            "doing anything at all. If nobody can say how a clause would be "
            "checked -- what evidence would demonstrate compliance, what would "
            "demonstrate breach -- it is unlikely to be achieving anything "
            "except occupying a page."
        ),
        desc(
            "Applying that test to an existing policy set is uncomfortable and "
            "usually removes a third of it, which makes the remainder more "
            "likely to be read."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Putting technical detail in the policy",
             "Naming a specific product or version in a policy means "
             "reapproving it at executive level on every upgrade, which in "
             "practice means it stops being maintained. Detail belongs in "
             "standards and procedures, which change at their own pace."),
            ("Writing guidelines where standards are needed",
             "Advisory language cannot be enforced or audited. If it must be "
             "done, it is a standard, and calling it a recommendation is a "
             "decision not to require it."),
            ("Omitting the exception process",
             "Reality produces cases the policy did not anticipate. Without a "
             "route to document a departure, people simply depart quietly and "
             "the organisation loses visibility of its own risk."),
            ("Distributing by email and calling it communication",
             "An unread document changes nothing. Acknowledgement and training "
             "are what make a policy operative and what make enforcement "
             "defensible."),
            ("Letting documents lapse",
             "An expired review date is among the easiest audit findings there "
             "is, and it also means the document probably describes systems "
             "that have since changed."),
            ("Writing clauses nobody can check",
             "If no evidence would demonstrate compliance or breach, the "
             "clause is decorative. Every requirement should imply an "
             "observable."),
        ]),
    ]),

    ("Practical Example: A Policy That Nobody Follows", [
        desc(
            "An organisation's policy forbids storing customer data on local "
            "machines. Support staff routinely export spreadsheets to their "
            "laptops anyway, because the approved reporting tool takes several "
            "minutes per query and they are handling live calls with customers "
            "waiting on the line."
        ),
        desc(
            "Everybody knows this happens. It has been raised twice and the "
            "response each time was a reminder email."
        ),
    ]),

    ("Diagnosing It Properly", [
        desc(
            "Treating this as a discipline problem produces another memo and "
            "no change, because the diagnosis is wrong. The policy is "
            "competing with a deadline and losing, which means the compliant "
            "path is not viable rather than that staff are careless."
        ),
        ul([
            "Make the approved route fast enough to use during a live call",
            "Provide a sanctioned export mechanism into a controlled location, "
            "so the need is met legitimately",
            "Enforce the restriction technically, so the insecure path is not "
            "available at all",
        ]),
    ]),

    ("When None of Those Is Possible", [
        desc(
            "If the compliant path genuinely cannot be made viable, the honest "
            "response is a documented exception with compensating controls -- "
            "full-disk encryption, endpoint monitoring, a defined retention "
            "period, periodic review -- rather than a policy everyone knows is "
            "routinely broken."
        ),
        desc(
            "A rule that is universally violated teaches staff that the rules "
            "are optional, and that lesson generalises to every other rule "
            "including the ones that matter more. That secondary damage is far "
            "worse than the original exposure, and it is the reason a "
            "documented exception is a better outcome than a policy nobody "
            "keeps."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Matching a description to policy, standard, procedure or "
            "guideline",
            "Which levels are mandatory and which is advisory",
            "Why technical detail does not belong in a policy",
            "The components a complete policy document contains",
            "The purpose of the exception process",
            "What an auditor checks before reading the content",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Policy = what and why, standard = specific mandatory requirement, "
            "procedure = how, guideline = advisory",
            "Policies, standards and procedures are mandatory; only guidelines "
            "are not",
            "Policy needs executive approval; detail belongs lower down so it "
            "can change without it",
            "Every policy needs scope, roles, enforcement, exceptions, an owner "
            "and a review cycle",
            "Undocumented exceptions are indistinguishable from "
            "non-compliance",
            "Technical enforcement beats written instruction wherever it is "
            "available",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "The document hierarchy separates things that change at different "
            "rates and need different approval, which is why it exists",
            "Only guidelines are advisory; the rest are enforceable and "
            "auditable",
            "A policy without an exception process produces invisible "
            "departures rather than compliance",
            "Version, owner, approval and review dates are what an auditor "
            "checks first",
            "A universally violated policy is worse than none, because it "
            "teaches that rules are optional",
            "Where a requirement can be enforced by configuration, it should "
            "be -- and a clause nobody can check is decorative",
        ]),
    ]),
]

_pol_quiz = [
    mcq("EASY",
        "Which document type in the security documentation hierarchy is "
        "advisory rather than mandatory?",
        [("Guideline", True), ("Policy", False), ("Standard", False),
         ("Procedure", False)],
        "Guidelines recommend practice where judgement is legitimately "
        "required, and departing from one is not a compliance breach. "
        "Policies, standards and procedures are all mandatory, which is why an "
        "auditor can raise a finding against them and a disciplinary process "
        "can rest on them."),
    mcq("EASY",
        "Which document states step-by-step instructions for performing a "
        "specific task?",
        [("Procedure", True), ("Policy", False), ("Standard", False),
         ("Guideline", False)],
        "A procedure says HOW, in enough detail that two different people "
        "following it reach the same result. A policy states intent and "
        "mandate, a standard states the measurable requirement, and a "
        "guideline suggests rather than instructs."),
    mcq("AVERAGE",
        "Why should a security policy avoid naming specific product versions "
        "or configuration settings?",
        [("Policies require executive approval and change rarely; technical "
          "detail belongs in standards and procedures that can change at their "
          "own pace.", True),
         ("Naming products creates legal liability toward the vendor.", False),
         ("Auditors are not permitted to review technical detail in a "
          "policy.", False),
         ("Specific versions cannot be enforced technically.", False)],
        "The hierarchy exists to separate things that change at different "
        "rates. A policy stating that confidential data must be encrypted "
        "survives a change of provider, cipher and console; a policy naming a "
        "specific cipher and console requires executive reapproval on every "
        "upgrade, which in practice means it stops being maintained and drifts "
        "out of line with reality."),
    mcq("AVERAGE",
        "What is the consequence of a security policy having no documented "
        "exception process?",
        [("Departures happen anyway but become invisible, so the organisation "
          "loses awareness of its actual risk position.", True),
         ("The policy becomes unenforceable in a disciplinary "
          "process.", False),
         ("Auditors will automatically classify the policy as a "
          "guideline.", False),
         ("The policy cannot be approved at executive level.", False)],
        "Reality eventually produces a case the policy did not anticipate, and "
        "the work still has to be done. With no route to document a departure, "
        "people depart quietly and nothing records it -- so the risk register "
        "no longer reflects reality. A documented exception carries a "
        "justification, an approver, compensating controls and an expiry, "
        "which keeps it visible and temporary."),
    mcq("AVERAGE",
        "Support staff routinely breach a policy forbidding local storage of "
        "customer data, because the approved tool is too slow to use during "
        "live calls.\n\nWhat is the most appropriate response?",
        [("Make the compliant path viable, enforce the restriction "
          "technically, or grant a documented exception with compensating "
          "controls.", True),
         ("Reissue the policy with stronger wording and require staff to "
          "re-acknowledge it.", False),
         ("Begin disciplinary action against the staff involved to establish "
          "the policy's authority.", False),
         ("Downgrade the policy to a guideline so that staff are no longer in "
          "breach.", False)],
        "The policy is competing with a deadline and losing, which means the "
        "compliant path is not viable rather than that staff are "
        "undisciplined. Stronger wording changes nothing about the underlying "
        "conflict, discipline addresses a symptom while leaving the cause, and "
        "downgrading to a guideline abandons the requirement while pretending "
        "to keep it."),
    mcq("AVERAGE",
        "Which policy is typically signed by every employee and forms the "
        "basis on which misuse of organisational systems can be acted upon?",
        [("Acceptable Use Policy", True),
         ("Access Control Policy", False),
         ("Data Classification Policy", False),
         ("Incident Response Policy", False)],
        "The Acceptable Use Policy sets out what staff may and may not do with "
        "organisational systems, including personal use and the extent of "
        "monitoring, and signing it is what establishes that the employee was "
        "informed. The others govern how access is granted, how data is "
        "handled by sensitivity, and what happens during an incident."),
    mcq("HARD",
        "An auditor examines a well-written access control policy whose stated "
        "annual review date passed two years ago.\n\nWhy is this a finding "
        "despite the content being sound?",
        [("A controlled document that has lapsed its own review cycle cannot "
          "be relied on to describe current systems, and the governance process "
          "has demonstrably failed.", True),
         ("Policies automatically expire and become legally void after their "
          "review date.", False),
         ("The content cannot be sound if the review was missed.", False),
         ("Auditors are required to check dates before content and stop if "
          "dates fail.", False)],
        "The finding is about governance rather than wording. A missed review "
        "means nobody has confirmed the policy still matches the estate, and "
        "systems, staff, suppliers and regulations all change over two years. "
        "It is also direct evidence that the review process itself is not "
        "operating. Nothing makes a policy legally void, and the content may "
        "well still be correct -- but that is now an assumption rather than a "
        "verified fact."),
    mcq("HARD",
        "Why is a requirement enforced by system configuration preferable to "
        "the same requirement stated in a policy document?",
        [("Technical enforcement makes compliance the default rather than "
          "depending on each person remembering and choosing to comply.", True),
         ("Policy documents have no standing in a disciplinary "
          "process.", False),
         ("Configuration changes do not require approval, so they can be "
          "deployed faster.", False),
         ("Auditors accept configuration evidence but do not accept policy "
          "documents.", False)],
        "A written rule is followed by those who read it, remember it and are "
        "not under pressure to do otherwise; an enforced configuration is "
        "followed by everyone, always, and the policy then simply describes "
        "what the system already guarantees. Policies do have disciplinary "
        "standing, configuration changes do require change control, and "
        "auditors examine both kinds of evidence."),
    short_answer("EASY",
        "Which document type states a mandatory, measurable technical "
        "requirement such as a minimum TLS version?",
        "Standard",
        ["standard", "a standard", "security standard", "technical standard"]),
    short_answer("AVERAGE",
        "Which policy governs what employees may and may not do with "
        "organisational systems, and is typically signed by every member of "
        "staff? Give the name or its acronym.",
        "Acceptable Use Policy",
        ["acceptable use policy", "aup", "acceptable use"]),
    descriptive("HARD",
        "Explain the four-level security documentation hierarchy and why "
        "separating the levels matters in practice.",
        "The hierarchy runs policy, standard, procedure, guideline, and each "
        "level answers a different question for a different reader. A policy is "
        "a short statement of intent approved at executive level: it says what "
        "must be true and why, without saying how, and it establishes the "
        "mandate that everything below it derives from. A standard is a "
        "mandatory, measurable specification -- which algorithms, which "
        "minimum versions, which settings -- and is what compliance is "
        "actually tested against. A procedure gives step-by-step instructions "
        "for performing a task, written for whoever performs it and detailed "
        "enough that two different people following it obtain the same result. "
        "A guideline is advisory, offering recommended practice where "
        "judgement is legitimately required; it is the only level that is not "
        "mandatory, which means departure from it cannot be raised as a "
        "compliance finding or form the basis of disciplinary action. "
        "Separating them matters because the levels change at very different "
        "rates and require different approval. A policy stating that "
        "confidential data must be encrypted in transit and at rest survives a "
        "change of cloud provider, a change of cipher and a change of console. "
        "If that same policy named AES-256 and gave console instructions, then "
        "every algorithm deprecation and every interface change would require "
        "re-approval at executive level -- which in practice means the "
        "document stops being maintained and drifts steadily out of line with "
        "the systems it purports to govern. Conversely, pushing a mandatory "
        "requirement down into a guideline quietly removes its enforceability, "
        "so a rule the organisation actually depends on becomes something "
        "nobody can be held to, usually without anyone intending that.",
        [("Describes all four levels and what each contains", 4),
         ("Explains the mandatory/advisory distinction and its consequences", 2),
         ("Explains why separation matters, using change rate or approval "
          "level", 4)]),
]

LESSON_POLICY = {
    "middle": MID_ISMS,
    "name": "Security Policies, Standards, and Procedures",
    "quiz": _pol_quiz,
    "structure": lesson_structure(
        "Security Policies, Standards, and Procedures",
        "An information security management system is, on paper, a hierarchy "
        "of documents -- and the other lessons in this category cover the "
        "frameworks and the operating cycle without covering the documents "
        "themselves. This lesson does. You will learn the four levels and what "
        "belongs at each, why separating them is what keeps them maintainable, "
        "which policies most organisations need, why the exception process is "
        "the clause that decides whether a policy reflects reality, what an "
        "auditor checks before reading a word of the content, why technical "
        "enforcement beats written instruction, and why a universally violated "
        "policy is worse than no policy at all.",
        [
            "Distinguish policy, standard, procedure and guideline by what "
            "each states and who approves it",
            "Explain which levels are mandatory and the consequence for audit "
            "and enforcement",
            "Explain why technical detail belongs below policy level, using "
            "change rate and approval",
            "List the components a complete policy document contains",
            "Explain the purpose of a documented exception process and what "
            "its absence produces",
            "Identify the principal policies an organisation needs",
            "Describe the document lifecycle and what version control provides "
            "an auditor",
            "Explain why technical enforcement is preferable to written "
            "instruction, and how to test whether a clause is meaningful",
        ],
        55,
        _pol_sections,
        [
            ("Policy",
             "A short executive-approved statement of what must be true and "
             "why. Changes rarely; everything below derives from it."),
            ("Standard",
             "A mandatory, measurable specification -- versions, algorithms, "
             "settings -- against which compliance is tested."),
            ("Procedure",
             "Step-by-step instructions for performing a task, detailed enough "
             "to be reproducible by different people."),
            ("Guideline",
             "Advisory recommended practice. The only non-mandatory level, and "
             "therefore not auditable as a breach."),
            ("Exception process",
             "The documented route for approving a departure, with "
             "justification, approver, compensating controls and expiry."),
            ("Acceptable Use Policy",
             "What staff may and may not do with organisational systems; "
             "typically signed by every employee."),
            ("Data classification policy",
             "The classification levels and the handling each requires, "
             "without which other data policies cannot say which data they "
             "mean."),
            ("Document lifecycle",
             "Draft, review, approve, publish and communicate, review "
             "periodically, retire deliberately."),
            ("Version control",
             "Version number, owner, approval date and review date on the "
             "document's face -- what an auditor checks first."),
        ],
        "An ISMS is realised as a hierarchy of documents: policy states intent "
        "and carries executive mandate, standards give the mandatory "
        "measurable requirement, procedures give reproducible instructions, "
        "and guidelines advise where judgement is genuinely needed. Only the "
        "last is optional, so writing something as a guideline is a decision "
        "not to require it. The separation exists because the levels change at "
        "different rates and need different approval -- a policy should "
        "survive a change of vendor, cipher and console, which it cannot do if "
        "it names them. A complete policy carries scope, roles, enforcement, "
        "an exception route, an owner and a review cycle, and the exception "
        "route is what keeps departures visible rather than silent. Auditors "
        "check version, owner and review date before they read the content, "
        "because a lapsed document cannot be relied on to describe current "
        "systems. And the most effective policy clause is the one enforced by "
        "configuration, because it is obeyed by everyone rather than by "
        "whoever read the document -- while a clause nobody can check is "
        "decorative."),
}

LESSONS = [LESSON_BCP, LESSON_POLICY]
