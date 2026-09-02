"""Batch 5: cfg 36-45. Specification, design process, and data modelling."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
]


# ------------------------------------------------------------ cfg 36, ERD
def srs_structure():
    d = Diagram("Halcyon Rail - Requirements Specification Model",
                "Entity-relationship diagram (model answer)")
    d.node("doc", "Specification", ["PK specificationId: String", "FK projectId: String",
                                    "title: String", "status: String"], 40, 90)
    d.node("version", "SpecVersion", ["PK versionId: String",
                                      "FK specificationId: String",
                                      "versionNumber: String", "issuedOn: Date",
                                      "isBaseline: boolean"], 320, 90)
    d.node("section", "Section", ["PK sectionId: String", "FK versionId: String",
                                  "FK parentSectionId: String", "heading: String",
                                  "ordinal: int"], 620, 90)
    d.node("stmt", "RequirementStatement", ["PK statementId: String",
                                            "FK sectionId: String",
                                            "reference: String", "text: String",
                                            "modalVerb: String"], 620, 320)
    d.node("kind", "RequirementKind", ["PK kindId: String", "name: String",
                                       "isFunctional: boolean"], 900, 320)
    d.node("glossary", "GlossaryTerm", ["PK termId: String", "FK versionId: String",
                                        "term: String", "definition: String"], 320, 320)
    d.node("usage", "TermUsage", ["PK usageId: String", "FK statementId: String",
                                  "FK termId: String"], 320, 540)
    d.node("assume", "Assumption", ["PK assumptionId: String", "FK versionId: String",
                                    "text: String", "isConstraint: boolean"], 40, 320)
    d.node("author", "Author", ["PK authorId: String", "fullName: String",
                                "role: String"], 900, 90)
    d.node("approval", "Approval", ["PK approvalId: String", "FK versionId: String",
                                    "FK authorId: String", "approvedOn: Date",
                                    "decision: String"], 900, 540)
    d.edge("doc", "version", "comp", "is issued as", "1", "1..*")
    d.edge("version", "section", "comp", "is structured into", "1", "1..*")
    d.edge("section", "section", "assoc", "nests within", "0..1", "0..*")
    d.edge("section", "stmt", "comp", "states", "1", "0..*")
    d.edge("kind", "stmt", "assoc", "classifies", "1", "0..*")
    d.edge("version", "glossary", "comp", "defines", "1", "0..*")
    d.edge("stmt", "usage", "comp", "refers through", "1", "0..*")
    d.edge("glossary", "usage", "assoc", "is referred to by", "1", "0..*")
    d.edge("version", "assume", "comp", "records", "1", "0..*")
    d.edge("version", "approval", "comp", "receives", "1", "0..*")
    d.edge("author", "approval", "assoc", "gives", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=540)
    return d.xml()


CFG36_Q = """\
"Halcyon Rail" - Requirements Specification Records

Halcyon must show an auditor which version of the specification a given \
requirement appeared in, and who approved it. Model the specification document \
itself.

a) A specification has a title and a status and belongs to exactly one project.
b) A specification is issued as one or more versions, each with a version \
number, an issue date and a flag saying whether it is a baseline. A version has \
no meaning apart from its specification.
c) A version is structured into one or more sections, each with a heading and \
an ordinal. A section belongs to exactly one version.
d) A section may nest within another section of the same version, to any depth. \
A top-level section nests within none.
e) A section states any number of requirement statements, each with a \
reference, its text and the modal verb used ("shall", "should", "may"). A \
statement is deleted with its section.
f) A requirement kind -- functional, performance, security, and so on -- \
classifies many statements. Kinds are defined once for the organisation and \
outlive any specification.
g) A version defines any number of glossary terms. A requirement statement may \
refer to any number of terms, and a term may be referred to by many statements.
h) A version records any number of assumptions, each flagged as an assumption \
or a constraint.
i) A version receives approvals. Each approval is given by exactly one author \
and records the date and the decision. Authors stay on file between projects."""

CFG36_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (d) is a relationship from an entity to itself. Draw it, and \
state the cardinality that allows a top-level section to have no parent.
4. Requirement (g) is many-to-many. Resolve it, and explain in one sentence why \
storing a list of term IDs in a column on the statement would break the \
auditor's query.
5. Requirement (b) says versions, not edits in place. State in one sentence \
what question the auditor can answer because of that, and what would be lost if \
the specification were simply overwritten each time."""


