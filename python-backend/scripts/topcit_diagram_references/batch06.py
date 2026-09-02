"""Batch 6: cfg 46-57. Advanced modelling, IoT, security and IT business."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
]

SEQUENCE_LEGEND = [
    "solid arrow = synchronous call",
    "dashed arrow = return",
    "open arrow = asynchronous message",
    "alt / loop box = combined fragment, guard in brackets",
]


# ------------------------------------------------------------ cfg 46, ERD
def bill_of_materials():
    d = Diagram("Fairmont Engineering - Bill of Materials Model",
                "Entity-relationship diagram (model answer)")
    d.node("part", "Part", ["PK partId: String", "partNumber: String",
                            "name: String", "unitOfMeasure: String",
                            "isPurchased: boolean"], 380, 90, 240)
    d.node("struct", "BomLine", ["PK bomLineId: String", "FK parentPartId: String",
                                 "FK childPartId: String", "quantityPer: double",
                                 "validFrom: Date", "validTo: Date"], 380, 320, 250)
    d.node("rev", "PartRevision", ["PK revisionId: String", "FK partId: String",
                                   "revisionCode: String", "releasedOn: Date",
                                   "status: String"], 40, 90, 240)
    d.node("supplier", "Supplier", ["PK supplierId: String", "name: String",
                                    "rating: int"], 720, 90, 220)
    d.node("source", "SourcingAgreement", ["PK agreementId: String",
                                           "FK supplierId: String", "FK partId: String",
                                           "unitCost: double", "leadTimeDays: int"],
           720, 300, 240)
    d.node("plant", "Plant", ["PK plantId: String", "name: String",
                              "location: String"], 1000, 90, 220)
    d.node("stock", "PartStock", ["PK partStockId: String", "FK plantId: String",
                                  "FK partId: String", "onHand: double",
                                  "safetyStock: double"], 1000, 300, 230)
    d.node("order", "WorksOrder", ["PK worksOrderId: String", "FK partId: String",
                                   "FK plantId: String", "quantity: double",
                                   "dueOn: Date", "status: String"], 40, 320, 240)
    d.node("issue", "MaterialIssue", ["PK issueId: String", "FK worksOrderId: String",
                                      "FK partId: String", "quantityIssued: double",
                                      "issuedOn: Date"], 40, 560, 250)
    d.node("sub", "Substitution", ["PK substitutionId: String",
                                   "FK bomLineId: String",
                                   "FK alternatePartId: String",
                                   "priority: int"], 380, 560, 250)
    d.edge("part", "struct", "assoc", "is parent in", "1", "0..*")
    d.edge("part", "struct", "assoc", "is child in", "1", "0..*")
    d.edge("part", "rev", "comp", "is revised as", "1", "1..*")
    d.edge("supplier", "source", "assoc", "offers", "1", "0..*")
    d.edge("part", "source", "assoc", "is sourced under", "1", "0..*")
    d.edge("plant", "stock", "comp", "holds", "1", "0..*")
    d.edge("part", "stock", "assoc", "is stocked as", "1", "0..*")
    d.edge("part", "order", "assoc", "is built by", "1", "0..*")
    d.edge("order", "issue", "comp", "consumes", "1", "0..*")
    d.edge("struct", "sub", "comp", "permits", "1", "0..*")
    d.legend(ERD_LEGEND, x=720, y=540)
    return d.xml()


CFG46_Q = """\
"Fairmont Engineering" - Bill of Materials

Fairmont builds assemblies from sub-assemblies, which are themselves built from \
parts, to no fixed depth. Their current spreadsheet has one column per level and \
breaks whenever a design gets deeper. Model it properly.

a) A part has a part number, name, unit of measure and a flag saying whether it \
is purchased or made. Every item -- finished product, sub-assembly and raw \
component -- is a part. There is no separate assembly entity.
b) A BOM line says that one part is used inside another, with a quantity per \
unit and the dates the line is valid from and to. A part may be the parent in \
many lines and the child in many others.
c) A part is revised as one or more part revisions, each with a revision code, \
release date and status. A revision has no meaning apart from its part.
d) A supplier offers parts under sourcing agreements, each with a unit cost and \
a lead time. A supplier offers many parts and a part may be offered by many \
suppliers.
e) A plant holds stock of any number of parts, recording the quantity on hand \
and a safety stock level. A stock row cannot exist without its plant.
f) A works order builds a quantity of one part at one plant by a due date.
g) A works order consumes any number of material issues, each recording the \
part issued, the quantity and the date. Issues are deleted with the order.
h) A BOM line may permit substitutions, each naming an alternate part with a \
priority."""

CFG46_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (b) is a many-to-many relationship from Part to ITSELF. Resolve \
it, and name the two foreign keys so the parent role and the child role are \
distinguishable.
4. Explain in one sentence why requirement (a) insists that an assembly is just \
a part, and what would go wrong in requirement (b) if assemblies and components \
were separate entities.
5. A part appears at three levels of one product. State in one sentence how you \
would compute the total quantity required, and why that query is recursive \
rather than a fixed number of joins."""


# ----------------------------------------------- cfg 47, SEQUENCE_DIAGRAM
def etl_sequence():
    d = Diagram("Corvus Analytics - Nightly Warehouse Load",
                "UML sequence diagram (model answer)")
    d.lifeline("sched", ":LoadScheduler", 40, 100, 160, 800)
    d.lifeline("ext", ":Extractor", 240, 100, 160, 800)
    d.lifeline("src", ":SourceDatabase", 440, 100, 170, 800)
    d.lifeline("stage", ":StagingArea", 650, 100, 160, 800)
    d.lifeline("tr", ":Transformer", 850, 100, 160, 800)
    d.lifeline("wh", ":Warehouse", 1050, 100, 160, 800)
    d.lifeline("ops", ":OperationsAlert", 1250, 100, 175, 800)
    d.msg("sched", "ext", "1: startLoad(runDate)", 210)
    d.frame("loop  [for each source table]", 220, 240, 800, 170)
    d.msg("ext", "src", "2: readChangedRows(since)", 285)
    d.msg("src", "ext", "3: row batch", 325, "return")
    d.msg("ext", "stage", "4: writeBatch(rows)", 370)
    d.msg("ext", "sched", "5: extractComplete(rowCount)", 435, "return")
    d.msg("sched", "tr", "6: transform(runDate)", 480)
    d.msg("tr", "stage", "7: readStaged()", 520)
    d.msg("tr", "tr", "8: applyBusinessRules()", 560)
    d.frame("alt  [validation passed]", 220, 630, 1000, 220)
    d.msg("tr", "wh", "9: loadDimensions()", 665)
    d.msg("tr", "wh", "10: loadFacts()", 705)
    d.msg("wh", "tr", "11: rowsLoaded", 745, "return")
    d.msg("tr", "stage", "12: truncateStaging()", 800)
    d.msg("tr", "ops", "13: raiseLoadFailure(errors)", 840, "async")
    d.msg("tr", "sched", "14: loadOutcome", 880, "return")
    d.legend(SEQUENCE_LEGEND, x=1460, y=200)
    return d.xml()


