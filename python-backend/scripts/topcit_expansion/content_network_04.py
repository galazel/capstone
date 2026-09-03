"""Understanding of Network -> Network Protocols and Services (MID 121).

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
most sections carrying more than one block, and no coloured card grids.

Written against TOPCIT ESSENCE Network (Technical Field 03, Ver.2), sections
"05 Routing Protocols and Algorithms", "06 Outline of IPv4" and "07 IPv4
Addressing and Subnetting".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_PROTOCOLS = 121

SUBNET_DIAGRAM = "/lesson-media/subnet-mask.svg"
MASK_DIAGRAM = "/lesson-media/cidr-block-sizes.svg"
ROUTING_DIAGRAM = "/lesson-media/distance-vector.svg"
OSPF_DIAGRAM = "/lesson-media/link-state-areas.svg"
# ===========================================================================
# IPv4 Addressing, Subnetting, and CIDR
# ===========================================================================

_sub_sections = [
    ("Why an Address Alone Is Not Enough", [
        desc(
            "An IPv4 address on its own is ambiguous. 192.168.10.37 does not "
            "say where the network part ends and the host part begins, and "
            "without that boundary a host cannot answer the one question it "
            "must answer before sending anything at all: is my destination on "
            "my own network, or does this packet have to go to the router?"
        ),
        desc(
            "Every packet a host sends begins with that decision. If the "
            "destination is local, the host resolves its MAC address by ARP "
            "and sends the frame directly. If it is remote, the host addresses "
            "the frame to its default gateway instead. The subnet mask is what "
            "makes the decision possible, which is why it is configured "
            "alongside every address and why a wrong mask produces such "
            "confusing symptoms."
        ),
    ]),

    ("What a Wrong Mask Looks Like", [
        desc(
            "It is worth seeing the failure mode, because it appears in "
            "practice and in exams. A host configured with too narrow a mask "
            "believes hosts on its own subnet are remote, and sends traffic "
            "for them to the gateway -- which may still work, slowly and "
            "oddly, or may fail entirely."
        ),
        desc(
            "A host configured with too wide a mask believes remote hosts are "
            "local, ARPs for them, receives no reply, and simply cannot reach "
            "them. The symptom is that some destinations work and others do "
            "not, with no obvious pattern until you compare each destination "
            "against the mask."
        ),
    ]),

    ("The Subnet Mask", [
        desc(
            "The mask is another 32 bits carried alongside the address. Every "
            "bit set to 1 marks a bit of the address belonging to the network; "
            "every bit set to 0 marks a bit belonging to the host. The ones "
            "are always contiguous and always leading, so a mask never has "
            "gaps -- 255.255.0.255 is not a legal mask."
        ),
        desc(
            "Because the ones are contiguous, the whole mask can be summarised "
            "by a single number: how many leading ones it has. That count is "
            "the prefix length, written after a slash. 255.255.255.0 has 24 "
            "leading ones and is therefore a /24. Fluency in both notations is "
            "a basic requirement, since an exam will hand you one and expect "
            "you to work in the other."
        ),
        image(MASK_DIAGRAM),
    ]),

    ("Reading the Mask Octet by Octet", [
        desc(
            "Only nine values can legally appear in a mask octet, because the "
            "ones must be contiguous. Memorising them converts most mask "
            "questions from arithmetic into recall, and it is the single "
            "highest-value memorisation in this lesson."
        ),
        ul([
            "0 = 00000000, no network bits in this octet",
            "128 = 10000000, one network bit",
            "192 = 11000000, two network bits",
            "224 = 11100000, three network bits",
            "240 = 11110000, four network bits",
            "248 = 11111000, five network bits",
            "252 = 11111100, six network bits",
            "254 = 11111110, seven network bits",
            "255 = 11111111, all eight network bits",
        ]),
        desc(
            "Notice the pattern: each value is the previous one plus the next "
            "power of two downward -- 128, then 128+64=192, then 192+32=224, "
            "and so on. If you forget the list you can reconstruct it in a few "
            "seconds from that rule."
        ),
    ]),

    ("Four Prefixes Worth Knowing Cold", [
        tabs([
            ("/24", "255.255.255.0 - a /24",
             "24 network bits, 8 host bits. 256 addresses, 254 usable. The "
             "familiar size of a small office network or a home LAN. In binary "
             "the mask reads 11111111.11111111.11111111.00000000, and the "
             "whole fourth octet is available for hosts."),
            ("/25", "255.255.255.128 - a /25",
             "25 network bits, 7 host bits. 128 addresses, 126 usable. This is "
             "a /24 split exactly in half. The final octet is 128 because only "
             "the leftmost bit of that octet has become a network bit."),
            ("/26", "255.255.255.192 - a /26",
             "26 network bits, 6 host bits. 64 addresses, 62 usable. A /24 "
             "divided into four. The final octet is 192 because the two "
             "leftmost bits are network bits: 128 + 64 = 192."),
            ("/30", "255.255.255.252 - a /30",
             "30 network bits, 2 host bits. 4 addresses, 2 usable. The classic "
             "point-to-point link between two routers, where exactly two "
             "addresses are needed and a larger block would waste the rest."),
        ]),
    ]),

    ("The Three Formulas", [
        desc(
            "Almost every subnetting question reduces to three quantities, and "
            "all three follow from a single number: h, the count of host bits, "
            "which is 32 minus the prefix length."
        ),
        ol([
            "Total addresses in the subnet = 2 to the power of h",
            "Usable host addresses = 2^h minus 2, because the all-zeroes host "
            "portion names the network and the all-ones host portion is the "
            "broadcast address",
            "Block size = 2^h as well, which is the interval at which "
            "successive subnets of that size begin",
        ]),
        desc(
            "The third is the same number as the first, which sounds redundant "
            "and is the key to answering questions quickly. Once you know a "
            "subnet holds 64 addresses, you also know that subnets of that "
            "size start at multiples of 64 -- and that fact alone answers most "
            "questions without any binary conversion."
        ),
    ]),

    ("The Block Size Shortcut", [
        desc(
            "For a /26 the block size is 64, so the subnets of "
            "192.168.10.0/24 begin at 192.168.10.0, .64, .128 and .192 -- and "
            "nowhere else. There are no other legal starting points for a /26 "
            "inside that range."
        ),
        desc(
            "Any address therefore falls into whichever block it lands in. "
            "192.168.10.100 sits between 64 and 128, so its network address is "
            "192.168.10.64, its broadcast address is 192.168.10.127, and its "
            "usable range is .65 through .126. That is the entire method: find "
            "the block size, count up in blocks until you pass the address, "
            "and step back one."
        ),
        image(SUBNET_DIAGRAM),
    ]),

    ("Practising the Shortcut", [
        desc(
            "Work these through mentally before reading the answers. Given "
            "172.16.5.130 with mask 255.255.255.192, what is the network "
            "address? The mask is a /26, block size 64, so the boundaries are "
            "0, 64, 128 and 192; 130 falls in the block starting at 128, so "
            "the network is 172.16.5.128 and the broadcast is 172.16.5.191."
        ),
        desc(
            "Given 10.4.9.200 with mask 255.255.255.224? That is a /27, block "
            "size 32, so boundaries fall at 0, 32, 64, 96, 128, 160, 192 and "
            "224; 200 falls in the block starting at 192, so the network is "
            "10.4.9.192, the broadcast is 10.4.9.223, and the usable range is "
            ".193 to .222. With practice this takes about five seconds and no "
            "paper."
        ),
    ]),

    ("Worked Example: Four Departments in One /24", [
        desc(
            "An organisation holds 192.168.10.0/24 and needs four subnets, one "
            "per department, each with room for about 50 hosts."
        ),
        desc(
            "Four subnets requires two extra network bits, since 2 squared is "
            "4, taking the prefix from /24 to /26. Six host bits then remain, "
            "giving 62 usable addresses per subnet -- comfortably above 50, "
            "where the next size down (/27, 30 hosts) would be far too small. "
            "Always check the host requirement as well as the subnet count, "
            "because the two constraints can conflict."
        ),
    ]),

    ("The Four Subnets in Full", [
        desc(
            "Block size is 64, so each subnet begins 64 addresses after the "
            "last, and each loses two addresses to its own network and "
            "broadcast entries."
        ),
        ul([
            "192.168.10.0/26 -- network .0, usable .1 to .62, broadcast .63",
            "192.168.10.64/26 -- network .64, usable .65 to .126, broadcast "
            ".127",
            "192.168.10.128/26 -- network .128, usable .129 to .190, broadcast "
            ".191",
            "192.168.10.192/26 -- network .192, usable .193 to .254, broadcast "
            ".255",
        ]),
        desc(
            "Notice that the last subnet's broadcast address is the same "
            "address that was the whole /24's broadcast, and the first "
            "subnet's network address is the /24's network address. That is "
            "expected rather than a coincidence: subnetting subdivides a range "
            "and does not extend it."
        ),
    ]),

    ("CIDR: Dropping the Classes", [
        desc(
            "Classless Inter-Domain Routing, introduced in 1993, abolished the "
            "fixed class boundaries entirely. Under CIDR the prefix length "
            "travels with the address, so any boundary is legal and an "
            "allocation can be sized to what an organisation actually needs "
            "rather than rounded up to the next class."
        ),
        desc(
            "An organisation needing 300 addresses takes a /23 -- 510 usable "
            "-- instead of a Class B with 65,534 and 65,000 of them wasted. "
            "Multiplied across every allocation made since, this single change "
            "is what kept IPv4 usable for another three decades rather than "
            "exhausting it in the 1990s as had been projected."
        ),
    ]),

    ("Route Aggregation", [
        desc(
            "CIDR does a second, less obvious job that matters just as much. "
            "If a provider holds 203.0.112.0/24 through 203.0.115.0/24 -- four "
            "consecutive /24s -- it can advertise all of them to the rest of "
            "the internet as a single 203.0.112.0/22."
        ),
        desc(
            "Four routing table entries become one. Multiplied across the "
            "whole internet, this aggregation is what keeps the global routing "
            "table at a size routers can physically hold. Without it, every "
            "small allocation would need its own entry and the table would "
            "have grown beyond what router memory could accommodate years ago."
        ),
    ]),

    ("When Aggregation Works and When It Does Not", [
        ul([
            "The blocks must be contiguous: a gap in the middle means the "
            "summary would cover addresses the provider does not hold",
            "The range must be correctly aligned: four consecutive /24s "
            "summarise into a /22 only if the first of them starts on a /22 "
            "boundary -- 203.0.113.0 through 203.0.116.0 cannot be summarised, "
            "despite being four consecutive /24s",
            "The summarising prefix is SHORTER than the prefixes it replaces "
            "-- fewer network bits, covering more addresses",
            "Aggregation is why address allocation is hierarchical: registries "
            "hand providers large aligned blocks precisely so the providers "
            "can summarise them again",
        ]),
    ]),

    ("Subnetting and Supernetting Are One Operation", [
        desc(
            "It helps considerably to see these as a single idea moving in two "
            "directions. Subnetting borrows bits from the host portion and "
            "LENGTHENS the prefix, producing more networks each with fewer "
            "hosts. Supernetting -- aggregation -- gives bits back and "
            "SHORTENS the prefix, producing one network covering what were "
            "several."
        ),
        desc(
            "Every question about either is really a question about which way "
            "the prefix moved and by how many bits. Moving the prefix by one "
            "bit doubles or halves the number of networks and halves or "
            "doubles their size, and that relationship is worth being able to "
            "state without thinking."
        ),
    ]),

    ("VLSM: Different Sizes in One Space", [
        desc(
            "Fixed-length subnetting gives every subnet the same size, which "
            "wastes addresses whenever the subnets have genuinely different "
            "populations -- and they always do. A point-to-point router link "
            "needs two addresses and a floor of staff needs two hundred, and "
            "sizing both the same is either wasteful or inadequate."
        ),
        desc(
            "Variable Length Subnet Masking allows different prefix lengths "
            "within the same address space, so each subnet is sized to its "
            "real requirement. It is what makes efficient address planning "
            "possible, and it is examined through worked problems rather than "
            "definitions."
        ),
    ]),

    ("The VLSM Method", [
        ol([
            "List every subnet requirement with its host count, remembering to "
            "include the router interface in each count",
            "Sort the list from largest to smallest",
            "Give the largest requirement the block it needs, starting at the "
            "beginning of the address space",
            "Place each subsequent requirement in the next free block that is "
            "correctly aligned for its own size",
            "Finish with the point-to-point links, which take /30s at the end",
        ]),
    ]),

    ("Why Largest-First Is Not Optional", [
        desc(
            "Allocating largest first is not a stylistic preference or a "
            "convention. Every subnet must begin at an address that is a "
            "multiple of its own block size, so within a /24 a /25 can only "
            "start at .0 or .128 -- there are exactly two legal positions."
        ),
        desc(
            "Scatter small blocks through the space first and both of those "
            "boundaries are occupied, leaving the /25 homeless and the plan "
            "requiring a complete restart. This is the single most common "
            "reason a VLSM answer is marked wrong, and it is entirely "
            "avoidable by sorting the requirements before starting."
        ),
    ]),

    ("Public and Private Address Space", [
        desc(
            "Public addresses are globally unique and routable on the "
            "internet. Private addresses -- 10.0.0.0/8, 172.16.0.0/12 and "
            "192.168.0.0/16, defined by RFC 1918 -- are reusable inside any "
            "organisation and are dropped by internet routers."
        ),
        desc(
            "This is why millions of separate networks all use 192.168.1.0/24 "
            "simultaneously without conflict: none of them is visible to the "
            "others, because no router on the public internet will carry a "
            "packet addressed to one. The three ranges are of deliberately "
            "different sizes so that organisations of different scales can "
            "each find one that fits."
        ),
    ]),

    ("NAT and Port Address Translation", [
        desc(
            "A private host still needs to reach the outside world, so a "
            "device at the boundary performs Network Address Translation. It "
            "rewrites the private source address to a public one on the way "
            "out, and remembers the mapping so that replies can be returned to "
            "the correct internal host."
        ),
        desc(
            "The common form is port address translation, in which many "
            "internal hosts share a single public address and are "
            "distinguished by the source port the translator assigns to each "
            "conversation. This is why an entire household appears to the "
            "internet as one address, and it is what stretched the IPv4 "
            "address space far beyond its nominal capacity."
        ),
    ]),

    ("What NAT Costs", [
        ul([
            "Inbound connections have no existing mapping to match, so a "
            "server behind NAT requires explicit port forwarding configured in "
            "advance",
            "Protocols carrying addresses inside their own payload -- FTP in "
            "active mode, SIP -- break unless the translator inspects and "
            "rewrites the payload too",
            "End-to-end transparency is lost, which complicates peer-to-peer "
            "applications and requires techniques such as STUN to work around",
            "Troubleshooting is harder, because logs on the outside show the "
            "translator's address rather than the host that actually acted",
            "It conserves addresses and secures nothing, though it is "
            "frequently mistaken for a security control",
        ]),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Forgetting to subtract the network and broadcast addresses",
             "A /28 has 16 addresses but 14 usable ones. This off-by-two is "
             "the most frequent subnetting error there is, and examiners set "
             "it up deliberately by offering both numbers as options."),
            ("Choosing a subnet one host too small",
             "A department of 30 hosts does not fit in a /27, which gives "
             "exactly 30 usable addresses, once the router's own interface "
             "address is counted. Always add the gateway to the host count "
             "before choosing a prefix."),
            ("Allocating small VLSM blocks first",
             "Largest first, always. Starting with the /30 links fragments the "
             "space and leaves no correctly aligned room for the large "
             "subnets, forcing a restart."),
            ("Trying to summarise a non-aligned range",
             "Aggregation requires the block to start on a boundary of the "
             "summary prefix. Four consecutive /24s summarise into a /22 only "
             "if the first sits on a /22 boundary."),
            ("Treating NAT as a security control",
             "It obscures internal addressing as a side effect, but it is an "
             "address conservation mechanism. A firewall enforces policy; NAT "
             "does not, and relying on it is how internal services end up "
             "exposed by a single port-forward rule."),
            ("Confusing the prefix direction",
             "A longer prefix means MORE network bits and a SMALLER network. "
             "Learners frequently reverse this because a bigger number "
             "intuitively suggests a bigger network."),
        ]),
    ]),

    ("Practical Example: A Three-Site Company", [
        desc(
            "A company holds 172.16.0.0/16 and has a head office of 500 hosts, "
            "two branches of 120 hosts each, and three point-to-point WAN "
            "links between them. Working largest first: 500 hosts needs 9 host "
            "bits, since 2^9 - 2 = 510 while 2^8 - 2 = 254 is insufficient."
        ),
        desc(
            "Nine host bits means a /23, so the head office takes "
            "172.16.0.0/23, covering 172.16.0.0 through 172.16.1.255. Note "
            "that a /23 spans two whole third-octet values, which is the first "
            "point at which the arithmetic stops being confined to the last "
            "octet."
        ),
    ]),

    ("The Completed Address Plan", [
        ol([
            "Head office, 500 hosts: 172.16.0.0/23 -- 510 usable",
            "Branch A, 120 hosts: 172.16.2.0/25 -- 126 usable",
            "Branch B, 120 hosts: 172.16.2.128/25 -- 126 usable",
            "WAN link 1: 172.16.3.0/30 -- 2 usable",
            "WAN link 2: 172.16.3.4/30 -- 2 usable",
            "WAN link 3: 172.16.3.8/30 -- 2 usable",
        ]),
        desc(
            "The whole design consumes barely more than 172.16.0.0/22 and "
            "leaves the rest of the /16 free for growth. Under fixed-length "
            "subnetting, sizing every subnet to fit the head office would have "
            "consumed six /23s and wasted roughly 3,000 addresses on links "
            "needing two apiece. That contrast is the argument for VLSM in a "
            "single figure."
        ),
    ]),

    ("Relationships Between the Concepts", [
        desc(
            "These ideas are usually taught as a list of separate techniques, "
            "and they are actually a chain. The mask defines the boundary; the "
            "boundary determines the host bit count; the host bit count gives "
            "the block size; the block size determines where subnets may "
            "legally begin; and that alignment constraint is what forces VLSM "
            "to allocate largest first and what decides whether a set of "
            "prefixes can be aggregated."
        ),
        desc(
            "If you can state that chain from memory, you can reconstruct "
            "every formula in this lesson from the mask alone, which is far "
            "more robust under exam pressure than remembering five separate "
            "rules."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Given an address and mask, produce the network address, broadcast "
            "address and usable range",
            "Given a host requirement, choose the correct prefix",
            "Given a prefix, state the number of usable hosts -- watch for the "
            "minus two",
            "Convert between dotted decimal masks and slash notation",
            "Summarise a set of contiguous prefixes, or explain why they "
            "cannot be summarised",
            "Produce a VLSM plan for several requirements of different sizes",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Memorise the mask octets 128, 192, 224, 240, 248, 252, 254, 255 "
            "-- they correspond to 1 through 8 network bits",
            "Usable hosts is always 2^(32 minus prefix) minus 2",
            "Block size equals the number of addresses, and subnets start at "
            "multiples of it",
            "For VLSM, sort largest to smallest before allocating anything",
            "A /30 is the standard point-to-point link; /31 exists for that "
            "purpose too but is a special case",
            "Aggregation shortens the prefix; subnetting lengthens it",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "The subnet mask marks the boundary between network and host "
            "portions, and a wrong mask makes some destinations unreachable "
            "with no obvious pattern",
            "Total addresses is 2^h, usable is 2^h minus 2, and block size "
            "equals total addresses -- which is the shortcut that removes the "
            "binary arithmetic",
            "CIDR removed fixed classes, enabling both right-sized allocation "
            "and route aggregation, and it is why IPv4 survived",
            "Aggregation requires contiguous AND correctly aligned blocks",
            "VLSM sizes each subnet to its real population and requires "
            "largest-first allocation because of block alignment",
            "Private addressing plus NAT stretched the address space "
            "enormously, at a real cost in transparency -- and NAT is not a "
            "security control",
        ]),
    ]),
]

_sub_quiz = [
    mcq("EASY",
        "A single /24 is divided entirely into /28 subnets.\n\nHow many "
        "subnets result, and how many usable hosts does each hold?",
        [("16 subnets of 14 usable hosts each", True),
         ("14 subnets of 16 usable hosts each", False),
         ("8 subnets of 30 usable hosts each", False),
         ("16 subnets of 16 usable hosts each", False)],
        "Moving from /24 to /28 borrows 4 bits, so 2^4 = 16 subnets are "
        "created. Each has 4 host bits remaining, giving 16 addresses of which "
        "the network and broadcast addresses are unusable, so 14 hosts fit. "
        "The second option swaps the two figures, the third describes a split "
        "into /27s, and the fourth forgets the two reserved addresses."),
    mcq("EASY",
        "Which subnet mask is equivalent to a /26 prefix?",
        [("255.255.255.192", True), ("255.255.255.224", False),
         ("255.255.255.128", False), ("255.255.192.0", False)],
        "A /26 has 26 leading one bits: the first three octets are all ones "
        "(24 bits) and the fourth octet begins with two ones, which is "
        "128 + 64 = 192. 224 corresponds to /27, 128 to /25, and "
        "255.255.192.0 to /18."),
    mcq("AVERAGE",
        "A host is configured as 192.168.10.100 with mask "
        "255.255.255.192.\n\nWhat are its network address and broadcast "
        "address?",
        [("Network 192.168.10.64, broadcast 192.168.10.127", True),
         ("Network 192.168.10.0, broadcast 192.168.10.255", False),
         ("Network 192.168.10.96, broadcast 192.168.10.159", False),
         ("Network 192.168.10.100, broadcast 192.168.10.191", False)],
        "The mask is a /26, so the block size is 64 and subnets begin at 0, "
        "64, 128 and 192. The address 100 falls in the block starting at 64, "
        "which runs to 127. The second option applies a /24 boundary, the "
        "third uses a block size of 32 that does not match the mask, and the "
        "fourth mistakes the host's own address for the network address."),
    mcq("AVERAGE",
        "An administrator must divide 10.20.30.0/24 into subnets supporting at "
        "least 50 hosts each, using as many subnets as possible.\n\nWhich "
        "prefix should be used?",
        [("/26, giving four subnets of 62 usable addresses", True),
         ("/25, giving two subnets of 126 usable addresses", False),
         ("/27, giving eight subnets of 30 usable addresses", False),
         ("/28, giving sixteen subnets of 14 usable addresses", False)],
        "Fifty hosts requires 6 host bits, since 2^6 - 2 = 62 while 2^5 - 2 = "
        "30 is insufficient. Six host bits means a /26, dividing the /24 into "
        "four subnets -- the largest number of subnets that still meets the "
        "50-host requirement. A /25 meets the requirement but yields fewer "
        "subnets, and /27 and /28 are both too small."),
    mcq("AVERAGE",
        "A host is configured with address 172.16.5.10 and mask "
        "255.255.255.0, but the network actually uses a /22. It can reach some "
        "hosts and not others.\n\nWhy?",
        [("Its mask is too narrow, so it treats hosts that are actually local "
          "as remote and sends their traffic to the gateway.", True),
         ("Its mask is too wide, so it ARPs for remote hosts and receives no "
          "reply.", False),
         ("The mask is irrelevant to reachability; the fault must be in the "
          "gateway configuration.", False),
         ("A /24 mask on a /22 network is invalid and the interface would "
          "fail to initialise.", False)],
        "A /24 is narrower than the /22 actually in use, so the host considers "
        "only 172.16.5.x to be local. Hosts at 172.16.4.x or 172.16.6.x are "
        "genuinely on the same network but the host sends their traffic to the "
        "gateway -- which may or may not work depending on the gateway's "
        "configuration, producing the patchy symptom. The too-wide case is the "
        "opposite error, and a mismatched mask configures perfectly well; it "
        "just behaves wrongly."),
    mcq("AVERAGE",
        "Why is a /30 the conventional prefix for a link between two routers?",
        [("It provides exactly two usable addresses, one for each router "
          "interface, wasting nothing.", True),
         ("It is the smallest prefix that still allows a broadcast address to "
          "be omitted.", False),
         ("Routing protocols require at least four host bits on a "
          "point-to-point link.", False),
         ("It reserves spare addresses so a third router can be added "
          "later.", False)],
        "A /30 has 2 host bits: four addresses, of which the network and "
        "broadcast addresses take two, leaving exactly the two needed. Nothing "
        "about it omits the broadcast address -- it still has one. Routing "
        "protocols impose no host-bit minimum, and a /30 has no spare capacity "
        "at all, which is precisely why it is chosen."),
    mcq("HARD",
        "An ISP holds 203.0.112.0/24, 203.0.113.0/24, 203.0.114.0/24 and "
        "203.0.115.0/24.\n\nWhat single prefix summarises all four, and what "
        "is the benefit?",
        [("203.0.112.0/22, which replaces four routing table entries with "
          "one", True),
         ("203.0.112.0/26, which replaces four routing table entries with "
          "one", False),
         ("203.0.112.0/24, which is already sufficient to cover all four", False),
         ("They cannot be summarised, because each /24 must be advertised "
          "separately", False)],
        "Four consecutive /24s starting on a correctly aligned boundary "
        "combine into a /22: shortening the prefix by two bits quadruples the "
        "covered range. This is route aggregation, and it is what keeps the "
        "global routing table manageable. A /26 is longer than a /24 and "
        "covers less, not more; a single /24 covers only the first block; and "
        "aggregation is possible here because 203.0.112.0 sits on a /22 "
        "boundary."),
    mcq("HARD",
        "When applying VLSM to a single address block, why must the largest "
        "subnet be allocated first?",
        [("A subnet must start on a boundary that is a multiple of its own "
          "block size, and allocating small blocks first leaves no such "
          "boundary free for the large ones.", True),
         ("Routing protocols process longer prefixes before shorter ones, so "
          "the order of allocation must match.", False),
         ("The network address of the whole block must belong to the largest "
          "subnet.", False),
         ("Smaller subnets cannot be created once any subnet has been "
          "defined.", False)],
        "Every subnet must begin at an address that is a multiple of its block "
        "size -- within a /24 a /25 has exactly two legal starting points. If "
        "small blocks are scattered through the space first, those boundaries "
        "are already occupied and the plan must be redone. Routing protocol "
        "processing order is irrelevant to address planning, the largest "
        "subnet need not contain the block's network address, and small "
        "subnets can be added at any time provided alignment holds."),
    short_answer("EASY",
        "What is the prefix length equivalent to the subnet mask "
        "255.255.255.240?",
        "/28",
        ["/28", "28", "28 bits", "slash 28"]),
    short_answer("AVERAGE",
        "What is the name of the technique that allows subnets of different "
        "sizes within a single address block? Give the acronym or the full "
        "term.",
        "VLSM",
        ["vlsm", "variable length subnet masking", "variable length subnet "
         "mask", "variable-length subnet masking"]),
    descriptive("HARD",
        "A company holds 192.168.50.0/24 and needs a subnet for 100 hosts, a "
        "subnet for 50 hosts, a subnet for 25 hosts, and two point-to-point "
        "router links. Produce an addressing plan and justify the order in "
        "which you allocated it.",
        "Allocate largest first so that each subnet starts on a boundary that "
        "is a multiple of its own block size. The 100-host subnet needs 7 host "
        "bits, since 2^7 - 2 = 126 while 2^6 - 2 = 62 is insufficient, so it "
        "takes 192.168.50.0/25, covering .0 to .127. The 50-host subnet needs "
        "6 host bits (62 usable) and takes the next correctly aligned block, "
        "192.168.50.128/26, covering .128 to .191. The 25-host subnet needs 5 "
        "host bits (30 usable) and takes 192.168.50.192/27, covering .192 to "
        ".223. The two point-to-point links take /30s, giving exactly two "
        "usable addresses each: 192.168.50.224/30 and 192.168.50.228/30. That "
        "leaves 192.168.50.232 through .255 unallocated and available for "
        "growth. The order matters because a /25 has a block size of 128 and "
        "can therefore only begin at .0 or .128 -- there are exactly two legal "
        "positions within the /24. Had the /30 links been allocated at the "
        "start of the space, one of those boundaries would already be "
        "occupied, no contiguous 128-address block correctly aligned for a /25 "
        "would remain, and the whole plan would have to be restarted. Sorting "
        "requirements from largest to smallest before allocating anything "
        "avoids this entirely, and it is the single discipline that "
        "distinguishes a correct VLSM answer from an incorrect one.",
        [("Correct prefix chosen for each host requirement", 4),
         ("Subnets correctly aligned and non-overlapping", 3),
         ("Justifies largest-first allocation in terms of block alignment", 3)]),
]

LESSON_SUBNETTING = {
    "middle": MID_PROTOCOLS,
    "name": "IPv4 Addressing, Subnetting, and CIDR",
    "quiz": _sub_quiz,
    "structure": lesson_structure(
        "IPv4 Addressing, Subnetting, and CIDR",
        "Subnetting is the most reliably examined skill in the whole Network "
        "module, and it is a skill rather than a fact -- it has to be "
        "practised until the arithmetic is automatic. This lesson builds it "
        "from the subnet mask up: what the mask does and what a wrong one "
        "looks like in practice, the nine values a mask octet can legally "
        "hold, the three formulas that follow from the prefix length, the "
        "block-size shortcut that removes binary conversion entirely, how CIDR "
        "abolished the address classes and enabled route aggregation, and how "
        "VLSM sizes each subnet to its real population. Two fully worked "
        "examples and a set of practice conversions apply the method.",
        [
            "Explain what a subnet mask does and diagnose the symptoms of a "
            "mask that is too narrow or too wide",
            "Recognise the nine legal mask octet values and reconstruct them "
            "from the doubling rule",
            "Convert freely between dotted decimal masks and CIDR prefix "
            "lengths",
            "Calculate total addresses, usable hosts and block size from a "
            "prefix length",
            "Determine the network address, broadcast address and usable range "
            "for any address and mask using the block-size shortcut",
            "Choose an appropriate prefix for a stated host requirement, "
            "allowing for the gateway",
            "Explain CIDR and perform route aggregation, including recognising "
            "when a range cannot be aggregated",
            "Apply VLSM largest-first and explain why the order is forced by "
            "block alignment",
            "Describe private addressing, NAT, and what NAT costs",
        ],
        60,
        _sub_sections,
        [
            ("Subnet mask",
             "A 32-bit value whose contiguous leading ones mark the network "
             "portion of an address and whose trailing zeroes mark the host "
             "portion."),
            ("Prefix length",
             "The count of leading one bits in the mask, written after a "
             "slash. A longer prefix means more network bits and a smaller "
             "network."),
            ("Network address",
             "The address with all host bits zero. It names the subnet and "
             "cannot be assigned to a host."),
            ("Broadcast address",
             "The address with all host bits one. It reaches every host in the "
             "subnet and cannot be assigned to one."),
            ("Block size",
             "The number of addresses in a subnet, and therefore the interval "
             "at which successive subnets of that size may begin."),
            ("CIDR",
             "Classless Inter-Domain Routing. Carries the prefix length "
             "explicitly with the address, abolishing fixed classes and "
             "enabling route aggregation."),
            ("Route aggregation (supernetting)",
             "Advertising several contiguous, correctly aligned networks as "
             "one shorter prefix, reducing routing table entries."),
            ("VLSM",
             "Variable Length Subnet Masking. Different prefix lengths within "
             "one address block, allocated largest first."),
            ("RFC 1918",
             "The document defining the private address ranges 10.0.0.0/8, "
             "172.16.0.0/12 and 192.168.0.0/16."),
            ("NAT / PAT",
             "Network Address Translation rewrites private source addresses at "
             "the boundary; port address translation lets many hosts share one "
             "public address by assigning distinct source ports."),
        ],
        "The subnet mask says where an address stops naming a network and "
        "starts naming a host, and a mask that disagrees with the network "
        "produces the confusing symptom of some destinations working and "
        "others not. Everything else follows from the number of host bits: "
        "2^h addresses, 2^h minus 2 usable, and a block size of 2^h that says "
        "where each subnet may begin -- which is the shortcut that lets you "
        "answer most questions in seconds without touching binary. CIDR "
        "replaced the rigid class boundaries with an explicit prefix, allowing "
        "both right-sized allocation and the aggregation that keeps the global "
        "routing table within what routers can hold, though only for blocks "
        "that are contiguous AND correctly aligned. VLSM takes the same idea "
        "inside an organisation, sizing every subnet to its real population, "
        "provided you allocate largest to smallest so that alignment is never "
        "lost. And private addressing plus NAT is what let a thirty-year-old "
        "32-bit address space carry a planet's worth of devices -- at a real "
        "cost in end-to-end transparency, and while securing nothing."),
}


# ===========================================================================
# Routing Protocols and Algorithms
# ===========================================================================

_rt_sections = [
    ("Routing Versus Forwarding", [
        desc(
            "These two words are used loosely in conversation and precisely in "
            "exams. Routing is the process of building the routing table: "
            "discovering which networks exist, learning the possible paths to "
            "them, and deciding which path is best. Forwarding is the "
            "per-packet act of looking a destination up in that table and "
            "moving the packet to the appropriate outgoing interface."
        ),
        desc(
            "The difference in frequency is what to hold on to. Routing "
            "happens occasionally, involves conversation between routers, and "
            "is allowed to be slow. Forwarding happens millions of times a "
            "second, involves nothing but a table lookup, and is implemented "
            "in dedicated hardware for exactly that reason. A router that is "
            "recalculating routes is still forwarding packets throughout."
        ),
    ]),

    ("Three Ways a Routing Table Gets Filled", [
        sub("Directly connected"),
        desc(
            "Created automatically for each configured and active interface. "
            "The router knows these networks because it is physically attached "
            "to them, and they are the most trusted routes it holds -- nothing "
            "can be more authoritative than seeing the network with your own "
            "interface."
        ),
        sub("Static"),
        desc(
            "Entered by an administrator. Predictable, free of protocol "
            "overhead, and entirely inert: it will keep attracting traffic to "
            "a path that has failed, with no error logged anywhere."
        ),
        sub("Dynamic"),
        desc(
            "Learned from a routing protocol that exchanges information with "
            "neighbouring routers and reacts when the topology changes. Costs "
            "bandwidth for protocol messages and CPU for computation, and buys "
            "adaptability."
        ),
    ]),

    ("Static or Dynamic: The Real Trade-off", [
        desc(
            "Neither is better in the abstract, and treating dynamic routing "
            "as automatically more professional is a mistake. Static routing "
            "suits a topology with no choices in it: a branch office with one "
            "leased line to head office has exactly one path, and running a "
            "protocol to discover that fact is pure overhead."
        ),
        desc(
            "Dynamic routing earns its cost the moment there is more than one "
            "possible path, or more sites than a person can maintain by hand, "
            "or a requirement to survive a link failure without a call-out at "
            "two in the morning."
        ),
    ]),

    ("How Static Routing Fails", [
        desc(
            "The failure mode deserves emphasis because it is quiet. When the "
            "path behind a static route fails, the route remains in the table "
            "and the router continues handing packets to a next hop that "
            "cannot deliver them."
        ),
        desc(
            "Nothing logs an error, no alarm fires, and the router reports "
            "itself healthy. Traffic is discarded silently until a person "
            "notices that something is unreachable and traces it. This is why "
            "static routes in anything larger than a trivial topology are "
            "usually paired with a mechanism that can detect the failure and "
            "withdraw them."
        ),
    ]),

    ("Distance Vector: Routing by Rumour", [
        desc(
            "A distance vector protocol has each router tell its directly "
            "connected neighbours the distance it believes it has to every "
            "destination. Crucially, a router learns the topology only "
            "second-hand: it knows 'network X is four hops away through "
            "neighbour B' without knowing anything at all about what lies "
            "beyond B."
        ),
        desc(
            "The traditional summary -- routing by rumour -- is fair and "
            "worth remembering, because the entire characteristic failure of "
            "this family follows from it. The underlying algorithm is "
            "Bellman-Ford. It is simple to implement and cheap in memory, "
            "which is why it came first and why it still appears in small "
            "networks."
        ),
        image(ROUTING_DIAGRAM),
    ]),

    ("The Count-to-Infinity Problem", [
        desc(
            "Distance vector's ignorance of the wider topology produces one "
            "characteristic and serious failure. When a network becomes "
            "unreachable, two routers can each believe the other still has a "
            "path to it."
        ),
        desc(
            "Each adopts the other's advertised distance and adds one, so the "
            "metric creeps upward a hop at a time while traffic loops between "
            "them. Left entirely alone the metric would climb forever, which "
            "is where the name comes from. In the meantime the loop consumes "
            "bandwidth and the destination stays unreachable."
        ),
    ]),

    ("Five Mitigations You Must Be Able to Name", [
        accordion([
            ("Split horizon",
             "Never advertise a route back out of the interface it was learned "
             "on. If B learned about network X from A, B does not tell A about "
             "X. This alone removes the simplest two-router loop, and it costs "
             "nothing."),
            ("Route poisoning",
             "When a route fails, advertise it with an infinite metric rather "
             "than silently withdrawing it, so neighbours learn positively "
             "that it is gone instead of waiting for it to time out. Positive "
             "information travels faster than an absence."),
            ("Poison reverse",
             "Send that poisoned route back toward the source, deliberately "
             "overriding split horizon. Saying explicitly 'I cannot reach X' "
             "is stronger than merely saying nothing about X."),
            ("Hold-down timers",
             "After learning a route has failed, ignore any new information "
             "about it for a set period, so that stale advertisements still "
             "circulating cannot reinstate it. This deliberately slows "
             "convergence in exchange for stability."),
            ("Defining infinity",
             "RIP treats 16 hops as unreachable. Capping the metric bounds how "
             "long counting to infinity can take, at the cost of limiting the "
             "maximum network diameter to 15 hops -- a real constraint that "
             "rules RIP out of large networks."),
        ]),
    ]),

    ("Link State: Everyone Holds the Map", [
        desc(
            "A link state protocol takes the opposite approach entirely. Each "
            "router describes only its own directly connected links -- which "
            "it knows with certainty -- and floods that description to every "
            "router in the area."
        ),
        desc(
            "Every router therefore assembles an identical map of the whole "
            "topology, and then independently runs Dijkstra's shortest path "
            "first algorithm over that map to compute its own best path to "
            "every destination. No router relies on another router's "
            "conclusions; they rely only on each other's factual reports about "
            "their own links."
        ),
    ]),

    ("Why Link State Converges Faster", [
        desc(
            "Two consequences follow from every router holding the same "
            "complete map. Loops of the count-to-infinity kind cannot form, "
            "because no router is adopting a conclusion it cannot verify."
        ),
        desc(
            "And convergence after a change is fast: the change is flooded "
            "immediately to every router in the area, rather than propagating "
            "one hop per update interval as it does in a distance vector "
            "network. A link failure at one end of a large network is known "
            "throughout it within seconds rather than minutes."
        ),
    ]),

    ("What Link State Costs, and How Areas Pay for It", [
        desc(
            "Holding the full topology consumes memory, and running Dijkstra "
            "consumes CPU, and both grow with the size of the network. In a "
            "sufficiently large single area, every link change anywhere causes "
            "every router to recompute everything."
        ),
        desc(
            "Link state protocols therefore divide a large autonomous system "
            "into areas. Detailed topology information is flooded only within "
            "an area and summarised between areas, so a router's database and "
            "its SPF computation stay bounded no matter how large the whole "
            "network becomes. In OSPF every area must attach to a backbone "
            "area, numbered 0, which is what prevents the areas forming a "
            "structure with loops of their own."
        ),
        image(OSPF_DIAGRAM),
    ]),

    ("Comparing the Two Families", [
        desc(
            "The distinction is worth being able to state from either "
            "direction -- given a characteristic, name the family; given a "
            "family, list its characteristics."
        ),
        ul([
            "Distance vector knows distances reported by neighbours; link "
            "state knows the topology itself",
            "Distance vector runs Bellman-Ford; link state runs Dijkstra's SPF",
            "Distance vector suffers count-to-infinity; link state structurally "
            "cannot",
            "Distance vector converges slowly, one router per update interval; "
            "link state floods changes immediately",
            "Distance vector is cheap in memory and CPU; link state costs both "
            "and uses areas to bound them",
            "Distance vector sends its whole table periodically; link state "
            "sends only changes, after an initial exchange",
        ]),
    ]),

    ("Autonomous Systems", [
        desc(
            "An autonomous system is a network under a single administrative "
            "authority with a consistent routing policy -- an ISP, a large "
            "enterprise, a university. Each is identified by a globally "
            "assigned AS number, in the same way that address blocks are "
            "assigned."
        ),
        desc(
            "The concept matters because it draws the line on either side of "
            "which routing means two genuinely different things, and the "
            "protocols on each side are different in kind rather than merely "
            "in scale."
        ),
    ]),

    ("Interior and Exterior Gateway Protocols", [
        desc(
            "Interior gateway protocols route within one autonomous system; "
            "exterior gateway protocols route between them. The distinction is "
            "not cosmetic, because the two jobs have different goals."
        ),
        desc(
            "Inside an autonomous system the aim is technical efficiency: find "
            "the fastest path, because every link belongs to the same "
            "organisation and there is no reason to prefer a slower one. "
            "Between autonomous systems the aim is policy -- an operator may "
            "deliberately prefer a longer path because of a commercial "
            "agreement, or refuse to carry another network's transit traffic "
            "at all. This is why BGP selects routes on attributes and policy "
            "rather than on a simple metric, and why it is a different kind of "
            "protocol rather than just a bigger one."
        ),
    ]),

    ("The Four Protocols You Will Be Asked About", [
        tabs([
            ("RIP", "RIP - interior, distance vector",
             "Metric is hop count, maximum 15, with 16 meaning unreachable. "
             "Broadcasts its entire table every 30 seconds. Simple, easy to "
             "configure and still found in small networks, but slow to "
             "converge and unable to distinguish a fast link from a slow one, "
             "since both count as exactly one hop."),
            ("OSPF", "OSPF - interior, link state",
             "Open Shortest Path First. Metric is cost, normally derived from "
             "interface bandwidth so that faster links are preferred. Divides "
             "the autonomous system into areas around a mandatory backbone "
             "area 0. Fast convergence, no hop limit, and the usual choice for "
             "a large enterprise network."),
            ("EIGRP", "EIGRP - interior, advanced distance vector",
             "Uses a composite metric including bandwidth and delay, and the "
             "DUAL algorithm to maintain pre-computed loop-free backup paths "
             "that can be used immediately on failure. Behaves like a distance "
             "vector protocol but converges more like a link state one."),
            ("BGP", "BGP - exterior, path vector",
             "The routing protocol of the internet between autonomous systems. "
             "Advertises the full sequence of autonomous systems a route passes "
             "through, which both prevents loops and allows policy to be "
             "applied to the path. Selection walks an ordered list of "
             "attributes such as local preference and AS path length rather "
             "than comparing a bandwidth metric."),
        ]),
    ]),

    ("Metrics: What Each Protocol Measures", [
        desc(
            "A metric is the number a protocol uses to compare paths, and "
            "different protocols measure genuinely different things -- which "
            "is why a metric from one cannot be compared with a metric from "
            "another."
        ),
        desc(
            "RIP counts hops, which is cheap to compute and blind: a path over "
            "three gigabit links loses to a path over two 64 kbit/s links, and "
            "RIP has no way to know it has chosen badly. OSPF uses cost "
            "derived from bandwidth, so faster links are preferred "
            "automatically. EIGRP combines bandwidth and delay into a "
            "composite figure. BGP does not really use a metric at all -- it "
            "walks an ordered list of attributes, and the first one that "
            "differs decides."
        ),
    ]),

    ("Administrative Distance", [
        desc(
            "When a router learns the same destination from two different "
            "protocols, their metrics are not comparable -- a RIP hop count of "
            "3 and an OSPF cost of 3 are unrelated quantities measured in "
            "different units."
        ),
        desc(
            "A second value is therefore consulted first. Administrative "
            "distance measures how trustworthy the SOURCE is, not how good the "
            "path is. Directly connected routes are the most trusted, then "
            "static routes, then the dynamic protocols in a conventional "
            "order. Only when two routes come from the same protocol is the "
            "metric consulted at all, and getting this ordering backwards is a "
            "reliable exam error."
        ),
    ]),

    ("Convergence", [
        desc(
            "Convergence is the state in which every router in the network "
            "holds a consistent view of the topology, and convergence time is "
            "how long it takes to return to that state after a change."
        ),
        desc(
            "During the gap, routers disagree with one another, and traffic "
            "may be dropped or looped. Convergence time is therefore the "
            "single most important practical measure of a routing protocol -- "
            "more important than the elegance of its metric, because it is the "
            "period during which the network is actually broken."
        ),
    ]),

    ("What Affects Convergence Time", [
        ul([
            "Protocol family: link state floods changes immediately, distance "
            "vector advances one router per update interval",
            "Timer settings: shorter hello and dead intervals detect failures "
            "faster, at the cost of more protocol traffic and more sensitivity "
            "to brief interruptions",
            "Network size and area design: summarisation between areas means "
            "a change in one area need not trigger recomputation everywhere",
            "The count-to-infinity mitigations themselves, which deliberately "
            "slow distance vector convergence in exchange for stability",
            "Whether backup paths are pre-computed, as EIGRP's DUAL does, so "
            "that failover does not wait for recalculation",
        ]),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Calling BGP a distance vector protocol",
             "It is a path vector protocol. It advertises the complete AS path "
             "rather than a distance, which is what lets it detect loops and "
             "apply policy. The distinction is examined directly."),
            ("Assuming a lower hop count means a faster path",
             "Only under RIP does hop count decide, and hop count is precisely "
             "the metric that cannot tell a fast link from a slow one. OSPF's "
             "bandwidth-derived cost exists to fix exactly this."),
            ("Comparing metrics across protocols",
             "A RIP metric of 3 and an OSPF metric of 3 are unrelated. "
             "Administrative distance decides between protocols; the metric "
             "only decides within one."),
            ("Believing static routing is always safer",
             "It is predictable but not adaptive, and it fails silently. A "
             "static route to a failed path keeps attracting traffic and "
             "discarding it, which is harder to diagnose than a dynamic "
             "protocol reconverging visibly."),
            ("Treating convergence as instantaneous",
             "There is always a window during which routers disagree. Designs "
             "that assume otherwise are the ones that lose traffic during every "
             "link failure."),
            ("Forgetting that OSPF areas must attach to area 0",
             "The backbone requirement is what keeps the area structure "
             "loop-free. An area connected only to another non-backbone area "
             "needs a virtual link, which is a workaround rather than a "
             "design."),
        ]),
    ]),

    ("Practical Example: A Company With No Choices", [
        desc(
            "A regional company has one head office, four branches and a "
            "single internet connection. Every branch reaches head office over "
            "one leased line, and there are no alternative paths anywhere in "
            "the topology."
        ),
        desc(
            "Dynamic routing would add protocol traffic, configuration and "
            "another thing to understand, to a network that has no decisions "
            "to make. Static routes at each branch pointing at head office, "
            "plus a default route toward the internet, are the correct answer "
            "-- and choosing OSPF here because it is more sophisticated would "
            "be an error of judgement rather than of knowledge."
        ),
    ]),

    ("The Same Company, Ten Times Larger", [
        desc(
            "Now suppose the company grows to forty sites with a partial mesh "
            "of links and dual paths to two data centres. The number of static "
            "routes becomes unmanageable -- and, far more importantly, none of "
            "them would react to a failure."
        ),
        desc(
            "OSPF is the fit: it discovers the topology, prefers the "
            "higher-bandwidth paths because its cost derives from bandwidth, "
            "and reconverges on its own when a link drops. With forty sites it "
            "would also be worth dividing into areas, so that a flapping link "
            "at one branch does not cause every router in the company to "
            "recompute its shortest path tree."
        ),
    ]),

    ("Where BGP Becomes Necessary", [
        desc(
            "The internet edge is the point at which an interior protocol "
            "stops being sufficient. If the company takes transit from two "
            "providers, the choice between paths stops being a technical "
            "question about which is faster and becomes a commercial one about "
            "which contract to consume."
        ),
        desc(
            "Expressing that is exactly what a path vector protocol with "
            "policy attributes is for. It is also the point at which the "
            "company needs its own AS number and provider-independent address "
            "space, which is a considerable administrative step rather than a "
            "configuration change."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Family identification: given a characteristic or an algorithm, "
            "name distance vector or link state",
            "The count-to-infinity mitigations, usually asked by name",
            "RIP's metric, its infinity value, and the maximum diameter that "
            "follows",
            "Interior versus exterior, and why BGP is path vector",
            "Administrative distance versus metric, and which decides what",
            "Convergence: which family is faster and precisely why",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Distance vector: Bellman-Ford, routing by rumour, "
            "count-to-infinity, RIP. Link state: Dijkstra SPF, full topology "
            "map, areas, OSPF",
            "Know the five count-to-infinity mitigations by name",
            "RIP's infinity is 16, so the maximum usable diameter is 15 hops",
            "Interior gateway protocols run within an autonomous system, "
            "exterior between them; BGP is the exterior one and is path vector",
            "Administrative distance chooses between protocols; metric chooses "
            "within a protocol",
            "OSPF areas must all attach to the backbone, area 0",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Routing builds the table and forwarding uses it, at wildly "
            "different frequencies",
            "Static routing is predictable, adds no overhead, does not adapt, "
            "and fails silently",
            "Distance vector routers know only distances reported by "
            "neighbours, which is what causes count-to-infinity",
            "Link state routers hold the whole map and compute paths "
            "themselves, converging quickly at a cost in memory and CPU that "
            "areas exist to bound",
            "RIP counts hops and therefore cannot tell a fast link from a slow "
            "one; OSPF costs by bandwidth",
            "BGP is a path vector exterior protocol driven by commercial "
            "policy rather than by a bandwidth metric",
            "Convergence time is the practical measure that matters most, "
            "because it is the window during which the network is wrong",
        ]),
    ]),
]

_rt_quiz = [
    mcq("EASY",
        "Which algorithm does a link state routing protocol such as OSPF use "
        "to compute best paths?",
        [("Dijkstra's shortest path first algorithm", True),
         ("The Bellman-Ford algorithm", False),
         ("The DUAL algorithm", False),
         ("Spanning tree", False)],
        "Link state protocols build a complete topology map and run Dijkstra's "
        "SPF over it. Bellman-Ford is the distance vector algorithm used by "
        "RIP, DUAL belongs to EIGRP, and spanning tree is a Layer 2 loop "
        "prevention protocol rather than a routing algorithm at all."),
    mcq("EASY",
        "In RIP, what metric value indicates that a destination is "
        "unreachable?",
        [("16", True), ("15", False), ("255", False), ("0", False)],
        "RIP defines 16 as infinity, which bounds how long the "
        "count-to-infinity process can run. That makes 15 the greatest usable "
        "hop count and limits a RIP network's diameter accordingly -- a real "
        "constraint that rules it out of large networks. A metric of 0 would "
        "indicate a directly connected network."),
    mcq("AVERAGE",
        "Two routers each believe the other has a path to a network that has "
        "actually failed, and their advertised distances increase one hop at a "
        "time while traffic loops between them.\n\nWhat is this problem "
        "called, and which family of protocols suffers from it?",
        [("Count-to-infinity, in distance vector protocols", True),
         ("Count-to-infinity, in link state protocols", False),
         ("Split horizon failure, in link state protocols", False),
         ("Route flapping, in exterior gateway protocols", False)],
        "Distance vector routers learn only what neighbours report and cannot "
        "see the topology behind them, so each can mistake the other's stale "
        "information for a valid path. Link state protocols are structurally "
        "immune, because every router holds the same complete map and relies "
        "on factual link reports rather than on other routers' conclusions. "
        "Split horizon is a mitigation rather than a fault, and route flapping "
        "is repeated withdrawal and re-advertisement."),
    mcq("AVERAGE",
        "A router learns a route to 10.1.0.0/16 from both RIP and OSPF. How "
        "does it decide which to install in the routing table?",
        [("It compares administrative distance, because metrics from different "
          "protocols are not comparable.", True),
         ("It compares the two metrics directly and installs the lower "
          "one.", False),
         ("It installs both and load-balances traffic between them.", False),
         ("It installs whichever route was learned first and ignores the "
          "other.", False)],
        "A RIP hop count and an OSPF cost measure different things in "
        "different units, so comparing them is meaningless. Administrative "
        "distance ranks the trustworthiness of the source, and the route from "
        "the more trusted protocol is installed; the metric only decides "
        "between routes from the same protocol. Load balancing applies to "
        "equal-cost routes within one protocol, and learning order is not a "
        "criterion."),
    mcq("AVERAGE",
        "Why does OSPF divide a large autonomous system into areas?",
        [("To limit the scope of link state flooding and the size of each "
          "router's topology database, reducing memory and CPU load", True),
         ("To allow different areas to use incompatible metrics", False),
         ("To raise the maximum hop count beyond the protocol's default "
          "limit", False),
         ("To permit static routes inside an area while dynamic routing runs "
          "between areas", False)],
        "Every router in an area must hold an identical map of that area, so "
        "an unbounded area means an unbounded database and an increasingly "
        "expensive SPF run -- and any link change anywhere forces every router "
        "to recompute. Areas bound both, with summarisation between them. OSPF "
        "uses one consistent cost metric, has no hop limit to raise, and areas "
        "do not change how static routes behave."),
    mcq("AVERAGE",
        "Which mitigation deliberately overrides split horizon by advertising "
        "a failed route back toward its source with an infinite metric?",
        [("Poison reverse", True), ("Hold-down timer", False),
         ("Route summarisation", False), ("Triggered update", False)],
        "Split horizon suppresses a route on the interface it was learned on; "
        "poison reverse deliberately sends it back anyway, marked unreachable, "
        "on the reasoning that stating 'I cannot reach X' explicitly is "
        "stronger than saying nothing about X. A hold-down timer ignores new "
        "information for a period, summarisation reduces table size, and a "
        "triggered update sends a change immediately rather than waiting for "
        "the timer."),
    mcq("HARD",
        "Why is BGP classified as a path vector protocol rather than a "
        "distance vector protocol?",
        [("It advertises the complete sequence of autonomous systems a route "
          "traverses, which both detects loops and allows policy to be applied "
          "to the path.", True),
         ("It advertises the physical distance in kilometres between "
          "autonomous systems.", False),
         ("It floods a full topology map to every router on the "
          "internet.", False),
         ("It selects paths using Dijkstra's algorithm over the AS "
          "graph.", False)],
        "A BGP advertisement carries the AS path, so a router receiving a "
        "route that already contains its own autonomous system number knows "
        "the route would loop and rejects it -- loop prevention without any "
        "metric. Carrying the whole path also lets operators apply policy, "
        "preferring or avoiding particular transit providers. It advertises no "
        "geographical distance, floods no global topology, and does not run "
        "SPF."),
    mcq("HARD",
        "A network runs RIP. A destination is reachable either over three "
        "gigabit links or over two links running at 64 kbit/s.\n\nWhich path "
        "does RIP select, and what does this reveal?",
        [("The two-hop path over the slow links, revealing that hop count "
          "cannot distinguish link speeds", True),
         ("The three-hop gigabit path, because RIP weights hops by "
          "bandwidth", False),
         ("Both paths equally, because RIP always load-balances", False),
         ("Neither, because RIP rejects paths with mixed link speeds", False)],
        "RIP's only metric is hop count, so two hops beats three regardless of "
        "capacity, and traffic takes a path roughly 15,000 times slower. This "
        "blindness is precisely why OSPF derives its cost from interface "
        "bandwidth. RIP does not weight hops, does not load-balance across "
        "unequal paths by default, and has no concept of link speed to reject."),
    short_answer("EASY",
        "What term describes a network under a single administrative authority "
        "with a consistent routing policy? Give the term or its acronym.",
        "Autonomous System",
        ["autonomous system", "as", "an autonomous system"]),
    short_answer("AVERAGE",
        "Name the distance vector loop-prevention rule that forbids "
        "advertising a route back out of the interface on which it was "
        "learned.",
        "Split horizon",
        ["split horizon", "split-horizon", "the split horizon rule"]),
    descriptive("HARD",
        "Compare distance vector and link state routing in terms of the "
        "information each router holds, how the algorithm computes paths, and "
        "the consequences for convergence and resource use.",
        "A distance vector router holds only what its directly connected "
        "neighbours tell it: for each destination, a distance and the "
        "neighbour to send through. It never sees the topology beyond those "
        "neighbours, which is why the approach is described as routing by "
        "rumour -- it acts on other routers' conclusions rather than on facts "
        "it can verify. Paths are computed by the Bellman-Ford algorithm, "
        "essentially by adopting a neighbour's advertised distance plus the "
        "cost of reaching that neighbour. A link state router instead holds a "
        "complete and identical map of the topology, assembled from link state "
        "advertisements in which every router describes only its own directly "
        "connected links -- facts it knows with certainty -- and floods them to "
        "every router in the area. Each router then computes its own shortest "
        "paths over that map using Dijkstra's algorithm. The consequences "
        "follow directly. Distance vector converges slowly, because "
        "information advances only one router per update interval, and it is "
        "vulnerable to count-to-infinity loops in which two routers reinforce "
        "each other's stale information; containing that requires split "
        "horizon, route poisoning, poison reverse and hold-down timers, and "
        "several of those deliberately slow convergence further in exchange "
        "for stability. Link state converges quickly, since a change is "
        "flooded immediately and every router recomputes independently from "
        "the same data, and loops of that kind cannot form because no router "
        "relies on another's conclusion. The trade-off is resource "
        "consumption: the topology database costs memory and each SPF run "
        "costs CPU, both growing with network size, which is why link state "
        "protocols partition large networks into areas that bound the database "
        "and confine recomputation.",
        [("Describes the information each router holds and the rumour/map "
          "distinction", 3),
         ("Names and explains the algorithm each family uses", 3),
         ("Draws correct consequences for convergence and resource use, "
          "including areas", 4)]),
]

LESSON_ROUTING = {
    "middle": MID_PROTOCOLS,
    "name": "Routing Protocols and Algorithms",
    "quiz": _rt_quiz,
    "structure": lesson_structure(
        "Routing Protocols and Algorithms",
        "Once a network is addressed, something has to decide how traffic "
        "crosses it. This lesson covers how routing tables are built and how "
        "the protocols that build them work. You will learn the difference "
        "between routing and forwarding, the three ways a table is populated, "
        "when static routing is the right answer and how it fails silently "
        "when it is not, the two great algorithm families and the "
        "characteristic failure of each, the five mitigations for "
        "count-to-infinity, why link state protocols need areas, the "
        "distinction between interior and exterior protocols and why BGP is "
        "different in kind, how administrative distance and metric interact, "
        "and why convergence time is the measure that matters most in "
        "practice.",
        [
            "Distinguish routing from forwarding and name the three ways a "
            "routing table is populated",
            "Weigh static against dynamic routing for a given topology, "
            "including the silent failure mode of a stale static route",
            "Explain distance vector routing, the Bellman-Ford algorithm and "
            "the count-to-infinity problem",
            "Name and explain the five count-to-infinity mitigations",
            "Explain link state routing, Dijkstra's SPF algorithm, and why "
            "areas and a backbone are necessary",
            "Compare the two families on information held, algorithm, "
            "convergence and resource cost",
            "Classify RIP, OSPF, EIGRP and BGP by family and by interior or "
            "exterior scope",
            "Explain how administrative distance and metric each contribute to "
            "route selection",
            "Define convergence, list what affects it, and explain why link "
            "state converges faster",
        ],
        60,
        _rt_sections,
        [
            ("Routing",
             "Building the routing table: discovering networks, learning "
             "paths, and selecting the best one."),
            ("Forwarding",
             "The per-packet lookup moving a packet to an outgoing interface "
             "using the table that routing produced."),
            ("Distance vector",
             "A protocol family in which routers exchange distances to "
             "destinations with direct neighbours only, computed with "
             "Bellman-Ford."),
            ("Link state",
             "A protocol family in which routers flood descriptions of their "
             "own links, assemble an identical topology map, and run "
             "Dijkstra's SPF over it."),
            ("Count-to-infinity",
             "The distance vector failure in which two routers reinforce each "
             "other's stale route while the metric climbs, contained by split "
             "horizon, route poisoning, poison reverse, hold-down timers and a "
             "defined infinity."),
            ("Split horizon",
             "Never advertising a route back out of the interface it was "
             "learned on."),
            ("Poison reverse",
             "Deliberately overriding split horizon to advertise a failed "
             "route back toward its source with an infinite metric."),
            ("Autonomous System",
             "A network under one administrative authority with a consistent "
             "routing policy, identified by an AS number."),
            ("Interior / Exterior Gateway Protocol",
             "An IGP routes within one autonomous system (RIP, OSPF, EIGRP); "
             "an EGP routes between them (BGP)."),
            ("Path vector",
             "BGP's approach: advertise the full sequence of autonomous "
             "systems traversed, giving loop detection and a basis for policy."),
            ("Administrative distance",
             "A ranking of how trustworthy a route's SOURCE is, used to choose "
             "between routes learned from different protocols."),
            ("Convergence",
             "The state in which all routers hold a consistent view of the "
             "topology, and the time taken to reach it after a change."),
        ],
        "Routing builds the table and forwarding uses it, at frequencies "
        "differing by many orders of magnitude. Static routes are predictable "
        "and free of overhead but never adapt, and their failure is silent -- "
        "traffic is discarded with no error logged anywhere. Distance vector "
        "protocols learn only distances reported by neighbours, which is "
        "exactly why they suffer count-to-infinity and why split horizon, "
        "poisoning, poison reverse and hold-down timers exist to contain it at "
        "the price of speed. Link state protocols have every router flood "
        "facts about its own links, assemble an identical map, and run "
        "Dijkstra independently, which makes loops of that kind structurally "
        "impossible and convergence fast -- at a memory and CPU cost that "
        "areas exist to bound. RIP counts hops and therefore cannot tell a "
        "gigabit link from a dial-up one, OSPF costs by bandwidth and scales "
        "through its area hierarchy, and BGP is a different animal entirely: a "
        "path vector protocol between autonomous systems where the decision is "
        "commercial policy rather than a metric at all. Across all of them, "
        "convergence time is what matters in practice, because it is the "
        "window during which the network is actively wrong."),
}

LESSONS = [LESSON_SUBNETTING, LESSON_ROUTING]
