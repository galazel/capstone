"""Batch 10: cfg 97-111. The last fifteen -- documentation, RFI, planning."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

SEQUENCE_LEGEND = [
    "solid arrow = synchronous call",
    "dashed arrow = return",
    "open arrow = asynchronous message",
    "alt / loop box = combined fragment, guard in brackets",
]

USECASE_LEGEND = [
    "stick figure = actor, outside the system",
    "ellipse = use case, inside the boundary",
    "rectangle = system boundary",
    "dashed arrow marked <<include>> = always performed",
    "dashed arrow marked <<extend>> = performed conditionally",
]


# ------------------------------------------------------------ cfg 97, ERD
def documentation_portfolio():
    d = Diagram("Thornbury Engineering - Documentation Portfolio",
                "Entity-relationship diagram (model answer)")
    d.node("product", "Product", ["PK productId: String", "name: String",
                                  "modelCode: String"], 40, 90)
    d.node("doc", "Document", ["PK documentId: String", "FK productId: String",
                               "FK docTypeId: String", "reference: String",
                               "title: String"], 320, 90)
    d.node("dtype", "DocumentType", ["PK docTypeId: String", "name: String",
                                     "audience: String",
                                     "isControlled: boolean"], 620, 90)
    d.node("template", "Template", ["PK templateId: String", "FK docTypeId: String",
                                    "name: String", "version: String"], 900, 90)
    d.node("revision", "Revision", ["PK revisionId: String", "FK documentId: String",
                                    "FK templateId: String", "revisionCode: String",
                                    "issuedOn: Date", "status: String"], 320, 320)
    d.node("section", "Section", ["PK sectionId: String", "FK revisionId: String",
                                  "FK parentSectionId: String", "heading: String",
                                  "ordinal: int"], 620, 320)
    d.node("locale", "Locale", ["PK localeId: String", "languageTag: String",
                                "name: String"], 900, 320)
    d.node("translation", "Translation", ["PK translationId: String",
                                          "FK revisionId: String", "FK localeId: String",
                                          "translatedOn: Date", "status: String"],
           900, 540)
    d.node("review", "DocumentReview", ["PK reviewId: String", "FK revisionId: String",
                                        "FK reviewerId: String", "reviewType: String",
                                        "reviewedOn: Date", "outcome: String"],
           320, 540)
    d.node("reviewer", "Reviewer", ["PK reviewerId: String", "fullName: String",
                                    "role: String"], 40, 540)
    d.node("dist", "Distribution", ["PK distributionId: String",
                                    "FK translationId: String", "channel: String",
                                    "publishedOn: Date",
                                    "withdrawnOn: Date"], 620, 540)
    d.edge("product", "doc", "comp", "is documented by", "1", "1..*")
    d.edge("dtype", "doc", "assoc", "classifies", "1", "0..*")
    d.edge("dtype", "template", "comp", "provides", "1", "1..*")
    d.edge("doc", "revision", "comp", "is issued as", "1", "1..*")
    d.edge("template", "revision", "assoc", "shapes", "1", "0..*")
    d.edge("revision", "section", "comp", "is structured into", "1", "1..*")
    d.edge("section", "section", "assoc", "nests within", "0..1", "0..*")
    d.edge("revision", "translation", "comp", "is translated as", "1", "0..*")
    d.edge("locale", "translation", "assoc", "targets", "1", "0..*")
    d.edge("revision", "review", "comp", "undergoes", "1", "0..*")
    d.edge("reviewer", "review", "assoc", "performs", "1", "0..*")
    d.edge("translation", "dist", "comp", "is published as", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=320)
    return d.xml()


CFG97_Q = """\
"Thornbury Engineering" - Documentation Portfolio

Thornbury ships products into eleven countries and cannot say which language \
versions of a manual are current. Model the data.

a) A product has a name and a model code, and is documented by one or more \
documents. A document belongs to exactly one product and does not survive it.
b) A document type has a name, an audience and a controlled flag. Types are a \
standing list and outlive any document. Each document is classified by exactly \
one type.
c) A document type provides one or more templates, each with a name and a \
version. A template has no meaning apart from its type.
d) A document is issued as one or more revisions, each with a revision code, an \
issue date and a status. A revision is shaped by exactly one template.
e) A revision is structured into one or more sections, each with a heading and \
an ordinal. A section may nest within another section of the same revision, to \
any depth; a top-level section nests within none.
f) A locale has a language tag and a name, and is a standing list.
g) A revision is translated as any number of translations, each targeting \
exactly one locale and recording a translation date and a status.
h) A translation is published as any number of distributions, each with a \
channel, a publication date and a withdrawal date that is empty while it is \
current.
i) A revision undergoes any number of document reviews, each performed by \
exactly one reviewer and recording the review type, date and outcome."""

CFG97_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (e) is a relationship from an entity to ITSELF. Draw it with the \
cardinality that lets a top-level section have no parent.
4. Answer the question in the opening paragraph: name the entities and the \
single attribute you would query to list the currently published language \
versions of a manual, and trace the path on your diagram.
5. Requirement (g) attaches a translation to a REVISION rather than to a \
document. Explain in one sentence why, and what would go wrong when the English \
original is revised if it attached to the document instead."""


# ----------------------------------------------- cfg 98, ACTIVITY_DIAGRAM
def translation_workflow():
    d = Diagram("Thornbury Engineering - Translation and Localisation",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 165, 90, 40, 40)
    d.shape("freeze", "Freeze the source\nrevision", "action", 90, 165, 205, 55)
    d.shape("d0", "source approved\nfor translation?", "decision", 85, 255, 215, 100)
    d.shape("hold", "Hold until the\nsource is approved", "action", 450, 275, 205, 55)
    d.shape("extract", "Extract translatable\ncontent", "action", 90, 375, 205, 55)
    d.shape("tm", "Apply the translation\nmemory", "action", 90, 460, 215, 55)
    d.shape("fork", "", "bar", 440, 545, 10, 210)
    d.shape("trans", "Translate the\nnew segments", "action", 85, 565, 200, 55)
    d.shape("terms", "Check against the\nterminology glossary", "action",
            490, 565, 215, 60)
    d.shape("layout", "Adapt layout for\nthe target locale", "action", 490, 660, 205, 55)
    d.shape("join", "", "bar", 440, 785, 10, 210)
    d.shape("review", "In-country review\nby a native speaker", "action",
            90, 805, 215, 60)
    d.shape("d1", "linguistically\naccepted?", "decision", 95, 895, 200, 95)
    d.shape("correct", "Correct the\ntranslation", "action", 460, 910, 195, 55)
    d.shape("tech", "Technical review against\nthe source", "action", 90, 1010, 225, 60)
    d.shape("d2", "technically\nfaithful?", "decision", 95, 1100, 200, 90)
    d.shape("d3", "source itself\nat fault?", "decision", 460, 1090, 200, 100)
    d.shape("publish", "Publish and update\nthe translation memory", "action",
            90, 1215, 225, 60)
    d.shape("end", "", "end", 175, 1305, 40, 40)
    d.flow("start", "freeze")
    d.flow("freeze", "d0")
    d.flow("d0", "hold", "[no]")
    d.flow("hold", "d0")
    d.flow("d0", "extract", "[yes]")
    d.flow("extract", "tm")
    d.flow("tm", "fork")
    d.flow("fork", "trans")
    d.flow("fork", "terms")
    d.flow("fork", "layout")
    d.flow("trans", "join")
    d.flow("terms", "join")
    d.flow("layout", "join")
    d.flow("join", "review")
    d.flow("review", "d1")
    d.flow("d1", "correct", "[no]")
    d.flow("correct", "review")
    d.flow("d1", "tech", "[yes]")
    d.flow("tech", "d2")
    d.flow("d2", "d3", "[no]")
    d.flow("d3", "freeze", "[yes: fix the source first]")
    d.flow("d3", "correct", "[no: translation error]")
    d.flow("d2", "publish", "[yes]")
    d.flow("publish", "end")
    d.legend(PROCESS_LEGEND, x=740, y=900)
    return d.xml()


