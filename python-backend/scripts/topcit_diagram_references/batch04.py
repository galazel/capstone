"""Batch 4: cfg 26-35. Networking, database requirements, and design process."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
    "folder = package or subsystem boundary",
]


# ------------------------------------------------------ cfg 26, UML_CLASS
def data_link_frames():
    d = Diagram("Data Link Layer - Frame and Protocol Class Model",
                "UML class diagram (model answer)")
    d.node("frame", "Frame", ["# frameId: long", "# sourceMac: MacAddress",
                              "# destMac: MacAddress", "# payload: byte[]",
                              "# fcs: int",
                              "+ computeFcs(): int",
                              "+ isCorrupt(): boolean"], 380, 90, 250, abstract=True)
    d.node("data", "DataFrame", ["- sequenceNo: int", "- payloadLength: int",
                                 "+ needsAck(): boolean",
                                 "+ fragment(mtu: int): List"], 100, 330, 240)
    d.node("ack", "AckFrame", ["- acksSequenceNo: int",
                               "+ isCumulative(): boolean",
                               "+ windowAdvance(): int"], 380, 330, 240)
    d.node("ctrl", "ControlFrame", ["- controlType: String",
                                    "+ isPause(): boolean",
                                    "+ durationQuanta(): int"], 660, 330, 240)
    d.node("mac", "MacAddress", ["- octets: byte[6]", "+ isBroadcast(): boolean",
                                 "+ oui(): String"], 100, 90, 240)
    d.node("nic", "NetworkInterface", ["- interfaceId: String",
                                       "- hardwareAddress: MacAddress",
                                       "- mtu: int", "- linkUp: boolean",
                                       "+ send(f: Frame): boolean",
                                       "+ receive(): Frame"], 960, 90, 250)
    d.node("proto", "LinkProtocol", ["# windowSize: int", "# timeoutMs: int",
                                     "+ transmit(f: Frame): boolean",
                                     "+ onTimeout(seq: int): void"], 960, 330, 250, abstract=True)
    d.node("sw", "StopAndWait", ["- outstanding: int",
                                 "+ transmit(f: Frame): boolean",
                                 "+ maxInFlight(): int"], 900, 560, 230)
    d.node("gbn", "GoBackN", ["- base: int", "- nextSeq: int",
                              "+ transmit(f: Frame): boolean",
                              "+ retransmitFrom(seq: int): void"], 1160, 560, 240)
    d.node("switch", "Switch", ["- switchId: String", "- macTableSize: int",
                                "+ learn(m: MacAddress, p: int): void",
                                "+ forward(f: Frame): void"], 660, 560, 230)
    d.node("entry", "MacTableEntry", ["- address: MacAddress", "- portNumber: int",
                                      "- agedAt: Date", "+ isStale(): boolean",
                                      "+ refresh(): void"], 380, 560, 240)
    d.edge("frame", "data", "gen")
    d.edge("frame", "ack", "gen")
    d.edge("frame", "ctrl", "gen")
    d.edge("proto", "sw", "gen")
    d.edge("proto", "gbn", "gen")
    d.edge("frame", "mac", "assoc", "addresses", "0..*", "2")
    d.edge("nic", "frame", "assoc", "transmits", "1", "0..*")
    d.edge("nic", "proto", "aggr", "runs", "1", "1")
    d.edge("switch", "entry", "comp", "maintains", "1", "0..*")
    d.edge("switch", "nic", "aggr", "forwards through", "1", "2..*")
    d.legend(UML_LEGEND, x=100, y=560)
    return d.xml()


CFG26_Q = """\
Data Link Layer - Frame Handling Class Model

You are modelling the classes a switch and its interfaces need in order to move \
frames across a link.

a) Every frame carries a frame ID, a source and destination MAC address, a \
payload and a frame check sequence, and can compute its FCS and report whether \
it is corrupt.
b) There are three kinds of frame and nothing is ever just a frame. A data \
frame adds a sequence number and payload length; an acknowledgement frame adds \
the sequence number it acknowledges; a control frame adds a control type.
c) A MAC address is six octets and can report whether it is the broadcast \
address and what its OUI is. A frame addresses exactly two MAC addresses -- \
source and destination.
d) A network interface has an ID, a hardware address, an MTU and a link state, \
and transmits any number of frames. Frames are destroyed once transmitted; \
interfaces are not.
e) An interface runs exactly one link protocol. A protocol has a window size \
and a timeout, and can transmit a frame and react to a timeout. A protocol is \
configured on the interface but exists in the protocol stack independently of \
it.
f) Stop-and-wait and go-back-N are both link protocols; a bare protocol is \
never used on its own. Stop-and-wait tracks how many frames are outstanding; \
go-back-N tracks a window base and a next sequence number.
g) A switch has an ID and a MAC table size, and maintains any number of MAC \
table entries. An entry pairs an address with a port number and an age, and is \
discarded when the switch is powered off.
h) A switch forwards through two or more network interfaces. Those interfaces \
are physical hardware and survive a switch being reconfigured."""

CFG26_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Justify in one sentence each: why Switch-MacTableEntry is composition, but \
Switch-NetworkInterface is only aggregation.
5. Two classes are abstract. Name both, quote the sentence in the requirements \
that makes each one abstract, and state what would go wrong if go-back-N did \
not override transmit()."""


