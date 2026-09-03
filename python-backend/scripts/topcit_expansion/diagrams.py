"""The 37 lesson figures, defined as data and drawn by `diagram_kit`.

Each entry is keyed by (lesson_id, sectionName) so the installer can match it
to the exact image slot it replaces. The key is the section heading as stored,
because that is what identifies the slot inside the lesson structure.
"""

from diagram_kit import (BLUE, DEEP, ORANGE, RED, TEAL, compare, cycle, fields,
                         flow, hub_spoke, split_planes, stack, table, tiers,
                         timeline)

DIAGRAMS = {}


def register(lesson_id, section, slug, svg):
    DIAGRAMS[(lesson_id, section)] = (slug, svg)


# -- 405  Protocols and the OSI Reference Model ----------------------------
register(405, "The OSI Reference Model", "osi-reference-model", stack(
    "The OSI Reference Model",
    [("Application", "HTTP, SMTP, DNS"),
     ("Presentation", "encoding, encryption, compression"),
     ("Session", "dialogue setup and teardown"),
     ("Transport", "segments - TCP, UDP, ports"),
     ("Network", "packets - IP, routing between networks"),
     ("Data Link", "frames - MAC addressing on one link"),
     ("Physical", "bits - voltages, light, radio")],
    caption="Seven layers, each using only the service below it and serving only the one above."))

register(405, "Encapsulation", "encapsulation", flow(
    "Encapsulation down the stack",
    [("Data", "application payload"),
     ("Segment", "+ TCP/UDP header"),
     ("Packet", "+ IP header"),
     ("Frame", "+ MAC header/trailer"),
     ("Bits", "on the wire")],
    caption="Each layer wraps the unit above it in its own header; the receiver unwraps in reverse.",
    note="The receiver strips exactly one header per layer, which is why a layer never needs to understand the layers above it."))

# -- 406  Internet Address Structure ---------------------------------------
register(406, "MAC Address Structure", "mac-address-structure", fields(
    "MAC address: 48 bits in two halves",
    [("OUI - assigned to the vendor", "00:1A:2B", 1, DEEP),
     ("NIC - assigned by the vendor", "3C:4D:5E", 1, BLUE)],
    caption="A MAC address is flat and permanent: it identifies the card, not where it is.",
    footer="Because it carries no location, a MAC address cannot be routed - that is what IP is for."))

register(406, "The Historical Address Classes", "ipv4-address-classes", table(
    "The historical IPv4 address classes",
    ["Class", "Leading bits", "First octet", "Default mask", "Hosts per network"],
    [["A", "0", "1 - 126", "/8", "16,777,214"],
     ["B", "10", "128 - 191", "/16", "65,534"],
     ["C", "110", "192 - 223", "/24", "254"],
     ["D", "1110", "224 - 239", "multicast", "not applicable"],
     ["E", "1111", "240 - 255", "reserved", "not applicable"]],
    widths=[0.12, 0.16, 0.2, 0.2, 0.32],
    caption="Classful addressing fixed the network/host split by the first bits of the address.",
    footer="Classes wasted addresses badly - a site needing 300 hosts had to take a whole Class B. CIDR replaced them."))

# -- 407  Internet Standards and IEEE 802 ----------------------------------
register(407, "The IEEE 802 Family", "ieee-802-family", table(
    "The IEEE 802 family",
    ["Standard", "Covers", "Where you meet it"],
    [["802.1", "Bridging, VLANs, port security", "802.1Q tagging, 802.1X auth"],
     ["802.2", "Logical Link Control", "The LLC sublayer above MAC"],
     ["802.3", "Ethernet", "Every wired LAN port"],
     ["802.11", "Wireless LAN", "Wi-Fi"],
     ["802.15", "Wireless PAN", "Bluetooth, Zigbee"]],
    widths=[0.18, 0.42, 0.4],
    caption="802 splits the data link layer into LLC above and MAC below.",
    footer="Only the MAC half changes between Ethernet and Wi-Fi; LLC lets the layers above stay identical."))

register(407, "CSMA/CD on Wired Networks", "csma-cd", flow(
    "CSMA/CD: how a shared wire is arbitrated",
    [("Listen", "is the medium idle?"),
     ("Transmit", "begin sending"),
     ("Detect", "collision on the wire?"),
     ("Jam", "signal all stations"),
     ("Back off", "wait a random interval, retry")],
    caption="Carrier Sense Multiple Access with Collision Detection.",
    note="Full-duplex switched Ethernet has no collision domain to arbitrate, so CSMA/CD is effectively disabled on modern links."))