CFG98_Q = """\
"Thornbury Engineering" - Translation and Localisation

Thornbury translates manuals into eleven languages, and errors in the English \
source have twice been translated eleven times before anyone noticed. Model the \
process so that cannot happen.

a) The source revision is frozen. If it is not yet approved for translation, the \
work is held until it is.
b) The translatable content is extracted, and the translation memory is applied \
to reuse previously translated segments.
c) Three activities then run: translating the new segments, checking against the \
terminology glossary, and adapting the layout for the target locale. They are \
independent and may run in any order or at the same time; review waits until all \
three are complete.
d) An in-country native speaker reviews the translation for language.
e) If it is not linguistically accepted, the translation is corrected and \
reviewed again.
f) A technical review then checks it against the source.
g) If it is not technically faithful, the team asks whether the SOURCE itself is \
at fault. If it is, the process returns to freezing a corrected source. If it is \
not, it is a translation error and goes back to correction.
h) Once technically faithful it is published and the translation memory updated, \
and the process ends."""

CFG98_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (c) with a fork and a join, and explain in one sentence \
what the join guarantees before the in-country review.
4. Label EVERY decision branch with its guard, and show all three loops \
returning to the correct activity.
5. Requirement (g) is what stops the failure in the opening paragraph. Explain \
in one sentence why a source fault must return to the source rather than be \
patched in the translation, and what that costs when eleven languages are \
already in progress."""


# ----------------------------------------------- cfg 99, ACTIVITY_DIAGRAM
def rfi_evaluation():
    d = Diagram("Evaluating Responses to a Request for Information",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 170, 90, 40, 40)
    d.shape("close", "Close the\nresponse window", "action", 95, 165, 200, 55)
    d.shape("agree", "Agree the scoring\nmodel before opening", "action",
            95, 250, 225, 60)
    d.shape("open", "Open the\nresponses", "action", 95, 345, 200, 50)
    d.shape("d0", "response\ncomplete?", "decision", 115, 425, 175, 90)
    d.shape("chase", "Request a single\nclarification", "action", 460, 440, 200, 55)
    d.shape("d1", "clarified\nin time?", "decision", 720, 430, 175, 90)
    d.shape("exclude", "Exclude the\nresponse", "action", 970, 445, 190, 55)
    d.shape("fork", "", "bar", 450, 555, 10, 200)
    d.shape("tech", "Score the technical\nfit", "action", 90, 575, 210, 55)
    d.shape("comm", "Score the commercial\nindicators", "action", 510, 575, 215, 55)
    d.shape("risk", "Score supplier\nrisk", "action", 510, 665, 200, 55)
    d.shape("join", "", "bar", 450, 780, 10, 200)
    d.shape("weight", "Apply the agreed\nweightings", "action", 95, 800, 210, 55)
    d.shape("moder", "Moderate scores\nacross evaluators", "action", 95, 885, 215, 55)
    d.shape("d2", "scores\nconverged?", "decision", 110, 975, 185, 90)
    d.shape("discuss", "Discuss and\nre-score", "action", 460, 990, 190, 55)
    d.shape("report", "Produce the market\nfindings report", "action", 95, 1095, 220, 55)
    d.shape("d3", "requirement now\nunderstood?", "decision", 100, 1185, 210, 100)
    d.shape("more", "Run a further\nmarket engagement", "action", 470, 1200, 210, 55)
    d.shape("rfp", "Recommend proceeding\nto an RFP", "action", 95, 1315, 220, 55)
    d.shape("end", "", "end", 175, 1405, 40, 40)
    d.flow("start", "close")
    d.flow("close", "agree")
    d.flow("agree", "open")
    d.flow("open", "d0")
    d.flow("d0", "chase", "[no]")
    d.flow("chase", "d1")
    d.flow("d1", "fork", "[yes]")
    d.flow("d1", "exclude", "[no]")
    d.flow("exclude", "weight")
    d.flow("d0", "fork", "[yes]")
    d.flow("fork", "tech")
    d.flow("fork", "comm")
    d.flow("fork", "risk")
    d.flow("tech", "join")
    d.flow("comm", "join")
    d.flow("risk", "join")
    d.flow("join", "weight")
    d.flow("weight", "moder")
    d.flow("moder", "d2")
    d.flow("d2", "discuss", "[no]")
    d.flow("discuss", "moder")
    d.flow("d2", "report", "[yes]")
    d.flow("report", "d3")
    d.flow("d3", "more", "[no]")
    d.flow("more", "close")
    d.flow("d3", "rfp", "[yes]")
    d.flow("rfp", "end")
    d.legend(PROCESS_LEGEND, x=980, y=800)
    return d.xml()


CFG99_Q = """\
Evaluating Responses to a Request for Information

A procurement lead is documenting how RFI responses are evaluated, so that the \
scoring cannot be shaped by what the responses happen to say.

a) The response window is closed.
b) The scoring model is agreed BEFORE any response is opened.
c) The responses are opened.
d) An incomplete response gets one clarification request. If it is clarified in \
time it proceeds; if not, that response is excluded from scoring but is still \
recorded.
e) Three scoring activities then run for each remaining response: scoring the \
technical fit, the commercial indicators and supplier risk. They are independent \
and may be done in any order or at the same time; weighting waits until all three \
are complete.
f) The agreed weightings are applied, and scores are moderated across evaluators.
g) If the evaluators' scores have not converged, they discuss and re-score.
h) Once converged, the market findings report is produced.
i) If the requirement is still not understood, a further market engagement is \
run and the cycle repeats.
j) If it is understood, proceeding to an RFP is recommended, and the process \
ends."""

CFG99_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (j) as an activity.
3. Model requirement (e) with a fork and a join, and explain in one sentence \
what the join guarantees before weightings are applied.
4. Label EVERY decision branch with its guard. Requirement (d) has two branches \
that both continue -- show the excluded response reaching the weighting step \
rather than terminating.
5. Requirement (b) is the control the whole process depends on. Explain in one \
sentence what agreeing the scoring model first prevents, and what an auditor \
would look for to confirm the order was followed."""


# ----------------------------------------------------- cfg 100, UML_CLASS
def business_plan_model():
    d = Diagram("Verity Ventures - Business Plan Class Model",
                "UML class diagram (model answer)")
    d.node("plan", "BusinessPlan", ["- planId: String", "- title: String",
                                    "- horizonYears: int", "- status: String",
                                    "+ breakEvenMonth(): int",
                                    "+ isFundable(): boolean"], 400, 90, 250)
    d.node("section", "PlanSection", ["- sectionId: String", "- heading: String",
                                      "- ordinal: int",
                                      "+ wordCount(): int",
                                      "+ isComplete(): boolean"], 120, 90, 240)
    d.node("stream", "RevenueStream", ["# streamId: String", "# name: String",
                                       "# startsInMonth: int",
                                       "+ monthlyRevenue(m: int): double",
                                       "+ describe(): String"], 400, 320, 250,
           abstract=True)
    d.node("sub", "SubscriptionStream", ["- monthlyPrice: double",
                                         "- churnRate: double",
                                         "+ monthlyRevenue(m: int): double",
                                         "+ subscriberCount(m: int): int"],
           120, 560, 250)
    d.node("once", "OneOffStream", ["- unitPrice: double", "- unitsPerMonth: int",
                                    "+ monthlyRevenue(m: int): double",
                                    "+ isSeasonal(): boolean"], 400, 560, 240)
    d.node("cost", "CostLine", ["# costLineId: String", "# name: String",
                                "+ monthlyCost(m: int): double",
                                "+ isDiscretionary(): boolean"], 700, 320, 240,
           abstract=True)
    d.node("fixed", "FixedCost", ["- monthlyAmount: double",
                                  "+ monthlyCost(m: int): double",
                                  "+ annualTotal(): double"], 680, 560, 230)
    d.node("variable", "VariableCost", ["- ratePerUnit: double",
                                        "+ monthlyCost(m: int): double",
                                        "+ scalesWith(): String"], 940, 560, 230)
    d.node("forecast", "FinancialForecast", ["- forecastId: String",
                                             "- preparedOn: Date",
                                             "+ netMargin(m: int): double",
                                             "+ cumulativeCash(m: int): double"],
           700, 90, 250)
    d.node("assumption", "Assumption", ["- assumptionId: String",
                                        "- statement: String",
                                        "- confidence: String",
                                        "+ isCritical(): boolean",
                                        "+ describe(): String"], 980, 90, 240)
    d.node("risk", "PlanRisk", ["- riskId: String", "- description: String",
                                "- likelihood: int", "- impact: int",
                                "+ score(): int",
                                "+ isCritical(): boolean"], 120, 320, 240)
    d.edge("stream", "sub", "gen")
    d.edge("stream", "once", "gen")
    d.edge("cost", "fixed", "gen")
    d.edge("cost", "variable", "gen")
    d.edge("plan", "section", "comp", "is written as", "1", "1..*")
    d.edge("plan", "forecast", "comp", "is supported by", "1", "1..*")
    d.edge("forecast", "stream", "comp", "projects", "1", "1..*")
    d.edge("forecast", "cost", "comp", "absorbs", "1", "1..*")
    d.edge("forecast", "assumption", "comp", "rests on", "1", "1..*")
    d.edge("plan", "risk", "comp", "carries", "1", "0..*")
    d.legend(UML_LEGEND, x=980, y=320)
    return d.xml()


