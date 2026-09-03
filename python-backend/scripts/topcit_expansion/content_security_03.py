"""Understanding of Security -> Risk Management and Assessment (MID 124).

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
and no coloured card grids.

The category already held "Risk Assessment Methodologies" and "Security Risk
Analysis", both about measuring risk once you know what the risks are. These
two cover the work either side of that: identifying threats in the first place,
and finding the weaknesses they would exploit. Neither lesson re-derives ALE,
SLE or ARO, which lesson 385 already teaches.

Written against TOPCIT ESSENCE Understanding of Security (Technical Field
03-2, Ver.2), section "Types of Network Attacks and Defense Mechanisms".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_RISK = 124

STRIDE_DIAGRAM = "/lesson-media/stride.svg"
KILLCHAIN_DIAGRAM = "/lesson-media/attack-chain.svg"
VULN_DIAGRAM = "/lesson-media/vulnerability-cycle.svg"
# ===========================================================================
# Threat Modelling and Attack Surface Analysis
# ===========================================================================

_threat_sections = [
    ("Threat, Vulnerability, Risk", [
        desc(
            "Three words used loosely everywhere and precisely in exams, and "
            "the distinction between them changes what you fix first. A THREAT "
            "is something that could cause harm -- an actor with motive and "
            "capability, or an event such as a flood. A VULNERABILITY is a "
            "weakness that would let it. RISK is what you get when the two "
            "meet something worth protecting."
        ),
        desc(
            "Risk is conventionally expressed as the likelihood that a threat "
            "exploits a vulnerability, multiplied by the impact if it does. "
            "All three elements must be present: remove any one and the risk "
            "goes with it."
        ),
    ]),

    ("Why the Distinction Changes Priorities", [
        desc(
            "Because all three elements are required, a threat with no "
            "matching vulnerability carries no risk, and so does a "
            "vulnerability no threat can reach."
        ),
        desc(
            "This is why patching an unreachable internal service may be less "
            "urgent than a smaller flaw on the perimeter, and it is why threat "
            "modelling and vulnerability management are different activities "
            "that must both happen. Knowing your vulnerabilities without "
            "knowing which threats can reach them produces a list nobody can "
            "prioritise."
        ),
    ]),

    ("Why Model Threats At All", [
        desc(
            "Security work without a model is a list of controls somebody "
            "thought of -- and what somebody thinks of depends on what they "
            "have seen before, which is a poor basis for defending something "
            "new."
        ),
        desc(
            "Threat modelling replaces that with a structured question: what "
            "can go wrong with THIS specific design? Asked early enough, the "
            "answer can still change the design. A flaw found in a diagram "
            "costs a conversation; the same flaw found in production costs an "
            "incident, a disclosure and a rewrite."
        ),
    ]),

    ("The Four Questions", [
        ol([
            "What are we building? Establish the design, the data it handles, "
            "and where trust boundaries fall",
            "What can go wrong? Enumerate threats systematically rather than "
            "by inspiration",
            "What are we going to do about it? Decide on mitigations, and "
            "record what you deliberately accept and why",
            "Did we do a good job? Review the model against what was actually "
            "built and against what has changed since",
        ]),
        desc(
            "The fourth question is the one organisations skip, and skipping "
            "it is what turns a threat model into a document rather than a "
            "practice. Systems change continuously; a model that is not "
            "revisited describes something that no longer exists."
        ),
    ]),

    ("STRIDE", [
        desc(
            "STRIDE is the best-known enumeration framework, and its value is "
            "that it prompts for categories a designer would not reach "
            "unaided. Left to free association, people list the threats they "
            "have personally encountered; a checklist forces consideration of "
            "the ones they have not."
        ),
        image(STRIDE_DIAGRAM),
    ]),

    ("The Six Categories", [
        desc(
            "Each letter corresponds to a security property it violates, which "
            "is a considerably better way to remember it than the word alone."
        ),
        accordion([
            ("Spoofing - violates authentication",
             "Pretending to be someone or something else: a forged token, a "
             "stolen credential, an impersonated service, a spoofed source "
             "address. Countered by strong authentication and by mutual "
             "authentication between services rather than only at the edge."),
            ("Tampering - violates integrity",
             "Modifying data in transit or at rest: altering a request "
             "parameter, editing a database row directly, changing a file on "
             "disk, modifying a message in flight. Countered by signatures, "
             "MACs and access control."),
            ("Repudiation - violates non-repudiation",
             "Denying an action credibly, because nothing proves otherwise. "
             "Countered by secure logging and digital signatures -- and "
             "defeated entirely by shared accounts, which make attribution "
             "impossible in principle."),
            ("Information disclosure - violates confidentiality",
             "Exposing data to those not entitled to it: verbose error "
             "messages, unprotected storage, unencrypted transport, an "
             "over-broad API response returning fields the client never "
             "displays. Countered by encryption and least privilege."),
            ("Denial of service - violates availability",
             "Exhausting a resource so legitimate users cannot be served: "
             "bandwidth, CPU, memory, disk, connection slots, or a rate limit "
             "shared between users. Countered by rate limiting, quotas, "
             "capacity planning and filtering."),
            ("Elevation of privilege - violates authorisation",
             "Gaining capabilities beyond those granted: exploiting a missing "
             "check, escaping a sandbox, abusing a role assignment, or finding "
             "an administrative function with no authorisation check at all. "
             "Countered by rigorous authorisation on every path rather than "
             "only on the ones the designer expected."),
        ]),
    ]),

    ("Trust Boundaries", [
        desc(
            "A trust boundary is any point where data crosses between "
            "components with different levels of trust: browser to server, "
            "service to database, application to third-party API, user space "
            "to kernel, one tenant to another."
        ),
        desc(
            "Threats concentrate at boundaries, because that is exactly where "
            "assumptions on one side meet reality on the other. Drawing them "
            "explicitly is most of the value of producing a data flow diagram "
            "at all -- the boundaries are what the diagram is for."
        ),
    ]),

    ("Validation Belongs on the Receiving Side", [
        desc(
            "Anything crossing a trust boundary must be validated on the "
            "receiving side, no matter how carefully it was constructed on the "
            "sending side. The reason is simple and absolute: an attacker "
            "replaces the sending side."
        ),
        desc(
            "Client-side validation is a usability feature. It gives honest "
            "users fast feedback and reduces round trips, and it provides no "
            "security whatever, because an attacker sends whatever they like "
            "directly. Only the side the defender controls can enforce "
            "anything, and this holds at every boundary -- not just the "
            "browser-to-server one."
        ),
    ]),

    ("Attack Surface", [
        desc(
            "The attack surface is the total set of points where an "
            "unauthorised party could attempt to interact with a system. It is "
            "worth enumerating precisely because it is the thing you can "
            "actually reduce."
        ),
        desc(
            "You cannot make attackers less motivated or less capable. You can "
            "give them fewer places to push, and every place removed is one "
            "that needs no monitoring, no patching and no defence."
        ),
    ]),

    ("Three Kinds of Surface", [
        sub("Network surface"),
        desc(
            "Open ports, listening services, exposed APIs, remote management "
            "interfaces, VPN endpoints. Reduced by closing ports, restricting "
            "source addresses, and removing services nobody uses -- which is "
            "usually more of them than anyone expects."
        ),
        sub("Software surface"),
        desc(
            "Input parsers, file uploads, deserialisation, template engines, "
            "dependencies and enabled features. Reduced by disabling unused "
            "features and by removing dependencies rather than merely keeping "
            "them updated."
        ),
        sub("Human surface"),
        desc(
            "Staff who can be phished or socially engineered, support "
            "processes that can be talked around, published contact details "
            "and organisational charts. Reduced by training, by verification "
            "procedures that do not depend on the caller sounding "
            "authoritative, and by limiting what any one person can do."
        ),
    ]),

    ("Attack Surface Reduction in Practice", [
        ul([
            "Every feature enabled by default that nobody uses is surface "
            "given away for free, and it must still be patched",
            "A service bound to 0.0.0.0 rather than 127.0.0.1 turns a local "
            "interface into a network one, often unintentionally",
            "Debug endpoints, admin consoles and default credentials survive "
            "into production remarkably often, and scanners find them within "
            "hours",
            "Each dependency added brings its own surface and its own "
            "transitive dependencies, which is why dependency count is itself "
            "a security metric",
            "Reduction beats detection: a port that is closed does not need "
            "monitoring, alerting, patching or an incident response plan",
        ]),
    ]),

    ("Threat Actors and Why They Matter", [
        desc(
            "Different attackers have different resources, motives and "
            "persistence, and controls effective against one may be irrelevant "
            "against another. Modelling without naming the actor produces "
            "defences aimed at nobody in particular."
        ),
        tabs([
            ("Opportunistic", "Opportunistic attackers",
             "Automated scanning for known vulnerabilities across the whole "
             "internet, with no interest in you specifically -- you are an IP "
             "address that answered. Defeated almost entirely by patching "
             "promptly and not exposing defaults, which is why basic hygiene "
             "stops the overwhelming majority of real attacks."),
            ("Targeted", "Targeted criminal groups",
             "Pursuing a specific organisation for money: ransomware, payment "
             "fraud, data theft for resale. They will spend weeks on "
             "reconnaissance and social engineering, so controls must survive "
             "an attacker who knows your organisation chart and your "
             "suppliers."),
            ("Insider", "Insiders",
             "Staff or contractors with legitimate access, whether malicious "
             "or merely careless. Perimeter controls are entirely irrelevant "
             "against them, which is why least privilege, separation of duties "
             "and logging carry so much weight."),
            ("State-level", "Advanced persistent threats",
             "Well-resourced, patient, and prepared to develop bespoke "
             "capability including unknown vulnerabilities. Realistically most "
             "organisations cannot repel one, and the sensible goal becomes "
             "detection and containment rather than prevention."),
        ]),
    ]),

    ("The Attack Chain", [
        desc(
            "Modelling an attack as a sequence rather than a single event is "
            "what makes defence in depth concrete rather than a slogan. An "
            "intrusion is not one successful exploit but a chain of steps, and "
            "breaking any link stops the chain."
        ),
        image(KILLCHAIN_DIAGRAM),
    ]),

    ("The Stages in Order", [
        ol([
            "Reconnaissance: gathering information about the target, often "
            "entirely from public sources -- job adverts, social media, DNS "
            "records",
            "Initial access: the first foothold, commonly phishing or an "
            "exposed vulnerable service",
            "Execution and persistence: running code and arranging to survive "
            "a reboot, a password change or the user noticing",
            "Privilege escalation: moving from the compromised account's "
            "rights to greater ones",
            "Lateral movement: reaching other systems from the foothold, which "
            "is where segmentation either helps or does not",
            "Collection and exfiltration: locating what was wanted and "
            "removing it, often slowly to avoid detection",
            "Impact: encryption for ransom, destruction, fraud, or quiet "
            "continued access for months",
        ]),
    ]),

    ("Why the Chain Framing Changes Priorities", [
        desc(
            "If you think of a breach as a single event, prevention is "
            "everything and any successful intrusion is total failure. That "
            "framing leads to spending everything at the perimeter and having "
            "no answer once it is crossed."
        ),
        desc(
            "If you think of it as a chain, the questions become better and "
            "answerable: how quickly would we notice? How far could an "
            "attacker get from a single compromised laptop? What would stop "
            "lateral movement? The answers -- segmentation, least privilege, "
            "logging, monitoring -- are precisely the controls that limit "
            "damage when prevention has already failed, which it eventually "
            "will."
        ),
    ]),

    ("Prioritising What You Find", [
        desc(
            "A threat model produces more findings than anyone will fix, so "
            "ranking is part of the method rather than an afterthought. The "
            "usual axes are the damage a successful attack would do, how "
            "easily it could be carried out, and how many users or assets it "
            "would affect."
        ),
        desc(
            "The specific scoring scheme matters far less than applying one "
            "consistently and recording the decisions. A finding deliberately "
            "accepted with a documented reason and a named owner is a managed "
            "risk; the same finding left silently unfixed is a surprise "
            "waiting to appear in an incident review, where the absence of a "
            "decision will be the most damaging fact."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Using threat and risk interchangeably",
             "A threat is a potential cause of harm; risk is likelihood "
             "combined with impact given a matching vulnerability. A threat "
             "with no reachable vulnerability carries no risk at all."),
            ("Threat modelling after the system is built",
             "The output is then a list of things that are expensive to "
             "change, and most will not be changed. The value is concentrated "
             "at design time, when a finding still costs a conversation."),
            ("Validating input only on the sending side",
             "An attacker replaces the sending side. Anything crossing a trust "
             "boundary must be validated where it arrives; client-side "
             "validation is a usability feature and not a control."),
            ("Modelling only external attackers",
             "Insiders already hold credentials and sit inside the perimeter, "
             "so every control assuming the attacker is outside contributes "
             "nothing against them."),
            ("Treating a threat model as a document",
             "It is a model of a system that changes. Once the architecture "
             "moves, an unrevised model describes something that no longer "
             "exists and may give false confidence."),
            ("Enumerating threats by free association",
             "People list what they have seen. A framework such as STRIDE "
             "forces consideration of the categories they have not, which is "
             "the entire reason for using one."),
        ]),
    ]),

    ("Practical Example: Modelling a File Upload", [
        desc(
            "A web application lets users upload profile pictures, which are "
            "stored and later served back to other users. It is about as "
            "ordinary a feature as exists, and it is a useful worked example "
            "precisely because nothing about it looks dangerous."
        ),
        desc(
            "The data flow crosses three trust boundaries: browser to web "
            "server, web server to storage, and storage back out to every "
            "other user's browser. STRIDE prompts at each one, and the "
            "findings do not require knowing any specific vulnerability."
        ),
    ]),

    ("What STRIDE Surfaces Here", [
        ul([
            "Tampering: the file's declared content type is entirely "
            "attacker-controlled, so the content must be validated rather than "
            "the declaration trusted",
            "Elevation of privilege: a file the server later executes turns an "
            "upload feature into remote code execution -- the classic path "
            "from a harmless feature to total compromise",
            "Information disclosure: predictable storage paths let one user "
            "enumerate another's uploads without any authorisation flaw",
            "Denial of service: an unbounded file size, or a decompression "
            "bomb that expands to gigabytes, exhausts disk or memory",
            "Spoofing: serving user content from the application's own origin "
            "lets an uploaded file act with the site's privileges in a "
            "visitor's browser, which is why user content is served from a "
            "separate domain",
        ]),
        desc(
            "None of these required specialist knowledge. They came from "
            "asking the framework's questions at the boundaries, which is what "
            "makes the method repeatable by people who are not security "
            "specialists -- and that repeatability is the point."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "The threat/vulnerability/risk distinction, often as a scenario "
            "about priority",
            "STRIDE letters mapped to the properties they violate",
            "Trust boundaries and where validation must occur",
            "The three kinds of attack surface and how each is reduced",
            "Threat actor categories and which controls are ineffective "
            "against each",
            "The attack chain and why the framing justifies containment "
            "controls",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Threat = potential cause, vulnerability = weakness, risk = "
            "likelihood x impact",
            "STRIDE maps to authentication, integrity, non-repudiation, "
            "confidentiality, availability, authorisation -- in that order",
            "Trust boundaries are where validation must happen, on the "
            "receiving side",
            "Attack surface is network, software and human -- and reduction "
            "beats detection",
            "Insiders bypass perimeter controls entirely",
            "Framing an intrusion as a chain is what justifies defence in "
            "depth",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Risk requires a threat AND a vulnerability AND something worth "
            "protecting; remove any one and the risk goes",
            "Threat modelling asks four questions and is most valuable at "
            "design time, when findings are still cheap",
            "STRIDE prompts for threat categories a designer would not reach "
            "by free association",
            "Anything crossing a trust boundary must be validated on arrival, "
            "because an attacker replaces the sender",
            "Attack surface is the part of the problem you can actually "
            "shrink, and unused enabled features are surface given away",
            "Different threat actors defeat different controls, and insiders "
            "defeat the perimeter entirely",
            "Breaking any link of the attack chain stops the intrusion, which "
            "is why containment matters as much as prevention",
        ]),
    ]),
]

_threat_quiz = [
    mcq("EASY",
        "Which STRIDE category corresponds to a violation of integrity?",
        [("Tampering", True), ("Spoofing", False),
         ("Repudiation", False), ("Information disclosure", False)],
        "Tampering is unauthorised modification of data, which is precisely an "
        "integrity violation. Spoofing violates authentication, repudiation "
        "violates non-repudiation, and information disclosure violates "
        "confidentiality. Mapping each letter to the property it breaks is the "
        "most reliable way to remember the framework."),
    mcq("EASY",
        "What is a trust boundary?",
        [("A point where data passes between components with different levels "
          "of trust", True),
         ("The network perimeter separating an organisation from the "
          "internet", False),
         ("The maximum privilege level a user account may hold", False),
         ("The point at which a certificate chain reaches a trusted "
          "root", False)],
        "A trust boundary exists anywhere trust levels differ -- browser to "
        "server, service to database, application to third-party API, user "
        "space to kernel -- and not only at the network edge. Threats "
        "concentrate there because assumptions on one side meet reality on the "
        "other."),
    mcq("AVERAGE",
        "An internal service has a serious vulnerability but is reachable only "
        "from a network segment no attacker can access.\n\nHow should this be "
        "characterised?",
        [("A vulnerability with low associated risk, because no threat can "
          "currently reach it", True),
         ("A threat with no vulnerability, so nothing needs recording", False),
         ("A high risk, because vulnerability severity determines risk "
          "directly", False),
         ("Not a security issue at all, since unreachable code cannot be "
          "exploited", False)],
        "Risk requires a threat that can actually reach a vulnerability, so "
        "reachability does much of the work that severity alone cannot. It "
        "remains a genuine vulnerability worth recording and eventually "
        "fixing, because a network change can make it reachable overnight "
        "without anyone re-examining its rating."),
    mcq("AVERAGE",
        "Why must input crossing a trust boundary be validated on the "
        "receiving side even when the sending side already validates it?",
        [("An attacker can replace or bypass the sending side entirely, so its "
          "validation guarantees nothing.", True),
         ("Validation logic degrades over time and must be duplicated for "
          "reliability.", False),
         ("Receiving-side validation is faster and reduces network "
          "load.", False),
         ("Sending-side validation cannot handle binary data.", False)],
        "Client-side or upstream validation is a usability feature giving "
        "honest users fast feedback. It is not a control, because an attacker "
        "controls their own client and can send whatever they like directly to "
        "the endpoint. Only the receiving side, which the defender controls, "
        "can enforce anything."),
    mcq("AVERAGE",
        "Which threat actor category makes perimeter-focused controls largely "
        "irrelevant, and why?",
        [("Insiders, because they already hold legitimate credentials and are "
          "inside the perimeter", True),
         ("Opportunistic attackers, because automated scanning ignores "
          "firewalls", False),
         ("State-level actors, because they always attack physical "
          "infrastructure", False),
         ("Targeted criminal groups, because they operate from within the "
          "same country", False)],
        "An insider starts past every boundary control, so firewalls and "
        "perimeter filtering contribute nothing against them. The defences "
        "that do apply are least privilege, separation of duties, monitoring "
        "and logging. Opportunistic scanning is exactly what perimeter "
        "controls stop well, and neither remaining category is defined by "
        "physical attack or geography."),
    mcq("AVERAGE",
        "A profile picture upload feature stores files under predictable "
        "paths.\n\nWhich STRIDE category does this most directly raise?",
        [("Information disclosure, because one user can enumerate another's "
          "uploads", True),
         ("Denial of service, because predictable paths increase server "
          "load", False),
         ("Spoofing, because the file's owner cannot be "
          "authenticated", False),
         ("Repudiation, because uploads cannot be attributed", False)],
        "Predictable paths let anyone guess and retrieve files belonging to "
        "other users without needing any authorisation flaw at all -- data "
        "exposed to those not entitled to it, which is information disclosure. "
        "The upload feature raises several other STRIDE categories too, but "
        "predictable naming specifically produces this one."),
    mcq("HARD",
        "Why does framing an intrusion as a chain of stages change defensive "
        "priorities compared with treating it as a single event?",
        [("Because breaking any link stops the intrusion, which makes "
          "containment controls such as segmentation and monitoring as "
          "valuable as prevention.", True),
         ("Because it proves that prevention is impossible and should be "
          "abandoned.", False),
         ("Because each stage requires a different vulnerability, so patching "
          "becomes unnecessary.", False),
         ("Because the chain determines the legal classification of the "
          "incident.", False)],
        "If a breach is one event, any successful intrusion is total failure "
        "and only prevention counts -- which leads to spending everything at "
        "the perimeter with no answer once it is crossed. As a chain, the "
        "useful questions become how far an attacker gets and how fast they "
        "are noticed, which justifies segmentation, least privilege and "
        "detection alongside prevention. Patching still breaks early links."),
    mcq("HARD",
        "A team enables every optional feature of a framework 'in case we need "
        "them later'.\n\nWhat is the security consequence?",
        [("The software attack surface grows, adding code paths that must be "
          "secured and patched but that deliver no value.", True),
         ("Performance degrades, which is a reliability rather than a security "
          "concern.", False),
         ("Nothing, provided the unused features are not documented "
          "publicly.", False),
         ("The threat model becomes simpler because behaviour is more "
          "uniform.", False)],
        "Every enabled feature is reachable code with its own parsers, "
        "endpoints and vulnerabilities, so it must be monitored and patched "
        "indefinitely while returning nothing. Reduction beats detection: a "
        "disabled feature cannot be exploited and needs no defence. Obscurity "
        "is not protection -- scanners find undocumented endpoints routinely "
        "-- and more enabled surface makes a model larger, not simpler."),
    short_answer("EASY",
        "What does the 'E' in STRIDE stand for?",
        "Elevation of privilege",
        ["elevation of privilege", "elevation", "privilege escalation",
         "escalation of privilege"]),
    short_answer("AVERAGE",
        "What term describes the total set of points where an unauthorised "
        "party could attempt to interact with a system?",
        "Attack surface",
        ["attack surface", "the attack surface", "attack surface area"]),
    descriptive("HARD",
        "Explain the difference between threat, vulnerability and risk, and "
        "use it to justify why two vulnerabilities of identical technical "
        "severity might be given very different priorities.",
        "A threat is a potential cause of harm -- an actor with motive and "
        "capability, or an event such as a flood or a hardware failure. A "
        "vulnerability is a weakness that a threat could exploit: a missing "
        "patch, an absent authorisation check, an untrained employee. Risk is "
        "the combination of the two against something worth protecting: the "
        "likelihood that a threat successfully exploits a vulnerability, "
        "multiplied by the impact if it does. Because all three elements are "
        "required, a threat facing no matching vulnerability produces no risk, "
        "and a vulnerability no threat can reach produces very little. This is "
        "exactly why technical severity alone is a poor prioritisation signal. "
        "Consider two flaws scored identically: one sits in a service "
        "listening on the public internet with no authentication in front of "
        "it, and the other in an internal tool reachable only from a segmented "
        "administrative network requiring separate credentials. The first is "
        "exposed to opportunistic scanning that will find it within hours, so "
        "its likelihood is close to certain and the whole internet is its "
        "threat population. The second requires an attacker to have already "
        "compromised something else and moved laterally, so its likelihood is "
        "far lower and it is partly protected by controls that would have to "
        "fail first. The first is fixed today under emergency change and the "
        "second is scheduled -- not because it is less severe in itself, but "
        "because reachability, and therefore likelihood, differs by orders of "
        "magnitude. The second still belongs on the risk register, because a "
        "single network change can make it reachable without anyone "
        "re-examining its rating.",
        [("Defines all three terms correctly and distinguishes them", 4),
         ("Explains that risk requires threat, vulnerability and impact "
          "together", 3),
         ("Applies the distinction to justify differing priorities on "
          "reachability", 3)]),
]

LESSON_THREAT = {
    "middle": MID_RISK,
    "name": "Threat Modelling and Attack Surface Analysis",
    "quiz": _threat_quiz,
    "structure": lesson_structure(
        "Threat Modelling and Attack Surface Analysis",
        "This category already teaches how to measure risk once you know what "
        "the risks are. This lesson covers the step before that: working out "
        "systematically what could go wrong with a specific system. You will "
        "learn the precise difference between threat, vulnerability and risk "
        "and why it changes what you patch first, the four questions a threat "
        "model answers and which one organisations skip, the STRIDE framework "
        "and the property each letter violates, why trust boundaries are where "
        "validation must happen and why the receiving side is the only side "
        "that counts, how to enumerate and reduce network, software and human "
        "attack surface, and why modelling an intrusion as a chain rather than "
        "an event changes what you invest in.",
        [
            "Distinguish threat, vulnerability and risk, and explain why "
            "severity alone does not set priority",
            "State the four questions a threat model answers and when in the "
            "lifecycle it is most valuable",
            "Apply STRIDE and map each category to the security property it "
            "violates",
            "Identify trust boundaries in a design and explain why validation "
            "must occur on the receiving side",
            "Enumerate network, software and human attack surface and describe "
            "how each is reduced",
            "Distinguish threat actor categories and identify which controls "
            "are ineffective against each",
            "Describe the stages of an attack chain and explain how the "
            "framing justifies containment controls",
            "Prioritise threat model findings and explain what distinguishes "
            "an accepted risk from an ignored one",
        ],
        55,
        _threat_sections,
        [
            ("Threat",
             "A potential cause of harm: an actor with motive and capability, "
             "or an event."),
            ("Vulnerability",
             "A weakness that a threat could exploit."),
            ("Risk",
             "The likelihood a threat exploits a vulnerability, combined with "
             "the impact if it does. All three elements are required."),
            ("STRIDE",
             "Spoofing, Tampering, Repudiation, Information disclosure, Denial "
             "of service, Elevation of privilege -- each violating one "
             "security property."),
            ("Trust boundary",
             "Any point where data crosses between components of differing "
             "trust, and therefore where validation must occur."),
            ("Attack surface",
             "The total set of points at which an unauthorised party could "
             "attempt to interact with a system: network, software and human."),
            ("Attack surface reduction",
             "Removing reachable functionality rather than defending it, on "
             "the basis that a closed port needs no monitoring."),
            ("Insider threat",
             "A threat actor already holding legitimate access, against whom "
             "perimeter controls are entirely ineffective."),
            ("Attack chain",
             "The sequence from reconnaissance through initial access, "
             "escalation and lateral movement to impact. Breaking any link "
             "stops the intrusion."),
            ("Accepted risk",
             "A finding deliberately tolerated with a documented reason, a "
             "named owner and a review date -- as distinct from one nobody "
             "decided about."),
        ],
        "Risk exists only where a threat, a vulnerability and something worth "
        "protecting coincide, which is why reachability often matters more "
        "than technical severity when deciding what to fix first. Threat "
        "modelling makes the enumeration systematic rather than inspired: four "
        "questions, STRIDE to prompt for categories a designer would otherwise "
        "miss, and trust boundaries to show where validation must happen -- on "
        "the receiving side, always, because an attacker simply replaces the "
        "sending side. Attack surface is the part of the problem you can "
        "actually shrink across its network, software and human forms, and "
        "every unused enabled feature is surface given away for nothing. "
        "Different threat actors defeat different controls, and an insider "
        "defeats the entire perimeter by definition. Finally, seeing an "
        "intrusion as a chain rather than an event is what makes segmentation, "
        "least privilege and monitoring as important as prevention: prevention "
        "only has to fail once, while the attacker has to succeed at every "
        "single link."),
}


# ===========================================================================
# Vulnerability Management and Penetration Testing
# ===========================================================================

_vuln_sections = [
    ("Finding Weaknesses Before Someone Else Does", [
        desc(
            "Threat modelling asks what could go wrong with a design. "
            "Vulnerability management asks what is actually wrong with the "
            "systems you are running right now, which is a different and less "
            "glamorous question."
        ),
        desc(
            "It is continuous, unexciting work, and it prevents far more "
            "incidents than any sophisticated control -- because the "
            "overwhelming majority of real compromises exploit something "
            "already known, already published and already fixed upstream. The "
            "attacker's advantage is not cleverness but the defender's "
            "backlog."
        ),
    ]),

    ("The Vulnerability Management Cycle", [
        desc(
            "The cycle is continuous rather than a project with an end, and "
            "each stage fails in a characteristic way."
        ),
        image(VULN_DIAGRAM),
    ]),

    ("The Six Stages", [
        ol([
            "Discover: maintain an accurate inventory of what you actually "
            "run, because you cannot assess what you do not know exists",
            "Assess: scan and evaluate, establishing which known weaknesses "
            "are present on which assets",
            "Prioritise: rank by exploitability, exposure and business impact "
            "rather than by raw score",
            "Remediate: patch, reconfigure, or apply a compensating control",
            "Verify: rescan to confirm the fix took effect, since a patch that "
            "failed to apply looks identical to one never scheduled",
            "Report: track trends over time, which is what shows whether the "
            "programme is working or merely busy",
        ]),
    ]),

    ("Asset Inventory Is the Foundation", [
        desc(
            "Every vulnerability programme fails in the same place first: the "
            "inventory. A forgotten server that nobody scans is not low risk, "
            "it is UNMEASURED risk, and it is precisely what an attacker "
            "finds, because attackers scan the whole address range rather than "
            "the asset list."
        ),
        desc(
            "Cloud environments make this considerably harder. Anyone with an "
            "API key can create infrastructure in seconds that no asset list "
            "knows about, and a clean scan report covering 60% of the estate "
            "is more misleading than no report at all -- it produces "
            "confidence without coverage."
        ),
    ]),

    ("CVE, CVSS and CWE", [
        desc(
            "Three registries that people mix up constantly, and exams test "
            "the distinction directly. They answer entirely different "
            "questions."
        ),
        sub("CVE - Common Vulnerabilities and Exposures"),
        desc(
            "A unique identifier for one specific flaw in one specific "
            "product, so that everyone discussing it knows they mean the same "
            "thing. CVE-2021-44228 names exactly one bug in exactly one "
            "library. It is an identifier and nothing else -- it carries no "
            "severity and no judgement."
        ),
        sub("CVSS - Common Vulnerability Scoring System"),
        desc(
            "A 0 to 10 severity score derived from characteristics such as "
            "attack vector, attack complexity, privileges required and impact. "
            "It measures technical severity in the abstract and knows nothing "
            "whatever about your environment."
        ),
        sub("CWE - Common Weakness Enumeration"),
        desc(
            "A CATEGORY of flaw rather than an instance: 'improper input "
            "validation', 'use after free', 'missing authorisation'. Many CVEs "
            "share one CWE, which is what makes CWE useful for spotting "
            "systemic causes -- if forty of your findings share a CWE, the "
            "problem is a practice rather than forty separate accidents."
        ),
    ]),

    ("Why CVSS Is Not Priority", [
        desc(
            "A CVSS base score describes a vulnerability in isolation: how bad "
            "it would be if an attacker could reach and exploit it. That "
            "isolation is deliberate, because the score has to mean the same "
            "thing to everyone who reads it."
        ),
        desc(
            "It therefore knows nothing about whether YOUR instance is "
            "exposed, whether a compensating control sits in front of it, "
            "whether the affected feature is even enabled in your "
            "configuration, or whether working exploit code is circulating "
            "publicly."
        ),
    ]),

    ("What Happens When Score Drives the Queue", [
        desc(
            "A 9.8 on an internal system behind two authentication layers may "
            "genuinely rank below a 6.5 on a public endpoint with a published "
            "exploit, because likelihood in the second case is close to "
            "certain and in the first is close to zero."
        ),
        desc(
            "Programmes that patch strictly in score order spend their first "
            "weeks on unreachable internal systems while the reachable "
            "lower-scored flaw stays open -- and then get breached through the "
            "thing they deferred. Staying busy and reducing risk are different "
            "achievements."
        ),
    ]),

    ("Scanning Approaches", [
        tabs([
            ("Unauthenticated", "Unauthenticated scanning",
             "Probes a system as an anonymous attacker would, seeing only what "
             "is externally visible. It is a good approximation of the outside "
             "view, and it infers a great deal from service banners, which "
             "produces both false positives -- a backported security fix "
             "leaves the version string unchanged -- and blind spots."),
            ("Authenticated", "Authenticated (credentialed) scanning",
             "Logs in and inspects installed package versions and "
             "configuration directly, removing the guesswork. Far more "
             "accurate with far fewer false positives, but requires managing "
             "credentials for the scanner across the estate, which is itself a "
             "risk needing proper handling."),
            ("Agent-based", "Agent-based scanning",
             "Software on each host reports its own state continuously. Suits "
             "laptops that are rarely on the corporate network when a "
             "scheduled scan runs, and short-lived cloud instances that would "
             "be created and destroyed entirely between scans."),
        ]),
    ]),

    ("False Positives and False Negatives", [
        desc(
            "A scanner's false positives waste effort and, worse, erode trust "
            "in the tool. Once a team learns that findings are usually wrong, "
            "they stop reading them carefully -- and a real finding goes "
            "unactioned in a queue nobody believes."
        ),
        desc(
            "False negatives are more dangerous and much harder to notice, "
            "because nothing at all tells you about the vulnerability the "
            "scanner failed to report. There is no signal, no entry and no "
            "prompt to investigate. This asymmetry is precisely why scanning "
            "is never the whole programme."
        ),
    ]),

    ("What Scanners Cannot Find", [
        desc(
            "Scanners find known flaws in known products by comparing versions "
            "and probing for known signatures. They do not find logic errors, "
            "broken authorisation, or a design that lets one user read "
            "another's data through an entirely legitimate API call with a "
            "changed identifier."
        ),
        desc(
            "Nothing about such a request looks wrong: it is well-formed, "
            "authenticated, and uses a documented endpoint exactly as "
            "intended. Recognising that it should have been refused requires "
            "understanding what the application is FOR, which is a human "
            "judgement."
        ),
    ]),

    ("Penetration Testing", [
        desc(
            "A penetration test is a human attempting to compromise a system "
            "under agreed rules, and its purpose is genuinely different from "
            "scanning rather than being a more thorough version of it. "
            "Scanning enumerates known weaknesses broadly; a test demonstrates "
            "what an attacker can actually achieve."
        ),
        desc(
            "The distinguishing output is the CHAIN. A tester who combines an "
            "information disclosure, a weak password policy and an "
            "over-permissive role into domain administrator has shown "
            "something no individual finding conveys -- and that narrative is "
            "usually what finally gets the underlying issues funded, after "
            "years of the same findings sitting in a report."
        ),
    ]),

    ("Knowledge Levels", [
        desc(
            "How much the tester knows in advance is a deliberate choice, and "
            "each level trades realism against coverage."
        ),
        ul([
            "Black box: no prior knowledge, closest to a real external "
            "attacker, but time is spent on discovery rather than depth and "
            "areas may go untested simply because they were not found",
            "White box: source code, architecture and credentials provided. "
            "Maximum coverage per day spent, least realistic as a simulation "
            "of an outside attack",
            "Grey box: some documentation and a standard user account. The "
            "usual commercial compromise and often the best value for money",
            "Red team exercise: the defenders are unaware, so the engagement "
            "tests detection and response as well as the technical estate -- a "
            "different objective from finding vulnerabilities",
        ]),
    ]),

    ("Rules of Engagement", [
        desc(
            "Written authorisation is what separates a penetration test from a "
            "crime, and this is not a formality or a paperwork exercise. "
            "Testing a system without documented permission is unauthorised "
            "access regardless of intent."
        ),
        ol([
            "Scope: which systems are in and which are explicitly out, stated "
            "by address or hostname rather than by description",
            "Permitted techniques, and which are excluded",
            "Timing: when testing may occur, and whether out-of-hours is "
            "required",
            "Contacts: who to call when something breaks, available "
            "throughout the engagement",
            "Escalation: what happens if the tester finds evidence of a real "
            "intrusion already in progress",
            "Data handling: what may be extracted as proof, and how it is "
            "stored and destroyed",
        ]),
    ]),

    ("Practical Constraints Worth Knowing", [
        ul([
            "Third-party and cloud-hosted systems may need the provider's "
            "separate permission, and some providers require advance "
            "notification",
            "Denial-of-service techniques are commonly excluded, because "
            "proving a service can be knocked over by knocking it over is "
            "rarely worth the outage",
            "Social engineering must be explicitly agreed, since it "
            "necessarily involves deceiving employees who have not consented",
            "Data handling matters enormously: a tester who extracts real "
            "customer records as proof has created a new breach rather than "
            "demonstrating one",
        ]),
    ]),

    ("Remediation, Mitigation, Transfer, Acceptance", [
        accordion([
            ("Remediation",
             "Fix the underlying flaw -- apply the patch, correct the "
             "configuration, rewrite the code. The only option that removes "
             "the vulnerability rather than managing it, and therefore the "
             "default choice where it is possible."),
            ("Mitigation",
             "Reduce likelihood or impact without removing the flaw: a "
             "firewall rule, a virtual patch at a web application firewall, "
             "disabling the affected feature, restricting who can reach it. "
             "Appropriate when a fix is not yet available or cannot be "
             "deployed in the time available."),
            ("Transfer",
             "Shift the financial consequence elsewhere, typically through "
             "insurance or a contractual term. Note carefully that it "
             "transfers cost and neither the incident nor the reputational "
             "damage -- customers do not care whose policy paid."),
            ("Acceptance",
             "Decide the risk is tolerable and document that decision with a "
             "named owner and a review date. Entirely legitimate and very "
             "common. What makes it dangerous is doing it implicitly, by never "
             "deciding at all, which is indistinguishable from negligence "
             "afterwards."),
        ]),
    ]),

    ("Patch Management Realities", [
        desc(
            "Everyone agrees patching matters and most organisations do it "
            "badly, because the obstacles are organisational rather than "
            "technical. A patch requires downtime nobody will authorise; a "
            "vendor certifies only an old version; a system is too critical to "
            "restart; or nobody is entirely sure what a component is still "
            "used for and is afraid to touch it."
        ),
        desc(
            "The practical answers are a defined patch window with "
            "pre-approved downtime, an emergency path for actively exploited "
            "vulnerabilities that bypasses the normal change queue, and "
            "documented compensating controls for systems that genuinely "
            "cannot be patched. An unpatchable system with no compensating "
            "control is an accepted risk whether or not anybody accepted it."
        ),
    ]),

    ("Zero-Days in Proportion", [
        desc(
            "A zero-day -- a vulnerability exploited before a patch exists -- "
            "receives attention entirely out of proportion to its share of "
            "real incidents. It is the interesting case, and interest is not "
            "the same as frequency."
        ),
        desc(
            "The overwhelming majority of compromises use vulnerabilities "
            "patched months or years earlier, because attackers use what "
            "works, and old flaws work constantly given how many systems "
            "remain unpatched. An organisation worrying about zero-days while "
            "running unpatched software is solving the right problem in the "
            "wrong order."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Treating CVSS score as priority order",
             "The base score deliberately ignores exposure, compensating "
             "controls and whether an exploit exists. A public 6.5 with "
             "working exploit code outranks an internal 9.8 behind two "
             "authentication layers."),
            ("Scanning without an accurate inventory",
             "Unknown assets are unscanned assets, and attackers scan address "
             "ranges rather than asset lists. A clean report covering most of "
             "the estate produces confidence without coverage."),
            ("Confusing a scan with a penetration test",
             "A scan enumerates known flaws automatically and at scale. A test "
             "demonstrates what a human achieves by chaining them, including "
             "logic flaws no scanner can recognise."),
            ("Skipping verification",
             "A patch that failed to apply is indistinguishable from one never "
             "scheduled, and the ticket says 'done' either way. Only a rescan "
             "distinguishes a fix from an intention."),
            ("Accepting risk implicitly",
             "A finding nobody fixed and nobody signed off is not an accepted "
             "risk, it is an ignored one -- and that distinction becomes "
             "extremely visible in an incident review."),
            ("Trusting version banners",
             "Backported security fixes leave the version string unchanged, so "
             "unauthenticated scanning reports flaws that were fixed weeks "
             "ago. This is a major source of false positives."),
        ]),
    ]),

    ("Practical Example: Triaging a Scan Result", [
        desc(
            "A quarterly scan returns 1,400 findings. Sorting by CVSS gives "
            "180 rated critical, which no team can address in a quarter -- and "
            "attempting it in that order would consume the quarter without "
            "materially reducing exposure."
        ),
        desc(
            "Sorting instead by whether the affected system is internet-facing "
            "reduces the list to 40. Filtering those for publicly available "
            "exploit code gives 12. That is a week's work rather than a "
            "quarter's, and it removes most of the genuine exposure."
        ),
    ]),

    ("The Order That Actually Reduces Risk", [
        ol([
            "Internet-facing with exploit code available: emergency change, "
            "fixed this week outside the normal queue",
            "Internet-facing, no known exploit: normal patch window",
            "Internal with exploit available: patch window, with network "
            "restrictions applied meanwhile as mitigation",
            "Internal, no exploit, high score: scheduled with the next "
            "maintenance cycle",
            "Everything else: batched into routine patching and tracked as a "
            "trend rather than individually",
        ]),
        desc(
            "The same 1,400 findings, ordered by reachability and exploit "
            "availability rather than by score, produce a first week of work "
            "that removes most of the real risk. That reordering is the single "
            "most valuable judgement in the entire discipline, and it costs "
            "nothing but the willingness to ignore the score column."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "CVE versus CVSS versus CWE, asked directly",
            "Why CVSS is not a remediation order",
            "Authenticated versus unauthenticated scanning accuracy",
            "What a penetration test finds that a scan cannot",
            "Black, grey and white box, and what a red team adds",
            "The four risk responses, and why acceptance must be explicit",
            "The relative frequency of zero-days versus known vulnerabilities",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "CVE identifies a specific flaw, CVSS scores severity, CWE "
            "categorises the weakness type",
            "CVSS measures technical severity, never risk in your environment",
            "Authenticated scanning is more accurate; unauthenticated shows "
            "the attacker's outside view",
            "Scanning finds known flaws; penetration testing demonstrates "
            "chained exploitation and logic flaws",
            "Black, grey and white box describe prior knowledge; a red team "
            "also tests detection and response",
            "The four responses are remediate, mitigate, transfer, accept -- "
            "and acceptance must be explicit and owned",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Vulnerability management is a continuous cycle, and it fails at "
            "the asset inventory before it fails anywhere else",
            "CVE, CVSS and CWE answer different questions and are not "
            "interchangeable",
            "Priority comes from exposure and exploit availability, not from "
            "the score alone",
            "Scanners find known flaws in known products and cannot find logic "
            "or authorisation errors",
            "False negatives are more dangerous than false positives, because "
            "nothing signals their existence",
            "A penetration test's value is the chain it demonstrates, and its "
            "legality rests entirely on written authorisation",
            "Most breaches use long-patched vulnerabilities, so zero-days "
            "deserve far less attention than patching discipline",
        ]),
    ]),
]

_vuln_quiz = [
    mcq("EASY",
        "What does a CVE identifier represent?",
        [("A unique identifier for one specific vulnerability in one specific "
          "product", True),
         ("A severity score from 0 to 10 for a vulnerability", False),
         ("A category of weakness such as improper input validation", False),
         ("A certification that a product has passed a security "
          "review", False)],
        "CVE gives one flaw one name so that everyone discussing it means the "
        "same thing, and carries no severity judgement of its own. The 0 to 10 "
        "score is CVSS, the weakness category is CWE, and CVE certifies "
        "nothing -- it is purely an identifier."),
    mcq("EASY",
        "Which scanning approach generally produces the most accurate results "
        "with the fewest false positives?",
        [("Authenticated scanning, which logs in and inspects installed "
          "versions directly", True),
         ("Unauthenticated scanning, because it sees the system exactly as an "
          "attacker does", False),
         ("Port scanning alone, because open ports are unambiguous", False),
         ("Passive traffic monitoring, because it cannot disturb the "
          "system", False)],
        "Reading package versions and configuration directly removes the "
        "guesswork that banner inference requires -- and banner inference is "
        "where most false positives come from, since backported fixes leave "
        "version strings unchanged. Unauthenticated scanning has its own value "
        "in showing the outside view, but not accuracy."),
    mcq("AVERAGE",
        "A CVSS 9.8 vulnerability affects an internal system reachable only "
        "through two authentication layers. A CVSS 6.5 vulnerability affects a "
        "public endpoint and has working exploit code circulating.\n\nWhich "
        "should be remediated first, and why?",
        [("The 6.5, because exposure and exploit availability determine "
          "likelihood, which the base score does not capture.", True),
         ("The 9.8, because CVSS scores are designed precisely to establish "
          "remediation order.", False),
         ("Both simultaneously, since scores above 6.0 are always treated as "
          "equally urgent.", False),
         ("The 9.8, because internal systems hold more sensitive data by "
          "definition.", False)],
        "A CVSS base score describes severity in the abstract -- how bad it "
        "would be if reached -- and deliberately knows nothing about your "
        "exposure, your compensating controls, or whether an exploit exists. A "
        "publicly reachable flaw with circulating exploit code has near-certain "
        "likelihood, which dominates the calculation. Patching strictly in "
        "score order is a well-documented way to stay busy and still get "
        "breached."),
    mcq("AVERAGE",
        "What can a penetration test find that an automated vulnerability scan "
        "cannot?",
        [("Business logic and authorisation flaws, and chains of individually "
          "minor findings that combine into a serious compromise", True),
         ("Missing patches on internet-facing systems", False),
         ("Outdated software versions across a large estate", False),
         ("Open ports and exposed services", False)],
        "Scanners are excellent at the last three -- enumerating known flaws "
        "in known products at scale is exactly what they do, and far faster "
        "than a human. What they cannot recognise is a well-formed, "
        "authenticated request to a documented endpoint that returns another "
        "user's data, or the way three low-severity findings chain into domain "
        "administrator."),
    mcq("AVERAGE",
        "Why is verification a required step in the vulnerability management "
        "cycle?",
        [("A patch that failed to apply is indistinguishable from one never "
          "scheduled unless the system is rescanned.", True),
         ("Regulators require a second scan before a finding may be "
          "closed.", False),
         ("Rescanning resets the CVSS score to zero once remediated.", False),
         ("Verification is what generates the CVE identifier for the fixed "
          "issue.", False)],
        "Patches fail silently for many reasons -- a service not restarted, a "
        "rollback, a package pinned by a dependency, a configuration "
        "management run that overwrote it -- and the ticket reads 'done' "
        "either way. Only a rescan distinguishes a fix from an intention. CVSS "
        "scores are properties of the vulnerability rather than your instance, "
        "and CVEs are assigned at disclosure."),
    mcq("AVERAGE",
        "Why are false negatives in vulnerability scanning more dangerous than "
        "false positives?",
        [("Nothing signals their existence, so there is no prompt to "
          "investigate a vulnerability the scanner missed.", True),
         ("They cause the scanner to crash before completing the "
          "scan.", False),
         ("They are reported to the vendor automatically, creating "
          "disclosure risk.", False),
         ("They inflate the finding count, making prioritisation "
          "harder.", False)],
        "A false positive produces an entry somebody investigates and closes; "
        "the cost is wasted effort and eroded trust in the tool. A false "
        "negative produces nothing at all -- no entry, no alert, no reason to "
        "look -- so the organisation believes it is covered where it is not. "
        "Inflated counts describe false positives, not negatives."),
    mcq("HARD",
        "An organisation cannot patch a critical system because its vendor "
        "certifies only an older version.\n\nWhich risk response applies, and "
        "what must accompany it?",
        [("Mitigation, accompanied by documented compensating controls such as "
          "network restriction, and an explicit accepted-risk record with an "
          "owner and review date.", True),
         ("Transfer, accompanied by an insurance policy covering the "
          "system.", False),
         ("Remediation, accompanied by an exception from the vendor's support "
          "terms.", False),
         ("Acceptance alone, since nothing further can be done.", False)],
        "The flaw remains, so this is not remediation. What is available is "
        "reducing likelihood and impact by other means -- segmentation, "
        "restricted access, additional monitoring -- which is mitigation. "
        "Whatever residual risk remains must then be accepted explicitly, with "
        "a named owner and a review date, so it is a managed decision rather "
        "than a silent one. Insurance transfers cost but neither the incident "
        "nor the exposure."),
    mcq("HARD",
        "Why is an organisation that worries about zero-day attacks while "
        "running unpatched software solving the wrong problem?",
        [("The overwhelming majority of real compromises exploit "
          "vulnerabilities patched months or years earlier, so patching "
          "discipline removes far more risk.", True),
         ("Zero-day vulnerabilities cannot affect systems that are already "
          "unpatched.", False),
         ("Zero-days are always detected by antivirus software before "
          "exploitation.", False),
         ("Unpatched software is not exploitable until a CVE is "
          "assigned.", False)],
        "Attackers use what works, and known-and-patched flaws work constantly "
        "because so many systems remain unpatched -- the attacker's advantage "
        "is the defender's backlog rather than any cleverness. Defending "
        "against a novel attack while leaving old ones open inverts the actual "
        "risk. Unpatched systems remain vulnerable to zero-days as well, "
        "antivirus does not reliably detect novel exploits, and exploitability "
        "has nothing to do with whether an identifier has been issued."),
    short_answer("EASY",
        "Which registry categorises TYPES of software weakness, such as "
        "'improper input validation'? Give the acronym.",
        "CWE",
        ["cwe", "common weakness enumeration"]),
    short_answer("AVERAGE",
        "What term describes a penetration test in which the tester is given "
        "no prior knowledge of the target?",
        "Black box",
        ["black box", "black-box", "black box testing", "blackbox"]),
    descriptive("HARD",
        "A quarterly scan returns 1,400 findings, of which 180 are rated "
        "critical by CVSS. Explain how you would prioritise remediation and "
        "why sorting by CVSS score alone would be a poor strategy.",
        "Sorting by CVSS score alone is poor because the base score measures "
        "technical severity in the abstract -- how damaging the flaw would be "
        "if an attacker could reach and exploit it -- and deliberately "
        "excludes everything about your particular environment, so that the "
        "score means the same thing to every organisation reading it. It does "
        "not know whether the affected system is internet-facing or buried "
        "behind two authentication layers, whether the vulnerable feature is "
        "even enabled in your configuration, whether a compensating control "
        "such as a web application firewall sits in front of it, or whether "
        "working exploit code is circulating publicly. A team working strictly "
        "down the score list will therefore spend its first weeks on internal "
        "systems no attacker can reach while a lower-scored but publicly "
        "exposed flaw with a published exploit stays open, and will then be "
        "breached through exactly the thing it deferred. A better ordering "
        "starts with exposure and exploitability. First, filter to systems "
        "reachable from the internet, which typically collapses 1,400 findings "
        "to a few dozen. Within those, prioritise findings for which exploit "
        "code is publicly available or active exploitation has been reported, "
        "because likelihood there is close to certain -- these warrant an "
        "emergency change bypassing the normal queue rather than the next "
        "patch window. Next come the remaining internet-facing findings, then "
        "internal findings with available exploits, which should also receive "
        "an interim mitigation such as tightened network access while the "
        "patch is scheduled. Business impact then breaks remaining ties: a "
        "medium-severity flaw on the payment system outranks a high-severity "
        "one on a test instance. Everything left is batched into routine "
        "patching and tracked as a trend. The same 1,400 findings, reordered "
        "this way, produce a first week of work that removes most of the "
        "genuine exposure.",
        [("Explains that CVSS excludes exposure, controls and exploit "
          "availability", 4),
         ("Proposes a prioritisation using reachability and exploitability", 3),
         ("Includes business impact or interim mitigation in the "
          "reasoning", 3)]),
]

LESSON_VULN = {
    "middle": MID_RISK,
    "name": "Vulnerability Management and Penetration Testing",
    "quiz": _vuln_quiz,
    "structure": lesson_structure(
        "Vulnerability Management and Penetration Testing",
        "Threat modelling asks what could go wrong with a design; this lesson "
        "is about what is actually wrong with the systems you are running "
        "today. You will learn the vulnerability management cycle and why it "
        "fails at the asset inventory more often than anywhere else, the "
        "difference between CVE, CVSS and CWE, why a CVSS score is emphatically "
        "not a priority order and what happens to programmes that treat it as "
        "one, how scanning approaches differ in accuracy and why false "
        "negatives are the dangerous kind, what a penetration test finds that "
        "no scanner can, the four risk responses and why acceptance must be "
        "explicit, and why zero-days deserve far less of your attention than "
        "patching discipline does.",
        [
            "Describe the six stages of the vulnerability management cycle and "
            "explain the dependence on accurate asset inventory",
            "Distinguish CVE, CVSS and CWE and say what each is for",
            "Explain why CVSS base score is not a remediation order and what "
            "should be used instead",
            "Compare authenticated, unauthenticated and agent-based scanning",
            "Explain why false negatives are more dangerous than false "
            "positives",
            "Distinguish scanning from penetration testing and state what only "
            "a human tester finds",
            "Compare black, grey and white box testing and red team exercises",
            "List what rules of engagement must cover and why written "
            "authorisation is essential",
            "Explain the four risk responses and why acceptance must be "
            "explicit and owned",
        ],
        60,
        _vuln_sections,
        [
            ("CVE",
             "Common Vulnerabilities and Exposures: a unique identifier for a "
             "specific flaw in a specific product, carrying no severity "
             "judgement."),
            ("CVSS",
             "Common Vulnerability Scoring System: a 0-10 technical severity "
             "score that deliberately excludes your environment's exposure and "
             "controls."),
            ("CWE",
             "Common Weakness Enumeration: a category of flaw rather than an "
             "instance, useful for identifying systemic causes."),
            ("Authenticated scanning",
             "Scanning that logs in to inspect versions and configuration "
             "directly, producing far fewer false positives."),
            ("False negative",
             "A vulnerability the scanner failed to report. More dangerous "
             "than a false positive because nothing signals its existence."),
            ("Penetration test",
             "A human attempting compromise under written authorisation, whose "
             "distinctive output is a demonstrated chain of findings."),
            ("Black / grey / white box",
             "Testing with no, partial, or full prior knowledge of the "
             "target."),
            ("Red team exercise",
             "An engagement the defenders are unaware of, testing detection "
             "and response rather than only the technical estate."),
            ("Rules of engagement",
             "The written scope, permitted techniques, timing, contacts, "
             "escalation and data handling that make a test lawful and safe."),
            ("Remediate / mitigate / transfer / accept",
             "The four risk responses: fix the flaw, reduce likelihood or "
             "impact, shift the cost, or explicitly tolerate it with an owner "
             "and review date."),
            ("Zero-day",
             "A vulnerability exploited before a patch exists. Prominent in "
             "discussion, rare as a proportion of real incidents."),
        ],
        "Vulnerability management is a continuous six-stage cycle -- discover, "
        "assess, prioritise, remediate, verify, report -- and it fails at the "
        "inventory before it fails anywhere else, because an asset nobody "
        "knows about is unmeasured rather than low risk and attackers scan "
        "address ranges rather than asset lists. CVE names a flaw, CVSS scores "
        "its severity in the abstract, and CWE categorises the kind of "
        "weakness; only the first is an identifier and none of them is a "
        "priority. Priority comes from exposure and exploit availability, "
        "which is why a public 6.5 with circulating exploit code outranks an "
        "internal 9.8 -- and why programmes that patch in score order stay "
        "busy without reducing risk. Scanners find known flaws in known "
        "products and cannot recognise broken authorisation or logic errors, "
        "which is where a penetration test earns its cost, particularly in the "
        "chains it demonstrates and always under written authorisation. "
        "Finally, all four risk responses remain valid choices, but acceptance "
        "only counts when somebody actually made the decision and put their "
        "name to it."),
}

LESSONS = [LESSON_THREAT, LESSON_VULN]
