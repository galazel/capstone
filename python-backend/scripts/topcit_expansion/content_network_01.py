"""Understanding of Network -> Network Fundamentals and OSI Model (MID 120).

The middle category held two lessons, both Layer 1/Layer 2 material. Everything
the TOPCIT Network module puts *before* those two -- what a protocol is, the
OSI and TCP/IP layer models, encapsulation -- was missing, so the category
began in the middle of its own story.

FORMAT NOTE. This module is written to match the lessons the system generated,
measured rather than guessed:

    existing lessons   4,887 words   28-40 sections   46.5 blocks   1.14 images
    first draft here   2,925 words   29 sections      32 blocks     0 images

The first draft was less than half the length, carried no diagrams, and used
coloured card grids at four times the rate of the rest of the bank. This
version restores the missing depth: every concept gets worked through rather
than stated, sections carry more than one block where that helps, and diagrams
appear at the points where a picture genuinely does the explaining.

Written against TOPCIT ESSENCE Network (Technical Field 03, Ver.2), sections
"Introduction to Network" 01-02.
"""

from builders import (accordion, desc, descriptive, image, image_text,
                      lesson_structure, mcq, ol, short_answer, sub, tabs, ul)

MID_FUNDAMENTALS = 120

OSI_DIAGRAM = "/lesson-media/osi-reference-model.svg"
ENCAP_DIAGRAM = "/lesson-media/encapsulation.svg"
_osi_sections = [
    ("Why This Lesson Comes First", [
        desc(
            "Every other lesson in this category assumes you already know "
            "which layer a piece of network behaviour belongs to. When the "
            "physical layer lesson talks about line coding, it assumes you "
            "know why line coding is not the data link layer's problem. When "
            "the data link lesson talks about MAC addresses, it assumes you "
            "know why those addresses are not enough to cross the internet. "
            "This lesson supplies the framework both of those sit inside."
        ),
        desc(
            "It is also the most reusable thing in the whole Network module. "
            "Being able to place any protocol, device or fault at the correct "
            "layer is what turns 'the network is broken' into a specific "
            "question with a specific test, and it is the skill that examiners "
            "return to more often than any other."
        ),
    ]),

    ("What a Protocol Actually Is", [
        desc(
            "A protocol is an agreement. Two machines that have never met, "
            "built by different vendors, running different operating systems, "
            "on different continents, can exchange data only because both "
            "sides implement the same written rules about what the bits mean. "
            "There is no magic in it: somebody wrote a document, both vendors "
            "read the same document, and the machines now agree."
        ),
        desc(
            "Strip away the jargon and every protocol answers three questions. "
            "What is the format of a message and in what order do the fields "
            "appear? What does each field mean and what must the receiver do "
            "about it? And when may a message be sent, how fast, and how long "
            "should the sender wait before concluding that no reply is coming? "
            "Those three questions are called syntax, semantics and timing, "
            "and they are the standard definition of a protocol."
        ),
    ]),

    ("Syntax: The Shape of a Message", [
        desc(
            "Syntax is the structure and format of the data. It covers field "
            "order, field widths, how numbers are encoded, and -- crucially -- "
            "how a receiver knows where one message ends and the next begins. "
            "A receiver reading a stream of bytes has no natural sense of "
            "where a message stops, so every protocol must solve that "
            "somehow: with a fixed length, with an explicit length field at "
            "the front, or with a delimiter that cannot appear inside the "
            "message."
        ),
        desc(
            "A syntax failure is a message the receiver cannot parse. It is "
            "the easiest of the three to diagnose, because the receiver "
            "usually rejects it immediately and says so. When two "
            "implementations disagree about syntax, the symptom is a "
            "connection that fails instantly and consistently rather than "
            "intermittently."
        ),
    ]),

    ("Semantics: The Meaning of a Message", [
        desc(
            "Semantics is what each field means and what action it requires. A "
            "destination address field means 'deliver this here'. An "
            "acknowledgement number means 'I have received everything below "
            "this point'. A status code of 404 means the resource was not "
            "found and the request should not simply be retried unchanged."
        ),
        desc(
            "Semantic failures are far nastier than syntax failures, because "
            "the message parses cleanly and is then acted on incorrectly. The "
            "classic case is two implementations that read the same status "
            "code differently -- one treats a particular response as "
            "retryable and the other as fatal -- and the resulting behaviour "
            "looks like a bug in the application rather than a disagreement "
            "about the protocol."
        ),
    ]),

    ("Timing: When and How Fast", [
        desc(
            "Timing covers when a party may transmit and at what rate. It has "
            "two distinct aspects that are worth separating. Speed matching "
            "ensures a fast sender does not overwhelm a slow receiver, which "
            "is what flow control does at the transport layer. Timeouts "
            "decide the point at which silence should be interpreted as "
            "failure, which is a genuinely difficult judgement: too short and "
            "you abandon working connections on a slow day, too long and a "
            "dead peer holds resources for minutes."
        ),
        desc(
            "Timing failures produce the intermittent bugs nobody can "
            "reproduce. The message was correct and it was understood "
            "correctly -- it simply arrived after the other side had given "
            "up. These are the faults that appear only under load, only at "
            "certain times of day, or only for users on one particular "
            "network path."
        ),
    ]),

    ("Classifying a Failure", [
        desc(
            "Because every protocol has exactly these three elements, most "
            "protocol faults can be sorted into one of them, and doing so "
            "narrows the search immediately."
        ),
        ul([
            "Rejected as malformed, consistently and immediately: a syntax "
            "problem -- check field order, lengths and encoding",
            "Accepted and then acted on wrongly: a semantic problem -- check "
            "how each side interprets the values, especially error codes",
            "Correct but too late, or only under load: a timing problem -- "
            "check timeouts, retransmission and flow control",
            "Works between two implementations from the same vendor and fails "
            "across vendors: almost always semantics, because both sides read "
            "the same specification differently",
        ]),
    ]),

    ("Why Networks Are Built in Layers", [
        desc(
            "Imagine a single program responsible for everything from the "
            "user's keystroke down to the voltage on a copper pair. It would "
            "have to know the application's data format, how to find the "
            "remote host, how to recover from a lost packet, and the "
            "electrical characteristics of the specific cable in use. Change "
            "the cable and you change the program. Change the application and "
            "you risk the electrical timing. Such a program could never be "
            "standardised, because no two organisations run the same "
            "combination of everything."
        ),
        desc(
            "Layering solves this by splitting the problem into ranks of "
            "service. Each layer uses the service of the layer below it, adds "
            "exactly one well-defined capability, and offers the result "
            "upward. A layer does not need to know how the layer below "
            "achieves its job -- only what it promises. That promise is the "
            "interface, and as long as the interface holds, either side of it "
            "can be replaced entirely."
        ),
    ]),

    ("The Interface Is the Contract", [
        desc(
            "This is what allows a web browser to work identically over "
            "Ethernet, Wi-Fi, a mobile network or a satellite link. The "
            "application asks for a reliable byte stream to a named host. "
            "Whether the bits eventually become electrical pulses in copper, "
            "light in a fibre, or radio in the air is somebody else's problem, "
            "several floors down."
        ),
        desc(
            "The same principle explains why the industry could move from "
            "10BASE-T through Gigabit Ethernet to Wi-Fi 6 without rewriting a "
            "single web server. Each of those is a change below an interface "
            "that did not move. It is difficult to overstate how much of "
            "modern networking depends on this one idea."
        ),
    ]),

    ("The Benefits, Named Explicitly", [
        desc(
            "Exam questions ask for these directly, so it is worth being able "
            "to list them rather than gesture at the general idea."
        ),
        ul([
            "Modularity: a layer can be replaced without touching the others, "
            "which is how physical media evolved repeatedly without disturbing "
            "applications",
            "Interoperability: vendors implement the same layer boundary, so "
            "equipment from different manufacturers interconnects",
            "Simplified troubleshooting: a fault can be localised to a layer, "
            "which converts a vague complaint into a specific test",
            "Parallel development: teams work on separate layers simultaneously "
            "against a fixed interface",
            "Standardisation: different bodies can own different layers, which "
            "is exactly what happened -- IEEE owns the lower two, IETF the "
            "middle ones",
            "Teachability: the model gives everyone shared vocabulary, which is "
            "why 'that's a Layer 2 problem' is a sentence engineers understand "
            "without further explanation",
        ]),
    ]),

    ("The Cost of Layering", [
        desc(
            "Layering is not free, and a complete understanding includes its "
            "price. Every layer boundary adds a header, so a small piece of "
            "application data can end up carrying forty or more bytes of "
            "protocol overhead. Every boundary is also potentially a copy in "
            "memory, which costs processing time. And strict layering "
            "occasionally prevents useful optimisations, because a lower layer "
            "is forbidden from knowing what an upper layer is trying to do."
        ),
        desc(
            "This is why the industry settled on the smallest number of layers "
            "that preserved the useful independence, rather than the largest "
            "number that could be justified conceptually. It is also part of "
            "why the seven-layer OSI model lost to the four-layer TCP/IP model "
            "in practice."
        ),
    ]),

    ("The OSI Reference Model", [
        desc(
            "The Open Systems Interconnection model was standardised by ISO in "
            "1984, in cooperation with ITU-T. It divides communication into "
            "seven layers, each with a defined responsibility. It is a "
            "reference model rather than an implementation: almost no "
            "production stack is built exactly this way, and the protocol "
            "suite ISO designed alongside it was never widely adopted."
        ),
        desc(
            "It nonetheless remains the vocabulary the entire industry argues "
            "in, and TOPCIT expects you to know each layer's responsibility, "
            "its characteristic protocols and its typical devices. The "
            "diagram below shows the seven layers in the conventional order, "
            "with Layer 7 at the top and Layer 1 at the bottom."
        ),
        image(OSI_DIAGRAM),
    ]),

    ("The Seven Layers in Detail", [
        accordion([
            ("Layer 7 - Application",
             "The layer the user's program obtains network service from. It "
             "does not mean the application itself: a web browser is not the "
             "application layer, but HTTP is. Its job is to provide a service "
             "interface, not to move bits. Protocols: HTTP, FTP, SMTP, DNS, "
             "SNMP, SSH, DHCP. Devices: application-layer firewalls and "
             "gateways."),
            ("Layer 6 - Presentation",
             "Concerned with the representation of data rather than its "
             "delivery: character encoding, data format conversion, "
             "compression and encryption. This is the layer that ensures a "
             "string sent by a big-endian mainframe is still the same string "
             "when a little-endian PC reads it. TLS is commonly placed here, "
             "though it fits awkwardly. Formats: ASCII, Unicode, JPEG, MPEG."),
            ("Layer 5 - Session",
             "Establishes, manages and terminates conversations between "
             "applications. It handles dialogue control -- deciding who may "
             "speak and when -- and synchronisation, inserting checkpoints so "
             "that a long transfer can resume from the last checkpoint rather "
             "than restarting. NetBIOS, RPC session management and SQL "
             "sessions sit here."),
            ("Layer 4 - Transport",
             "The first layer that is genuinely end-to-end: it concerns the "
             "conversation between two processes, not the hops in between. "
             "Provides segmentation and reassembly, port-based multiplexing, "
             "and -- for TCP -- reliability, ordering, flow control and "
             "congestion control. UDP occupies the same layer while promising "
             "almost none of it. Devices: firewalls filtering on port, load "
             "balancers."),
            ("Layer 3 - Network",
             "Delivers packets between hosts on DIFFERENT networks. Its two "
             "signature jobs are logical addressing -- giving every host an "
             "address whose structure identifies its network -- and routing, "
             "choosing a path across intermediate networks. It also fragments "
             "packets too large for a link. Protocols: IP, ICMP, OSPF, BGP, "
             "ARP. Devices: routers and Layer 3 switches."),
            ("Layer 2 - Data Link",
             "Delivers frames between two nodes on the SAME physical network. "
             "It adds physical (MAC) addressing, frames the bit stream so a "
             "receiver knows where a frame starts and ends, and detects "
             "transmission errors with a frame check sequence. Split into the "
             "LLC and MAC sub-layers. Protocols: Ethernet, PPP, HDLC, Wi-Fi. "
             "Devices: switches and bridges."),
            ("Layer 1 - Physical",
             "Transmits raw bits as electrical, optical or radio signals. "
             "Defines connectors, pin assignments, voltage levels, line coding "
             "and data rates. It has no concept of a frame; it moves ones and "
             "zeroes. Standards: 10BASE-T, 1000BASE-SX, RS-232. Devices: "
             "hubs, repeaters, cables, transceivers."),
        ]),
    ]),

    ("A Memory Aid, and Why the Order Matters", [
        desc(
            "The traditional mnemonic from Layer 7 downward is 'All People "
            "Seem To Need Data Processing'. From Layer 1 upward it is 'Please "
            "Do Not Throw Sausage Pizza Away'. Learn one of them properly: "
            "exam questions ask which layer a device, protocol or fault "
            "belongs to, and being confident about the order removes an entire "
            "category of avoidable error."
        ),
        desc(
            "The order is not arbitrary. Each layer genuinely depends on the "
            "one below: you cannot frame a bit stream that does not exist, you "
            "cannot route a packet that has not been framed, and you cannot "
            "run an application protocol over a connection that has not been "
            "established. Reciting the list is easy; understanding the "
            "dependency is what makes it useful."
        ),
    ]),

    ("Troubleshooting Bottom-Up", [
        desc(
            "The practical habit that follows is to work upward from Layer 1. "
            "Before debugging an application, confirm the link is up, the "
            "switch has learned the MAC address, the host can reach its "
            "gateway, and the port is open. This sounds slow and is almost "
            "always faster, because most faults reported as application "
            "problems resolve at Layer 1 or Layer 3."
        ),
        ol([
            "Layer 1: is the cable connected, is the link light on, is the "
            "interface showing errors?",
            "Layer 2: has the switch learned the MAC address, is the port in "
            "the right VLAN, are there frame errors?",
            "Layer 3: can the host ping its own address, its gateway, then an "
            "external address?",
            "Layer 4: is the destination port actually open and listening?",
            "Layer 7: does the application respond correctly once everything "
            "below is confirmed working?",
        ]),
        desc(
            "An engineer who starts at Layer 7 -- reading application logs "
            "for a fault whose cause is a half-seated cable -- can lose hours. "
            "The discipline is to spend two minutes proving the lower layers "
            "before spending an afternoon on the upper ones."
        ),
    ]),

    ("The TCP/IP Model", [
        desc(
            "The internet does not run on OSI. It runs on the TCP/IP model, "
            "which predates the OSI standard and collapses the same territory "
            "into four layers: Network Access, Internet, Transport and "
            "Application."
        ),
        desc(
            "It won for reasons worth understanding, because they recur "
            "throughout the industry. TCP/IP was implemented and freely "
            "available -- bundled with BSD Unix -- while the OSI protocol "
            "suite was still being specified. It had a large working proving "
            "ground in the ARPANET. And it was designed around a network that "
            "existed rather than around a committee's picture of one. A "
            "specification without implementations is a proposal, however "
            "official its provenance."
        ),
    ]),

    ("The Four TCP/IP Layers", [
        tabs([
            ("Network Access", "Network Access Layer",
             "Combines OSI Layers 1 and 2. Covers everything about placing a "
             "frame onto a specific medium: Ethernet, Wi-Fi, PPP, and the "
             "hardware addressing and error detection that go with them. "
             "TCP/IP deliberately declines to standardise this layer, which is "
             "precisely why the same IP stack runs over media invented decades "
             "apart -- including media that did not exist when IP was "
             "designed."),
            ("Internet", "Internet Layer",
             "Maps to OSI Layer 3. IP addressing, routing and fragmentation, "
             "with the supporting protocols ICMP, ARP and IGMP. Its contract "
             "is deliberately weak: best-effort, connectionless delivery with "
             "no promise of arrival, ordering or non-duplication. That weakness "
             "is a design choice -- it keeps the network simple and pushes "
             "complexity to the endpoints."),
            ("Transport", "Transport Layer",
             "Maps to OSI Layer 4. TCP builds reliability, ordering, flow "
             "control and congestion control on top of IP's weak contract; UDP "
             "adds only ports and a checksum, leaving everything else to the "
             "application. SCTP offers a third option with multi-streaming and "
             "multi-homing."),
            ("Application", "Application Layer",
             "Absorbs OSI Layers 5, 6 and 7 into one. HTTP, FTP, SMTP, DNS, "
             "SSH and the rest. In practice applications handle their own "
             "session and presentation concerns -- HTTP has its own notion of "
             "sessions and TLS handles encryption -- which is why separating "
             "the three OSI layers was never worth doing in an "
             "implementation."),
        ]),
    ]),

    ("Mapping OSI to TCP/IP", [
        desc(
            "You will be asked to map between the two, and the mapping is not "
            "perfectly clean. Being honest about where it is fuzzy is part of "
            "understanding it rather than a sign of confusion."
        ),
        ul([
            "OSI 7, 6 and 5 all collapse into the TCP/IP Application layer",
            "OSI 4 maps one-to-one onto the TCP/IP Transport layer",
            "OSI 3 maps one-to-one onto the TCP/IP Internet layer",
            "OSI 2 and 1 collapse into the TCP/IP Network Access layer",
        ]),
        desc(
            "The awkward cases are worth knowing. ARP translates between a "
            "Layer 3 address and a Layer 2 address, so it belongs cleanly to "
            "neither and is placed differently by different textbooks. TLS "
            "provides encryption, which is a presentation-layer job, while "
            "running over TCP like an application. Neither ambiguity indicates "
            "an error in the models -- it indicates that real protocols were "
            "built to work rather than to fit a diagram."
        ),
    ]),

    ("Encapsulation", [
        desc(
            "Layering is realised in practice by encapsulation. As data "
            "descends the stack, each layer wraps what it received from above "
            "inside its own header -- and, at the data link layer, a trailer as "
            "well. Each layer treats everything from above as opaque payload "
            "that it must carry without inspecting."
        ),
        desc(
            "The receiving host reverses the process, which is called "
            "decapsulation. Each layer strips the header its peer added, acts "
            "on the information in it, and passes the remainder upward. The "
            "diagram below shows a message accumulating headers on the way "
            "down and shedding them on the way up."
        ),
        image(ENCAP_DIAGRAM),
    ]),

    ("Encapsulation Step by Step", [
        ol([
            "The application produces data -- an HTTP request, for example",
            "The transport layer prepends a TCP header carrying source and "
            "destination ports, sequence and acknowledgement numbers; the "
            "result is called a segment",
            "The network layer prepends an IP header carrying source and "
            "destination IP addresses and a time-to-live value; the result is "
            "called a packet",
            "The data link layer prepends a frame header carrying source and "
            "destination MAC addresses, and appends a frame check sequence "
            "trailer; the result is called a frame",
            "The physical layer encodes the frame as signals and transmits it "
            "onto the medium as a stream of bits",
        ]),
    ]),

    ("Protocol Data Unit Names", [
        desc(
            "The unit of data at each layer has its own name, and these are "
            "examined directly. Collectively they are called protocol data "
            "units. A question phrased as 'at which layer is the PDU called a "
            "frame' is testing exactly this vocabulary."
        ),
        ul([
            "Application, presentation, session layers: data, or message",
            "Transport layer: segment for TCP, datagram for UDP",
            "Network layer: packet -- occasionally called a datagram, which is "
            "a genuine ambiguity in the terminology",
            "Data link layer: frame",
            "Physical layer: bits",
        ]),
    ]),

    ("Overhead in Practice", [
        desc(
            "Encapsulation has a measurable cost worth being able to "
            "estimate. A minimal TCP header is 20 bytes, a minimal IPv4 header "
            "is another 20, and an Ethernet header and trailer add 18. That is "
            "58 bytes of overhead before any application data at all."
        ),
        desc(
            "For a bulk file transfer using 1,460-byte segments this is under "
            "4% and nobody notices. For an application sending single-byte "
            "keystrokes -- an interactive terminal session -- the same 58 "
            "bytes carry one byte of payload, an efficiency of under 2%. This "
            "is why protocols such as Telnet and SSH were historically "
            "criticised for their overhead, and why Nagle's algorithm exists to "
            "combine small writes into fewer segments."
        ),
    ]),

    ("Peer-to-Peer Communication Between Layers", [
        desc(
            "The conceptual rule is that each layer communicates logically "
            "with its peer layer on the remote host. The transport layer on "
            "the sender is, in effect, talking to the transport layer on the "
            "receiver: it sets a sequence number that only the peer transport "
            "layer will read and act on."
        ),
        desc(
            "Physically, of course, nothing travels sideways. The data goes "
            "all the way down the sender's stack, across the wire, and all the "
            "way up the receiver's. But the headers are addressed peer to "
            "peer, and thinking of them that way is what makes the design "
            "comprehensible."
        ),
    ]),

    ("Why Intermediate Devices Stop Where They Do", [
        desc(
            "Peer-to-peer communication explains an otherwise puzzling fact: "
            "devices in the middle of a path only climb the stack as far as "
            "they need to, and no further."
        ),
        sub("A switch stops at Layer 2"),
        desc(
            "It reads the frame header, looks up the destination MAC address "
            "in its address table, and forwards the frame out of the "
            "appropriate port. It never opens the IP header, because nothing "
            "it needs to know is in there. This is also why a switch is fast: "
            "it makes a decision from a small amount of information near the "
            "start of the frame."
        ),
        sub("A router climbs to Layer 3"),
        desc(
            "It strips the incoming frame entirely, reads the IP header to "
            "determine the destination network, consults its routing table to "
            "choose a next hop, and then builds a COMPLETELY NEW frame for the "
            "outgoing link. This is the mechanism behind the single most "
            "important consequence in this lesson."
        ),
    ]),

    ("The Consequence: Which Addresses Change", [
        desc(
            "Because a router rebuilds the frame at every hop, MAC addresses "
            "change on every link a packet traverses. Because it does not "
            "alter the IP header, IP addresses stay the same from source to "
            "destination. If you remember one sentence from this lesson, make "
            "it that one -- it resolves a large fraction of the confusion "
            "learners have about addressing, and it is examined repeatedly."
        ),
        desc(
            "The reason is that the two addresses answer different questions. "
            "An IP address identifies an endpoint and must survive the whole "
            "journey, because routers along the way need to know where the "
            "packet is ultimately going and the server needs to know where to "
            "reply. A MAC address identifies the next device on THIS cable, "
            "and it is meaningless one hop further on -- no switch beyond the "
            "local segment has ever heard of it."
        ),
    ]),

    ("Connection-Oriented and Connectionless Service", [
        desc(
            "Two service models recur at several layers, and confusing them is "
            "a common exam trap. The distinction is about whether state is "
            "established before data flows."
        ),
        sub("Connection-oriented"),
        desc(
            "A connection is established before any data is transferred, both "
            "ends hold state describing it for its duration, and it is "
            "explicitly released afterwards. This is the telephone call model. "
            "It usually offers ordered delivery and reliability, and it costs "
            "latency for the setup handshake and memory for the per-connection "
            "state. TCP, SCTP and virtual circuits work this way."
        ),
        sub("Connectionless"),
        desc(
            "Each unit is sent independently, carrying a full destination "
            "address, with no prior arrangement. This is the postal model. "
            "Units may arrive out of order, duplicated, or not at all, and the "
            "sender is not told which. It costs nothing in setup latency and "
            "holds no per-connection state, which is what allows a router to "
            "handle millions of flows it knows nothing about. IP and UDP work "
            "this way."
        ),
    ]),

    ("Why IP Is Deliberately Unreliable", [
        desc(
            "Students frequently assume IP's lack of guarantees is a "
            "deficiency that TCP was invented to patch. It is better "
            "understood as a deliberate architectural decision, sometimes "
            "called the end-to-end principle: keep the network simple and put "
            "the complexity at the endpoints."
        ),
        desc(
            "A router that had to guarantee delivery would need to remember "
            "every packet until acknowledged, hold state for every conversation "
            "passing through it, and recover that state after a restart. It "
            "could not then handle the volume the internet requires. By making "
            "IP best-effort, routers stay stateless and fast, and hosts -- "
            "which are far fewer per link and already hold the data -- take on "
            "reliability where it is cheap. This choice is much of the reason "
            "the internet scaled as far as it has."
        ),
    ]),

    ("Standards Bodies at a Glance", [
        desc(
            "Knowing which body owns which layer saves you on several exam "
            "questions, and the division follows the layering closely."
        ),
        ul([
            "ISO, with ITU-T: the OSI reference model itself",
            "IEEE, through its 802 committee: the physical and data link "
            "layers -- Ethernet, Wi-Fi, VLAN tagging",
            "IETF, through the RFC series: the internet protocol suite from "
            "the network layer upward -- IP, TCP, UDP, HTTP, DNS",
            "W3C: web technologies such as HTML and CSS, though the protocol "
            "carrying them belongs to the IETF",
            "IANA, under ICANN: the number registries everything depends on "
            "-- address blocks, port numbers, protocol numbers",
        ]),
        desc(
            "The next lesson in this category covers the standards process in "
            "detail, including why not every RFC is a standard."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Treating the OSI model as an implementation",
             "It is a reference model. Real stacks have no discrete session and "
             "presentation layers, and TLS does not fit tidily into Layer 6. "
             "Use OSI as shared vocabulary and an analysis tool, not as a "
             "description of any actual code."),
            ("Confusing Layer 2 and Layer 3 addressing",
             "MAC addresses are flat, burned in, meaningful only on the local "
             "link, and rewritten at every router hop. IP addresses are "
             "hierarchical, assigned, and survive end to end. A question about "
             "'the address that changes at each hop' is asking about MAC."),
            ("Assuming more layers is better",
             "OSI's seven lost to TCP/IP's four. Every boundary costs a header "
             "and a copy, and the industry settled on the smallest set that "
             "kept the useful independence."),
            ("Saying 'the switch routes the packet'",
             "Switches forward frames using MAC addresses; routers route "
             "packets using IP addresses. The words are not interchangeable "
             "and examiners test precisely this."),
            ("Believing IP's unreliability is a flaw",
             "It is an architectural choice that keeps routers stateless and "
             "allows the network to scale. Reliability is added at the "
             "endpoints, by TCP, where it is affordable."),
            ("Starting troubleshooting at the application layer",
             "Most faults reported as application problems resolve at Layer 1 "
             "or Layer 3. Two minutes proving the lower layers routinely saves "
             "an afternoon."),
        ]),
    ]),

    ("Practical Example: Tracing a Web Request", [
        desc(
            "A user on 192.168.11.5 opens a page on a server at 220.17.23.15. "
            "Following this single request through the stack exercises "
            "everything in the lesson, and it is worth working through slowly "
            "rather than reading past."
        ),
        ol([
            "The browser needs the server's IP address, so it asks DNS -- an "
            "application-layer protocol -- to resolve the hostname",
            "It opens a TCP connection to port 443, which is a transport-layer "
            "operation involving a three-way handshake",
            "The operating system compares 220.17.23.15 against its own subnet "
            "mask, concludes the destination is on a different network, and "
            "decides to send the packet to its default gateway -- a "
            "network-layer decision",
            "To place the frame on the wire it needs the gateway's MAC "
            "address, so it consults its ARP cache and, failing that, "
            "broadcasts an ARP request asking who holds 192.168.11.1",
            "The frame leaves with the GATEWAY's MAC address as destination "
            "but the SERVER's IP address as destination",
        ]),
    ]),

    ("What Happens at Each Hop", [
        desc(
            "Every router along the path repeats the same three steps, and the "
            "repetition is the point."
        ),
        ol([
            "Strip the incoming frame and discard it -- it has served its "
            "purpose, which was to cross one link",
            "Read the IP header, consult the routing table, and choose the "
            "next hop toward 220.17.23.15",
            "Build a brand new frame addressed to that next hop's MAC address "
            "and transmit it",
        ]),
        desc(
            "The final router on the destination network ARPs for the "
            "server's own MAC address and delivers the frame directly. The "
            "server's data link layer checks the frame check sequence, its "
            "network layer confirms the destination address is its own, and "
            "its transport layer reads the destination port and hands the data "
            "to whichever process is listening on 443."
        ),
    ]),

    ("What That Example Demonstrates", [
        ul([
            "The IP addresses in the packet never changed, across every hop",
            "The MAC addresses changed on every single link",
            "Each layer's header was read only by its peer layer, never by the "
            "layers around it",
            "Intermediate devices climbed only as high as their job required",
            "Four separate protocols cooperated -- DNS, TCP, IP and ARP -- "
            "without any of them knowing the others' internals",
        ]),
    ]),

    ("How This Lesson Is Examined", [
        desc(
            "TOPCIT tests this material in several recognisable shapes, and "
            "knowing the shapes is worth as much as knowing the content."
        ),
        ul([
            "Name the layer: given a protocol, device or function, identify "
            "its OSI layer",
            "Name the PDU: given a layer, state what the data unit is called",
            "Order questions: place the seven layers correctly, or state the "
            "order in which headers are added",
            "Mapping questions: relate OSI layers to TCP/IP layers",
            "Address behaviour: which addresses change during a packet's "
            "journey and which do not",
            "Definitional questions: the three elements of a protocol, or the "
            "difference between connection-oriented and connectionless "
            "service",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Be able to name all seven OSI layers in order, in both "
            "directions, and give one protocol and one device for each",
            "Know the PDU at each layer: data, segment, packet, frame, bits",
            "Know which OSI layers merge into which TCP/IP layers, and be "
            "ready to explain why the collapse was reasonable",
            "Be precise about devices: hub and repeater are Layer 1, switch "
            "and bridge are Layer 2, router is Layer 3",
            "Expect at least one question on encapsulation order and one on "
            "the syntax/semantics/timing definition",
            "Remember that IP is connectionless and best-effort by design, and "
            "be able to say why",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "A protocol is an agreement with three elements: syntax, semantics "
            "and timing -- and most protocol faults are cleanly one of them",
            "Layering separates concerns so each layer can change "
            "independently, which is why one IP stack serves every medium ever "
            "invented",
            "OSI has seven layers and is a reference model; TCP/IP has four "
            "and is what the internet actually runs",
            "Encapsulation adds a header per layer on the way down and strips "
            "one per layer on the way up, at a cost of roughly 58 bytes",
            "Each layer's header is written for its peer on the far host, "
            "which is why intermediate devices climb only as far as they must",
            "MAC addresses are local and change hop by hop; IP addresses are "
            "end-to-end and do not",
            "IP's unreliability is a deliberate choice that keeps routers "
            "stateless and lets the network scale",
        ]),
    ]),
]