CFG100_Q = """\
"Verity Ventures" - Business Plan Class Model

Verity reviews business plans for investors. Every plan models subscription and \
one-off revenue with different code, so the two cannot be totalled. Model the \
classes so they can.

a) A business plan has an ID, a title, a horizon in years and a status, and can \
report its break-even month and whether it is fundable.
b) A plan is written as one or more plan sections, each with a heading and an \
ordinal. A section has no meaning apart from its plan.
c) A plan is supported by one or more financial forecasts, each with a \
preparation date, able to report net margin and cumulative cash for a given \
month. Forecasts are deleted with the plan.
d) Every revenue stream has an ID, a name and the month it starts in, and can \
report its revenue for a given month.
e) Subscription and one-off streams are both revenue streams, and a bare stream \
is never instantiated. A subscription stream adds a monthly price and a churn \
rate; a one-off stream adds a unit price and units per month. Each provides its \
own monthlyRevenue().
f) A forecast projects one or more revenue streams. A stream is meaningless \
apart from its forecast.
g) Every cost line has an ID and a name and can report its cost for a given \
month and whether it is discretionary.
h) Fixed and variable costs are both cost lines, and a bare cost line is never \
instantiated. A fixed cost adds a monthly amount; a variable cost adds a rate \
per unit.
i) A forecast absorbs one or more cost lines, and rests on one or more \
assumptions, each with a statement and a confidence rating. Both are deleted \
with the forecast.
j) A plan carries any number of risks, each with a description, likelihood and \
impact."""

CFG100_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Two classes are abstract. Name both, quote the sentence that makes each one \
abstract, and explain in one sentence how requirements (d) and (e) let the \
forecast total the two revenue kinds without knowing which is which.
5. Requirement (c) makes the forecast a composition of the plan. Justify that in \
one sentence, and state what would be wrong with a forecast that outlived the \
plan it was written for."""


# ----------------------------------------------------- cfg 101, UML_CLASS
def project_class_model():
    d = Diagram("Ravensworth Consulting - Project Class Model",
                "UML class diagram (model answer)")
    d.node("project", "Project", ["- projectId: String", "- name: String",
                                  "- startsOn: Date", "- budget: double",
                                  "+ percentComplete(): double",
                                  "+ isOverBudget(): boolean"], 400, 90, 250)
    d.node("element", "WorkElement", ["# elementId: String", "# name: String",
                                      "# plannedDays: double",
                                      "+ duration(): double",
                                      "+ percentComplete(): double"], 400, 320, 250,
           abstract=True)
    d.node("summary", "SummaryTask", ["- rollupMethod: String",
                                      "+ duration(): double",
                                      "+ childCount(): int"], 120, 560, 240)
    d.node("work", "WorkPackage", ["- deliverableRef: String",
                                   "- percentDone: double",
                                   "+ duration(): double",
                                   "+ remainingDays(): double"], 400, 560, 240)
    d.node("milestone", "Milestone", ["- dueOn: Date", "- achievedOn: Date",
                                      "+ duration(): double",
                                      "+ isAchieved(): boolean"], 680, 560, 240)
    d.node("resource", "Resource", ["# resourceId: String", "# name: String",
                                    "# costPerDay: double",
                                    "+ availability(d: Date): double",
                                    "+ describe(): String"], 960, 320, 240,
           abstract=True)
    d.node("person", "PersonResource", ["- grade: String", "- skills: List",
                                        "+ availability(d: Date): double",
                                        "+ isQualified(w: WorkPackage): boolean"],
           940, 560, 250)
    d.node("equip", "EquipmentResource", ["- assetTag: String",
                                          "- servicedOn: Date",
                                          "+ availability(d: Date): double",
                                          "+ needsService(): boolean"], 1210, 560, 250)
    d.node("assign", "Assignment", ["- assignmentId: String",
                                    "- allocationPercent: double",
                                    "- fromDate: Date", "- toDate: Date",
                                    "+ plannedCost(): double",
                                    "+ overlaps(a: Assignment): boolean"], 700, 90, 250)
    d.node("dep", "Dependency", ["- dependencyId: String", "- linkType: String",
                                 "- lagDays: double",
                                 "+ isCritical(): boolean",
                                 "+ describe(): String"], 120, 320, 240)
    d.node("risk", "Risk", ["- riskId: String", "- description: String",
                            "- likelihood: int", "- impact: int",
                            "+ score(): int", "+ isOpen(): boolean"], 120, 90, 240)
    d.edge("element", "summary", "gen")
    d.edge("element", "work", "gen")
    d.edge("element", "milestone", "gen")
    d.edge("resource", "person", "gen")
    d.edge("resource", "equip", "gen")
    d.edge("project", "element", "comp", "is planned as", "1", "1..*")
    d.edge("summary", "element", "comp", "rolls up", "1", "1..*")
    d.edge("element", "dep", "assoc", "is linked by", "1", "0..*")
    d.edge("work", "assign", "comp", "is staffed by", "1", "0..*")
    d.edge("resource", "assign", "aggr", "supplies", "1", "0..*")
    d.edge("project", "risk", "comp", "carries", "1", "0..*")
    d.legend(UML_LEGEND, x=700, y=320)
    return d.xml()


CFG101_Q = """\
"Ravensworth Consulting" - Project Class Model

Ravensworth's planning tool treats summary tasks, work packages and milestones \
as three unrelated types, so a rollup has to be written three times. Model the \
classes so it is written once.

a) A project has an ID, a name, a start date and a budget, and can report its \
percentage complete and whether it is over budget.
b) Every work element has an ID, a name and planned days, and can report its \
duration and percentage complete.
c) Summary tasks, work packages and milestones are all work elements, and a \
bare work element is never instantiated. A summary task adds a rollup method; a \
work package adds a deliverable reference and a percentage done; a milestone \
adds a due date and an achieved date. Each provides its own duration().
d) A project is planned as one or more work elements. An element has no meaning \
apart from its project.
e) A summary task rolls up one or more work elements -- which may themselves be \
summary tasks, to any depth. Those children are destroyed with their parent.
f) A work element is linked by any number of dependencies, each with a link type \
and a lag in days.
g) Every resource has an ID, a name and a cost per day, and can report its \
availability on a date.
h) People and equipment are both resources, and a bare resource is never \
instantiated. A person adds a grade and skills; equipment adds an asset tag and \
a service date.
i) A work package is staffed by any number of assignments, each with an \
allocation percentage and a date range. Assignments are deleted with the work \
package.
j) A resource supplies any number of assignments. Resources exist on the books \
whether or not they are assigned.
k) A project carries any number of risks, each with a description, likelihood \
and impact."""

CFG101_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Requirement (e) makes a summary task contain work elements, which may \
themselves be summary tasks. Draw that, and name the design pattern it \
implements.
5. Justify in one sentence each: why WorkPackage-Assignment is composition but \
Resource-Assignment is only aggregation. Then name the two abstract classes, and \
explain how requirement (c) turns three rollups into one."""