# ----------------------------------------------- cfg 37, ACTIVITY_DIAGRAM
def modular_design_activity():
    d = Diagram("Modular Design - Decomposition and Review",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 150, 90, 40, 40)
    d.shape("read", "Read the design\nrequirements", "action", 80, 165, 190, 55)
    d.shape("split", "Decompose into\ncandidate modules", "action", 80, 250, 190, 55)
    d.shape("fork", "", "bar", 400, 335, 10, 180)
    d.shape("coh", "Measure cohesion\nof each module", "action", 80, 355, 190, 55)
    d.shape("coup", "Measure coupling\nbetween modules", "action", 470, 355, 190, 55)
    d.shape("join", "", "bar", 400, 535, 10, 180)
    d.shape("d1", "cohesion\nacceptable?", "decision", 100, 555, 165, 90)
    d.shape("resplit", "Split the\nweak module", "action", 470, 570, 175, 55)
    d.shape("d2", "coupling\nacceptable?", "decision", 100, 680, 165, 90)
    d.shape("iface", "Introduce an\ninterface to decouple", "action", 470, 695, 190, 55)
    d.shape("spec", "Specify each module's\ninterface contract", "action", 80, 805, 200, 55)
    d.shape("rev", "Peer review the\ndecomposition", "action", 80, 890, 190, 55)
    d.shape("d3", "review\npassed?", "decision", 100, 980, 160, 90)
    d.shape("base", "Baseline the\nmodule structure", "action", 80, 1105, 190, 55)
    d.shape("end", "", "end", 150, 1190, 40, 40)
    d.flow("start", "read")
    d.flow("read", "split")
    d.flow("split", "fork")
    d.flow("fork", "coh")
    d.flow("fork", "coup")
    d.flow("coh", "join")
    d.flow("coup", "join")
    d.flow("join", "d1")
    d.flow("d1", "resplit", "[no: low cohesion]")
    d.flow("resplit", "split")
    d.flow("d1", "d2", "[yes]")
    d.flow("d2", "iface", "[no: high coupling]")
    d.flow("iface", "split")
    d.flow("d2", "spec", "[yes]")
    d.flow("spec", "rev")
    d.flow("rev", "d3")
    d.flow("d3", "split", "[no]")
    d.flow("d3", "base", "[yes]")
    d.flow("base", "end")
    d.legend(PROCESS_LEGEND, x=720, y=850)
    return d.xml()


CFG37_Q = """\
Modular Design - Decomposition, Cohesion and Coupling

A design authority is documenting how a system is broken into modules and how \
that decomposition is judged.

a) The designer reads the design requirements, then decomposes the system into \
candidate modules.
b) Two assessments then run: measuring the cohesion of each module and \
measuring the coupling between modules. They are independent and may be done in \
either order or at the same time; judgement waits until both are complete.
c) If any module's cohesion is unacceptable, that module is split and the \
decomposition is done again.
d) If coupling between modules is unacceptable, an interface is introduced to \
decouple them and the decomposition is done again.
e) When both are acceptable, each module's interface contract is specified.
f) The decomposition is peer reviewed. If the review fails, the team returns to \
decomposition. If it passes, the module structure is baselined and the process \
ends."""

CFG37_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (f) as an activity.
3. Model requirement (b) with a fork and a join, and explain in one sentence \
why the two assessments must both complete before either decision is taken.
4. Label EVERY decision branch with its guard, and show all three loops \
returning to the correct activity.
5. Requirements (c) and (d) pull in opposite directions: splitting a module to \
raise cohesion tends to raise coupling. State in one sentence what a designer is \
actually optimising, and why the process loops rather than running once."""


# -------------------------------------------------- cfg 38, UML_COMPONENT
def event_driven_components():
    d = Diagram("Meridian Logistics - Event-Driven Component Architecture",
                "UML component diagram (model answer)")
    d.shape("api", "ShipmentApi", "component", 40, 110, 210, 70)
    d.shape("cmd", "CommandHandler", "component", 320, 110, 210, 70)
    d.shape("store", "EventStore", "component", 620, 110, 210, 70)
    d.shape("bus", "EventBus", "component", 620, 250, 210, 70)
    d.shape("proj", "ReadModelProjector", "component", 920, 250, 220, 70)
    d.shape("read", "ReadModelStore", "component", 1220, 250, 200, 70)
    d.shape("query", "ShipmentQueryApi", "component", 920, 110, 220, 70)
    d.shape("track", "TrackingNotifier", "component", 920, 400, 220, 70)
    d.shape("bill", "BillingIntegrator", "component", 920, 520, 220, 70)
    d.shape("dlq", "DeadLetterHandler", "component", 620, 400, 210, 70)
    d.shape("i_cmd", "ICommandSubmit", "provided", 285, 125, 22, 22)
    d.shape("i_app", "IEventAppend", "provided", 585, 125, 22, 22)
    d.shape("i_pub", "IEventSubscribe", "provided", 585, 265, 22, 22)
    d.shape("i_read", "IReadModelWrite", "provided", 1185, 265, 22, 22)
    d.shape("i_q", "IShipmentQuery", "provided", 885, 125, 22, 22)
    d.shape("i_dlq", "IDeadLetter", "provided", 585, 415, 22, 22)
    d.edge("api", "cmd", "dep", "ICommandSubmit")
    d.edge("cmd", "store", "dep", "IEventAppend")
    d.edge("store", "bus", "dep", "publishes to")
    d.edge("bus", "proj", "dep", "IEventSubscribe")
    d.edge("bus", "track", "dep", "IEventSubscribe")
    d.edge("bus", "bill", "dep", "IEventSubscribe")
    d.edge("proj", "read", "dep", "IReadModelWrite")
    d.edge("query", "read", "dep", "reads from")
    d.edge("proj", "dlq", "dep", "IDeadLetter")
    d.edge("track", "dlq", "dep", "IDeadLetter")
    d.edge("bill", "dlq", "dep", "IDeadLetter")
    d.legend(COMPONENT_LEGEND + ["writes and reads use separate stores"],
             x=40, y=400)
    return d.xml()


CFG38_Q = """\
"Meridian Logistics" - Event-Driven Architecture