# -------------------------------------------------- cfg 27, UML_COMPONENT
def dns_dhcp_services():
    d = Diagram("Halden Campus - Core Network Service Architecture",
                "UML component diagram (model answer)")
    d.shape("client", "ClientHost", "component", 40, 120, 200, 70)
    d.shape("dhcp", "DhcpServer", "component", 320, 100, 200, 70)
    d.shape("relay", "DhcpRelayAgent", "component", 320, 220, 200, 70)
    d.shape("dnsr", "DnsResolver", "component", 620, 100, 200, 70)
    d.shape("dnsa", "DnsAuthoritative", "component", 900, 100, 210, 70)
    d.shape("ntp", "NtpServer", "component", 620, 220, 200, 70)
    d.shape("radius", "RadiusServer", "component", 620, 340, 200, 70)
    d.shape("dir", "DirectoryService", "component", 900, 340, 210, 70)
    d.shape("ipam", "IpamDatabase", "component", 320, 340, 200, 70)
    d.shape("log", "SyslogCollector", "component", 900, 220, 210, 70)
    d.shape("i_dhcp", "ILeaseAllocation", "provided", 285, 115, 22, 22)
    d.shape("i_dns", "INameResolution", "provided", 585, 115, 22, 22)
    d.shape("i_ntp", "ITimeSync", "provided", 585, 235, 22, 22)
    d.shape("i_rad", "IAuthentication", "provided", 585, 355, 22, 22)
    d.shape("i_dir", "IIdentityLookup", "provided", 865, 355, 22, 22)
    d.shape("i_zone", "IZoneQuery", "provided", 865, 115, 22, 22)
    d.shape("i_log", "ILogIngest", "provided", 865, 235, 22, 22)
    d.edge("client", "relay", "dep", "ILeaseAllocation")
    d.edge("relay", "dhcp", "dep", "ILeaseAllocation")
    d.edge("client", "dnsr", "dep", "INameResolution")
    d.edge("client", "ntp", "dep", "ITimeSync")
    d.edge("client", "radius", "dep", "IAuthentication")
    d.edge("dnsr", "dnsa", "dep", "IZoneQuery")
    d.edge("dhcp", "ipam", "dep", "reads pool from")
    d.edge("dhcp", "dnsa", "dep", "IZoneQuery")
    d.edge("radius", "dir", "dep", "IIdentityLookup")
    for src in ("dhcp", "dnsr", "radius", "ntp"):
        d.edge(src, "log", "dep", "ILogIngest")
    d.legend(COMPONENT_LEGEND, x=40, y=340)
    return d.xml()


CFG27_Q = """\
"Halden Campus" Core Network Services

Halden is rebuilding the services every device on campus depends on before it \
can do anything else. Agree the component architecture.

a) A client host obtains its address configuration through a DHCP relay agent \
on its local subnet; the relay forwards to the central DHCP server. The client \
never contacts the DHCP server directly.
b) The DHCP server provides ILeaseAllocation, and the relay presents that same \
interface onward to clients.
c) The DHCP server reads its address pools from an IPAM database. No other \
component may read that database.
d) A client resolves names through a DNS resolver, which provides \
INameResolution. The resolver in turn queries the authoritative DNS servers \
through IZoneQuery.
e) When the DHCP server issues a lease it registers the name through the same \
IZoneQuery interface the resolver uses.
f) A client synchronises its clock through the NTP server's ITimeSync interface \
and authenticates through the RADIUS server's IAuthentication interface.
g) The RADIUS server looks users up in the directory service through \
IIdentityLookup.
h) The DHCP server, DNS resolver, RADIUS server and NTP server all send events \
to the syslog collector through ILogIngest. Clients do not.
i) No server component depends on a client host."""

CFG27_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirements (b) and (e) each involve one interface serving two consumers. \
Show both, and explain in one sentence what the relay agent in requirement (a) \
buys you that a direct client-to-server dependency would not.
5. Requirement (i) fixes the direction of every dependency. State the \
architectural property it protects, and name the single component whose failure \
would prevent a new client from obtaining an address at all."""


# -------------------------------------------------- cfg 28, UML_COMPONENT
def m2m_telemetry():
    d = Diagram("Fenland Water - M2M Telemetry Architecture",
                "UML component diagram (model answer)")
    d.shape("sensor", "FieldSensor", "component", 40, 110, 200, 70)
    d.shape("gw", "EdgeGateway", "component", 320, 110, 200, 70)
    d.shape("buf", "StoreAndForwardBuffer", "component", 320, 260, 200, 70)
    d.shape("broker", "MqttBroker", "component", 620, 110, 200, 70)
    d.shape("ingest", "TelemetryIngest", "component", 900, 110, 210, 70)
    d.shape("tsdb", "TimeSeriesStore", "component", 1180, 110, 210, 70)
    d.shape("rules", "RuleEngine", "component", 900, 260, 210, 70)
    d.shape("alert", "AlertDispatcher", "component", 1180, 260, 210, 70)
    d.shape("reg", "DeviceRegistry", "component", 620, 260, 200, 70)
    d.shape("ota", "FirmwareService", "component", 620, 400, 200, 70)
    d.shape("i_pub", "ITelemetryPublish", "provided", 585, 125, 22, 22)
    d.shape("i_sub", "ITelemetrySubscribe", "provided", 865, 125, 22, 22)
    d.shape("i_store", "ISeriesWrite", "provided", 1145, 125, 22, 22)
    d.shape("i_reg", "IDeviceIdentity", "provided", 585, 275, 22, 22)
    d.shape("i_alert", "IAlertDispatch", "provided", 1145, 275, 22, 22)
    d.shape("i_ota", "IFirmwareDownload", "provided", 585, 415, 22, 22)
    d.edge("sensor", "gw", "dep", "raw readings (serial)")
    d.edge("gw", "buf", "dep", "queues through")
    d.edge("gw", "broker", "dep", "ITelemetryPublish")
    d.edge("broker", "ingest", "dep", "ITelemetrySubscribe")
    d.edge("ingest", "tsdb", "dep", "ISeriesWrite")
    d.edge("ingest", "rules", "dep", "evaluates via")
    d.edge("rules", "alert", "dep", "IAlertDispatch")
    d.edge("gw", "reg", "dep", "IDeviceIdentity")
    d.edge("ingest", "reg", "dep", "IDeviceIdentity")
    d.edge("gw", "ota", "dep", "IFirmwareDownload")
    d.legend(COMPONENT_LEGEND, x=40, y=300)
    return d.xml()


CFG28_Q = """\
"Fenland Water" Machine-to-Machine Telemetry