# ---------------------------------------------- cfg 102, ACTIVITY_DIAGRAM
def resource_conflict_activity():
    d = Diagram("Resolving a Resource Conflict",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 170, 90, 40, 40)
    d.shape("detect", "Detect the\nover-allocation", "action", 95, 165, 205, 55)
    d.shape("quant", "Quantify the overload\nand its dates", "action", 95, 250, 215, 55)
    d.shape("d0", "task on the\ncritical path?", "decision", 90, 340, 220, 100)
    d.shape("delay", "Delay within\nthe float", "action", 470, 360, 195, 55)
    d.shape("fork", "", "bar", 460, 470, 10, 200)
    d.shape("resched", "Evaluate rescheduling\nthe task", "action", 85, 490, 220, 60)
    d.shape("addres", "Evaluate adding\na resource", "action", 520, 490, 205, 55)
    d.shape("scope", "Evaluate reducing\nscope", "action", 520, 580, 205, 55)
    d.shape("join", "", "bar", 460, 695, 10, 200)
    d.shape("compare", "Compare options on\ncost, time and quality", "action",
            85, 715, 230, 60)
    d.shape("d1", "an option within\nthe manager's authority?", "decision",
            75, 810, 250, 105)
    d.shape("escal", "Escalate to the\nsponsor", "action", 480, 830, 195, 55)
    d.shape("d2", "sponsor\napproves?", "decision", 480, 935, 190, 90)
    d.shape("accept", "Accept the delay\nand re-baseline", "action", 740, 950, 205, 55)
    d.shape("apply", "Apply the chosen\noption", "action", 95, 1055, 205, 55)
    d.shape("update", "Update the schedule\nand inform stakeholders", "action",
            95, 1140, 230, 60)
    d.shape("d3", "conflict\nresolved?", "decision", 105, 1235, 190, 90)
    d.shape("end", "", "end", 175, 1360, 40, 40)
    d.flow("start", "detect")
    d.flow("detect", "quant")
    d.flow("quant", "d0")
    d.flow("d0", "delay", "[no: has float]")
    d.flow("delay", "update")
    d.flow("d0", "fork", "[yes: no float]")
    d.flow("fork", "resched")
    d.flow("fork", "addres")
    d.flow("fork", "scope")
    d.flow("resched", "join")
    d.flow("addres", "join")
    d.flow("scope", "join")
    d.flow("join", "compare")
    d.flow("compare", "d1")
    d.flow("d1", "escal", "[no]")
    d.flow("escal", "d2")
    d.flow("d2", "apply", "[yes]")
    d.flow("d2", "accept", "[no]")
    d.flow("accept", "update")
    d.flow("d1", "apply", "[yes]")
    d.flow("apply", "update")
    d.flow("update", "d3")
    d.flow("d3", "detect", "[no]")
    d.flow("d3", "end", "[yes]")
    d.legend(PROCESS_LEGEND, x=980, y=1100)
    return d.xml()


CFG102_Q = """\
Resolving a Resource Conflict

A project manager is documenting how an over-allocated resource is dealt with, \
so that the end date is only moved by a decision rather than by drift.

a) The over-allocation is detected, and the overload and its dates are \
quantified.
b) If the affected task is NOT on the critical path, it is delayed within its \
float and the schedule is updated. No escalation is needed.
c) If it IS on the critical path, three options are evaluated: rescheduling the \
task, adding a resource, and reducing scope. They are independent and may be \
evaluated in any order or at the same time; the comparison waits until all three \
are done.
d) The options are compared on cost, time and quality.
e) If an option is within the project manager's authority it is applied.
f) If none is, the decision is escalated to the sponsor. If the sponsor \
approves an option it is applied; if not, the delay is accepted and the schedule \
re-baselined.
g) The schedule is updated and stakeholders informed.
h) If the conflict is not resolved, detection begins again. When it is resolved \
the process ends."""

CFG102_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (c) with a fork and a join, and explain in one sentence \
what the join guarantees before the options are compared.
4. Label EVERY decision branch with its guard. Three different branches reach \
the "apply the chosen option" and "update the schedule" steps -- show them \
converging rather than drawn repeatedly.
5. Requirement (b) turns on float. Explain in one sentence what float is and why \
its absence is what forces the escalation, and state which of the three options \
in requirement (c) changes the project's scope baseline."""


# ---------------------------------------------- cfg 103, ACTIVITY_DIAGRAM
def change_impact_activity():
    d = Diagram("Assessing the Impact of a Requirement Change",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 170, 90, 40, 40)
    d.shape("receive", "Receive the\nchange request", "action", 95, 165, 205, 55)
    d.shape("d0", "request\nwell-formed?", "decision", 105, 255, 195, 90)
    d.shape("reject", "Return for\nclarification", "action", 465, 270, 195, 55)
    d.shape("locate", "Locate the affected\nrequirements", "action", 95, 375, 215, 55)
    d.shape("fork", "", "bar", 460, 460, 10, 220)
    d.shape("design", "Trace impact on\nthe design", "action", 85, 480, 205, 55)
    d.shape("code", "Trace impact on\ncode and interfaces", "action", 520, 480, 215, 60)
    d.shape("test", "Trace impact on\nthe test assets", "action", 520, 575, 205, 55)
    d.shape("join", "", "bar", 460, 705, 10, 220)
    d.shape("cost", "Estimate cost,\neffort and schedule", "action", 85, 725, 215, 60)
    d.shape("risk", "Assess the risk of\nmaking the change", "action", 85, 820, 220, 60)
    d.shape("board", "Present to the\nchange board", "action", 95, 915, 205, 55)
    d.shape("d1", "board\ndecision?", "decision", 105, 1005, 195, 90)
    d.shape("defer", "Defer to a\nfuture release", "action", 465, 1020, 195, 55)
    d.shape("rejectcr", "Reject and record\nthe rationale", "action", 730, 1020, 205, 55)
    d.shape("update", "Update the requirements\nand re-baseline", "action",
            85, 1130, 230, 60)
    d.shape("inform", "Inform every affected\nstakeholder", "action", 85, 1225, 220, 55)
    d.shape("end", "", "end", 175, 1320, 40, 40)
    d.flow("start", "receive")
    d.flow("receive", "d0")
    d.flow("d0", "reject", "[no]")
    d.flow("reject", "receive")
    d.flow("d0", "locate", "[yes]")
    d.flow("locate", "fork")
    d.flow("fork", "design")
    d.flow("fork", "code")
    d.flow("fork", "test")
    d.flow("design", "join")
    d.flow("code", "join")
    d.flow("test", "join")
    d.flow("join", "cost")
    d.flow("cost", "risk")
    d.flow("risk", "board")
    d.flow("board", "d1")
    d.flow("d1", "update", "[approved]")
    d.flow("d1", "defer", "[deferred]")
    d.flow("d1", "rejectcr", "[rejected]")
    d.flow("defer", "inform")
    d.flow("rejectcr", "inform")
    d.flow("update", "inform")
    d.flow("inform", "end")
    d.legend(PROCESS_LEGEND, x=980, y=500)
    return d.xml()


CFG103_Q = """\
Assessing the Impact of a Requirement Change

A requirements manager is documenting how a change request is assessed, so that \
its cost is known before it is approved rather than after.

a) The change request is received and checked for being well-formed. If it is \
not, it is returned for clarification and received again.
b) The affected requirements are located.
c) Three impact traces then run: on the design, on the code and interfaces, and \
on the test assets. They are independent and may be done in any order or at the \
same time; estimation waits until all three are complete.
d) The cost, effort and schedule impact are estimated, and the risk of making \
the change is assessed.
e) The assessment is presented to the change board.
f) The board reaches one of three decisions: approved, deferred to a future \
release, or rejected with the rationale recorded.
g) If approved, the requirements are updated and re-baselined.
h) In all three cases every affected stakeholder is informed, and the process \
ends."""