Meridian's shipment tracking is read far more often than it is written, and \
three departments need to react to the same shipment events without knowing \
about each other. Model the component architecture.

a) A shipment API accepts changes and passes them to a command handler through \
ICommandSubmit. The API contains no business logic.
b) The command handler appends events to the event store through IEventAppend. \
It never writes to any other store.
c) The event store publishes every appended event to the event bus. The bus \
provides IEventSubscribe.
d) Three subscribers consume events through that one interface: a read-model \
projector, a tracking notifier and a billing integrator. None of the three knows \
that the others exist.
e) The projector writes to the read-model store through IReadModelWrite. No \
other component may write to it.
f) A separate shipment query API reads from the read-model store. It never \
touches the event store.
g) Any subscriber that fails to process an event sends it to the dead-letter \
handler through IDeadLetter.
h) No subscriber depends on the command handler, and nothing depends on a \
subscriber."""

CFG38_I = """\
1. Draw every component in requirements (a) to (g) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (d) has three subscribers on one interface. Explain in one \
sentence what adding a fourth department would cost, and which existing \
component you would have to modify.
5. Requirements (e) and (f) separate the write path from the read path. State \
one thing this design buys you and one thing it costs you, and name the \
consistency property that is given up."""


# ------------------------------------------------------------ cfg 39, ERD
def change_control():
    d = Diagram("Vantage Systems - Change Control Records",
                "Entity-relationship diagram (model answer)")
    d.node("item", "ConfigurationItem", ["PK itemId: String", "name: String",
                                         "itemType: String",
                                         "FK projectId: String"], 40, 90)
    d.node("ver", "ItemVersion", ["PK itemVersionId: String", "FK itemId: String",
                                  "versionNumber: String", "createdOn: Date",
                                  "checksum: String"], 320, 90)
    d.node("base", "Baseline", ["PK baselineId: String", "FK projectId: String",
                                "label: String", "frozenOn: Date"], 620, 90)
    d.node("content", "BaselineContent", ["PK contentId: String",
                                          "FK baselineId: String",
                                          "FK itemVersionId: String"], 620, 300)
    d.node("cr", "ChangeRequest", ["PK changeRequestId: String",
                                   "FK raisedById: String", "FK itemId: String",
                                   "raisedOn: Date", "reason: String",
                                   "status: String"], 40, 300)
    d.node("impact", "ImpactAssessment", ["PK assessmentId: String",
                                          "FK changeRequestId: String",
                                          "effortDays: double", "riskLevel: String",
                                          "assessedOn: Date"], 40, 540)
    d.node("person", "Person", ["PK personId: String", "fullName: String",
                                "role: String"], 900, 90)
    d.node("board", "ReviewBoard", ["PK boardId: String", "name: String",
                                    "quorum: int"], 900, 300)
    d.node("member", "BoardMembership", ["PK membershipId: String",
                                         "FK boardId: String", "FK personId: String",
                                         "joinedOn: Date"], 900, 480)
    d.node("dec", "BoardDecision", ["PK decisionId: String",
                                    "FK changeRequestId: String", "FK boardId: String",
                                    "decidedOn: Date", "outcome: String"], 320, 540)
    d.edge("item", "ver", "comp", "is revised as", "1", "1..*")
    d.edge("base", "content", "comp", "freezes", "1", "1..*")
    d.edge("ver", "content", "assoc", "is frozen in", "1", "0..*")
    d.edge("item", "cr", "assoc", "is the subject of", "1", "0..*")
    d.edge("person", "cr", "assoc", "raises", "1", "0..*")
    d.edge("cr", "impact", "comp", "is assessed by", "1", "0..*")
    d.edge("cr", "dec", "comp", "receives", "1", "0..*")
    d.edge("board", "dec", "assoc", "issues", "1", "0..*")
    d.edge("board", "member", "comp", "is composed of", "1", "1..*")
    d.edge("person", "member", "assoc", "sits on", "1", "0..*")
    d.legend(ERD_LEGEND, x=620, y=540)
    return d.xml()


CFG39_Q = """\
"Vantage Systems" - Requirements Change Control

Vantage cannot currently answer "what did the specification look like when we \
signed the contract?" Model the change control data that would let them.

a) A configuration item has a name and a type and belongs to exactly one \
project.
b) An item is revised as one or more item versions, each with a version number, \
a creation date and a checksum. A version has no meaning apart from its item.
c) A baseline has a label and a freeze date and freezes one or more specific \
item versions. An item version may be frozen in many baselines.
d) A change request is raised by exactly one person against exactly one \
configuration item, recording the date, the reason and a status. People remain \
on file after a request is closed.
e) A change request is assessed by any number of impact assessments, each \
recording effort in days, a risk level and the assessment date. Assessments are \
deleted with the request.
f) A review board has a name and a quorum, and is composed of one or more board \
memberships. Each membership links exactly one person to that board and records \
when they joined.
g) A change request receives any number of board decisions. Each decision is \
issued by exactly one board and records the date and the outcome."""

CFG39_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (c) and (f) are many-to-many. Resolve both into associative \
entities.
4. Requirement (c) says a baseline freezes item VERSIONS, not items. Explain in \
one sentence why, and what the contract question at the top would become \
unanswerable without it.
5. Requirement (g) allows a request to receive several decisions. State in one \
sentence what real situation that cardinality is modelling, and how you would \
find the decision that currently stands."""


