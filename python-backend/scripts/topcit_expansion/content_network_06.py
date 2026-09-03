"""Understanding of Network -> Emerging Network Technologies (MID 122).

Fifth and final lesson for this middle category: the mobile network. Rebuilt to
the format the system's own lessons use -- roughly 4,900 words over 28-40
sections, about 46 blocks, diagrams where a picture does the explaining, and no
coloured card grids.

Deliberately scoped away from lesson 380, "Network Service Architecture", which
already covers SIP, IMS, UICC-based authentication and session control in
depth. This lesson stays on the network architecture itself and does not
revisit service signalling.
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_EMERGING = 122

EPC_DIAGRAM = "/lesson-media/4g-core.svg"
SLICING_DIAGRAM = "/lesson-media/network-slicing.svg"
_mob_sections = [
    ("Two Halves of Every Mobile Network", [
        desc(
            "However the generations change, a mobile network divides into the "
            "same two parts. The radio access network is everything between "
            "the handset and the mast: the air interface, the spectrum, the "
            "base stations and their antennas. The core network is everything "
            "behind it: the systems that authenticate the subscriber, decide "
            "what service they are entitled to, track where they are, and "
            "route their traffic onward."
        ),
        desc(
            "This division is the single most useful organising idea in the "
            "topic, because the two halves evolve for entirely different "
            "reasons and are examined separately."
        ),
    ]),

    ("Why the Division Matters", [
        desc(
            "Almost every generational headline -- higher speeds, new "
            "spectrum, massive MIMO, millimetre wave -- is a radio access "
            "change. Almost every architectural change that matters to a "
            "network engineer -- the move to packet switching, "
            "virtualisation, slicing, edge computing -- happened in the core."
        ),
        desc(
            "Keeping this straight prevents a common confusion. A learner who "
            "thinks of 5G purely as 'faster radio' cannot explain why it "
            "matters professionally, because the professionally interesting "
            "changes are not in the radio at all."
        ),
    ]),

    ("The Generations at a Glance", [
        desc(
            "Each generation is sold on speed, and each actually solved a "
            "different structural problem. Reading the sequence by what "
            "changed architecturally rather than by the headline data rate is "
            "what makes the progression make sense rather than seeming like an "
            "arbitrary series of numbers."
        ),
    ]),

    ("Four Generations Compared", [
        tabs([
            ("2G", "2G - digital voice",
             "GSM. Digitised voice with circuit switching, plus SMS added "
             "almost as an afterthought and unexpectedly becoming enormous. "
             "Data arrived later as GPRS and EDGE, bolted on at a few hundred "
             "kilobits per second. The subscriber identity module was "
             "introduced here, making the subscriber separable from the "
             "handset -- which is why a SIM card can be moved between "
             "phones."),
            ("3G", "3G - data as a first-class service",
             "UMTS. Data became a designed-in service rather than an "
             "afterthought, with megabit speeds. The core still had two "
             "halves, though: a circuit-switched domain for voice inherited "
             "from telephony, alongside a packet-switched domain for data. Two "
             "networks, two sets of equipment, two operational practices."),
            ("4G", "4G - all-IP",
             "LTE. The circuit-switched domain was abolished outright: "
             "everything, voice included, became IP packets. Voice over LTE "
             "runs as a service on the data network rather than beside it. "
             "This is the single biggest architectural break in the entire "
             "sequence, and it is the one exams return to."),
            ("5G", "5G - a programmable network",
             "New radio with much wider bandwidth and millimetre-wave "
             "spectrum, but the deeper change is a service-based core, network "
             "slicing and edge computing. 5G is defined as much by what the "
             "core can be configured to do as by how fast the radio is."),
        ]),
    ]),

    ("Why 4G's All-IP Core Mattered", [
        desc(
            "Before LTE, a mobile operator genuinely ran two networks. A "
            "circuit-switched one for voice, inherited directly from the "
            "telephone network, in which a call reserved a dedicated path for "
            "its duration. And a packet-switched one for data, which behaved "
            "like the internet. Each had its own equipment, its own "
            "operational practices, its own staff expertise and its own "
            "failure modes."
        ),
        desc(
            "The Evolved Packet Core removed the first entirely. Voice became "
            "an application carried over IP like any other, which meant one "
            "network to build, operate and understand instead of two."
        ),
    ]),

    ("Mobile Networks Became IP Networks", [
        desc(
            "The consequence for anyone studying this module is direct: from a "
            "network engineer's point of view, a mobile network became an IP "
            "network with an unusual access technology. Everything in the "
            "addressing, routing and transport lessons applies to it."
        ),
        desc(
            "Voice quality on a modern mobile network is therefore a "
            "quality-of-service configuration problem -- marking, queuing and "
            "scheduling -- rather than a property of dedicated circuits. That "
            "is a very different discipline from traditional telephony "
            "engineering, and it is why mobile operators began hiring IP "
            "engineers."
        ),
    ]),

    ("The 4G Core in Four Elements", [
        desc(
            "The Evolved Packet Core is easier to hold in mind as four named "
            "responsibilities than as a diagram of acronyms. One element runs "
            "the radio link, one makes the control decisions, and two carry "
            "user traffic -- one inside the operator's network and one at its "
            "edge."
        ),
        image(EPC_DIAGRAM),
    ]),

    ("The Four Elements in Detail", [
        accordion([
            ("eNodeB",
             "The 4G base station. Handles the radio link, schedules the air "
             "interface between competing devices, and makes handover "
             "decisions as a device moves. It sits in the radio access network "
             "rather than the core, but it is the core's counterpart in every "
             "procedure."),
            ("MME - Mobility Management Entity",
             "The control-plane brain. Authenticates the subscriber, tracks "
             "which tracking area the device is in, and sets up and tears down "
             "the bearers that carry its traffic. Crucially, it handles no "
             "user data itself -- not one packet of the subscriber's traffic "
             "passes through it."),
            ("SGW - Serving Gateway",
             "The user-plane anchor within the operator's network. Forwards "
             "the subscriber's packets and keeps the session intact as the "
             "device moves between base stations, so a handover does not break "
             "an in-progress download."),
            ("PGW - Packet Data Network Gateway",
             "The exit to the outside world. Allocates the device's IP "
             "address, enforces policy and charging rules, and connects to the "
             "internet or to a corporate network. It is where the mobile "
             "network meets everything else."),
        ]),
    ]),

    ("Control Plane and User Plane, Again", [
        desc(
            "The MME/SGW split is the same separation of control plane from "
            "user plane that software-defined networking applies to switches. "
            "One set of functions decides what should happen; another moves "
            "the packets."
        ),
        desc(
            "Recognising the pattern is worth considerably more than "
            "memorising the acronyms, because 5G takes the same idea "
            "significantly further and the exam questions reward understanding "
            "why the separation is useful rather than which letters go with "
            "which box."
        ),
    ]),

    ("What 5G Changed in the Core", [
        desc(
            "5G replaced the fixed set of boxes with a service-based "
            "architecture. Core functions are software services that expose "
            "APIs and call one another over HTTP/2, rather than fixed nodes "
            "joined by purpose-built interfaces with their own protocols."
        ),
        desc(
            "In practice this means the core is deployed the way a cloud "
            "application is deployed -- containers, orchestration, rolling "
            "updates -- and the NFV ideas from the previous lesson are exactly "
            "what make that possible. A 5G core running on commodity servers "
            "is NFV applied to telecoms."
        ),
    ]),

    ("The 5G Core Functions", [
        ul([
            "AMF, Access and Mobility Management Function: the control-plane "
            "successor to the MME, handling registration and mobility",
            "SMF, Session Management Function: sets up and manages sessions, "
            "now separated from mobility rather than combined with it",
            "UPF, User Plane Function: forwards user traffic, and can be "
            "placed wherever it is needed rather than only in a central site",
            "AUSF and UDM: authentication and subscriber data management, "
            "separated so that subscriber records are a service others query",
            "NRF, Network Repository Function: lets functions discover one "
            "another, which is what makes the service-based architecture work "
            "operationally",
        ]),
    ]),

    ("Why the SMF/UPF Split Is the Important One", [
        desc(
            "Of all the 5G core changes, separating session management from "
            "the user plane is the one with the largest practical consequence. "
            "Because the function that FORWARDS packets is now independent of "
            "the function that MANAGES sessions, the forwarding function can be "
            "placed anywhere."
        ),
        desc(
            "A UPF can sit in a central data centre for ordinary traffic, or "
            "at a factory, port or stadium for traffic that must stay local. "
            "Session control remains centralised while the data path becomes "
            "local, and that is precisely what makes edge computing practical "
            "rather than theoretical."
        ),
    ]),

    ("Network Slicing", [
        desc(
            "Slicing is 5G's most distinctive capability. One physical network "
            "is partitioned into several logical networks, each with its own "
            "performance characteristics, and each behaving to its users as "
            "though it were a dedicated network built for them."
        ),
        image(SLICING_DIAGRAM),
    ]),

    ("Why a Slice Is Not Quality of Service", [
        desc(
            "This distinction is examined directly and is worth stating "
            "carefully. Quality of service prioritises packets within one "
            "shared network: everyone shares the same resources, and marking "
            "decides who goes first when they contend."
        ),
        desc(
            "A slice is a logical network of its own, defined end to end "
            "across radio, transport and core, with its own allocated "
            "resources and potentially its own instances of core functions. "
            "The difference matters because a slice can offer a genuinely "
            "different BEHAVIOUR -- different latency characteristics, "
            "different reliability guarantees -- rather than merely a "
            "different position in a queue."
        ),
    ]),

    ("Three Slice Profiles", [
        desc(
            "5G's requirements were written around three service profiles that "
            "pull in genuinely different directions, which is precisely why no "
            "single network configuration can serve all three well."
        ),
        sub("eMBB - enhanced mobile broadband"),
        desc(
            "High throughput for video, browsing and general consumer data. "
            "Optimises for bandwidth and tolerates modest latency. This is the "
            "profile that produces the headline speed figures, and it is what "
            "most consumers actually experience."
        ),
        sub("URLLC - ultra-reliable low-latency communication"),
        desc(
            "Millisecond latency and very high reliability for factory "
            "automation, remote control and vehicle applications. It "
            "deliberately sacrifices throughput to obtain determinism, because "
            "a control loop needs its packet on time far more than it needs a "
            "large packet."
        ),
        sub("mMTC - massive machine-type communication"),
        desc(
            "Enormous numbers of low-power sensors sending small amounts of "
            "data infrequently. Optimises for device density and battery life, "
            "and cares very little about speed. This is the profile that "
            "connects to the IoT lessons elsewhere in this category."
        ),
    ]),

    ("Why Slicing Needs Virtualisation", [
        desc(
            "A slice is only meaningful if the resources behind it can "
            "actually be separated and assigned, which means the core "
            "functions must be software that can be instantiated per slice."
        ),
        desc(
            "This is why 5G and NFV arrived together rather than "
            "coincidentally. Without virtualised network functions, slicing "
            "would require physically duplicated equipment for each slice and "
            "would never have been economically viable. The two technologies "
            "are dependent rather than merely complementary."
        ),
    ]),

    ("Multi-Access Edge Computing", [
        desc(
            "Some applications cannot tolerate the round trip to a central "
            "data centre, and the reason is not congestion or capacity but "
            "physics. The speed of light puts a floor under it: a thousand "
            "kilometres and back is roughly ten milliseconds before any "
            "processing has happened at all."
        ),
        desc(
            "Multi-access edge computing moves compute to the operator's own "
            "sites, close to the base station, so the round trip is a fraction "
            "of that. No amount of capacity at the far end can substitute, "
            "which is why this is an architectural change rather than a "
            "capacity decision."
        ),
    ]),

    ("What the Edge Buys", [
        ul([
            "Latency: augmented reality, cloud gaming and industrial control "
            "become feasible when the server is kilometres rather than "
            "thousands of kilometres away",
            "Backhaul cost: video analytics processed at the edge sends "
            "conclusions rather than raw streams across the operator's "
            "network, which is an enormous reduction",
            "Data residency: information can be processed and discarded "
            "locally rather than travelling to a central site, which is often "
            "exactly what a privacy or regulatory requirement demands",
            "Resilience: an edge site can keep a local service running when "
            "the link to the central core is degraded or severed",
            "Bandwidth at the core: traffic terminated at the edge never "
            "consumes central capacity at all",
        ]),
    ]),

    ("Edge Computing Is Not a CDN", [
        desc(
            "A content delivery network caches static content near users so "
            "that it need not be fetched from origin every time. That is "
            "valuable and it is a different thing."
        ),
        desc(
            "Edge computing runs arbitrary application logic at the edge, "
            "including workloads that process data which never travels onward "
            "at all -- a camera feed analysed on site with only alerts sent "
            "anywhere. A CDN serves content outward; an edge platform "
            "processes data inward. Exam options conflating them are wrong."
        ),
    ]),

    ("The Frequency Trade-off", [
        desc(
            "One piece of radio physics explains most of what is confusing "
            "about 5G coverage in practice. Higher frequencies carry more data "
            "but travel less far and are stopped by obstacles more easily."
        ),
        desc(
            "This is not an engineering shortcoming awaiting a fix; it is a "
            "property of electromagnetic propagation, and network design has "
            "to live with it. It is also why two people can both have '5G' on "
            "their phones and experience wildly different speeds."
        ),
    ]),

    ("The Three Frequency Bands", [
        tabs([
            ("Low band", "Below 1 GHz",
             "Travels many kilometres and penetrates buildings well. Modest "
             "bandwidth, so speeds are closer to good 4G than to the 5G "
             "headlines. This is what provides wide-area 5G coverage, and it "
             "is what most rural 5G actually is."),
            ("Mid band", "1-6 GHz",
             "The practical compromise, and where most useful 5G capacity "
             "actually lives. Reasonable range with substantially more "
             "bandwidth than low band. If a network is described as having "
             "good 5G, this is usually why."),
            ("mmWave", "24 GHz and above",
             "Enormous bandwidth and multi-gigabit speeds, but a range "
             "measured in hundreds of metres, blocked by walls, foliage and "
             "sometimes a hand holding the phone. Deployed in stadiums, "
             "transport hubs and dense city centres for capacity, never for "
             "coverage."),
        ]),
    ]),

    ("Massive MIMO and Beamforming", [
        desc(
            "The other way to gain capacity is to use space rather than "
            "spectrum. Massive MIMO uses arrays of dozens or hundreds of "
            "antenna elements at the base station, and beamforming uses them "
            "to steer transmitted energy toward a specific device instead of "
            "radiating in all directions."
        ),
        desc(
            "The same frequency can then serve several devices simultaneously "
            "in different directions, which multiplies capacity without any "
            "additional spectrum -- spectrum being the scarce and expensive "
            "resource. Beamforming also partly compensates for millimetre "
            "wave's poor range, by concentrating what is transmitted rather "
            "than wasting most of it."
        ),
    ]),

    ("Private Mobile Networks", [
        desc(
            "A development worth knowing about is the private 5G network: a "
            "factory, port, mine or hospital operating its own small mobile "
            "network on licensed or shared spectrum, entirely under its own "
            "control."
        ),
        desc(
            "The attraction over Wi-Fi is threefold: deterministic performance "
            "on spectrum nobody else may use, seamless handover across a large "
            "site as vehicles and people move, and SIM-based authentication "
            "that is considerably harder to subvert than a shared wireless "
            "key. It is the clearest example of mobile technology being "
            "deployed as enterprise infrastructure rather than as a consumer "
            "service."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Thinking 5G is only about speed",
             "The headline is throughput, but the architectural changes -- "
             "service-based core, slicing, edge computing -- are what matter "
             "professionally. A URLLC slice is not a fast network; it is a "
             "predictable one, and it may well be slower than eMBB."),
            ("Expecting millimetre wave everywhere",
             "mmWave range is measured in hundreds of metres and is blocked by "
             "walls. Wide-area 5G runs on low and mid band, and the two "
             "deliver very different experiences under the same name."),
            ("Confusing network slicing with quality of service",
             "QoS prioritises packets within one shared network. A slice is a "
             "logical network of its own, defined end to end across radio, "
             "transport and core, with its own resources and function "
             "instances."),
            ("Treating edge computing as a kind of CDN",
             "A CDN caches content near users and serves it outward. Edge "
             "computing runs arbitrary application logic, including workloads "
             "processing data that never travels onward at all."),
            ("Assuming a mobile core is exotic",
             "Since 4G it has been an all-IP network. The addressing, routing "
             "and transport material from the rest of this module applies to "
             "it directly, and treating it as a separate discipline is a "
             "mistake."),
            ("Believing central capacity can substitute for edge deployment",
             "Latency is bounded by propagation delay. Adding servers at the "
             "far end of a thousand-kilometre link cannot reduce the ten "
             "milliseconds the signal spends travelling."),
        ]),
    ]),

    ("Practical Example: A Port Automating Its Cranes", [
        desc(
            "A container port wants to move from cranes with operators in the "
            "cab to cranes controlled remotely from a single room. The control "
            "loop needs latency of a few milliseconds, cannot tolerate "
            "interruption, and must work reliably across two square kilometres "
            "of moving metal and stacked containers."
        ),
        desc(
            "Wi-Fi struggles on every count. Handover between access points is "
            "not seamless enough for a moving crane, the unlicensed band is "
            "shared with everything else on site including equipment the port "
            "does not control, and authentication by shared key is weak for an "
            "installation where a compromised credential means a "
            "remotely-operated crane."
        ),
    ]),

    ("How the Requirement Maps to the Technology", [
        ol([
            "A private 5G network on licensed spectrum removes contention with "
            "other users of the band entirely",
            "A URLLC slice provides the latency and reliability the control "
            "loop needs, isolated from the site's ordinary data traffic so a "
            "large file transfer cannot disturb it",
            "A User Plane Function deployed at the port keeps traffic local, "
            "so the control loop never leaves the site and never pays "
            "propagation delay to a central core",
            "Edge compute at the same site runs the video analytics watching "
            "for obstructions, sending alerts rather than raw video across the "
            "network",
            "SIM-based authentication ties each crane to a credential that "
            "cannot be copied off a whiteboard the way a wireless key can",
        ]),
        desc(
            "Notice that four of the five are core-network and architecture "
            "decisions rather than radio ones. That is the lesson's central "
            "point restated in a concrete setting."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "The RAN/core division, and which changes belong to which half",
            "What each generation changed architecturally, with 4G's all-IP "
            "core as the key break",
            "The 4G element names and which are control plane versus user "
            "plane",
            "The three slice profiles and what each optimises for",
            "Slicing versus QoS, usually as a scenario",
            "The frequency/bandwidth/range trade-off",
            "Why edge computing exists, framed around propagation delay",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Radio access network versus core network is the division to "
            "reason from in every question",
            "4G's break was the all-IP Evolved Packet Core; 5G's is the "
            "service-based core with slicing and edge computing",
            "MME is control plane; SGW and PGW are user plane. AMF, SMF and "
            "UPF are the 5G successors",
            "Know the three slice profiles: eMBB throughput, URLLC latency and "
            "reliability, mMTC device density",
            "Higher frequency means more bandwidth and less range -- expect a "
            "question testing exactly this trade-off",
            "Slicing is not QoS, and edge computing is not a CDN",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Every mobile network divides into a radio access network and a "
            "core, and the two evolve for different reasons",
            "4G made the core all-IP, which is why mobile networks became "
            "ordinary IP networks with an unusual access technology",
            "5G's core is service-based and virtualised, which is what makes "
            "slicing economically possible at all",
            "A network slice is an end-to-end logical network with its own "
            "resources, not a priority marking",
            "Separating the session management function from the user plane "
            "function is what lets traffic be handled at the edge",
            "Edge computing exists because propagation delay puts a floor "
            "under latency that no central capacity can lift",
            "Frequency trades bandwidth against range, and beamforming buys "
            "capacity from spatial reuse rather than from more spectrum",
        ]),
    ]),
]

_mob_quiz = [
    mcq("EASY",
        "Which two parts does every mobile network divide into?",
        [("The radio access network and the core network", True),
         ("The control plane and the management plane", False),
         ("The overlay network and the underlay network", False),
         ("The access layer and the distribution layer", False)],
        "The radio access network covers everything between the handset and "
        "the base station; the core network authenticates subscribers, manages "
        "sessions and mobility, and routes traffic onward. Control and "
        "management planes are a device-level distinction, overlay and underlay "
        "belong to data centre networking, and access and distribution layers "
        "describe a campus hierarchy."),
    mcq("EASY",
        "What was the most significant architectural change introduced by 4G "
        "LTE?",
        [("The circuit-switched domain was removed, making the core all-IP "
          "with voice carried as an IP service", True),
         ("Millimetre-wave spectrum was introduced for the first time", False),
         ("Network slicing allowed one physical network to serve several "
          "logical ones", False),
         ("The SIM card was introduced, separating subscriber from "
          "handset", False)],
        "LTE abolished the circuit-switched half of the core, so an operator "
        "ran one network instead of two and voice became an application over "
        "IP. Millimetre wave and network slicing are 5G developments, and the "
        "SIM card dates from 2G."),
    mcq("AVERAGE",
        "Which 5G service category is designed for factory automation and "
        "remote control, and what does it prioritise?",
        [("URLLC, prioritising very low latency and high reliability over "
          "throughput", True),
         ("eMBB, prioritising peak throughput for demanding "
          "applications", False),
         ("mMTC, prioritising the number of connected devices and battery "
          "life", False),
         ("VoLTE, prioritising voice quality over data traffic", False)],
        "Ultra-reliable low-latency communication targets control loops needing "
        "millisecond response and near-certain delivery, and it deliberately "
        "trades throughput away to obtain them -- a URLLC slice may well be "
        "slower than an eMBB one. eMBB is the high-bandwidth consumer profile "
        "and mMTC is the sensor profile. VoLTE is a 4G voice service, not a 5G "
        "slice category."),
    mcq("AVERAGE",
        "Why does millimetre-wave 5G deliver multi-gigabit speeds but require "
        "far denser deployment than low-band 5G?",
        [("Higher frequencies carry more bandwidth but propagate a shorter "
          "distance and are readily blocked by obstacles.", True),
         ("Millimetre-wave equipment is limited by regulation to low transmit "
          "power in every country.", False),
         ("Millimetre-wave signals can only be received by devices with "
          "beamforming antennas, which are rare.", False),
         ("Higher frequencies require more processing time at the base "
          "station, limiting cell size.", False)],
        "This is radio physics rather than a design choice: available "
        "bandwidth increases with frequency while range falls and obstruction "
        "losses rise sharply, so a millimetre-wave cell covers hundreds of "
        "metres and struggles through walls. Regulation, receiver capability "
        "and processing time are not the governing constraints."),
    mcq("AVERAGE",
        "How does network slicing differ from quality of service?",
        [("A slice is an end-to-end logical network with its own resources "
          "across radio, transport and core; QoS prioritises packets within one "
          "shared network.", True),
         ("Slicing applies only to the radio access network while QoS applies "
          "only to the core.", False),
         ("Slicing is a 4G feature and QoS is its 5G replacement.", False),
         ("They are two names for the same mechanism, used by different "
          "vendors.", False)],
        "QoS decides which packets go first inside a single shared network, so "
        "everyone still contends for the same resources. A slice is a separate "
        "logical network defined across every segment, with its own resource "
        "allocation and potentially its own core function instances, which is "
        "why it can offer a different behaviour rather than just a different "
        "priority. Slicing spans radio and core, is a 5G capability, and is "
        "not a synonym for QoS."),
    mcq("AVERAGE",
        "Which 4G core element authenticates the subscriber and manages "
        "mobility, while handling no user traffic itself?",
        [("MME", True), ("SGW", False), ("PGW", False), ("eNodeB", False)],
        "The Mobility Management Entity is the control-plane element: it "
        "authenticates, tracks the device's location and sets up bearers, but "
        "no subscriber packet passes through it. The Serving Gateway and Packet "
        "Data Network Gateway are user-plane elements carrying that traffic, "
        "and the eNodeB is the base station in the radio access network."),
    mcq("HARD",
        "In the 5G core, why does separating the Session Management Function "
        "from the User Plane Function matter architecturally?",
        [("It allows the user plane to be deployed close to the network edge "
          "while session control stays central, which is what makes edge "
          "computing practical.", True),
         ("It allows a subscriber's session to be authenticated twice, "
          "improving security.", False),
         ("It removes the need for a radio access network in private "
          "deployments.", False),
         ("It allows the user plane to run on a different radio frequency from "
          "the control plane.", False)],
        "Splitting control from user plane means the part that forwards packets "
        "can be placed anywhere -- including at a port, factory or stadium -- "
        "while the part that manages sessions remains centralised. That is "
        "precisely the enabler for edge computing and for keeping local "
        "traffic local. It is not an authentication mechanism, does not remove "
        "the radio access network, and has nothing to do with frequency."),
    mcq("HARD",
        "An operator argues that edge computing is unnecessary because its "
        "central data centre has abundant capacity.\n\nWhat does this argument "
        "overlook?",
        [("Latency is bounded by propagation delay, so distance imposes a "
          "floor no amount of central capacity can lower.", True),
         ("Central data centres cannot run virtualised network "
          "functions.", False),
         ("Edge computing is required by the 5G specification for all "
          "traffic.", False),
         ("Central data centres cannot be connected to a 5G core "
          "network.", False)],
        "Capacity and latency are different problems entirely. A signal "
        "travelling a thousand kilometres and back takes roughly ten "
        "milliseconds before any processing occurs, and adding servers at the "
        "far end cannot reduce that -- it is the speed of light rather than a "
        "queueing delay. Applications with millisecond control loops therefore "
        "need compute nearby. Central sites certainly can run virtual "
        "functions and connect to a 5G core."),
    short_answer("EASY",
        "What does the acronym RAN stand for in mobile networking?",
        "Radio Access Network",
        ["radio access network", "ran"]),
    short_answer("AVERAGE",
        "Which 5G core function forwards user traffic and can be deployed at "
        "the network edge? Give the acronym.",
        "UPF",
        ["upf", "user plane function"]),
    descriptive("HARD",
        "A manufacturer wants to control machinery remotely across a large "
        "site with a control loop that cannot tolerate more than a few "
        "milliseconds of latency or any interruption. Explain which 5G "
        "capabilities address this and why Wi-Fi is a poorer fit.",
        "Three capabilities combine. First, a private 5G network on licensed "
        "or shared spectrum removes contention with other users of the band, "
        "which unlicensed Wi-Fi cannot guarantee since anything else on or "
        "near the site may transmit in the same channel and the operator has "
        "no recourse. Second, a URLLC slice provides an end-to-end logical "
        "network engineered for millisecond latency and very high reliability, "
        "isolated from the site's ordinary data traffic, so a large file "
        "transfer elsewhere cannot disturb the control loop. This is stronger "
        "than a quality-of-service marking, because the slice has resources "
        "allocated to it across radio, transport and core rather than merely "
        "holding a higher position in a shared queue. Third, a User Plane "
        "Function deployed at the site keeps the traffic local: because 5G "
        "separates session management from the user plane, packets can be "
        "forwarded on site instead of travelling to a central core, removing "
        "the propagation delay that would otherwise dominate the latency "
        "budget -- and propagation delay is a floor that no amount of central "
        "capacity can lower. Wi-Fi is a poorer fit on several counts: handover "
        "between access points across a large site is not seamless, so a "
        "moving machine may lose its connection momentarily, which for a "
        "control loop is a failure rather than an inconvenience; the "
        "unlicensed band is shared and its performance is therefore "
        "non-deterministic; and authentication by a shared wireless key is "
        "both weaker and harder to manage than SIM-based credentials tied to "
        "individual devices, which matters a great deal when the credential "
        "controls machinery.",
        [("Identifies private spectrum and explains why contention "
          "matters", 3),
         ("Explains a URLLC slice and how it differs from prioritisation", 4),
         ("Explains local user plane or edge deployment, or Wi-Fi's handover "
          "and determinism weaknesses", 3)]),
]

LESSON_MOBILE = {
    "middle": MID_EMERGING,
    "name": "Mobile Network Evolution: 4G, 5G, and Edge Computing",
    "quiz": _mob_quiz,
    "structure": lesson_structure(
        "Mobile Network Evolution: 4G, 5G, and Edge Computing",
        "Mobile networks are where a great deal of network engineering now "
        "happens, and the professionally interesting changes are not the ones "
        "in the advertising. This lesson separates the radio access network "
        "from the core, walks the generations to see what actually changed "
        "architecturally at each step, explains why 4G's all-IP core made "
        "mobile networks ordinary IP networks that everything else in this "
        "module applies to, and then covers what distinguishes 5G: a "
        "service-based virtualised core, end-to-end network slicing, and edge "
        "computing. It closes with the radio physics that explains 5G's "
        "confusing coverage and a worked example of a private network "
        "automating a container port.",
        [
            "Distinguish the radio access network from the core network and "
            "say which changes belong to each",
            "Summarise what each mobile generation changed, identifying 4G's "
            "all-IP core as the decisive break",
            "Name the principal 4G core elements and their 5G successors, and "
            "identify which are control plane and which user plane",
            "Explain the 5G service-based core and its dependence on "
            "virtualisation",
            "Define network slicing, distinguish it from quality of service, "
            "and describe the three standard profiles",
            "Explain why separating the SMF from the UPF is what makes edge "
            "computing practical",
            "Explain why edge computing exists in terms of propagation delay, "
            "and how it differs from content delivery caching",
            "Explain the trade-off between frequency, bandwidth and range, and "
            "the role of massive MIMO and beamforming",
            "Describe where a private mobile network is preferable to Wi-Fi "
            "and why",
        ],
        55,
        _mob_sections,
        [
            ("Radio access network (RAN)",
             "Everything between the device and the base station: air "
             "interface, spectrum and radio equipment."),
            ("Core network",
             "The systems behind the RAN that authenticate subscribers, manage "
             "sessions and mobility, and route traffic onward."),
            ("Evolved Packet Core",
             "4G's all-IP core, which removed the circuit-switched domain and "
             "made voice an IP service."),
            ("MME / SGW / PGW",
             "4G core elements: the Mobility Management Entity is control "
             "plane and carries no user traffic; the Serving and Packet Data "
             "Network Gateways are user plane."),
            ("AMF / SMF / UPF",
             "The 5G successors: Access and Mobility Management, Session "
             "Management, and User Plane Function. The SMF/UPF split is what "
             "lets the user plane move to the edge."),
            ("Service-based architecture",
             "5G's core design in which network functions are software "
             "services exposing APIs over HTTP/2 rather than fixed nodes."),
            ("Network slicing",
             "Partitioning one physical network into several end-to-end "
             "logical networks, each with its own characteristics and "
             "allocated resources."),
            ("eMBB / URLLC / mMTC",
             "The three 5G service profiles: enhanced mobile broadband, "
             "ultra-reliable low-latency communication, and massive "
             "machine-type communication."),
            ("Multi-access edge computing",
             "Running compute at operator sites near the base station to cut "
             "latency, reduce backhaul and keep data local."),
            ("Massive MIMO / beamforming",
             "Large antenna arrays and directional transmission, buying "
             "capacity from spatial reuse rather than from additional "
             "spectrum."),
            ("Private mobile network",
             "An organisation operating its own small mobile network for "
             "deterministic performance, seamless handover and SIM-based "
             "authentication."),
        ],
        "A mobile network is a radio access network plus a core, and the two "
        "evolve for different reasons: the generational speed headlines are "
        "radio changes, while the architecture that matters to an engineer "
        "changed in the core. 4G's Evolved Packet Core removed circuit "
        "switching and made mobile networks all-IP, so everything in this "
        "module's addressing and routing material applies to them directly. 5G "
        "replaced the fixed core nodes with virtualised software services "
        "communicating over APIs, which is what made network slicing -- "
        "genuine end-to-end logical networks with allocated resources, not "
        "priority markings -- economically possible at all. Of its changes, "
        "separating the session management function from the user plane "
        "function is the consequential one, because it lets the forwarding "
        "function be placed at a factory or a port while session control stays "
        "central. Edge computing exists because propagation delay puts a floor "
        "under latency that no amount of central capacity can lift, and it "
        "runs arbitrary logic rather than caching content. And the frequency "
        "trade-off between bandwidth and range explains why 5G feels like two "
        "entirely different technologies depending on which band is carrying "
        "it."),
}

LESSONS = [LESSON_MOBILE]
