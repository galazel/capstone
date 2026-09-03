"""Understanding of Network -> MID 120 and MID 121.

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, at least one diagram, most sections carrying
more than one block, and no coloured card grids.

Written against TOPCIT ESSENCE Network (Technical Field 03, Ver.2), sections
"04 Internet Standards", "08 IEEE 802 Standard" and "01 Outline of Network
Layer and Device".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_FUNDAMENTALS = 120
MID_PROTOCOLS = 121

IEEE802_DIAGRAM = "/lesson-media/ieee-802-family.svg"
CSMA_DIAGRAM = "/lesson-media/csma-cd.svg"
DEVICES_DIAGRAM = "/lesson-media/devices-by-layer.svg"
VLAN_DIAGRAM = "/lesson-media/vlan-segmentation.svg"
# ===========================================================================
# Internet Standards and the IEEE 802 Family
# ===========================================================================

_std_sections = [
    ("Why Standards Decide What Gets Built", [
        desc(
            "A network is the one kind of system that is worthless unless "
            "somebody else's equipment agrees with yours. A word processor "
            "that works only with itself is still useful; a network protocol "
            "that works only with itself is not a protocol at all. That makes "
            "standardisation not a bureaucratic afterthought but the "
            "precondition for the industry existing."
        ),
        desc(
            "Every protocol named anywhere in this module is a document "
            "produced by one of a small number of bodies. Knowing which body "
            "owns which layer lets you find the authoritative answer instead "
            "of guessing, and it is asked directly in exams often enough to be "
            "worth learning as a set rather than picking up incidentally."
        ),
    ]),

    ("A Standard Is Only as Strong as Its Implementations", [
        desc(
            "Standards have politics and timing as well as content. The OSI "
            "protocol suite was the formally correct international standard, "
            "developed by ISO with government backing across several "
            "countries, and it lost decisively to TCP/IP -- which was rough, "
            "freely available, and already running on a network people were "
            "using."
        ),
        desc(
            "The lesson generalises well beyond networking: a specification "
            "with no shipping code is a proposal, however official its "
            "provenance. The IETF's own motto captures it -- rough consensus "
            "and running code -- and it explains why that body's output "
            "dominates the internet while ISO's does not."
        ),
    ]),

    ("The Main Standards Bodies", [
        desc(
            "Four organisations produce nearly everything you will meet in "
            "this module, and they divide the protocol stack fairly cleanly "
            "between them."
        ),
        sub("IETF - Internet Engineering Task Force"),
        desc(
            "Produces the RFC series covering IP, TCP, UDP, HTTP, DNS and the "
            "rest of the internet protocol suite -- broadly the network layer "
            "and above. Membership is open to anyone: there is no formal "
            "voting and no organisational representation, and decisions are "
            "made by rough consensus among people who turn up and do the work."
        ),
        sub("IEEE - Institute of Electrical and Electronics Engineers"),
        desc(
            "Its 802 committee owns local and metropolitan area networking, "
            "which in OSI terms means Layers 1 and 2. Ethernet and Wi-Fi are "
            "IEEE standards, not IETF ones, and confusing the two is a "
            "reliable exam trap."
        ),
        sub("ISO and IEC"),
        desc(
            "The International Organization for Standardization and the "
            "International Electrotechnical Commission. ISO produced the OSI "
            "reference model, and the two jointly publish the ISO/IEC 27000 "
            "security series encountered in the Security module."
        ),
        sub("ITU-T"),
        desc(
            "The telecommunication standardisation sector of the "
            "International Telecommunication Union, a United Nations agency "
            "with governmental membership. Publishes Recommendations covering "
            "telecommunications interconnection, including H.323 for "
            "multimedia over packet networks."
        ),
    ]),

    ("Two More Bodies Worth Recognising", [
        desc(
            "The W3C standardises web technologies -- HTML, CSS, the DOM -- "
            "while the protocol that carries them, HTTP, belongs to the IETF. "
            "A question about who standardises HTML and who standardises HTTP "
            "is testing exactly this boundary."
        ),
        desc(
            "IANA, operating under ICANN, writes no standards at all but "
            "administers the numbers the standards depend on: IP address "
            "blocks delegated to regional registries, port numbers, protocol "
            "numbers, and the root of the domain name system. Without a "
            "registry, two protocols would eventually claim the same port "
            "number and neither would work reliably."
        ),
    ]),

    ("The RFC Process", [
        desc(
            "An IETF standard is published as a Request for Comments, a name "
            "surviving from a time when the documents genuinely were requests "
            "for comment on an experimental network. RFCs are numbered "
            "sequentially, never edited after publication, and never "
            "withdrawn."
        ),
        desc(
            "That immutability is deliberate and has a practical consequence "
            "that catches people out. A specification is changed by publishing "
            "a NEW RFC that obsoletes the old one, which is why RFC 791 still "
            "describes IPv4 exactly as it did in 1981, and why citing an RFC "
            "number without checking whether it has been obsoleted is a "
            "classic error. Every RFC carries a header stating what it "
            "obsoletes and what obsoletes it."
        ),
    ]),

    ("From Draft to Standard", [
        ol([
            "An idea is written up as an Internet-Draft, which expires "
            "automatically after six months unless refreshed -- so abandoned "
            "proposals disappear rather than accumulating",
            "A working group discusses and revises it in the open, on public "
            "mailing lists anybody may read",
            "The draft is submitted for publication and reviewed by the "
            "Internet Engineering Steering Group",
            "It is published as an RFC with a status: Standards Track, "
            "Informational, Experimental, Best Current Practice or Historic",
            "A Standards Track document may progress from Proposed Standard to "
            "Internet Standard as implementations and operational experience "
            "accumulate",
        ]),
    ]),

    ("Not Every RFC Is a Standard", [
        desc(
            "This trips people up consistently. Informational and Experimental "
            "RFCs carry no requirement whatever, and the series famously "
            "contains April Fools' jokes with genuine RFC numbers -- RFC 1149 "
            "specifies IP over avian carriers, complete with a discussion of "
            "pigeon collision avoidance."
        ),
        desc(
            "When an exam question refers to 'the standard', it means a "
            "Standards Track document. When somebody in a technical argument "
            "cites an RFC number as though it settles the matter, the first "
            "question to ask is which status that RFC actually carries."
        ),
    ]),

    ("The IEEE 802 Family", [
        desc(
            "The IEEE 802 committee covers local and metropolitan area "
            "networks, which in OSI terms means the physical layer and the "
            "data link layer. Its most important structural decision was to "
            "split the data link layer into two sub-layers rather than "
            "treating it as one."
        ),
        desc(
            "Logical Link Control is standardised once, as 802.2, and is "
            "common to every medium. Media Access Control is standardised "
            "separately for each medium -- 802.3 for Ethernet, 802.11 for "
            "wireless. That split is what allows the layers above to be "
            "completely indifferent to whether they are running over cable or "
            "radio, and it is the structural reason a single IP stack works "
            "everywhere."
        ),
        image(IEEE802_DIAGRAM),
    ]),

    ("The Principal 802 Standards", [
        accordion([
            ("802.2 - Logical Link Control",
             "The upper data link sub-layer, common to all the media-specific "
             "standards below it. Provides the interface to the network layer "
             "through service access points -- DSAP for destination and SSAP "
             "for source -- and offers three service types: Type 1 "
             "unacknowledged connectionless, Type 2 connection-oriented using "
             "a virtual circuit, and Type 3 acknowledged connectionless."),
            ("802.3 - Ethernet",
             "The dominant wired LAN standard. Its media access method is "
             "CSMA/CD, Carrier Sense Multiple Access with Collision Detection, "
             "although on a modern full-duplex switched network collisions "
             "cannot occur and CSMA/CD is effectively dormant. The standard "
             "spans 10BASE-T through 10, 40 and 100 Gigabit Ethernet."),
            ("802.11 - Wireless LAN",
             "Wi-Fi. Uses CSMA/CA -- Collision Avoidance rather than Detection "
             "-- because a radio transceiver cannot listen while transmitting. "
             "The lettered amendments a, b, g, n, ac and ax mark successive "
             "increases in rate and technique: OFDM, MIMO, beamforming and "
             "higher-order QAM."),
            ("802.15 - Wireless PAN",
             "Personal area networks over short distances. 802.15.1 formed the "
             "basis of Bluetooth; 802.15.4 underlies ZigBee and much of the "
             "low-power sensor networking used in the Internet of Things. "
             "These are the standards behind the M2M and IoT lessons later in "
             "this major category."),
            ("802.1Q - VLAN tagging",
             "Defines the four-byte tag inserted into an Ethernet frame to "
             "mark which virtual LAN it belongs to, of which 12 bits carry the "
             "VLAN identifier. This is what allows one physical switch "
             "infrastructure to carry several isolated broadcast domains."),
            ("802.1D - Spanning Tree",
             "Detects loops in a switched topology and blocks redundant links "
             "until they are needed. Without it, redundant cabling between "
             "switches causes a broadcast storm within seconds."),
        ]),
    ]),

    ("The Media Access Problem", [
        desc(
            "When several stations share one transmission medium, two that "
            "transmit simultaneously will corrupt each other's signals. Some "
            "rule must decide who may transmit and when, and this is the media "
            "access control problem that the MAC sub-layer exists to solve."
        ),
        desc(
            "Wired and wireless networks solve it differently, and the reason "
            "for the difference is physical rather than a matter of taste. "
            "Understanding why is worth more than memorising the two acronyms, "
            "because exam questions probe the reason directly."
        ),
    ]),

    ("CSMA/CD on Wired Networks", [
        desc(
            "A station listens before transmitting -- that is the carrier "
            "sense. If the medium is idle it begins sending, and crucially it "
            "keeps listening while it sends. Because a station on a wire can "
            "transmit and receive simultaneously, it can hear another station's "
            "signal arriving during its own transmission."
        ),
        ol([
            "Listen to the medium; if busy, wait until it is idle",
            "Begin transmitting, and continue listening while transmitting",
            "If another signal is detected, stop immediately -- there is no "
            "point completing a frame that is already corrupted",
            "Transmit a jam signal so that every station on the segment learns "
            "a collision occurred",
            "Wait a random backoff interval, whose range doubles with each "
            "successive collision, then retry",
        ]),
        image(CSMA_DIAGRAM),
    ]),

    ("Why the Backoff Doubles", [
        desc(
            "The doubling is not arbitrary. If two stations collide and both "
            "wait a random interval from the same small range, the chance they "
            "collide again is high. Doubling the range after each collision "
            "spreads the retries further apart precisely when contention is "
            "demonstrably heavy, which makes the network settle rather than "
            "collapse under load."
        ),
        desc(
            "This is called binary exponential backoff, and the same idea "
            "appears throughout computing -- in TCP's congestion response, in "
            "retry logic for failing services, and in wireless access. "
            "Recognising the pattern is more useful than memorising it in one "
            "context."
        ),
    ]),

    ("CSMA/CA on Wireless Networks", [
        desc(
            "A radio cannot hear a faint remote signal while its own "
            "transmitter is on -- the local transmission overwhelms the "
            "receiver completely. Collisions therefore cannot be DETECTED as "
            "they happen, which makes CSMA/CD impossible on radio regardless "
            "of how one might wish otherwise."
        ),
        desc(
            "802.11 therefore avoids collisions rather than detecting them. A "
            "station waits for the medium to be idle, then waits a further "
            "random backoff period before transmitting, which reduces the "
            "chance that two stations that were both waiting begin at the same "
            "instant. Because the sender cannot tell whether the frame arrived, "
            "the receiver sends an explicit acknowledgement, and its absence is "
            "how a sender infers failure."
        ),
    ]),

    ("The Hidden Node Problem", [
        desc(
            "Carrier sensing assumes every station can hear every other, and "
            "on radio that assumption fails. Two stations may both be within "
            "range of an access point but out of range of each other. Neither "
            "hears the other's carrier, both conclude the medium is free, and "
            "both transmit -- colliding at the access point which can hear "
            "both."
        ),
        desc(
            "RTS/CTS addresses it. A station sends a short Request To Send to "
            "the access point, which replies with a Clear To Send that BOTH "
            "stations receive, because both are in range of the access point "
            "even though they cannot hear each other. The second station now "
            "knows to stay silent. The exchange costs airtime, so it is "
            "usually enabled only for frames above a size threshold where the "
            "cost of a collision exceeds the cost of the handshake."
        ),
    ]),

    ("CSMA/CD on Modern Networks", [
        desc(
            "A point worth being precise about: on a modern full-duplex "
            "switched Ethernet network, CSMA/CD never engages at all. Each "
            "switch port forms its own collision domain, and a full-duplex "
            "link allows both ends to transmit simultaneously on separate "
            "pairs, so there is nothing to collide with."
        ),
        desc(
            "It remains in the 802.3 standard for compatibility with "
            "half-duplex operation, which still occurs when a device "
            "negotiates down or when a hub is involved. An exam question "
            "asking about CSMA/CD's status on a switched network is testing "
            "whether you know it is dormant rather than active."
        ),
    ]),

    ("Standards, Compliance and Certification", [
        desc(
            "A standard describes what an implementation must do; it does not "
            "test whether a product actually does it. That job falls to "
            "industry alliances, and the distinction is one people get wrong "
            "constantly."
        ),
        desc(
            "The IEEE writes 802.11 and certifies nothing. The Wi-Fi Alliance "
            "runs an interoperability certification programme and owns the "
            "Wi-Fi trademark, which is why a device can implement 802.11 "
            "faithfully and still not be permitted to call itself Wi-Fi. "
            "Similarly, the Bluetooth Special Interest Group maintains and "
            "certifies Bluetooth, which grew out of IEEE 802.15.1."
        ),
    ]),

    ("Matching Body to Product", [
        desc(
            "It is worth rehearsing these until they are automatic, because "
            "they are quick marks in an exam and easy to lose."
        ),
        ul([
            "Ethernet: IEEE 802.3 -- a LAN standard, so IEEE rather than IETF",
            "Wi-Fi: IEEE 802.11 for the standard, Wi-Fi Alliance for the "
            "certification and the name",
            "HTTP: IETF, published as RFCs -- the W3C standardises HTML and "
            "CSS but not the transfer protocol",
            "The OSI model: ISO, in cooperation with ITU-T",
            "TCP, IP, UDP, DNS: IETF",
            "Port number and address block registries: IANA, under ICANN",
        ]),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Treating every RFC as a standard",
             "Only Standards Track RFCs carry that weight. Informational, "
             "Experimental and Historic documents do not, and the series "
             "includes deliberate jokes with real numbers."),
            ("Citing an RFC without checking whether it is current",
             "RFCs are never edited, only obsoleted by later ones. The header "
             "of every RFC states what obsoletes it, and skipping that check "
             "is how people quote requirements that were superseded a decade "
             "ago."),
            ("Attributing Ethernet or Wi-Fi to the IETF",
             "Both are IEEE 802 standards. The IETF owns the internet layer "
             "and above; the IEEE owns the LAN layers below it."),
            ("Assuming CSMA/CD still governs modern Ethernet",
             "On a full-duplex switched link there is no shared medium and no "
             "collision domain, so it never engages. It matters historically "
             "and on legacy half-duplex segments."),
            ("Confusing the standard with the certification mark",
             "802.11 is the standard; Wi-Fi is the Wi-Fi Alliance's "
             "certification programme and trademark. Related, but not the same "
             "thing."),
            ("Thinking carrier sensing prevents all wireless collisions",
             "The hidden node problem defeats it entirely: two stations out of "
             "range of each other both sense an idle medium and transmit "
             "together. RTS/CTS exists specifically for this."),
        ]),
    ]),

    ("Practical Example: Choosing Between Two Wireless Standards", [
        desc(
            "A team is designing a building-wide sensor network: several "
            "hundred battery-powered temperature sensors, each reporting a few "
            "bytes every minute, expected to run for years without a battery "
            "change. The instinct to reach for Wi-Fi is understandable and "
            "wrong."
        ),
        desc(
            "IEEE 802.11 is engineered for high throughput and assumes mains "
            "power or frequent charging. Its radio duty cycle, association "
            "overhead and beacon handling would drain a coin cell in days. The "
            "traffic profile it optimises for -- large transfers to "
            "continuously powered devices -- is the opposite of what this "
            "deployment produces."
        ),
    ]),

    ("The Standard That Actually Fits", [
        desc(
            "IEEE 802.15.4, with a stack such as ZigBee above it, is designed "
            "for exactly this shape of traffic: low data rate, small frames, "
            "very long sleep periods between transmissions, and mesh routing "
            "so that distant sensors relay through nearer ones rather than "
            "needing to reach a distant access point directly."
        ),
        desc(
            "The general lesson is to match the standard to the traffic "
            "profile and the power budget rather than to whichever radio "
            "technology the team already knows. The same reasoning appears "
            "throughout the IoT lessons in this category."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Body-to-layer matching: which organisation owns which part of the "
            "stack",
            "802 numbering: which standard covers Ethernet, wireless LAN, "
            "wireless PAN, VLAN tagging and spanning tree",
            "CSMA/CD versus CSMA/CA, and specifically the physical reason they "
            "differ",
            "The hidden node problem and the mechanism that addresses it",
            "RFC status categories, and the fact that RFCs are obsoleted "
            "rather than revised",
            "The distinction between writing a standard and certifying "
            "compliance with it",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Match body to layer: IEEE 802 for Layers 1-2, IETF for the "
            "internet suite, ISO for the OSI model, ITU-T for telecoms",
            "Memorise 802.2 LLC, 802.3 Ethernet, 802.11 wireless LAN, 802.15 "
            "wireless PAN, 802.1Q VLAN, 802.1D spanning tree",
            "Wired detects collisions because a station can listen while "
            "transmitting; radio cannot, so it avoids them instead",
            "RFCs are never edited, only obsoleted -- and not all of them are "
            "standards",
            "IANA administers numbers, ICANN oversees IANA, and neither writes "
            "protocols",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Standards make multi-vendor networking possible, and each body "
            "owns a recognisable part of the stack",
            "A standard's authority comes from adoption rather than "
            "ratification -- running code beat the formal international "
            "standard",
            "IETF standards are RFCs, published immutably and superseded "
            "rather than revised, and not all of them are standards",
            "IEEE 802 splits the data link layer into a common LLC sub-layer "
            "and media-specific MAC standards, which is why one IP stack runs "
            "over every medium",
            "CSMA/CD suits wires because a station can listen while sending; "
            "CSMA/CA suits radio because it cannot, and the hidden node problem "
            "defeats sensing entirely",
            "Writing a standard and certifying compliance with it are separate "
            "activities done by separate organisations",
        ]),
    ]),
]

_std_quiz = [
    mcq("EASY",
        "Which organisation publishes the IEEE 802.11 wireless LAN standard?",
        [("IEEE", True), ("IETF", False), ("ISO", False), ("ITU-T", False)],
        "The 802 committee of the IEEE owns local and metropolitan area "
        "network standards, covering both Ethernet (802.3) and wireless LAN "
        "(802.11). The IETF publishes the internet protocol suite as RFCs, ISO "
        "produced the OSI reference model, and ITU-T publishes telecoms "
        "Recommendations."),
    mcq("EASY",
        "Which IEEE 802 standard defines the Logical Link Control sub-layer "
        "shared by the media-specific MAC standards?",
        [("802.2", True), ("802.3", False), ("802.11", False), ("802.1Q", False)],
        "802.2 defines LLC, the upper data link sub-layer that presents a "
        "single interface to the network layer regardless of the medium "
        "underneath. 802.3 is Ethernet and 802.11 is wireless LAN -- both MAC "
        "sub-layer standards -- and 802.1Q defines VLAN tagging."),
    mcq("AVERAGE",
        "Why does IEEE 802.11 use collision avoidance rather than the "
        "collision detection used by IEEE 802.3?",
        [("A radio transceiver cannot reliably receive a remote signal while "
          "it is transmitting, so collisions cannot be detected as they "
          "happen.", True),
         ("Wireless frames are too short for a collision to be detected within "
          "the transmission time.", False),
         ("Collision detection requires a shared electrical ground, which "
          "wireless networks lack.", False),
         ("Avoidance produces higher throughput than detection on any medium, "
          "so wireless adopted it first.", False)],
        "A transmitting radio swamps its own receiver, so a station cannot "
        "hear a colliding transmission the way a station on a wire can. Since "
        "collisions cannot be detected they must be avoided, which is why "
        "802.11 adds random backoff before transmitting and requires explicit "
        "acknowledgements afterwards. Frame length is not the issue, there is "
        "no ground requirement, and avoidance is not universally faster -- it "
        "carries its own overhead."),
    mcq("AVERAGE",
        "An engineer cites RFC 793 as the current authority for TCP. What is "
        "the flaw in this reasoning?",
        [("An RFC is never revised, so a cited number may have been obsoleted "
          "by a later RFC that must be checked for.", True),
         ("RFCs are drafts and never carry standards authority, so no RFC "
          "should be cited as an authority.", False),
         ("RFC 793 is Informational rather than Standards Track.", False),
         ("TCP is an IEEE standard, so no RFC describes it.", False)],
        "RFCs are immutable once published; a specification is updated by "
        "publishing a new RFC that obsoletes the old one, so the right "
        "question is always whether the number cited is still current. Every "
        "RFC's header states what obsoletes it. Standards Track RFCs certainly "
        "carry authority, RFC 793 was Standards Track, and TCP is an IETF "
        "protocol."),
    mcq("AVERAGE",
        "Two wireless stations are both within range of an access point but "
        "not of each other. Both sense an idle medium and transmit "
        "simultaneously, corrupting each other's frames.\n\nWhat is this "
        "called, and which mechanism addresses it?",
        [("The hidden node problem, addressed by RTS/CTS handshaking", True),
         ("The exposed node problem, addressed by increasing transmit power", False),
         ("A broadcast storm, addressed by spanning tree", False),
         ("A collision domain overlap, addressed by full-duplex operation", False)],
        "Neither station can sense the other's carrier, so carrier sensing "
        "fails to prevent the collision. RTS/CTS solves it: the access point "
        "broadcasts a Clear To Send that both stations receive, since both are "
        "in range of it, silencing the one that was not transmitting. The "
        "exposed node problem is the converse case of unnecessary deferral, a "
        "broadcast storm is a Layer 2 loop problem, and full duplex is not "
        "available on a shared radio channel."),
    mcq("AVERAGE",
        "Why does the random backoff interval double after each successive "
        "collision in CSMA/CD?",
        [("Repeated collisions indicate heavy contention, so spreading retries "
          "further apart lets the network settle rather than collapse.", True),
         ("Doubling guarantees that no two stations can ever choose the same "
          "interval.", False),
         ("The standard requires the interval to match the doubling of frame "
          "size under load.", False),
         ("It compensates for the propagation delay increasing as more "
          "stations join.", False)],
        "If two stations collide and both retry from the same narrow range, "
        "they are likely to collide again. Widening the range after each "
        "collision responds to demonstrated contention, which is why it is "
        "called binary exponential backoff and why the same pattern appears in "
        "TCP congestion control. It guarantees nothing about uniqueness, and "
        "neither frame size nor propagation delay is involved."),
    mcq("HARD",
        "Which statement correctly distinguishes the roles of the IEEE and the "
        "Wi-Fi Alliance?",
        [("The IEEE writes the 802.11 standard; the Wi-Fi Alliance certifies "
          "interoperability and owns the Wi-Fi trademark.", True),
         ("The Wi-Fi Alliance writes the 802.11 standard; the IEEE certifies "
          "products against it.", False),
         ("Both write competing wireless standards, and vendors choose which "
          "to implement.", False),
         ("The IEEE certifies products while the Wi-Fi Alliance administers "
          "channel assignments.", False)],
        "A standards body specifies behaviour; it does not test products. The "
        "IEEE publishes 802.11 and the Wi-Fi Alliance runs the certification "
        "programme and licenses the mark, which is why a device can implement "
        "802.11 without being allowed to call itself Wi-Fi. Channel assignment "
        "is a matter for national regulators, not either body."),
    mcq("HARD",
        "On a modern full-duplex switched Ethernet network, what is the status "
        "of CSMA/CD?",
        [("It is effectively dormant, because a full-duplex switched link has "
          "no shared medium and therefore no collision domain.", True),
         ("It runs continuously and is the main reason switched networks scale "
          "well.", False),
         ("It has been replaced within 802.3 by CSMA/CA.", False),
         ("It is used only for frames larger than the MTU.", False)],
        "Each switch port forms its own collision domain, and a full-duplex "
        "link lets both ends transmit simultaneously on separate pairs, so "
        "there is nothing to collide with and the algorithm never engages. It "
        "remains in the standard for half-duplex compatibility. 802.3 did not "
        "adopt CSMA/CA -- that is the wireless answer -- and frame size is "
        "irrelevant."),
    short_answer("EASY",
        "Which IEEE 802 standard defines VLAN tagging in Ethernet frames?",
        "802.1Q",
        ["802.1q", "ieee 802.1q", "8021q"]),
    short_answer("AVERAGE",
        "Which organisation administers the global registries of IP address "
        "blocks, port numbers and protocol numbers? Give the acronym.",
        "IANA",
        ["iana", "internet assigned numbers authority"]),
    descriptive("HARD",
        "A colleague argues that because the OSI protocol suite was the "
        "official international standard, it should have displaced TCP/IP. "
        "Explain why it did not, and state what the episode teaches about how "
        "standards succeed.",
        "The OSI suite was formally correct but late. TCP/IP was already "
        "implemented, freely available, bundled with widely deployed operating "
        "systems such as BSD Unix, and proven at scale on the ARPANET while "
        "the OSI protocols were still being specified and had few complete "
        "implementations. Organisations adopting a network needed something "
        "that worked in the present rather than something that would be "
        "correct in the future. OSI was also more complex -- seven layers "
        "including a full session and presentation layer that implementations "
        "found little practical use for -- and its committee-driven process, "
        "with formal national representation, moved slowly relative to the "
        "pace at which the internet was growing. Each additional layer "
        "boundary also cost header overhead and processing without delivering "
        "proportionate benefit. The lesson is that a standard's authority "
        "comes from adoption rather than from ratification: running code, free "
        "availability, and an installed base decide the outcome, which is "
        "precisely why the IETF's working maxim is rough consensus and running "
        "code. A specification without implementations is a proposal, however "
        "official its provenance, and the OSI model survives today as shared "
        "vocabulary rather than as a protocol suite anybody runs.",
        [("Identifies that TCP/IP was implemented, available and deployed "
          "first", 4),
         ("Notes OSI's complexity or slow committee process as contributing "
          "factors", 3),
         ("Draws the general conclusion that adoption rather than ratification "
          "confers authority", 3)]),
]

LESSON_STANDARDS = {
    "middle": MID_FUNDAMENTALS,
    "name": "Internet Standards and the IEEE 802 Family",
    "quiz": _std_quiz,
    "structure": lesson_structure(
        "Internet Standards and the IEEE 802 Family",
        "Every protocol in this module is a document somebody published, and "
        "knowing who published it tells you where to find the authoritative "
        "answer and how much weight it carries. This lesson covers the four "
        "bodies whose work you will meet, how the RFC process works and why "
        "not every RFC is a standard, and the IEEE 802 family that governs "
        "Layers 1 and 2. It then works through the media access problem those "
        "standards solve -- CSMA/CD on wires, CSMA/CA on radio -- explaining "
        "the physical reason the two must differ, why the backoff interval "
        "doubles, and why carrier sensing fails completely against a hidden "
        "node.",
        [
            "Name the major standards bodies and the part of the protocol "
            "stack each is responsible for",
            "Describe the RFC publication process and distinguish Standards "
            "Track from Informational and Experimental documents",
            "Explain why RFCs are obsoleted rather than revised, and what that "
            "means when citing one",
            "Identify the principal IEEE 802 standards and what each covers",
            "Explain CSMA/CD step by step, including binary exponential "
            "backoff and why the range doubles",
            "Explain CSMA/CA and the physical reason radio cannot detect "
            "collisions",
            "Describe the hidden node problem and how RTS/CTS addresses it",
            "Explain why CSMA/CD is dormant on a modern switched network",
            "Distinguish writing a standard from certifying compliance with it",
        ],
        55,
        _std_sections,
        [
            ("RFC (Request for Comments)",
             "The IETF's publication series. Immutable once published: a "
             "specification changes by issuing a new RFC that obsoletes the "
             "old one."),
            ("Standards Track",
             "The RFC category carrying standards authority, progressing from "
             "Proposed Standard to Internet Standard. Informational and "
             "Experimental RFCs carry none."),
            ("Internet-Draft",
             "A working document that expires after six months unless "
             "refreshed, so abandoned proposals disappear rather than "
             "accumulating."),
            ("IEEE 802",
             "The IEEE committee responsible for local and metropolitan area "
             "network standards, covering OSI Layers 1 and 2."),
            ("LLC (Logical Link Control)",
             "The upper data link sub-layer, standardised once as 802.2, "
             "presenting one interface to the network layer regardless of "
             "medium."),
            ("MAC (Media Access Control)",
             "The lower data link sub-layer, standardised separately per "
             "medium, governing how stations share access to it."),
            ("CSMA/CD",
             "Carrier Sense Multiple Access with Collision Detection: listen, "
             "transmit, detect collisions while sending, jam, and retry after "
             "random backoff."),
            ("Binary exponential backoff",
             "Doubling the random retry range after each successive collision, "
             "so contention causes retries to spread rather than repeat."),
            ("CSMA/CA",
             "Carrier Sense Multiple Access with Collision Avoidance: "
             "collisions cannot be detected on radio, so they are avoided "
             "using backoff and explicit acknowledgements."),
            ("Hidden node problem",
             "Two stations in range of an access point but not of each other, "
             "so carrier sensing fails to prevent a collision. Mitigated by "
             "RTS/CTS."),
            ("IANA",
             "The Internet Assigned Numbers Authority, administering address "
             "blocks, port numbers and protocol numbers under ICANN."),
        ],
        "Standards are what allow equipment from different vendors to "
        "interoperate, and each body owns a recognisable slice of the stack: "
        "IEEE 802 for the LAN layers, IETF for the internet protocol suite, "
        "ISO for the OSI model, ITU-T for telecoms interconnection, and IANA "
        "for the number registries everything depends on. RFCs are never "
        "edited, only obsoleted, and only Standards Track documents carry "
        "authority -- the series includes deliberate jokes with real numbers. "
        "Within IEEE 802 the data link layer splits into a common LLC "
        "sub-layer and media-specific MAC sub-layers, which is the structural "
        "reason one IP stack runs over every medium ever invented. The two "
        "media access methods differ for a physical reason rather than a "
        "stylistic one: a station on a wire can listen while transmitting and "
        "a radio cannot, so wires detect collisions and radio avoids them -- "
        "and even avoidance fails against a hidden node, which is what RTS/CTS "
        "exists for. Finally, the OSI suite's defeat by TCP/IP is the "
        "industry's clearest demonstration that a standard's authority comes "
        "from adoption rather than from ratification."),
}


# ===========================================================================
# Network Layer Devices: Routers, Switches, and VLANs
# ===========================================================================

_dev_sections = [
    ("What the Network Layer Is For", [
        desc(
            "The data link layer can deliver a frame to any device on the same "
            "physical network, and that is the limit of what it can do. The "
            "moment a destination sits on a different network, something must "
            "decide which of several possible paths to take and hand the data "
            "across the boundary between them."
        ),
        desc(
            "That is the network layer's job. Its two signature functions are "
            "logical addressing -- giving every host an address whose "
            "structure reveals which network it belongs to -- and routing, "
            "choosing a path toward that network. Everything else it does "
            "supports one of those two."
        ),
    ]),

    ("The Five Functions of the Network Layer", [
        ul([
            "Logical addressing: hierarchical addresses identifying a network "
            "and a host within it, which is what makes aggregation possible",
            "Routing: selecting a path across intermediate networks toward the "
            "destination",
            "Forwarding: the per-packet act of moving a packet from an input "
            "interface to the chosen output interface",
            "Fragmentation and reassembly: splitting a packet that exceeds a "
            "link's maximum transmission unit, and putting it back together",
            "Best-effort delivery: IP promises to try, and nothing more -- no "
            "guarantee of arrival, ordering or non-duplication",
        ]),
    ]),

    ("Classifying Devices by Layer", [
        desc(
            "Network devices are classified by the highest layer whose header "
            "they read, and this classification is examined constantly. The "
            "principle is simple: a device that only regenerates a signal is "
            "Layer 1, one that reads MAC addresses is Layer 2, and one that "
            "reads IP addresses is Layer 3."
        ),
        desc(
            "The higher the layer, the more the device understands and the "
            "more work it performs per packet -- which is also why lower-layer "
            "devices are faster and cheaper. The diagram below places the "
            "common devices against the layers they operate at."
        ),
        image(DEVICES_DIAGRAM),
    ]),

    ("Devices in Detail", [
        accordion([
            ("Repeater and hub - Layer 1",
             "A repeater regenerates a weakening signal to extend a segment's "
             "reach; a hub is simply a multi-port repeater. Neither reads any "
             "address at all: every bit arriving on one port is retransmitted "
             "on all the others. All ports therefore share one collision "
             "domain and one broadcast domain, which is why hubs disappeared "
             "from serious networks."),
            ("Bridge and switch - Layer 2",
             "A bridge joins two segments and forwards frames selectively by "
             "MAC address; a switch is a multi-port bridge implemented in "
             "hardware. A switch learns which address lives behind which port "
             "by observing source addresses, and forwards each frame only to "
             "the port that needs it. Each port is its own collision domain."),
            ("Router - Layer 3",
             "Reads the IP header, consults a routing table, and forwards the "
             "packet toward the destination network, rebuilding the frame for "
             "the outgoing link. A router does not forward broadcasts, so "
             "every router interface bounds a broadcast domain. It joins "
             "networks rather than extending one."),
            ("Layer 3 switch",
             "A switch with routing capability implemented in hardware. "
             "Functionally it routes between VLANs at switching speed. The "
             "name is marketing as much as taxonomy -- what matters for an "
             "exam is that it performs Layer 3 forwarding."),
            ("Gateway",
             "A device translating between different protocol suites or "
             "formats, operating potentially at any layer up to Layer 7. Note "
             "that 'default gateway' in host configuration means simply the "
             "router used for off-subnet traffic, which is a different and "
             "much narrower use of the word."),
        ]),
    ]),

    ("Collision Domains and Broadcast Domains", [
        desc(
            "These two terms sit at the heart of most device questions, and "
            "they become easy once stated precisely. A collision domain is the "
            "set of interfaces whose simultaneous transmissions would "
            "interfere with each other. A broadcast domain is the set of "
            "interfaces that will receive a broadcast frame sent by any member "
            "of the set."
        ),
        desc(
            "They are separated by different devices, and confusing which "
            "device separates which is the single most common error in this "
            "topic."
        ),
    ]),

    ("Which Device Splits Which Domain", [
        sub("Hub"),
        desc(
            "One collision domain and one broadcast domain across all ports. A "
            "hub adds ports and nothing else -- every device connected to it "
            "contends with every other."
        ),
        sub("Switch"),
        desc(
            "One collision domain PER PORT, which is the improvement that made "
            "switches worth buying, but still one broadcast domain across all "
            "ports unless VLANs are configured. A switch does not reduce "
            "broadcast traffic, and believing otherwise is a very common "
            "misconception."
        ),
        sub("Router"),
        desc(
            "One collision domain and one broadcast domain per interface. "
            "Routers do not forward broadcasts, which is the principal reason "
            "large networks are subdivided by routers rather than simply "
            "adding more switches."
        ),
        sub("VLAN on a switch"),
        desc(
            "Creates additional broadcast domains within a single physical "
            "switch, giving router-like separation without additional "
            "hardware. This is why VLANs matter."
        ),
    ]),

    ("How a Switch Learns", [
        desc(
            "A switch starts with an empty MAC address table and fills it "
            "purely by observation. Every frame that arrives carries a source "
            "MAC address, and the switch records that this address is "
            "reachable through the port the frame arrived on. Nobody "
            "configures this, and no protocol exchange is involved."
        ),
        desc(
            "Entries age out after a few minutes -- typically five -- so that "
            "a device which has moved does not remain permanently unreachable. "
            "A laptop unplugged from one port and connected to another is "
            "reachable again as soon as it transmits anything, because that "
            "frame updates the table immediately."
        ),
    ]),

    ("The Three Forwarding Rules", [
        ol([
            "If the destination MAC address is in the table, forward the frame "
            "only to that port. This is called filtering, and it is why "
            "switched networks are efficient",
            "If the destination MAC address is not in the table, flood the "
            "frame to every port except the one it arrived on, in the hope of "
            "reaching the destination",
            "If the destination is a broadcast or an unknown multicast "
            "address, flood it as well",
        ]),
        desc(
            "Flooding an unknown unicast frame sounds wasteful and is "
            "self-correcting: the destination replies, and that reply teaches "
            "the switch which port it lives on, so subsequent frames are "
            "filtered rather than flooded."
        ),
    ]),

    ("Loops and Spanning Tree", [
        desc(
            "The learning-and-flooding behaviour has a catastrophic failure "
            "mode. If switches are cabled in a physical loop -- deliberately, "
            "for redundancy, or accidentally -- a flooded frame travels around "
            "the loop, arrives back at the first switch, and is flooded again."
        ),
        desc(
            "Unlike an IP packet, an Ethernet frame carries no time-to-live "
            "field, so nothing ever expires it. The frame circulates forever "
            "and multiplies at every switch, saturating the network within "
            "seconds. This is a broadcast storm, and it takes a network down "
            "completely rather than degrading it."
        ),
        desc(
            "The Spanning Tree Protocol, IEEE 802.1D, exists precisely for "
            "this. It discovers the topology, calculates a loop-free tree, and "
            "blocks the redundant links until a failure makes them necessary. "
            "Redundant cabling without Spanning Tree is not redundancy -- it "
            "is an outage waiting for its first broadcast."
        ),
    ]),

    ("VLANs: Separating Networks Without Separating Cables", [
        desc(
            "A virtual LAN divides one physical switch infrastructure into "
            "several logical networks. Ports assigned to VLAN 10 form one "
            "broadcast domain and ports assigned to VLAN 20 form another, and "
            "a frame never crosses between them inside the switch."
        ),
        desc(
            "The consequence is that two machines plugged into adjacent ports "
            "on the same switch can be as isolated from one another as if they "
            "were in different buildings. Nothing about the cabling reflects "
            "the separation, which is both the appeal and the reason VLAN "
            "misconfiguration is difficult to diagnose visually."
        ),
        image(VLAN_DIAGRAM),
    ]),

    ("Why VLANs Are Used", [
        ul([
            "Broadcast containment: segmentation limits broadcast traffic, "
            "which is the main scaling constraint of a flat Layer 2 network",
            "Security boundaries: finance and guest wireless need not share a "
            "broadcast domain, and traffic between them can be forced through "
            "a policy enforcement point",
            "Logical grouping: a department spread over three floors can share "
            "one network, so the addressing follows the organisation rather "
            "than the floor plan",
            "Flexibility: moving a user between VLANs is a switch "
            "configuration change rather than a recabling exercise",
            "Cost: the separation is achieved without buying additional "
            "physical switches",
        ]),
    ]),

    ("Access Ports, Trunks and the 802.1Q Tag", [
        sub("Access port"),
        desc(
            "Belongs to exactly one VLAN and carries untagged frames to and "
            "from an end device. The end device is entirely unaware that VLANs "
            "exist, which is the point: no host configuration is required and "
            "no operating system support is needed."
        ),
        sub("Trunk port"),
        desc(
            "Carries traffic for several VLANs between switches. Because one "
            "cable now carries multiple broadcast domains, each frame must "
            "declare which VLAN it belongs to -- otherwise the receiving switch "
            "could not tell them apart."
        ),
        sub("The 802.1Q tag"),
        desc(
            "A four-byte field inserted into the Ethernet header, of which 12 "
            "bits carry the VLAN identifier. Twelve bits allow 4096 values, "
            "with 0 and 4095 reserved, leaving 4094 usable VLANs. The tag also "
            "carries three priority bits used for quality of service."
        ),
        sub("Native VLAN"),
        desc(
            "One VLAN per trunk may be configured to travel untagged. This "
            "exists for compatibility with devices that do not understand "
            "tagging, and a mismatch in native VLAN configuration between two "
            "ends of a trunk causes traffic to leak silently between VLANs -- "
            "a genuine security issue rather than merely a fault."
        ),
    ]),

    ("Inter-VLAN Routing", [
        desc(
            "Because VLANs are separate broadcast domains, they are also "
            "separate IP subnets, and traffic between them must therefore be "
            "routed. A switch alone cannot do it: forwarding a frame between "
            "VLANs would defeat the isolation that defines them."
        ),
        desc(
            "Two arrangements are used. In router-on-a-stick, a single router "
            "interface is trunked to the switch and configured with a "
            "sub-interface per VLAN; traffic between VLANs travels up to the "
            "router and back down the same cable, which is simple but makes "
            "that link a bottleneck. A Layer 3 switch instead performs the "
            "routing internally in hardware, which is faster and is what most "
            "modern networks use."
        ),
    ]),

    ("The Routing Table and the Forwarding Decision", [
        desc(
            "A router's routing table maps destination networks to next hops. "
            "For each packet it finds the entry whose network prefix matches "
            "the destination address, and where several entries match it uses "
            "the one with the LONGEST prefix -- the most specific route wins."
        ),
        desc(
            "This longest-prefix-match rule is what allows a general route to "
            "coexist with specific exceptions. A router can hold a route for "
            "10.0.0.0/8 pointing one way and 10.1.5.0/24 pointing another, and "
            "traffic for 10.1.5.77 correctly takes the second while everything "
            "else in 10.0.0.0/8 takes the first."
        ),
    ]),

    ("Three Kinds of Routing Table Entry", [
        sub("Directly connected"),
        desc(
            "Learned automatically from the router's own configured and active "
            "interfaces. These are the most trusted routes it holds, because "
            "the router can see the network in question with its own "
            "interface."
        ),
        sub("Static"),
        desc(
            "Entered by an administrator and never changing on their own. "
            "Predictable and free of protocol overhead, but entirely inert: a "
            "static route to a failed path continues attracting traffic and "
            "silently discarding it."
        ),
        sub("Dynamic"),
        desc(
            "Learned from a routing protocol such as OSPF or BGP, which "
            "exchanges information with neighbouring routers and reacts when "
            "the topology changes. The next lesson covers these in detail."
        ),
        desc(
            "The default route, 0.0.0.0/0, matches every destination and has "
            "the shortest possible prefix, so under longest-prefix-match it is "
            "chosen only when nothing more specific matches -- which is "
            "exactly the behaviour a route of last resort should have."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Saying a switch reduces broadcast traffic",
             "It does not, unless VLANs are configured. A switch splits "
             "collision domains, which is a different thing entirely; "
             "broadcasts are flooded to every port in the VLAN. Only a router "
             "or a VLAN boundary stops a broadcast."),
            ("Expecting two VLANs to communicate through the switch",
             "They cannot. VLANs are separate broadcast domains and therefore "
             "separate IP subnets, so traffic between them must be routed by a "
             "router or a Layer 3 switch."),
            ("Cabling switches in a loop for redundancy without STP",
             "Redundant Layer 2 paths without Spanning Tree produce a "
             "broadcast storm that takes the network down within seconds, "
             "because an Ethernet frame has no hop count to expire it."),
            ("Confusing routing with forwarding",
             "Routing is building the table -- deciding which paths exist and "
             "which is best. Forwarding is the per-packet act of moving one "
             "packet to an outgoing interface using that table."),
            ("Mismatching the native VLAN across a trunk",
             "Untagged frames are then placed in different VLANs at each end, "
             "leaking traffic silently between them. It is a security issue, "
             "not just a misconfiguration."),
            ("Assuming a Layer 3 switch and a router are interchangeable",
             "Both forward at Layer 3, but a router typically offers far "
             "richer WAN interfaces, policy and protocol support, while a "
             "Layer 3 switch is optimised for high-speed routing between local "
             "VLANs."),
        ]),
    ]),

    ("Practical Example: Segmenting a Small Office", [
        desc(
            "An office of sixty people runs on one flat network. Printers, "
            "laptops, IP phones, guest wireless and a payroll server all share "
            "a single broadcast domain. Users complain of intermittent "
            "slowness, and a packet capture shows heavy broadcast traffic. "
            "Separately, a security review notes that the payroll server is "
            "reachable from the guest network."
        ),
        desc(
            "Both problems have the same root cause: there is exactly one "
            "broadcast domain, so every device hears every broadcast and every "
            "device can reach every other device directly at Layer 2, with "
            "nothing in between at which policy could be applied."
        ),
    ]),

    ("The Segmented Design", [
        ol([
            "Assign IP phones to VLAN 10, staff machines to VLAN 20, guests to "
            "VLAN 30 and servers to VLAN 40",
            "Configure the links between switches as 802.1Q trunks so tagged "
            "frames for all four VLANs share the existing cabling",
            "Give each VLAN its own IP subnet, since separate broadcast "
            "domains require separate subnets",
            "Route between VLANs on a Layer 3 switch, which is where access "
            "rules can now be applied",
            "Permit staff to reach the payroll server, deny guests entirely, "
            "and give the voice VLAN priority using the 802.1Q priority bits",
        ]),
        desc(
            "Broadcast traffic is now confined to roughly a quarter of the "
            "network at a time, guest traffic cannot reach payroll without "
            "passing a policy the Layer 3 switch enforces, voice traffic is "
            "prioritised, and none of it required a single new cable."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Device-to-layer matching, including the hub/switch/router "
            "distinction",
            "Counting collision and broadcast domains for a given topology",
            "The three switch forwarding rules, and what happens to an unknown "
            "unicast frame",
            "Why a Layer 2 loop without Spanning Tree is catastrophic rather "
            "than merely wasteful",
            "The 802.1Q tag: field size, usable VLAN count, and access versus "
            "trunk ports",
            "Why inter-VLAN traffic must be routed, and what performs that "
            "routing",
            "Longest prefix match, including how the default route fits into "
            "it",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Repeater and hub are Layer 1, bridge and switch Layer 2, router "
            "Layer 3",
            "Switch: one collision domain per port, one broadcast domain "
            "overall. Router: both per interface",
            "802.1Q carries a 12-bit VLAN ID, giving 4094 usable values after "
            "0 and 4095 are reserved",
            "Traffic between VLANs is always routed, never switched",
            "Longest prefix match decides between overlapping routes; "
            "0.0.0.0/0 is the shortest and therefore the last resort",
            "An Ethernet frame has no TTL, which is why Layer 2 loops are "
            "fatal and Layer 3 loops merely wasteful",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "The network layer exists to move data between different networks, "
            "using hierarchical addressing and routing",
            "A device's layer is the highest header it reads, and that "
            "determines which domains it can separate",
            "Switches split collision domains; routers and VLANs split "
            "broadcast domains",
            "A switch learns by observing source addresses and floods when it "
            "does not know a destination, which makes Layer 2 loops "
            "catastrophic without Spanning Tree",
            "VLANs give logical separation over shared physical cabling, "
            "tagged with 802.1Q on trunk links",
            "Inter-VLAN traffic must be routed, by a router on a stick or a "
            "Layer 3 switch",
            "Routing builds the table; forwarding uses it, choosing the "
            "longest matching prefix",
        ]),
    ]),
]

_dev_quiz = [
    mcq("EASY",
        "At which OSI layer does a router operate, and what does it read to "
        "make its forwarding decision?",
        [("Layer 3, reading the destination IP address", True),
         ("Layer 2, reading the destination MAC address", False),
         ("Layer 4, reading the destination port number", False),
         ("Layer 1, regenerating the signal without reading any address", False)],
        "A router is a network layer device: it opens the IP header, matches "
        "the destination address against its routing table and forwards "
        "accordingly. Reading MAC addresses is what a switch does at Layer 2, "
        "port numbers belong to Layer 4, and signal regeneration without "
        "addressing describes a Layer 1 repeater."),
    mcq("EASY",
        "A 24-port switch has all ports active and no VLANs configured. How "
        "many collision domains and broadcast domains are there?",
        [("24 collision domains and 1 broadcast domain", True),
         ("1 collision domain and 24 broadcast domains", False),
         ("24 collision domains and 24 broadcast domains", False),
         ("1 collision domain and 1 broadcast domain", False)],
        "Each switch port is its own collision domain, which is precisely what "
        "distinguishes a switch from a hub. Broadcasts, however, are flooded "
        "to every port, so without VLANs all 24 ports remain in one broadcast "
        "domain. A single collision domain across all ports would describe a "
        "hub."),
    mcq("AVERAGE",
        "A laptop is unplugged from port 4 of a switch and plugged into port "
        "17 of the same switch. Traffic to it resumes without any "
        "administrator action.\n\nWhich switch behaviour explains this?",
        [("The address table entry ages out after a few minutes, and the "
          "laptop's next transmission teaches the switch its new port.", True),
         ("The switch queries every port with an ARP request until the laptop "
          "responds from its new location.", False),
         ("The laptop sends a port-change notification to the switch when its "
          "link comes up.", False),
         ("The address table is rebuilt from scratch whenever any link state "
          "changes.", False)],
        "MAC address table entries are learned by observation and expire after "
        "an aging interval, typically around five minutes, so a stale entry "
        "does not strand a device that has moved. The laptop's first frame "
        "from port 17 also updates the entry immediately. A switch does not "
        "originate ARP on behalf of hosts, there is no port-change "
        "notification from the endpoint, and a link state change does not "
        "flush the whole table."),
    mcq("AVERAGE",
        "Two hosts are connected to the same physical switch, one in VLAN 10 "
        "and one in VLAN 20, and they cannot communicate.\n\nWhat is required?",
        [("A router or Layer 3 switch to route between the two VLANs, since "
          "they are separate broadcast domains and separate subnets", True),
         ("A trunk port between the two hosts so both VLAN tags can be "
          "carried", False),
         ("Moving both hosts to access ports so their frames become "
          "untagged", False),
         ("Disabling Spanning Tree so the frames are no longer blocked", False)],
        "VLANs are separate broadcast domains and therefore separate IP "
        "subnets, so traffic between them must be routed -- by a router on a "
        "stick or a Layer 3 switch. Trunks carry multiple VLANs between "
        "switches, not between hosts; both hosts are already on access ports; "
        "and Spanning Tree blocks loops, not inter-VLAN traffic."),
    mcq("AVERAGE",
        "A routing table contains both 10.0.0.0/8 via Router A and "
        "10.1.5.0/24 via Router B. A packet arrives for 10.1.5.77.\n\nWhich "
        "route is used, and why?",
        [("10.1.5.0/24 via Router B, because the longest matching prefix "
          "wins", True),
         ("10.0.0.0/8 via Router A, because the shorter prefix covers more "
          "addresses", False),
         ("Whichever route was added to the table first", False),
         ("The packet is load-balanced across both routes since both "
          "match", False)],
        "Both entries match the destination, and the router selects the most "
        "specific -- the longest prefix. /24 is longer than /8, so Router B is "
        "chosen. A shorter prefix covering more addresses is precisely why it "
        "loses; insertion order is irrelevant; and load balancing applies to "
        "routes of equal specificity and cost, not to overlapping prefixes."),
    mcq("AVERAGE",
        "Why does a mismatched native VLAN configuration between two ends of a "
        "trunk constitute a security issue rather than merely a fault?",
        [("Untagged frames are placed into different VLANs at each end, so "
          "traffic leaks silently between broadcast domains that were meant to "
          "be isolated.", True),
         ("The trunk fails to establish, so all VLAN traffic is "
          "blocked.", False),
         ("Spanning Tree recalculates continuously, saturating the "
          "link.", False),
         ("The 802.1Q tag is stripped from all frames rather than only "
          "untagged ones.", False)],
        "One VLAN per trunk travels untagged, and if the two ends disagree "
        "about which VLAN that is, frames sent untagged from one VLAN arrive "
        "and are treated as belonging to another. The isolation the VLANs were "
        "configured to provide silently fails, with no error reported -- which "
        "is what makes it a security problem rather than an obvious fault."),
    mcq("HARD",
        "Two switches are cabled together with two redundant links and "
        "Spanning Tree is disabled.\n\nWhat happens, and why is it so severe?",
        [("A broadcast frame circulates endlessly and multiplies, because an "
          "Ethernet frame has no hop count to expire it.", True),
         ("The links automatically aggregate into a single logical link with "
          "double the bandwidth.", False),
         ("One link is used and the other stays idle until the first "
          "fails.", False),
         ("The switches negotiate which link to use through ARP.", False)],
        "Without Spanning Tree the redundant path forms a Layer 2 loop. A "
        "broadcast is flooded out of both links, returns to each switch, and "
        "is flooded again, doubling with each pass. Unlike an IP packet, an "
        "Ethernet frame carries no time-to-live field, so nothing ever "
        "discards it and the network saturates within seconds. Automatic "
        "aggregation requires an explicit protocol, automatic standby requires "
        "STP itself, and ARP plays no part."),
    mcq("HARD",
        "How many usable VLAN identifiers does the 802.1Q tag provide, and "
        "why?",
        [("4094, because the VLAN ID field is 12 bits and IDs 0 and 4095 are "
          "reserved", True),
         ("4096, because the VLAN ID field is 12 bits and all values are "
          "usable", False),
         ("1024, because the VLAN ID field is 10 bits", False),
         ("255, because the VLAN ID occupies one octet of the tag", False)],
        "The 802.1Q tag is four bytes, of which 12 bits carry the VLAN "
        "identifier, giving 4096 possible values. VLAN 0 is reserved to "
        "indicate priority-tagged frames carrying no VLAN, and 4095 is "
        "reserved, leaving 4094 usable. The remaining options misstate the "
        "field width."),
    short_answer("EASY",
        "Which protocol prevents Layer 2 loops by blocking redundant switch "
        "links until they are needed? Give the common name or its IEEE number.",
        "Spanning Tree Protocol",
        ["spanning tree protocol", "stp", "spanning tree", "802.1d",
         "ieee 802.1d"]),
    short_answer("AVERAGE",
        "What is the name for the arrangement in which a single router "
        "interface, trunked to a switch, routes between several VLANs?",
        "Router on a stick",
        ["router on a stick", "router-on-a-stick", "one-armed router"]),
    descriptive("HARD",
        "A flat 200-host network suffers from broadcast traffic and has no "
        "internal security boundaries. Explain how VLANs address both problems "
        "and what additional component the design then requires.",
        "A flat network is a single broadcast domain, so every ARP request, "
        "DHCP discovery and other Layer 2 broadcast reaches all 200 hosts and "
        "must be processed by every network stack before most of them discard "
        "it. The load grows with the number of hosts multiplied by how often "
        "each broadcasts, and there is no boundary anywhere at which traffic "
        "could be inspected or filtered, since every host can reach every "
        "other directly at Layer 2. VLANs divide the switch infrastructure "
        "into several logical networks, each its own broadcast domain, so a "
        "broadcast is confined to the hosts within that VLAN and the "
        "background load falls roughly in proportion to the number of VLANs "
        "created. Because separate broadcast domains must also be separate IP "
        "subnets, this simultaneously creates an enforcement point: traffic "
        "between groups must now leave one subnet and enter another, and at "
        "that transition access control can be applied. The additional "
        "component the design requires is therefore a routing function between "
        "VLANs -- either a router with a trunked interface carrying a "
        "sub-interface per VLAN, the router-on-a-stick arrangement, or a Layer "
        "3 switch performing the routing internally in hardware, which is "
        "faster and avoids making the single trunk link a bottleneck. It also "
        "requires 802.1Q trunk links between switches so that tagged frames "
        "for several VLANs can share the existing physical cabling, and care "
        "that the native VLAN matches at both ends of every trunk, since a "
        "mismatch leaks traffic between VLANs silently.",
        [("Explains that VLANs split the broadcast domain and why that reduces "
          "load", 4),
         ("Explains that separate subnets create an enforcement point for "
          "security policy", 3),
         ("Identifies inter-VLAN routing and 802.1Q trunking as the required "
          "additions", 3)]),
]

LESSON_DEVICES = {
    "middle": MID_PROTOCOLS,
    "name": "Network Layer Devices: Routers, Switches, and VLANs",
    "quiz": _dev_quiz,
    "structure": lesson_structure(
        "Network Layer Devices: Routers, Switches, and VLANs",
        "This category previously jumped straight to integrated service "
        "architecture without covering the boxes that actually move traffic. "
        "This lesson fills that in properly. You will learn what the network "
        "layer is responsible for, how to classify any device by the highest "
        "layer it reads, the difference between a collision domain and a "
        "broadcast domain and exactly which device separates which, how a "
        "switch learns and the three rules it forwards by, why a Layer 2 loop "
        "is catastrophic rather than merely wasteful, how VLANs create logical "
        "separation over shared cabling and what the 802.1Q tag carries, why "
        "inter-VLAN traffic must be routed, and how a router chooses between "
        "overlapping routes.",
        [
            "State the five functions of the network layer and distinguish "
            "routing from forwarding",
            "Classify repeaters, hubs, bridges, switches, routers and gateways "
            "by the layer at which each operates",
            "Explain collision domains and broadcast domains and say which "
            "device separates which",
            "Describe how a switch builds its MAC address table and the three "
            "rules it forwards by",
            "Explain why a Layer 2 loop without Spanning Tree produces a "
            "broadcast storm",
            "Explain what a VLAN is, why it is used, and the roles of access "
            "ports, trunk ports, the 802.1Q tag and the native VLAN",
            "Explain why inter-VLAN traffic must be routed and compare "
            "router-on-a-stick with a Layer 3 switch",
            "Apply longest prefix match to choose between overlapping routing "
            "table entries, including the default route",
        ],
        55,
        _dev_sections,
        [
            ("Collision domain",
             "The set of interfaces whose simultaneous transmissions would "
             "interfere. Each switch port forms its own."),
            ("Broadcast domain",
             "The set of interfaces receiving a broadcast frame sent by any "
             "member. Bounded by routers and by VLAN boundaries."),
            ("MAC address table",
             "The switch's record of which address is reachable through which "
             "port, learned by observing source addresses and aged out after a "
             "few minutes."),
            ("Flooding",
             "Forwarding a frame out of every port except the one it arrived "
             "on, done for broadcasts and for unicast destinations not yet "
             "learned."),
            ("Broadcast storm",
             "The saturation caused by a frame circulating in a Layer 2 loop, "
             "made fatal by the absence of any TTL field in an Ethernet "
             "frame."),
            ("Spanning Tree Protocol",
             "IEEE 802.1D. Detects Layer 2 loops and blocks redundant links "
             "until they are needed."),
            ("VLAN",
             "A logically separate broadcast domain configured across shared "
             "physical switch infrastructure."),
            ("Access port / trunk port",
             "An access port belongs to one VLAN and carries untagged frames; "
             "a trunk carries several VLANs with each frame tagged."),
            ("802.1Q tag",
             "A four-byte field carrying a 12-bit VLAN identifier -- 4094 "
             "usable -- plus three priority bits."),
            ("Native VLAN",
             "The one VLAN per trunk carried untagged. A mismatch between "
             "trunk ends leaks traffic silently between VLANs."),
            ("Inter-VLAN routing",
             "Routing between VLANs, performed by a router on a stick or a "
             "Layer 3 switch, since VLANs are separate subnets."),
            ("Longest prefix match",
             "The rule that where several routing entries match a destination, "
             "the most specific is used."),
        ],
        "The network layer moves data between networks using hierarchical "
        "addressing and routing, and the devices implementing it are "
        "classified by the highest header they read. Hubs regenerate signals "
        "and separate nothing; switches read MAC addresses and give each port "
        "its own collision domain while leaving a single broadcast domain; "
        "routers read IP addresses and bound a broadcast domain at every "
        "interface. A switch learns purely by observing source addresses and "
        "floods when it does not know a destination -- efficient in normal "
        "operation and catastrophic in a loop, because an Ethernet frame has "
        "no time-to-live and nothing ever expires it, which is why Spanning "
        "Tree exists. VLANs add broadcast separation and a security boundary "
        "without new cabling, carried between switches by the 802.1Q tag with "
        "its 12-bit identifier, and because separate broadcast domains are "
        "separate subnets, traffic between them must be routed rather than "
        "switched. Finally, a router faced with overlapping routes always "
        "takes the most specific, which is exactly why the all-matching "
        "default route is chosen last."),
}

LESSONS = [LESSON_STANDARDS, LESSON_DEVICES]