_osi_quiz = [
    mcq("EASY",
        "A protocol specification states that a message must begin with a "
        "2-byte length field, followed by a 1-byte type field, followed by the "
        "payload.\n\nWhich element of a protocol is this defining?",
        [("Syntax", True),
         ("Semantics", False),
         ("Timing", False),
         ("Topology", False)],
        "Syntax is the format and order of the fields in a message. Semantics "
        "would be the meaning of the type field's values and the action each "
        "requires; timing would be how quickly a reply must follow. Topology "
        "is not an element of a protocol at all -- it describes the physical "
        "or logical arrangement of a network."),
    mcq("EASY",
        "At which OSI layer is the protocol data unit called a frame?",
        [("Data Link", True),
         ("Network", False),
         ("Transport", False),
         ("Physical", False)],
        "The PDU names run: data at the application layer, segment at "
        "transport, packet at network, frame at data link, and bits at "
        "physical. The data link layer adds both a header carrying MAC "
        "addresses and a trailer carrying the frame check sequence, which is "
        "what makes a frame a frame."),
    mcq("AVERAGE",
        "A packet travels from a host, through three routers, to a server. "
        "Which statement about its addresses is correct?",
        [("The source and destination IP addresses stay the same throughout, "
          "while the source and destination MAC addresses are rewritten at "
          "each hop.", True),
         ("Both the IP and MAC addresses stay the same throughout, since they "
          "identify the endpoints.", False),
         ("The IP addresses are rewritten at each hop while the MAC addresses "
          "stay the same.", False),
         ("Only the destination IP address is rewritten, so each router knows "
          "where to send the packet next.", False)],
        "IP addressing is end-to-end: the network layer header identifies the "
        "original sender and the final recipient, and routers do not alter it "
        "(NAT aside). MAC addressing is link-local: each router strips the "
        "incoming frame and builds a new one addressed to the next hop, so "
        "both MAC addresses change on every link. Rewriting IP addresses at "
        "each hop would destroy the receiver's ability to reply."),
    mcq("AVERAGE",
        "Which OSI layers are combined into the single Application layer of "
        "the TCP/IP model?",
        [("Application, Presentation and Session", True),
         ("Application and Presentation only", False),
         ("Application, Presentation, Session and Transport", False),
         ("Presentation and Session only", False)],
        "TCP/IP merges OSI layers 5, 6 and 7 into one Application layer. "
        "Transport stays separate -- it maps one-to-one onto OSI Layer 4 -- "
        "because the distinction between end-to-end delivery and application "
        "semantics is one that implementations genuinely maintain."),
    mcq("AVERAGE",
        "A network engineer says \"that's a Layer 2 problem\" about a host "
        "that cannot reach anything on its own subnet, although its link light "
        "is on.\n\nWhich of the following is consistent with that diagnosis?",
        [("The switch is not learning the host's MAC address, so frames are "
          "not being forwarded to it.", True),
         ("The default gateway address configured on the host is wrong.", False),
         ("The DNS server is unreachable, so names do not resolve.", False),
         ("The application is listening on the wrong TCP port.", False)],
        "MAC address learning and frame forwarding are data link layer "
        "functions, so a switch failing to learn the address is a Layer 2 "
        "fault. A wrong default gateway is Layer 3, DNS is an application "
        "layer service, and a wrong listening port is Layer 4. The link light "
        "being on already rules out most of Layer 1."),
    mcq("AVERAGE",
        "An interactive terminal session sends single keystrokes. With a "
        "20-byte TCP header, a 20-byte IPv4 header and 18 bytes of Ethernet "
        "framing, what proportion of each transmission is application data?",
        [("Under 2%, which is why algorithms exist to combine small writes",
          True),
         ("About 50%, since headers and payload are roughly balanced", False),
         ("About 25%, because only the TCP header applies to small "
          "writes", False),
         ("Over 90%, because headers are compressed for small payloads", False)],
        "One byte of payload against 58 bytes of headers gives an efficiency "
        "just under 2%. Nothing compresses those headers by default at this "
        "layer. This overhead is precisely why Nagle's algorithm combines "
        "small writes into fewer segments, and why interactive protocols were "
        "historically criticised for their inefficiency."),
    mcq("HARD",
        "Why did the TCP/IP model succeed commercially while the OSI protocol "
        "suite did not, despite OSI being the formal international standard?",
        [("TCP/IP was implemented, freely available and proven on a working "
          "network while the OSI suite was still being specified.", True),
         ("TCP/IP defines more layers, giving finer control over each "
          "function.", False),
         ("OSI could not support connectionless service, which the internet "
          "required.", False),
         ("TCP/IP was ratified by ISO earlier than the OSI model was.", False)],
        "Working code that shipped with an operating system beat a "
        "specification still in committee, and the ARPANET gave TCP/IP a large "
        "proving ground. TCP/IP has fewer layers, not more. OSI does define "
        "connectionless service. And TCP/IP is an IETF product published as "
        "RFCs; it was never ratified by ISO."),
    mcq("HARD",
        "Why is IP deliberately designed as a best-effort, connectionless "
        "protocol rather than a reliable one?",
        [("Keeping routers stateless allows them to handle enormous traffic "
          "volumes, with reliability added at the endpoints where it is "
          "affordable.", True),
         ("Reliable delivery was technically impossible when IP was "
          "designed.", False),
         ("Connectionless delivery guarantees packets arrive in "
          "order.", False),
         ("It allows routers to inspect application data for routing "
          "decisions.", False)],
        "A router guaranteeing delivery would have to hold state for every "
        "conversation crossing it and buffer every packet until acknowledged, "
        "which could not scale. Making IP best-effort keeps routers simple and "
        "fast and pushes reliability to hosts, which are fewer per link and "
        "already hold the data. This is the end-to-end principle. "
        "Connectionless delivery guarantees nothing about ordering, and "
        "routers do not inspect application data."),
    short_answer("AVERAGE",
        "Which protocol is used to discover the MAC address that corresponds "
        "to a known IPv4 address on the local network? Give the acronym.",
        "ARP",
        ["arp", "address resolution protocol"]),
    short_answer("EASY",
        "Name the OSI layer responsible for logical addressing and routing "
        "between different networks.",
        "Network layer",
        ["network layer", "network", "layer 3", "l3", "the network layer"]),
    descriptive("HARD",
        "Explain why network functionality is divided into layers, and "
        "describe two concrete consequences of that division that an engineer "
        "would notice in practice.",
        "Layering divides communication into ranks of service in which each "
        "layer uses the service of the layer below, adds one well-defined "
        "capability, and presents the result upward through a fixed interface. "
        "Because a layer depends only on the interface below it and not on how "
        "that service is implemented, layers can be developed, replaced and "
        "standardised independently, and different standards bodies can own "
        "different layers. Two practical consequences: (1) the same TCP/IP "
        "stack and the same applications run unchanged over Ethernet, Wi-Fi or "
        "a mobile network, because only the network access layer differs -- an "
        "engineer can replace the physical infrastructure entirely without "
        "touching a line of application code, which is how the industry moved "
        "from 10BASE-T to Wi-Fi 6 without rewriting web servers; (2) faults "
        "can be localised by layer, so troubleshooting proceeds bottom-up from "
        "link state, to MAC address learning, to IP reachability, to port "
        "availability, turning a vague complaint into a specific test at a "
        "specific layer -- and since most faults reported as application "
        "problems actually resolve at Layer 1 or Layer 3, this ordering saves "
        "substantial time. The division is not free: every boundary adds a "
        "header and potentially a memory copy, which is why the industry "
        "settled on the fewest layers that preserved the useful independence.",
        [("Explains layering as a service hierarchy with fixed interfaces", 4),
         ("Gives a correct first practical consequence", 3),
         ("Gives a correct second practical consequence", 3)]),
]