# ------------------------------------------------------------ cfg 40, ERD
def veterinary_conceptual():
    d = Diagram("Ashgrove Veterinary - Conceptual Data Model",
                "Entity-relationship diagram (model answer)")
    d.node("owner", "Owner", ["PK ownerId: String", "fullName: String",
                              "phone: String", "address: String"], 40, 90)
    d.node("animal", "Animal", ["PK animalId: String", "FK ownerId: String",
                                "FK speciesId: String", "name: String",
                                "dateOfBirth: Date"], 320, 90)
    d.node("species", "Species", ["PK speciesId: String", "commonName: String",
                                  "latinName: String"], 620, 90)
    d.node("visit", "Visit", ["PK visitId: String", "FK animalId: String",
                              "FK vetId: String", "visitedOn: Date",
                              "presentingSign: String"], 320, 300)
    d.node("vet", "Veterinarian", ["PK vetId: String", "fullName: String",
                                   "registrationNo: String",
                                   "specialism: String"], 40, 300)
    d.node("diag", "Diagnosis", ["PK diagnosisId: String", "FK visitId: String",
                                 "code: String", "description: String"], 620, 300)
    d.node("treat", "Treatment", ["PK treatmentId: String", "FK visitId: String",
                                  "FK procedureId: String", "performedOn: Date",
                                  "notes: String"], 320, 520)
    d.node("proc", "Procedure", ["PK procedureId: String", "name: String",
                                 "standardFee: double"], 620, 520)
    d.node("presc", "Prescription", ["PK prescriptionId: String", "FK visitId: String",
                                     "FK drugId: String", "dosage: String",
                                     "daysSupply: int"], 900, 300)
    d.node("drug", "Drug", ["PK drugId: String", "name: String",
                            "strength: String", "isControlled: boolean"], 900, 520)
    d.node("invoice", "Invoice", ["PK invoiceId: String", "FK visitId: String",
                                  "issuedOn: Date", "total: double",
                                  "settledOn: Date"], 40, 520)
    d.edge("owner", "animal", "assoc", "owns", "1", "0..*")
    d.edge("species", "animal", "assoc", "classifies", "1", "0..*")
    d.edge("animal", "visit", "comp", "attends", "1", "0..*")
    d.edge("vet", "visit", "assoc", "conducts", "1", "0..*")
    d.edge("visit", "diag", "comp", "yields", "1", "0..*")
    d.edge("visit", "treat", "comp", "delivers", "1", "0..*")
    d.edge("proc", "treat", "assoc", "is applied as", "1", "0..*")
    d.edge("visit", "presc", "comp", "issues", "1", "0..*")
    d.edge("drug", "presc", "assoc", "is prescribed as", "1", "0..*")
    d.edge("visit", "invoice", "comp", "is billed by", "1", "0..1")
    d.legend(ERD_LEGEND, x=900, y=90)
    return d.xml()


CFG40_Q = """\
"Ashgrove Veterinary" - Conceptual Design

Ashgrove is replacing a paper day-book. Produce the conceptual data model, \
independent of any database product.

a) An owner has a name, phone and address. Owners are kept on file after their \
animals have gone.
b) An animal has a name and a date of birth, belongs to exactly one owner, and \
is classified by exactly one species. Species are a reference list maintained by \
the practice and outlive any animal.
c) An animal attends any number of visits. A visit records the date and the \
presenting sign, and is deleted with the animal's record.
d) A visit is conducted by exactly one veterinarian. Vets have a registration \
number and a specialism and remain on file between visits.
e) A visit yields any number of diagnoses, each with a code and a description.
f) A visit delivers any number of treatments. Each treatment applies exactly one \
procedure from a standing list, and records when it was performed and any notes.
g) A visit issues any number of prescriptions. Each names exactly one drug with \
a dosage and a days' supply. Drugs are a reference list with a controlled-drug \
flag.
h) A visit is billed by at most one invoice, recording the issue date, total and \
settlement date."""

