"""Understanding of Network -> Network Fundamentals and OSI Model (MID 120).

Rebuilt to the format the system's own lessons use, measured rather than
guessed: roughly 4,900 words over 28-40 sections, about 46 blocks, at least one
diagram, and most sections carrying more than one block. The first draft of
this lesson ran 2,300 words with no diagrams and used coloured card grids at
four times the rate of the rest of the bank.

Written against TOPCIT ESSENCE Network (Technical Field 03, Ver.2), section
"03 Internet Address Structure".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_FUNDAMENTALS = 120

MAC_DIAGRAM = "/lesson-media/mac-address-structure.svg"
IPV4_DIAGRAM = "/lesson-media/ipv4-address-classes.svg"
_addr_sections = [
    ("Three Addresses at Once", [
        desc(
            "A single message in flight is identified by three different "
            "addresses simultaneously, and each answers a different question. "
            "The MAC address answers 'which device on this cable'. The IP "
            "address answers 'which host on the internet'. The port number "
            "answers 'which program on that host'."
        ),
        desc(
            "Learners who treat these as three versions of the same idea get "
            "lost immediately and stay lost, because almost every subsequent "
            "topic -- routing, NAT, firewalls, load balancing -- depends on "
            "keeping them apart. Learners who hold the three questions "
            "separately find the rest of networking considerably easier. It "
            "is worth spending real time on this lesson for that reason."
        ),
    ]),

    ("Layer, Scope and Lifetime", [
        desc(
            "The three differ along three axes at once, and stating all three "
            "makes the distinction stick better than memorising a table."
        ),
        sub("MAC address - Layer 2"),
        desc(
            "48 bits, normally burned into the network interface at "
            "manufacture. Meaningful only on the local link -- no device "
            "beyond the local segment has any record of it. Rewritten by every "
            "router the message passes through, so it changes many times "
            "during a single journey."
        ),
        sub("IP address - Layer 3"),
        desc(
            "32 bits for IPv4, 128 for IPv6. Assigned by administration or by "
            "DHCP rather than by a manufacturer, and hierarchical so that "
            "routers can aggregate many hosts into one table entry. Constant "
            "from source to destination, which is what allows a reply to find "
            "its way back."
        ),
        sub("Port number - Layer 4"),
        desc(
            "16 bits, giving the range 0 to 65535. Chosen by the operating "
            "system for a client or fixed by convention for a server. "
            "Identifies the process, which is what lets one host run a web "
            "server, a mail server and a database simultaneously on one IP "
            "address."
        ),
    ]),

    ("MAC Address Structure", [
        desc(
            "A MAC address is 48 bits, conventionally written as six "
            "hexadecimal octets separated by colons or hyphens: "
            "00:1A:2B:3C:4D:5E. It is split precisely down the middle, and "
            "that split is the reason global uniqueness is achievable without "
            "any central coordination at run time."
        ),
        desc(
            "The upper 24 bits are the Organizationally Unique Identifier, "
            "allocated to a manufacturer by the IEEE. The lower 24 bits are "
            "assigned by that manufacturer to the individual interface. Every "
            "manufacturer therefore has 16.7 million addresses to hand out "
            "within each OUI it holds, and large manufacturers hold many OUIs."
        ),
        image(MAC_DIAGRAM),
    ]),

    ("What the OUI Tells You", [
        desc(
            "The OUI is a practical diagnostic tool, not just an "
            "administrative detail. A packet capture full of frames from an "
            "unfamiliar OUI tells you which manufacturer's equipment has "
            "appeared on the network, which is frequently the fastest way to "
            "identify an unexpected device."
        ),
        ul([
            "Public OUI databases map the first three octets to a "
            "manufacturer name, and most capture tools resolve this "
            "automatically",
            "A device whose OUI belongs to a virtualisation vendor is almost "
            "certainly a virtual machine rather than physical hardware",
            "An address with no matching OUI has probably been set in software "
            "rather than assigned at manufacture",
            "Several devices sharing an OUI and appearing at once usually "
            "means a single shipment of new equipment was installed",
        ]),
    ]),

    ("The Two Meaningful Bits", [
        desc(
            "Two bits within the first octet carry structural meaning, and "
            "exams ask about them. The least significant bit of the first "
            "octet is the individual/group bit: 0 marks a unicast address "
            "intended for one interface, 1 marks a multicast address intended "
            "for a group."
        ),
        desc(
            "The next bit is the universal/local bit. A 0 means the address "
            "came from the IEEE-administered space and should be globally "
            "unique; a 1 means it was assigned locally and carries no such "
            "guarantee. This is what a virtual machine or a "
            "privacy-randomising phone is doing when it presents an address no "
            "manufacturer ever shipped."
        ),
    ]),

    ("Unicast, Multicast and Broadcast at Layer 2", [
        desc(
            "Three delivery modes exist at the data link layer, and each has a "
            "distinct address form."
        ),
        ul([
            "Unicast: one specific interface, individual/group bit 0. The "
            "ordinary case for almost all traffic",
            "Multicast: a group of interested interfaces, individual/group bit "
            "1. Used by protocols such as OSPF and IPv6 neighbour discovery, "
            "so that only participating devices process the frame",
            "Broadcast: FF:FF:FF:FF:FF:FF, every interface on the local "
            "segment. The special case ARP depends on, and the reason a large "
            "flat network becomes slow",
        ]),
        desc(
            "Broadcast is worth dwelling on because it is the scaling limit of "
            "a Layer 2 network. Every host must receive, process and discard "
            "every broadcast frame, so the cost grows with the number of hosts "
            "multiplied by how often each of them broadcasts. This is the "
            "reason networks are subdivided into broadcast domains at all."
        ),
    ]),

    ("Can a MAC Address Be Trusted?", [
        desc(
            "A MAC address is burned into the interface, which leads people to "
            "treat it as an identity. It is not one. Almost every operating "
            "system allows the address to be overridden in software with a "
            "single command, and modern phones randomise it deliberately to "
            "prevent shops and networks tracking a device across visits."
        ),
        desc(
            "The practical consequence is that MAC-based access control -- "
            "allowing only known addresses onto a wireless network, for "
            "example -- is a convenience rather than a security control. An "
            "attacker observes an allowed address in the clear, sets their own "
            "interface to match, and is admitted. It raises the effort "
            "slightly and stops nobody who is trying."
        ),
    ]),

    ("IPv4 Address Structure", [
        desc(
            "An IPv4 address is 32 bits, written as four decimal octets "
            "separated by dots: 192.168.11.5. Each octet represents eight bits, "
            "so each ranges from 0 to 255, and the whole space holds about 4.3 "
            "billion addresses."
        ),
        desc(
            "The critical point is that it is not one identifier but two glued "
            "together: a network portion and a host portion. This split is "
            "what makes routing possible at internet scale. A router does not "
            "need an entry for every host on Earth -- it needs an entry for "
            "every network, and the network portion is what it matches "
            "against. Without the split, the global routing table would need "
            "billions of entries instead of roughly a million."
        ),
    ]),

    ("The Historical Address Classes", [
        desc(
            "Originally the split was fixed by class, determined by the "
            "leading bits of the address. The class decided how many bits "
            "belonged to the network and how many to hosts, and therefore how "
            "large a network could be."
        ),
        image(IPV4_DIAGRAM),
    ]),

    ("The Five Classes", [
        tabs([
            ("Class A", "Class A: 1.0.0.0 - 126.255.255.255",
             "First bit 0. The network portion is the first octet only, giving "
             "126 usable networks of roughly 16.7 million hosts each. These "
             "were allocated almost entirely to early adopters -- "
             "universities, government departments and a few corporations -- "
             "which is why so much of the space still belongs to a small "
             "handful of organisations."),
            ("Class B", "Class B: 128.0.0.0 - 191.255.255.255",
             "First two bits 10. The network portion is the first two octets: "
             "16,384 networks of 65,534 hosts each. This was the classic "
             "university and large-enterprise allocation, and the worst "
             "offender for waste -- an organisation needing 300 addresses "
             "received 65,534 and used half a percent of them."),
            ("Class C", "Class C: 192.0.0.0 - 223.255.255.255",
             "First three bits 110. The network portion is the first three "
             "octets: about two million networks of 254 hosts. Too small for "
             "most organisations, which then had to be allocated several "
             "adjacent Class C blocks -- each of which needed its own routing "
             "table entry."),
            ("Class D and E", "Class D and Class E",
             "Class D, 224.0.0.0 to 239.255.255.255, is multicast: an address "
             "identifying a group of receivers rather than one host. Class E, "
             "240.0.0.0 and above, is reserved for experimental use and is not "
             "routed on the public internet."),
        ]),
    ]),

    ("Why Classful Addressing Failed", [
        desc(
            "The class system produced only three practical network sizes: "
            "about sixteen million, about sixty-five thousand, and 254. Real "
            "organisations do not come in three sizes."
        ),
        desc(
            "The consequences compounded. Organisations needing a few hundred "
            "addresses took a Class B and wasted 65,000, exhausting the "
            "address space far faster than the actual number of connected "
            "hosts warranted. Organisations too large for a Class C took "
            "several, each requiring a separate routing table entry, inflating "
            "the global routing table. Both problems were solved at once by "
            "abandoning fixed classes in favour of an explicit prefix length, "
            "which is the subject of the CIDR lesson in the next category."
        ),
    ]),

    ("Special and Reserved IPv4 Addresses", [
        desc(
            "Several ranges never appear as ordinary host addresses on the "
            "public internet. Exam questions test them directly, and knowing "
            "them also makes reading a packet capture much faster -- a "
            "reserved address immediately tells you what kind of traffic you "
            "are looking at."
        ),
        accordion([
            ("Private addresses (RFC 1918)",
             "10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. Usable freely "
             "inside any organisation but dropped by internet routers, which "
             "is why traffic leaving a home network must pass through NAT. "
             "Millions of separate networks use 192.168.1.0/24 simultaneously "
             "without conflict, because none of them is visible to the "
             "others."),
            ("Loopback: 127.0.0.0/8",
             "Traffic sent to this range never leaves the host. 127.0.0.1 is "
             "the conventional address, but the entire /8 is reserved -- "
             "pinging 127.9.9.9 also succeeds on a healthy stack, which "
             "surprises people. Used to test that the local TCP/IP stack is "
             "functioning at all."),
            ("Link-local: 169.254.0.0/16",
             "Self-assigned by a host that requested a DHCP lease and received "
             "no answer. Seeing a 169.254 address on a machine is one of the "
             "most useful diagnostic facts in this entire lesson: it means "
             "DHCP failed, and it means the fault is not cabling, not DNS and "
             "not the application."),
            ("Network and broadcast addresses",
             "In any subnet the all-zeroes host portion names the network "
             "itself and the all-ones host portion is the directed broadcast. "
             "Neither can be assigned to a host, which is why a /24 offers 256 "
             "addresses but only 254 usable ones. This off-by-two is the "
             "single most common subnetting error."),
            ("Default route: 0.0.0.0/0",
             "In a routing table this matches everything and is the route of "
             "last resort -- the default gateway. As a source address it means "
             "'this host, address not yet known', which is what a DHCP client "
             "sends from before it has been given anything."),
        ]),
    ]),

    ("Reading an Address Diagnostically", [
        desc(
            "Because the reserved ranges are distinctive, an address alone "
            "often identifies a fault before any other test is run. This is "
            "worth practising until it is automatic."
        ),
        ul([
            "169.254.x.x with no gateway: DHCP did not answer -- investigate "
            "the DHCP scope, relay or VLAN assignment",
            "127.0.0.1 responding but nothing else: the local stack works and "
            "the problem is outside the host",
            "A private address where a public one was expected: the host is "
            "behind NAT, or received a lease from the wrong DHCP server",
            "A correct address and mask but no gateway: the host can reach its "
            "own subnet and nothing beyond it",
            "An address outside the configured subnet: a manual configuration "
            "error, or a rogue DHCP server on the segment",
        ]),
    ]),

    ("IPv6 Address Structure", [
        desc(
            "IPv6 raises the address to 128 bits, written as eight groups of "
            "four hexadecimal digits separated by colons: "
            "2001:0db8:0000:0000:0000:ff00:0042:8329. The address space is "
            "large enough that exhaustion is not a practical concern -- it "
            "provides roughly 340 undecillion addresses, which is more than "
            "enough for every device anyone has proposed connecting."
        ),
        desc(
            "Writing them out in full would be intolerable, so two "
            "abbreviation rules exist and both are examined."
        ),
    ]),

    ("The Two Abbreviation Rules", [
        ol([
            "Leading zeroes within any group may be dropped: 0db8 becomes db8, "
            "and 0000 becomes 0",
            "One run of consecutive all-zero groups may be replaced entirely "
            "by a double colon",
        ]),
        desc(
            "Applying both to the example gives 2001:db8::ff00:42:8329. The "
            "double colon may appear only ONCE in an address, and the reason "
            "is worth understanding rather than memorising: with two of them, "
            "a reader could not determine how many zero groups belonged to "
            "each, so the address would be ambiguous. 2001::25de::cade is "
            "therefore invalid, not merely unconventional."
        ),
    ]),

    ("Why IPv6 Is More Than a Bigger Address", [
        desc(
            "The motivation was exhaustion -- four billion addresses were "
            "never going to cover a planet of phones, sensors and appliances "
            "-- but the redesign corrected several other things at the same "
            "time, and exams ask about these."
        ),
        ul([
            "The header is simplified and of fixed size, which routers process "
            "faster than IPv4's variable-length header with options",
            "Fragmentation by routers is abolished; only the source may "
            "fragment, which removes a significant processing burden from the "
            "middle of the network",
            "Address autoconfiguration lets a host construct its own address "
            "from a router advertisement, without DHCP being present at all",
            "IPsec was designed in from the start rather than retrofitted",
            "Broadcast is removed entirely and its work is done by well-defined "
            "multicast groups, which spares uninterested hosts the processing",
        ]),
    ]),

    ("IPv6 Address Types", [
        desc(
            "IPv6 replaces IPv4's categories with a cleaner set. The absence "
            "of broadcast is the change most often examined, and the "
            "always-present link-local address is the one that surprises "
            "people configuring IPv6 for the first time."
        ),
        ul([
            "Global unicast, 2000::/3 -- the publicly routable equivalent of "
            "an ordinary public IPv4 address",
            "Link-local, fe80::/10 -- automatically configured on every IPv6 "
            "interface and valid only on that link. It always exists, whether "
            "or not anything else is configured",
            "Unique local, fc00::/7 -- the private-address equivalent, for use "
            "within an organisation",
            "Multicast, ff00::/8 -- there is no broadcast address, and its "
            "former roles are served by specific multicast groups such as "
            "all-nodes and all-routers",
        ]),
    ]),

    ("Port Numbers", [
        desc(
            "The IP address delivers a packet to the correct machine, but a "
            "machine runs many programs. The transport layer therefore adds a "
            "16-bit port number for the source and another for the "
            "destination, identifying the process at each end."
        ),
        desc(
            "Sixteen bits gives 65,536 values, numbered 0 to 65535. IANA "
            "divides this space into three ranges with different rules, and "
            "the boundaries are commonly examined."
        ),
    ]),

    ("The Three Port Ranges", [
        sub("Well-known ports: 0 to 1023"),
        desc(
            "Assigned to standard services and, on Unix-like systems, "
            "bindable only by a privileged process. That privilege requirement "
            "is a genuine security property: a program listening on port 80 "
            "was started by someone with administrative rights, so an "
            "unprivileged user cannot impersonate a system service. Examples: "
            "HTTP 80, HTTPS 443, SSH 22, DNS 53, SMTP 25, FTP 20 and 21, "
            "Telnet 23."
        ),
        sub("Registered ports: 1024 to 49151"),
        desc(
            "Registered with IANA by software vendors for particular "
            "applications, but usable without special privilege. Examples: "
            "MySQL 3306, PostgreSQL 5432, RDP 3389, HTTP alternate 8080."
        ),
        sub("Dynamic or ephemeral ports: 49152 to 65535"),
        desc(
            "Allocated by the operating system for the client end of a "
            "connection and released when it closes. This is why the source "
            "port of an outbound web request appears random, and why a host "
            "can only hold a finite number of simultaneous outbound "
            "connections to the same destination."
        ),
    ]),

    ("Sockets and the Four-Tuple", [
        desc(
            "An IP address combined with a port number is called a socket. "
            "The pair of sockets at each end -- source IP, source port, "
            "destination IP, destination port -- uniquely identifies a "
            "connection, and this four-tuple resolves a question that "
            "otherwise looks paradoxical."
        ),
        desc(
            "How can thousands of clients all connect to one server on port "
            "443 at the same time? Because the destination IP and port are "
            "identical for all of them, but the source IP or source port "
            "differs, so every tuple is distinct and the transport layer never "
            "confuses two connections. The server does not allocate a new port "
            "per client, which is a common misconception -- it keeps listening "
            "on 443 throughout."
        ),
    ]),

    ("How the Three Addresses Work Together", [
        desc(
            "Consider a browser on 192.168.11.5 fetching a page from "
            "220.17.23.15. The socket pair is (192.168.11.5:51314, "
            "220.17.23.15:443) and stays fixed for the life of the connection. "
            "The IP header carries those two addresses unchanged across every "
            "hop."
        ),
        desc(
            "But the frame the packet rides inside is rebuilt at every hop. On "
            "the first link its destination MAC address is the default "
            "gateway's, not the server's, because the server is not on this "
            "cable and no switch here has ever heard of it."
        ),
    ]),

    ("The Journey, Step by Step", [
        ol([
            "The host compares the destination IP against its own address and "
            "subnet mask and concludes the destination is on a different "
            "network",
            "It therefore needs the MAC address of its default gateway, which "
            "it takes from its ARP cache or obtains by an ARP broadcast",
            "It transmits a frame whose destination MAC is the gateway's, "
            "containing a packet whose destination IP is the server's",
            "The gateway strips the frame, consults its routing table, and "
            "builds a new frame addressed to the next hop",
            "Each subsequent router repeats that step, changing MAC addresses "
            "and leaving IP addresses alone",
            "The final router on the destination network ARPs for the server's "
            "own MAC address and delivers the frame directly",
            "The server's transport layer reads the destination port and hands "
            "the data to the process listening on 443",
        ]),
    ]),

    ("Address Resolution: ARP", [
        desc(
            "ARP, the Address Resolution Protocol, is the bridge between Layer "
            "3 and Layer 2, and it is the mechanism that makes the whole "
            "handover between them possible. A host that knows an IP address "
            "on its own network but not the corresponding MAC address "
            "broadcasts an ARP request -- effectively shouting 'who has "
            "192.168.11.1?' to every device on the segment."
        ),
        desc(
            "The holder of that address replies directly with its MAC address, "
            "and the asking host caches the answer for a few minutes so that "
            "the broadcast need not be repeated for every subsequent packet. "
            "Every other host on the segment also sees the request and "
            "typically records the sender's mapping while it is there."
        ),
    ]),

    ("The ARP Cache and Its Consequences", [
        desc(
            "Caching makes ARP efficient and introduces two behaviours worth "
            "knowing. First, a change of hardware can leave a host briefly "
            "unreachable: until the stale entry expires, frames are still "
            "addressed to a MAC address that has gone. Clearing the ARP cache "
            "is a standard first move when an IP address has just been moved "
            "from one machine to another."
        ),
        desc(
            "Second, ARP has no authentication whatsoever. Any host can reply "
            "to any request, or send unsolicited replies, claiming any address "
            "it likes. This is ARP spoofing, and it is how an attacker on the "
            "same segment inserts themselves between a host and its gateway. "
            "The protocol was designed for a trusted network and never "
            "revised, which is why defence relies on switch features such as "
            "dynamic ARP inspection rather than on ARP itself."
        ),
    ]),

    ("RARP and What Replaced It", [
        desc(
            "RARP, the Reverse Address Resolution Protocol, works in the "
            "opposite direction: a device that knows its own MAC address but "
            "not its IP address asks the network to supply one. It was used by "
            "diskless workstations at boot, which had no storage to remember a "
            "configuration."
        ),
        desc(
            "It has been superseded by BOOTP and then DHCP, which perform the "
            "same job and a great deal more -- supplying subnet mask, gateway, "
            "DNS servers and dozens of other options in one exchange. TOPCIT "
            "still expects you to know the pair and which way round they work: "
            "ARP resolves IP to MAC, RARP resolves MAC to IP."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Thinking a MAC address is permanent and unforgeable",
             "It is burned in, but almost every operating system allows it to "
             "be overridden with one command, and modern phones randomise it "
             "deliberately. MAC addresses are an identifier, never an "
             "authentication mechanism, and MAC filtering stops nobody who is "
             "actually trying."),
            ("Assuming a /24 subnet offers 256 usable addresses",
             "It offers 256 addresses, of which the first is the network "
             "address and the last the broadcast address, leaving 254 for "
             "hosts. This off-by-two is deliberately set up by examiners and "
             "costs marks in every subnetting question."),
            ("Writing an IPv6 address with two double colons",
             "2001::25de::cade is invalid, because with two of them a reader "
             "cannot determine how many zero groups belong to each. Only one "
             "run of zeroes may be compressed."),
            ("Confusing a port with a socket",
             "A port is a 16-bit number. A socket is an IP address and a port "
             "together, and a connection is identified by a PAIR of sockets. "
             "This is exactly why many clients can talk to port 443 at once."),
            ("Believing a server allocates a new port per client",
             "It does not; it keeps listening on the same port throughout. "
             "Connections are distinguished by the full four-tuple, in which "
             "the client's source port differs."),
            ("Believing 169.254.x.x means the network is fine",
             "It means the opposite. The host asked for a DHCP lease, received "
             "no answer, and gave itself a link-local address. It can reach "
             "other stranded hosts on the same segment and nothing else."),
        ]),
    ]),

    ("Practical Example: Reading an ipconfig Output", [
        desc(
            "A support engineer examines a workstation showing IPv4 address "
            "169.254.7.19, subnet mask 255.255.0.0, and no default gateway. "
            "Nothing on the corporate network is reachable, but the link light "
            "is on and the switch port shows traffic."
        ),
        desc(
            "The address alone identifies the fault. The host never received a "
            "DHCP lease and self-assigned a link-local address, so the problem "
            "lies with DHCP -- an exhausted scope, a failed relay agent, or a "
            "port assigned to the wrong VLAN. It is not cabling, because the "
            "link is up; not DNS, because the host has no working IP "
            "configuration to resolve names with; and not the application the "
            "user actually complained about."
        ),
    ]),

    ("A Second, Contrasting Case", [
        desc(
            "Compare a workstation with 192.168.11.5, mask 255.255.255.0 and "
            "gateway 192.168.11.1, which can ping its gateway successfully but "
            "nothing beyond it. Here Layer 2 and local Layer 3 are both "
            "demonstrably healthy: ARP resolved, frames are being forwarded, "
            "and the gateway is responding."
        ),
        desc(
            "The fault is therefore upstream -- the gateway's own connectivity, "
            "a routing problem beyond it, or a firewall rule. Two workstations "
            "with superficially similar complaints have entirely different "
            "causes, and reading the addresses correctly separated them in "
            "under a minute. That is what this lesson is for."
        ),
    ]),

    ("How This Lesson Is Examined", [
        desc(
            "TOPCIT questions on addressing fall into recognisable patterns, "
            "and the numeric facts are asked directly often enough to be worth "
            "memorising cold."
        ),
        ul([
            "Bit lengths: MAC 48, IPv4 32, IPv6 128, port 16",
            "MAC structure: 24-bit OUI identifying the manufacturer, 24-bit "
            "device identifier",
            "Reserved ranges: the three RFC 1918 blocks, 127.0.0.0/8 loopback, "
            "169.254.0.0/16 link-local",
            "Well-known port numbers for HTTP, HTTPS, SSH, DNS, SMTP and FTP",
            "IPv6 abbreviation, including why only one double colon is "
            "permitted",
            "ARP resolves IP to MAC; RARP resolves MAC to IP and was replaced "
            "by DHCP",
            "Which addresses change during a packet's journey and which do not",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Learn the bit lengths as a set -- they are the single most "
            "frequently asked fact in this topic",
            "The OUI is the UPPER 24 bits; a question about the manufacturer "
            "is asking about the first three octets",
            "Remember that a /24 gives 254 usable addresses, not 256",
            "Practise compressing and expanding IPv6 addresses until it is "
            "automatic",
            "IPv6 has no broadcast at all -- if an option mentions IPv6 "
            "broadcast, it is wrong",
            "A socket is address plus port; a connection is a pair of sockets",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Three addresses identify a message at once, answering which "
            "device, which host and which process",
            "A MAC address is 48 bits split into a 24-bit manufacturer OUI and "
            "a 24-bit device identifier, and it is trivially forgeable",
            "IPv4 splits into network and host portions, which is what makes "
            "internet-scale routing possible; classful addressing wasted the "
            "space and was abandoned",
            "Reserved ranges are diagnostic: 169.254 means DHCP failed, 127 "
            "means loopback, RFC 1918 means private",
            "IPv6 is 128 bits with two abbreviation rules, no broadcast, and "
            "an always-present link-local address",
            "A socket is an IP address plus a port; a connection is identified "
            "by the four-tuple, which is why one server port serves thousands "
            "of clients",
            "ARP maps IP to MAC on the local link, caches the result, and "
            "authenticates nothing",
        ]),
    ]),
]

_addr_quiz = [
    mcq("EASY",
        "How many bits are in a MAC address, and how are they divided?",
        [("48 bits: a 24-bit Organizationally Unique Identifier followed by a "
          "24-bit device identifier assigned by the manufacturer", True),
         ("32 bits: a 16-bit vendor identifier followed by a 16-bit device "
          "identifier", False),
         ("64 bits: a 32-bit vendor identifier followed by a 32-bit serial "
          "number", False),
         ("48 bits: a 16-bit vendor identifier followed by a 32-bit serial "
          "number", False)],
        "A MAC address is 48 bits, written as six hexadecimal octets. The "
        "upper 24 bits are the OUI, which the IEEE allocates to a "
        "manufacturer, and the lower 24 bits are assigned by that manufacturer "
        "to the individual interface -- giving each OUI 16.7 million "
        "addresses. 32 bits is the length of an IPv4 address; 64 bits is the "
        "interface identifier portion of an IPv6 address."),
    mcq("EASY",
        "A workstation reports the IPv4 address 169.254.14.207 and no default "
        "gateway.\n\nWhat does this most likely indicate?",
        [("The host requested a DHCP lease, received no response, and "
          "self-assigned a link-local address.", True),
         ("The host has been assigned a private address from the RFC 1918 "
          "range and is working normally.", False),
         ("The host is using loopback and all its traffic is staying "
          "internal.", False),
         ("The host has been given a public address by its ISP.", False)],
        "169.254.0.0/16 is the link-local range a host assigns itself when "
        "DHCP does not answer, so this points squarely at a DHCP failure -- an "
        "exhausted scope, a failed relay, or a wrong VLAN. The RFC 1918 "
        "private ranges are 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16; "
        "loopback is 127.0.0.0/8; and no ISP issues a link-local address."),
    mcq("AVERAGE",
        "Which of these is a valid abbreviation of the IPv6 address "
        "2001:0db8:0000:0000:0000:ff00:0042:8329?",
        [("2001:db8::ff00:42:8329", True),
         ("2001:db8::ff00::42:8329", False),
         ("2001:db8:0:0:0:ff00:42:8329::", False),
         ("21:db8::ff:42:8329", False)],
        "Leading zeroes within a group may be dropped and one run of "
        "consecutive zero groups may be replaced by a double colon, giving "
        "2001:db8::ff00:42:8329. The second option uses two double colons, "
        "which is invalid because the length of each zero run becomes "
        "ambiguous. The third appends a stray double colon to an already "
        "complete address. The fourth alters the digits themselves."),
    mcq("AVERAGE",
        "A server holds two simultaneous HTTPS connections from two different "
        "clients, both to port 443.\n\nWhat distinguishes the two connections "
        "in the server's transport layer?",
        [("The full four-tuple of source IP, source port, destination IP and "
          "destination port differs between them.", True),
         ("The server allocates a different destination port to each client "
          "after the handshake.", False),
         ("The two connections are distinguished by their MAC addresses.", False),
         ("The server can only hold one connection per port and must queue the "
          "second.", False)],
        "A connection is identified by the pair of sockets, that is by the "
        "four-tuple. The destination IP and port are identical for both "
        "clients, but the source IP or source port differs, so the tuples are "
        "distinct. The server does not reassign its listening port; MAC "
        "addresses are not visible to the transport layer; and a listening "
        "port supports many concurrent connections, which is the entire point "
        "of the design."),
    mcq("AVERAGE",
        "How many usable host addresses does a 192.168.10.0/24 subnet provide?",
        [("254", True), ("256", False), ("255", False), ("253", False)],
        "A /24 leaves 8 bits for hosts, giving 2^8 = 256 addresses. The "
        "all-zeroes host portion (192.168.10.0) names the network itself and "
        "the all-ones host portion (192.168.10.255) is the directed broadcast, "
        "so 254 remain assignable. Answering 256 forgets both reservations and "
        "255 forgets one of them."),
    mcq("AVERAGE",
        "Why is MAC address filtering considered a convenience rather than a "
        "security control?",
        [("MAC addresses travel in the clear and can be set in software, so an "
          "attacker observes an allowed address and copies it.", True),
         ("MAC addresses change every time a device reconnects to the "
          "network.", False),
         ("Switches cannot read MAC addresses at line rate for large "
          "filter lists.", False),
         ("MAC addresses are only visible to the manufacturer of the "
          "device.", False)],
        "Every frame carries its source MAC address unencrypted, so an "
        "attacker on the same segment simply observes a permitted address and "
        "reconfigures their own interface to match -- a single command on most "
        "systems. The address is burned in but not fixed, it is visible to "
        "everyone on the segment, and switch performance is not the "
        "limitation."),
    mcq("HARD",
        "A host sends a packet to a server on a different network. Which pair "
        "of addresses appears in the very first frame that leaves the host's "
        "interface?",
        [("Destination MAC of the default gateway, destination IP of the "
          "server", True),
         ("Destination MAC of the server, destination IP of the server", False),
         ("Destination MAC of the default gateway, destination IP of the "
          "default gateway", False),
         ("Destination MAC of the server, destination IP of the default "
          "gateway", False)],
        "The IP header always carries the ultimate destination, because that "
        "is what routers along the path need in order to forward it and what "
        "the server needs in order to reply. The frame header carries only the "
        "next device on this link, which for a remote destination is the "
        "default gateway. Putting the server's MAC address in the frame would "
        "be meaningless -- it is not on this segment and no switch here has "
        "ever seen it."),
    mcq("HARD",
        "Why does ARP have no authentication, and what attack does this "
        "enable?",
        [("It was designed for a trusted local network and never revised, "
          "which allows ARP spoofing -- an attacker claims the gateway's "
          "address to intercept traffic.", True),
         ("Authentication was removed to reduce broadcast traffic on large "
          "segments.", False),
         ("ARP authenticates using the OUI, which attackers cannot "
          "forge.", False),
         ("ARP requires no authentication because replies are only accepted "
          "from the default gateway.", False)],
        "ARP dates from an era when everyone on a segment was trusted, and any "
        "host may reply to any request or send unsolicited replies claiming "
        "any address. An attacker claiming to hold the gateway's IP address "
        "receives traffic intended for it, which is ARP spoofing. Defence "
        "relies on switch features such as dynamic ARP inspection rather than "
        "on the protocol. The OUI is forgeable and replies are accepted from "
        "anyone."),
    short_answer("EASY",
        "What is the well-known TCP port number for HTTPS?",
        "443",
        ["443", "port 443", "tcp 443"]),
    short_answer("AVERAGE",
        "What term describes an IP address combined with a port number?",
        "Socket",
        ["socket", "a socket", "socket address"]),
    descriptive("HARD",
        "A packet crosses four routers on its way from a client to a server. "
        "Explain which addresses in the packet change during the journey and "
        "which do not, and say why the design works that way.",
        "The source and destination IP addresses in the network layer header "
        "remain unchanged from the client to the server, as do the source and "
        "destination port numbers in the transport header. The source and "
        "destination MAC addresses in the data link header are rewritten on "
        "every link: each router strips the incoming frame entirely, decides "
        "the next hop from its routing table, and builds a new frame whose "
        "destination MAC is that next hop's interface and whose source MAC is "
        "its own outgoing interface. The design works this way because the two "
        "addresses answer different questions. The IP address identifies an "
        "endpoint and must survive end to end, both so that intermediate "
        "routers can make forwarding decisions toward the final destination "
        "and so that the server knows where to send its reply -- rewriting it "
        "at each hop would destroy that. The MAC address identifies only the "
        "next device on the current physical segment and is meaningless one "
        "hop further on, since no switch beyond that segment holds any record "
        "of it; it must therefore be replaced for each link the packet "
        "traverses. Port numbers, like IP addresses, remain fixed because they "
        "identify the communicating processes rather than anything about the "
        "path. The one common exception is network address translation, where "
        "a device at the boundary deliberately rewrites the source IP address "
        "and often the source port so that private addresses can reach the "
        "public internet.",
        [("States that IP addresses and ports stay constant end to end", 3),
         ("States that MAC addresses are rewritten at every hop and explains "
          "the router rebuilding the frame", 3),
         ("Explains the reason in terms of link-local versus end-to-end "
          "scope", 4)]),
]

LESSON_ADDRESSING = {
    "middle": MID_FUNDAMENTALS,
    "name": "Internet Address Structure: MAC, IP, and Port Numbers",
    "quiz": _addr_quiz,
    "structure": lesson_structure(
        "Internet Address Structure: MAC, IP, and Port Numbers",
        "Networking uses three addresses at once, and almost every confusing "
        "thing about packet forwarding comes from mixing them up. This lesson "
        "separates them properly and then shows how they cooperate. You will "
        "learn the structure of a MAC address and what its manufacturer OUI "
        "tells you diagnostically, why a MAC address is an identifier rather "
        "than an authenticator, how an IPv4 address splits into network and "
        "host portions and why the old class system had to be abandoned, which "
        "reserved ranges instantly identify a fault, how IPv6's 128 bits are "
        "written and what else the redesign fixed, what a port number "
        "identifies and how the four-tuple lets one server port serve "
        "thousands of clients, and how ARP stitches Layer 3 to Layer 2 while "
        "authenticating nothing at all.",
        [
            "Distinguish MAC, IP and port addressing by layer, scope and "
            "lifetime, and say which changes during a packet's journey",
            "Describe the 48-bit MAC address structure, including the OUI, the "
            "individual/group and universal/local bits, and the unicast, "
            "multicast and broadcast forms",
            "Explain why MAC-based access control is not a security control",
            "Explain the network and host portions of an IPv4 address and the "
            "specific reasons classful addressing failed",
            "Identify the private, loopback, link-local, network and broadcast "
            "ranges and diagnose a fault from an address alone",
            "Write and abbreviate IPv6 addresses correctly, name the main "
            "address types, and state what the redesign fixed beyond address "
            "length",
            "Explain port ranges, sockets and the four-tuple that identifies a "
            "connection",
            "Describe ARP, its cache behaviour, its lack of authentication, "
            "and the role RARP played before DHCP",
        ],
        60,
        _addr_sections,
        [
            ("MAC address",
             "A 48-bit hardware address identifying a network interface on a "
             "local link, split into a 24-bit OUI and a 24-bit device "
             "identifier. Forgeable in software."),
            ("OUI (Organizationally Unique Identifier)",
             "The upper 24 bits of a MAC address, allocated by the IEEE to a "
             "manufacturer, and a useful diagnostic for identifying unexpected "
             "equipment."),
            ("Individual/group and universal/local bits",
             "Two bits in the first octet marking unicast versus multicast, "
             "and IEEE-administered versus locally assigned."),
            ("IPv4 address",
             "A 32-bit logical address written as four decimal octets, divided "
             "into a network portion and a host portion."),
            ("Classful addressing",
             "The historical scheme fixing the network/host boundary by "
             "address class, abandoned because it offered only three network "
             "sizes and wasted the address space."),
            ("Private address (RFC 1918)",
             "An address from 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16, "
             "usable internally but dropped by internet routers."),
            ("Link-local address",
             "169.254.0.0/16 in IPv4 and fe80::/10 in IPv6. In IPv4 its "
             "presence normally signals that DHCP failed; in IPv6 it is always "
             "present."),
            ("Port number",
             "A 16-bit process identifier at the transport layer, divided into "
             "well-known (0-1023), registered (1024-49151) and dynamic "
             "(49152-65535) ranges."),
            ("Socket",
             "An IP address and port number together. A connection is "
             "identified by a pair of sockets -- the four-tuple."),
            ("ARP",
             "The Address Resolution Protocol, discovering the MAC address "
             "matching a known IPv4 address on the local link. Cached, and "
             "entirely unauthenticated."),
            ("ARP spoofing",
             "An attack exploiting ARP's lack of authentication, in which a "
             "host claims another's address to intercept traffic."),
            ("RARP",
             "The reverse of ARP, resolving MAC to IP for diskless "
             "workstations. Superseded by BOOTP and then DHCP."),
        ],
        "MAC, IP and port numbers answer three different questions -- which "
        "device on this link, which host on the internet, and which process on "
        "that host -- at three different layers with three different scopes "
        "and lifetimes. MAC addresses are 48 bits with a manufacturer OUI in "
        "the upper half, are rewritten at every hop, and are forgeable with a "
        "single command, which is why filtering on them secures nothing. IPv4 "
        "addresses are 32 bits split into network and host portions, and the "
        "class system that once fixed that split offered only three network "
        "sizes and had to be abandoned. Several reserved ranges are "
        "diagnostic on sight: 169.254 means DHCP never answered, 127 means "
        "loopback, and the RFC 1918 blocks mean the host is behind NAT. IPv6 "
        "raises the address to 128 bits with strict abbreviation rules, "
        "removes broadcast entirely, and fixes several header and "
        "autoconfiguration problems along the way. Port numbers identify the "
        "process, an address with a port is a socket, and a connection is a "
        "pair of sockets -- which is how one server port serves thousands of "
        "clients simultaneously. ARP is the hinge between the IP world and the "
        "MAC world, and understanding both what it does and what it fails to "
        "check is what makes packet forwarding finally make sense."),
}

LESSONS = [LESSON_ADDRESSING]