# -- 408  Network Layer Devices --------------------------------------------
register(408, "Classifying Devices by Layer", "devices-by-layer", table(
    "Network devices by the layer they act on",
    ["Device", "Layer", "Forwards on", "Effect on domains"],
    [["Hub", "1 - Physical", "Nothing; repeats bits", "One collision, one broadcast"],
     ["Switch", "2 - Data Link", "MAC address", "Splits collision domains"],
     ["Router", "3 - Network", "IP address", "Splits broadcast domains"],
     ["L3 switch", "2 and 3", "MAC and IP", "Splits both, at hardware speed"],
     ["Firewall", "3 - 7", "Policy", "Enforces a boundary"]],
    widths=[0.18, 0.18, 0.26, 0.38],
    caption="The layer a device reads determines what it can separate.",
    footer="A switch does not stop a broadcast storm; only a router boundary does."))

register(408, "VLANs: Separating Networks Without Separating Cables",
         "vlan-segmentation", tiers(
    "VLANs: one switch, several broadcast domains",
    [("Router", ["Router on a stick", "802.1Q trunk"]),
     ("Switch", ["Access switch"]),
     ("Hosts", ["VLAN 10 Finance", "VLAN 20 Engineering", "VLAN 30 Guest"])],
    caption="Ports are assigned to VLANs; frames carry an 802.1Q tag on the trunk.",
    footer="Traffic between VLANs must pass the router, which is exactly where policy can be applied."))

# -- 409  IPv4 Addressing, Subnetting, CIDR --------------------------------
register(409, "The Subnet Mask", "subnet-mask", fields(
    "192.168.10.130 /26 split by its mask",
    [("Network - 26 bits", "192.168.10.128", 26, DEEP),
     ("Host - 6 bits", ".130", 6, TEAL)],
    caption="The mask says where the network part ends and the host part begins.",
    footer="/26 leaves 6 host bits: 64 addresses, of which 62 are usable once network and broadcast are removed."))

register(409, "The Block Size Shortcut", "cidr-block-sizes", table(
    "The block size shortcut",
    ["Prefix", "Mask", "Block size", "Usable hosts"],
    [["/24", "255.255.255.0", "256", "254"],
     ["/25", "255.255.255.128", "128", "126"],
     ["/26", "255.255.255.192", "64", "62"],
     ["/27", "255.255.255.224", "32", "30"],
     ["/28", "255.255.255.240", "16", "14"],
     ["/29", "255.255.255.248", "8", "6"],
     ["/30", "255.255.255.252", "4", "2"]],
    widths=[0.16, 0.34, 0.24, 0.26],
    caption="Block size is 256 minus the last non-zero mask octet; subnets start at multiples of it.",
    footer="Usable hosts is always block size minus two - the network address and the broadcast address."))

# -- 410  Routing Protocols -------------------------------------------------
register(410, "Distance Vector: Routing by Rumour", "distance-vector", flow(
    "Distance vector: routing by rumour",
    [("Know", "only directly connected links"),
     ("Tell neighbours", "the whole table, periodically"),
     ("Believe", "neighbours' costs, unverified"),
     ("Add cost", "hop count to each route"),
     ("Converge", "slowly, hop by hop")],
    caption="A router never sees the topology - only what its neighbours claim.",
    note="Believing a neighbour without proof is what creates routing loops; split horizon and hold-down timers exist to contain them."))

register(410, "What Link State Costs, and How Areas Pay for It", "link-state-areas", tiers(
    "Link state: areas keep the cost of full knowledge bounded",
    [("Backbone", ["Area 0"]),
     ("Border", ["ABR", "ABR"]),
     ("Areas", ["Area 1", "Area 2", "Area 3"])],
    caption="Every router floods link state and runs Dijkstra over an identical database.",
    footer="Full knowledge costs CPU and memory, so areas limit how far a flood travels and summarise at the border."))

# -- 411  SDN and NFV -------------------------------------------------------
register(411, "The Central Idea", "sdn-central-idea", split_planes(
    "The central idea: separating control from forwarding",
    ("Traditional", "Every device decides for itself",
     [("Control plane", "on every device"),
      ("Data plane", "on every device"),
      ("Management", "box by box, by hand")]),
    ("SDN", "One controller decides for all of them",
     [("Controller", "central control plane"),
      ("Southbound API", "OpenFlow to the switches"),
      ("Data plane", "switches only forward")]),
    caption="SDN moves the decision out of the box and leaves the box forwarding.",
    footer="Centralising control is what makes the network programmable - and what makes the controller worth protecting."))