LESSON_OSI = {
    "middle": MID_FUNDAMENTALS,
    "name": "Protocols and the OSI Reference Model",
    "quiz": _osi_quiz,
    "structure": lesson_structure(
        "Protocols and the OSI Reference Model",
        "Every other lesson in this category assumes you already know what a "
        "protocol is and which layer a piece of network behaviour belongs to. "
        "This lesson supplies that foundation, and it is the most reusable "
        "material in the whole Network module. You will learn the three "
        "elements every protocol defines and how to classify a fault as one of "
        "them, why networks are built as stacks of layers and what that costs "
        "as well as what it buys, what each of the seven OSI layers is "
        "responsible for along with its protocols and devices, how the "
        "four-layer TCP/IP model maps onto it and where the mapping is "
        "genuinely fuzzy, how encapsulation carries a message down one stack "
        "and up another, and why MAC addresses change at every hop while IP "
        "addresses never do. A worked example traces a single web request "
        "through every one of these ideas.",
        [
            "Define a protocol in terms of its syntax, semantics and timing, "
            "and classify a given failure as one of the three",
            "Explain why layered architecture is used, state the benefits it "
            "produces, and describe the overhead it costs",
            "Name the seven OSI layers in order and describe the "
            "responsibility, characteristic protocols and typical devices of "
            "each",
            "Apply bottom-up troubleshooting to localise a fault by layer",
            "Map the four TCP/IP layers onto the seven OSI layers and explain "
            "where the mapping is imprecise",
            "Describe encapsulation and decapsulation, name the protocol data "
            "unit at each layer, and estimate header overhead",
            "Explain peer-to-peer layer communication and why intermediate "
            "devices climb only as far as they must",
            "Distinguish connection-oriented from connectionless service and "
            "explain why IP is deliberately best-effort",
        ],
        60,
        _osi_sections,
        [
            ("Protocol",
             "A set of rules governing communication between systems, defined "
             "by its syntax (message format), semantics (meaning and required "
             "action) and timing (when messages may be sent and how long to "
             "wait for a reply)."),
            ("Syntax",
             "The structure and format of a message: field order, field "
             "widths, encoding, and how a receiver identifies message "
             "boundaries."),
            ("Semantics",
             "The meaning of each field and the action it requires of the "
             "receiver. Semantic disagreements between implementations produce "
             "faults that look like application bugs."),
            ("Timing",
             "When a party may transmit, at what rate, and how long it waits "
             "before treating silence as failure. Timing faults are the "
             "intermittent ones."),
            ("OSI Reference Model",
             "A seven-layer conceptual model from ISO: Physical, Data Link, "
             "Network, Transport, Session, Presentation, Application. A "
             "reference model rather than an implementation."),
            ("TCP/IP Model",
             "The four-layer model the internet is actually built on: Network "
             "Access, Internet, Transport, Application."),
            ("Encapsulation",
             "Wrapping data from an upper layer in the header -- and at Layer "
             "2 the trailer -- of the layer below as it descends the stack. "
             "Decapsulation is the reverse on the receiving host."),
            ("Protocol Data Unit (PDU)",
             "The named unit of data at a given layer: data, segment, packet, "
             "frame, bits."),
            ("Peer-to-peer communication",
             "The principle that each layer's header is written for, and read "
             "by, the same layer on the remote host, even though the data "
             "physically travels down and up the two stacks."),
            ("Connection-oriented service",
             "A service establishing a connection before transfer, holding "
             "state during it and releasing it afterwards. TCP and SCTP."),
            ("Connectionless service",
             "A service in which each unit is sent independently with a full "
             "destination address and no prior setup. IP and UDP."),
            ("End-to-end principle",
             "The design choice of keeping the network simple and stateless "
             "and placing complexity such as reliability at the endpoints. It "
             "is why IP is best-effort."),
        ],
        "A protocol is an agreement about syntax, semantics and timing, and "
        "classifying a fault as one of the three narrows the search "
        "immediately: syntax fails loudly and consistently, semantics fails "
        "quietly and looks like an application bug, timing fails "
        "intermittently and only under load. A network stack is a pile of such "
        "agreements arranged so each can change without disturbing the others "
        "-- which is why one IP stack has served every transmission medium "
        "invented since, at a cost of roughly 58 bytes of header per frame. "
        "The OSI model gives seven layers of shared vocabulary; the TCP/IP "
        "model gives the four the internet actually implements, collapsing "
        "OSI's top three into one and its bottom two into one. Data is "
        "encapsulated on the way down and decapsulated on the way up, and each "
        "header is addressed to its peer on the far host -- which is why a "
        "switch stops at Layer 2 and a router climbs to Layer 3 and no "
        "further. That last point produces the sharpest single idea in the "
        "lesson: because a router rebuilds the frame at every hop but leaves "
        "the IP header alone, MAC addresses change on every link while IP "
        "addresses survive the entire journey. And IP's refusal to guarantee "
        "anything is not a weakness but the decision that let the internet "
        "scale, with reliability added by TCP at the endpoints where it is "
        "affordable."),
}

LESSONS = [LESSON_OSI]