CFG103_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (c) with a fork and a join, and explain in one sentence \
what the join guarantees before the estimate is produced.
4. Requirement (f) is a single decision with THREE outgoing branches, not two. \
Draw it that way and label every guard.
5. Requirement (h) means all three branches converge. Show them reaching one \
"inform stakeholders" activity, and explain in one sentence why a rejected \
change still requires stakeholders to be told."""


# ----------------------------------------------------------- cfg 104, ERD
def requirements_allocation():
    d = Diagram("Ravensworth Consulting - Requirement Allocation and Interfaces",
                "Entity-relationship diagram (model answer)")
    d.node("system", "System", ["PK systemId: String", "name: String",
                                "FK projectId: String"], 40, 90)
    d.node("subsystem", "Subsystem", ["PK subsystemId: String", "FK systemId: String",
                                      "FK parentSubsystemId: String", "name: String",
                                      "FK ownerId: String"], 320, 90)
    d.node("req", "Requirement", ["PK requirementId: String", "FK systemId: String",
                                  "reference: String", "text: String",
                                  "level: String"], 620, 90)
    d.node("alloc", "Allocation", ["PK allocationId: String", "FK requirementId: String",
                                   "FK subsystemId: String",
                                   "allocationType: String",
                                   "allocatedOn: Date"], 320, 320)
    d.node("decomp", "Decomposition", ["PK decompositionId: String",
                                       "FK parentRequirementId: String",
                                       "FK childRequirementId: String",
                                       "rationale: String"], 900, 90)
    d.node("iface", "Interface", ["PK interfaceId: String", "FK systemId: String",
                                  "name: String", "interfaceType: String"], 620, 320)
    d.node("endpoint", "InterfaceEndpoint", ["PK endpointId: String",
                                             "FK interfaceId: String",
                                             "FK subsystemId: String",
                                             "role: String"], 620, 540)
    d.node("icd", "InterfaceRequirement", ["PK interfaceReqId: String",
                                           "FK interfaceId: String",
                                           "FK requirementId: String",
                                           "protocol: String",
                                           "dataFormat: String"], 900, 320)
    d.node("owner", "Owner", ["PK ownerId: String", "fullName: String",
                              "discipline: String"], 40, 320)
    d.node("budget", "BudgetAllocation", ["PK budgetId: String",
                                          "FK allocationId: String",
                                          "parameter: String", "value: double",
                                          "unit: String"], 320, 540)
    d.edge("system", "subsystem", "comp", "is composed of", "1", "1..*")
    d.edge("subsystem", "subsystem", "assoc", "contains", "0..1", "0..*")
    d.edge("owner", "subsystem", "assoc", "is responsible for", "1", "0..*")
    d.edge("system", "req", "comp", "specifies", "1", "1..*")
    d.edge("req", "alloc", "comp", "is allocated by", "1", "0..*")
    d.edge("subsystem", "alloc", "assoc", "receives", "1", "0..*")
    d.edge("alloc", "budget", "comp", "apportions", "1", "0..*")
    d.edge("req", "decomp", "assoc", "is a parent in", "1", "0..*")
    d.edge("system", "iface", "comp", "defines", "1", "0..*")
    d.edge("iface", "endpoint", "comp", "joins", "1", "2..*")
    d.edge("subsystem", "endpoint", "assoc", "terminates", "1", "0..*")
    d.edge("iface", "icd", "comp", "is governed by", "1", "0..*")
    d.edge("req", "icd", "assoc", "constrains", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=540)
    return d.xml()


CFG104_Q = """\
"Ravensworth Consulting" - Requirement Allocation and Interfaces

Ravensworth builds systems from subsystems supplied by different teams, and \
nobody can say which team owns a given requirement or which subsystems an \
interface joins. Model the data.

a) A system has a name and belongs to exactly one project.
b) A system is composed of one or more subsystems, each with a name. A subsystem \
may contain other subsystems to any depth; a top-level subsystem is contained by \
none. A subsystem does not survive its system.
c) Each subsystem is the responsibility of exactly one owner. Owners have a name \
and a discipline and remain on file after a subsystem is retired.
d) A system specifies one or more requirements, each with a reference, text and \
a level (system, subsystem, component).
e) A requirement is allocated by any number of allocations. Each allocates it to \
exactly one subsystem and records the allocation type and date. A subsystem may \
receive many allocations.
f) An allocation apportions any number of budget allocations, each naming a \
parameter with a value and a unit -- mass, power, latency and so on.
g) A requirement may be the parent of any number of other requirements. Each \
decomposition records the rationale.
h) A system defines any number of interfaces, each with a name and a type.
i) An interface joins two or more interface endpoints. Each endpoint terminates \
at exactly one subsystem and records that subsystem's role.
j) An interface is governed by any number of interface requirements, each \
referring to exactly one requirement and recording a protocol and a data format."""

CFG104_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (b) and (g) are both relationships from an entity to ITSELF. \
Draw both, and for requirement (g) name the two foreign keys so the parent and \
child roles are distinguishable.
4. Answer both questions in the opening paragraph: trace the path from a \
requirement to the team that owns it, and the path from an interface to the \
subsystems it joins, naming every entity crossed.
5. Requirement (i) says two or MORE endpoints. Explain in one sentence why an \
interface is not simply two foreign keys on one row, and what requirement (f) \
would let a systems engineer check across a whole subsystem."""


# ----------------------------------------------------- cfg 105, FLOWCHART
def choosing_document_type():
    d = Diagram("Choosing the Right Technical Document",
                "Flowchart (model answer)")
    d.shape("s", "Start: information\nneeds recording", "terminator", 70, 90, 230, 55)
    d.shape("aud", "Identify the reader\nand what they must do", "action",
            75, 175, 225, 60)
    d.shape("d1", "reader must perform\na task step by step?", "decision",
            60, 265, 250, 105)
    d.shape("proc", "Write a procedure\nor work instruction", "action", 470, 285, 215, 60)
    d.shape("d2", "reader must decide\nwhether it meets a need?", "decision",
            55, 395, 260, 110)
    d.shape("spec", "Write a specification", "action", 470, 415, 215, 50)
    d.shape("d3", "reader must understand\nhow it works?", "decision",
            60, 530, 250, 105)
    d.shape("desc", "Write a design\ndescription", "action", 470, 550, 215, 55)
    d.shape("d4", "reader must be\npersuaded to act?", "decision", 65, 660, 240, 100)
    d.shape("prop", "Write a proposal\nor business case", "action", 470, 675, 215, 55)
    d.shape("d5", "record of what\nhappened?", "decision", 75, 785, 225, 95)
    d.shape("rep", "Write a report\nor record", "action", 470, 800, 215, 55)
    d.shape("ref", "Write a reference\nor glossary entry", "action", 75, 905, 225, 55)
    d.shape("tmpl", "Select the matching\ntemplate", "action", 75, 990, 225, 55)
    d.shape("d6", "template exists?", "decision", 75, 1080, 225, 90)
    d.shape("new", "Raise a new template\nwith the process group", "action",
            470, 1095, 235, 60)
    d.shape("write", "Write the document", "action", 75, 1200, 225, 50)
    d.shape("e", "End", "terminator", 115, 1280, 140, 45)
    d.flow("s", "aud")
    d.flow("aud", "d1")
    d.flow("d1", "proc", "[yes]")
    d.flow("proc", "tmpl")
    d.flow("d1", "d2", "[no]")
    d.flow("d2", "spec", "[yes]")
    d.flow("spec", "tmpl")
    d.flow("d2", "d3", "[no]")
    d.flow("d3", "desc", "[yes]")
    d.flow("desc", "tmpl")
    d.flow("d3", "d4", "[no]")
    d.flow("d4", "prop", "[yes]")
    d.flow("prop", "tmpl")
    d.flow("d4", "d5", "[no]")
    d.flow("d5", "rep", "[yes]")
    d.flow("rep", "tmpl")
    d.flow("d5", "ref", "[no]")
    d.flow("ref", "tmpl")
    d.flow("tmpl", "d6")
    d.flow("d6", "new", "[no]")
    d.flow("new", "tmpl")
    d.flow("d6", "write", "[yes]")
    d.flow("write", "e")
    d.legend(PROCESS_LEGEND, x=760, y=250)
    return d.xml()


CFG105_Q = """\
Choosing the Right Technical Document

Thornbury's engineers write everything as a "report", so readers cannot tell an \
instruction from a proposal. Model the decision process that picks the document \
type from what the reader needs to do.

a) The process starts when information needs recording. The reader and what they \
must do with the information are identified.
b) If the reader must perform a task step by step, a procedure or work \
instruction is written.
c) Otherwise, if the reader must decide whether something meets a need, a \
specification is written.
d) Otherwise, if the reader must understand how something works, a design \
description is written.
e) Otherwise, if the reader must be persuaded to act, a proposal or business \
case is written.
f) Otherwise, if what is needed is a record of what happened, a report or record \
is written.
g) If none of those apply, a reference or glossary entry is written.
h) Whichever type is chosen, the matching template is then selected.
i) If no template exists for that type, a new one is raised with the process \
group and the template is selected again.
j) The document is written and the process ends."""