register(411, "Network Function Virtualization", "nfv", compare(
    "Network Function Virtualization",
    [("Appliance model", "one function per box",
      ["Firewall appliance", "Load balancer appliance", "WAN optimiser appliance",
       "Fixed capacity", "Procurement per box"]),
     ("NFV model", "functions as software",
      ["Virtual firewall", "Virtual load balancer", "Virtual WAN optimiser",
       "Scale by adding instances", "Deploy in minutes"])],
    caption="NFV runs network functions as software on general-purpose servers.",
    footer="SDN changes who decides; NFV changes what the function runs on. They are complementary, not the same idea."))

# -- 412  Cloud and Data Centre Networking ---------------------------------
register(412, "Leaf-Spine Fabric", "leaf-spine", tiers(
    "Leaf-spine fabric",
    [("Spine", ["Spine 1", "Spine 2", "Spine 3"]),
     ("Leaf", ["Leaf 1", "Leaf 2", "Leaf 3", "Leaf 4"])],
    caption="Every leaf connects to every spine; no leaf connects to another leaf.",
    footer="Any server is exactly two hops from any other, so east-west latency is predictable regardless of rack."))

register(412, "VXLAN", "vxlan", fields(
    "VXLAN: the original frame, wrapped for transport",
    [("Outer IP/UDP", "underlay routing", 3, DEEP),
     ("VXLAN header", "VNI - 24 bits", 2, ORANGE),
     ("Original Ethernet frame", "the tenant's own traffic", 5, TEAL)],
    caption="A VTEP wraps a layer 2 frame in a layer 3 packet so it can cross a routed fabric.",
    footer="24 bits of VNI allows ~16 million segments, against 4,094 usable VLANs - which is why VXLAN exists."))

# -- 413  Mobile Network Evolution -----------------------------------------
register(413, "The 4G Core in Four Elements", "4g-core", flow(
    "The 4G core in four elements",
    [("eNodeB", "the radio access network"),
     ("MME", "signalling and mobility"),
     ("SGW", "anchors the data path"),
     ("PGW", "the exit to the internet")],
    caption="Control (MME) and user data (SGW/PGW) already travel separate paths in 4G.",
    note="5G takes the same separation further: the UPF becomes the only user-plane element, and control functions become independent services."))

register(413, "Network Slicing", "network-slicing", compare(
    "Network slicing: one physical network, several logical ones",
    [("eMBB", "enhanced mobile broadband",
      ["High throughput", "Video and browsing", "Latency tolerant"]),
     ("URLLC", "ultra-reliable low latency",
      ["Millisecond latency", "Industrial control", "Reliability first"]),
     ("mMTC", "massive machine type",
      ["Enormous device count", "Tiny payloads", "Power efficiency first"])],
    caption="Each slice is an isolated end-to-end network with its own guarantees.",
    footer="Slices share the same hardware; what differs is the resource guarantee, not the equipment."))

# -- 414  Cryptography Fundamentals ----------------------------------------
register(414, "Symmetric Encryption", "symmetric-encryption", flow(
    "Symmetric encryption: one shared key",
    [("Plaintext", "the message"),
     ("Encrypt", "with the shared key"),
     ("Ciphertext", "safe in transit"),
     ("Decrypt", "with the same key"),
     ("Plaintext", "recovered")],
    caption="Fast, and suitable for bulk data - but both parties need the same secret.",
    note="The hard part is never the algorithm; it is getting the shared key to the other party without anyone else seeing it."))

register(414, "Asymmetric Encryption", "asymmetric-encryption", compare(
    "Asymmetric encryption: a mathematically related key pair",
    [("Public key", "published to anyone",
      ["Encrypts to the owner", "Verifies the owner's signature",
       "Safe to distribute freely"]),
     ("Private key", "never leaves the owner",
      ["Decrypts what the public key sealed", "Creates the owner's signature",
       "Compromise ends the identity"])],
    caption="What one key does, only the other can undo.",
    footer="Asymmetric work is far slower, so it is used to exchange a symmetric key - not to encrypt the bulk traffic."))

# -- 415  Hash Functions ----------------------------------------------------
register(415, "What a Hash Function Is", "hash-function", flow(
    "A hash function is one-way and fixed-length",
    [("Input", "any size at all"),
     ("Hash function", "SHA-256"),
     ("Digest", "always 256 bits"),
     ("Compare", "same input, same digest")],
    caption="Deterministic, fixed-length, and infeasible to reverse.",
    note="Change one bit of the input and roughly half the output bits change - the avalanche effect, which is what makes tampering detectable."))