CFG47_Q = """\
"Corvus Analytics" - Nightly Warehouse Load

Corvus loads its warehouse overnight. When the load half-completes, nobody can \
tell what state the warehouse is in. Model the interaction so the ordering and \
the failure path are explicit.

a) The load scheduler starts the run, passing the run date to the extractor, \
and waits for it to finish.
b) For each source table in turn, the extractor reads the rows changed since \
the last run from the source database, waits for the batch, and writes it to the \
staging area. This repeats until every source table is done.
c) The extractor then reports the total row count back to the scheduler.
d) The scheduler calls the transformer, which reads the staged rows and applies \
the business rules to itself before deciding anything.
e) If validation passes, the transformer loads the dimensions first and then \
the facts, waiting for the warehouse to confirm the rows loaded, and finally \
truncates the staging area.
f) If validation fails, nothing is loaded, staging is NOT truncated, and the \
transformer raises a load failure to the operations alert service. It does not \
wait for that alert to be delivered.
g) In both cases the transformer returns the outcome to the scheduler."""

CFG47_I = """\
1. Draw a lifeline for the scheduler and for each of the six participants named \
in requirements (a) to (f).
2. Number the messages in the order they occur, and show returns as dashed \
arrows.
3. Use a loop fragment for requirement (b) and an alt fragment for requirements \
(e) and (f), writing the guard in each fragment's bracket.
4. Requirement (d) has the transformer call itself. Draw that self-message, and \
explain in one sentence why it is shown rather than left implicit.
5. Requirement (e) fixes dimensions before facts, and requirement (f) leaves \
staging intact on failure. State in one sentence what each of those two rules \
protects, and what would break if either were reversed."""


# ------------------------------------------------------ cfg 48, UML_CLASS
def iot_device_model():
    d = Diagram("Fenland Water - IoT Device Class Model",
                "UML class diagram (model answer)")
    d.node("device", "Device", ["# deviceId: String", "# firmwareVersion: String",
                                "# lastSeenAt: Date", "# batteryPercent: int",
                                "+ isOnline(): boolean",
                                "+ describe(): String"], 400, 90, 250, abstract=True)
    d.node("sensor", "Sensor", ["- unit: String", "- samplePeriodSec: int",
                                "+ read(): Reading",
                                "+ calibrate(offset: double): void"], 120, 320, 240)
    d.node("actuator", "Actuator", ["- currentState: String", "- safeState: String",
                                    "+ actuate(cmd: Command): boolean",
                                    "+ failSafe(): void"], 400, 320, 240)
    d.node("gateway", "Gateway", ["- uplinkType: String", "- queueDepth: int",
                                  "+ forward(r: Reading): boolean",
                                  "+ bufferedCount(): int"], 680, 320, 240)
    d.node("reading", "Reading", ["- readingId: long", "- takenAt: Date",
                                  "- value: double", "- quality: String",
                                  "+ isOutOfRange(): boolean",
                                  "+ toPayload(): String"], 120, 560, 240)
    d.node("command", "Command", ["- commandId: String", "- issuedAt: Date",
                                  "- payload: String",
                                  "+ isExpired(): boolean",
                                  "+ acknowledge(): void"], 400, 560, 240)
    d.node("site", "Site", ["- siteId: String", "- name: String",
                            "- gridReference: String",
                            "+ deviceCount(): int",
                            "+ isRemote(): boolean"], 960, 90, 230)
    d.node("proto", "Protocol", ["# name: String", "# portNumber: int",
                                 "+ encode(r: Reading): byte[]",
                                 "+ decode(b: byte[]): Reading"], 960, 320, 240,
           abstract=True)
    d.node("mqtt", "MqttProtocol", ["- qosLevel: int",
                                    "+ encode(r: Reading): byte[]",
                                    "+ topicFor(d: Device): String"], 900, 560, 230)
    d.node("coap", "CoapProtocol", ["- blockSize: int",
                                    "+ encode(r: Reading): byte[]",
                                    "+ isConfirmable(): boolean"], 1160, 560, 230)
    d.edge("device", "sensor", "gen")
    d.edge("device", "actuator", "gen")
    d.edge("device", "gateway", "gen")
    d.edge("proto", "mqtt", "gen")
    d.edge("proto", "coap", "gen")
    d.edge("sensor", "reading", "comp", "produces", "1", "0..*")
    d.edge("actuator", "command", "assoc", "executes", "1", "0..*")
    d.edge("site", "device", "aggr", "hosts", "1", "1..*")
    d.edge("gateway", "device", "aggr", "relays for", "1", "1..*")
    d.edge("gateway", "proto", "assoc", "speaks", "1", "1..*")
    d.legend(UML_LEGEND, x=120, y=90)
    return d.xml()


CFG48_Q = """\
"Fenland Water" - IoT Device Class Model

Fenland's field estate mixes sensors, actuators and gateways speaking different \
protocols. Model the classes.

a) Every device has a device ID, firmware version, last-seen timestamp and \
battery percentage, and can report whether it is online and describe itself.
b) There are three kinds of device and nothing is ever just a device. A sensor \
adds a unit and a sample period; an actuator adds a current state and a safe \
state; a gateway adds an uplink type and a queue depth.
c) A sensor produces any number of readings. A reading has a timestamp, a value \
and a quality flag. Readings are meaningless without the sensor that took them \
and are purged with it.
d) An actuator executes any number of commands. A command has an ID, an issue \
time and a payload. Commands are issued centrally and are retained for audit \
after the actuator is replaced.
e) A site has an ID, name and grid reference and hosts one or more devices. \
Devices are moved between sites, so they are not destroyed when a site closes.
f) A gateway relays for one or more devices. Those devices exist whether or not \
the gateway does.
g) A gateway speaks one or more protocols. A protocol has a name and a port \
number and can encode a reading and decode bytes.
h) MQTT and CoAP are both protocols; a bare protocol is never instantiated. \
MQTT adds a QoS level, CoAP a block size. Both provide their own encoding."""