Fenland monitors thousands of unattended water sites over a link that is often \
down. Agree the component architecture.

a) A field sensor is a constrained device on a serial link. It talks only to \
the edge gateway on its site and knows nothing else in the system.
b) The edge gateway queues readings through a store-and-forward buffer so that \
nothing is lost while the uplink is down. The gateway is the only component \
that uses that buffer.
c) The gateway publishes readings to the MQTT broker through \
ITelemetryPublish. It never writes to a database directly.
d) The telemetry ingest service subscribes to the broker through \
ITelemetrySubscribe and writes to the time-series store through ISeriesWrite. \
No other component may write to that store.
e) Ingest evaluates each reading against the rule engine, which raises alerts \
through the alert dispatcher's IAlertDispatch interface.
f) Both the gateway and the ingest service verify device identity through the \
device registry's IDeviceIdentity interface -- the same interface, not two.
g) The gateway pulls firmware updates through the firmware service's \
IFirmwareDownload interface. The firmware service never pushes to a gateway.
h) No component depends on a field sensor, and the broker depends on nothing."""

CFG28_I = """\
1. Draw every component in requirements (a) to (g) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (b) exists because the uplink is unreliable. Explain in one \
sentence what the buffer changes about the failure behaviour, and what a sensor \
reading's fate would be without it.
5. Requirement (g) says pull, not push. State in one sentence why a pull model \
is the right choice for thousands of intermittently connected devices behind \
NAT, and identify the one component in your diagram that becomes a single point \
of failure for all telemetry."""


# ------------------------------------------------------------ cfg 29, ERD
def library_requirements():
    d = Diagram("Wren Public Library - Lending Domain Model",
                "Entity-relationship diagram (model answer)")
    d.node("branch", "LibraryBranch", ["PK branchId: String", "name: String",
                                       "address: String", "openingHours: String"], 40, 90)
    d.node("title", "Title", ["PK titleId: String", "isbn: String",
                              "name: String", "publishedYear: int"], 320, 90)
    d.node("copy", "Copy", ["PK copyId: String", "FK titleId: String",
                            "FK branchId: String", "barcode: String",
                            "condition: String"], 320, 300)
    d.node("author", "Author", ["PK authorId: String", "fullName: String",
                                "birthYear: int"], 620, 90)
    d.node("credit", "TitleAuthor", ["PK titleAuthorId: String", "FK titleId: String",
                                     "FK authorId: String", "position: int"], 620, 280)
    d.node("borrower", "Borrower", ["PK borrowerId: String", "fullName: String",
                                    "email: String", "joinedOn: Date",
                                    "isSuspended: boolean"], 40, 300)
    d.node("loan", "Loan", ["PK loanId: String", "FK copyId: String",
                            "FK borrowerId: String", "borrowedOn: Date",
                            "dueOn: Date", "returnedOn: Date"], 40, 540)
    d.node("fine", "Fine", ["PK fineId: String", "FK loanId: String",
                            "amount: double", "raisedOn: Date",
                            "settledOn: Date"], 320, 540)
    d.node("res", "Reservation", ["PK reservationId: String", "FK titleId: String",
                                  "FK borrowerId: String", "FK branchId: String",
                                  "placedOn: Date", "queuePosition: int"], 620, 500)
    d.edge("branch", "copy", "assoc", "shelves", "1", "0..*")
    d.edge("title", "copy", "comp", "is held as", "1", "0..*")
    d.edge("title", "credit", "comp", "is credited to", "1", "1..*")
    d.edge("author", "credit", "assoc", "writes", "1", "0..*")
    d.edge("borrower", "loan", "assoc", "takes out", "1", "0..*")
    d.edge("copy", "loan", "assoc", "is lent as", "1", "0..*")
    d.edge("loan", "fine", "comp", "incurs", "1", "0..*")
    d.edge("borrower", "res", "assoc", "places", "1", "0..*")
    d.edge("title", "res", "assoc", "is reserved as", "1", "0..*")
    d.edge("branch", "res", "assoc", "collects at", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=300)
    return d.xml()


CFG29_Q = """\
"Wren Public Library" - Requirements Gathering Outcome