# -- 416  Authentication, Digital Signatures, PKI --------------------------
register(416, "How a Digital Signature Works", "digital-signature", flow(
    "How a digital signature works",
    [("Hash the message", "produce a digest"),
     ("Encrypt the digest", "with the sender's private key"),
     ("Send", "message plus signature"),
     ("Decrypt signature", "with the sender's public key"),
     ("Compare digests", "match means intact and authentic")],
    caption="Signing proves origin and integrity - it does not provide confidentiality.",
    note="Only the private key holder could have produced a signature the public key opens, which is what makes it non-repudiable."))

register(416, "The Problem PKI Solves", "pki-trust-chain", stack(
    "The chain of trust PKI builds",
    [("Root CA", "self-signed, kept offline"),
     ("Intermediate CA", "signs on the root's behalf"),
     ("End-entity certificate", "the server's own identity"),
     ("Relying party", "validates the chain to a trusted root")],
    numbered=False,
    caption="A public key alone proves nothing about who owns it. PKI binds key to identity.",
    right_note="Validation walks the chain upward until it reaches a root the client already trusts."))

# -- 417  Access Control Models --------------------------------------------
register(417, "The Four Models", "access-control-models", table(
    "The four access control models",
    ["Model", "Who decides", "Basis of the decision", "Typical use"],
    [["DAC", "The data owner", "Owner's discretion", "File systems"],
     ["MAC", "The system", "Clearance versus label", "Military, multi-level"],
     ["RBAC", "The administrator", "The subject's role", "Most enterprises"],
     ["ABAC", "A policy engine", "Attributes and context", "Cloud, fine-grained"]],
    widths=[0.13, 0.22, 0.32, 0.33],
    caption="The models differ chiefly in who is permitted to change a permission.",
    footer="RBAC scales administratively because permissions attach to roles, not to individual people."))

# -- 418  Threat Modelling --------------------------------------------------
register(418, "STRIDE", "stride", table(
    "STRIDE: six threats, six properties",
    ["Threat", "Violates", "Example", "Typical control"],
    [["Spoofing", "Authentication", "Forged identity", "Strong auth, MFA"],
     ["Tampering", "Integrity", "Modified data in transit", "Signing, hashing"],
     ["Repudiation", "Non-repudiation", "Denying an action", "Audit logs, signatures"],
     ["Information disclosure", "Confidentiality", "Leaked records", "Encryption, access control"],
     ["Denial of service", "Availability", "Resource exhaustion", "Rate limiting, capacity"],
     ["Elevation of privilege", "Authorisation", "User becomes admin", "Least privilege"]],
    widths=[0.25, 0.19, 0.28, 0.28],
    caption="Each STRIDE letter is the negation of one security property.",
    footer="Working the list systematically is the point - it stops a review from only finding the threats you already expected."))

register(418, "The Attack Chain", "attack-chain", flow(
    "The attack chain",
    [("Reconnaissance", "study the target"),
     ("Weaponisation", "build the payload"),
     ("Delivery", "get it to the target"),
     ("Exploitation", "trigger the flaw"),
     ("Installation", "establish a foothold"),
     ("Command and control", "take remote direction"),
     ("Actions", "achieve the objective")],
    caption="An intrusion is a sequence, not a single event.",
    note="The defender only has to break the chain once - which is why detection early in the chain is worth far more than detection at the end."))

# -- 419  Vulnerability Management ------------------------------------------
register(419, "The Vulnerability Management Cycle", "vulnerability-cycle", cycle(
    "The vulnerability management cycle",
    [("Discover", "assets and flaws"),
     ("Prioritise", "by risk, not CVSS alone"),
     ("Remediate", "patch or mitigate"),
     ("Verify", "rescan to confirm"),
     ("Report", "and feed back")],
    centre="continuous, not a project",
    caption="A scan is a snapshot; management is the loop around it."))

# -- 420  Business Continuity and Disaster Recovery ------------------------
register(420, "RTO and RPO", "rto-rpo", timeline(
    "RTO and RPO measure different losses",
    ("RPO", "how much data you can afford to lose"),
    ("RTO", "how long you can afford to be down"),
    caption="RPO looks backwards from the incident; RTO looks forwards.",
    footer="RPO is set by backup frequency. RTO is set by recovery capability. Tightening either one costs money."))

register(420, "Backup Strategies", "backup-strategies", table(
    "Backup strategies compared",
    ["Strategy", "What it copies", "Backup time", "Restore time", "Media needed"],
    [["Full", "Everything, every time", "Longest", "Fastest", "Most"],
     ["Incremental", "Changes since last backup", "Shortest", "Slowest", "Least"],
     ["Differential", "Changes since last full", "Medium", "Medium", "Medium"]],
    widths=[0.17, 0.31, 0.17, 0.17, 0.18],
    caption="The three strategies trade backup cost against restore cost.",
    footer="Incremental restores need the full plus every increment since - one missing increment breaks the chain."))

