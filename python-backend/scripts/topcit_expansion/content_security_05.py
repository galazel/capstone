"""Understanding of Security -> Information Security Management Systems (125).

The fifth and final lesson for this middle category, and the last of the
Security major. Rebuilt to the format the system's own lessons use: roughly
4,900 words over 28-40 sections, about 46 blocks, diagrams where a picture does
the explaining, and no coloured card grids.

The existing lessons cover ISMS frameworks, implementation and monitoring at
the management level; this one covers the operational machinery those depend on
-- what gets logged, how it is audited, and what happens in the hours after
something goes wrong.
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_ISMS = 125

IR_DIAGRAM = "/lesson-media/incident-response.svg"
SIEM_DIAGRAM = "/lesson-media/siem.svg"
_ir_sections = [
    ("Detection Is a Separate Problem From Prevention", [
        desc(
            "An organisation with excellent preventive controls and no "
            "detection has no idea whether they are working. Prevention that "
            "silently fails looks identical, from the inside, to prevention "
            "that is succeeding."
        ),
        desc(
            "The industry figure that makes this concrete is dwell time -- the "
            "interval between an intrusion beginning and anyone noticing -- "
            "which is routinely measured in weeks or months rather than hours. "
            "Attackers are not usually detected by the controls that failed to "
            "stop them; they are detected by somebody looking."
        ),
    ]),

    ("What This Lesson Assumes", [
        desc(
            "Logging, auditing and incident response are the disciplines that "
            "shorten dwell time. They begin from the assumption that "
            "prevention has already failed somewhere -- the same assumption "
            "business continuity makes about availability."
        ),
        desc(
            "That assumption is uncomfortable and correct. It is what converts "
            "an undetected compromise, discovered eventually by a customer or "
            "a regulator, into a contained incident discovered internally and "
            "handled."
        ),
    ]),

    ("Four Purposes of Logging", [
        desc(
            "Logging serves four distinct purposes, and different purposes "
            "imply different retention periods, different levels of detail and "
            "different protection requirements. Confusing them produces logs "
            "that satisfy nobody."
        ),
        sub("Detection"),
        desc(
            "Spotting an incident while it is happening. Needs near-real-time "
            "collection and alerting -- a log written to a file that nobody "
            "reads detects precisely nothing, however complete it is."
        ),
        sub("Investigation"),
        desc(
            "Reconstructing what happened afterwards. Needs enough detail and "
            "enough history, which is why retention periods matter far more "
            "than most organisations assume: if dwell time is months, logs "
            "kept for thirty days cannot show the entry point."
        ),
        sub("Accountability"),
        desc(
            "Attributing actions to an identity. Depends entirely on "
            "authentication being individual -- shared accounts destroy it "
            "completely, since the log can only record that somebody who knew "
            "the password did something."
        ),
        sub("Compliance"),
        desc(
            "Demonstrating to an auditor or regulator that controls operate. "
            "Often the reason logging gets funded, and operationally the least "
            "useful of the four -- a log that satisfies an auditor may contain "
            "nothing an investigator can use."
        ),
    ]),

    ("What to Log", [
        ul([
            "Authentication events: successes as well as failures, because a "
            "successful login from an unusual place at an unusual hour is the "
            "interesting one",
            "Authorisation failures: a user repeatedly hitting refusals is "
            "either confused or systematically probing",
            "Administrative actions: privilege changes, configuration changes, "
            "account creation and deletion",
            "Data access for sensitive records, which is what makes an insider "
            "investigation possible at all",
            "System events: service starts and stops, crashes, and changes to "
            "the logging configuration itself",
            "Network events at boundaries: connections accepted and rejected, "
            "and unusual outbound destinations",
        ]),
    ]),

    ("Why Logging Everything Is Not the Answer", [
        desc(
            "Volume has a direct cost in storage and processing, and an "
            "indirect cost that matters more: it buries the signal. An "
            "alerting system that fires constantly is one that gets ignored."
        ),
        desc(
            "That failure mode is worth naming, because from a distance it "
            "looks exactly like success -- the organisation has comprehensive "
            "logging, an expensive platform and thousands of daily alerts, and "
            "detects nothing. Selecting what to log is a design decision "
            "rather than an admission of limited budget."
        ),
    ]),

    ("Log Integrity", [
        desc(
            "An attacker's first move after gaining privilege is very often "
            "the logs, for the obvious reason. If they can be edited, they "
            "prove nothing -- and worse, an investigation relying on edited "
            "logs reaches confident wrong conclusions rather than admitting "
            "ignorance."
        ),
        ul([
            "Forward logs off the host promptly, so that compromising a "
            "machine does not give control of its own record",
            "Write to append-only or write-once storage where the platform "
            "supports it",
            "Restrict who may READ logs as well as who may write them, since "
            "logs themselves contain sensitive material and reconnaissance "
            "value",
            "Log changes to logging configuration, because disabling logging "
            "should itself be a loud and visible event",
            "Synchronise clocks across the estate, or correlating events "
            "between systems becomes guesswork",
        ]),
    ]),

    ("Why Time Synchronisation Matters More Than It Sounds", [
        desc(
            "Reconstructing an incident means ordering events from a dozen "
            "systems into a single timeline. That timeline is the entire "
            "product of an investigation -- it is what establishes the entry "
            "point, the scope and the duration."
        ),
        desc(
            "If system clocks disagree by minutes, cause and effect can appear "
            "reversed, and an investigator can conclude that a system was "
            "compromised before the attacker arrived, or that an action "
            "preceded the login that authorised it. NTP across the estate and "
            "timestamps recorded in UTC are what make the timeline "
            "trustworthy, and they cost nothing."
        ),
    ]),

    ("SIEM", [
        desc(
            "A security information and event management platform collects "
            "logs from across the estate, normalises their differing formats "
            "into a common schema, correlates events between them, and raises "
            "alerts."
        ),
        image(SIEM_DIAGRAM),
    ]),

    ("Why Correlation Is the Point", [
        desc(
            "A SIEM's value lies almost entirely in correlation rather than "
            "collection. A single failed login is unremarkable and happens "
            "thousands of times a day; a failed login for the same account on "
            "forty hosts within one minute is not."
        ),
        desc(
            "No individual system can see that pattern, because each host "
            "observed only its own single event and quite reasonably ignored "
            "it. Bringing the logs together is what makes the pattern visible, "
            "and detecting patterns no individual system can see is the whole "
            "justification for the platform."
        ),
    ]),

    ("How SIEM Deployments Fail", [
        desc(
            "SIEM deployments fail in a predictable way, and the failure is "
            "not technical. Tuning is the work, not installation: an untuned "
            "platform produces thousands of alerts a day, the great majority "
            "of them benign."
        ),
        desc(
            "Analysts learn to dismiss them -- rationally, since dismissal is "
            "correct almost every time -- and the organisation now has an "
            "expensive system that has actively taught its staff to ignore "
            "warnings. That is worse than no alerting at all, because it "
            "consumes both budget and attention while producing false "
            "confidence."
        ),
    ]),

    ("Audit: Three Kinds", [
        tabs([
            ("Internal", "Internal audit",
             "Conducted by the organisation's own audit function, structurally "
             "independent of the teams it examines. Frequent, comparatively "
             "cheap and useful for finding problems before anyone external "
             "does. Its independence is organisational rather than absolute, "
             "which is its limitation and why external audit exists."),
            ("External", "External audit",
             "Conducted by an outside firm, typically for certification such "
             "as ISO 27001 or at a regulator's requirement. It carries weight "
             "precisely because the auditor has no stake in the answer and no "
             "relationship to protect."),
            ("Technical", "Technical audit and configuration review",
             "Examining systems directly against a standard -- checking actual "
             "settings rather than asking what the settings should be. This is "
             "where the gap between documented and deployed appears, and it is "
             "where most substantive findings live."),
        ]),
    ]),

    ("What an Auditor Is Actually Testing", [
        desc(
            "Auditors distinguish design effectiveness from operating "
            "effectiveness, and this distinction is the source of most audit "
            "surprises."
        ),
        desc(
            "Design effectiveness asks whether the control, as specified, "
            "would address the risk if it were performed. Operating "
            "effectiveness asks whether it actually ran, every time, "
            "throughout the period under review. A control can pass the first "
            "comprehensively and fail the second."
        ),
    ]),

    ("Why Sound Controls Fail Audits", [
        desc(
            "A quarterly access review that is well designed and was performed "
            "twice last year fails on operating effectiveness even though the "
            "control itself is entirely sound and everybody involved agrees it "
            "is a good idea."
        ),
        desc(
            "This is why evidence matters so much and why auditors ask for it "
            "rather than accepting assurance. The auditor is not asking "
            "whether you do the thing -- they are asking you to demonstrate "
            "that you did it, on each occasion, with a record. 'We always do "
            "that' is not evidence, and organisations are consistently "
            "surprised that it is not accepted."
        ),
    ]),

    ("The Incident Response Lifecycle", [
        desc(
            "Six stages, and the order matters: each depends on the one before "
            "it, and skipping ahead is the source of the most expensive "
            "mistakes."
        ),
        image(IR_DIAGRAM),
    ]),

    ("The Six Stages", [
        ol([
            "Preparation: plans, tooling, contacts, authority and rehearsal, "
            "all established before anything happens",
            "Detection and analysis: recognising that an event is an incident, "
            "and establishing its scope and severity",
            "Containment: stopping the spread, first quickly and then in a way "
            "that is sustainable",
            "Eradication: removing the attacker's access and the mechanism "
            "they used to obtain it",
            "Recovery: restoring service and confirming the environment is "
            "genuinely clean",
            "Lessons learned: the review that turns an incident into a change "
            "-- and the step most often skipped",
        ]),
    ]),

    ("Preparation Decides the Outcome", [
        desc(
            "Almost everything determining how an incident goes is settled "
            "before it starts. Whether contact details are current. Whether "
            "anyone has authority to disconnect a production system at three "
            "in the morning without convening a meeting. Whether the response "
            "team can reach systems if the corporate network itself is "
            "compromised. Whether anyone involved has ever done this before."
        ),
        desc(
            "A plan requiring an executive decision at every step will stall, "
            "and it will stall precisely when speed matters most. "
            "Pre-authorising specific containment actions -- isolate a host, "
            "disable an account, block an address -- is what lets responders "
            "move at the speed the situation requires rather than the speed "
            "the approval process allows."
        ),
    ]),

    ("Short-Term and Long-Term Containment", [
        desc(
            "Containment has two phases, and conflating them causes real "
            "damage."
        ),
        sub("Short-term containment"),
        desc(
            "Stops the immediate spread: isolate the host, disable the "
            "account, block the address at the perimeter. It is fast and "
            "crude, it may break things, and it is the right first move "
            "because the alternative is the attacker continuing to work."
        ),
        sub("Long-term containment"),
        desc(
            "Makes the environment safe to operate while eradication proceeds: "
            "rebuilt systems brought back behind additional monitoring, "
            "temporary access restrictions, credentials rotated across the "
            "estate. This is what allows the business to function during a "
            "response that may take days."
        ),
        desc(
            "Skipping straight from short-term containment to recovery is how "
            "organisations get compromised twice by the same intrusion -- and "
            "the second time with considerably less credibility."
        ),
    ]),

    ("The Tension Between Containment and Evidence", [
        desc(
            "Pulling the power on a compromised machine stops the attacker "
            "instantly and destroys everything held in memory: running "
            "processes, network connections, encryption keys, and in many "
            "cases the only trace of malware that never touched disk at all."
        ),
        desc(
            "Isolating the host from the network instead preserves all of that "
            "while still cutting the attacker off, which is why isolation is "
            "the default recommendation. The attacker cannot reach the machine "
            "and the evidence remains available."
        ),
    ]),

    ("Deciding in Advance", [
        desc(
            "Which action to choose depends on whether the evidence will "
            "matter -- and that is a judgement nobody should be making for the "
            "first time at three in the morning while a ransom note is on "
            "screen."
        ),
        desc(
            "If prosecution, an insurance claim or a regulatory report is in "
            "prospect, volatile evidence must be captured before anything is "
            "powered off. The decision has to be anticipated in the plan, so "
            "that responders know it is a decision at all rather than "
            "instinctively reaching for the power switch."
        ),
    ]),

    ("Handling Evidence", [
        ol([
            "Capture volatile data first -- memory, running processes, network "
            "connections, logged-on users -- because it is gone the moment "
            "power is lost",
            "Image storage rather than examining the original, and work "
            "entirely from the copy",
            "Hash the image on creation so that any later alteration is "
            "demonstrable",
            "Record a chain of custody: who held the evidence, when, and what "
            "they did with it",
            "Document actions as they are taken, since memory of a long night "
            "is unreliable and the review will need the exact sequence",
        ]),
    ]),

    ("Classifying and Escalating", [
        desc(
            "Not every alert is an incident and not every incident is a "
            "crisis. A severity scheme agreed in advance is what prevents both "
            "over-reaction, which exhausts a team that will be needed later, "
            "and under-reaction, which is how a small compromise becomes a "
            "large one."
        ),
        ul([
            "Sensitive data confirmed accessed: high or critical, because "
            "regulatory notification clocks may already be running and the "
            "timeline is now external rather than internal",
            "Single workstation, contained, no data access: low, and "
            "over-escalating it trains people to ignore escalations",
            "Attacker holds administrative credentials: critical, because "
            "scope is effectively unbounded until proven otherwise and every "
            "assumption about what is unaffected becomes unsafe",
            "Production service unavailable: high, since business impact is "
            "immediate and visible even where no data is at risk",
        ]),
    ]),

    ("Notification Obligations", [
        desc(
            "Many jurisdictions impose a deadline for reporting a personal "
            "data breach to a regulator -- 72 hours under GDPR, with similar "
            "regimes elsewhere -- and the clock starts on becoming AWARE, not "
            "on finishing the investigation."
        ),
        desc(
            "This catches organisations out repeatedly, because the "
            "instinctive response is to establish the facts before telling "
            "anyone, and the facts often take longer than the deadline. Legal "
            "and communications colleagues therefore belong in the response "
            "plan and in the early calls, rather than being informed once the "
            "technical work is complete."
        ),
    ]),

    ("The Post-Incident Review", [
        desc(
            "The review is where an incident finally produces value, and it is "
            "the step most often skipped -- because everyone is exhausted, the "
            "service is back, and there is a backlog of ordinary work waiting."
        ),
        desc(
            "Its purpose is to change something concrete: a control, a "
            "procedure, a monitoring rule, an architectural assumption. A "
            "review producing only a narrative has documented the incident "
            "without learning from it."
        ),
    ]),

    ("Why the Review Must Be Blameless", [
        desc(
            "A review that identifies who made a mistake produces "
            "defensiveness and incomplete accounts. People withhold detail "
            "that might reflect badly on them, which means the reconstruction "
            "is wrong, which means the fix addresses the wrong thing."
        ),
        desc(
            "It also has a longer-term cost: the next incident will be "
            "reported later, or not at all, because reporting one has been "
            "demonstrated to be dangerous. A review asking why the SYSTEM "
            "allowed a single mistake to have this consequence produces "
            "answers about controls and design that survive staff turnover, "
            "rather than a resolution to be more careful that survives about a "
            "fortnight."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Collecting logs nobody reads",
             "A log written to disk with no alerting detects nothing. "
             "Collection is necessary and nowhere near sufficient, and it is "
             "frequently mistaken for a detection capability."),
            ("Leaving a SIEM untuned",
             "Thousands of daily alerts train analysts to dismiss them, and "
             "the real detection then arrives in a queue nobody reads "
             "carefully. Tuning is the work."),
            ("Powering off a compromised machine reflexively",
             "It destroys memory-resident evidence, including malware that "
             "never touched disk. Network isolation cuts the attacker off "
             "while preserving it, and should be the default."),
            ("Recovering before eradication is complete",
             "Restoring service while the attacker still holds access means "
             "being compromised twice by one intrusion, and the second time "
             "with much less credibility internally and externally."),
            ("Skipping the post-incident review",
             "Without it the same incident recurs, and the organisation has "
             "paid the full cost of the lesson without collecting any of it."),
            ("Unsynchronised clocks",
             "Correlating events across systems becomes guesswork, and a "
             "timeline with reversed cause and effect is worse than no "
             "timeline, because it produces confident wrong conclusions."),
        ]),
    ]),

    ("Practical Example: A Ransomware Note at 02:00", [
        desc(
            "A file server displays a ransom note. The immediate temptation is "
            "to shut everything down, and it is understandable -- the instinct "
            "is to stop the damage spreading by any means available."
        ),
        desc(
            "The prepared response is more precise: isolate affected hosts "
            "from the network while leaving them running, so that memory and "
            "any encryption keys still resident are preserved, and identify "
            "scope from the SIEM rather than by walking the estate machine by "
            "machine."
        ),
    ]),

    ("Working the Sequence", [
        ol([
            "Contain: isolate identified hosts, disable the compromised "
            "account, block the command-and-control address at the perimeter",
            "Analyse: establish the entry point and the time of first access, "
            "which is what bounds everything else",
            "Notify: engage legal and communications early, since a personal "
            "data breach starts a regulatory clock on awareness rather than on "
            "certainty",
            "Eradicate: rebuild rather than clean, because confidence in a "
            "cleaned host is never as high as in a rebuilt one, and rotate "
            "every credential that was exposed",
            "Recover: restore from a backup predating the intrusion, verified "
            "clean, and bring systems back behind additional monitoring",
            "Review: establish why the entry point existed and why detection "
            "took as long as it did",
        ]),
    ]),

    ("The Step People Most Want to Skip", [
        desc(
            "Restoring from a backup that predates the intrusion, rather than "
            "from the most recent one, is consistently the hardest step to "
            "accept -- because it means deliberately discarding days or weeks "
            "of legitimate work."
        ),
        desc(
            "The most recent backup very often contains the attacker's "
            "foothold, since an intrusion typically begins well before the "
            "ransomware executes. Restoring it hands the environment straight "
            "back with the attacker still inside. This is precisely why "
            "establishing the time of first access is an operational necessity "
            "rather than an academic exercise -- it is the figure that decides "
            "which backup is safe."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "The four purposes of logging and what each implies",
            "Log integrity measures, especially forwarding and clock "
            "synchronisation",
            "What a SIEM adds, and the alert fatigue failure mode",
            "Design versus operating effectiveness in an audit",
            "The six-stage lifecycle in order",
            "Short-term versus long-term containment",
            "The containment/evidence tension and why isolation is preferred",
            "Why recovery must use a backup predating the intrusion",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Logging serves detection, investigation, accountability and "
            "compliance -- and shared accounts destroy the third",
            "Forward logs off the host and synchronise clocks; a SIEM's value "
            "is correlation rather than collection",
            "Auditors test design effectiveness AND operating effectiveness; "
            "evidence of operation is what is actually requested",
            "The lifecycle is preparation, detection and analysis, "
            "containment, eradication, recovery, lessons learned",
            "Containment has short-term and long-term phases; isolate rather "
            "than power off to preserve volatile evidence",
            "Breach notification clocks start on awareness, not on completing "
            "the investigation",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Detection is a separate discipline from prevention and is what "
            "shortens dwell time",
            "Logs must be forwarded, protected and time-synchronised or they "
            "prove nothing and may mislead",
            "An untuned SIEM actively harms detection by training people to "
            "ignore alerts",
            "Auditors test whether a control would work AND whether it "
            "actually ran; the second is where sound controls fail",
            "Preparation decides how an incident goes, particularly "
            "pre-authorised containment actions",
            "Isolating preserves evidence that powering off destroys, and that "
            "choice must be anticipated rather than made at 3am",
            "Recovery must follow eradication, from a backup predating the "
            "intrusion, and the blameless review is what makes the cost worth "
            "something",
        ]),
    ]),
]

_ir_quiz = [
    mcq("EASY",
        "What is the correct order of the incident response lifecycle?",
        [("Preparation, detection and analysis, containment, eradication, "
          "recovery, lessons learned", True),
         ("Detection, preparation, recovery, containment, eradication, lessons "
          "learned", False),
         ("Preparation, containment, detection, recovery, eradication, lessons "
          "learned", False),
         ("Detection, containment, recovery, eradication, preparation, lessons "
          "learned", False)],
        "Preparation comes first because it happens before any incident, and "
        "lessons learned comes last because it turns the incident into change. "
        "In between, you must detect and understand before containing, contain "
        "before eradicating, and eradicate before recovering -- recovering "
        "while the attacker still has access simply restarts the incident."),
    mcq("EASY",
        "Why must system clocks be synchronised across an estate?",
        [("So that events from different systems can be correlated into a "
          "reliable timeline", True),
         ("So that log files rotate at the same time and use less "
          "storage", False),
         ("So that authentication tokens remain valid across systems", False),
         ("So that backup jobs do not overlap and contend for "
          "bandwidth", False)],
        "Investigating an incident means ordering events from many systems into "
        "one sequence, and that timeline is the entire product of the "
        "investigation. Clocks disagreeing by minutes can make cause appear to "
        "follow effect, leading to confident wrong conclusions. The other "
        "effects are real but minor and none is why synchronisation is a "
        "security requirement."),
    mcq("AVERAGE",
        "A compromised workstation is discovered. Why is isolating it from the "
        "network usually preferable to powering it off?",
        [("Powering off destroys memory-resident evidence such as running "
          "processes, connections and keys, while isolation cuts the attacker "
          "off and preserves it.", True),
         ("Powering off may trigger a destructive payload configured to run at "
          "shutdown.", False),
         ("Isolation is faster to perform than a shutdown.", False),
         ("Powering off voids the hardware warranty for forensic "
          "purposes.", False)],
        "Volatile memory holds much of the useful evidence, including malware "
        "that never wrote itself to disk at all, and it is lost the instant "
        "power goes. Isolation achieves the containment goal without that "
        "cost. Shutdown-triggered payloads exist but are not the general "
        "reason, speed is not the issue, and warranties are irrelevant."),
    mcq("AVERAGE",
        "An organisation performs a well-designed quarterly access review, but "
        "evidence shows it was carried out only twice in the past "
        "year.\n\nHow would an auditor characterise this?",
        [("The control is effective in design but has failed operating "
          "effectiveness.", True),
         ("The control has failed design effectiveness and must be "
          "redesigned.", False),
         ("The control passes, because a documented process exists and was "
          "partially followed.", False),
         ("The finding is administrative and carries no weight if no breach "
          "resulted.", False)],
        "Design effectiveness asks whether the control would address the risk "
        "if performed; this one clearly would, and nobody disputes it is a "
        "good control. Operating effectiveness asks whether it actually ran "
        "throughout the period; this one did not. A control performed half the "
        "time provides roughly half the assurance, and auditors report on "
        "operation regardless of whether harm happened to result."),
    mcq("AVERAGE",
        "Why is an untuned SIEM sometimes worse than having no SIEM at all?",
        [("It generates so many alerts that analysts learn to dismiss them, so "
          "genuine detections are ignored while the organisation believes it "
          "has detection.", True),
         ("It consumes log storage that would otherwise be available for "
          "retention.", False),
         ("It cannot correlate events until at least a year of history has "
          "accumulated.", False),
         ("It automatically blocks legitimate traffic until rules are "
          "written.", False)],
        "The dangerous part is the false confidence. Alert fatigue is a "
        "well-documented failure mode: dismissal is rationally correct almost "
        "every time, so analysts learn to dismiss, and a queue nobody reads "
        "carefully detects nothing. The organisation has both spent the money "
        "and stopped looking. Storage is manageable, correlation does not "
        "require a year of data, and a SIEM observes rather than blocks."),
    mcq("AVERAGE",
        "Which purpose of logging is destroyed entirely by the use of shared "
        "accounts?",
        [("Accountability", True), ("Detection", False),
         ("Compliance", False), ("Investigation", False)],
        "Accountability means attributing a recorded action to an individual. "
        "If six people know the password, the log can only establish that "
        "somebody who knew it acted, which narrows the field to six and proves "
        "nothing about any of them. Detection and investigation still function "
        "partially, and compliance reporting may still be produced -- but "
        "attribution is gone in principle rather than merely in practice."),
    mcq("HARD",
        "During ransomware recovery, why should restoration use a backup that "
        "predates the intrusion rather than the most recent one?",
        [("The most recent backup very likely contains the attacker's "
          "foothold, so restoring it reintroduces the compromise.", True),
         ("Recent backups are more likely to be corrupted by the encryption "
          "process.", False),
         ("Older backups restore faster because they contain less data.", False),
         ("Regulators require restoration from the oldest available "
          "backup.", False)],
        "An intrusion typically begins well before the ransomware executes, "
        "often by weeks, so backups taken during that window include the "
        "persistence mechanism. Restoring one hands the environment back with "
        "the attacker still inside. This is exactly why establishing the time "
        "of first access is an operational necessity rather than an academic "
        "exercise -- it decides which backup is safe. Corruption, restore speed "
        "and regulation are not the reason."),
    mcq("HARD",
        "Why must a post-incident review be blameless to be effective?",
        [("Attributing fault produces defensive, incomplete accounts and "
          "discourages future reporting, whereas asking why the system allowed "
          "the consequence produces durable changes.", True),
         ("Employment law prohibits identifying individuals in incident "
          "documentation.", False),
         ("Blameless reviews are faster to complete, reducing the cost of the "
          "incident.", False),
         ("Auditors will not accept a review that names individuals.", False)],
        "The purpose of the review is an accurate account and a change "
        "outlasting the people involved. Fault-finding delivers neither: "
        "people withhold detail, so the reconstruction is wrong and the fix "
        "addresses the wrong thing, and the next incident gets reported later "
        "or not at all. Asking why a single mistake was able to have that "
        "consequence produces answers about controls and design. Neither law, "
        "speed nor audit acceptance is the driver."),
    short_answer("EASY",
        "What is the term for a platform that collects, normalises and "
        "correlates log data from across an estate and raises alerts? Give the "
        "acronym.",
        "SIEM",
        ["siem", "security information and event management",
         "security information event management"]),
    short_answer("AVERAGE",
        "What is the term for the documented record of who held evidence, when, "
        "and what they did with it?",
        "Chain of custody",
        ["chain of custody", "the chain of custody", "custody chain"]),
    descriptive("HARD",
        "Explain the tension between containing an incident quickly and "
        "preserving evidence, and describe how a prepared organisation "
        "resolves it.",
        "Containment aims to stop the attacker doing further harm, and the "
        "fastest crude action -- powering off the affected machine -- achieves "
        "that immediately and completely. But it also destroys everything held "
        "in volatile memory: running processes, open network connections, "
        "encryption keys, and in many cases the only trace of malware that "
        "never wrote itself to disk at all. An investigation that then cannot "
        "establish the entry point or the time of first access cannot bound "
        "the scope of the compromise, which means the organisation does not "
        "know what else to check, which accounts to treat as exposed, or which "
        "backup is safe to restore from. Preserving evidence, however, takes "
        "time during which the attacker may still be active, so the two goals "
        "genuinely pull against each other rather than being reconcilable by "
        "good intentions. A prepared organisation resolves this in three ways. "
        "First, it prefers network isolation to shutdown: disconnecting the "
        "host cuts the attacker off just as effectively while leaving memory "
        "intact, which satisfies both goals in the majority of cases and "
        "should be the documented default. Second, it decides in advance "
        "whether evidence will matter -- whether prosecution, an insurance "
        "claim or a regulatory report is in prospect -- so that responders are "
        "not making that judgement for the first time at three in the morning; "
        "where it does matter, volatile data is captured before anything is "
        "powered off, working from a hashed image rather than the original and "
        "recording a chain of custody throughout. Third, it pre-authorises "
        "specific containment actions such as isolating a host or disabling an "
        "account, so responders act immediately instead of waiting for a "
        "decision -- because it is precisely that waiting which creates the "
        "time pressure under which evidence gets destroyed.",
        [("Explains what powering off destroys and why it matters to the "
          "investigation", 4),
         ("Identifies network isolation as resolving most of the tension", 3),
         ("Describes preparation: pre-authorised actions, or deciding evidence "
          "needs in advance", 3)]),
]

LESSON_INCIDENT = {
    "middle": MID_ISMS,
    "name": "Security Auditing, Logging, and Incident Response",
    "quiz": _ir_quiz,
    "structure": lesson_structure(
        "Security Auditing, Logging, and Incident Response",
        "The other lessons in this category describe an ISMS at the management "
        "level. This one covers the machinery it runs on. You will learn why "
        "detection is a separate discipline from prevention and what dwell "
        "time measures, the four purposes of logging and why logging "
        "everything defeats the object, how log integrity and clock "
        "synchronisation decide whether an investigation reaches a sound "
        "conclusion or a confident wrong one, what auditors actually test and "
        "why well-designed controls still fail audits, the six-stage incident "
        "response lifecycle, and the tension between containing an incident "
        "fast and preserving the evidence needed to understand it.",
        [
            "Explain why detection is distinct from prevention and what dwell "
            "time indicates",
            "State the four purposes of logging and what each implies for "
            "retention and protection",
            "Identify what should be logged and explain why logging everything "
            "is counterproductive",
            "Describe the measures protecting log integrity, including "
            "forwarding and clock synchronisation",
            "Explain what a SIEM adds through correlation and why tuning "
            "determines whether it helps or harms",
            "Distinguish design effectiveness from operating effectiveness and "
            "explain why sound controls fail audits",
            "State the six stages of incident response and distinguish "
            "short-term from long-term containment",
            "Explain the containment/evidence tension and how preparation "
            "resolves it",
            "Explain why recovery must use a backup predating the intrusion",
        ],
        60,
        _ir_sections,
        [
            ("Dwell time",
             "The interval between an intrusion beginning and its detection. "
             "The headline measure of a detection capability."),
            ("SIEM",
             "Security Information and Event Management: collects, normalises "
             "and correlates logs across an estate and raises alerts."),
            ("Alert fatigue",
             "The failure mode in which excessive benign alerts train analysts "
             "to dismiss them, so genuine detections are missed."),
            ("Design vs operating effectiveness",
             "Whether a control would work as specified, versus whether it "
             "actually ran throughout the period. Audits test both, and the "
             "second is where sound controls fail."),
            ("Short-term containment",
             "Fast, crude action to stop immediate spread: isolate, disable, "
             "block."),
            ("Long-term containment",
             "Making the environment safe to operate while eradication "
             "proceeds, before recovery begins."),
            ("Volatile evidence",
             "Memory-resident data -- processes, connections, keys -- lost "
             "when a system is powered off."),
            ("Chain of custody",
             "The documented record of who held evidence, when, and what they "
             "did with it."),
            ("Blameless review",
             "A post-incident review asking why the system permitted the "
             "consequence rather than who erred, producing durable change and "
             "honest accounts."),
        ],
        "Prevention failing quietly is the normal case, which is why detection "
        "is its own discipline and dwell time is the number that matters. Logs "
        "serve detection, investigation, accountability and compliance, and "
        "each purpose implies different retention and protection -- but a log "
        "nobody reads detects nothing, one an attacker can edit proves "
        "nothing, and one with unsynchronised timestamps actively misleads, so "
        "forwarding, integrity protection and NTP are prerequisites rather "
        "than refinements. A SIEM earns its cost through correlation, "
        "detecting patterns no single system can see, and loses it entirely "
        "through poor tuning, because alert fatigue is worse than no alerting "
        "at all. Auditors test whether a control would work and whether it "
        "actually ran, and the second is where sound controls fail. Response "
        "runs preparation, detection, containment, eradication, recovery and "
        "review -- with containment split into a fast phase and a sustainable "
        "one, isolation preferred over shutdown so that evidence survives, "
        "recovery taken from a backup predating the intrusion rather than the "
        "most recent one, and a blameless review that finally turns the whole "
        "expensive episode into a change."),
}

LESSONS = [LESSON_INCIDENT]