CFG48_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Justify in one sentence each: why Sensor-Reading is composition, but \
Site-Device and Gateway-Device are only aggregation.
5. Two classes are abstract. Name both, quote the sentence that makes each one \
abstract, and state what would go wrong if MqttProtocol did not override \
encode()."""


# -------------------------------------------------- cfg 49, UML_COMPONENT
def security_components():
    d = Diagram("Arcus Payments - Security Component Architecture",
                "UML component diagram (model answer)")
    d.shape("client", "ClientApplication", "component", 40, 130, 210, 70)
    d.shape("waf", "WebAppFirewall", "component", 320, 130, 210, 70)
    d.shape("gw", "ApiGateway", "component", 600, 130, 210, 70)
    d.shape("idp", "IdentityProvider", "component", 600, 280, 210, 70)
    d.shape("authz", "PolicyDecisionPoint", "component", 880, 280, 230, 70)
    d.shape("app", "ApplicationService", "component", 880, 130, 230, 70)
    d.shape("vault", "SecretsManager", "component", 1160, 130, 210, 70)
    d.shape("crypto", "KeyManagementService", "component", 1160, 280, 230, 70)
    d.shape("audit", "AuditLogService", "component", 880, 430, 230, 70)
    d.shape("siem", "SiemPlatform", "component", 1160, 430, 210, 70)
    d.shape("i_auth", "IAuthenticate", "provided", 565, 295, 22, 22)
    d.shape("i_dec", "IAuthorisationDecision", "provided", 845, 295, 22, 22)
    d.shape("i_sec", "ISecretRetrieval", "provided", 1125, 145, 22, 22)
    d.shape("i_key", "IEncryptDecrypt", "provided", 1125, 295, 22, 22)
    d.shape("i_aud", "IAuditWrite", "provided", 845, 445, 22, 22)
    d.shape("i_feed", "IEventFeed", "provided", 1125, 445, 22, 22)
    d.edge("client", "waf", "dep", "HTTPS")
    d.edge("waf", "gw", "dep", "filtered traffic")
    d.edge("gw", "idp", "dep", "IAuthenticate")
    d.edge("gw", "authz", "dep", "IAuthorisationDecision")
    d.edge("gw", "app", "dep", "routes to")
    d.edge("app", "authz", "dep", "IAuthorisationDecision")
    d.edge("app", "vault", "dep", "ISecretRetrieval")
    d.edge("app", "crypto", "dep", "IEncryptDecrypt")
    d.edge("gw", "audit", "dep", "IAuditWrite")
    d.edge("app", "audit", "dep", "IAuditWrite")
    d.edge("idp", "audit", "dep", "IAuditWrite")
    d.edge("audit", "siem", "dep", "IEventFeed")
    d.legend(COMPONENT_LEGEND + ["no component holds a secret in its own config"],
             x=320, y=380)
    return d.xml()


CFG49_Q = """\
"Arcus Payments" - Security Architecture

An assessor has told Arcus that authentication, authorisation and audit are \
scattered through the application code. Model an architecture in which each is a \
component with one job.

a) A client application reaches the system only through a web application \
firewall, which filters traffic and passes it to the API gateway. Nothing \
bypasses the firewall.
b) The gateway authenticates every request through the identity provider's \
IAuthenticate interface. No other component authenticates.
c) The gateway and the application service both ask the policy decision point \
for an authorisation decision through IAuthorisationDecision. That is the only \
place an access rule is evaluated.
d) The gateway routes authorised requests to the application service.
e) The application service retrieves credentials at run time from the secrets \
manager through ISecretRetrieval. No component holds a secret in its own \
configuration.
f) The application service encrypts and decrypts data through the key \
management service's IEncryptDecrypt interface. No component implements its own \
cryptography.
g) The gateway, the application service and the identity provider all write to \
the audit log service through IAuditWrite.
h) The audit log service feeds the SIEM platform through IEventFeed. The SIEM \
depends on nothing else, and nothing depends on the SIEM."""

CFG49_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (c) has two consumers of one decision point. Explain in one \
sentence what centralising the decision buys you, and name the two roles in the \
policy-enforcement model that the gateway and the decision point are playing.
5. Requirements (e) and (f) both say "not in the component". State in one \
sentence what each is protecting against, and identify which single component \
becomes the highest-value target in this architecture."""


# ------------------------------------------------------------ cfg 50, ERD
def risk_assessment_model():
    d = Diagram("Sentinel Insurance - Risk Assessment Records",
                "Entity-relationship diagram (model answer)")
    d.node("asset", "Asset", ["PK assetId: String", "name: String",
                              "assetType: String", "FK ownerId: String",
                              "businessValue: String"], 40, 90)
    d.node("owner", "AssetOwner", ["PK ownerId: String", "fullName: String",
                                   "department: String"], 40, 320)
    d.node("threat", "Threat", ["PK threatId: String", "name: String",
                                "source: String", "description: String"], 620, 90)
    d.node("vuln", "Vulnerability", ["PK vulnerabilityId: String",
                                     "FK assetId: String", "reference: String",
                                     "description: String", "severity: String"],
           320, 90)
    d.node("risk", "Risk", ["PK riskId: String", "FK vulnerabilityId: String",
                            "FK threatId: String", "identifiedOn: Date",
                            "status: String"], 320, 320)
    d.node("score", "RiskScore", ["PK riskScoreId: String", "FK riskId: String",
                                  "likelihood: int", "impact: int",
                                  "scoredOn: Date", "isCurrent: boolean"], 320, 540)
    d.node("control", "Control", ["PK controlId: String", "reference: String",
                                  "name: String", "controlType: String"], 900, 90)
    d.node("applied", "ControlApplication", ["PK applicationId: String",
                                             "FK riskId: String", "FK controlId: String",
                                             "appliedOn: Date",
                                             "effectiveness: String"], 620, 320)
    d.node("treat", "TreatmentDecision", ["PK decisionId: String", "FK riskId: String",
                                          "FK ownerId: String", "decidedOn: Date",
                                          "strategy: String", "rationale: String"],
           620, 540)
    d.node("review", "RiskReview", ["PK reviewId: String", "FK riskId: String",
                                    "reviewedOn: Date", "outcome: String"], 900, 320)
    d.edge("owner", "asset", "assoc", "owns", "1", "0..*")
    d.edge("asset", "vuln", "comp", "exposes", "1", "0..*")
    d.edge("vuln", "risk", "comp", "gives rise to", "1", "0..*")
    d.edge("threat", "risk", "assoc", "exploits through", "1", "0..*")
    d.edge("risk", "score", "comp", "is scored as", "1", "1..*")
    d.edge("risk", "applied", "comp", "is mitigated by", "1", "0..*")
    d.edge("control", "applied", "assoc", "is applied as", "1", "0..*")
    d.edge("risk", "treat", "comp", "receives", "1", "1..*")
    d.edge("owner", "treat", "assoc", "accepts", "1", "0..*")
    d.edge("risk", "review", "comp", "is reviewed by", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=540)
    return d.xml()