CFG40_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK). Use conceptual data types only -- do not choose column \
lengths or index types.
2. Draw every relationship with its cardinality at BOTH ends.
3. Identify every identifying relationship, and justify one of them in a \
sentence by contrasting it with Species-Animal in requirement (b).
4. Requirement (f) stores a link to a standing procedure rather than free text. \
Explain in one sentence what that buys the practice, and why the fee still \
belongs on Procedure and not on Treatment at the conceptual level.
5. Requirement (h) says "at most one". Show the 0..1 cardinality, and state what \
real situation the zero case represents."""


# ------------------------------------------------------------ cfg 41, ERD
def temporal_employment():
    d = Diagram("Brightwell Group - Temporal Employment Model",
                "Entity-relationship diagram (model answer)")
    d.node("person", "Person", ["PK personId: String", "fullName: String",
                                "dateOfBirth: Date", "nationalId: String"], 40, 90)
    d.node("emp", "Employment", ["PK employmentId: String", "FK personId: String",
                                 "FK companyId: String", "hiredOn: Date",
                                 "leftOn: Date"], 320, 90)
    d.node("company", "Company", ["PK companyId: String", "name: String",
                                  "registrationNo: String"], 620, 90)
    d.node("assign", "PostAssignment", ["PK assignmentId: String",
                                        "FK employmentId: String", "FK postId: String",
                                        "validFrom: Date", "validTo: Date"], 320, 300)
    d.node("post", "Post", ["PK postId: String", "FK departmentId: String",
                            "title: String", "grade: String"], 620, 300)
    d.node("dept", "Department", ["PK departmentId: String", "FK companyId: String",
                                  "name: String", "costCentre: String"], 900, 300)
    d.node("salary", "SalaryRecord", ["PK salaryRecordId: String",
                                      "FK employmentId: String", "annualAmount: double",
                                      "currency: String", "validFrom: Date",
                                      "validTo: Date"], 40, 300)
    d.node("mgr", "ReportingLine", ["PK reportingLineId: String",
                                    "FK subordinatePostId: String",
                                    "FK managerPostId: String",
                                    "validFrom: Date", "validTo: Date"], 620, 540)
    d.node("absence", "Absence", ["PK absenceId: String", "FK employmentId: String",
                                  "FK absenceTypeId: String", "startsOn: Date",
                                  "endsOn: Date"], 40, 540)
    d.node("atype", "AbsenceType", ["PK absenceTypeId: String", "name: String",
                                    "isPaid: boolean"], 320, 540)
    d.edge("person", "emp", "assoc", "holds", "1", "0..*")
    d.edge("company", "emp", "assoc", "employs through", "1", "0..*")
    d.edge("emp", "assign", "comp", "is assigned by", "1", "1..*")
    d.edge("post", "assign", "assoc", "is filled by", "1", "0..*")
    d.edge("dept", "post", "comp", "establishes", "1", "1..*")
    d.edge("company", "dept", "comp", "is organised into", "1", "1..*")
    d.edge("emp", "salary", "comp", "is paid under", "1", "1..*")
    d.edge("post", "mgr", "assoc", "reports through", "1", "0..*")
    d.edge("emp", "absence", "comp", "records", "1", "0..*")
    d.edge("atype", "absence", "assoc", "classifies", "1", "0..*")
    d.legend(ERD_LEGEND + ["validFrom / validTo = effective-dated row"],
             x=900, y=520)
    return d.xml()


CFG41_Q = """\
"Brightwell Group" - Employment History

Brightwell's HR system overwrites a salary when it changes, so nobody can say \
what an employee was paid in a given month. Model it so that history is kept.

a) A person has a name, date of birth and national ID, and exists on the system \
independently of any job.
b) A person holds any number of employments over time -- they may leave and \
return, or work for two group companies. An employment records a hire date and a \
leaving date, which is empty while they are still employed.
c) A company has a name and a registration number and is organised into one or \
more departments. A department cannot exist without its company.
d) A department establishes one or more posts, each with a title and a grade. A \
post is a position in the structure and is removed with its department.
e) An employment is assigned by one or more post assignments. Each assignment \
records the post held and the dates it was valid from and to. An employment \
always has at least one; a post may be filled by many assignments over time.
f) An employment is paid under one or more salary records, each with an amount, \
a currency and the dates it was valid from and to. Salary records are never \
overwritten -- a change closes the current row and opens a new one.
g) A reporting line links a subordinate post to a manager post, and is itself \
effective-dated.
h) An employment records any number of absences, each classified by exactly one \
absence type with a paid flag."""

CFG41_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (g) is a relationship between two rows of the SAME entity. Draw \
it, and name the two foreign keys so their roles are distinguishable.
4. Requirement (f) is the point of the model. Explain in one sentence how the \
validFrom/validTo pair answers "what was this person paid last March", and what \
the validTo value is for the row that is current.
5. Requirements (e), (f) and (g) are all effective-dated. State the one \
integrity rule that must hold across each set of rows, and why the database \
alone cannot enforce it."""


