"""Batch 7: cfg 58-70. Documentation, M2M, security operations and IT business."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
]


# ------------------------------------------------------ cfg 58, FLOWCHART
def document_lifecycle():
    d = Diagram("Thornbury Engineering - Technical Document Lifecycle",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 130, 90, 140, 45)
    d.shape("need", "Identify the document\nneed and audience", "action", 90, 165, 210, 55)
    d.shape("type", "Select the document\ntype and template", "action", 90, 250, 210, 55)
    d.shape("draft", "Write the draft", "action", 90, 335, 210, 50)
    d.shape("tech", "Technical review\nby a subject expert", "action", 90, 415, 210, 55)
    d.shape("d1", "technically\ncorrect?", "decision", 110, 505, 170, 90)
    d.shape("fixtech", "Correct the\ncontent", "action", 440, 520, 180, 55)
    d.shape("edit", "Editorial review\nfor clarity and style", "action", 90, 625, 210, 55)
    d.shape("d2", "editorially\nacceptable?", "decision", 110, 715, 170, 90)
    d.shape("fixed", "Revise the\nwording", "action", 440, 730, 180, 55)
    d.shape("d3", "approval\nrequired?", "decision", 110, 835, 170, 90)
    d.shape("appr", "Obtain approval\nsignature", "action", 440, 850, 180, 55)
    d.shape("d4", "approved?", "decision", 440, 955, 180, 85)
    d.shape("pub", "Publish and\nissue a version number", "action", 90, 965, 210, 55)
    d.shape("dist", "Distribute to\nthe audience", "action", 90, 1050, 210, 50)
    d.shape("d5", "superseded\nor obsolete?", "decision", 110, 1130, 170, 95)
    d.shape("retire", "Withdraw and\narchive", "action", 440, 1145, 180, 55)
    d.shape("e", "End", "terminator", 130, 1265, 140, 45)
    d.flow("s", "need")
    d.flow("need", "type")
    d.flow("type", "draft")
    d.flow("draft", "tech")
    d.flow("tech", "d1")
    d.flow("d1", "fixtech", "[no]")
    d.flow("fixtech", "tech")
    d.flow("d1", "edit", "[yes]")
    d.flow("edit", "d2")
    d.flow("d2", "fixed", "[no]")
    d.flow("fixed", "edit")
    d.flow("d2", "d3", "[yes]")
    d.flow("d3", "appr", "[yes: controlled document]")
    d.flow("appr", "d4")
    d.flow("d4", "fixtech", "[no]")
    d.flow("d4", "pub", "[yes]")
    d.flow("d3", "pub", "[no]")
    d.flow("pub", "dist")
    d.flow("dist", "d5")
    d.flow("d5", "retire", "[yes]")
    d.flow("retire", "e")
    d.flow("d5", "e", "[no: remains current]")
    d.legend(PROCESS_LEGEND, x=700, y=200)
    return d.xml()


CFG58_Q = """\
"Thornbury Engineering" - Technical Document Lifecycle

Thornbury issues manuals, specifications and work instructions, and an auditor \
has found two versions of the same procedure in circulation. Model the process a \
document must follow.

a) The author identifies the need and the audience, then selects the document \
type and its template.
b) The author writes the draft, which goes to a subject expert for technical \
review.
c) If it is not technically correct, the content is corrected and reviewed \
again. This may happen any number of times.
d) Once technically correct, the document goes to editorial review for clarity \
and style.
e) If it is not editorially acceptable, the wording is revised and it is \
edited again -- it does NOT return to technical review for a wording change.
f) Controlled documents require an approval signature; uncontrolled ones do \
not.
g) If approval is refused, the document returns to content correction, not to \
editorial review.
h) The document is published with a version number and distributed to its \
audience.
i) When a document is superseded or becomes obsolete it is withdrawn and \
archived. Until then it remains current."""

CFG58_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirements (c), (e) and (g) all loop, but to three different places. Show \
all three, and explain in one sentence why a refused approval returns further \
back than a wording change does.
5. Requirement (i) is what fixes the auditor's finding. State in one sentence \
which step makes two versions distinguishable, and which step removes the old \
one from circulation."""


# ------------------------------------------------------------ cfg 59, ERD
def m2m_fleet_records():
    d = Diagram("Fenland Water - Device Fleet and Telemetry Records",
                "Entity-relationship diagram (model answer)")
    d.node("site", "Site", ["PK siteId: String", "name: String",
                            "gridReference: String", "isRemote: boolean"], 40, 90)
    d.node("device", "Device", ["PK deviceId: String", "FK siteId: String",
                                "FK modelId: String", "serialNumber: String",
                                "commissionedOn: Date"], 320, 90)
    d.node("model", "DeviceModel", ["PK modelId: String", "manufacturer: String",
                                    "modelName: String",
                                    "protocol: String"], 620, 90)
    d.node("firmware", "FirmwareVersion", ["PK firmwareId: String", "FK modelId: String",
                                           "versionNumber: String",
                                           "releasedOn: Date"], 900, 90)
    d.node("install", "FirmwareInstall", ["PK installId: String", "FK deviceId: String",
                                          "FK firmwareId: String",
                                          "installedOn: Date", "outcome: String"],
           900, 300)
    d.node("channel", "Channel", ["PK channelId: String", "FK deviceId: String",
                                  "name: String", "unit: String",
                                  "minValue: double", "maxValue: double"], 320, 300)
    d.node("reading", "Reading", ["PK readingId: long", "FK channelId: String",
                                  "takenAt: Date", "value: double",
                                  "quality: String"], 320, 540)
    d.node("command", "Command", ["PK commandId: String", "FK deviceId: String",
                                  "FK issuedById: String", "issuedAt: Date",
                                  "payload: String", "state: String"], 40, 300)
    d.node("operator", "Operator", ["PK operatorId: String", "fullName: String",
                                    "role: String"], 40, 540)
    d.node("alarm", "Alarm", ["PK alarmId: String", "FK readingId: long",
                              "FK ruleId: String", "raisedAt: Date",
                              "acknowledgedAt: Date"], 620, 540)
    d.node("rule", "AlarmRule", ["PK ruleId: String", "FK channelId: String",
                                 "comparison: String", "threshold: double",
                                 "severity: String"], 620, 300)
    d.edge("site", "device", "assoc", "hosts", "1", "0..*")
    d.edge("model", "device", "assoc", "specifies", "1", "0..*")
    d.edge("model", "firmware", "comp", "is released as", "1", "0..*")
    d.edge("device", "install", "comp", "receives", "1", "0..*")
    d.edge("firmware", "install", "assoc", "is installed as", "1", "0..*")
    d.edge("device", "channel", "comp", "exposes", "1", "1..*")
    d.edge("channel", "reading", "comp", "records", "1", "0..*")
    d.edge("channel", "rule", "comp", "is watched by", "1", "0..*")
    d.edge("reading", "alarm", "comp", "triggers", "1", "0..*")
    d.edge("rule", "alarm", "assoc", "raises", "1", "0..*")
    d.edge("device", "command", "comp", "is sent", "1", "0..*")
    d.edge("operator", "command", "assoc", "issues", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=520)
    return d.xml()