CFG50_Q = """\
"Sentinel Insurance" - Risk Assessment Records

Sentinel's risk register is a spreadsheet in which the same risk appears three \
times with three different scores and no history. Model it properly.

a) An asset has a name, a type and a business value, and is owned by exactly \
one asset owner. Owners have a name and a department and remain on file after an \
asset is disposed of.
b) An asset exposes any number of vulnerabilities, each with a reference, a \
description and a severity. A vulnerability has no meaning apart from its asset.
c) A threat has a name, a source and a description. Threats are held in a \
central catalogue and outlive any particular risk.
d) A risk arises where a threat can exploit a vulnerability. A risk records the \
date identified and a status, and belongs to exactly one vulnerability and one \
threat.
e) A risk is scored as one or more risk scores, each with a likelihood, an \
impact, the date scored and a current-row flag. Scores are never overwritten -- \
a rescore inserts a new row.
f) A control has a reference, a name and a type, and is held in a central \
catalogue.
g) A risk is mitigated by any number of control applications. Each records the \
control applied, the date and an effectiveness rating. A control may be applied \
to many risks.
h) A risk receives one or more treatment decisions, each accepted by exactly \
one asset owner and recording the strategy and the rationale.
i) A risk is reviewed any number of times, each review recording a date and an \
outcome."""

CFG50_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (d) makes a risk depend on a threat AND a vulnerability. Explain \
in one sentence why a risk is not simply an attribute of an asset, and what \
requirement (g) would be impossible to record if it were.
4. Requirement (e) keeps every score. State in one sentence what management \
question that answers, and how you would find the score that currently stands.
5. Requirement (g) is many-to-many. Resolve it, and name the attribute that \
justifies the associative entity rather than a plain foreign key."""


# ------------------------------------------------------------ cfg 51, ERD
def quantitative_risk():
    d = Diagram("Sentinel Insurance - Quantitative Risk Analysis",
                "Entity-relationship diagram (model answer)")
    d.node("scenario", "LossScenario", ["PK scenarioId: String", "FK assetId: String",
                                        "name: String", "description: String"], 40, 90)
    d.node("asset", "Asset", ["PK assetId: String", "name: String",
                              "replacementValue: double"], 40, 320)
    d.node("est", "LossEstimate", ["PK estimateId: String", "FK scenarioId: String",
                                   "exposureFactor: double",
                                   "singleLossExpectancy: double",
                                   "annualRateOfOccurrence: double",
                                   "annualLossExpectancy: double",
                                   "estimatedOn: Date"], 320, 90, 250)
    d.node("method", "AnalysisMethod", ["PK methodId: String", "name: String",
                                        "isQuantitative: boolean"], 320, 380)
    d.node("assump", "Assumption", ["PK assumptionId: String", "FK estimateId: String",
                                    "statement: String", "confidence: String"],
           320, 560)
    d.node("safeguard", "Safeguard", ["PK safeguardId: String", "name: String",
                                      "annualCost: double",
                                      "expectedReduction: double"], 660, 90)
    d.node("eval", "SafeguardEvaluation", ["PK evaluationId: String",
                                           "FK scenarioId: String",
                                           "FK safeguardId: String",
                                           "residualAle: double",
                                           "netBenefit: double"], 660, 320, 250)
    d.node("analyst", "Analyst", ["PK analystId: String", "fullName: String",
                                  "certification: String"], 960, 90)
    d.node("signoff", "Signoff", ["PK signoffId: String", "FK estimateId: String",
                                  "FK analystId: String", "signedOn: Date",
                                  "verdict: String"], 960, 320)
    d.node("source", "DataSource", ["PK sourceId: String", "FK estimateId: String",
                                    "citation: String", "sourceType: String"],
           660, 560)
    d.edge("asset", "scenario", "comp", "is at risk through", "1", "0..*")
    d.edge("scenario", "est", "comp", "is quantified by", "1", "1..*")
    d.edge("method", "est", "assoc", "produces", "1", "0..*")
    d.edge("est", "assump", "comp", "rests on", "1", "0..*")
    d.edge("est", "source", "comp", "cites", "1", "0..*")
    d.edge("scenario", "eval", "comp", "is treated by", "1", "0..*")
    d.edge("safeguard", "eval", "assoc", "is evaluated in", "1", "0..*")
    d.edge("est", "signoff", "comp", "receives", "1", "0..*")
    d.edge("analyst", "signoff", "assoc", "gives", "1", "0..*")
    d.legend(ERD_LEGEND + ["ALE = SLE x ARO, a derived value"], x=960, y=520)
    return d.xml()


CFG51_Q = """\
"Sentinel Insurance" - Quantitative Risk Analysis

Sentinel's board wants risk expressed in money, and wants to see the workings. \
Model the data behind a quantitative analysis.

a) An asset has a name and a replacement value.
b) An asset is at risk through any number of loss scenarios, each with a name \
and a description. A scenario has no meaning apart from its asset.
c) A scenario is quantified by one or more loss estimates. Each estimate records \
the exposure factor, the single loss expectancy, the annual rate of occurrence, \
the resulting annual loss expectancy, and the date estimated.
d) An analysis method has a name and a flag saying whether it is quantitative. \
Methods are a standing list and outlive any estimate.
e) An estimate rests on any number of assumptions, each with a statement and a \
confidence rating, and cites any number of data sources, each with a citation \
and a source type. Both are deleted with the estimate.
f) A safeguard has a name, an annual cost and an expected reduction. Safeguards \
are catalogued centrally.
g) A scenario is treated by any number of safeguard evaluations. Each names one \
safeguard and records the residual annual loss expectancy and the net benefit. \
A safeguard may be evaluated in many scenarios.
h) An estimate receives any number of sign-offs, each given by exactly one \
analyst with a date and a verdict."""

CFG51_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (c) stores the annual loss expectancy even though it can be \
computed from two other columns on the same row. State the formula, and give one \
argument for storing it and one against.
4. Requirement (g) is many-to-many. Resolve it, and name the two attributes \
that justify the associative entity.
5. Requirement (e) exists so the board can see the workings. Explain in one \
sentence why assumptions belong on the ESTIMATE rather than on the scenario, \
and what a re-estimate next year would do to the old assumptions."""