# ----------------------------------------------- cfg 42, ACTIVITY_DIAGRAM
def normalisation_activity():
    d = Diagram("Normalisation - Unnormalised Form to Third Normal Form",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 150, 90, 40, 40)
    d.shape("gather", "Collect the\nunnormalised relation", "action", 70, 165, 200, 55)
    d.shape("keys", "Identify candidate keys\nand functional dependencies",
            "action", 70, 250, 220, 60)
    d.shape("d1", "any repeating\ngroups?", "decision", 90, 340, 170, 90)
    d.shape("f1", "Remove repeating groups\ninto a new relation (1NF)",
            "action", 450, 350, 220, 60)
    d.shape("d2", "partial\ndependency on a\npart of the key?", "decision",
            80, 465, 190, 105)
    d.shape("f2", "Remove partial dependencies\ninto a new relation (2NF)",
            "action", 450, 480, 230, 60)
    d.shape("d3", "transitive\ndependency on a\nnon-key attribute?", "decision",
            80, 615, 190, 110)
    d.shape("f3", "Remove transitive dependencies\ninto a new relation (3NF)",
            "action", 450, 630, 240, 60)
    d.shape("check", "Verify every relation is\nlossless-join and\ndependency preserving",
            "action", 70, 775, 220, 65)
    d.shape("d4", "lossless\nand preserving?", "decision", 80, 870, 190, 90)
    d.shape("revisit", "Revisit the\ndecomposition", "action", 450, 885, 190, 55)
    d.shape("d5", "performance\nrequires\ndenormalisation?", "decision",
            80, 1000, 190, 105)
    d.shape("denorm", "Denormalise deliberately\nand record the reason",
            "action", 450, 1015, 220, 60)
    d.shape("done", "Publish the\nlogical schema", "action", 70, 1150, 200, 55)
    d.shape("end", "", "end", 150, 1235, 40, 40)
    d.flow("start", "gather")
    d.flow("gather", "keys")
    d.flow("keys", "d1")
    d.flow("d1", "f1", "[yes]")
    d.flow("f1", "d1")
    d.flow("d1", "d2", "[no: in 1NF]")
    d.flow("d2", "f2", "[yes]")
    d.flow("f2", "d2")
    d.flow("d2", "d3", "[no: in 2NF]")
    d.flow("d3", "f3", "[yes]")
    d.flow("f3", "d3")
    d.flow("d3", "check", "[no: in 3NF]")
    d.flow("check", "d4")
    d.flow("d4", "revisit", "[no]")
    d.flow("revisit", "keys")
    d.flow("d4", "d5", "[yes]")
    d.flow("d5", "denorm", "[yes]")
    d.flow("denorm", "done")
    d.flow("d5", "done", "[no]")
    d.flow("done", "end")
    d.legend(PROCESS_LEGEND, x=760, y=780)
    return d.xml()


CFG42_Q = """\
Normalisation - From Unnormalised Data to Third Normal Form

A data architect is documenting the normalisation procedure so that every \
schema is derived the same way.

a) The architect collects the unnormalised relation, then identifies the \
candidate keys and the functional dependencies.
b) While any repeating group remains, it is removed into a new relation. When \
none remains the relation is in first normal form.
c) While any non-key attribute depends on only part of a composite key, that \
partial dependency is removed into a new relation. When none remains the \
relation is in second normal form.
d) While any non-key attribute depends on another non-key attribute, that \
transitive dependency is removed into a new relation. When none remains the \
relation is in third normal form.
e) The resulting set of relations is checked for the lossless-join property and \
for dependency preservation. If either fails, the architect returns to \
identifying the dependencies and decomposes differently.
f) If measured performance requires it, a specific denormalisation may then be \
made deliberately, and the reason recorded. Otherwise none is made.
g) The logical schema is published and the process ends."""

CFG42_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every step in requirements (a) to (g) as an activity.
3. Requirements (b), (c) and (d) each say "while any remains". Model each as a \
loop that re-tests its own condition, not as a single pass, and label every \
guard.
4. Requirement (e) loops back further than requirements (b) to (d) do. Show \
that, and explain in one sentence why a failed lossless-join check cannot be \
repaired by simply removing one more dependency.
5. Requirement (f) comes AFTER normalisation, not instead of it. State in one \
sentence why the order matters, and what the recorded reason protects the next \
architect from."""


# ------------------------------------------------------------ cfg 43, FLOWCHART
def dikw_pipeline():
    d = Diagram("Corvus Analytics - From Raw Data to Decision",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 130, 90, 140, 45)
    d.shape("cap", "Capture raw data\nfrom source systems", "action", 100, 165, 200, 55)
    d.shape("prof", "Profile the data\nfor completeness", "action", 100, 250, 200, 55)
    d.shape("d1", "quality\nacceptable?", "decision", 120, 340, 165, 90)
    d.shape("clean", "Cleanse and\ndeduplicate", "action", 440, 355, 180, 55)
    d.shape("d2", "recoverable?", "decision", 440, 460, 180, 85)
    d.shape("reject", "Reject batch and\nraise a data incident", "action", 720, 465, 200, 55)
    d.shape("ctx", "Add context: units,\ntime, entity keys", "action", 100, 465, 200, 55)
    d.shape("info", "Information:\naggregate and relate", "action", 100, 550, 200, 55)
    d.shape("know", "Knowledge: apply\nrules and models", "action", 100, 635, 200, 55)
    d.shape("d3", "insight\nactionable?", "decision", 120, 725, 165, 90)
    d.shape("more", "Gather further\nevidence", "action", 440, 740, 180, 55)
    d.shape("wis", "Wisdom: decide\nand act", "action", 100, 850, 200, 55)
    d.shape("fb", "Record the outcome\nas new evidence", "action", 100, 935, 200, 55)
    d.shape("e", "End", "terminator", 130, 1020, 140, 45)
    d.flow("s", "cap")
    d.flow("cap", "prof")
    d.flow("prof", "d1")
    d.flow("d1", "clean", "[no]")
    d.flow("clean", "d2")
    d.flow("d2", "prof", "[yes: re-profile]")
    d.flow("d2", "reject", "[no]")
    d.flow("reject", "e")
    d.flow("d1", "ctx", "[yes]")
    d.flow("ctx", "info")
    d.flow("info", "know")
    d.flow("know", "d3")
    d.flow("d3", "more", "[no]")
    d.flow("more", "cap")
    d.flow("d3", "wis", "[yes]")
    d.flow("wis", "fb")
    d.flow("fb", "e")
    d.legend(PROCESS_LEGEND, x=960, y=600)
    return d.xml()


CFG43_Q = """\
"Corvus Analytics" - From Raw Data to Decision