CFG59_Q = """\
"Fenland Water" - Device Fleet and Telemetry Records

Fenland cannot currently say which firmware a device was running when a reading \
looked wrong. Model the fleet data so it can.

a) A site has a name, grid reference and a remote flag, and hosts any number of \
devices. Devices are relocated between sites, so they are not destroyed with a \
site.
b) A device has a serial number and a commissioning date, and is specified by \
exactly one device model. Models have a manufacturer, model name and protocol, \
and are a catalogue that outlives any device.
c) A model is released as any number of firmware versions, each with a version \
number and a release date. A firmware version has no meaning apart from its \
model.
d) A device receives any number of firmware installs. Each names one firmware \
version and records the install date and the outcome. Installs are deleted with \
the device.
e) A device exposes one or more channels, each with a name, a unit and a valid \
range. A channel cannot exist without its device.
f) A channel records any number of readings, each with a timestamp, a value and \
a quality flag.
g) A channel is watched by any number of alarm rules, each with a comparison, a \
threshold and a severity.
h) A reading triggers any number of alarms. Each alarm is raised by exactly one \
rule and records when it was raised and when it was acknowledged, which is empty \
until someone acknowledges it.
i) A device is sent any number of commands, each issued by exactly one operator \
with a timestamp, a payload and a state. Operators remain on file after their \
commands complete."""

CFG59_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (d) is many-to-many between devices and firmware versions. \
Resolve it, and name the two attributes that justify the associative entity.
4. Answer the question in the opening paragraph: trace on your diagram the path \
from a suspect reading to the firmware the device was running, naming every \
entity crossed. State in one sentence what extra column requirement (d) would \
need for that answer to be exact rather than approximate.
5. Requirement (h) says the acknowledged time is empty until someone \
acknowledges. State what that means for the column's nullability, and one \
operational report you can write from that single column."""


# -------------------------------------------------- cfg 60, UML_COMPONENT
def scada_components():
    d = Diagram("Calder Industrial - SCADA Component Architecture",
                "UML component diagram (model answer)")
    d.shape("plc", "PlcController", "component", 40, 130, 200, 70)
    d.shape("rtu", "RemoteTerminalUnit", "component", 40, 250, 200, 70)
    d.shape("poll", "ProtocolPoller", "component", 320, 190, 210, 70)
    d.shape("trans", "ProtocolTranslator", "component", 320, 330, 210, 70)
    d.shape("hist", "Historian", "component", 620, 130, 210, 70)
    d.shape("scada", "ScadaCore", "component", 620, 280, 210, 70)
    d.shape("hmi", "OperatorHmi", "component", 920, 130, 210, 70)
    d.shape("alarm", "AlarmServer", "component", 920, 280, 210, 70)
    d.shape("dmz", "DataDiodeGateway", "component", 620, 440, 210, 70)
    d.shape("erp", "EnterpriseReporting", "component", 920, 440, 210, 70)
    d.shape("i_tag", "ITagRead", "provided", 585, 205, 22, 22)
    d.shape("i_hist", "IHistorianWrite", "provided", 585, 145, 22, 22)
    d.shape("i_scada", "IProcessState", "provided", 885, 295, 22, 22)
    d.shape("i_alarm", "IAlarmNotify", "provided", 885, 145, 22, 22)
    d.shape("i_diode", "IOneWayExport", "provided", 885, 455, 22, 22)
    d.edge("poll", "plc", "dep", "Modbus")
    d.edge("poll", "rtu", "dep", "DNP3")
    d.edge("poll", "trans", "dep", "normalises through")
    d.edge("trans", "scada", "dep", "ITagRead")
    d.edge("scada", "hist", "dep", "IHistorianWrite")
    d.edge("hmi", "scada", "dep", "IProcessState")
    d.edge("alarm", "scada", "dep", "IProcessState")
    d.edge("hmi", "alarm", "dep", "IAlarmNotify")
    d.edge("scada", "dmz", "dep", "IOneWayExport")
    d.edge("erp", "dmz", "dep", "IOneWayExport")
    d.legend(COMPONENT_LEGEND + ["diode exports only; nothing flows back in"],
             x=320, y=470)
    return d.xml()


CFG60_Q = """\
"Calder Industrial" - SCADA Architecture

Calder runs plant equipment that speaks two different field protocols, and the \
business wants production figures without being able to reach the plant network. \
Model the component architecture.

a) PLC controllers speak Modbus and remote terminal units speak DNP3. Neither \
knows anything else in the system.
b) One protocol poller talks to both device kinds. It is the only component that \
touches field equipment.
c) The poller normalises everything through the protocol translator, so that no \
component above it knows which field protocol a value came from.
d) The translator provides ITagRead to the SCADA core.
e) The SCADA core writes to the historian through IHistorianWrite. No other \
component writes to the historian.
f) The SCADA core provides IProcessState. Both the operator HMI and the alarm \
server read process state through that one interface.
g) The operator HMI receives alarms through the alarm server's IAlarmNotify \
interface.
h) The SCADA core exports to the data diode gateway through IOneWayExport. \
Enterprise reporting reads from the gateway through that same interface.
i) Nothing on the enterprise side may reach any component below the gateway, and \
no component below the gateway depends on enterprise reporting."""

CFG60_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (c) is the reason the translator exists. Explain in one sentence \
what adding a third field protocol would cost in this design, and which \
components would have to change.
5. Requirement (i) is a security boundary. Mark it on your diagram, state in one \
sentence what property the one-way gateway enforces, and name the one thing \
enterprise reporting can never do as a result."""


# ------------------------------------------------------------ cfg 61, ERD
def access_control_model():
    d = Diagram("Pellworth Bank - Access Control and Classification",
                "Entity-relationship diagram (model answer)")
    d.node("user", "UserAccount", ["PK userId: String", "username: String",
                                   "FK employeeId: String", "status: String",
                                   "lastLoginAt: Date"], 40, 90)
    d.node("emp", "Employee", ["PK employeeId: String", "fullName: String",
                               "department: String", "leftOn: Date"], 40, 320)
    d.node("role", "Role", ["PK roleId: String", "name: String",
                            "description: String", "isPrivileged: boolean"], 620, 90)
    d.node("assign", "RoleAssignment", ["PK assignmentId: String", "FK userId: String",
                                        "FK roleId: String", "grantedOn: Date",
                                        "expiresOn: Date",
                                        "FK grantedById: String"], 320, 90)
    d.node("perm", "Permission", ["PK permissionId: String", "name: String",
                                  "action: String"], 900, 90)
    d.node("rp", "RolePermission", ["PK rolePermissionId: String", "FK roleId: String",
                                    "FK permissionId: String"], 900, 300)
    d.node("res", "Resource", ["PK resourceId: String", "name: String",
                               "resourceType: String",
                               "FK classificationId: String"], 620, 300)
    d.node("cls", "Classification", ["PK classificationId: String", "label: String",
                                     "rank: int",
                                     "handlingRule: String"], 620, 540)
    d.node("grant", "ResourceGrant", ["PK grantId: String", "FK roleId: String",
                                      "FK resourceId: String",
                                      "accessLevel: String"], 320, 300)
    d.node("log", "AccessLog", ["PK accessLogId: long", "FK userId: String",
                                "FK resourceId: String", "occurredAt: Date",
                                "action: String", "wasPermitted: boolean"], 320, 540)
    d.edge("emp", "user", "assoc", "is issued", "1", "0..*")
    d.edge("user", "assign", "comp", "holds", "1", "0..*")
    d.edge("role", "assign", "assoc", "is granted through", "1", "0..*")
    d.edge("role", "rp", "comp", "confers", "1", "1..*")
    d.edge("perm", "rp", "assoc", "is conferred by", "1", "0..*")
    d.edge("cls", "res", "assoc", "classifies", "1", "0..*")
    d.edge("role", "grant", "comp", "is granted", "1", "0..*")
    d.edge("res", "grant", "assoc", "is reachable through", "1", "0..*")
    d.edge("user", "log", "assoc", "generates", "1", "0..*")
    d.edge("res", "log", "assoc", "is recorded in", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=540)
    return d.xml()


CFG61_Q = """\
"Pellworth Bank" - Access Control and Data Classification