Interviews with Wren's librarians produced the statements below, in their own \
words. Turn them into a model.

a) "We have several branches. Each one has a name, address and opening hours."
b) "A title is the work -- ISBN, name, year. A copy is the physical book on the \
shelf, with its own barcode and a condition. Scrap the title and every copy of \
it goes."
c) "A copy sits at one branch. Copies do get transferred between branches, so \
that isn't fixed forever."
d) "A title has one or more authors and we care about the order they're listed \
in. An author writes many titles and stays on file even after we withdraw \
everything they wrote."
e) "Borrowers have a name, e-mail, join date and a suspended flag. We keep them \
after they stop using us."
f) "A loan is one borrower taking one copy. We record when it went out, when \
it's due, and when it came back -- that's empty while it's still out."
g) "Fines are raised against a loan, not against a person. Delete the loan and \
the fine goes with it. A loan can pick up more than one fine."
h) "A reservation is against the title, not a specific copy -- the borrower \
just wants the next one free. They choose which branch to collect from, and we \
keep their place in the queue."""

CFG29_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (d) is many-to-many and carries its own attribute. Resolve it \
into an associative entity and state what that attribute is.
4. Requirement (b) draws a distinction between a title and a copy. Explain in \
one sentence why they must be two entities, and what requirement (h) would be \
impossible to express if they were one.
5. Requirement (f) says the return date is empty while the book is out. State \
what that means for the column's nullability, and name one query the librarians \
can answer from that single nullable column."""


# ----------------------------------------------- cfg 30, ACTIVITY_DIAGRAM
def requirements_gathering_activity():
    d = Diagram("Database Requirements Collection - Process",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 150, 90, 40, 40)
    d.shape("scope", "Agree scope and\nidentify stakeholders", "action", 80, 165, 190, 55)
    d.shape("fork", "", "bar", 400, 250, 10, 200)
    d.shape("iv", "Interview\nstakeholders", "action", 80, 270, 170, 55)
    d.shape("doc", "Examine existing\nforms and reports", "action", 470, 270, 180, 55)
    d.shape("obs", "Observe current\nworking practice", "action", 470, 360, 180, 55)
    d.shape("join", "", "bar", 400, 470, 10, 200)
    d.shape("consolidate", "Consolidate findings\ninto a data dictionary", "action",
            80, 490, 200, 55)
    d.shape("d1", "conflicting\ndefinitions?", "decision", 100, 580, 160, 95)
    d.shape("resolve", "Resolve with the\ndata owners", "action", 400, 595, 180, 55)
    d.shape("model", "Draft the\nconceptual model", "action", 80, 710, 190, 55)
    d.shape("val", "Validate model\nwith stakeholders", "action", 80, 795, 190, 55)
    d.shape("d2", "model\naccepted?", "decision", 100, 885, 160, 90)
    d.shape("revise", "Revise the model", "action", 400, 900, 170, 55)
    d.shape("sign", "Sign off and\nbaseline", "action", 80, 1010, 190, 55)
    d.shape("end", "", "end", 150, 1095, 40, 40)
    d.flow("start", "scope")
    d.flow("scope", "fork")
    d.flow("fork", "iv")
    d.flow("fork", "doc")
    d.flow("fork", "obs")
    d.flow("iv", "join")
    d.flow("doc", "join")
    d.flow("obs", "join")
    d.flow("join", "consolidate")
    d.flow("consolidate", "d1")
    d.flow("d1", "resolve", "[yes]")
    d.flow("resolve", "consolidate")
    d.flow("d1", "model", "[no]")
    d.flow("model", "val")
    d.flow("val", "d2")
    d.flow("d2", "revise", "[no]")
    d.flow("revise", "val")
    d.flow("d2", "sign", "[yes]")
    d.flow("sign", "end")
    d.legend(PROCESS_LEGEND, x=700, y=700)
    return d.xml()


CFG30_Q = """\
Database Requirements Collection Process

A data architect is documenting how requirements for a new database are \
collected, so that no project skips a source of truth.

a) The team first agrees the scope and identifies the stakeholders.
b) Three fact-finding activities then run: interviewing stakeholders, examining \
the existing forms and reports, and observing current working practice. They are \
independent -- they may happen in any order or at the same time -- and the work \
proceeds only when all three are complete.
c) The findings are consolidated into a data dictionary.
d) If two sources define the same item differently, the conflict is resolved \
with the data owners and consolidation is redone. This may happen any number of \
times.
e) Once the dictionary is consistent, a conceptual model is drafted and \
validated with the stakeholders.
f) If the stakeholders do not accept the model, it is revised and validated \
again -- fact-finding is not repeated.
g) When they accept it, the model is signed off and baselined, and the process \
ends."""