Corvus wants the route from a raw feed to a business decision written down, so \
that the difference between data, information, knowledge and wisdom is visible \
in the process rather than argued about.

a) Raw data is captured from the source systems and profiled for completeness.
b) If the quality is not acceptable, the batch is cleansed and deduplicated.
c) After cleansing the team asks whether the batch is recoverable. If it is, it \
is profiled again. If it is not, the batch is rejected, a data incident is \
raised, and the process ends there.
d) Acceptable data has context added -- units, time, entity keys -- turning it \
into information.
e) The information is aggregated and related to other information, then rules \
and models are applied to produce knowledge.
f) If the resulting insight is not actionable, further evidence is gathered and \
capture begins again.
g) If it is actionable, a decision is taken and acted on.
h) The outcome is recorded as new evidence, and the process ends."""

CFG43_I = """\
1. Draw the flowchart with one start terminator and exactly two end points -- \
requirement (c) terminates early. Use the terminator symbol for both.
2. Show every step in requirements (a) to (h) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Mark on your diagram where data becomes information, where information \
becomes knowledge, and where knowledge becomes a decision. State in one sentence \
what is added at each of those three transitions.
5. Requirement (h) feeds the outcome back as evidence. Explain in one sentence \
why that step is what makes the process a cycle rather than a pipeline, and what \
is lost if it is skipped."""


# ----------------------------------------------- cfg 44, ACTIVITY_DIAGRAM
def denormalisation_activity():
    d = Diagram("Warehouse Design - Denormalisation Decision",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 160, 90, 40, 40)
    d.shape("base", "Start from the\nnormalised schema", "action", 90, 165, 200, 55)
    d.shape("meas", "Measure the slow\nquery workload", "action", 90, 250, 200, 55)
    d.shape("d1", "target met?", "decision", 110, 340, 165, 85)
    d.shape("fork", "", "bar", 430, 440, 10, 200)
    d.shape("idx", "Try indexing", "action", 90, 460, 190, 50)
    d.shape("rewrite", "Try rewriting\nthe query", "action", 490, 460, 190, 55)
    d.shape("view", "Try a materialised\nview", "action", 490, 545, 190, 55)
    d.shape("join", "", "bar", 430, 665, 10, 200)
    d.shape("d2", "target met\nwithout schema\nchange?", "decision", 100, 685, 190, 105)
    d.shape("choose", "Choose a\ndenormalisation", "action", 490, 700, 190, 55)
    d.shape("apply", "Apply it and add\nthe maintaining logic", "action", 490, 785, 200, 55)
    d.shape("d3", "write cost\nacceptable?", "decision", 480, 875, 180, 95)
    d.shape("revert", "Revert the\ndenormalisation", "action", 780, 890, 180, 55)
    d.shape("record", "Record the reason\nand the trade-off", "action", 90, 890, 200, 55)
    d.shape("end", "", "end", 160, 990, 40, 40)
    d.flow("start", "base")
    d.flow("base", "meas")
    d.flow("meas", "d1")
    d.flow("d1", "record", "[yes: no change needed]")
    d.flow("d1", "fork", "[no]")
    d.flow("fork", "idx")
    d.flow("fork", "rewrite")
    d.flow("fork", "view")
    d.flow("idx", "join")
    d.flow("rewrite", "join")
    d.flow("view", "join")
    d.flow("join", "d2")
    d.flow("d2", "record", "[yes]")
    d.flow("d2", "choose", "[no]")
    d.flow("choose", "apply")
    d.flow("apply", "d3")
    d.flow("d3", "revert", "[no]")
    d.flow("revert", "meas")
    d.flow("d3", "record", "[yes]")
    d.flow("record", "end")
    d.legend(PROCESS_LEGEND, x=790, y=200)
    return d.xml()


CFG44_Q = """\
Denormalisation Decision for a Reporting Warehouse

A data architect is documenting when denormalisation is justified, so that it \
is a measured decision rather than a habit.

a) The architect starts from the normalised schema and measures the slow query \
workload against the performance target.
b) If the target is already met, nothing is changed and the reason is recorded.
c) If it is not met, three cheaper remedies are tried: adding an index, \
rewriting the query, and building a materialised view. They are independent and \
may be tried in any order or at the same time; the decision waits until all \
three have been evaluated.
d) If the target is now met without changing the schema, the reason is recorded \
and the process ends.
e) Only if it is still not met is a denormalisation chosen, applied, and the \
logic that keeps the duplicated data consistent added with it.
f) The write cost is then checked. If it is unacceptable, the denormalisation \
is reverted and the workload is measured again.
g) If it is acceptable, the reason and the trade-off are recorded, and the \
process ends."""

CFG44_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every step in requirements (a) to (g) as an activity.
3. Model requirement (c) with a fork and a join, and explain in one sentence \
what the join guarantees about the decision that follows it.
4. Label EVERY decision branch with its guard. Three different branches reach \
the recording step -- show all three converging on one activity rather than \
drawing it three times.
5. Requirement (e) attaches maintaining logic to the denormalisation. State in \
one sentence what fails if that logic is omitted, and name the property that \
normalisation was protecting in the first place."""


