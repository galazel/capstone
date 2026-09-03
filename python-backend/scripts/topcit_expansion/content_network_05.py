"""Understanding of Network -> Emerging Network Technologies (MID 122).

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
most sections carrying more than one block, and no coloured card grids.

Topics were chosen against what is already in this major category so that
nothing overlaps: lesson 380 covers telecoms service architecture, SIP, RTP and
IMS, and lessons 381 and 382 cover M2M and IoT. None of them touches SDN, NFV
or overlay networking.
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_EMERGING = 122

SDN_DIAGRAM = "/lesson-media/sdn-central-idea.svg"
NFV_DIAGRAM = "/lesson-media/nfv.svg"
LEAFSPINE_DIAGRAM = "/lesson-media/leaf-spine.svg"
VXLAN_DIAGRAM = "/lesson-media/vxlan.svg"
# ===========================================================================
# Software-Defined Networking and Network Function Virtualization
# ===========================================================================

_sdn_sections = [
    ("The Problem SDN Was Invented to Solve", [
        desc(
            "In a traditional network every switch and router is an "
            "independent, self-contained computer. It runs its own routing "
            "protocol, reaches its own conclusions about the topology, and is "
            "configured individually through its own command line by a person "
            "who has logged into it."
        ),
        desc(
            "A network of four hundred devices is therefore four hundred "
            "separate configurations that must somehow remain mutually "
            "consistent, and any change of policy is a change made four "
            "hundred times. Nothing verifies that the four hundred agree, and "
            "in practice they drift."
        ),
    ]),

    ("Why It Stopped Working", [
        desc(
            "This arrangement was adequate while networks were small and "
            "changed slowly. It stopped being adequate when virtualisation "
            "arrived: a virtual machine could be created in seconds and needed "
            "the network reconfigured to match, while the network change went "
            "into a queue and emerged after a change advisory board meeting."
        ),
        desc(
            "That mismatch -- compute provisioned in seconds, network "
            "provisioned in weeks -- is the pressure that produced "
            "software-defined networking. It is worth noticing that the "
            "problem was organisational as much as technical: the network was "
            "not slow, the process of changing it was."
        ),
    ]),

    ("Three Planes in Every Network Device", [
        desc(
            "Understanding SDN requires separating three things that a "
            "traditional device does simultaneously. The vocabulary is used "
            "precisely in exams and is worth learning exactly."
        ),
        sub("Data plane"),
        desc(
            "Also called the forwarding plane. It moves packets: matches a "
            "packet against a table and sends it out of an interface. This is "
            "the fast path, implemented in dedicated hardware, and it happens "
            "millions of times a second. It performs no reasoning at all -- it "
            "looks up and acts."
        ),
        sub("Control plane"),
        desc(
            "Decides what the data plane's tables should contain. It runs "
            "routing protocols, builds the topology view, and computes best "
            "paths. It is slower, implemented in software, and it holds the "
            "network's intelligence. A device recalculating routes is doing "
            "control plane work while its data plane continues forwarding."
        ),
        sub("Management plane"),
        desc(
            "Configuration and monitoring: the command line, SNMP, telemetry, "
            "and the interfaces a human or a tool uses to inspect and change "
            "the device. It is neither forwarding nor deciding -- it is how "
            "the other two are operated."
        ),
    ]),

    ("The Central Idea", [
        desc(
            "Software-defined networking moves the control plane off the "
            "individual devices and into a logically centralised controller. "
            "The switches keep their data planes and become comparatively "
            "simple forwarding engines; the controller holds the whole "
            "topology, makes the decisions, and programs each device's "
            "forwarding tables."
        ),
        image(SDN_DIAGRAM),
    ]),

    ("The Network as a Platform", [
        desc(
            "The consequence is that the network becomes programmable as one "
            "system rather than as four hundred. Instead of translating a "
            "policy into four hundred device configurations, an application "
            "states the policy once to the controller, which works out what "
            "each device must be told and verifies that it was told."
        ),
        desc(
            "The network stops being a collection of boxes and starts being a "
            "platform with an interface. That shift -- from configuring "
            "devices to programming a system -- is the whole point, and it is "
            "what makes the comparison with server virtualisation apt."
        ),
    ]),

    ("Logically Centralised, Not Physically Centralised", [
        desc(
            "The phrase 'logically centralised' matters and is frequently "
            "misread as meaning one server somewhere. A single controller "
            "would be both a single point of failure -- lose it and no new "
            "flow rules can be installed -- and a bottleneck for every "
            "decision in the network."
        ),
        desc(
            "Production deployments therefore run a cluster that presents one "
            "consistent view while being distributed across several machines, "
            "usually with a consensus protocol keeping their state agreed. "
            "Centralisation is about having ONE AUTHORITATIVE VIEW of the "
            "network, not one physical server, and an exam option describing "
            "it as a single machine is wrong."
        ),
    ]),

    ("The SDN Architecture in Three Layers", [
        accordion([
            ("Application layer",
             "The programs that express what the network should do: traffic "
             "engineering, security policy, load balancing, monitoring, "
             "analytics. They consume the controller's abstract view of the "
             "network rather than talking to any device, and they can be "
             "written by people who know nothing about switch command lines."),
            ("Control layer",
             "The controller platform itself. Holds the topology database, "
             "computes forwarding state, mediates between applications above "
             "and devices below, and resolves conflicts when two applications "
             "want incompatible things. OpenDaylight and ONOS are the "
             "well-known open-source examples."),
            ("Infrastructure layer",
             "The switches and routers, reduced to programmable forwarding "
             "engines. They match packets against flow tables the controller "
             "installed and act on them. They still contain sophisticated "
             "hardware -- what they no longer contain is the decision-making."),
        ]),
    ]),

    ("Northbound and Southbound Interfaces", [
        desc(
            "The two interfaces around the controller have names worth "
            "memorising, and the direction convention is simple once stated: "
            "north is toward the applications, south is toward the hardware. "
            "Think of the three-layer diagram with applications at the top."
        ),
    ]),

    ("The Two Interfaces Compared", [
        tabs([
            ("Northbound", "Northbound interface",
             "Between applications and the controller, typically a REST API. "
             "It is where a program says what it WANTS -- isolate these two "
             "tenants, route this traffic over the low-latency path -- without "
             "knowing anything about the underlying switches. Deliberately not "
             "standardised, because the useful abstraction differs by use case "
             "and premature standardisation would have frozen it."),
            ("Southbound", "Southbound interface",
             "Between the controller and the devices. This is where forwarding "
             "rules are actually installed. OpenFlow is the best-known "
             "protocol here; NETCONF, OVSDB, gNMI and P4Runtime also appear. "
             "Standardisation matters far more on this side, because it is "
             "what allows one controller to drive equipment from several "
             "vendors."),
            ("East-west", "East-west interface",
             "Between controllers in a cluster, keeping their view of the "
             "network consistent. Less discussed than the other two but "
             "essential to the 'logically centralised' property, since it is "
             "what makes several machines behave as one authority."),
        ]),
    ]),

    ("OpenFlow and the Flow Table", [
        desc(
            "OpenFlow was the protocol that made SDN concrete rather than "
            "theoretical. A switch holds one or more flow tables, and each "
            "entry consists of three parts: match fields, a set of actions, "
            "and counters."
        ),
        desc(
            "A packet is matched against the entries in priority order, and "
            "the first matching entry determines what happens to it. This is "
            "deliberately similar to how an access control list works, which "
            "is why the model was easy for network engineers to adopt."
        ),
    ]),

    ("Inside a Flow Entry", [
        ol([
            "Match fields can span layers -- ingress port, source and "
            "destination MAC, VLAN, IP addresses, protocol, TCP or UDP ports "
            "-- which is why an OpenFlow switch is not simply a Layer 2 or "
            "Layer 3 device",
            "Actions include forwarding to a specific port, flooding, "
            "dropping, rewriting header fields, or sending the packet to the "
            "controller for a decision",
            "Counters record matches and byte totals per entry, giving the "
            "controller measurement without any separate monitoring protocol",
            "A priority value resolves overlapping entries, so a specific rule "
            "can sit above a general one",
            "A packet matching nothing is handled by the table-miss entry, "
            "which usually forwards it to the controller so a rule can be "
            "installed for it",
        ]),
    ]),

    ("Reactive and Proactive Rule Installation", [
        desc(
            "There are two ways to populate flow tables, and the trade-off "
            "between them is a favourite exam question because both have "
            "genuine costs."
        ),
        sub("Reactive"),
        desc(
            "Wait for the first packet of a flow to miss the table and be sent "
            "to the controller, which then installs a rule. This is flexible "
            "and uses table space efficiently, since only flows that actually "
            "occur consume entries. But the first packet of every flow pays a "
            "round trip to the controller, and a burst of new flows -- a "
            "scan, or a server restarting -- can overwhelm the controller "
            "entirely."
        ),
        sub("Proactive"),
        desc(
            "Push rules before any traffic arrives. No packet ever waits, and "
            "the network keeps working if the controller becomes unreachable, "
            "which is a significant resilience advantage. But rules must be "
            "anticipated, and they occupy finite table space whether they are "
            "ever used or not -- and switch flow table capacity is genuinely "
            "limited."
        ),
        desc(
            "Real deployments mix the two: proactive rules for the bulk of "
            "predictable traffic, reactive handling for the exceptions."
        ),
    ]),

    ("Network Function Virtualization", [
        desc(
            "NFV is a separate idea from SDN, and conflating them is by some "
            "distance the commonest error in this topic. NFV is about what a "
            "network function RUNS ON: it takes functions that were sold as "
            "dedicated appliances -- firewalls, load balancers, WAN "
            "optimisers, session border controllers, intrusion detection -- "
            "and runs them as software on general-purpose servers."
        ),
        image(NFV_DIAGRAM),
    ]),

    ("NFV Is Not SDN", [
        desc(
            "SDN separates the control plane from the data plane. NFV moves "
            "functions from purpose-built hardware onto commodity hardware. "
            "These are answers to different questions, and each is useful "
            "without the other."
        ),
        desc(
            "You can virtualise a firewall in a network whose switches each "
            "run their own routing protocol with no controller anywhere -- "
            "that is NFV without SDN. You can run an SDN-controlled network "
            "whose firewalls are all physical appliances -- that is SDN "
            "without NFV. They combine well, which is why they are usually "
            "discussed together, but an exam option claiming one implies the "
            "other is wrong."
        ),
    ]),

    ("Why NFV Is Attractive", [
        ul([
            "Hardware cost: commodity servers instead of proprietary "
            "appliances, with capacity added by adding instances rather than "
            "by forklift upgrade",
            "Deployment speed: a new function is a software deployment rather "
            "than a purchase order, a delivery and an installation visit",
            "Elasticity: instances scale up under load and are removed when it "
            "passes, so capacity follows demand rather than peak forecast",
            "Service chaining: traffic can be steered through an ordered set of "
            "virtual functions, and the order changed without recabling "
            "anything",
            "Testing: a virtual function can be duplicated into a test "
            "environment, which is impractical with a physical appliance",
        ]),
    ]),

    ("What NFV Costs", [
        desc(
            "The honest counterweight is performance. A purpose-built "
            "appliance with dedicated silicon still outperforms the same "
            "function in software on a general-purpose CPU, sometimes by an "
            "order of magnitude. This is why techniques such as kernel bypass, "
            "poll-mode drivers and hardware offload to the network card matter "
            "so much in NFV deployments -- they exist to claw back the gap."
        ),
        desc(
            "There is an operational cost too. An estate of virtual functions "
            "needs orchestration, lifecycle management, monitoring and "
            "capacity planning that a rack of appliances did not, and those "
            "systems are themselves things that can fail. NFV trades a "
            "hardware problem for a software-operations problem, which is "
            "usually a good trade and is not a free one."
        ),
    ]),

    ("Recognising Which Idea Is Which", [
        desc(
            "Since the two are examined together, it is worth being able to "
            "sort statements quickly."
        ),
        ul([
            "Separates control from forwarding: SDN",
            "Runs a firewall on a commodity server: NFV",
            "OpenFlow, NETCONF, a northbound REST API: SDN",
            "Service chaining of virtual appliances: NFV, though SDN is often "
            "what steers the traffic through them",
            "A logically centralised controller: SDN",
            "Orchestration and lifecycle management of function instances: NFV",
        ]),
    ]),

    ("Intent-Based Networking", [
        desc(
            "The direction SDN has taken since is intent-based networking, "
            "where the operator states a desired OUTCOME -- these two "
            "departments must not communicate; this application must have "
            "sub-10ms latency -- and the system works out the configuration "
            "that achieves it."
        ),
        desc(
            "The step beyond SDN is continuous verification. The system checks "
            "that the network still matches the stated intent and corrects it "
            "when it drifts, which addresses the configuration drift problem "
            "that motivated SDN in the first place. Stating intent without "
            "verifying it is just a nicer configuration interface."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Treating SDN and NFV as the same thing",
             "SDN is about where the control plane lives. NFV is about what "
             "hardware a network function runs on. They are independent, and "
             "each is deployed without the other in practice."),
            ("Reading 'centralised controller' as one server",
             "It means one logical view, delivered by a cluster with an "
             "east-west interface keeping it consistent. A literal single "
             "controller would be both a bottleneck and a single point of "
             "failure."),
            ("Assuming the controller forwards traffic",
             "It programs the devices that forward traffic. Except for packets "
             "explicitly punted to it -- table misses, and packets whose "
             "action says so -- user traffic never passes through the "
             "controller at all."),
            ("Thinking OpenFlow is a synonym for SDN",
             "OpenFlow is one southbound protocol, and an influential one, but "
             "SDN is an architecture. NETCONF, OVSDB, gNMI and P4Runtime all "
             "occupy the same role."),
            ("Expecting NFV to be free performance",
             "Software on general-purpose CPUs does not match dedicated "
             "forwarding silicon. NFV buys flexibility and pays for it in "
             "throughput unless offload techniques are applied deliberately."),
            ("Assuming reactive installation is simply better because it is "
             "flexible",
             "It costs first-packet latency on every new flow and makes the "
             "controller a bottleneck under a burst. Proactive costs table "
             "space instead, and real deployments mix them."),
        ]),
    ]),

    ("Practical Example: A Campus Adopting SDN", [
        desc(
            "A university needs to isolate a research network handling "
            "sensitive data from the general campus network, and the "
            "requirement changes every semester as projects start and finish "
            "and researchers move between buildings."
        ),
        desc(
            "Under the traditional model this means VLAN and access-list "
            "changes across dozens of switches, performed by hand, with each "
            "change an opportunity for an error that will not be noticed until "
            "something leaks. Nobody can state with confidence what the "
            "current policy actually is, only what it was intended to be."
        ),
    ]),

    ("The Same Requirement Under SDN", [
        desc(
            "With a controller, the isolation policy is expressed once as an "
            "application: hosts in the research group may communicate with "
            "each other and with a named set of servers, and with nothing "
            "else. The controller computes and installs the flow rules on "
            "every affected switch."
        ),
        desc(
            "When a project ends, the policy is edited in one place. More "
            "importantly, because the controller knows the whole topology and "
            "holds the intended state, it can VERIFY that the policy is "
            "actually in force rather than assuming that thirty manual edits "
            "were all applied correctly -- which is the difference between "
            "believing you are isolated and knowing it."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Which plane SDN centralises, and what each of the three planes "
            "does",
            "Northbound versus southbound, with a protocol named for each",
            "The structure of an OpenFlow flow entry and the role of the "
            "table-miss entry",
            "Reactive versus proactive installation and the specific cost of "
            "each",
            "The SDN/NFV distinction, usually as a scenario asking which one "
            "is being described",
            "Why 'logically centralised' is not 'physically centralised'",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Know the three planes and that SDN centralises the CONTROL plane",
            "Northbound faces applications (usually REST); southbound faces "
            "devices (OpenFlow, NETCONF)",
            "An OpenFlow entry is match fields, actions and counters, with a "
            "table-miss entry for unmatched packets",
            "Reactive costs first-packet latency; proactive costs table space",
            "SDN separates control from forwarding; NFV moves functions from "
            "appliances to commodity servers -- never conflate them",
            "The controller programs forwarding but does not carry user "
            "traffic",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Per-device configuration stopped scaling when compute became "
            "instant and network change did not",
            "SDN separates the control plane from the data plane and moves it "
            "into a logically centralised -- meaning clustered -- controller",
            "The controller programs devices; it does not carry user traffic",
            "Northbound interfaces express intent, southbound interfaces "
            "install forwarding state, east-west keeps controllers consistent",
            "OpenFlow flow tables match across several layers at once, which "
            "is why an SDN switch escapes the old device taxonomy",
            "NFV is an orthogonal idea about running network functions on "
            "commodity hardware, and its cost is raw forwarding performance",
            "Intent-based networking adds continuous verification, which is "
            "what closes the configuration drift problem",
        ]),
    ]),
]

_sdn_quiz = [
    mcq("EASY",
        "Which plane does software-defined networking move off individual "
        "devices and into a centralised controller?",
        [("The control plane", True),
         ("The data plane", False),
         ("The management plane", False),
         ("The physical plane", False)],
        "SDN's defining move is separating the control plane -- the part that "
        "decides what the forwarding tables should contain -- from the devices "
        "and centralising it. The data plane stays on the switches, since that "
        "is what actually forwards packets at hardware speed. The management "
        "plane is configuration and monitoring, and there is no 'physical "
        "plane' in this model."),
    mcq("EASY",
        "In SDN terminology, what does the southbound interface connect?",
        [("The controller to the network devices it programs", True),
         ("The controller to the applications that use it", False),
         ("One controller to another controller in a cluster", False),
         ("The network to external autonomous systems", False)],
        "South is toward the hardware: the southbound interface is where the "
        "controller installs forwarding state into switches, using protocols "
        "such as OpenFlow or NETCONF. The northbound interface faces "
        "applications, controller-to-controller communication is the east-west "
        "interface, and connections to other autonomous systems are a BGP "
        "matter entirely."),
    mcq("AVERAGE",
        "A network engineer says \"we deployed NFV, so our network is now "
        "software-defined.\"\n\nWhy is this reasoning flawed?",
        [("NFV moves network functions onto commodity hardware, which is a "
          "separate question from whether the control plane has been "
          "centralised.", True),
         ("NFV is an older term for exactly the same architecture, so the "
          "statement is merely redundant.", False),
         ("NFV applies only to wireless networks, so it cannot make a wired "
          "network software-defined.", False),
         ("NFV requires OpenFlow, and OpenFlow alone does not constitute "
          "SDN.", False)],
        "The two ideas are orthogonal. NFV concerns what hardware a firewall "
        "or load balancer runs on; SDN concerns where the control plane lives. "
        "An estate of virtualised functions can sit in an entirely traditional "
        "network whose switches each run their own routing protocol. They are "
        "not synonyms, NFV is not wireless-specific, and NFV does not require "
        "OpenFlow."),
    mcq("AVERAGE",
        "An OpenFlow switch receives a packet that matches no entry in its "
        "flow table.\n\nWhat normally happens?",
        [("The table-miss entry sends the packet to the controller, which may "
          "install a rule for it.", True),
         ("The switch floods the packet out of every port as a Layer 2 switch "
          "would.", False),
         ("The switch generates an ICMP unreachable message to the "
          "sender.", False),
         ("The packet is queued until an administrator adds a matching "
          "rule.", False)],
        "The table-miss entry defines behaviour for unmatched packets, and the "
        "usual configuration forwards them to the controller so a rule can be "
        "installed reactively. Flooding is traditional switch behaviour rather "
        "than OpenFlow's, ICMP generation is a router function, and packets "
        "are not held pending manual configuration."),
    mcq("AVERAGE",
        "What is the principal disadvantage of reactive flow rule installation "
        "compared with proactive installation?",
        [("The first packet of every new flow incurs a round trip to the "
          "controller, and a burst of new flows can overwhelm it.", True),
         ("Reactive rules consume far more flow table space than proactive "
          "rules.", False),
         ("Reactive installation requires a separate southbound protocol from "
          "proactive installation.", False),
         ("Reactive rules cannot match on Layer 4 port numbers.", False)],
        "Reactive installation only creates a rule once traffic has arrived, "
        "so the first packet waits for the controller and the controller "
        "becomes a bottleneck under a flood of new flows -- a port scan is the "
        "classic trigger. Table space is the ADVANTAGE of reactive "
        "installation, not its cost, since proactive rules occupy space "
        "whether used or not. The protocol and available match fields are "
        "identical either way."),
    mcq("AVERAGE",
        "Which SDN interface keeps multiple controllers in a cluster "
        "consistent with one another?",
        [("The east-west interface", True),
         ("The northbound interface", False),
         ("The southbound interface", False),
         ("The management interface", False)],
        "East-west runs between controllers and is what makes a cluster behave "
        "as a single authority -- the property that 'logically centralised' "
        "actually describes. Northbound faces applications, southbound faces "
        "devices, and the management interface is a device-level concept "
        "rather than part of the controller architecture."),
    mcq("HARD",
        "Why is an SDN controller described as \"logically centralised\" rather "
        "than simply \"centralised\"?",
        [("It presents one authoritative view of the network while running as "
          "a distributed cluster, avoiding a single point of failure and a "
          "bottleneck.", True),
         ("It is centralised only for control traffic, while management "
          "traffic remains distributed across devices.", False),
         ("It is centralised in each subnet, with one controller per broadcast "
          "domain.", False),
         ("The term is historical and both phrases mean a single physical "
          "server.", False)],
        "The value of centralisation is one consistent view of the whole "
        "network; the risk of literal centralisation is that everything "
        "depends on one machine, which would be both a bottleneck for every "
        "decision and a total outage when it failed. Production controllers "
        "resolve this by clustering with an east-west interface: distributed "
        "for availability and scale, single-view for decision-making."),
    mcq("HARD",
        "An OpenFlow flow entry can match on ingress port, MAC addresses, IP "
        "addresses and TCP ports at the same time.\n\nWhat does this imply "
        "about how an OpenFlow switch should be classified?",
        [("It does not fit the traditional layer-based device taxonomy, since "
          "one entry can act on information from several layers at once.", True),
         ("It is a Layer 2 device, because flow tables are an extension of the "
          "MAC address table.", False),
         ("It is a Layer 3 device, because it can match IP addresses.", False),
         ("It is a Layer 4 device, because the highest layer it matches "
          "determines its classification.", False)],
        "The traditional taxonomy assumes a device reads headers up to one "
        "layer and stops there, which is what makes 'Layer 2 switch' a "
        "meaningful description. An OpenFlow switch matches an arbitrary "
        "combination of fields across layers within a single entry, so "
        "classifying it at any one layer misdescribes what it does. This "
        "cross-layer matching is much of the point of the design."),
    short_answer("EASY",
        "Which southbound protocol is most closely associated with SDN and "
        "installs match-action rules into a switch's flow tables?",
        "OpenFlow",
        ["openflow", "open flow"]),
    short_answer("AVERAGE",
        "What does NFV stand for?",
        "Network Function Virtualization",
        ["network function virtualization", "network functions "
         "virtualization", "network function virtualisation", "nfv"]),
    descriptive("HARD",
        "Explain the difference between SDN and NFV, and describe a scenario "
        "in which deploying both together produces a benefit that neither "
        "delivers alone.",
        "SDN is an architectural change concerning where the control plane "
        "lives: it is separated from the individual forwarding devices and "
        "moved into a logically centralised controller -- in practice a "
        "cluster presenting one view -- which holds the whole topology and "
        "programs each device's forwarding tables through a southbound "
        "interface such as OpenFlow. NFV is a change concerning what hardware "
        "a network function runs on: firewalls, load balancers, WAN optimisers "
        "and similar functions that were sold as dedicated appliances are "
        "implemented as software on general-purpose servers. The two are "
        "independent -- a traditional network in which every switch runs its "
        "own routing protocol can perfectly well run virtualised firewalls, "
        "and an SDN-controlled network can steer traffic through physical "
        "appliances. Together they enable dynamic service chaining, which "
        "neither provides alone: NFV supplies network functions that can be "
        "instantiated on demand in seconds, and SDN supplies the programmable "
        "forwarding needed to steer a given tenant's traffic through a "
        "specific ordered sequence of those instances. A new customer "
        "requiring firewall, then intrusion detection, then load balancing can "
        "be provisioned by instantiating three virtual functions and having "
        "the controller install flow rules routing their traffic through those "
        "instances in order -- with no cabling, no appliance purchase, and the "
        "order changeable later by editing policy rather than by moving wires. "
        "Neither technology alone achieves this: NFV without SDN would require "
        "manual reconfiguration of forwarding on every device in the path, and "
        "SDN without NFV would require the physical appliances to exist and be "
        "cabled before any chain could be built.",
        [("Correctly defines SDN as control/data plane separation", 3),
         ("Correctly defines NFV as functions on commodity hardware", 3),
         ("Gives a scenario where the combination adds something neither "
          "delivers alone", 4)]),
]

LESSON_SDN = {
    "middle": MID_EMERGING,
    "name": "Software-Defined Networking and Network Function Virtualization",
    "quiz": _sdn_quiz,
    "structure": lesson_structure(
        "Software-Defined Networking and Network Function Virtualization",
        "The other lessons in this category are about devices at the edge of "
        "the network. This one is about what happened to the network itself. "
        "You will learn why per-device configuration stopped scaling once "
        "compute became instant, the three planes every network device "
        "contains and which one SDN relocates, what 'logically centralised' "
        "actually means and why the qualification matters, how northbound, "
        "southbound and east-west interfaces divide the architecture, how an "
        "OpenFlow flow entry is structured, the genuine trade-off between "
        "reactive and proactive rule installation, and how NFV differs from "
        "SDN -- a distinction that is the single most common error in this "
        "topic.",
        [
            "Explain why traditional per-device configuration does not scale "
            "in an environment where compute is provisioned in seconds",
            "Distinguish the data, control and management planes and say which "
            "SDN relocates",
            "Describe the three-layer SDN architecture and the controller's "
            "role in it",
            "Explain what 'logically centralised' means and why a single "
            "controller would be unacceptable",
            "Distinguish northbound, southbound and east-west interfaces and "
            "name a protocol for each",
            "Describe the structure of an OpenFlow flow entry and the purpose "
            "of the table-miss entry",
            "Compare reactive and proactive rule installation and state the "
            "cost of each",
            "Distinguish NFV from SDN, and state the benefits and the "
            "performance cost of NFV",
            "Explain what intent-based networking adds beyond SDN",
        ],
        55,
        _sdn_sections,
        [
            ("Data plane",
             "The forwarding path: matching packets against tables and sending "
             "them out of interfaces, in hardware. Stays on the device under "
             "SDN."),
            ("Control plane",
             "The decision-making function determining forwarding table "
             "contents. This is what SDN centralises."),
            ("Management plane",
             "Configuration and monitoring interfaces: CLI, SNMP, telemetry."),
            ("SDN controller",
             "The logically centralised platform holding the topology, "
             "computing forwarding state and programming the devices."),
            ("Northbound interface",
             "Between applications and the controller, usually a REST API. "
             "Where policy and intent are expressed."),
            ("Southbound interface",
             "Between controller and devices, where forwarding rules are "
             "installed. OpenFlow, NETCONF, OVSDB, gNMI, P4Runtime."),
            ("East-west interface",
             "Between controllers in a cluster, keeping their view consistent "
             "-- what makes 'logically centralised' true."),
            ("OpenFlow",
             "A southbound protocol defining flow tables whose entries consist "
             "of match fields, actions, counters and a priority."),
            ("Table-miss entry",
             "The flow entry handling packets that match nothing else, "
             "typically by sending them to the controller."),
            ("Reactive / proactive installation",
             "Reactive installs a rule when the first packet of a flow "
             "arrives, costing latency; proactive installs rules in advance, "
             "costing table space."),
            ("NFV",
             "Network Function Virtualization: running network functions as "
             "software on general-purpose servers instead of dedicated "
             "appliances."),
            ("Service chaining",
             "Steering traffic through an ordered sequence of network "
             "functions, reconfigurable without recabling."),
            ("Intent-based networking",
             "Stating a desired outcome and having the system derive, apply "
             "and continuously verify the configuration achieving it."),
        ],
        "Per-device configuration stopped scaling the moment a virtual machine "
        "could be created in seconds while the network change took weeks, and "
        "SDN is the response: separate the control plane from the data plane "
        "and move it into a logically centralised controller -- one "
        "authoritative view delivered by a cluster, not one server -- which "
        "programs the switches through a southbound protocol such as OpenFlow "
        "while applications express policy through a northbound API. The "
        "controller programs forwarding; it never carries user traffic. "
        "OpenFlow entries match across several layers at once, which is why an "
        "SDN switch escapes the old device taxonomy entirely, and rules arrive "
        "either reactively at first-packet cost or proactively at table-space "
        "cost, with real deployments mixing both. NFV is a separate idea "
        "altogether: moving network functions off appliances onto commodity "
        "servers, buying flexibility and elasticity and paying in raw "
        "forwarding performance unless offload is applied. The two combine to "
        "give dynamic service chaining that neither delivers alone -- but "
        "neither implies the other, and treating them as one thing is the "
        "mistake this topic is built to catch."),
}


# ===========================================================================
# Cloud and Data Centre Networking
# ===========================================================================

_dc_sections = [
    ("The Traffic Pattern Changed", [
        desc(
            "Classical enterprise network design assumed north-south traffic: "
            "clients at the edge talking to servers at the core, with most "
            "conversations crossing between the two. The hierarchy was built "
            "to funnel traffic upward efficiently, and it did."
        ),
        desc(
            "Data centre applications inverted the assumption completely. A "
            "single web request now fans out into dozens of internal calls "
            "between microservices, databases, caches and storage systems, and "
            "the great majority of packets never leave the building. This is "
            "east-west traffic, and it broke the design the old hierarchy was "
            "optimised for."
        ),
    ]),

    ("Why the Three-Tier Design Struggled", [
        desc(
            "The traditional access, aggregation and core hierarchy sent "
            "traffic upward and out. Two servers in different racks had to "
            "send packets up through aggregation and sometimes to the core and "
            "back down, so server-to-server latency depended on where the two "
            "machines happened to sit -- which is an unacceptable property "
            "when a scheduler places workloads automatically."
        ),
        desc(
            "Spanning Tree compounded it. To prevent Layer 2 loops it blocked "
            "redundant links entirely, which meant an organisation paid for "
            "capacity that was deliberately left idle and only became useful "
            "during a failure. In a design where east-west bandwidth is the "
            "scarce resource, discarding half of it is a serious cost."
        ),
    ]),

    ("Leaf-Spine Fabric", [
        desc(
            "The answer was to flatten the network. In a leaf-spine design, "
            "every leaf switch -- the top-of-rack switch the servers connect "
            "to -- has a link to every spine switch, and leaves never connect "
            "directly to each other. Any server reaches any other server by "
            "going up to a spine and back down."
        ),
        image(LEAFSPINE_DIAGRAM),
    ]),

    ("What Leaf-Spine Buys", [
        ul([
            "Predictable latency: exactly two switch hops between any pair of "
            "racks, regardless of position, so a scheduler can place workloads "
            "anywhere",
            "Horizontal scale: capacity is added by adding spines, which "
            "increases the bandwidth available to every leaf simultaneously",
            "Full link utilisation: equal-cost multipath uses every uplink "
            "rather than blocking all but one, since the fabric is routed "
            "rather than switched",
            "Predictable failure behaviour: losing one spine of four removes "
            "exactly a quarter of the inter-rack capacity and nothing else",
            "Simple growth: adding a rack means adding a leaf and cabling it "
            "to every spine, with no redesign",
        ]),
    ]),

    ("Oversubscription", [
        desc(
            "A leaf switch typically has more server-facing capacity than "
            "uplink capacity, and the ratio between them is the "
            "oversubscription ratio. It is a deliberate economic choice rather "
            "than a defect: building a fabric with no oversubscription is "
            "possible and expensive."
        ),
        desc(
            "A leaf carrying 40 servers at 25 Gbit/s has 1,000 Gbit/s of "
            "server capacity. With four 100 Gbit/s uplinks it has 400 Gbit/s "
            "of uplink, an oversubscription of 2.5:1. Whether that is "
            "acceptable depends entirely on whether the workload's servers "
            "transmit at line rate simultaneously -- which general enterprise "
            "applications do not and distributed storage or machine learning "
            "training absolutely does."
        ),
    ]),

    ("The Multi-Tenancy Problem", [
        desc(
            "A cloud data centre runs workloads for many tenants on shared "
            "physical infrastructure, and each tenant expects to see its own "
            "private network -- with its own address space, which will "
            "frequently collide with another tenant's, since everyone reaches "
            "for 10.0.0.0/8."
        ),
        desc(
            "The physical network has to carry all of it without letting any "
            "of it mix, and without requiring the provider to coordinate "
            "address assignments between customers who do not know one another "
            "exists."
        ),
    ]),

    ("Why VLANs Run Out", [
        desc(
            "VLANs cannot solve this at cloud scale, for two independent "
            "reasons and either alone would be fatal."
        ),
        desc(
            "The 802.1Q tag carries 12 bits of VLAN identifier, so a data "
            "centre can have at most 4,094 of them. That is ample for one "
            "enterprise and nowhere near enough for a public cloud with tens "
            "or hundreds of thousands of tenants. And a VLAN is a property of "
            "the physical switches, so creating one for a new tenant would "
            "mean reconfiguring physical network devices -- which cannot be "
            "exposed to customers and cannot happen at the speed cloud "
            "provisioning demands."
        ),
    ]),

    ("Overlay Networks", [
        desc(
            "The solution is to build a virtual network on top of the physical "
            "one. An overlay encapsulates a tenant's frames inside packets "
            "addressed between physical endpoints, so the physical network -- "
            "the underlay -- only ever sees ordinary traffic between hosts and "
            "needs to know nothing about tenants at all."
        ),
    ]),

    ("Underlay and Overlay", [
        sub("The underlay"),
        desc(
            "The physical fabric: leaves, spines, cabling, and a routing "
            "protocol providing any-to-any IP reachability between hosts. It "
            "is deliberately stable, simple, and rarely reconfigured -- the "
            "whole design goal is that tenant activity never touches it."
        ),
        sub("The overlay"),
        desc(
            "The tenant networks, built by encapsulating tenant traffic "
            "between endpoints on the hosts. Created and destroyed constantly, "
            "entirely in software, and completely invisible to the physical "
            "switches. A tenant creating a new network is a software operation "
            "on two hosts, not a change to any switch."
        ),
    ]),

    ("VXLAN", [
        desc(
            "VXLAN -- Virtual Extensible LAN -- is the dominant overlay "
            "encapsulation. It wraps a complete Ethernet frame inside a UDP "
            "packet, which means the tenant's Layer 2 network can span "
            "anything the underlay can route: across racks, across rows, and "
            "between data centres."
        ),
        image(VXLAN_DIAGRAM),
    ]),

    ("How VXLAN Encapsulation Works", [
        ol([
            "The tenant's complete Ethernet frame is taken as the payload",
            "A VXLAN header is added carrying a 24-bit VXLAN Network "
            "Identifier, which says which tenant segment the frame belongs to",
            "That is wrapped in UDP, then in an outer IP header addressed "
            "between the two tunnel endpoints, then in an outer Ethernet "
            "header for the first physical hop",
            "The underlay routes the outer packet exactly like any other IP "
            "traffic, with no knowledge of what is inside",
            "The receiving endpoint strips the encapsulation and delivers the "
            "original frame to the destination virtual machine or container",
        ]),
    ]),

    ("The 24-Bit Identifier and the VTEP", [
        desc(
            "The 24-bit identifier is the number to remember. It allows about "
            "16.7 million segments against a VLAN's 4,094, which is precisely "
            "the scaling problem VXLAN was created to solve -- a factor of "
            "roughly four thousand."
        ),
        desc(
            "The endpoints performing encapsulation and decapsulation are "
            "called VTEPs, VXLAN tunnel endpoints. They usually live in the "
            "hypervisor on each host, though they can also sit in the "
            "top-of-rack switch for workloads that are not virtualised. "
            "Because the VTEP is in software on the host, creating a tenant "
            "network never involves the physical network at all."
        ),
    ]),

    ("What Encapsulation Costs", [
        desc(
            "Overlays are not free, and the costs are the sort that appear "
            "later rather than during design. The added headers consume "
            "payload space -- roughly 50 bytes for VXLAN -- so either the "
            "tenant's effective MTU falls or the underlay must be configured "
            "with a larger MTU, jumbo frames, to absorb the overhead."
        ),
        desc(
            "Getting this wrong produces a distinctive and confusing symptom: "
            "small packets work perfectly, large transfers stall, and the "
            "fault looks like an application bug rather than a network one. "
            "Encapsulation and decapsulation also cost CPU on the hosts unless "
            "offloaded to the network card, and troubleshooting is harder "
            "because a capture on the physical network shows tunnel traffic "
            "between hosts rather than the tenant conversation actually in "
            "difficulty."
        ),
    ]),

    ("Where the Cloud Boundary Sits", [
        desc(
            "The service models divide responsibility for the network "
            "differently, and knowing which model puts the network in whose "
            "hands is regularly examined."
        ),
        tabs([
            ("IaaS", "Infrastructure as a Service",
             "The customer defines the virtual network: address ranges, "
             "subnets, route tables, security groups, gateways and peering. "
             "The provider supplies the physical fabric and the "
             "virtualisation. This is where a customer most needs the "
             "addressing and routing skills from the rest of this module, "
             "because they are doing network design."),
            ("PaaS", "Platform as a Service",
             "The customer deploys applications and configures connectivity "
             "and access at a service level -- which services may reach which "
             "others. Subnets and route tables are largely the provider's "
             "concern and often not exposed at all."),
            ("SaaS", "Software as a Service",
             "The customer configures identity and access, and nothing about "
             "the network beyond how users reach the service and possibly IP "
             "allow-listing."),
        ]),
    ]),

    ("Connecting the Enterprise to the Cloud", [
        desc("Deciding what runs in the cloud is only half the design. The "
             "other half is the path between the enterprise and the provider, "
             "and that path determines latency, throughput, cost and how badly "
             "an outage hurts. Three options dominate, and they trade price "
             "against predictability in that order."),
        accordion([
            ("Site-to-site VPN",
             "An encrypted tunnel over the public internet between the "
             "enterprise edge and the cloud virtual network. Quick to "
             "establish and inexpensive, but latency and throughput are "
             "whatever the internet provides on the day, and there is no "
             "contractual performance commitment."),
            ("Dedicated interconnect",
             "A private circuit into the provider's network, sold as Direct "
             "Connect, ExpressRoute or Interconnect depending on the provider. "
             "Predictable latency and bandwidth with a service level "
             "agreement, higher cost, and weeks of lead time to provision."),
            ("Virtual network peering",
             "Connecting two of the customer's own virtual networks directly. "
             "Requires that their address ranges do not overlap, which is why "
             "cloud address planning has to be done before anything is "
             "deployed rather than after."),
            ("Transit hub",
             "A central routing service to which many networks and sites "
             "attach, replacing a mesh of individual connections. The cloud "
             "equivalent of a hub-and-spoke WAN design, and the usual answer "
             "once the number of connections grows."),
        ]),
    ]),

    ("Security Groups and Microsegmentation", [
        desc(
            "Cloud platforms attach policy to the workload rather than to its "
            "location in the topology. A security group is a stateful filter "
            "applied to an instance's network interfaces, so two machines on "
            "the same subnet can have entirely different rules -- something a "
            "traditional network could only achieve by putting them in "
            "different VLANs and routing between them."
        ),
        desc(
            "This inverts the usual assumption. In a traditional design, "
            "position determines policy; in a cloud design, policy travels "
            "with the workload wherever the scheduler places it."
        ),
    ]),

    ("Microsegmentation and Zero Trust", [
        desc(
            "Taken to its conclusion this becomes microsegmentation: every "
            "workload carries its own policy, and lateral movement between "
            "machines is blocked by default rather than being freely available "
            "once an attacker is inside the perimeter."
        ),
        desc(
            "It is the practical network expression of the zero trust idea, "
            "and it matters specifically because most data centre traffic is "
            "east-west and therefore never crosses the perimeter where a "
            "traditional firewall sits. A perimeter-only security model "
            "inspects a small minority of the traffic in a modern data centre."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Trying to solve cloud multi-tenancy with VLANs",
             "4,094 identifiers is not a scale problem that can be engineered "
             "around, and VLANs must be configured on the physical switches, "
             "which cannot be exposed to tenants. Overlays exist because VLANs "
             "genuinely cannot do this job."),
            ("Ignoring MTU when introducing an overlay",
             "VXLAN headers consume roughly 50 bytes of payload. Left "
             "unaddressed the symptom is bizarre: small packets work, large "
             "transfers stall, and the fault looks like an application bug."),
            ("Overlapping address ranges across cloud networks",
             "Two virtual networks that both use 10.0.0.0/16 cannot be peered, "
             "because a destination existing in both is ambiguous. This is "
             "discovered late and is expensive to unwind, which is why address "
             "planning must precede deployment."),
            ("Assuming east-west traffic is inherently trusted",
             "Most data centre traffic never crosses the perimeter, so a "
             "perimeter-only model inspects a small minority of it. "
             "Microsegmentation exists precisely because of this."),
            ("Treating a leaf-spine fabric as a Layer 2 network",
             "Leaf-spine relies on routed equal-cost paths. Stretching "
             "Spanning Tree across it reintroduces the blocked links the "
             "design was chosen to eliminate."),
            ("Reading the oversubscription ratio as a defect",
             "It is an economic choice. Whether 2.5:1 is fine or fatal depends "
             "entirely on whether the workload saturates many server links "
             "simultaneously."),
        ]),
    ]),

    ("Practical Example: Sizing a Fabric", [
        desc(
            "A data centre has 20 racks, each with a leaf switch carrying 40 "
            "servers at 25 Gbit/s. That is 1 Tbit/s of potential traffic "
            "leaving each rack if every server transmitted at line rate "
            "simultaneously."
        ),
        desc(
            "With four spine switches, each leaf needs four uplinks. If those "
            "uplinks are 100 Gbit/s, the leaf has 400 Gbit/s of uplink against "
            "1 Tbit/s of server capacity -- an oversubscription ratio of "
            "2.5:1. The design question is not whether that number is good but "
            "whether it matches the workload."
        ),
    ]),

    ("Reading the Ratio Against the Workload", [
        desc(
            "For general enterprise applications -- web servers, business "
            "applications, databases serving interactive queries -- servers "
            "rarely transmit at line rate simultaneously, and 2.5:1 is "
            "comfortable and economical. Building a non-oversubscribed fabric "
            "for that workload would waste a great deal of money on spine "
            "capacity that never carries traffic."
        ),
        desc(
            "For a distributed storage cluster rebuilding after a disk "
            "failure, or a machine learning training job whose nodes exchange "
            "gradients every iteration, every server transmits at once and "
            "2.5:1 becomes the bottleneck dominating job completion time. The "
            "fix is more spines or faster uplinks, and knowing which to buy is "
            "exactly why the calculation is worth doing before the racks are "
            "ordered rather than after."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "East-west versus north-south, and why the shift mattered",
            "Leaf-spine properties: hop count, equal-cost multipath, and why "
            "Spanning Tree is absent",
            "The VLAN identifier size against the VXLAN identifier size, and "
            "the consequence",
            "What VXLAN encapsulates in what, and what a VTEP is",
            "The MTU consequence of encapsulation, usually as a symptom-based "
            "scenario",
            "Which cloud service model leaves the network to the customer",
            "Why overlapping address ranges prevent peering",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "East-west is server-to-server inside the data centre; north-south "
            "is in and out",
            "Leaf-spine gives exactly two hops between any two racks and uses "
            "every uplink",
            "VLAN IDs are 12 bits (4,094 usable); VXLAN IDs are 24 bits (about "
            "16.7 million)",
            "VXLAN encapsulates Ethernet frames in UDP; the endpoints are "
            "VTEPs",
            "Underlay is the physical routed fabric; overlay is the tenant "
            "networks built on it",
            "Overlays demand MTU planning, and peered cloud networks must not "
            "have overlapping address ranges",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Data centre traffic is predominantly east-west, which is what "
            "made the three-tier hierarchy unsuitable",
            "Leaf-spine fabrics give uniform two-hop latency and use every "
            "link, at the cost of requiring a routed rather than switched "
            "design",
            "Oversubscription is an economic choice whose acceptability "
            "depends entirely on the workload",
            "VLANs cannot scale to cloud multi-tenancy, on both identifier "
            "count and configuration grounds",
            "VXLAN's 24-bit identifier is the direct answer to the 12-bit VLAN "
            "limit, and it costs MTU, CPU and troubleshooting clarity",
            "Cloud service models divide network responsibility differently, "
            "with IaaS leaving the most to the customer",
            "Security groups attach policy to the workload rather than to its "
            "location, which is what makes microsegmentation possible",
        ]),
    ]),
]

_dc_quiz = [
    mcq("EASY",
        "What does east-west traffic mean in a data centre?",
        [("Traffic between servers inside the data centre", True),
         ("Traffic between the data centre and external clients", False),
         ("Traffic between two data centres in different regions", False),
         ("Traffic between the management network and the production "
          "network", False)],
        "East-west describes server-to-server traffic within the facility, "
        "which modern distributed applications generate in far greater volume "
        "than the north-south traffic flowing in and out to clients. The shift "
        "toward east-west is what made the traditional three-tier hierarchy "
        "unsuitable."),
    mcq("EASY",
        "In a leaf-spine fabric, how many switch hops separate two servers in "
        "different racks?",
        [("Two: up to a spine and back down to the destination leaf", True),
         ("One: leaf switches connect directly to each other", False),
         ("Three: leaf, aggregation, then spine", False),
         ("It varies depending on which racks the servers occupy", False)],
        "Every leaf connects to every spine and leaves never connect to each "
        "other, so the path is always leaf-spine-leaf. That uniformity is the "
        "point: latency between racks no longer depends on where the machines "
        "happen to sit, which is what allows a scheduler to place workloads "
        "freely. There is no aggregation tier in a leaf-spine design."),
    mcq("AVERAGE",
        "Why can VLANs not provide tenant isolation in a large public cloud?",
        [("The 802.1Q VLAN identifier is 12 bits, allowing only 4,094 usable "
          "segments, and VLANs must be configured on the physical "
          "switches.", True),
         ("VLANs cannot carry IP traffic, only Ethernet broadcasts.", False),
         ("VLANs require every tenant to use a unique IP address range.", False),
         ("VLAN tags are stripped by routers, so isolation is lost the moment "
          "traffic is routed.", False)],
        "Twelve bits of VLAN identifier yields 4,094 usable segments, ample "
        "for one enterprise and hopeless for a cloud with tens of thousands of "
        "tenants; and because a VLAN is a property of the physical switches, "
        "tenant changes would mean switch changes that cannot be exposed to "
        "customers. Either reason alone is fatal. VLANs carry IP traffic "
        "perfectly well and do not constrain tenant addressing."),
    mcq("AVERAGE",
        "How many network segments can VXLAN's identifier distinguish, and how "
        "does that compare with VLAN?",
        [("About 16.7 million, because the VXLAN Network Identifier is 24 "
          "bits, against 4,094 for a 12-bit VLAN identifier", True),
         ("About 65,000, because the VXLAN identifier is 16 bits, against "
          "4,094 for VLAN", False),
         ("About 4 billion, because the VXLAN identifier is 32 bits, against "
          "4,094 for VLAN", False),
         ("The same 4,094, but VXLAN allows them to span data centres", False)],
        "The VNI is 24 bits, giving 2^24 -- roughly 16.7 million -- segments, "
        "a factor of about four thousand more than VLAN, which is exactly why "
        "VXLAN replaced VLANs for cloud multi-tenancy. The other options "
        "misstate the field width; and while VXLAN does let a segment span "
        "sites, that is an additional benefit rather than the scaling answer."),
    mcq("AVERAGE",
        "After introducing a VXLAN overlay, small packets between virtual "
        "machines succeed but large file transfers stall.\n\nWhat is the most "
        "likely cause?",
        [("The encapsulation headers push large frames past the underlay's "
          "MTU, so oversized packets are dropped.", True),
         ("The VXLAN network identifier has been exhausted by the number of "
          "tenants.", False),
         ("The leaf-spine fabric is blocking redundant links via Spanning "
          "Tree.", False),
         ("Security groups are filtering large packets as a denial-of-service "
          "protection.", False)],
        "VXLAN adds roughly 50 bytes of outer Ethernet, IP, UDP and VXLAN "
        "headers, so a frame already at the MTU no longer fits. Small packets "
        "have room to spare and succeed; large ones are dropped, which looks "
        "like an application fault rather than a network one. The usual fix is "
        "jumbo frames on the underlay. Identifier exhaustion would prevent "
        "segments being created at all, Spanning Tree is not used in a routed "
        "fabric, and security groups do not filter on size."),
    mcq("AVERAGE",
        "Which cloud service model leaves the customer responsible for "
        "defining subnets, route tables and security groups?",
        [("IaaS", True), ("PaaS", False), ("SaaS", False),
         ("All three equally", False)],
        "Infrastructure as a Service gives the customer the virtual network to "
        "design: address ranges, subnets, routing, security groups, gateways "
        "and peering. PaaS exposes connectivity at a service level with "
        "subnets largely hidden, and SaaS exposes essentially nothing beyond "
        "identity and possibly IP allow-listing."),
    mcq("HARD",
        "A leaf switch carries 40 servers at 25 Gbit/s and has four 100 Gbit/s "
        "uplinks to the spines.\n\nWhat is the oversubscription ratio, and "
        "when does it matter?",
        [("2.5:1, and it matters when workloads saturate many server links "
          "simultaneously, as distributed storage or ML training does", True),
         ("2.5:1, and it never matters because equal-cost multipath eliminates "
          "contention", False),
         ("1:2.5, meaning uplink capacity exceeds server capacity and no "
          "contention is possible", False),
         ("4:1, calculated from the four uplinks against a single server "
          "link", False)],
        "Server capacity is 40 x 25 = 1,000 Gbit/s and uplink capacity is 4 x "
        "100 = 400 Gbit/s, so the ratio is 1,000:400, or 2.5:1. It is harmless "
        "for workloads whose servers rarely transmit at line rate together and "
        "a hard bottleneck for those that do. Multipath spreads traffic across "
        "uplinks but creates no capacity, the ratio is not inverted, and "
        "counting uplinks alone ignores the server side entirely."),
    mcq("HARD",
        "Two cloud virtual networks both use 10.0.0.0/16 and the customer now "
        "wants to peer them.\n\nWhat is the outcome and the underlying "
        "principle?",
        [("Peering is not possible, because routing cannot disambiguate a "
          "destination that exists identically in both networks.", True),
         ("Peering succeeds, because the overlay keeps the two address spaces "
          "separate by tenant identifier.", False),
         ("Peering succeeds only if both networks are in the same "
          "region.", False),
         ("Peering succeeds, but security groups must be disabled on both "
          "sides.", False)],
        "Once two networks are joined into one routing domain, an address "
        "existing in both is ambiguous and there is no correct forwarding "
        "decision to make. Overlays isolate tenants precisely by keeping them "
        "apart, so joining them removes the very separation that made the "
        "overlap tolerable. Region and security group settings are unrelated. "
        "This is why cloud address planning must precede deployment."),
    short_answer("EASY",
        "What is the name of the endpoint that performs VXLAN encapsulation "
        "and decapsulation? Give the acronym.",
        "VTEP",
        ["vtep", "vxlan tunnel endpoint", "vxlan tunnel end point"]),
    short_answer("AVERAGE",
        "What term describes the physical IP fabric that carries encapsulated "
        "overlay traffic in a data centre?",
        "Underlay",
        ["underlay", "the underlay", "underlay network"]),
    descriptive("HARD",
        "Explain why a public cloud provider builds tenant networks as "
        "overlays on a routed underlay rather than configuring isolation "
        "directly on the physical switches, and identify two costs of the "
        "approach.",
        "Configuring isolation on the physical switches means using VLANs, "
        "which fails at cloud scale on two independent counts. The 802.1Q "
        "identifier is only 12 bits, giving 4,094 usable segments, where a "
        "public cloud needs isolation for tens or hundreds of thousands of "
        "tenants; and because a VLAN is a property of the switches themselves, "
        "every tenant creation or change would require reconfiguring physical "
        "devices, which cannot safely be exposed to customers and cannot "
        "happen at the speed cloud provisioning demands -- a tenant expects a "
        "network in seconds, not after a change window. An overlay solves "
        "both. Tenant frames are encapsulated -- typically in VXLAN, whose "
        "24-bit identifier allows about 16.7 million segments -- inside "
        "ordinary IP packets addressed between tunnel endpoints (VTEPs) "
        "running in software on the hosts. The physical underlay only has to "
        "provide any-to-any IP reachability between those hosts and never "
        "learns that tenants exist, so it stays simple and stable while tenant "
        "networks are created and destroyed entirely in software. The costs "
        "are real. First, encapsulation consumes roughly 50 bytes of payload, "
        "so either the tenant MTU falls or the underlay must run jumbo frames; "
        "getting this wrong produces a confusing failure in which small "
        "packets succeed and large transfers stall, looking like an "
        "application bug. Second, encapsulation and decapsulation consume host "
        "CPU unless offloaded to the network adapter, and troubleshooting "
        "becomes considerably harder because a packet capture on the physical "
        "network shows tunnel traffic between hosts rather than the tenant "
        "conversation actually being investigated.",
        [("Explains the VLAN identifier limit and the physical configuration "
          "limit", 4),
         ("Explains how the overlay/underlay split resolves both", 3),
         ("Identifies two genuine costs of encapsulation", 3)]),
]

LESSON_DATACENTRE = {
    "middle": MID_EMERGING,
    "name": "Cloud and Data Centre Networking",
    "quiz": _dc_quiz,
    "structure": lesson_structure(
        "Cloud and Data Centre Networking",
        "Data centre networks are built on different assumptions from campus "
        "networks, and this lesson covers what changed and why. You will learn "
        "why east-west traffic broke the three-tier hierarchy, how leaf-spine "
        "fabrics give uniform latency and use every link, what an "
        "oversubscription ratio actually tells you and why the same figure can "
        "be comfortable or fatal, why VLANs cannot provide multi-tenancy at "
        "cloud scale on two independent grounds, how overlay networks and "
        "VXLAN solve it and exactly what they cost, how the cloud service "
        "models divide responsibility for the network, and how "
        "microsegmentation attaches policy to workloads rather than to "
        "locations.",
        [
            "Distinguish east-west from north-south traffic and explain why "
            "the shift mattered",
            "Describe a leaf-spine fabric and its advantages over a three-tier "
            "hierarchy",
            "Calculate an oversubscription ratio and judge it against a "
            "workload",
            "Explain the two independent reasons VLANs cannot provide cloud "
            "multi-tenancy",
            "Explain the underlay/overlay split and how VXLAN encapsulation "
            "works step by step",
            "State VXLAN's identifier size, compare it with VLAN's, and "
            "identify the costs of encapsulation",
            "Compare IaaS, PaaS and SaaS in terms of who controls the network",
            "Describe the main enterprise-to-cloud connection options and the "
            "address planning they require",
            "Explain security groups and microsegmentation, and why they "
            "matter given east-west traffic volumes",
        ],
        55,
        _dc_sections,
        [
            ("East-west traffic",
             "Server-to-server traffic within a data centre, which dominates "
             "modern distributed applications."),
            ("North-south traffic",
             "Traffic between the data centre and the outside world."),
            ("Leaf-spine fabric",
             "A two-tier design in which every leaf connects to every spine "
             "and no leaf connects to another, giving uniform two-hop paths."),
            ("Equal-cost multipath",
             "Distributing traffic across several equally good paths, which is "
             "how a leaf-spine fabric uses all uplinks instead of blocking "
             "them."),
            ("Oversubscription ratio",
             "Server-facing capacity divided by uplink capacity on a leaf "
             "switch. An economic choice whose acceptability depends on the "
             "workload."),
            ("Underlay",
             "The physical routed IP fabric providing any-to-any reachability "
             "between hosts, unaware of tenants."),
            ("Overlay",
             "Virtual tenant networks built by encapsulating tenant traffic "
             "over the underlay, created and destroyed in software."),
            ("VXLAN",
             "Virtual Extensible LAN. Encapsulates Ethernet frames in UDP with "
             "a 24-bit network identifier allowing about 16.7 million "
             "segments."),
            ("VTEP",
             "VXLAN Tunnel Endpoint: the point, usually in a hypervisor, that "
             "encapsulates and decapsulates."),
            ("Security group",
             "A stateful filter attached to a workload's interfaces, so policy "
             "follows the workload rather than its subnet."),
            ("Microsegmentation",
             "Per-workload policy blocking lateral movement by default -- the "
             "network expression of zero trust."),
        ],
        "Data centre traffic became predominantly east-west, and the "
        "three-tier hierarchy -- optimised for traffic heading out, and "
        "hobbled by Spanning Tree blocking half the links -- could not serve "
        "it. Leaf-spine fabrics flatten the network so any two racks are "
        "exactly two hops apart and every uplink carries traffic, with the "
        "oversubscription ratio left as a deliberate economic choice that is "
        "comfortable for enterprise applications and fatal for distributed "
        "storage. Multi-tenancy defeated VLANs on two independent grounds: 12 "
        "bits of identifier is nowhere near enough, and switch configuration "
        "cannot be exposed to tenants. So tenant networks became overlays, "
        "with VXLAN wrapping Ethernet frames in UDP behind a 24-bit identifier "
        "while the underlay does nothing but route -- at a cost in MTU "
        "planning, host CPU and troubleshooting clarity. Cloud service models "
        "then divide the network differently, with IaaS handing the customer a "
        "genuine network design job, and address planning must precede "
        "deployment because overlapping ranges cannot be peered. Above all "
        "this, security groups attach policy to workloads rather than "
        "locations, which is what makes microsegmentation possible -- and "
        "necessary, since most data centre traffic never passes the perimeter "
        "at all."),
}

LESSONS = [LESSON_SDN, LESSON_DATACENTRE]