CFG30_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (g) as an activity.
3. Model requirement (b) with a fork and a join. Explain in one sentence what \
the join guarantees that three sequential activities would not, and why a \
decision node would be the wrong notation here.
4. Label EVERY decision branch with its guard.
5. Requirements (d) and (f) loop to different places. Show both, and state in \
one sentence why a rejected model must not send the team back to interviewing \
stakeholders."""


# ------------------------------------------------------------ cfg 31, ERD
def qos_architecture():
    d = Diagram("Halden Campus - Network Service Quality Model",
                "Entity-relationship diagram (model answer)")
    d.node("svc", "NetworkService", ["PK serviceId: String", "name: String",
                                     "protocol: String", "defaultPort: int"], 40, 90)
    d.node("sla", "ServiceLevel", ["PK slaId: String", "FK serviceId: String",
                                   "tier: String", "targetLatencyMs: int",
                                   "targetUptime: double"], 320, 90)
    d.node("class_", "TrafficClass", ["PK classId: String", "name: String",
                                      "dscpValue: int", "priority: int"], 620, 90)
    d.node("policy", "QosPolicy", ["PK policyId: String", "FK classId: String",
                                   "FK deviceId: String", "bandwidthKbps: int",
                                   "burstKb: int"], 620, 300)
    d.node("device", "NetworkDevice", ["PK deviceId: String", "hostname: String",
                                       "role: String", "FK siteId: String"], 900, 90)
    d.node("iface", "Interface", ["PK interfaceId: String", "FK deviceId: String",
                                  "name: String", "speedMbps: int"], 900, 300)
    d.node("binding", "ServiceBinding", ["PK bindingId: String", "FK serviceId: String",
                                         "FK classId: String", "boundOn: Date"], 320, 300)
    d.node("site", "Site", ["PK siteId: String", "name: String",
                            "region: String"], 1180, 90)
    d.node("measure", "Measurement", ["PK measurementId: String",
                                      "FK interfaceId: String", "FK slaId: String",
                                      "takenAt: Date", "latencyMs: int",
                                      "lossPercent: double"], 900, 500)
    d.node("breach", "SlaBreach", ["PK breachId: String", "FK measurementId: String",
                                   "detectedAt: Date", "severity: String"], 620, 520)
    d.edge("svc", "sla", "comp", "is offered at", "1", "1..*")
    d.edge("svc", "binding", "comp", "is classified by", "1", "1..*")
    d.edge("class_", "binding", "assoc", "classifies", "1", "0..*")
    d.edge("class_", "policy", "assoc", "is enforced by", "1", "0..*")
    d.edge("device", "policy", "comp", "applies", "1", "0..*")
    d.edge("device", "iface", "comp", "has", "1", "1..*")
    d.edge("site", "device", "assoc", "hosts", "1", "0..*")
    d.edge("iface", "measure", "comp", "is sampled as", "1", "0..*")
    d.edge("sla", "measure", "assoc", "is assessed by", "1", "0..*")
    d.edge("measure", "breach", "comp", "raises", "1", "0..1")
    d.legend(ERD_LEGEND, x=40, y=320)
    return d.xml()


CFG31_Q = """\
"Halden Campus" - Network Service Quality Records

Halden must prove it meets its service commitments. Model the data behind that.

a) A network service has a name, protocol and default port.
b) A service is offered at one or more service levels, each naming a tier with \
a target latency and a target uptime. A service level has no meaning apart from \
its service.
c) A traffic class has a name, a DSCP value and a priority. Traffic classes are \
defined centrally and outlive any service that uses them.
d) A service is classified by one or more traffic classes, and a class may \
classify many services. Each such binding records the date it was applied.
e) A network device has a hostname and a role, and is hosted at exactly one \
site. Devices are moved between sites, so a device is not destroyed with a site.
f) A device applies any number of QoS policies. Each policy enforces exactly \
one traffic class with a bandwidth and burst allowance, and is removed when the \
device is decommissioned.
g) A device has one or more interfaces, each with a name and a speed. An \
interface cannot exist apart from its device.
h) An interface is sampled as any number of measurements, each recording a \
timestamp, a latency and a loss percentage, and each assessed against exactly \
one service level.
i) A measurement raises at most one SLA breach, recording when it was detected \
and a severity. A breach is deleted with the measurement that produced it."""

CFG31_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (d) is many-to-many. Resolve it into an associative entity and \
name the attribute that justifies it.
4. Justify in one sentence each why Service-ServiceLevel and Device-Interface \
are identifying relationships, while Site-Device is not.
5. Requirement (i) says "at most one". Show the 0..1 cardinality, and explain in \
one sentence why a breach hangs off a measurement rather than off the service \
level directly."""