Pellworth's auditor asked who could read a particular customer file last \
quarter, and nobody could answer. Model the access control data.

a) An employee has a name, a department and a leaving date, which is empty \
while they are still employed. Employees are never deleted.
b) An employee is issued any number of user accounts over time. An account has \
a username, a status and a last login time.
c) A role has a name, a description and a privileged flag. Roles are defined \
centrally and outlive any assignment.
d) A user account holds any number of role assignments. Each names one role and \
records who granted it, when, and when it expires. Assignments are deleted with \
the account.
e) A role confers one or more permissions, and a permission may be conferred by \
many roles. A permission has a name and an action.
f) A resource has a name and a type and is classified by exactly one \
classification. A classification has a label, a rank and a handling rule, and is \
a standing list.
g) A role is granted access to any number of resources, each grant recording an \
access level. A resource may be reachable through many roles.
h) An access log row records that a user account acted on a resource at a time, \
with the action and whether it was permitted. Log rows are never deleted."""

CFG61_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (e) and (g) are many-to-many. Resolve both into associative \
entities.
4. Answer the auditor's question: trace on your diagram the path from a \
resource to every employee who could reach it, naming every entity crossed. State \
in one sentence why requirement (d)'s expiry date is what makes "last quarter" \
answerable.
5. Requirement (a) says employees are never deleted and requirement (h) says log \
rows are never deleted. State in one sentence what each rule protects, and why \
requirement (b) separates the account from the person."""


# -------------------------------------------------- cfg 62, UML_COMPONENT
def defence_in_depth():
    d = Diagram("Pellworth Bank - Defence in Depth Zones",
                "UML component diagram (model answer)")
    d.shape("internet", "InternetClient", "component", 40, 140, 200, 70)
    d.shape("edge", "EdgeFirewall", "component", 300, 140, 200, 70)
    d.shape("ips", "IntrusionPrevention", "component", 300, 260, 200, 70)
    d.shape("rp", "ReverseProxy", "component", 560, 140, 200, 70)
    d.shape("app", "ApplicationTier", "component", 820, 140, 200, 70)
    d.shape("inner", "InternalFirewall", "component", 820, 280, 200, 70)
    d.shape("db", "DatabaseTier", "component", 1080, 280, 200, 70)
    d.shape("bastion", "AdminBastion", "component", 560, 420, 200, 70)
    d.shape("mfa", "MfaService", "component", 300, 420, 200, 70)
    d.shape("mon", "SecurityMonitoring", "component", 1080, 420, 200, 70)
    d.shape("i_filt", "IFilteredTraffic", "provided", 265, 155, 22, 22)
    d.shape("i_insp", "IInspectedTraffic", "provided", 525, 155, 22, 22)
    d.shape("i_app", "IApplicationService", "provided", 785, 155, 22, 22)
    d.shape("i_data", "IDataAccess", "provided", 1045, 295, 22, 22)
    d.shape("i_mfa", "IStrongAuth", "provided", 265, 435, 22, 22)
    d.shape("i_mon", "ITelemetryFeed", "provided", 1045, 435, 22, 22)
    d.edge("internet", "edge", "dep", "IFilteredTraffic")
    d.edge("edge", "ips", "dep", "inspects through")
    d.edge("ips", "rp", "dep", "IInspectedTraffic")
    d.edge("rp", "app", "dep", "IApplicationService")
    d.edge("app", "inner", "dep", "traverses")
    d.edge("inner", "db", "dep", "IDataAccess")
    d.edge("bastion", "mfa", "dep", "IStrongAuth")
    d.edge("bastion", "inner", "dep", "traverses")
    for src in ("edge", "ips", "rp", "app", "inner", "bastion"):
        d.edge(src, "mon", "dep", "ITelemetryFeed")
    d.legend(COMPONENT_LEGEND + ["each zone is entered only through its control"],
             x=40, y=280)
    return d.xml()


CFG62_Q = """\
"Pellworth Bank" - Defence in Depth

Pellworth's current network is flat: anything that reaches the web server can \
reach the database. Model a layered architecture in which that is not true.

a) An internet client reaches the bank only through the edge firewall, which \
provides IFilteredTraffic. Nothing bypasses it.
b) The edge firewall passes traffic to the intrusion prevention system for \
inspection.
c) The IPS provides IInspectedTraffic to the reverse proxy. The reverse proxy \
is the only component that terminates a client connection.
d) The reverse proxy reaches the application tier through IApplicationService. \
An internet client never reaches the application tier directly.
e) The application tier reaches the database tier only by traversing the \
internal firewall, which provides IDataAccess. The application tier does not \
connect to the database directly.
f) Administrators reach internal systems only through the admin bastion, which \
requires strong authentication from the MFA service through IStrongAuth.
g) The bastion also traverses the internal firewall; it is not exempt from it.
h) Every control component -- the edge firewall, the IPS, the reverse proxy, \
the application tier, the internal firewall and the bastion -- feeds the security \
monitoring platform through ITelemetryFeed.
i) Nothing depends on security monitoring, and the database tier depends on \
nothing."""