CFG105_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show the choice in requirements (b) to (g) as a chain of decisions, each with \
its guard, reaching exactly one document type.
3. Show the common path of requirements (h) to (j) ONCE, with all six document \
types converging on it, rather than drawing it six times. Explain in one sentence \
why duplicating it would be a modelling error.
4. Label EVERY decision branch with its guard.
5. Requirement (a) selects on what the reader must DO, not on what the writer \
knows. Explain in one sentence why that is the right test, and which two document \
types in this chain are most often confused when it is not applied."""


# ----------------------------------------------------- cfg 106, FLOWCHART
def story_refinement():
    d = Diagram("Refining a User Story to Ready",
                "Flowchart (model answer)")
    d.shape("s", "Start: story on\nthe backlog", "terminator", 75, 90, 215, 55)
    d.shape("write", "Write it in the\nrole-goal-benefit form", "action",
            80, 175, 220, 55)
    d.shape("d1", "value to the\nuser clear?", "decision", 90, 265, 200, 90)
    d.shape("value", "Clarify the value\nwith the owner", "action", 460, 280, 205, 55)
    d.shape("ac", "Add acceptance\ncriteria", "action", 80, 375, 220, 50)
    d.shape("d2", "criteria testable\nand complete?", "decision", 75, 455, 230, 100)
    d.shape("fixac", "Rewrite the\ncriteria", "action", 460, 475, 195, 55)
    d.shape("d3", "dependencies\nresolved?", "decision", 85, 585, 210, 95)
    d.shape("dep", "Record and\nsequence the dependency", "action", 460, 600, 230, 60)
    d.shape("est", "Estimate with\nthe team", "action", 80, 710, 220, 50)
    d.shape("d4", "too large for\none sprint?", "decision", 80, 790, 215, 95)
    d.shape("split", "Split into smaller\nvertical slices", "action", 460, 805, 210, 55)
    d.shape("d5", "team agrees it\nis ready?", "decision", 85, 900, 210, 95)
    d.shape("park", "Return it to\nthe backlog", "action", 460, 915, 200, 55)
    d.shape("ready", "Mark ready and\nadd to the sprint", "action", 80, 1015, 220, 55)
    d.shape("e", "End", "terminator", 115, 1100, 140, 45)
    d.flow("s", "write")
    d.flow("write", "d1")
    d.flow("d1", "value", "[no]")
    d.flow("value", "write")
    d.flow("d1", "ac", "[yes]")
    d.flow("ac", "d2")
    d.flow("d2", "fixac", "[no]")
    d.flow("fixac", "ac")
    d.flow("d2", "d3", "[yes]")
    d.flow("d3", "dep", "[no]")
    d.flow("dep", "d3")
    d.flow("d3", "est", "[yes]")
    d.flow("est", "d4")
    d.flow("d4", "split", "[yes]")
    d.flow("split", "write")
    d.flow("d4", "d5", "[no]")
    d.flow("d5", "park", "[no]")
    d.flow("park", "e")
    d.flow("d5", "ready", "[yes]")
    d.flow("ready", "e")
    d.legend(PROCESS_LEGEND, x=760, y=300)
    return d.xml()


CFG106_Q = """\
Refining a User Story to "Ready"

A team keeps pulling stories into a sprint that turn out to be too big or \
untestable. Model the refinement process that decides when a story is ready.

a) The process starts with a story on the backlog. It is written in the \
role-goal-benefit form.
b) If the value to the user is not clear, it is clarified with the product owner \
and the story rewritten.
c) Acceptance criteria are added.
d) If the criteria are not testable and complete, they are rewritten and checked \
again.
e) Dependencies are checked. Any unresolved dependency is recorded and \
sequenced, and the check is repeated.
f) The team estimates the story.
g) If it is too large for one sprint it is split into smaller vertical slices, \
and each slice goes back to being written in the role-goal-benefit form.
h) The team then decides whether it is ready. If it is not, it returns to the \
backlog and the process ends there.
i) If it is ready, it is marked ready and added to the sprint, and the process \
ends."""

CFG106_I = """\
1. Draw the flowchart with one start terminator and one end terminator -- \
requirement (h) also terminates, so route it to the same end.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (g) says vertical slices, and sends each slice back to the \
beginning. Explain in one sentence what a vertical slice is, and why splitting a \
story horizontally would not fix the problem in the opening paragraph.
5. Requirement (d) makes testability a gate rather than an afterthought. State \
in one sentence what an untestable acceptance criterion costs the team at the \
END of the sprint."""


# ----------------------------------------------------- cfg 107, FLOWCHART
def funding_round_flow():
    d = Diagram("Raising a Funding Round",
                "Flowchart (model answer)")
    d.shape("s", "Start: funding need\nidentified", "terminator", 70, 90, 230, 55)
    d.shape("amount", "Determine the amount\nand the runway it buys", "action",
            75, 175, 235, 60)
    d.shape("d1", "existing plan\nsupports the ask?", "decision", 65, 265, 250, 100)
    d.shape("revise", "Revise the business\nplan and forecast", "action", 475, 285, 215, 55)
    d.shape("type", "Choose the funding\ntype and instrument", "action", 75, 385, 235, 55)
    d.shape("deck", "Prepare the pitch deck\nand data room", "action", 75, 470, 235, 55)
    d.shape("approach", "Approach target\ninvestors", "action", 75, 555, 235, 55)
    d.shape("d2", "interest\nreceived?", "decision", 90, 645, 205, 90)
    d.shape("widen", "Widen the investor\nlist or revise the ask", "action",
            475, 660, 230, 60)
    d.shape("dd", "Undergo due\ndiligence", "action", 75, 765, 235, 50)
    d.shape("d3", "diligence issues\nraised?", "decision", 80, 845, 225, 95)
    d.shape("remedy", "Remedy and\nre-submit", "action", 475, 860, 200, 55)
    d.shape("terms", "Negotiate the\nterm sheet", "action", 75, 960, 235, 55)
    d.shape("d4", "terms acceptable\nto the founders?", "decision", 65, 1050, 250, 105)
    d.shape("walk", "Decline and return\nto the investor list", "action",
            475, 1070, 230, 60)
    d.shape("close", "Complete legals\nand close the round", "action", 75, 1175, 235, 55)
    d.shape("report", "Report to investors\nagainst the plan", "action", 75, 1260, 235, 55)
    d.shape("e", "End", "terminator", 115, 1345, 140, 45)
    d.flow("s", "amount")
    d.flow("amount", "d1")
    d.flow("d1", "revise", "[no]")
    d.flow("revise", "amount")
    d.flow("d1", "type", "[yes]")
    d.flow("type", "deck")
    d.flow("deck", "approach")
    d.flow("approach", "d2")
    d.flow("d2", "widen", "[no]")
    d.flow("widen", "approach")
    d.flow("d2", "dd", "[yes]")
    d.flow("dd", "d3")
    d.flow("d3", "remedy", "[yes]")
    d.flow("remedy", "dd")
    d.flow("d3", "terms", "[no]")
    d.flow("terms", "d4")
    d.flow("d4", "walk", "[no]")
    d.flow("walk", "approach")
    d.flow("d4", "close", "[yes]")
    d.flow("close", "report")
    d.flow("report", "e")
    d.legend(PROCESS_LEGEND, x=770, y=400)
    return d.xml()


CFG107_Q = """\
Raising a Funding Round

A founder is documenting how a funding round is run, so that the amount asked \
for is justified by the plan rather than chosen first.

a) The process starts when a funding need is identified. The amount and the \
runway it buys are determined.
b) If the existing business plan does not support the ask, the plan and forecast \
are revised and the amount determined again. This may happen any number of times.
c) The funding type and instrument are chosen, the pitch deck and data room \
prepared, and target investors approached.
d) If no interest is received, the investor list is widened or the ask revised, \
and investors are approached again.
e) With interest, the company undergoes due diligence.
f) If diligence raises issues they are remedied and diligence is re-submitted.
g) The term sheet is negotiated.
h) If the terms are not acceptable to the founders, the offer is declined and \
the founders return to approaching investors.
i) If they are acceptable, the legals are completed and the round closed.
j) Investors are then reported to against the plan, and the process ends."""

CFG107_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (j) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (b) is the control described in the opening paragraph. Explain in \
one sentence why a failed check returns to the PLAN rather than simply lowering \
the ask.
5. Requirements (d) and (h) both loop back to approaching investors, from \
different places. Show both, and state in one sentence what distinguishes the two \
situations for the founder."""