# -- 421  Security Policies -------------------------------------------------
register(421, "Why the Hierarchy Exists", "policy-hierarchy", stack(
    "The security document hierarchy",
    [("Policy", "what and why - mandatory, stable"),
     ("Standard", "specific mandatory requirements"),
     ("Procedure", "step-by-step, how to do it"),
     ("Guideline", "recommended, not mandatory")],
    numbered=False,
    caption="Each level translates the one above it into something more concrete.",
    right_note="Policy changes rarely and needs board approval; procedures change often and do not."))

# -- 422  Security Auditing and Incident Response --------------------------
register(422, "SIEM", "siem", hub_spoke(
    "SIEM: collect, correlate, alert",
    "SIEM",
    ["Firewall logs", "Server and OS logs", "Application logs",
     "IDS/IPS alerts", "Identity and access logs"],
    hub_note="normalise - correlate - alert",
    caption="Correlation is the value: single events look harmless, sequences do not."))

register(422, "The Incident Response Lifecycle", "incident-response", cycle(
    "The incident response lifecycle",
    [("Preparation", "before anything happens"),
     ("Detection and analysis", "is this an incident?"),
     ("Containment", "stop the spread"),
     ("Eradication", "remove the cause"),
     ("Recovery", "restore service"),
     ("Lessons learned", "feed back into preparation")],
    centre="the loop closes",
    caption="Lessons learned is not paperwork - it is the input to the next preparation phase."))

# -- 423  Enterprise Solutions ---------------------------------------------
register(423, "ERP and the Single Shared Database", "erp-shared-database", hub_spoke(
    "ERP: one shared database, many modules",
    "Single shared database",
    ["Finance", "Human resources", "Manufacturing",
     "Procurement", "Sales and distribution", "Inventory"],
    hub_note="one record, entered once",
    caption="The integration is the point: a sales order updates inventory and finance without re-keying."))

register(423, "Supply Chain Management", "supply-chain", flow(
    "The supply chain SCM coordinates",
    [("Supplier", "raw materials"),
     ("Manufacturer", "production"),
     ("Distributor", "bulk movement"),
     ("Retailer", "point of sale"),
     ("Customer", "demand signal")],
    caption="SCM plans and tracks the flow of goods, information and money along this chain.",
    note="Demand information travels back up the chain; distortion as it travels is the bullwhip effect."))

# -- 424  IT Strategy Planning ----------------------------------------------
register(424, "Enterprise Architecture", "enterprise-architecture", stack(
    "The four enterprise architecture layers",
    [("Business architecture", "processes, functions, organisation"),
     ("Data architecture", "entities, ownership, flows"),
     ("Application architecture", "systems and their interfaces"),
     ("Technology architecture", "infrastructure and platforms")],
    numbered=False,
    caption="Each layer is justified by the one above it.",
    right_note="Read downward it is traceability; read upward it is the business case for every component."))

# -- 425  IT Business Adoption ----------------------------------------------
register(425, "Total Cost of Ownership", "total-cost-of-ownership", compare(
    "Total cost of ownership: what the sticker price omits",
    [("Build in-house", "development owned end to end",
      ["Development effort", "Ongoing maintenance", "Staff retention and knowledge",
       "Infrastructure", "Full control of the roadmap"]),
     ("Buy a package", "licence plus adaptation",
      ["Licence and subscription", "Implementation and configuration",
       "Customisation", "Upgrade and version debt", "Exit and data extraction"])],
    caption="TCO compares lifetime cost, not purchase price.",
    footer="Heavy customisation is where a package quietly acquires the cost profile of in-house development."))

# -- 426  IT Outsourcing ----------------------------------------------------
register(426, "Why Organisations Outsource", "outsourcing-drivers", compare(
    "Why organisations outsource - and what it costs them",
    [("Drivers", "the reasons given",
      ["Cost reduction", "Access to scarce skills", "Focus on core business",
       "Faster scaling", "Converting fixed cost to variable"]),
     ("Risks", "what comes with it",
      ["Loss of internal capability", "Supplier lock-in",
       "Accountability stays with the client", "Watermelon SLAs",
       "Exit is expensive if unplanned"])],
    caption="Outsourcing transfers execution; it never transfers accountability.",
    footer="The client remains answerable to its own customers and regulators no matter who performs the work."))