CFG62_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Mark the security zones on your diagram, and count the controls an internet \
client must pass to reach the database tier. State in one sentence what the flat \
network in the opening paragraph counted instead.
5. Requirement (g) says the bastion is not exempt from the internal firewall. \
Explain in one sentence what attack that closes, and name the principle that \
requirement (h) is implementing."""


# ----------------------------------------------- cfg 63, ACTIVITY_DIAGRAM
def control_implementation():
    d = Diagram("ISMS Control Implementation",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 160, 90, 40, 40)
    d.shape("soa", "Read the statement\nof applicability", "action", 90, 165, 200, 55)
    d.shape("d0", "control\napplicable?", "decision", 110, 255, 170, 90)
    d.shape("just", "Record the\njustification for exclusion", "action", 440, 270, 220, 55)
    d.shape("owner", "Assign a\ncontrol owner", "action", 90, 375, 200, 55)
    d.shape("gap", "Perform a\ngap analysis", "action", 90, 460, 200, 55)
    d.shape("fork", "", "bar", 430, 545, 10, 210)
    d.shape("proc", "Write the\nprocedure", "action", 80, 565, 190, 55)
    d.shape("tech", "Configure the\ntechnical control", "action", 490, 565, 190, 55)
    d.shape("train", "Train the\naffected staff", "action", 490, 655, 190, 55)
    d.shape("join", "", "bar", 430, 780, 10, 210)
    d.shape("oper", "Operate the control\nfor one period", "action", 80, 800, 210, 55)
    d.shape("evid", "Collect operating\nevidence", "action", 80, 885, 200, 55)
    d.shape("test", "Test the control's\neffectiveness", "action", 80, 970, 200, 55)
    d.shape("d1", "operating\neffectively?", "decision", 100, 1060, 175, 90)
    d.shape("remed", "Remediate the\ndeficiency", "action", 440, 1075, 190, 55)
    d.shape("d2", "design\nat fault?", "decision", 700, 1065, 170, 90)
    d.shape("declare", "Declare the control\nimplemented", "action", 80, 1185, 210, 55)
    d.shape("end", "", "end", 165, 1275, 40, 40)
    d.flow("start", "soa")
    d.flow("soa", "d0")
    d.flow("d0", "just", "[no]")
    d.flow("just", "end")
    d.flow("d0", "owner", "[yes]")
    d.flow("owner", "gap")
    d.flow("gap", "fork")
    d.flow("fork", "proc")
    d.flow("fork", "tech")
    d.flow("fork", "train")
    d.flow("proc", "join")
    d.flow("tech", "join")
    d.flow("train", "join")
    d.flow("join", "oper")
    d.flow("oper", "evid")
    d.flow("evid", "test")
    d.flow("test", "d1")
    d.flow("d1", "remed", "[no]")
    d.flow("remed", "d2")
    d.flow("d2", "gap", "[yes: redesign]")
    d.flow("d2", "oper", "[no: operating fault]")
    d.flow("d1", "declare", "[yes]")
    d.flow("declare", "end")
    d.legend(PROCESS_LEGEND, x=940, y=600)
    return d.xml()


CFG63_Q = """\
ISMS Control Implementation

A security manager is documenting how a control moves from the statement of \
applicability to being declared implemented.

a) The manager reads the statement of applicability for the control.
b) If the control is not applicable, the justification for excluding it is \
recorded and the process ends there.
c) An applicable control is assigned a control owner, and a gap analysis is \
performed against current practice.
d) Three implementation activities then run: writing the procedure, configuring \
the technical control, and training the affected staff. They are independent and \
may be done in any order or at the same time; operation starts only when all \
three are complete.
e) The control is operated for one period, operating evidence is collected, and \
its effectiveness is tested.
f) If it is not operating effectively, the deficiency is remediated and the team \
asks whether the control's DESIGN was at fault.
g) If the design was at fault, the process returns to the gap analysis. If it \
was only an operating fault, it returns to operating the control for another \
period.
h) When the control is operating effectively it is declared implemented and the \
process ends."""

CFG63_I = """\
1. Draw the activity diagram with exactly one initial node and one final node -- \
requirement (b) also terminates, so route it to the same final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (d) with a fork and a join, and explain in one sentence \
what the join guarantees before the control is operated.
4. Label EVERY decision branch with its guard, and show both loops in \
requirement (g) returning to their correct activities.
5. Requirement (f) distinguishes a design fault from an operating fault. Explain \
in one sentence what separates them, and why the two are sent to different \
places in the process."""


# ------------------------------------------------------ cfg 64, FLOWCHART
def incident_response():
    d = Diagram("Pellworth Bank - Security Incident Response",
                "Flowchart (model answer)")
    d.shape("s", "Start: alert or\nreport received", "terminator", 80, 90, 220, 55)
    d.shape("triage", "Triage and\nverify the alert", "action", 95, 175, 190, 55)
    d.shape("d1", "genuine\nincident?", "decision", 110, 265, 165, 90)
    d.shape("close", "Record as a\nfalse positive", "action", 430, 280, 180, 55)
    d.shape("class", "Classify severity\nand category", "action", 95, 385, 190, 55)
    d.shape("d2", "major\nincident?", "decision", 110, 475, 165, 90)
    d.shape("invoke", "Invoke the crisis\nmanagement team", "action", 430, 490, 200, 55)
    d.shape("contain", "Contain the\nincident", "action", 95, 595, 190, 50)
    d.shape("d3", "contained?", "decision", 110, 675, 165, 85)
    d.shape("escal", "Escalate and\nwiden containment", "action", 430, 690, 190, 55)
    d.shape("erad", "Eradicate the\nroot cause", "action", 95, 790, 190, 55)
    d.shape("recover", "Recover services\nand verify", "action", 95, 875, 190, 55)
    d.shape("d4", "services\nverified?", "decision", 110, 965, 165, 90)
    d.shape("reback", "Return to\nrecovery", "action", 430, 980, 180, 55)
    d.shape("d5", "notifiable\nbreach?", "decision", 110, 1085, 165, 90)
    d.shape("notify", "Notify the regulator\nand data subjects", "action", 430, 1100, 210, 55)
    d.shape("lessons", "Hold a lessons\nlearned review", "action", 95, 1205, 190, 55)
    d.shape("e", "End", "terminator", 125, 1290, 140, 45)
    d.flow("s", "triage")
    d.flow("triage", "d1")
    d.flow("d1", "close", "[no]")
    d.flow("close", "e")
    d.flow("d1", "class", "[yes]")
    d.flow("class", "d2")
    d.flow("d2", "invoke", "[yes]")
    d.flow("invoke", "contain")
    d.flow("d2", "contain", "[no]")
    d.flow("contain", "d3")
    d.flow("d3", "escal", "[no]")
    d.flow("escal", "contain")
    d.flow("d3", "erad", "[yes]")
    d.flow("erad", "recover")
    d.flow("recover", "d4")
    d.flow("d4", "reback", "[no]")
    d.flow("reback", "recover")
    d.flow("d4", "d5", "[yes]")
    d.flow("d5", "notify", "[yes]")
    d.flow("notify", "lessons")
    d.flow("d5", "lessons", "[no]")
    d.flow("lessons", "e")
    d.legend(PROCESS_LEGEND, x=700, y=250)
    return d.xml()


CFG64_Q = """\
"Pellworth Bank" - Security Incident Response

Pellworth must show a regulator that incidents follow a defined process and \
that notification decisions are made deliberately. Model the process.

a) The process starts when an alert or a report is received. It is triaged and \
verified.
b) If it is not a genuine incident, it is recorded as a false positive and the \
process ends.
c) A genuine incident is classified by severity and category.
d) A major incident additionally invokes the crisis management team; a minor \
one does not. Both then continue to containment.
e) The incident is contained. If containment fails, it is escalated, \
containment is widened, and containment is attempted again. This may happen any \
number of times.
f) Once contained, the root cause is eradicated and services are recovered and \
verified.
g) If verification fails, the team returns to recovery -- not to eradication.
h) The team then decides whether the incident is a notifiable breach. If it is, \
the regulator and the affected data subjects are notified.
i) In both cases a lessons learned review is held, and the process ends."""

CFG64_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirements (d), (h) and (i) each have two branches that converge again. \
Show each pair converging on one activity rather than duplicating the steps that \
follow.
5. Requirement (f) fixes the order: contain, then eradicate, then recover. State \
in one sentence what goes wrong if eradication is attempted before containment, \
and why requirement (g) returns to recovery rather than to eradication."""