# ------------------------------------------------------------ cfg 32, ERD
def addressing_plan():
    d = Diagram("Halden Campus - Addressing and Routing Model",
                "Entity-relationship diagram (model answer)")
    d.node("site", "Site", ["PK siteId: String", "name: String",
                            "region: String"], 40, 90)
    d.node("vlan", "Vlan", ["PK vlanId: String", "FK siteId: String",
                            "vlanNumber: int", "name: String"], 320, 90)
    d.node("subnet", "Subnet", ["PK subnetId: String", "FK vlanId: String",
                                "networkAddress: String", "prefixLength: int",
                                "gateway: String"], 620, 90)
    d.node("pool", "DhcpPool", ["PK poolId: String", "FK subnetId: String",
                                "rangeStart: String", "rangeEnd: String",
                                "leaseSeconds: int"], 900, 90)
    d.node("lease", "DhcpLease", ["PK leaseId: String", "FK poolId: String",
                                  "FK hostId: String", "ipAddress: String",
                                  "issuedAt: Date", "expiresAt: Date"], 900, 320)
    d.node("host", "Host", ["PK hostId: String", "hostname: String",
                            "macAddress: String", "osType: String"], 620, 320)
    d.node("res", "StaticReservation", ["PK reservationId: String",
                                        "FK subnetId: String", "FK hostId: String",
                                        "ipAddress: String"], 620, 540)
    d.node("route", "Route", ["PK routeId: String", "FK deviceId: String",
                              "FK subnetId: String", "nextHop: String",
                              "metric: int"], 320, 320)
    d.node("device", "RouterDevice", ["PK deviceId: String", "hostname: String",
                                      "FK siteId: String", "model: String"], 40, 320)
    d.node("record", "DnsRecord", ["PK recordId: String", "FK hostId: String",
                                   "name: String", "recordType: String",
                                   "ttlSeconds: int"], 320, 540)
    d.edge("site", "vlan", "comp", "defines", "1", "1..*")
    d.edge("vlan", "subnet", "comp", "carries", "1", "1..*")
    d.edge("subnet", "pool", "comp", "allocates from", "1", "0..*")
    d.edge("pool", "lease", "comp", "issues", "1", "0..*")
    d.edge("host", "lease", "assoc", "holds", "1", "0..*")
    d.edge("subnet", "res", "comp", "reserves", "1", "0..*")
    d.edge("host", "res", "assoc", "is pinned by", "1", "0..1")
    d.edge("device", "route", "comp", "advertises", "1", "0..*")
    d.edge("subnet", "route", "assoc", "is reached by", "1", "0..*")
    d.edge("site", "device", "assoc", "hosts", "1", "0..*")
    d.edge("host", "record", "comp", "is named by", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=540)
    return d.xml()


CFG32_Q = """\
"Halden Campus" - Addressing and Routing Plan

Halden's addressing is recorded in spreadsheets that disagree with each other. \
Model it properly.

a) A site has a name and a region, and defines one or more VLANs. A VLAN \
belongs to exactly one site and is meaningless without it.
b) A VLAN carries one or more subnets, each with a network address, prefix \
length and gateway. A subnet cannot exist apart from its VLAN.
c) A subnet allocates from any number of DHCP pools, each with a start address, \
an end address and a lease time. Deleting a subnet deletes its pools.
d) A pool issues any number of leases. A lease records the IP address, the time \
issued and the time it expires, and belongs to exactly one pool.
e) A host has a hostname, MAC address and OS type, and holds any number of \
leases over time. Hosts survive the expiry of their leases.
f) A subnet may reserve a static address for a host. A host is pinned by at \
most one such reservation; a subnet may hold many.
g) A router device has a hostname and a model, and is hosted at exactly one \
site. Devices are relocated, so they are not destroyed with a site.
h) A router advertises any number of routes. A route names exactly one \
destination subnet with a next hop and a metric, and disappears when the router \
is decommissioned.
i) A host is named by any number of DNS records, each with a name, a record \
type and a TTL. Records are deleted with the host."""

CFG32_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Identify every identifying relationship and justify one of them in a \
sentence, contrasting it with Site-RouterDevice in requirement (g).
4. Requirement (f) says "at most one". Show the 0..1 cardinality and explain in \
one sentence what network fault the database is preventing by enforcing it.
5. Requirements (d) and (f) both assign an IP address to a host, by different \
routes. State in one sentence what integrity rule the database cannot express \
here, and where it would have to be enforced instead."""


# ------------------------------------------------------------ cfg 33, ERD
def requirements_traceability():
    d = Diagram("Vantage Systems - Requirements Traceability Model",
                "Entity-relationship diagram (model answer)")
    d.node("project", "Project", ["PK projectId: String", "name: String",
                                  "startedOn: Date", "status: String"], 40, 90)
    d.node("stake", "Stakeholder", ["PK stakeholderId: String", "fullName: String",
                                    "organisation: String", "influence: String"], 320, 90)
    d.node("need", "BusinessNeed", ["PK needId: String", "FK projectId: String",
                                    "statement: String", "priority: String"], 320, 300)
    d.node("req", "Requirement", ["PK requirementId: String", "FK needId: String",
                                  "reference: String", "text: String",
                                  "type: String", "status: String"], 620, 300)
    d.node("interest", "NeedInterest", ["PK interestId: String", "FK needId: String",
                                        "FK stakeholderId: String",
                                        "raisedOn: Date"], 40, 300)
    d.node("accept", "AcceptanceCriterion", ["PK criterionId: String",
                                             "FK requirementId: String",
                                             "text: String", "isMandatory: boolean"],
           620, 540)
    d.node("design", "DesignElement", ["PK elementId: String", "name: String",
                                       "kind: String", "FK projectId: String"], 900, 90)
    d.node("trace", "TraceLink", ["PK traceLinkId: String", "FK requirementId: String",
                                  "FK elementId: String", "linkType: String"], 900, 300)
    d.node("tc", "TestCase", ["PK testCaseId: String", "FK criterionId: String",
                              "name: String", "steps: String"], 900, 540)
    d.node("run", "TestRun", ["PK testRunId: String", "FK testCaseId: String",
                              "executedOn: Date", "outcome: String"], 1180, 540)
    d.edge("project", "need", "comp", "raises", "1", "1..*")
    d.edge("stake", "interest", "assoc", "declares", "1", "0..*")
    d.edge("need", "interest", "comp", "is held by", "1", "1..*")
    d.edge("need", "req", "comp", "is refined into", "1", "1..*")
    d.edge("req", "accept", "comp", "is accepted by", "1", "1..*")
    d.edge("req", "trace", "comp", "is satisfied by", "1", "0..*")
    d.edge("design", "trace", "assoc", "satisfies", "1", "0..*")
    d.edge("project", "design", "assoc", "produces", "1", "0..*")
    d.edge("accept", "tc", "comp", "is verified by", "1", "1..*")
    d.edge("tc", "run", "comp", "is executed as", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=540)
    return d.xml()


CFG33_Q = """\
"Vantage Systems" - Requirements Traceability