# -------------------------------------------------- cfg 52, UML_COMPONENT
def isms_tooling():
    d = Diagram("Sentinel Insurance - ISMS Tooling Architecture",
                "UML component diagram (model answer)")
    d.shape("portal", "IsmsPortal", "component", 40, 130, 210, 70)
    d.shape("policy", "PolicyRegistry", "component", 320, 90, 210, 70)
    d.shape("catalog", "ControlCatalogue", "component", 320, 220, 210, 70)
    d.shape("soa", "StatementOfApplicability", "component", 600, 155, 240, 70)
    d.shape("risk", "RiskRegister", "component", 600, 300, 240, 70)
    d.shape("evid", "EvidenceStore", "component", 900, 155, 230, 70)
    d.shape("audit", "InternalAuditTool", "component", 900, 300, 230, 70)
    d.shape("capa", "CorrectiveActionTracker", "component", 900, 440, 240, 70)
    d.shape("train", "AwarenessTraining", "component", 320, 440, 210, 70)
    d.shape("report", "ManagementReporting", "component", 1200, 300, 230, 70)
    d.shape("i_pol", "IPolicyLookup", "provided", 285, 105, 22, 22)
    d.shape("i_ctl", "IControlLookup", "provided", 285, 235, 22, 22)
    d.shape("i_soa", "IApplicability", "provided", 565, 170, 22, 22)
    d.shape("i_risk", "IRiskQuery", "provided", 565, 315, 22, 22)
    d.shape("i_ev", "IEvidenceStore", "provided", 865, 170, 22, 22)
    d.shape("i_capa", "ICorrectiveAction", "provided", 865, 455, 22, 22)
    d.edge("portal", "policy", "dep", "IPolicyLookup")
    d.edge("portal", "soa", "dep", "IApplicability")
    d.edge("portal", "risk", "dep", "IRiskQuery")
    d.edge("soa", "catalog", "dep", "IControlLookup")
    d.edge("risk", "catalog", "dep", "IControlLookup")
    d.edge("soa", "evid", "dep", "IEvidenceStore")
    d.edge("audit", "evid", "dep", "IEvidenceStore")
    d.edge("audit", "soa", "dep", "IApplicability")
    d.edge("audit", "capa", "dep", "ICorrectiveAction")
    d.edge("train", "policy", "dep", "IPolicyLookup")
    d.edge("report", "risk", "dep", "IRiskQuery")
    d.edge("report", "capa", "dep", "ICorrectiveAction")
    d.legend(COMPONENT_LEGEND, x=40, y=380)
    return d.xml()


CFG52_Q = """\
"Sentinel Insurance" - ISMS Tooling Architecture

Sentinel is certifying its information security management system and needs the \
supporting tools to fit together, so that an auditor can trace a control from \
policy to evidence.

a) Staff reach the system through one ISMS portal. No other component has a \
user interface.
b) The policy registry provides IPolicyLookup. The control catalogue provides \
IControlLookup and is the single source of control definitions.
c) The statement of applicability decides which catalogued controls apply. It \
provides IApplicability and depends on IControlLookup.
d) The risk register provides IRiskQuery and also depends on IControlLookup -- \
the same interface the statement of applicability uses, not a second one.
e) The portal depends on IPolicyLookup, IApplicability and IRiskQuery. It \
depends on nothing else.
f) The evidence store provides IEvidenceStore. Both the statement of \
applicability and the internal audit tool write evidence through it.
g) The internal audit tool also depends on IApplicability, and raises findings \
through the corrective action tracker's ICorrectiveAction interface.
h) The awareness training component depends only on IPolicyLookup.
i) Management reporting depends on IRiskQuery and ICorrectiveAction, and \
nothing depends on management reporting."""

CFG52_I = """\
1. Draw every component in requirements (a) to (i) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (b) says the catalogue is the single source of control \
definitions. Explain in one sentence what an auditor would find if the risk \
register kept its own copy of the control list.
5. Trace on your diagram the path an auditor follows from a policy to the \
evidence that a control is operating, naming every component crossed. State \
which single component's failure would break that trace."""


# ------------------------------------------------------------ cfg 53, ERD
def isms_operation():
    d = Diagram("Sentinel Insurance - ISMS Operating Records",
                "Entity-relationship diagram (model answer)")
    d.node("std", "Standard", ["PK standardId: String", "name: String",
                               "version: String"], 40, 90)
    d.node("clause", "Clause", ["PK clauseId: String", "FK standardId: String",
                                "reference: String", "title: String"], 320, 90)
    d.node("control", "Control", ["PK controlId: String", "FK clauseId: String",
                                  "reference: String", "objective: String"], 620, 90)
    d.node("soa", "ApplicabilityEntry", ["PK entryId: String", "FK controlId: String",
                                         "FK ownerId: String", "isApplicable: boolean",
                                         "justification: String",
                                         "decidedOn: Date"], 620, 300)
    d.node("owner", "ControlOwner", ["PK ownerId: String", "fullName: String",
                                     "role: String"], 320, 300)
    d.node("impl", "Implementation", ["PK implementationId: String",
                                      "FK entryId: String", "status: String",
                                      "implementedOn: Date",
                                      "procedureRef: String"], 900, 300)
    d.node("evidence", "Evidence", ["PK evidenceId: String",
                                    "FK implementationId: String",
                                    "artefactRef: String", "collectedOn: Date",
                                    "collectedBy: String"], 900, 540)
    d.node("exception", "Exception", ["PK exceptionId: String", "FK entryId: String",
                                      "FK ownerId: String", "reason: String",
                                      "expiresOn: Date"], 620, 540)
    d.node("test", "ControlTest", ["PK testId: String", "FK implementationId: String",
                                   "testedOn: Date", "method: String",
                                   "result: String"], 1180, 300)
    d.node("finding", "Finding", ["PK findingId: String", "FK testId: String",
                                  "severity: String", "description: String",
                                  "closedOn: Date"], 1180, 540)
    d.edge("std", "clause", "comp", "is composed of", "1", "1..*")
    d.edge("clause", "control", "comp", "specifies", "1", "1..*")
    d.edge("control", "soa", "comp", "is decided in", "1", "0..*")
    d.edge("owner", "soa", "assoc", "owns", "1", "0..*")
    d.edge("soa", "impl", "comp", "is realised by", "1", "0..1")
    d.edge("impl", "evidence", "comp", "is supported by", "1", "0..*")
    d.edge("soa", "exception", "comp", "may carry", "1", "0..*")
    d.edge("owner", "exception", "assoc", "approves", "1", "0..*")
    d.edge("impl", "test", "comp", "is tested by", "1", "0..*")
    d.edge("test", "finding", "comp", "raises", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=300)
    return d.xml()