# ------------------------------------------------ cfg 108, SEQUENCE_DIAGRAM
def live_demo_sequence():
    d = Diagram("Technical Presentation - Live Demonstration",
                "UML sequence diagram (model answer)")
    d.lifeline("presenter", "Presenter", 40, 100, 150, 800)
    d.lifeline("av", ":AvSystem", 240, 100, 150, 800)
    d.lifeline("laptop", ":PresenterLaptop", 440, 100, 170, 800)
    d.lifeline("demo", ":DemoEnvironment", 650, 100, 175, 800)
    d.lifeline("backup", ":RecordedBackup", 865, 100, 170, 800)
    d.lifeline("audience", "Audience", 1075, 100, 150, 800)
    d.msg("presenter", "av", "1: connect(laptop)", 200)
    d.msg("av", "presenter", "2: displayReady", 240, "return")
    d.msg("presenter", "laptop", "3: openDemo()", 285)
    d.msg("laptop", "demo", "4: healthCheck()", 325)
    d.msg("demo", "laptop", "5: healthStatus", 365, "return")
    d.frame("alt  [demo environment healthy]", 420, 400, 700, 300)
    d.frame("loop  [for each demo step]", 440, 440, 620, 150)
    d.msg("presenter", "laptop", "6: performStep()", 480)
    d.msg("laptop", "demo", "7: executeAction()", 520)
    d.msg("demo", "laptop", "8: result", 560, "return")
    d.msg("laptop", "av", "9: render to screen", 620)
    d.msg("presenter", "backup", "10: playRecordedDemo()", 670)
    d.msg("backup", "av", "11: render to screen", 710)
    d.msg("av", "audience", "12: shows demonstration", 760)
    d.msg("presenter", "audience", "13: narrate and take questions", 800)
    d.msg("audience", "presenter", "14: questions", 840, "return")
    d.legend(SEQUENCE_LEGEND, x=1270, y=200)
    return d.xml()


CFG108_Q = """\
Technical Presentation - Live Demonstration

A presenter's live demo failed in front of a client because there was no \
fallback. Model the interaction, including what happens when the demo \
environment is down.

a) The presenter connects the laptop to the AV system and waits for it to \
confirm the display is ready.
b) The presenter opens the demo on the laptop, which health-checks the demo \
environment and waits for the answer BEFORE anything is shown.
c) If the environment is healthy, the presenter performs each demo step in turn. \
For each step the laptop executes the action against the demo environment and \
waits for the result. This repeats for every step.
d) The laptop renders each result to the AV system.
e) If the environment is NOT healthy, the presenter plays the recorded backup \
instead, which renders to the AV system. No step is executed against the live \
environment.
f) In both cases the AV system shows the demonstration to the audience.
g) The presenter narrates and takes questions from the audience."""

CFG108_I = """\
1. Draw a lifeline for the presenter, the audience, and each of the four systems \
named in requirements (a) to (f).
2. Number the messages in the order they occur, and show returns as dashed \
arrows.
3. Use an alt fragment for requirements (c) and (e), and a loop fragment for the \
repetition in requirement (c), writing the guard in each fragment's bracket.
4. Requirement (b) says the health check completes before anything is shown. \
Explain in one sentence why that ordering is what makes requirement (e) possible, \
and what the presenter in the opening paragraph was missing.
5. Requirement (f) means both branches converge. Show the AV system receiving \
from either path, and state which single lifeline the audience ever interacts \
with directly."""


# ------------------------------------------------------ cfg 109, USE_CASE
def webinar_use_cases():
    d = Diagram("Technical Webinar Platform - Use Cases",
                "UML use case diagram (model answer)")
    d.shape("bound", "Webinar Platform", "boundary", 340, 90, 520, 720)
    d.shape("presenter", "Presenter", "actor", 130, 200, 40, 70)
    d.shape("attendee", "Attendee", "actor", 130, 400, 40, 70)
    d.shape("host", "Host", "actor", 130, 600, 40, 70)
    d.shape("cms", "Content Repository", "actor", 990, 240, 40, 70)
    d.shape("crm", "CRM System", "actor", 990, 560, 40, 70)
    d.shape("schedule", "Schedule a webinar", "usecase", 400, 140, 200, 60)
    d.shape("upload", "Upload slide deck", "usecase", 400, 230, 200, 60)
    d.shape("register", "Register to attend", "usecase", 400, 330, 200, 60)
    d.shape("present", "Deliver the session", "usecase", 400, 430, 200, 60)
    d.shape("share", "Share the screen", "usecase", 620, 430, 200, 60)
    d.shape("poll", "Run a live poll", "usecase", 620, 330, 200, 60)
    d.shape("ask", "Ask a question", "usecase", 400, 530, 200, 60)
    d.shape("moderate", "Moderate questions", "usecase", 620, 530, 200, 60)
    d.shape("record", "Record the session", "usecase", 620, 630, 200, 60)
    d.shape("followup", "Send follow-up material", "usecase", 400, 720, 220, 60)
    d.edge("presenter", "present", "assoc")
    d.edge("presenter", "upload", "assoc")
    d.edge("attendee", "register", "assoc")
    d.edge("attendee", "ask", "assoc")
    d.edge("host", "schedule", "assoc")
    d.edge("host", "moderate", "assoc")
    d.edge("upload", "cms", "assoc")
    d.edge("register", "crm", "assoc")
    d.edge("followup", "crm", "assoc")
    d.edge("present", "share", "dep", "<<include>>")
    d.edge("present", "record", "dep", "<<include>>")
    d.edge("poll", "present", "dep", "<<extend>>")
    d.edge("ask", "moderate", "dep", "<<include>>")
    d.edge("followup", "schedule", "dep", "<<extend>>")
    d.legend(USECASE_LEGEND, x=60, y=720)
    return d.xml()


CFG109_Q = """\
Technical Webinar Platform - Use Cases

A team is specifying a platform for technical webinars, and must be clear about \
who does what and which systems sit outside it. Model it.

a) A host schedules a webinar and moderates questions.
b) A presenter uploads the slide deck and delivers the session.
c) An attendee registers to attend and asks questions.
d) Delivering the session ALWAYS shares the screen and ALWAYS records the \
session.
e) Delivering the session runs a live poll ONLY when the presenter has prepared \
one. Most sessions do not.
f) Asking a question ALWAYS goes through moderation before it reaches the \
presenter.
g) Scheduling a webinar sends follow-up material ONLY when the host has enabled \
it.
h) The content repository is a separate system that stores uploaded decks. The \
CRM system is a separate system that receives registrations and follow-up \
records. Neither is part of the platform and no person uses either here."""

CFG109_I = """\
1. Draw the system boundary and place every use case inside it and every actor \
outside it.
2. Draw an association line from each actor to the use cases they take part in.
3. Requirements (d) and (f) are always performed; requirements (e) and (g) are \
conditional. Mark the first group <<include>> and the second <<extend>>, with \
the dashed arrow pointing the correct way in each case.
4. Requirement (h) describes two systems, not people. Explain in one sentence \
why they are still drawn as actors, and what distinguishes them from the human \
actors on your diagram.
5. State in one sentence the difference between <<include>> and <<extend>>, and \
explain what would be wrong with modelling requirement (e) as an <<include>>."""


# ---------------------------------------------- cfg 110, ACTIVITY_DIAGRAM
def rfi_response_activity():
    d = Diagram("Preparing a Supplier Response to an RFI",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 170, 90, 40, 40)
    d.shape("receive", "Receive and log\nthe RFI", "action", 95, 165, 205, 55)
    d.shape("d0", "worth\nresponding to?", "decision", 105, 255, 195, 95)
    d.shape("decline", "Decline politely\nand record why", "action", 465, 275, 205, 55)
    d.shape("owner", "Appoint a\nresponse owner", "action", 95, 380, 205, 55)
    d.shape("read", "Read every question\nand map it to an owner", "action",
            95, 465, 230, 60)
    d.shape("fork", "", "bar", 470, 555, 10, 220)
    d.shape("tech", "Draft the technical\nanswers", "action", 90, 575, 210, 55)
    d.shape("comm", "Draft the commercial\nanswers", "action", 530, 575, 215, 55)
    d.shape("refs", "Assemble references\nand case studies", "action", 530, 670, 215, 60)
    d.shape("join", "", "bar", 470, 800, 10, 220)
    d.shape("consol", "Consolidate into\none voice", "action", 95, 820, 210, 55)
    d.shape("d1", "every question\nanswered?", "decision", 100, 910, 200, 95)
    d.shape("gaps", "Fill the gaps or\nask for clarification", "action", 470, 925, 225, 60)
    d.shape("review", "Review for accuracy\nand commitments made", "action",
            95, 1025, 230, 60)
    d.shape("d2", "any unapproved\ncommitment?", "decision", 95, 1120, 210, 95)
    d.shape("strip", "Remove or escalate\nfor approval", "action", 470, 1135, 215, 55)
    d.shape("submit", "Submit before\nthe deadline", "action", 95, 1240, 210, 55)
    d.shape("end", "", "end", 175, 1330, 40, 40)
    d.flow("start", "receive")
    d.flow("receive", "d0")
    d.flow("d0", "decline", "[no]")
    d.flow("decline", "end")
    d.flow("d0", "owner", "[yes]")
    d.flow("owner", "read")
    d.flow("read", "fork")
    d.flow("fork", "tech")
    d.flow("fork", "comm")
    d.flow("fork", "refs")
    d.flow("tech", "join")
    d.flow("comm", "join")
    d.flow("refs", "join")
    d.flow("join", "consol")
    d.flow("consol", "d1")
    d.flow("d1", "gaps", "[no]")
    d.flow("gaps", "consol")
    d.flow("d1", "review", "[yes]")
    d.flow("review", "d2")
    d.flow("d2", "strip", "[yes]")
    d.flow("strip", "review")
    d.flow("d2", "submit", "[no]")
    d.flow("submit", "end")
    d.legend(PROCESS_LEGEND, x=780, y=1000)
    return d.xml()