Vantage has been asked by an auditor to show that every requirement came from a \
stakeholder and is verified by a test. Their current tooling cannot answer \
either question. Model the data that would.

a) A project has a name, start date and status, and raises one or more business \
needs. A need has no meaning outside its project.
b) A stakeholder has a name, organisation and influence rating. Stakeholders \
work across projects and remain on file after a project closes.
c) A business need is held by one or more stakeholders, and a stakeholder \
declares an interest in many needs. Each interest records the date it was raised.
d) A need is refined into one or more requirements, each with a reference, \
text, a type and a status. A requirement belongs to exactly one need.
e) A requirement is accepted by one or more acceptance criteria, each with text \
and a mandatory flag. Criteria are deleted with their requirement.
f) A design element has a name and a kind and is produced by exactly one \
project. Design elements survive requirement changes.
g) A requirement is satisfied by any number of design elements, and a design \
element may satisfy many requirements. Each trace link records the type of link.
h) An acceptance criterion is verified by one or more test cases, each with a \
name and steps. A test case is deleted with its criterion.
i) A test case is executed as any number of test runs, each recording the date \
and the outcome."""

CFG33_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (c) and (g) are many-to-many. Resolve both into associative \
entities and name the attribute that justifies each.
4. The auditor asks: "show me every test run that verifies requirement R-104." \
Trace that path on your diagram, naming every entity crossed.
5. The auditor also asks: "show me any requirement with no design element \
against it." State which relationship's cardinality makes that question \
answerable, and what you would have had to change if requirement (g) had said \
"exactly one" instead."""


# ----------------------------------------------- cfg 34, ACTIVITY_DIAGRAM
def design_process_activity():
    d = Diagram("Software Design Process - Architecture to Detail",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 150, 90, 40, 40)
    d.shape("read", "Review the baselined\nrequirements", "action", 80, 165, 190, 55)
    d.shape("arch", "Choose the\narchitectural style", "action", 80, 250, 190, 55)
    d.shape("d1", "quality attributes\nsatisfied?", "decision", 100, 340, 170, 95)
    d.shape("alt", "Evaluate an\nalternative style", "action", 400, 355, 180, 55)
    d.shape("fork", "", "bar", 400, 470, 10, 220)
    d.shape("data", "Design the\ndata model", "action", 70, 490, 180, 55)
    d.shape("iface", "Design the\ninterfaces", "action", 460, 490, 180, 55)
    d.shape("comp", "Decompose into\ncomponents", "action", 460, 580, 180, 55)
    d.shape("join", "", "bar", 400, 710, 10, 220)
    d.shape("detail", "Produce detailed\ncomponent design", "action", 70, 730, 190, 55)
    d.shape("rev", "Hold a design\nreview", "action", 70, 815, 190, 55)
    d.shape("d2", "review\npassed?", "decision", 90, 905, 160, 90)
    d.shape("fix", "Rework the\ndetailed design", "action", 400, 920, 180, 55)
    d.shape("d3", "architecture\nat fault?", "decision", 400, 1030, 170, 90)
    d.shape("base", "Baseline the\ndesign", "action", 70, 1030, 190, 55)
    d.shape("end", "", "end", 145, 1120, 40, 40)
    d.flow("start", "read")
    d.flow("read", "arch")
    d.flow("arch", "d1")
    d.flow("d1", "alt", "[no]")
    d.flow("alt", "arch")
    d.flow("d1", "fork", "[yes]")
    d.flow("fork", "data")
    d.flow("fork", "iface")
    d.flow("fork", "comp")
    d.flow("data", "join")
    d.flow("iface", "join")
    d.flow("comp", "join")
    d.flow("join", "detail")
    d.flow("detail", "rev")
    d.flow("rev", "d2")
    d.flow("d2", "base", "[yes]")
    d.flow("d2", "d3", "[no]")
    d.flow("d3", "arch", "[yes: return to architecture]")
    d.flow("d3", "fix", "[no: local defect]")
    d.flow("fix", "rev")
    d.flow("base", "end")
    d.legend(PROCESS_LEGEND, x=720, y=700)
    return d.xml()