CFG53_Q = """\
"Sentinel Insurance" - ISMS Implementation Records

An auditor will ask Sentinel to show, for any control in the standard, whether \
it applies, who owns it, how it is implemented and what evidence exists. Model \
the data that answers that.

a) A standard has a name and a version and is composed of one or more clauses. \
A clause has no meaning apart from its standard.
b) A clause specifies one or more controls, each with a reference and an \
objective. A control belongs to exactly one clause.
c) A control is decided in any number of applicability entries -- one per \
assessment cycle -- each recording whether it applies, a justification and the \
decision date. An entry is deleted with its control.
d) Each applicability entry is owned by exactly one control owner. Owners have \
a name and a role and remain on file when an entry is superseded.
e) An applicable entry is realised by at most one implementation, recording a \
status, an implementation date and a procedure reference. A non-applicable entry \
has none.
f) An implementation is supported by any number of pieces of evidence, each \
with an artefact reference, a collection date and who collected it.
g) An applicability entry may carry exceptions, each approved by exactly one \
owner and recording a reason and an expiry date.
h) An implementation is tested by any number of control tests, each with a \
date, a method and a result.
i) A control test raises any number of findings, each with a severity, a \
description and a closure date."""

CFG53_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (e) says "at most one". Show the 0..1 cardinality, and state what \
real situation the zero case represents.
4. Justify in one sentence each why Standard-Clause and Implementation-Evidence \
are identifying relationships, while ControlOwner-ApplicabilityEntry is not.
5. Trace on your diagram the path from a clause of the standard to a piece of \
evidence, naming every entity crossed. State in one sentence what an auditor \
concludes when that path exists but the implementation status is still "planned"."""


# ----------------------------------------------- cfg 54, ACTIVITY_DIAGRAM
def isms_pdca():
    d = Diagram("ISMS Monitoring and Continual Improvement",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 160, 90, 40, 40)
    d.shape("plan", "Plan the monitoring\nprogramme", "action", 90, 165, 200, 55)
    d.shape("fork", "", "bar", 420, 250, 10, 230)
    d.shape("metrics", "Collect control\nperformance metrics", "action", 70, 270, 200, 60)
    d.shape("audit", "Conduct internal\naudit", "action", 480, 270, 190, 55)
    d.shape("incident", "Review security\nincidents", "action", 480, 360, 190, 55)
    d.shape("join", "", "bar", 420, 505, 10, 230)
    d.shape("analyse", "Analyse results against\nthe objectives", "action", 70, 525, 210, 60)
    d.shape("d1", "nonconformity\nfound?", "decision", 90, 615, 175, 95)
    d.shape("root", "Perform root\ncause analysis", "action", 480, 630, 190, 55)
    d.shape("capa", "Raise corrective\naction", "action", 480, 715, 190, 55)
    d.shape("impl", "Implement the\ncorrective action", "action", 480, 800, 190, 55)
    d.shape("d2", "action\neffective?", "decision", 480, 890, 175, 90)
    d.shape("mgmt", "Hold management\nreview", "action", 70, 745, 200, 55)
    d.shape("d3", "ISMS still\nsuitable?", "decision", 85, 835, 180, 95)
    d.shape("change", "Change objectives\nor scope", "action", 70, 960, 200, 55)
    d.shape("update", "Update the\nmonitoring programme", "action", 70, 1050, 210, 60)
    d.shape("end", "", "end", 160, 1150, 40, 40)
    d.flow("start", "plan")
    d.flow("plan", "fork")
    d.flow("fork", "metrics")
    d.flow("fork", "audit")
    d.flow("fork", "incident")
    d.flow("metrics", "join")
    d.flow("audit", "join")
    d.flow("incident", "join")
    d.flow("join", "analyse")
    d.flow("analyse", "d1")
    d.flow("d1", "root", "[yes]")
    d.flow("root", "capa")
    d.flow("capa", "impl")
    d.flow("impl", "d2")
    d.flow("d2", "root", "[no: re-analyse cause]")
    d.flow("d2", "mgmt", "[yes]")
    d.flow("d1", "mgmt", "[no]")
    d.flow("mgmt", "d3")
    d.flow("d3", "change", "[no]")
    d.flow("change", "update")
    d.flow("d3", "update", "[yes]")
    d.flow("update", "end")
    d.legend(PROCESS_LEGEND, x=740, y=560)
    return d.xml()


CFG54_Q = """\
ISMS Monitoring and Continual Improvement

An information security manager is documenting the check-and-act half of the \
management system cycle.

a) The manager plans the monitoring programme for the period.
b) Three monitoring activities then run: collecting control performance \
metrics, conducting the internal audit, and reviewing security incidents. They \
are independent and may run in any order or at the same time; analysis waits \
until all three are complete.
c) The results are analysed against the security objectives.
d) If a nonconformity is found, a root cause analysis is performed, a \
corrective action is raised, and the action is implemented.
e) The corrective action's effectiveness is then checked. If it was not \
effective, the root cause analysis is done again -- raising a second action \
without re-analysing the cause is not permitted.
f) Whether or not there was a nonconformity, a management review is held.
g) The review asks whether the ISMS is still suitable. If it is not, the \
objectives or the scope are changed.
h) In both cases the monitoring programme is updated for the next period, and \
the cycle ends."""

CFG54_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (b) with a fork and a join, and explain in one sentence \
what the join guarantees about the analysis that follows.
4. Label EVERY decision branch with its guard. Requirement (f) means two \
different branches converge on the management review -- show them converging on \
one activity rather than drawing it twice.
5. Requirement (e) sends an ineffective action back to root cause analysis, not \
to raising another action. Explain in one sentence why, and name the two phases \
of the plan-do-check-act cycle that this diagram covers."""