# -------------------------------------------------- cfg 65, UML_COMPONENT
def erp_integration():
    d = Diagram("Larkspur Foods - ERP Integration Architecture",
                "UML component diagram (model answer)")
    d.shape("web", "EcommerceFrontend", "component", 40, 130, 210, 70)
    d.shape("pos", "StorePos", "component", 40, 250, 210, 70)
    d.shape("bus", "IntegrationBus", "component", 320, 190, 210, 70)
    d.shape("mdm", "MasterDataService", "component", 320, 350, 210, 70)
    d.shape("erpsales", "ErpSalesModule", "component", 620, 90, 210, 70)
    d.shape("erpinv", "ErpInventoryModule", "component", 620, 210, 220, 70)
    d.shape("erpfin", "ErpFinanceModule", "component", 620, 330, 210, 70)
    d.shape("erphr", "ErpHrModule", "component", 620, 450, 210, 70)
    d.shape("wms", "WarehouseSystem", "component", 920, 210, 220, 70)
    d.shape("bi", "BusinessIntelligence", "component", 920, 390, 220, 70)
    d.shape("i_bus", "IMessageRoute", "provided", 285, 205, 22, 22)
    d.shape("i_mdm", "IMasterDataLookup", "provided", 285, 365, 22, 22)
    d.shape("i_sales", "ISalesOrder", "provided", 585, 105, 22, 22)
    d.shape("i_inv", "IStockPosition", "provided", 585, 225, 22, 22)
    d.shape("i_fin", "IPostingEntry", "provided", 585, 345, 22, 22)
    d.shape("i_wms", "IPickAndPack", "provided", 885, 225, 22, 22)
    d.edge("web", "bus", "dep", "IMessageRoute")
    d.edge("pos", "bus", "dep", "IMessageRoute")
    d.edge("bus", "erpsales", "dep", "ISalesOrder")
    d.edge("bus", "erpinv", "dep", "IStockPosition")
    d.edge("bus", "mdm", "dep", "IMasterDataLookup")
    d.edge("erpsales", "erpfin", "dep", "IPostingEntry")
    d.edge("erpinv", "erpfin", "dep", "IPostingEntry")
    d.edge("erphr", "erpfin", "dep", "IPostingEntry")
    d.edge("erpinv", "wms", "dep", "IPickAndPack")
    d.edge("bi", "erpfin", "dep", "reads from")
    d.edge("bi", "erpsales", "dep", "reads from")
    d.legend(COMPONENT_LEGEND + ["front ends know only the bus"], x=40, y=390)
    return d.xml()


CFG65_Q = """\
"Larkspur Foods" - ERP Integration Architecture

Larkspur's web shop and its tills each talk directly to four ERP modules, so \
every ERP upgrade breaks both. Model an architecture that removes those direct \
links.

a) The e-commerce front end and the store point-of-sale both send traffic \
through one integration bus, which provides IMessageRoute. Neither front end \
knows any ERP module exists.
b) The bus routes sales traffic to the ERP sales module through ISalesOrder and \
stock queries to the ERP inventory module through IStockPosition.
c) The bus looks up customers and products in the master data service through \
IMasterDataLookup. That service is the only source of master data.
d) The ERP sales, inventory and HR modules all post to the ERP finance module \
through IPostingEntry. Finance is the only module that holds the ledger.
e) The ERP inventory module instructs the warehouse system through \
IPickAndPack.
f) Business intelligence reads from the finance and sales modules. Nothing \
depends on business intelligence.
g) No ERP module depends on the bus or on a front end."""

CFG65_I = """\
1. Draw every component in requirements (a) to (f) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Count the dependencies the front ends have in your diagram, and say what that \
count would have been in the architecture described in the opening paragraph. \
State in one sentence what the bus has bought.
5. Requirement (d) has three consumers of one interface. Explain in one \
sentence why the ledger lives in one module, and what would go wrong in the \
accounts if each module posted its own."""


# ------------------------------------------------------------ cfg 66, ERD
def procure_to_pay():
    d = Diagram("Larkspur Foods - Procure to Pay",
                "Entity-relationship diagram (model answer)")
    d.node("supplier", "Supplier", ["PK supplierId: String", "name: String",
                                    "paymentTerms: String", "isApproved: boolean"],
           40, 90)
    d.node("req", "PurchaseRequisition", ["PK requisitionId: String",
                                          "FK requestedById: String",
                                          "FK costCentreId: String",
                                          "raisedOn: Date", "status: String"], 320, 90)
    d.node("reqline", "RequisitionLine", ["PK requisitionLineId: String",
                                          "FK requisitionId: String",
                                          "FK itemId: String", "quantity: double",
                                          "estimatedPrice: double"], 320, 320)
    d.node("po", "PurchaseOrder", ["PK purchaseOrderId: String",
                                   "FK supplierId: String",
                                   "FK requisitionId: String", "orderedOn: Date",
                                   "status: String"], 620, 90)
    d.node("poline", "OrderLine", ["PK orderLineId: String",
                                   "FK purchaseOrderId: String", "FK itemId: String",
                                   "quantity: double", "unitPrice: double"], 620, 320)
    d.node("item", "Item", ["PK itemId: String", "sku: String", "name: String",
                            "unitOfMeasure: String"], 900, 320)
    d.node("grn", "GoodsReceipt", ["PK receiptId: String",
                                   "FK purchaseOrderId: String", "receivedOn: Date",
                                   "deliveryNote: String"], 900, 90)
    d.node("grnline", "ReceiptLine", ["PK receiptLineId: String",
                                      "FK receiptId: String", "FK orderLineId: String",
                                      "quantityReceived: double"], 900, 540)
    d.node("inv", "SupplierInvoice", ["PK invoiceId: String", "FK supplierId: String",
                                      "invoiceNumber: String", "invoicedOn: Date",
                                      "total: double", "status: String"], 40, 320)
    d.node("invline", "InvoiceLine", ["PK invoiceLineId: String", "FK invoiceId: String",
                                      "FK orderLineId: String", "amount: double"],
           320, 540)
    d.node("pay", "Payment", ["PK paymentId: String", "FK invoiceId: String",
                              "paidOn: Date", "amount: double",
                              "method: String"], 40, 540)
    d.node("approval", "Approval", ["PK approvalId: String", "FK requisitionId: String",
                                    "FK approverId: String", "approvedOn: Date",
                                    "decision: String"], 620, 540)
    d.edge("req", "reqline", "comp", "consists of", "1", "1..*")
    d.edge("item", "reqline", "assoc", "is requested as", "1", "0..*")
    d.edge("req", "po", "assoc", "results in", "1", "0..*")
    d.edge("supplier", "po", "assoc", "receives", "1", "0..*")
    d.edge("po", "poline", "comp", "consists of", "1", "1..*")
    d.edge("item", "poline", "assoc", "is ordered as", "1", "0..*")
    d.edge("po", "grn", "assoc", "is received by", "1", "0..*")
    d.edge("grn", "grnline", "comp", "records", "1", "1..*")
    d.edge("poline", "grnline", "assoc", "is receipted as", "1", "0..*")
    d.edge("supplier", "inv", "assoc", "issues", "1", "0..*")
    d.edge("inv", "invline", "comp", "consists of", "1", "1..*")
    d.edge("poline", "invline", "assoc", "is invoiced as", "1", "0..*")
    d.edge("inv", "pay", "comp", "is settled by", "1", "0..*")
    d.edge("req", "approval", "comp", "requires", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=740)
    return d.xml()