CFG110_Q = """\
Preparing a Supplier Response to an RFI

A supplier's last RFI response promised a delivery date nobody had approved. \
Model the response process so that cannot recur.

a) The RFI is received and logged.
b) The team decides whether it is worth responding to. If not, it declines \
politely, records why, and the process ends there.
c) A response owner is appointed, and every question is read and mapped to the \
person who will answer it.
d) Three drafting activities then run: the technical answers, the commercial \
answers, and assembling references and case studies. They are independent and may \
be done in any order or at the same time; consolidation waits until all three are \
complete.
e) The answers are consolidated into one voice.
f) If any question is unanswered, the gap is filled or a clarification requested, \
and consolidation is redone.
g) The response is reviewed for accuracy AND for any commitment it makes.
h) If it contains a commitment nobody has approved, that commitment is removed \
or escalated for approval, and the review is repeated.
i) The response is submitted before the deadline, and the process ends."""

CFG110_I = """\
1. Draw the activity diagram with exactly one initial node and one final node -- \
requirement (b) also terminates, so route it to the same final node.
2. Show every action in requirements (a) to (i) as an activity.
3. Model requirement (d) with a fork and a join, and explain in one sentence \
what the join guarantees before consolidation.
4. Label EVERY decision branch with its guard, and show both loops returning to \
the correct activity.
5. Requirement (h) is the control that answers the opening paragraph. Explain in \
one sentence why the check sits AFTER consolidation rather than during drafting, \
and what a commitment in an RFI response can legally become."""


# ----------------------------------------------------------- cfg 111, ERD
def backlog_documentation():
    d = Diagram("Ravensworth Consulting - Backlog Documentation Model",
                "Entity-relationship diagram (model answer)")
    d.node("product", "Product", ["PK productId: String", "name: String",
                                  "FK ownerId: String"], 40, 90)
    d.node("owner", "ProductOwner", ["PK ownerId: String", "fullName: String",
                                     "email: String"], 40, 320)
    d.node("epic", "Epic", ["PK epicId: String", "FK productId: String",
                            "title: String", "outcome: String",
                            "status: String"], 320, 90)
    d.node("story", "UserStory", ["PK storyId: String", "FK epicId: String",
                                  "FK personaId: String", "reference: String",
                                  "goal: String", "benefit: String",
                                  "estimatePoints: int"], 620, 90)
    d.node("persona", "Persona", ["PK personaId: String", "name: String",
                                  "description: String"], 900, 90)
    d.node("ac", "AcceptanceCriterion", ["PK criterionId: String", "FK storyId: String",
                                         "ordinal: int", "givenWhenThen: String",
                                         "isMandatory: boolean"], 620, 320)
    d.node("dep", "StoryDependency", ["PK dependencyId: String",
                                      "FK blockingStoryId: String",
                                      "FK blockedStoryId: String",
                                      "reason: String"], 900, 320)
    d.node("term", "GlossaryTerm", ["PK termId: String", "FK productId: String",
                                    "term: String", "definition: String"], 320, 320)
    d.node("usage", "TermUsage", ["PK usageId: String", "FK storyId: String",
                                  "FK termId: String"], 320, 540)
    d.node("sprint", "Sprint", ["PK sprintId: String", "FK productId: String",
                                "name: String", "startsOn: Date",
                                "endsOn: Date"], 900, 540)
    d.node("commit", "SprintCommitment", ["PK commitmentId: String",
                                          "FK sprintId: String", "FK storyId: String",
                                          "committedPoints: int",
                                          "completedOn: Date"], 620, 540)
    d.edge("owner", "product", "assoc", "owns", "1", "0..*")
    d.edge("product", "epic", "comp", "is delivered through", "1", "1..*")
    d.edge("epic", "story", "comp", "is broken into", "1", "1..*")
    d.edge("persona", "story", "assoc", "is the role in", "1", "0..*")
    d.edge("story", "ac", "comp", "is accepted by", "1", "1..*")
    d.edge("story", "dep", "assoc", "blocks through", "1", "0..*")
    d.edge("product", "term", "comp", "defines", "1", "0..*")
    d.edge("story", "usage", "comp", "refers through", "1", "0..*")
    d.edge("term", "usage", "assoc", "is referred to by", "1", "0..*")
    d.edge("sprint", "commit", "comp", "commits", "1", "0..*")
    d.edge("story", "commit", "assoc", "is committed as", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=540)
    return d.xml()


CFG111_Q = """\
"Ravensworth Consulting" - Backlog Documentation

Ravensworth's backlog uses the same word to mean two different things in \
different stories, and nobody can say which sprint a story slipped from. Model \
the data.

a) A product has a name and is owned by exactly one product owner. Owners remain \
on file after a product is retired.
b) A product is delivered through one or more epics, each with a title, an \
outcome and a status. An epic has no meaning apart from its product.
c) An epic is broken into one or more user stories, each with a reference, a \
goal, a benefit and an estimate in points.
d) A persona has a name and a description and is a shared list. Each story names \
exactly one persona as its role; a persona appears in many stories.
e) A story is accepted by one or more acceptance criteria, each with an ordinal, \
a given-when-then statement and a mandatory flag. Criteria are deleted with the \
story.
f) A story may block any number of other stories. Each dependency records the \
reason.
g) A product defines any number of glossary terms, each with a term and a \
definition.
h) A story may refer to any number of glossary terms, and a term may be referred \
to by many stories.
i) A sprint has a name and a start and end date and belongs to exactly one \
product.
j) A sprint commits any number of stories. Each commitment records the points \
committed and the completion date, which is empty if the story did not finish. \
One story may be committed to several sprints over time."""

CFG111_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (f) is a many-to-many relationship from UserStory to ITSELF. \
Resolve it, and name the two foreign keys so the blocking and blocked roles are \
distinguishable.
4. Answer the first problem in the opening paragraph: requirements (g) and (h) \
are what fix it. Resolve the many-to-many, and explain in one sentence why one \
shared definition per product beats a definition written into each story.
5. Answer the second: name the entity and the two attributes you would query to \
find a story that slipped from one sprint to the next, and state which \
cardinality in requirement (j) makes that history possible."""


BATCH = [
    (97, CFG97_Q, CFG97_I, documentation_portfolio),
    (98, CFG98_Q, CFG98_I, translation_workflow),
    (99, CFG99_Q, CFG99_I, rfi_evaluation),
    (100, CFG100_Q, CFG100_I, business_plan_model),
    (101, CFG101_Q, CFG101_I, project_class_model),
    (102, CFG102_Q, CFG102_I, resource_conflict_activity),
    (103, CFG103_Q, CFG103_I, change_impact_activity),
    (104, CFG104_Q, CFG104_I, requirements_allocation),
    (105, CFG105_Q, CFG105_I, choosing_document_type),
    (106, CFG106_Q, CFG106_I, story_refinement),
    (107, CFG107_Q, CFG107_I, funding_round_flow),
    (108, CFG108_Q, CFG108_I, live_demo_sequence),
    (109, CFG109_Q, CFG109_I, webinar_use_cases),
    (110, CFG110_Q, CFG110_I, rfi_response_activity),
    (111, CFG111_Q, CFG111_I, backlog_documentation),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 10")