# -------------------------------------------------- cfg 55, UML_COMPONENT
def itsm_components():
    d = Diagram("Brightwell Group - IT Service Management Architecture",
                "UML component diagram (model answer)")
    d.shape("portal", "SelfServicePortal", "component", 40, 130, 210, 70)
    d.shape("desk", "ServiceDeskCore", "component", 320, 130, 210, 70)
    d.shape("cmdb", "ConfigurationMdb", "component", 620, 130, 220, 70)
    d.shape("incident", "IncidentManagement", "component", 320, 280, 210, 70)
    d.shape("problem", "ProblemManagement", "component", 320, 420, 210, 70)
    d.shape("change", "ChangeManagement", "component", 620, 280, 220, 70)
    d.shape("release", "ReleaseManagement", "component", 620, 420, 220, 70)
    d.shape("catalog", "ServiceCatalogue", "component", 900, 130, 220, 70)
    d.shape("sla", "SlaMonitor", "component", 900, 280, 220, 70)
    d.shape("notify", "NotificationService", "component", 900, 420, 220, 70)
    d.shape("i_desk", "ITicketLifecycle", "provided", 285, 145, 22, 22)
    d.shape("i_ci", "IConfigItemQuery", "provided", 585, 145, 22, 22)
    d.shape("i_chg", "IChangeApproval", "provided", 585, 295, 22, 22)
    d.shape("i_cat", "IServiceLookup", "provided", 865, 145, 22, 22)
    d.shape("i_sla", "ISlaEvaluation", "provided", 865, 295, 22, 22)
    d.shape("i_not", "INotify", "provided", 865, 435, 22, 22)
    d.edge("portal", "desk", "dep", "ITicketLifecycle")
    d.edge("desk", "incident", "dep", "routes to")
    d.edge("desk", "catalog", "dep", "IServiceLookup")
    d.edge("incident", "cmdb", "dep", "IConfigItemQuery")
    d.edge("incident", "problem", "dep", "escalates to")
    d.edge("problem", "cmdb", "dep", "IConfigItemQuery")
    d.edge("problem", "change", "dep", "IChangeApproval")
    d.edge("change", "cmdb", "dep", "IConfigItemQuery")
    d.edge("change", "release", "dep", "schedules through")
    d.edge("release", "cmdb", "dep", "IConfigItemQuery")
    d.edge("incident", "sla", "dep", "ISlaEvaluation")
    d.edge("incident", "notify", "dep", "INotify")
    d.edge("change", "notify", "dep", "INotify")
    d.legend(COMPONENT_LEGEND + ["CMDB is the single source of config truth"],
             x=40, y=330)
    return d.xml()


CFG55_Q = """\
"Brightwell Group" - IT Service Management Architecture

Brightwell's incident, problem and change teams each keep their own list of \
servers, and the three lists disagree. Model an architecture in which they do \
not.

a) Users raise tickets only through the self-service portal, which depends on \
the service desk core's ITicketLifecycle interface.
b) The service desk routes tickets to incident management, and looks services \
up in the service catalogue through IServiceLookup.
c) The configuration management database provides IConfigItemQuery and is the \
single source of configuration truth. No other component holds its own copy of \
the configuration data.
d) Incident management, problem management, change management and release \
management all depend on that one IConfigItemQuery interface.
e) Incident management escalates recurring incidents to problem management.
f) Problem management requests changes through change management's \
IChangeApproval interface.
g) Change management schedules approved changes through release management.
h) Incident management evaluates breaches through the SLA monitor's \
ISlaEvaluation interface.
i) Incident management and change management both notify stakeholders through \
the notification service's INotify interface. The notification service depends on \
nothing."""

CFG55_I = """\
1. Draw every component in requirements (a) to (i) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (d) has four consumers of one interface. Explain in one sentence \
what problem from the opening paragraph that solves, and what would happen to an \
incident record if each team kept its own configuration list.
5. Requirements (e), (f) and (g) form a chain. Trace it on your diagram, naming \
every component crossed, and state in one sentence what distinguishes an \
incident from a problem in this design."""


# ------------------------------------------------------------ cfg 56, ERD
def kpi_scorecard():
    d = Diagram("Brightwell Group - Performance Measurement Model",
                "Entity-relationship diagram (model answer)")
    d.node("goal", "StrategicGoal", ["PK goalId: String", "name: String",
                                     "perspective: String",
                                     "FK ownerId: String"], 40, 90)
    d.node("objective", "Objective", ["PK objectiveId: String", "FK goalId: String",
                                      "statement: String", "horizon: String"], 320, 90)
    d.node("kpi", "Kpi", ["PK kpiId: String", "FK objectiveId: String",
                          "name: String", "unit: String",
                          "direction: String", "formula: String"], 620, 90)
    d.node("target", "KpiTarget", ["PK targetId: String", "FK kpiId: String",
                                   "periodStart: Date", "periodEnd: Date",
                                   "targetValue: double",
                                   "thresholdValue: double"], 620, 320)
    d.node("measure", "Measurement", ["PK measurementId: String", "FK kpiId: String",
                                      "FK periodId: String", "actualValue: double",
                                      "capturedOn: Date"], 900, 320)
    d.node("period", "Period", ["PK periodId: String", "name: String",
                                "startsOn: Date", "endsOn: Date",
                                "periodType: String"], 900, 90)
    d.node("source", "DataSource", ["PK sourceId: String", "FK kpiId: String",
                                    "systemName: String", "query: String"], 620, 540)
    d.node("owner", "Owner", ["PK ownerId: String", "fullName: String",
                              "department: String"], 40, 320)
    d.node("card", "Scorecard", ["PK scorecardId: String", "FK ownerId: String",
                                 "name: String", "audience: String"], 40, 540)
    d.node("line", "ScorecardLine", ["PK lineId: String", "FK scorecardId: String",
                                     "FK kpiId: String", "ordinal: int",
                                     "weighting: double"], 320, 540)
    d.edge("owner", "goal", "assoc", "owns", "1", "0..*")
    d.edge("goal", "objective", "comp", "is broken into", "1", "1..*")
    d.edge("objective", "kpi", "comp", "is measured by", "1", "1..*")
    d.edge("kpi", "target", "comp", "is targeted by", "1", "1..*")
    d.edge("kpi", "measure", "comp", "is recorded as", "1", "0..*")
    d.edge("period", "measure", "assoc", "dates", "1", "0..*")
    d.edge("kpi", "source", "comp", "is fed by", "1", "1..*")
    d.edge("owner", "card", "assoc", "publishes", "1", "0..*")
    d.edge("card", "line", "comp", "presents", "1", "1..*")
    d.edge("kpi", "line", "assoc", "appears on", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=540)
    return d.xml()


CFG56_Q = """\
"Brightwell Group" - Performance Measurement

Brightwell's board sees four dashboards that report the same KPI with four \
different numbers, because each is calculated from a different query. Model the \
data so a KPI is defined once.

a) A strategic goal has a name and a balanced-scorecard perspective, and is \
owned by exactly one owner. Owners have a name and a department and remain on \
file after a goal is retired.
b) A goal is broken into one or more objectives, each with a statement and a \
time horizon. An objective has no meaning apart from its goal.
c) An objective is measured by one or more KPIs, each with a name, a unit, a \
direction (whether higher or lower is better) and the formula used.
d) A KPI is targeted by one or more targets, each covering a period with a \
target value and a threshold value. Targets are deleted with the KPI.
e) A period has a name, a start and end date and a type (month, quarter, year). \
Periods are generated centrally and exist whether or not anything was measured \
in them.
f) A KPI is recorded as any number of measurements, each for exactly one period, \
recording the actual value and when it was captured.
g) A KPI is fed by one or more data sources, each naming the system and the \
query used.
h) A scorecard has a name and an audience and is published by exactly one owner.
i) A scorecard presents one or more scorecard lines. Each line shows exactly one \
KPI with an ordinal and a weighting; a KPI may appear on many scorecards."""