CFG34_Q = """\
Software Design Process - Architecture to Detailed Design

A design authority is writing down the route from baselined requirements to a \
baselined design.

a) The designer reviews the baselined requirements, then chooses an \
architectural style.
b) The chosen style is checked against the quality attributes. If it does not \
satisfy them, an alternative is evaluated and the choice is made again. This may \
happen any number of times.
c) Once a style is accepted, three design activities run: designing the data \
model, designing the interfaces, and decomposing the system into components. \
They are independent and may proceed in parallel; detailed design starts only \
when all three are complete.
d) The detailed component design is produced, then put through a design review.
e) If the review passes, the design is baselined and the process ends.
f) If the review fails, the team asks whether the architecture itself is at \
fault. If it is, the process returns to choosing the architectural style. If it \
is only a local defect, the detailed design is reworked and reviewed again."""

CFG34_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (f) as an activity.
3. Model requirement (c) with a fork and a join, and explain in one sentence \
what the join guarantees.
4. Label EVERY decision branch with its guard. Requirement (f) needs a decision \
whose two branches return to different points -- show both.
5. Requirement (f) makes rework cost depend on where the fault is. State in one \
sentence which of the two branches is the expensive one and why, and what \
requirement (b) is trying to do about it."""


# -------------------------------------------------- cfg 35, UML_COMPONENT
def hexagonal_components():
    d = Diagram("Arcus Payments - Ports and Adapters Component View",
                "UML component diagram (model answer)")
    d.shape("rest", "RestAdapter", "component", 40, 110, 200, 70)
    d.shape("batch", "BatchFileAdapter", "component", 40, 230, 200, 70)
    d.shape("mq", "MessageAdapter", "component", 40, 350, 200, 70)
    d.shape("core", "PaymentDomainCore", "component", 400, 220, 240, 90)
    d.shape("dbad", "JpaPersistenceAdapter", "component", 800, 110, 230, 70)
    d.shape("acqad", "AcquirerHttpAdapter", "component", 800, 230, 230, 70)
    d.shape("notad", "EmailNotifyAdapter", "component", 800, 350, 230, 70)
    d.shape("db", "PaymentDatabase", "component", 1120, 110, 210, 70)
    d.shape("acq", "AcquirerBank", "component", 1120, 230, 210, 70)
    d.shape("smtp", "SmtpRelay", "component", 1120, 350, 210, 70)
    d.shape("p_in", "IPaymentUseCase", "provided", 365, 255, 22, 22)
    d.shape("p_repo", "IPaymentRepository", "provided", 765, 125, 22, 22)
    d.shape("p_acq", "IAuthorisationPort", "provided", 765, 245, 22, 22)
    d.shape("p_not", "INotificationPort", "provided", 765, 365, 22, 22)
    for src in ("rest", "batch", "mq"):
        d.edge(src, "core", "dep", "IPaymentUseCase")
    d.edge("core", "dbad", "dep", "IPaymentRepository")
    d.edge("core", "acqad", "dep", "IAuthorisationPort")
    d.edge("core", "notad", "dep", "INotificationPort")
    d.edge("dbad", "db", "dep", "JDBC")
    d.edge("acqad", "acq", "dep", "HTTPS")
    d.edge("notad", "smtp", "dep", "SMTP")
    d.legend(COMPONENT_LEGEND + ["core depends only on ports it defines"],
             x=400, y=430)
    return d.xml()


CFG35_Q = """\
"Arcus Payments" - Ports and Adapters Architecture

Arcus wants its payment logic testable without a database, a bank or a mail \
server. Model the component structure that makes that possible.

a) The payment domain core holds all the business logic. It provides one \
inbound interface, IPaymentUseCase.
b) Three inbound adapters drive the core through that one interface: a REST \
adapter, a batch file adapter and a message adapter. None of them contains \
business logic, and none knows about any other.
c) The core defines three outbound ports: IPaymentRepository for storage, \
IAuthorisationPort for card authorisation and INotificationPort for customer \
notification.
d) Each outbound port has exactly one adapter implementing it: a JPA \
persistence adapter, an acquirer HTTP adapter and an e-mail notify adapter.
e) The persistence adapter talks to the payment database, the acquirer adapter \
to the acquirer bank, and the notify adapter to an SMTP relay. The core talks to \
none of those three directly.
f) The core depends on nothing outside itself except the three port interfaces \
that it declares.
g) No adapter depends on another adapter."""

CFG35_I = """\
1. Draw every component in requirements (a) to (e) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (f) is the point of the whole architecture. Explain in one \
sentence how the core can call the database while depending only on an \
interface it declares itself, and name the principle that describes it.
5. Requirement (b) has three adapters on one interface. State what you would \
have to change to add a scheduled-job adapter, and what you would have to change \
in the CORE -- then say what that answer tells you about the design."""


BATCH = [
    (26, CFG26_Q, CFG26_I, data_link_frames),
    (27, CFG27_Q, CFG27_I, dns_dhcp_services),
    (28, CFG28_Q, CFG28_I, m2m_telemetry),
    (29, CFG29_Q, CFG29_I, library_requirements),
    (30, CFG30_Q, CFG30_I, requirements_gathering_activity),
    (31, CFG31_Q, CFG31_I, qos_architecture),
    (32, CFG32_Q, CFG32_I, addressing_plan),
    (33, CFG33_Q, CFG33_I, requirements_traceability),
    (34, CFG34_Q, CFG34_I, design_process_activity),
    (35, CFG35_Q, CFG35_I, hexagonal_components),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 4")