CFG66_Q = """\
"Larkspur Foods" - Procure to Pay

Larkspur pays some invoices twice and cannot match others to anything ordered. \
Model the data that supports a three-way match.

a) A supplier has a name, payment terms and an approved flag, and stays on file \
after their orders are archived.
b) A purchase requisition is raised by a requester against a cost centre, with a \
date and a status, and consists of one or more requisition lines. A line names an \
item with a quantity and an estimated price, and cannot exist without its \
requisition.
c) A requisition requires any number of approvals, each given by exactly one \
approver with a date and a decision.
d) A requisition results in any number of purchase orders. A purchase order is \
placed on exactly one supplier with an order date and a status.
e) A purchase order consists of one or more order lines, each naming an item \
with a quantity and a unit price.
f) An item has an SKU, a name and a unit of measure, and is a standing \
catalogue entry.
g) A purchase order is received by any number of goods receipts, each with a \
receipt date and a delivery note number -- a part delivery is normal.
h) A goods receipt records one or more receipt lines, each referring to exactly \
one order line and recording the quantity received.
i) A supplier issues invoices, each with an invoice number, date, total and \
status. An invoice consists of one or more invoice lines, each referring to \
exactly one order line with an amount.
j) An invoice is settled by any number of payments, each with a date, amount \
and method."""

CFG66_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (g) to (i) let one order line be received and invoiced in \
several pieces. Show the cardinalities that allow that.
4. The three-way match compares what was ordered, what was received and what was \
invoiced. Name the three entities it compares and the single entity that joins \
all three, and trace the path on your diagram.
5. Requirement (j) allows several payments against one invoice. State in one \
sentence what real situation that models, and what query would detect the \
double payment described in the opening paragraph."""


# ------------------------------------------------------------ cfg 67, ERD
def capacity_cost_model():
    d = Diagram("Skelton Datacentre - Cost and Capacity Records",
                "Entity-relationship diagram (model answer)")
    d.node("service", "ItService", ["PK serviceId: String", "name: String",
                                    "criticality: String",
                                    "FK ownerId: String"], 40, 90)
    d.node("owner", "ServiceOwner", ["PK ownerId: String", "fullName: String",
                                     "department: String"], 40, 320)
    d.node("ci", "ConfigurationItem", ["PK ciId: String", "FK serviceId: String",
                                       "name: String", "ciType: String",
                                       "FK locationId: String"], 320, 90)
    d.node("loc", "Location", ["PK locationId: String", "name: String",
                               "rackSpaceUnits: int"], 620, 90)
    d.node("cap", "CapacityMetric", ["PK capacityMetricId: String", "FK ciId: String",
                                     "metricName: String", "unit: String",
                                     "capacityLimit: double"], 320, 320)
    d.node("util", "UtilisationSample", ["PK sampleId: long",
                                         "FK capacityMetricId: String",
                                         "FK periodId: String", "peakValue: double",
                                         "meanValue: double"], 320, 560)
    d.node("period", "Period", ["PK periodId: String", "name: String",
                                "startsOn: Date", "endsOn: Date"], 620, 560)
    d.node("cost", "CostRecord", ["PK costRecordId: String", "FK ciId: String",
                                  "FK costTypeId: String", "FK periodId: String",
                                  "amount: double"], 620, 320)
    d.node("ctype", "CostType", ["PK costTypeId: String", "name: String",
                                 "isCapital: boolean",
                                 "allocationBasis: String"], 900, 320)
    d.node("charge", "ChargebackLine", ["PK chargebackLineId: String",
                                        "FK serviceId: String", "FK periodId: String",
                                        "FK costCentreId: String",
                                        "allocatedAmount: double"], 900, 560)
    d.edge("owner", "service", "assoc", "owns", "1", "0..*")
    d.edge("service", "ci", "comp", "is delivered by", "1", "1..*")
    d.edge("loc", "ci", "assoc", "houses", "1", "0..*")
    d.edge("ci", "cap", "comp", "is limited by", "1", "1..*")
    d.edge("cap", "util", "comp", "is sampled as", "1", "0..*")
    d.edge("period", "util", "assoc", "dates", "1", "0..*")
    d.edge("ci", "cost", "comp", "incurs", "1", "0..*")
    d.edge("ctype", "cost", "assoc", "classifies", "1", "0..*")
    d.edge("period", "cost", "assoc", "dates", "1", "0..*")
    d.edge("service", "charge", "comp", "is recharged as", "1", "0..*")
    d.edge("period", "charge", "assoc", "dates", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=90)
    return d.xml()


CFG67_Q = """\
"Skelton Datacentre" - Cost and Capacity Records

Skelton charges departments for IT but cannot show how a charge was derived, \
and cannot say which service will run out of capacity first. Model the data \
behind both.

a) An IT service has a name and a criticality and is owned by exactly one \
service owner. Owners have a name and a department and remain on file after a \
service is retired.
b) A service is delivered by one or more configuration items, each with a name \
and a type. A configuration item has no meaning apart from its service.
c) A configuration item is housed at exactly one location. Locations have a name \
and a rack space figure, and items are relocated, so an item is not destroyed \
with a location.
d) A configuration item is limited by one or more capacity metrics, each with a \
metric name, a unit and a capacity limit.
e) A capacity metric is sampled as any number of utilisation samples, each for \
exactly one period, recording the peak and mean values.
f) A period has a name and a start and end date, and exists whether or not \
anything was sampled or charged in it.
g) A configuration item incurs any number of cost records, each classified by \
exactly one cost type and dated to exactly one period, with an amount.
h) A cost type has a name, a capital flag and an allocation basis. Cost types \
are a standing list.
i) A service is recharged as any number of chargeback lines, each for one period \
and one cost centre, with an allocated amount."""

CFG67_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Answer the first question in the opening paragraph: trace on your diagram the \
path from a chargeback line back to the individual costs behind it, naming every \
entity crossed.
4. Answer the second: name the two attributes you would compare to find the \
service closest to its capacity limit, and say which entities they sit on.
5. Requirement (f) says periods exist whether or not anything happened in them. \
State in one sentence what report that makes possible, and what a month with no \
cost records would look like without it."""