CFG56_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (i) is many-to-many. Resolve it, and name the two attributes \
that justify the associative entity.
4. Requirement (c) puts the formula on the KPI and requirement (g) puts the \
query on the data source. Explain in one sentence how that arrangement fixes the \
four-different-numbers problem from the opening paragraph.
5. Requirement (e) says periods exist whether or not anything was measured. \
State in one sentence what report that makes possible, and what a missing \
measurement would look like if periods were only created when a value arrived."""


# ------------------------------------------------------ cfg 57, UML_CLASS
def problem_solving_model():
    d = Diagram("Brightwell Group - Structured Problem Solving",
                "UML class diagram (model answer)")
    d.node("problem", "Problem", ["- problemId: String", "- statement: String",
                                  "- raisedOn: Date", "- severity: String",
                                  "+ isOpen(): boolean",
                                  "+ ageInDays(): int"], 400, 90, 240)
    d.node("technique", "AnalysisTechnique", ["# name: String", "# minInputs: int",
                                              "+ apply(p: Problem): Analysis",
                                              "+ isSuitable(p: Problem): boolean"],
           400, 320, 250, abstract=True)
    d.node("fishbone", "FishboneAnalysis", ["- categories: List",
                                            "+ apply(p: Problem): Analysis",
                                            "+ categoryCount(): int"], 120, 540, 240)
    d.node("fivewhys", "FiveWhysAnalysis", ["- depthReached: int",
                                            "+ apply(p: Problem): Analysis",
                                            "+ deepestCause(): Cause"], 400, 540, 240)
    d.node("pareto", "ParetoAnalysis", ["- cumulativeCutoff: double",
                                        "+ apply(p: Problem): Analysis",
                                        "+ vitalFew(): List"], 680, 540, 240)
    d.node("analysis", "Analysis", ["- analysisId: String", "- performedOn: Date",
                                    "- conclusion: String",
                                    "+ causeCount(): int",
                                    "+ isConclusive(): boolean"], 120, 90, 240)
    d.node("cause", "Cause", ["- causeId: String", "- description: String",
                              "- isRoot: boolean", "- evidenceRef: String",
                              "+ contributesTo(): Cause",
                              "+ hasEvidence(): boolean"], 120, 320, 240)
    d.node("solution", "Solution", ["- solutionId: String", "- description: String",
                                    "- estimatedCost: double",
                                    "+ expectedBenefit(): double",
                                    "+ isApproved(): boolean"], 700, 90, 240)
    d.node("action", "ActionItem", ["- actionId: String", "- description: String",
                                    "- dueOn: Date", "- status: String",
                                    "+ isOverdue(): boolean",
                                    "+ close(): void"], 960, 320, 230)
    d.node("owner", "TeamMember", ["- memberId: String", "- fullName: String",
                                   "- role: String",
                                   "+ workload(): int",
                                   "+ canOwn(a: ActionItem): boolean"], 960, 90, 230)
    d.edge("technique", "fishbone", "gen")
    d.edge("technique", "fivewhys", "gen")
    d.edge("technique", "pareto", "gen")
    d.edge("problem", "analysis", "comp", "is analysed by", "1", "1..*")
    d.edge("analysis", "technique", "assoc", "uses", "0..*", "1")
    d.edge("analysis", "cause", "comp", "identifies", "1", "1..*")
    d.edge("cause", "cause", "assoc", "contributes to", "0..1", "0..*")
    d.edge("cause", "solution", "assoc", "is addressed by", "1", "0..*")
    d.edge("solution", "action", "comp", "is delivered by", "1", "1..*")
    d.edge("owner", "action", "aggr", "owns", "1", "0..*")
    d.legend(UML_LEGEND, x=700, y=320)
    return d.xml()


CFG57_Q = """\
"Brightwell Group" - Structured Problem Solving

Brightwell wants problem solving to be a recorded method rather than a meeting. \
Model the classes.

a) A problem has an ID, a statement, a date raised and a severity, and can \
report whether it is open and how old it is.
b) A problem is analysed by one or more analyses. An analysis records the date \
performed and a conclusion, and has no meaning apart from its problem.
c) An analysis uses exactly one analysis technique. A technique has a name and \
a minimum number of inputs, and can be applied to a problem and judged suitable \
for one.
d) Fishbone, five-whys and Pareto are all analysis techniques, and a bare \
technique is never instantiated. Fishbone adds its categories, five-whys the \
depth reached, Pareto a cumulative cutoff. Each provides its own apply().
e) An analysis identifies one or more causes. A cause has a description, a \
root-cause flag and an evidence reference, and is deleted with its analysis.
f) A cause may contribute to another cause, forming a chain. A root cause \
contributes to none.
g) A cause is addressed by any number of solutions, each with a description and \
an estimated cost.
h) A solution is delivered by one or more action items, each with a \
description, a due date and a status. Action items are deleted with their \
solution.
i) A team member owns any number of action items. Team members have a name and \
a role, and stay on the system after their actions are closed."""

CFG57_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Requirement (f) is a relationship from a class to ITSELF. Draw it with the \
cardinality that lets a root cause have no parent.
5. Justify in one sentence each: why Solution-ActionItem is composition but \
TeamMember-ActionItem is only aggregation. Then name the abstract class, and \
state what would go wrong if FiveWhysAnalysis did not override apply()."""


BATCH = [
    (46, CFG46_Q, CFG46_I, bill_of_materials),
    (47, CFG47_Q, CFG47_I, etl_sequence),
    (48, CFG48_Q, CFG48_I, iot_device_model),
    (49, CFG49_Q, CFG49_I, security_components),
    (50, CFG50_Q, CFG50_I, risk_assessment_model),
    (51, CFG51_Q, CFG51_I, quantitative_risk),
    (52, CFG52_Q, CFG52_I, isms_tooling),
    (53, CFG53_Q, CFG53_I, isms_operation),
    (54, CFG54_Q, CFG54_I, isms_pdca),
    (55, CFG55_Q, CFG55_I, itsm_components),
    (56, CFG56_Q, CFG56_I, kpi_scorecard),
    (57, CFG57_Q, CFG57_I, problem_solving_model),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 6")