# ------------------------------------------------------------ cfg 45, ERD
def star_schema():
    d = Diagram("Kestrel Retail - Sales Dimensional Model",
                "Entity-relationship diagram, star schema (model answer)")
    d.node("fact", "FactSale", ["PK saleKey: long", "FK dateKey: int",
                                "FK productKey: long", "FK storeKey: long",
                                "FK customerKey: long", "FK promotionKey: long",
                                "quantity: int", "netAmount: double",
                                "taxAmount: double"], 520, 300, 250)
    d.node("dimdate", "DimDate", ["PK dateKey: int", "calendarDate: Date",
                                  "monthName: String", "quarter: int",
                                  "fiscalYear: int", "isHoliday: boolean"], 520, 60, 240)
    d.node("dimprod", "DimProduct", ["PK productKey: long", "productId: String",
                                     "name: String", "category: String",
                                     "validFrom: Date", "validTo: Date",
                                     "isCurrent: boolean"], 130, 250, 250)
    d.node("dimstore", "DimStore", ["PK storeKey: long", "storeId: String",
                                    "name: String", "region: String",
                                    "validFrom: Date", "validTo: Date",
                                    "isCurrent: boolean"], 900, 250, 250)
    d.node("dimcust", "DimCustomer", ["PK customerKey: long", "customerId: String",
                                      "name: String", "segment: String",
                                      "validFrom: Date", "validTo: Date",
                                      "isCurrent: boolean"], 130, 560, 250)
    d.node("dimpromo", "DimPromotion", ["PK promotionKey: long",
                                        "promotionCode: String", "name: String",
                                        "discountPercent: double"], 900, 560, 250)
    d.node("bridge", "BridgeBasket", ["PK bridgeId: long", "FK saleKey: long",
                                      "FK productKey: long",
                                      "lineWeight: double"], 520, 620, 250)
    d.edge("dimdate", "fact", "assoc", "dates", "1", "0..*")
    d.edge("dimprod", "fact", "assoc", "describes", "1", "0..*")
    d.edge("dimstore", "fact", "assoc", "locates", "1", "0..*")
    d.edge("dimcust", "fact", "assoc", "identifies", "1", "0..*")
    d.edge("dimpromo", "fact", "assoc", "attributes", "1", "0..*")
    d.edge("fact", "bridge", "comp", "is broken out by", "1", "0..*")
    d.edge("dimprod", "bridge", "assoc", "appears in", "1", "0..*")
    d.legend(ERD_LEGEND + ["validFrom / validTo / isCurrent = type 2 dimension"],
             x=130, y=60)
    return d.xml()


CFG45_Q = """\
"Kestrel Retail" - Sales Reporting Warehouse

Kestrel's reports take minutes to run against the normalised order tables, and \
a product moved to a new category last year has silently rewritten two years of \
history. Model a dimensional schema that fixes both.

a) The grain of the fact table is one row per product per sale transaction. \
Each row records the quantity, the net amount and the tax amount.
b) The fact table is dated by a date dimension holding the calendar date, month \
name, quarter, fiscal year and a holiday flag. Dates are generated in advance, \
so a date row exists whether or not any sale used it.
c) A product dimension describes each fact row, holding the product's business \
ID, name and category.
d) A store dimension locates each fact row, and a customer dimension identifies \
it. A store holds a region; a customer holds a segment.
e) A promotion dimension attributes each fact row, holding a promotion code, \
name and discount percentage.
f) Product, store and customer must keep history: when a product's category \
changes, sales before the change must still report under the old category. Each \
of those three carries a validFrom, a validTo and a current-row flag, and a new \
row is inserted rather than the old one updated.
g) The promotion dimension does not keep history -- a corrected promotion name \
should apply everywhere.
h) A basket-level bridge breaks each sale out across the products in it, \
carrying a weighting factor so that basket-level measures are not double counted."""

CFG45_I = """\
1. Identify the fact table and the dimension tables, marking primary keys (PK) \
and foreign keys (FK). Say explicitly what the grain of the fact table is.
2. Draw every relationship with its cardinality at BOTH ends, arranging the \
dimensions around the fact table.
3. Requirement (f) describes a slowly changing dimension. Name its type, show \
the three columns that implement it, and explain in one sentence how a query \
finds the row that was current on the date of a sale.
4. Requirement (g) is a different type from requirement (f). Name it, and state \
in one sentence why a promotion NAME and a product CATEGORY are treated \
differently.
5. Requirement (b) says a date row exists whether or not any sale used it. State \
in one sentence what report that makes possible, and what would be wrong with a \
zero-sales day if dates were only inserted when a sale occurred."""


BATCH = [
    (36, CFG36_Q, CFG36_I, srs_structure),
    (37, CFG37_Q, CFG37_I, modular_design_activity),
    (38, CFG38_Q, CFG38_I, event_driven_components),
    (39, CFG39_Q, CFG39_I, change_control),
    (40, CFG40_Q, CFG40_I, veterinary_conceptual),
    (41, CFG41_Q, CFG41_I, temporal_employment),
    (42, CFG42_Q, CFG42_I, normalisation_activity),
    (43, CFG43_Q, CFG43_I, dikw_pipeline),
    (44, CFG44_Q, CFG44_I, denormalisation_activity),
    (45, CFG45_Q, CFG45_I, star_schema),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 5")