# ------------------------------------------------------ cfg 68, FLOWCHART
def kpi_reporting_cycle():
    d = Diagram("Skelton Datacentre - Monthly KPI Reporting",
                "Flowchart (model answer)")
    d.shape("s", "Start: period closes", "terminator", 80, 90, 210, 50)
    d.shape("collect", "Collect actuals from\nthe source systems", "action",
            90, 175, 200, 55)
    d.shape("d1", "all sources\nreported?", "decision", 110, 265, 170, 90)
    d.shape("chase", "Chase the\nmissing source", "action", 440, 280, 190, 55)
    d.shape("d2", "deadline\npassed?", "decision", 700, 270, 170, 90)
    d.shape("estimate", "Use a flagged\nestimate", "action", 950, 285, 180, 55)
    d.shape("calc", "Calculate each KPI\nfrom its formula", "action", 90, 385, 200, 55)
    d.shape("compare", "Compare actual\nagainst target", "action", 90, 470, 200, 55)
    d.shape("d3", "within\nthreshold?", "decision", 110, 560, 170, 90)
    d.shape("var", "Record a variance\nand its cause", "action", 440, 575, 200, 55)
    d.shape("d4", "action\nrequired?", "decision", 700, 565, 170, 90)
    d.shape("act", "Raise an\nimprovement action", "action", 950, 580, 190, 55)
    d.shape("pub", "Publish the\nscorecard", "action", 90, 680, 200, 50)
    d.shape("rev", "Hold the performance\nreview meeting", "action", 90, 760, 210, 55)
    d.shape("d5", "targets still\nappropriate?", "decision", 105, 850, 180, 95)
    d.shape("retarget", "Revise targets for\nthe next period", "action",
            440, 865, 200, 55)
    d.shape("e", "End", "terminator", 120, 975, 140, 45)
    d.flow("s", "collect")
    d.flow("collect", "d1")
    d.flow("d1", "chase", "[no]")
    d.flow("chase", "d2")
    d.flow("d2", "collect", "[no: still time]")
    d.flow("d2", "estimate", "[yes]")
    d.flow("estimate", "calc")
    d.flow("d1", "calc", "[yes]")
    d.flow("calc", "compare")
    d.flow("compare", "d3")
    d.flow("d3", "var", "[no]")
    d.flow("var", "d4")
    d.flow("d4", "act", "[yes]")
    d.flow("act", "pub")
    d.flow("d4", "pub", "[no]")
    d.flow("d3", "pub", "[yes]")
    d.flow("pub", "rev")
    d.flow("rev", "d5")
    d.flow("d5", "retarget", "[no]")
    d.flow("retarget", "e")
    d.flow("d5", "e", "[yes]")
    d.legend(PROCESS_LEGEND, x=950, y=700)
    return d.xml()


CFG68_Q = """\
"Skelton Datacentre" - Monthly KPI Reporting

Skelton's scorecard is published late every month because one source system \
always reports last, and variances are noted but never acted on. Model the \
process that fixes both.

a) The cycle starts when the period closes. Actuals are collected from the \
source systems.
b) If any source has not reported, it is chased. If the publication deadline has \
not passed, collection is attempted again; this may repeat.
c) If the deadline has passed, a flagged estimate is used for the missing source \
and the cycle continues.
d) Each KPI is calculated from its formula, and the actual is compared against \
its target.
e) If a KPI is within its threshold, nothing further is recorded for it.
f) If it is outside the threshold, a variance and its cause are recorded, and \
the team decides whether an action is required. If one is, an improvement action \
is raised.
g) The scorecard is published and the performance review meeting is held.
h) The meeting asks whether the targets are still appropriate. If they are not, \
targets are revised for the next period.
i) The cycle then ends."""

CFG68_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (c) is what stops the late-publication problem in the opening \
paragraph. Explain in one sentence what the flag on the estimate is for, and \
what would be wrong with simply waiting.
5. Requirements (e), (f) and (h) all have branches that rejoin. Show each pair \
converging on one activity rather than duplicating the steps that follow, and \
state which single decision turns a noted variance into an acted-on one."""


# ------------------------------------------------------------ cfg 69, ERD
def improvement_programme():
    d = Diagram("Oakhaven Manufacturing - Continuous Improvement Records",
                "Entity-relationship diagram (model answer)")
    d.node("problem", "Problem", ["PK problemId: String", "FK processId: String",
                                  "statement: String", "raisedOn: Date",
                                  "severity: String"], 40, 90)
    d.node("process", "BusinessProcess", ["PK processId: String", "name: String",
                                          "FK ownerId: String",
                                          "department: String"], 40, 320)
    d.node("owner", "ProcessOwner", ["PK ownerId: String", "fullName: String",
                                     "role: String"], 40, 540)
    d.node("analysis", "Analysis", ["PK analysisId: String", "FK problemId: String",
                                    "FK techniqueId: String", "performedOn: Date",
                                    "conclusion: String"], 320, 90)
    d.node("technique", "Technique", ["PK techniqueId: String", "name: String",
                                      "category: String"], 320, 320)
    d.node("cause", "Cause", ["PK causeId: String", "FK analysisId: String",
                              "FK parentCauseId: String", "description: String",
                              "isRoot: boolean"], 620, 90)
    d.node("solution", "Solution", ["PK solutionId: String", "description: String",
                                    "estimatedCost: double",
                                    "expectedBenefit: double"], 900, 90)
    d.node("link", "CauseSolution", ["PK causeSolutionId: String", "FK causeId: String",
                                     "FK solutionId: String",
                                     "coveragePercent: double"], 620, 320)
    d.node("initiative", "Initiative", ["PK initiativeId: String",
                                        "FK solutionId: String",
                                        "FK sponsorId: String", "startedOn: Date",
                                        "status: String"], 900, 320)
    d.node("action", "ActionItem", ["PK actionId: String", "FK initiativeId: String",
                                    "FK assigneeId: String", "description: String",
                                    "dueOn: Date", "status: String"], 900, 540)
    d.node("benefit", "BenefitMeasure", ["PK benefitId: String",
                                         "FK initiativeId: String",
                                         "measuredOn: Date", "actualBenefit: double"],
           620, 540)
    d.edge("owner", "process", "assoc", "owns", "1", "0..*")
    d.edge("process", "problem", "comp", "exhibits", "1", "0..*")
    d.edge("problem", "analysis", "comp", "is analysed by", "1", "0..*")
    d.edge("technique", "analysis", "assoc", "is used in", "1", "0..*")
    d.edge("analysis", "cause", "comp", "identifies", "1", "1..*")
    d.edge("cause", "cause", "assoc", "contributes to", "0..1", "0..*")
    d.edge("cause", "link", "comp", "is addressed through", "1", "0..*")
    d.edge("solution", "link", "assoc", "addresses", "1", "0..*")
    d.edge("solution", "initiative", "assoc", "is delivered by", "1", "0..*")
    d.edge("initiative", "action", "comp", "breaks into", "1", "1..*")
    d.edge("initiative", "benefit", "comp", "is measured by", "1", "0..*")
    d.legend(ERD_LEGEND, x=320, y=540)
    return d.xml()


CFG69_Q = """\
"Oakhaven Manufacturing" - Continuous Improvement Records

Oakhaven runs improvement projects but cannot show which problem any of them \
was meant to fix, or whether the promised benefit arrived. Model the data.

a) A business process has a name and a department and is owned by exactly one \
process owner. Owners remain on file after a process is retired.
b) A process exhibits any number of problems, each with a statement, a date \
raised and a severity. A problem has no meaning apart from its process.
c) A problem is analysed by any number of analyses. Each analysis uses exactly \
one technique, and records the date performed and a conclusion.
d) A technique has a name and a category and is a standing list.
e) An analysis identifies one or more causes, each with a description and a \
root-cause flag. Causes are deleted with their analysis.
f) A cause may contribute to another cause within the same analysis. A root \
cause contributes to none.
g) A solution has a description, an estimated cost and an expected benefit. One \
solution may address several causes, and one cause may be addressed through \
several solutions. Each such link records the percentage of the cause it covers.
h) A solution is delivered by any number of initiatives, each with a sponsor, a \
start date and a status.
i) An initiative breaks into one or more action items, each assigned to one \
person with a description, due date and status.
j) An initiative is measured by any number of benefit measures, each with a \
measurement date and the actual benefit realised."""

CFG69_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (f) is a relationship from an entity to ITSELF. Draw it with the \
cardinality that lets a root cause have no parent.
4. Requirement (g) is many-to-many. Resolve it, and name the attribute that \
justifies the associative entity rather than a plain foreign key.
5. Answer both questions in the opening paragraph: trace the path from an \
initiative back to the problem it was meant to fix, and name the two attributes \
you would compare to see whether the promised benefit arrived."""


# ----------------------------------------------- cfg 70, ACTIVITY_DIAGRAM
def dmaic_activity():
    d = Diagram("Oakhaven Manufacturing - DMAIC Improvement Cycle",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 170, 90, 40, 40)
    d.shape("define", "Define the problem\nand its scope", "action", 100, 165, 200, 55)
    d.shape("d0", "business case\napproved?", "decision", 120, 255, 175, 90)
    d.shape("stop", "Close without\nproceeding", "action", 450, 270, 190, 55)
    d.shape("fork1", "", "bar", 440, 380, 10, 190)
    d.shape("basel", "Measure the current\nbaseline", "action", 90, 400, 210, 55)
    d.shape("cap", "Assess the measurement\nsystem", "action", 500, 400, 220, 55)
    d.shape("join1", "", "bar", 440, 590, 10, 190)
    d.shape("analyse", "Analyse for\nroot causes", "action", 100, 610, 200, 55)
    d.shape("d1", "root cause\nevidenced?", "decision", 120, 700, 175, 90)
    d.shape("more", "Gather more\ndata", "action", 450, 715, 190, 55)
    d.shape("improve", "Design and pilot\nthe improvement", "action", 100, 820, 200, 55)
    d.shape("d2", "pilot met\nthe target?", "decision", 120, 910, 175, 90)
    d.shape("redesign", "Redesign the\nimprovement", "action", 450, 925, 190, 55)
    d.shape("roll", "Roll out\nfully", "action", 100, 1030, 200, 50)
    d.shape("control", "Control: hand over\nand monitor", "action", 100, 1110, 210, 55)
    d.shape("d3", "gains\nheld?", "decision", 120, 1200, 175, 90)
    d.shape("react", "Apply the\nreaction plan", "action", 450, 1215, 190, 55)
    d.shape("close", "Close and record\nthe lessons", "action", 100, 1320, 200, 55)
    d.shape("end", "", "end", 175, 1410, 40, 40)
    d.flow("start", "define")
    d.flow("define", "d0")
    d.flow("d0", "stop", "[no]")
    d.flow("stop", "end")
    d.flow("d0", "fork1", "[yes]")
    d.flow("fork1", "basel")
    d.flow("fork1", "cap")
    d.flow("basel", "join1")
    d.flow("cap", "join1")
    d.flow("join1", "analyse")
    d.flow("analyse", "d1")
    d.flow("d1", "more", "[no]")
    d.flow("more", "analyse")
    d.flow("d1", "improve", "[yes]")
    d.flow("improve", "d2")
    d.flow("d2", "redesign", "[no]")
    d.flow("redesign", "improve")
    d.flow("d2", "roll", "[yes]")
    d.flow("roll", "control")
    d.flow("control", "d3")
    d.flow("d3", "react", "[no]")
    d.flow("react", "control")
    d.flow("d3", "close", "[yes]")
    d.flow("close", "end")
    d.legend(PROCESS_LEGEND, x=760, y=800)
    return d.xml()


CFG70_Q = """\
"Oakhaven Manufacturing" - DMAIC Improvement Cycle

Oakhaven's improvement projects jump straight from a complaint to a solution. \
Model the five-phase cycle they are adopting instead.

a) The team defines the problem and its scope, and puts a business case. If the \
case is not approved the project is closed without proceeding.
b) If it is approved, two measurement activities run: measuring the current \
baseline and assessing whether the measurement system itself is trustworthy. \
They are independent and may run in either order or at the same time; analysis \
waits until both are complete.
c) The team analyses for root causes.
d) If a root cause is not evidenced by the data, more data is gathered and the \
analysis is repeated. This may happen any number of times.
e) Once a root cause is evidenced, an improvement is designed and piloted.
f) If the pilot does not meet the target, the improvement is redesigned and \
piloted again.
g) If it does, the improvement is rolled out fully, then handed over with \
ongoing monitoring.
h) If the gains are not held, the reaction plan is applied and monitoring \
continues.
i) When the gains hold, the project is closed and the lessons recorded."""

CFG70_I = """\
1. Draw the activity diagram with exactly one initial node and one final node -- \
requirement (a) also terminates, so route it to the same final node.
2. Show every action in requirements (a) to (i) as an activity, and mark which \
of the five DMAIC phases each belongs to.
3. Model requirement (b) with a fork and a join, and explain in one sentence \
why the measurement system must be assessed before any conclusion is drawn from \
the baseline.
4. Label EVERY decision branch with its guard, and show all three loops \
returning to the correct activity.
5. Requirement (h) loops back to monitoring rather than to the improvement \
design. Explain in one sentence why, and state what the opening paragraph's \
"straight to a solution" approach skips."""


BATCH = [
    (58, CFG58_Q, CFG58_I, document_lifecycle),
    (59, CFG59_Q, CFG59_I, m2m_fleet_records),
    (60, CFG60_Q, CFG60_I, scada_components),
    (61, CFG61_Q, CFG61_I, access_control_model),
    (62, CFG62_Q, CFG62_I, defence_in_depth),
    (63, CFG63_Q, CFG63_I, control_implementation),
    (64, CFG64_Q, CFG64_I, incident_response),
    (65, CFG65_Q, CFG65_I, erp_integration),
    (66, CFG66_Q, CFG66_I, procure_to_pay),
    (67, CFG67_Q, CFG67_I, capacity_cost_model),
    (68, CFG68_Q, CFG68_I, kpi_reporting_cycle),
    (69, CFG69_Q, CFG69_I, improvement_programme),
    (70, CFG70_Q, CFG70_I, dmaic_activity),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 7")
