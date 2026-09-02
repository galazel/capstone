"""Batch 9: cfg 83-96. IT business operations, communications and project work."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch, PROCESS_LEGEND
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "dashed open arrow = dependency on an interface",
]

USECASE_LEGEND = [
    "stick figure = actor, outside the system",
    "ellipse = use case, inside the boundary",
    "rectangle = system boundary",
    "dashed arrow marked <<include>> = always performed",
    "dashed arrow marked <<extend>> = performed conditionally",
]


# -------------------------------------------------- cfg 83, UML_COMPONENT
def billing_operations():
    d = Diagram("Drummond Telecom - Billing Operations Architecture",
                "UML component diagram (model answer)")
    d.shape("mediation", "UsageMediation", "component", 40, 150, 210, 70)
    d.shape("rate", "RatingEngine", "component", 320, 150, 210, 70)
    d.shape("product", "ProductCatalogue", "component", 320, 300, 210, 70)
    d.shape("bill", "BillingEngine", "component", 600, 150, 210, 70)
    d.shape("cust", "CustomerAccount", "component", 600, 300, 210, 70)
    d.shape("invoice", "InvoiceGenerator", "component", 880, 150, 220, 70)
    d.shape("collect", "CollectionsManager", "component", 880, 300, 220, 70)
    d.shape("ledger", "GeneralLedger", "component", 1170, 150, 210, 70)
    d.shape("dispute", "DisputeHandler", "component", 880, 450, 220, 70)
    d.shape("notify", "CustomerNotification", "component", 1170, 300, 220, 70)
    d.shape("i_usage", "IRatedUsage", "provided", 285, 165, 22, 22)
    d.shape("i_prod", "ITariffLookup", "provided", 285, 315, 22, 22)
    d.shape("i_charge", "IChargeSet", "provided", 565, 165, 22, 22)
    d.shape("i_acct", "IAccountLookup", "provided", 565, 315, 22, 22)
    d.shape("i_inv", "IInvoiceDocument", "provided", 845, 165, 22, 22)
    d.shape("i_not", "INotify", "provided", 1135, 315, 22, 22)
    d.edge("rate", "mediation", "dep", "IRatedUsage")
    d.edge("rate", "product", "dep", "ITariffLookup")
    d.edge("bill", "rate", "dep", "IChargeSet")
    d.edge("bill", "cust", "dep", "IAccountLookup")
    d.edge("invoice", "bill", "dep", "IChargeSet")
    d.edge("invoice", "ledger", "dep", "posts to")
    d.edge("collect", "invoice", "dep", "IInvoiceDocument")
    d.edge("collect", "cust", "dep", "IAccountLookup")
    d.edge("dispute", "invoice", "dep", "IInvoiceDocument")
    d.edge("dispute", "ledger", "dep", "posts to")
    d.edge("collect", "notify", "dep", "INotify")
    d.edge("invoice", "notify", "dep", "INotify")
    d.legend(COMPONENT_LEGEND + ["only two components post to the ledger"],
             x=40, y=300)
    return d.xml()


CFG83_Q = """\
"Drummond Telecom" - Billing Operations Architecture

Drummond's month-end billing run and its general ledger disagree, because three \
different components post to the ledger with their own rules. Model an \
architecture that fixes that.

a) Usage mediation provides IRatedUsage, the cleaned and deduplicated usage \
records. It is the only component that reads the network's raw files.
b) The rating engine depends on IRatedUsage and on the product catalogue's \
ITariffLookup interface. The catalogue is the single source of tariffs.
c) The rating engine provides IChargeSet.
d) The billing engine depends on IChargeSet and on the customer account \
component's IAccountLookup interface.
e) The invoice generator depends on IChargeSet -- the same interface the billing \
engine uses -- and provides IInvoiceDocument.
f) The invoice generator posts to the general ledger.
g) The collections manager depends on IInvoiceDocument and IAccountLookup.
h) The dispute handler depends on IInvoiceDocument and also posts to the general \
ledger. Those two are the ONLY components that post to it.
i) The invoice generator and the collections manager both notify customers \
through INotify. Nothing depends on customer notification."""

CFG83_I = """\
1. Draw every component in requirements (a) to (i) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (h) limits ledger posting to two components. Mark both on your \
diagram, and explain in one sentence why a dispute must post to the ledger \
rather than simply amending the invoice.
5. Requirement (e) has two consumers of IChargeSet. State in one sentence what \
would go wrong at month end if the invoice generator recalculated charges itself \
instead."""


# ----------------------------------------------- cfg 84, ACTIVITY_DIAGRAM
def month_end_close():
    d = Diagram("Drummond Telecom - Month-End Billing Close",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 170, 90, 40, 40)
    d.shape("freeze", "Freeze the usage\ncollection window", "action", 100, 165, 210, 55)
    d.shape("fork", "", "bar", 440, 250, 10, 210)
    d.shape("mediate", "Mediate and\ndeduplicate usage", "action", 90, 270, 200, 55)
    d.shape("tariff", "Load the tariff\neffective for the period", "action",
            500, 270, 220, 60)
    d.shape("acct", "Refresh customer\naccount status", "action", 500, 365, 210, 55)
    d.shape("join", "", "bar", 440, 490, 10, 210)
    d.shape("rate", "Rate the usage", "action", 100, 510, 200, 50)
    d.shape("d1", "rating\nexceptions?", "decision", 120, 590, 175, 90)
    d.shape("fix", "Resolve the\nexceptions", "action", 470, 605, 190, 55)
    d.shape("d2", "resolvable\nbefore cutoff?", "decision", 730, 595, 185, 95)
    d.shape("park", "Park to the next\nbilling period", "action", 980, 610, 190, 55)
    d.shape("bill", "Generate bills", "action", 100, 700, 200, 50)
    d.shape("recon", "Reconcile bills\nagainst the ledger", "action", 100, 780, 210, 55)
    d.shape("d3", "reconciled?", "decision", 120, 870, 175, 85)
    d.shape("invest", "Investigate the\nvariance", "action", 470, 880, 190, 55)
    d.shape("issue", "Issue invoices\nand notify customers", "action", 100, 985, 220, 55)
    d.shape("close", "Close the period", "action", 100, 1070, 200, 50)
    d.shape("end", "", "end", 175, 1150, 40, 40)
    d.flow("start", "freeze")
    d.flow("freeze", "fork")
    d.flow("fork", "mediate")
    d.flow("fork", "tariff")
    d.flow("fork", "acct")
    d.flow("mediate", "join")
    d.flow("tariff", "join")
    d.flow("acct", "join")
    d.flow("join", "rate")
    d.flow("rate", "d1")
    d.flow("d1", "fix", "[yes]")
    d.flow("fix", "d2")
    d.flow("d2", "rate", "[yes: re-rate]")
    d.flow("d2", "park", "[no]")
    d.flow("park", "bill")
    d.flow("d1", "bill", "[no]")
    d.flow("bill", "recon")
    d.flow("recon", "d3")
    d.flow("d3", "invest", "[no]")
    d.flow("invest", "recon")
    d.flow("d3", "issue", "[yes]")
    d.flow("issue", "close")
    d.flow("close", "end")
    d.legend(PROCESS_LEGEND, x=980, y=850)
    return d.xml()


CFG84_Q = """\
"Drummond Telecom" - Month-End Billing Close

Drummond's billing close overruns because rating exceptions are chased \
indefinitely. Model the process, including what happens when they cannot be \
fixed in time.

a) The usage collection window is frozen.
b) Three preparation activities then run: mediating and deduplicating the usage, \
loading the tariff effective for the period, and refreshing customer account \
status. They are independent and may run in any order or at the same time; rating \
starts only when all three are complete.
c) The usage is rated.
d) If rating exceptions arise they are resolved, and the team asks whether they \
can be resolved before the cutoff.
e) If they can, the usage is re-rated. If they cannot, the affected usage is \
parked to the next billing period and the close continues without it.
f) Bills are generated and reconciled against the ledger.
g) If they do not reconcile, the variance is investigated and reconciliation is \
attempted again -- rating is NOT repeated.
h) Once reconciled, invoices are issued and customers notified, the period is \
closed, and the process ends."""

CFG84_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (h) as an activity.
3. Model requirement (b) with a fork and a join, and explain in one sentence \
what the join guarantees before any usage is rated.
4. Label EVERY decision branch with its guard, and show both loops returning to \
their correct activities.
5. Requirement (e) is what stops the overrun described in the opening paragraph. \
Explain in one sentence what parking the usage costs the business, and why that \
is preferable to holding the close open."""


# ------------------------------------------------------------ cfg 85, ERD
def service_operations_records():
    d = Diagram("Drummond Telecom - Service Operations Records",
                "Entity-relationship diagram (model answer)")
    d.node("customer", "Customer", ["PK customerId: String", "name: String",
                                    "segment: String", "joinedOn: Date"], 40, 90)
    d.node("account", "Account", ["PK accountId: String", "FK customerId: String",
                                  "accountNumber: String", "status: String",
                                  "openedOn: Date"], 320, 90)
    d.node("subs", "Subscription", ["PK subscriptionId: String", "FK accountId: String",
                                    "FK productId: String", "startedOn: Date",
                                    "endedOn: Date"], 620, 90)
    d.node("product", "Product", ["PK productId: String", "name: String",
                                  "productType: String",
                                  "monthlyPrice: double"], 900, 90)
    d.node("service", "ServiceInstance", ["PK serviceInstanceId: String",
                                          "FK subscriptionId: String",
                                          "FK siteId: String", "identifier: String",
                                          "activatedOn: Date"], 620, 320)
    d.node("site", "Site", ["PK siteId: String", "FK customerId: String",
                            "address: String", "postcode: String"], 320, 320)
    d.node("ticket", "ServiceTicket", ["PK ticketId: String",
                                       "FK serviceInstanceId: String",
                                       "FK categoryId: String", "raisedOn: Date",
                                       "closedOn: Date", "priority: String"],
           620, 540)
    d.node("category", "TicketCategory", ["PK categoryId: String", "name: String",
                                          "targetHours: int"], 900, 540)
    d.node("activity", "TicketActivity", ["PK activityId: String", "FK ticketId: String",
                                          "FK engineerId: String",
                                          "occurredAt: Date", "notes: String"],
           320, 540)
    d.node("engineer", "Engineer", ["PK engineerId: String", "fullName: String",
                                    "skillLevel: String"], 40, 540)
    d.node("breach", "SlaBreach", ["PK breachId: String", "FK ticketId: String",
                                   "detectedOn: Date", "hoursOver: double",
                                   "creditAmount: double"], 900, 320)
    d.edge("customer", "account", "comp", "holds", "1", "1..*")
    d.edge("account", "subs", "comp", "takes", "1", "0..*")
    d.edge("product", "subs", "assoc", "is subscribed as", "1", "0..*")
    d.edge("subs", "service", "comp", "is provisioned as", "1", "0..*")
    d.edge("customer", "site", "comp", "occupies", "1", "1..*")
    d.edge("site", "service", "assoc", "is served at", "1", "0..*")
    d.edge("service", "ticket", "comp", "attracts", "1", "0..*")
    d.edge("category", "ticket", "assoc", "classifies", "1", "0..*")
    d.edge("ticket", "activity", "comp", "records", "1", "0..*")
    d.edge("engineer", "activity", "assoc", "performs", "1", "0..*")
    d.edge("ticket", "breach", "comp", "may raise", "1", "0..1")
    d.legend(ERD_LEGEND, x=40, y=320)
    return d.xml()


CFG85_Q = """\
"Drummond Telecom" - Service Operations Records

Drummond cannot tell a customer which of their services a fault affects, or \
what credit is owed for a missed target. Model the data.

a) A customer has a name, a segment and a join date, and holds one or more \
accounts. An account belongs to exactly one customer and does not survive it.
b) An account takes any number of subscriptions. A subscription records a start \
date and an end date, which is empty while it is active, and names exactly one \
product.
c) A product has a name, a type and a monthly price. Products are a catalogue \
and outlive any subscription.
d) A customer occupies one or more sites, each with an address and a postcode. A \
site belongs to exactly one customer.
e) A subscription is provisioned as any number of service instances, each with \
an identifier and an activation date, and each served at exactly one site.
f) A ticket category has a name and a target resolution time in hours. \
Categories are a standing list.
g) A service instance attracts any number of service tickets. A ticket is \
classified by exactly one category and records when it was raised, when it was \
closed (empty while open) and a priority.
h) A ticket records any number of ticket activities, each performed by exactly \
one engineer with a timestamp and notes. Engineers remain on file after a ticket \
closes.
i) A ticket may raise at most one SLA breach, recording the detection date, the \
hours over target and the credit amount."""

CFG85_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Answer the first question in the opening paragraph: trace on your diagram the \
path from a service ticket to the customer's other affected services, naming \
every entity crossed.
4. Answer the second: name the entities and attributes you would use to compute \
the credit owed, and state which cardinality makes "no breach" expressible.
5. Requirements (b) and (g) both have a date that is empty while something is \
still open. State what that means for those columns, and one report you can \
write from each."""


# ------------------------------------------------------ cfg 86, FLOWCHART
def change_deployment():
    d = Diagram("Drummond Telecom - Change Deployment to Production",
                "Flowchart (model answer)")
    d.shape("s", "Start: change approved", "terminator", 70, 90, 230, 50)
    d.shape("window", "Confirm the\nchange window", "action", 90, 175, 200, 55)
    d.shape("d1", "window\navailable?", "decision", 110, 265, 170, 90)
    d.shape("resched", "Reschedule the\nchange", "action", 440, 280, 190, 55)
    d.shape("backup", "Take a rollback\nsnapshot", "action", 90, 385, 200, 55)
    d.shape("deploy", "Deploy to\nproduction", "action", 90, 465, 200, 50)
    d.shape("smoke", "Run the smoke\ntests", "action", 90, 545, 200, 55)
    d.shape("d2", "smoke tests\npassed?", "decision", 110, 635, 170, 90)
    d.shape("d3", "fixable in\nthe window?", "decision", 440, 625, 180, 95)
    d.shape("hotfix", "Apply a\nhotfix", "action", 700, 640, 180, 55)
    d.shape("roll", "Roll back to\nthe snapshot", "action", 700, 750, 180, 55)
    d.shape("monitor", "Monitor for the\nsoak period", "action", 90, 755, 200, 55)
    d.shape("d4", "stable through\nthe soak?", "decision", 105, 845, 185, 95)
    d.shape("close", "Close the change\nrecord", "action", 90, 970, 200, 55)
    d.shape("pir", "Hold a post-\nimplementation review", "action", 90, 1050, 220, 55)
    d.shape("e", "End", "terminator", 120, 1140, 140, 45)
    d.flow("s", "window")
    d.flow("window", "d1")
    d.flow("d1", "resched", "[no]")
    d.flow("resched", "window")
    d.flow("d1", "backup", "[yes]")
    d.flow("backup", "deploy")
    d.flow("deploy", "smoke")
    d.flow("smoke", "d2")
    d.flow("d2", "d3", "[no]")
    d.flow("d3", "hotfix", "[yes]")
    d.flow("hotfix", "smoke")
    d.flow("d3", "roll", "[no]")
    d.flow("roll", "pir")
    d.flow("d2", "monitor", "[yes]")
    d.flow("monitor", "d4")
    d.flow("d4", "roll", "[no]")
    d.flow("d4", "close", "[yes]")
    d.flow("close", "pir")
    d.flow("pir", "e")
    d.legend(PROCESS_LEGEND, x=950, y=300)
    return d.xml()


CFG86_Q = """\
"Drummond Telecom" - Change Deployment to Production

Drummond has twice been unable to roll a failed change back because no snapshot \
was taken. Model the deployment process so that cannot happen.

a) The process starts with an approved change. The change window is confirmed.
b) If the window is not available the change is rescheduled and the window is \
confirmed again.
c) A rollback snapshot is taken BEFORE anything is deployed.
d) The change is deployed to production and the smoke tests are run.
e) If the smoke tests fail, the team asks whether the fault is fixable within \
the remaining window. If it is, a hotfix is applied and the smoke tests are run \
again.
f) If it is not fixable in the window, the change is rolled back to the \
snapshot.
g) If the smoke tests pass, the change is monitored for a soak period.
h) If it is not stable through the soak, it is rolled back on the same path as \
requirement (f).
i) If it is stable, the change record is closed.
j) A post-implementation review is held whether the change succeeded or was \
rolled back, and the process ends."""

CFG86_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (j) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (c) fixes the problem in the opening paragraph. State where the \
snapshot step must sit relative to the deployment step, and what requirements \
(f) and (h) would be unable to do if it sat anywhere else.
5. Requirements (f), (h) and (j) all converge. Show the rollback drawn once with \
two branches reaching it, and the review drawn once with both outcomes reaching \
it, rather than duplicating either."""


# ------------------------------------------------------- cfg 87, USE_CASE
def service_desk_use_cases():
    d = Diagram("Drummond Telecom - Service Desk Use Cases",
                "UML use case diagram (model answer)")
    d.shape("bound", "Service Desk System", "boundary", 340, 90, 520, 700)
    d.shape("customer", "Customer", "actor", 130, 190, 40, 70)
    d.shape("agent", "Service Desk Agent", "actor", 130, 380, 40, 70)
    d.shape("engineer", "Field Engineer", "actor", 130, 570, 40, 70)
    d.shape("manager", "Service Manager", "actor", 990, 250, 40, 70)
    d.shape("billing", "Billing System", "actor", 990, 500, 40, 70)
    d.shape("raise", "Raise a fault report", "usecase", 400, 150, 200, 60)
    d.shape("track", "Track ticket progress", "usecase", 400, 240, 200, 60)
    d.shape("triage", "Triage the ticket", "usecase", 400, 340, 200, 60)
    d.shape("diag", "Run remote diagnostics", "usecase", 620, 340, 200, 60)
    d.shape("dispatch", "Dispatch an engineer", "usecase", 400, 440, 200, 60)
    d.shape("visit", "Record a site visit", "usecase", 400, 540, 200, 60)
    d.shape("close", "Close the ticket", "usecase", 400, 640, 200, 60)
    d.shape("notify", "Notify the customer", "usecase", 620, 640, 200, 60)
    d.shape("credit", "Raise an SLA credit", "usecase", 620, 540, 200, 60)
    d.shape("report", "Review SLA performance", "usecase", 620, 240, 200, 60)
    d.edge("customer", "raise", "assoc")
    d.edge("customer", "track", "assoc")
    d.edge("agent", "triage", "assoc")
    d.edge("agent", "dispatch", "assoc")
    d.edge("agent", "close", "assoc")
    d.edge("engineer", "visit", "assoc")
    d.edge("manager", "report", "assoc")
    d.edge("credit", "billing", "assoc")
    d.edge("triage", "diag", "dep", "<<include>>")
    d.edge("close", "notify", "dep", "<<include>>")
    d.edge("credit", "close", "dep", "<<extend>>")
    d.edge("dispatch", "visit", "dep", "<<include>>")
    d.legend(USECASE_LEGEND, x=60, y=700)
    return d.xml()


CFG87_Q = """\
"Drummond Telecom" - Service Desk Use Cases

Drummond is specifying who does what in its new service desk, and who sits \
outside the system. Model it.

a) A customer raises a fault report and tracks the progress of their ticket.
b) A service desk agent triages the ticket, dispatches an engineer and closes \
the ticket.
c) A field engineer records a site visit.
d) A service manager reviews SLA performance.
e) Triaging a ticket ALWAYS runs remote diagnostics as part of it. It is never \
triaged without them.
f) Closing a ticket ALWAYS notifies the customer.
g) Closing a ticket raises an SLA credit ONLY when the resolution target was \
missed. Most closures do not.
h) Dispatching an engineer ALWAYS results in a site visit being recorded.
i) The billing system is a separate system that receives SLA credits. It is not \
part of the service desk, and no person uses it here."""

CFG87_I = """\
1. Draw the system boundary and place every use case inside it and every actor \
outside it.
2. Draw an association line from each actor to the use cases they take part in.
3. Requirements (e), (f) and (h) are always performed; requirement (g) is \
conditional. Mark the first three <<include>> and the last <<extend>>, with the \
dashed arrow pointing the correct way in each case.
4. Requirement (i) describes a system, not a person. Explain in one sentence why \
it is still drawn as an actor, and what it would mean to draw it inside the \
boundary instead.
5. State in one sentence the difference between <<include>> and <<extend>>, and \
say what would be wrong with modelling requirement (g) as an <<include>>."""


# ----------------------------------------------- cfg 88, ACTIVITY_DIAGRAM
def kpi_definition_activity():
    d = Diagram("Defining a New KPI",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 165, 90, 40, 40)
    d.shape("obj", "Identify the objective\nthe KPI serves", "action", 90, 165, 215, 55)
    d.shape("d0", "objective\nmeasurable?", "decision", 110, 255, 180, 90)
    d.shape("restate", "Restate the\nobjective", "action", 450, 270, 190, 55)
    d.shape("define", "Define the metric\nand its formula", "action", 90, 375, 210, 55)
    d.shape("fork", "", "bar", 440, 460, 10, 200)
    d.shape("source", "Identify the\ndata source", "action", 85, 480, 200, 55)
    d.shape("base", "Establish a\nbaseline", "action", 490, 480, 190, 55)
    d.shape("owner", "Appoint a\nmetric owner", "action", 490, 570, 190, 55)
    d.shape("join", "", "bar", 440, 685, 10, 200)
    d.shape("target", "Set the target\nand threshold", "action", 90, 705, 210, 55)
    d.shape("d1", "target\nachievable?", "decision", 110, 795, 180, 90)
    d.shape("renegotiate", "Renegotiate with\nthe objective owner", "action",
            450, 810, 210, 55)
    d.shape("pilot", "Pilot for one\nperiod", "action", 90, 915, 200, 55)
    d.shape("d2", "metric behaves\nas expected?", "decision", 100, 1005, 200, 95)
    d.shape("adjust", "Adjust the formula\nor the source", "action", 460, 1020, 200, 55)
    d.shape("publish", "Publish to the\nscorecard", "action", 90, 1130, 200, 55)
    d.shape("end", "", "end", 165, 1215, 40, 40)
    d.flow("start", "obj")
    d.flow("obj", "d0")
    d.flow("d0", "restate", "[no]")
    d.flow("restate", "obj")
    d.flow("d0", "define", "[yes]")
    d.flow("define", "fork")
    d.flow("fork", "source")
    d.flow("fork", "base")
    d.flow("fork", "owner")
    d.flow("source", "join")
    d.flow("base", "join")
    d.flow("owner", "join")
    d.flow("join", "target")
    d.flow("target", "d1")
    d.flow("d1", "renegotiate", "[no]")
    d.flow("renegotiate", "target")
    d.flow("d1", "pilot", "[yes]")
    d.flow("pilot", "d2")
    d.flow("d2", "adjust", "[no]")
    d.flow("adjust", "define")
    d.flow("d2", "publish", "[yes]")
    d.flow("publish", "end")
    d.legend(PROCESS_LEGEND, x=720, y=950)
    return d.xml()


CFG88_Q = """\
Defining a New Key Performance Indicator

A performance manager is documenting how a new KPI is created, so that no \
measure reaches the scorecard without a target, an owner and a data source.

a) The objective the KPI serves is identified.
b) If the objective is not measurable as stated, it is restated and identified \
again. This may happen any number of times.
c) Once it is measurable, the metric and its formula are defined.
d) Three activities then run: identifying the data source, establishing a \
baseline, and appointing a metric owner. They are independent and may be done in \
any order or at the same time; the target is set only when all three are \
complete.
e) The target and its threshold are set.
f) If the target is not achievable, it is renegotiated with the objective owner \
and set again.
g) The metric is piloted for one period.
h) If it does not behave as expected, the formula or the data source is \
adjusted, and the definition step is repeated.
i) When it behaves as expected it is published to the scorecard, and the process \
ends."""

CFG88_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (i) as an activity.
3. Model requirement (d) with a fork and a join, and explain in one sentence \
what the join guarantees before a target is set.
4. Label EVERY decision branch with its guard, and show all three loops \
returning to the correct activity.
5. Requirement (h) loops back further than requirement (f) does. Explain in one \
sentence why an unachievable target is a cheaper problem than a \
misbehaving metric, and what requirement (g) is protecting the scorecard from."""


# ------------------------------------------------------ cfg 89, FLOWCHART
def requirements_documentation_flow():
    d = Diagram("Producing a Requirements Document",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 120, 90, 140, 45)
    d.shape("audience", "Identify the audience\nand its purpose", "action",
            80, 165, 215, 55)
    d.shape("template", "Select the standard\ntemplate", "action", 80, 250, 215, 55)
    d.shape("gather", "Assemble the agreed\nrequirements", "action", 80, 335, 215, 55)
    d.shape("write", "Write each requirement\nin the standard form", "action",
            80, 420, 230, 60)
    d.shape("d1", "each one atomic,\ntestable and\nunambiguous?", "decision",
            75, 510, 210, 110)
    d.shape("rewrite", "Rewrite the\nfailing statements", "action", 450, 530, 200, 55)
    d.shape("trace", "Add traceability to\nthe source", "action", 80, 650, 215, 55)
    d.shape("d2", "every requirement\ntraced?", "decision", 75, 740, 210, 95)
    d.shape("find", "Find or record\nthe source", "action", 450, 755, 190, 55)
    d.shape("review", "Circulate for\nstakeholder review", "action", 80, 865, 215, 55)
    d.shape("d3", "agreed?", "decision", 100, 955, 170, 85)
    d.shape("revise", "Revise the\ndocument", "action", 450, 965, 190, 55)
    d.shape("base", "Baseline and\nissue a version", "action", 80, 1075, 215, 55)
    d.shape("e", "End", "terminator", 120, 1160, 140, 45)
    d.flow("s", "audience")
    d.flow("audience", "template")
    d.flow("template", "gather")
    d.flow("gather", "write")
    d.flow("write", "d1")
    d.flow("d1", "rewrite", "[no]")
    d.flow("rewrite", "write")
    d.flow("d1", "trace", "[yes]")
    d.flow("trace", "d2")
    d.flow("d2", "find", "[no]")
    d.flow("find", "trace")
    d.flow("d2", "review", "[yes]")
    d.flow("review", "d3")
    d.flow("d3", "revise", "[no]")
    d.flow("revise", "write")
    d.flow("d3", "base", "[yes]")
    d.flow("base", "e")
    d.legend(PROCESS_LEGEND, x=720, y=300)
    return d.xml()


CFG89_Q = """\
Producing a Requirements Document

A business analyst is documenting how a requirements document is produced, so \
that every statement in it is testable and traceable.

a) The audience and the document's purpose are identified, and the standard \
template selected.
b) The agreed requirements are assembled, and each is written in the standard \
form.
c) Each statement is checked against three criteria: it must be atomic, \
testable and unambiguous. Any statement failing one of them is rewritten and \
checked again. This may happen any number of times.
d) Traceability is added, linking each requirement back to its source.
e) If any requirement has no traceable source, the source is found or recorded, \
and traceability is checked again.
f) The document is circulated for stakeholder review.
g) If it is not agreed, the document is revised and the statements are written \
again -- the revision goes back to the writing step, not straight to review.
h) When it is agreed, the document is baselined and a version issued, and the \
process ends."""

CFG89_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (h) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (c) names three criteria in one decision. State in one sentence \
what "atomic" and "testable" each rule out, and give an example statement that \
fails one of them.
5. Requirements (c), (e) and (g) all loop to different places. Show all three, \
and explain in one sentence why a rejected review returns to writing rather than \
to assembling the requirements."""


# ------------------------------------------------------ cfg 90, FLOWCHART
def rfi_process():
    d = Diagram("Issuing a Request for Information",
                "Flowchart (model answer)")
    d.shape("s", "Start: need identified", "terminator", 70, 90, 230, 50)
    d.shape("d0", "requirement\nalready understood?", "decision", 75, 175, 220, 100)
    d.shape("rfp", "Proceed to an RFP\ninstead", "action", 450, 190, 200, 55)
    d.shape("scope", "Define the\ninformation needed", "action", 85, 300, 200, 55)
    d.shape("draft", "Draft the RFI\nand its questions", "action", 85, 385, 200, 55)
    d.shape("d1", "questions\nnon-leading and\nanswerable?", "decision",
            70, 475, 220, 110)
    d.shape("fix", "Rewrite the\nquestions", "action", 450, 500, 190, 55)
    d.shape("list", "Identify the\nsupplier list", "action", 85, 615, 200, 55)
    d.shape("issue", "Issue the RFI\nwith a deadline", "action", 85, 700, 200, 55)
    d.shape("clarify", "Answer clarification\nquestions in writing", "action",
            450, 700, 220, 60)
    d.shape("d2", "deadline\nreached?", "decision", 100, 790, 170, 90)
    d.shape("wait", "Continue to\nreceive responses", "action", 450, 805, 200, 55)
    d.shape("d3", "enough usable\nresponses?", "decision", 90, 900, 190, 95)
    d.shape("extend", "Extend the deadline\nor widen the list", "action",
            450, 915, 210, 55)
    d.shape("eval", "Evaluate and\nsummarise findings", "action", 85, 1015, 200, 55)
    d.shape("decide", "Decide whether to\nproceed to an RFP", "action", 85, 1100, 210, 55)
    d.shape("e", "End", "terminator", 115, 1185, 140, 45)
    d.flow("s", "d0")
    d.flow("d0", "rfp", "[yes: no RFI needed]")
    d.flow("rfp", "e")
    d.flow("d0", "scope", "[no]")
    d.flow("scope", "draft")
    d.flow("draft", "d1")
    d.flow("d1", "fix", "[no]")
    d.flow("fix", "draft")
    d.flow("d1", "list", "[yes]")
    d.flow("list", "issue")
    d.flow("issue", "clarify")
    d.flow("clarify", "d2")
    d.flow("d2", "wait", "[no]")
    d.flow("wait", "clarify")
    d.flow("d2", "d3", "[yes]")
    d.flow("d3", "extend", "[no]")
    d.flow("extend", "issue")
    d.flow("d3", "eval", "[yes]")
    d.flow("eval", "decide")
    d.flow("decide", "e")
    d.legend(PROCESS_LEGEND, x=740, y=350)
    return d.xml()


CFG90_Q = """\
Issuing a Request for Information

A procurement lead is documenting when an RFI is used and how it is run, so \
that it is not confused with a request for proposal.

a) The process starts when a need is identified. The team asks whether the \
requirement is already understood.
b) If it is already understood, no RFI is needed and the team proceeds directly \
to an RFP; the process ends there.
c) If it is not, the information needed is defined and the RFI and its questions \
are drafted.
d) The questions are checked to be non-leading and answerable. Any that are not \
are rewritten and checked again.
e) The supplier list is identified and the RFI issued with a response deadline.
f) Clarification questions from suppliers are answered in writing so that every \
supplier sees the same answer.
g) Until the deadline is reached, responses continue to be received and \
clarifications continue to be answered.
h) At the deadline the team asks whether there are enough usable responses. If \
not, the deadline is extended or the supplier list widened, and the RFI is \
issued again.
i) With enough responses, the findings are evaluated and summarised, and a \
decision is made on whether to proceed to an RFP. The process then ends."""

CFG90_I = """\
1. Draw the flowchart with one start terminator and one end terminator -- \
requirement (b) also terminates, so route it to the same end.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (a) is the decision that separates an RFI from an RFP. State in \
one sentence what each instrument is for, and what it costs a buyer to issue an \
RFP when the requirement is not yet understood.
5. Requirement (f) says clarifications are answered so every supplier sees the \
same answer. Explain in one sentence what procurement principle that protects, \
and what would be at risk if one supplier were answered privately."""


# ------------------------------------------------------ cfg 91, FLOWCHART
def business_plan_flow():
    d = Diagram("Developing a Business Plan",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 120, 90, 140, 45)
    d.shape("idea", "State the business\nidea and its value", "action", 80, 165, 215, 55)
    d.shape("market", "Research the market\nand competitors", "action", 80, 250, 215, 55)
    d.shape("d1", "market\nlarge enough?", "decision", 80, 340, 205, 90)
    d.shape("pivot", "Refine or pivot\nthe idea", "action", 450, 355, 190, 55)
    d.shape("model", "Define the business\nand revenue model", "action", 80, 460, 215, 55)
    d.shape("ops", "Plan operations and\nresources", "action", 80, 545, 215, 55)
    d.shape("fin", "Build the financial\nforecast", "action", 80, 630, 215, 55)
    d.shape("d2", "breaks even\nwithin the horizon?", "decision", 70, 720, 230, 100)
    d.shape("adjust", "Adjust pricing, cost\nor scope", "action", 450, 740, 200, 55)
    d.shape("risk", "Assess risks and\nmitigations", "action", 80, 855, 215, 55)
    d.shape("write", "Write the plan and\nexecutive summary", "action", 80, 940, 215, 55)
    d.shape("rev", "Review with mentors\nor the board", "action", 80, 1025, 215, 55)
    d.shape("d3", "approved for\nfunding?", "decision", 85, 1115, 200, 90)
    d.shape("revise", "Revise the plan", "action", 450, 1130, 190, 50)
    d.shape("exec", "Execute and\nmonitor against plan", "action", 80, 1235, 215, 55)
    d.shape("e", "End", "terminator", 120, 1320, 140, 45)
    d.flow("s", "idea")
    d.flow("idea", "market")
    d.flow("market", "d1")
    d.flow("d1", "pivot", "[no]")
    d.flow("pivot", "idea")
    d.flow("d1", "model", "[yes]")
    d.flow("model", "ops")
    d.flow("ops", "fin")
    d.flow("fin", "d2")
    d.flow("d2", "adjust", "[no]")
    d.flow("adjust", "model")
    d.flow("d2", "risk", "[yes]")
    d.flow("risk", "write")
    d.flow("write", "rev")
    d.flow("rev", "d3")
    d.flow("d3", "revise", "[no]")
    d.flow("revise", "write")
    d.flow("d3", "exec", "[yes]")
    d.flow("exec", "e")
    d.legend(PROCESS_LEGEND, x=740, y=400)
    return d.xml()


CFG91_Q = """\
Developing a Business Plan

A founder is documenting how a business plan is built, so that the financial \
forecast is tested against the business model rather than written to fit it.

a) The business idea and the value it offers are stated.
b) The market and its competitors are researched.
c) If the market is not large enough, the idea is refined or pivoted, and it is \
stated again. This may happen any number of times.
d) With a large enough market, the business and revenue model is defined, then \
operations and resources are planned, then the financial forecast is built.
e) If the forecast does not break even within the planning horizon, pricing, \
cost or scope is adjusted and the business model is defined again -- the \
forecast is NOT simply rewritten.
f) Once it breaks even, risks and mitigations are assessed.
g) The plan and its executive summary are written and reviewed with mentors or \
the board.
h) If it is not approved for funding, the plan is revised and written again.
i) Once approved, the plan is executed and monitored against, and the process \
ends."""

CFG91_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (e) is the point of the whole process. Explain in one sentence \
why a failed forecast sends the founder back to the business model rather than \
to the forecast, and what the opening paragraph means by "written to fit it".
5. Requirements (c), (e) and (h) loop to three different places. Show all three, \
and state which of them is the most expensive to hit and why."""


# ------------------------------------------------------ cfg 92, FLOWCHART
def technical_presentation_flow():
    d = Diagram("Preparing and Delivering a Technical Presentation",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 120, 90, 140, 45)
    d.shape("aud", "Analyse the audience\nand its technical level", "action",
            75, 165, 230, 60)
    d.shape("obj", "State the single\nobjective", "action", 80, 255, 215, 55)
    d.shape("d1", "objective achievable\nin the time?", "decision", 70, 345, 230, 100)
    d.shape("cut", "Narrow the\nscope", "action", 460, 365, 180, 55)
    d.shape("struct", "Structure the message\nand the evidence", "action",
            80, 475, 220, 55)
    d.shape("slides", "Build slides and\nvisual aids", "action", 80, 560, 215, 55)
    d.shape("d2", "visuals readable\nfrom the back?", "decision", 70, 650, 230, 100)
    d.shape("simplify", "Simplify the\nvisuals", "action", 460, 670, 180, 55)
    d.shape("rehearse", "Rehearse against\nthe clock", "action", 80, 780, 215, 55)
    d.shape("d3", "within the\ntime slot?", "decision", 85, 870, 200, 90)
    d.shape("trim", "Cut content, not\nrehearsal time", "action", 460, 885, 200, 55)
    d.shape("check", "Check the room\nand equipment", "action", 80, 990, 215, 55)
    d.shape("deliver", "Deliver the\npresentation", "action", 80, 1075, 215, 50)
    d.shape("qa", "Take questions", "action", 80, 1155, 215, 50)
    d.shape("d4", "question outside\nthe scope?", "decision", 75, 1235, 220, 95)
    d.shape("defer", "Take it offline\nand follow up", "action", 460, 1250, 200, 55)
    d.shape("close", "Close with the\nkey message", "action", 80, 1360, 215, 55)
    d.shape("e", "End", "terminator", 120, 1445, 140, 45)
    d.flow("s", "aud")
    d.flow("aud", "obj")
    d.flow("obj", "d1")
    d.flow("d1", "cut", "[no]")
    d.flow("cut", "obj")
    d.flow("d1", "struct", "[yes]")
    d.flow("struct", "slides")
    d.flow("slides", "d2")
    d.flow("d2", "simplify", "[no]")
    d.flow("simplify", "slides")
    d.flow("d2", "rehearse", "[yes]")
    d.flow("rehearse", "d3")
    d.flow("d3", "trim", "[no]")
    d.flow("trim", "struct")
    d.flow("d3", "check", "[yes]")
    d.flow("check", "deliver")
    d.flow("deliver", "qa")
    d.flow("qa", "d4")
    d.flow("d4", "defer", "[yes]")
    d.flow("defer", "close")
    d.flow("d4", "close", "[no: answer now]")
    d.flow("close", "e")
    d.legend(PROCESS_LEGEND, x=730, y=400)
    return d.xml()


CFG92_Q = """\
Preparing and Delivering a Technical Presentation

A team lead is documenting how a technical presentation is prepared, so that it \
fits its slot and its audience rather than the speaker's material.

a) The audience and its technical level are analysed, and a single objective is \
stated.
b) If the objective cannot be achieved in the time available, the scope is \
narrowed and the objective restated.
c) The message and its supporting evidence are structured, and slides and visual \
aids are built.
d) If the visuals are not readable from the back of the room, they are \
simplified and rebuilt.
e) The presentation is rehearsed against the clock.
f) If it does not fit the time slot, content is cut -- not rehearsal time -- and \
the message is structured again.
g) The room and equipment are checked, and the presentation delivered.
h) Questions are taken. A question outside the scope is taken offline with a \
follow-up rather than answered at length.
i) The presentation closes with the key message, and the process ends."""

CFG92_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (i) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (f) says cut content, not rehearsal time, and returns to \
structuring rather than to rehearsing. Explain in one sentence why both of those \
choices matter.
5. Requirement (h) has two branches that rejoin at the close. Show them \
converging on one activity, and state in one sentence what taking an \
out-of-scope question at length costs the audience."""


# ------------------------------------------------------------ cfg 93, ERD
def project_management_model():
    d = Diagram("Ravensworth Consulting - Project Management Records",
                "Entity-relationship diagram (model answer)")
    d.node("portfolio", "Portfolio", ["PK portfolioId: String", "name: String",
                                      "FK sponsorId: String"], 40, 90)
    d.node("project", "Project", ["PK projectId: String", "FK portfolioId: String",
                                  "FK managerId: String", "name: String",
                                  "startsOn: Date", "endsOn: Date",
                                  "status: String"], 320, 90)
    d.node("person", "Person", ["PK personId: String", "fullName: String",
                                "grade: String", "dayRate: double"], 40, 320)
    d.node("phase", "Phase", ["PK phaseId: String", "FK projectId: String",
                              "name: String", "ordinal: int"], 620, 90)
    d.node("task", "Task", ["PK taskId: String", "FK phaseId: String",
                            "name: String", "plannedDays: double",
                            "percentComplete: double"], 620, 300)
    d.node("dep", "TaskDependency", ["PK dependencyId: String",
                                     "FK predecessorTaskId: String",
                                     "FK successorTaskId: String",
                                     "dependencyType: String", "lagDays: double"],
           900, 300)
    d.node("assign", "Assignment", ["PK assignmentId: String", "FK taskId: String",
                                    "FK personId: String", "allocationPercent: double",
                                    "fromDate: Date", "toDate: Date"], 320, 320)
    d.node("timesheet", "TimesheetEntry", ["PK entryId: String",
                                           "FK assignmentId: String",
                                           "workedOn: Date", "hours: double"],
           320, 560)
    d.node("milestone", "Milestone", ["PK milestoneId: String", "FK phaseId: String",
                                      "name: String", "dueOn: Date",
                                      "achievedOn: Date"], 900, 90)
    d.node("risk", "ProjectRisk", ["PK riskId: String", "FK projectId: String",
                                   "FK ownerId: String", "description: String",
                                   "likelihood: int", "impact: int"], 620, 540)
    d.node("deliverable", "Deliverable", ["PK deliverableId: String",
                                          "FK phaseId: String", "name: String",
                                          "acceptedOn: Date"], 900, 540)
    d.edge("portfolio", "project", "comp", "contains", "1", "1..*")
    d.edge("person", "project", "assoc", "manages", "1", "0..*")
    d.edge("project", "phase", "comp", "is divided into", "1", "1..*")
    d.edge("phase", "task", "comp", "contains", "1", "1..*")
    d.edge("task", "dep", "assoc", "precedes in", "1", "0..*")
    d.edge("task", "assign", "comp", "is staffed by", "1", "0..*")
    d.edge("person", "assign", "assoc", "takes", "1", "0..*")
    d.edge("assign", "timesheet", "comp", "is booked to", "1", "0..*")
    d.edge("phase", "milestone", "comp", "marks", "1", "0..*")
    d.edge("project", "risk", "comp", "carries", "1", "0..*")
    d.edge("person", "risk", "assoc", "owns", "1", "0..*")
    d.edge("phase", "deliverable", "comp", "produces", "1", "1..*")
    d.legend(ERD_LEGEND, x=40, y=560)
    return d.xml()


CFG93_Q = """\
"Ravensworth Consulting" - Project Management Records

Ravensworth cannot tell whether a project is late until the end, because \
planned effort and actual effort are held in different spreadsheets. Model the \
data.

a) A portfolio has a name and a sponsor, and contains one or more projects. A \
project belongs to exactly one portfolio and does not survive it.
b) A person has a name, a grade and a day rate. People remain on file after \
projects close.
c) A project is managed by exactly one person, has a name, planned start and end \
dates and a status.
d) A project is divided into one or more phases, each with a name and an \
ordinal. A phase cannot exist without its project.
e) A phase contains one or more tasks, each with a name, planned days and a \
percentage complete.
f) A task may precede any number of other tasks. Each dependency records its \
type (finish-to-start and so on) and a lag in days.
g) A task is staffed by any number of assignments. Each names one person with an \
allocation percentage and a date range.
h) An assignment is booked to any number of timesheet entries, each with a date \
worked and hours.
i) A phase marks any number of milestones, each with a name, a due date and an \
achieved date that is empty until it is achieved.
j) A phase produces one or more deliverables, each with a name and an acceptance \
date.
k) A project carries any number of risks, each owned by exactly one person with \
a description, likelihood and impact."""

CFG93_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (f) is a many-to-many relationship from Task to ITSELF. Resolve \
it, and name the two foreign keys so the predecessor and successor roles are \
distinguishable.
4. Answer the problem in the opening paragraph: name the two attributes -- one \
planned, one actual -- that you would compare to spot a late task, and trace the \
path between them on your diagram.
5. Requirement (i) has an achieved date that is empty until achieved. State what \
that means for the column, and one report you can write from that single column."""


# ------------------------------------------------------ cfg 94, FLOWCHART
def scheduling_flow():
    d = Diagram("Building and Levelling a Project Schedule",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 120, 90, 140, 45)
    d.shape("wbs", "Decompose scope into\na work breakdown", "action", 75, 165, 230, 60)
    d.shape("est", "Estimate duration\nfor each task", "action", 80, 255, 215, 55)
    d.shape("seq", "Sequence tasks and\nset dependencies", "action", 80, 340, 215, 55)
    d.shape("cpm", "Calculate the\ncritical path", "action", 80, 425, 215, 55)
    d.shape("d1", "meets the\nrequired end date?", "decision", 70, 515, 235, 100)
    d.shape("crash", "Crash or fast-track\nthe critical path", "action", 460, 535, 210, 55)
    d.shape("assign", "Assign resources\nto tasks", "action", 80, 645, 215, 55)
    d.shape("d2", "any resource\nover-allocated?", "decision", 70, 735, 235, 100)
    d.shape("level", "Level the\nresource", "action", 460, 755, 190, 55)
    d.shape("d3", "levelling moved\nthe end date?", "decision", 460, 865, 220, 100)
    d.shape("base", "Baseline the\nschedule", "action", 80, 875, 215, 55)
    d.shape("track", "Track progress against\nthe baseline", "action", 80, 990, 230, 60)
    d.shape("d4", "variance beyond\ntolerance?", "decision", 70, 1080, 235, 100)
    d.shape("replan", "Re-plan the\nremaining work", "action", 460, 1100, 200, 55)
    d.shape("d5", "project\ncomplete?", "decision", 80, 1200, 205, 90)
    d.shape("e", "End", "terminator", 120, 1320, 140, 45)
    d.flow("s", "wbs")
    d.flow("wbs", "est")
    d.flow("est", "seq")
    d.flow("seq", "cpm")
    d.flow("cpm", "d1")
    d.flow("d1", "crash", "[no]")
    d.flow("crash", "cpm")
    d.flow("d1", "assign", "[yes]")
    d.flow("assign", "d2")
    d.flow("d2", "level", "[yes]")
    d.flow("level", "d3")
    d.flow("d3", "cpm", "[yes: recalculate]")
    d.flow("d3", "d2", "[no]")
    d.flow("d2", "base", "[no]")
    d.flow("base", "track")
    d.flow("track", "d4")
    d.flow("d4", "replan", "[yes]")
    d.flow("replan", "seq")
    d.flow("d4", "d5", "[no]")
    d.flow("d5", "track", "[no]")
    d.flow("d5", "e", "[yes]")
    d.legend(PROCESS_LEGEND, x=750, y=250)
    return d.xml()


CFG94_Q = """\
Building and Levelling a Project Schedule

A project manager is documenting how a schedule is built, levelled and tracked, \
so that resource levelling is not allowed to silently move the end date.

a) The scope is decomposed into a work breakdown, each task is estimated, and \
the tasks are sequenced with their dependencies.
b) The critical path is calculated.
c) If the schedule does not meet the required end date, the critical path is \
crashed or fast-tracked and the critical path is recalculated.
d) Resources are assigned to tasks.
e) If any resource is over-allocated, that resource is levelled.
f) After levelling, the team asks whether the end date has moved. If it has, the \
critical path is recalculated from scratch. If it has not, the over-allocation \
check is repeated for the next resource.
g) When no resource is over-allocated, the schedule is baselined.
h) Progress is tracked against the baseline. If the variance goes beyond \
tolerance, the remaining work is re-planned, starting again from sequencing.
i) If the variance is within tolerance and the project is not complete, tracking \
continues.
j) When the project is complete the process ends."""

CFG94_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (j) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirement (f) is the point of the process. Explain in one sentence why \
levelling can move the end date, and what would go unnoticed if the schedule \
were baselined straight after levelling.
5. Requirement (h) re-plans from sequencing rather than from the work breakdown. \
State in one sentence what that assumes about the scope, and when that assumption \
would be wrong."""


# ------------------------------------------------------------ cfg 95, ERD
def system_requirements_records():
    d = Diagram("Ravensworth Consulting - System Requirements Management",
                "Entity-relationship diagram (model answer)")
    d.node("project", "Project", ["PK projectId: String", "name: String",
                                  "FK managerId: String", "status: String"], 40, 90)
    d.node("baseline", "RequirementBaseline", ["PK baselineId: String",
                                               "FK projectId: String", "label: String",
                                               "frozenOn: Date"], 320, 90)
    d.node("req", "SystemRequirement", ["PK requirementId: String",
                                        "FK projectId: String", "FK typeId: String",
                                        "reference: String", "text: String",
                                        "priority: String"], 620, 90)
    d.node("rtype", "RequirementType", ["PK typeId: String", "name: String",
                                        "isFunctional: boolean"], 900, 90)
    d.node("version", "RequirementVersion", ["PK versionId: String",
                                             "FK requirementId: String",
                                             "versionNumber: int", "text: String",
                                             "createdOn: Date"], 620, 300)
    d.node("content", "BaselineContent", ["PK contentId: String", "FK baselineId: String",
                                          "FK versionId: String"], 320, 300)
    d.node("parent", "RequirementLink", ["PK linkId: String",
                                         "FK parentRequirementId: String",
                                         "FK childRequirementId: String",
                                         "linkType: String"], 900, 300)
    d.node("cr", "ChangeRequest", ["PK changeRequestId: String",
                                   "FK requirementId: String", "FK raisedById: String",
                                   "raisedOn: Date", "reason: String",
                                   "status: String"], 40, 300)
    d.node("verif", "VerificationMethod", ["PK methodId: String", "name: String",
                                           "rigour: String"], 900, 540)
    d.node("plan", "VerificationPlan", ["PK planId: String", "FK requirementId: String",
                                        "FK methodId: String", "criteria: String"],
           620, 540)
    d.node("result", "VerificationResult", ["PK resultId: String", "FK planId: String",
                                            "executedOn: Date", "outcome: String",
                                            "evidenceRef: String"], 320, 540)
    d.edge("project", "baseline", "comp", "freezes as", "1", "0..*")
    d.edge("project", "req", "comp", "specifies", "1", "1..*")
    d.edge("rtype", "req", "assoc", "classifies", "1", "0..*")
    d.edge("req", "version", "comp", "is revised as", "1", "1..*")
    d.edge("baseline", "content", "comp", "includes", "1", "1..*")
    d.edge("version", "content", "assoc", "is included in", "1", "0..*")
    d.edge("req", "parent", "assoc", "is a parent in", "1", "0..*")
    d.edge("req", "cr", "comp", "is the subject of", "1", "0..*")
    d.edge("req", "plan", "comp", "is verified by", "1", "1..*")
    d.edge("verif", "plan", "assoc", "prescribes", "1", "0..*")
    d.edge("plan", "result", "comp", "yields", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=540)
    return d.xml()


CFG95_Q = """\
"Ravensworth Consulting" - System Requirements Management

A client has asked Ravensworth to show which version of requirement R-212 was \
in the contract baseline, and whether it has been verified. Their tool cannot \
answer either. Model the data that would.

a) A project has a name, a manager and a status.
b) A project specifies one or more system requirements, each with a reference, \
text and a priority. A requirement has no meaning apart from its project.
c) A requirement type has a name and a functional flag, and is a standing list. \
Each requirement is classified by exactly one type.
d) A requirement is revised as one or more requirement versions, each with a \
version number, its text and a creation date. Versions are never overwritten.
e) A project freezes as any number of requirement baselines, each with a label \
and a freeze date.
f) A baseline includes one or more specific requirement VERSIONS. A version may \
be included in many baselines.
g) A requirement may be the parent of any number of other requirements, and a \
child of others. Each link records its type.
h) A requirement is the subject of any number of change requests, each raised by \
one person with a date, reason and status.
i) A verification method has a name and a rigour level, and is a standing list.
j) A requirement is verified by one or more verification plans, each prescribing \
exactly one method with acceptance criteria.
k) A verification plan yields any number of verification results, each with an \
execution date, an outcome and an evidence reference."""

CFG95_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (f) and (g) are many-to-many. Resolve both, and for requirement \
(g) name the two foreign keys so the parent and child roles are distinguishable.
4. Answer the client's first question: trace on your diagram the path from a \
baseline to the exact text of R-212 as it stood then, naming every entity \
crossed. State in one sentence why requirement (f) links to a version rather \
than to the requirement.
5. Answer the client's second: name the entities you would join to show R-212 is \
verified, and state what an outcome of "passed" against an OLD version would \
tell you."""


# -------------------------------------------------- cfg 96, UML_COMPONENT
def performance_testing_components():
    d = Diagram("Ravensworth Consulting - Performance Test Architecture",
                "UML component diagram (model answer)")
    d.shape("plan", "TestPlanRepository", "component", 40, 130, 220, 70)
    d.shape("ctrl", "LoadController", "component", 330, 130, 210, 70)
    d.shape("gen1", "LoadGeneratorA", "component", 620, 90, 210, 70)
    d.shape("gen2", "LoadGeneratorB", "component", 620, 210, 210, 70)
    d.shape("sut", "SystemUnderTest", "component", 910, 150, 210, 70)
    d.shape("apm", "ApmAgent", "component", 910, 300, 210, 70)
    d.shape("metrics", "MetricsCollector", "component", 620, 340, 210, 70)
    d.shape("results", "ResultsStore", "component", 330, 340, 210, 70)
    d.shape("analyse", "ResultsAnalyser", "component", 330, 490, 210, 70)
    d.shape("gate", "QualityGate", "component", 620, 490, 210, 70)
    d.shape("i_plan", "ITestPlan", "provided", 295, 145, 22, 22)
    d.shape("i_gen", "ILoadInjection", "provided", 585, 105, 22, 22)
    d.shape("i_met", "IMetricIngest", "provided", 585, 355, 22, 22)
    d.shape("i_res", "IResultStore", "provided", 295, 355, 22, 22)
    d.shape("i_an", "IAnalysisReport", "provided", 295, 505, 22, 22)
    d.edge("ctrl", "plan", "dep", "ITestPlan")
    d.edge("ctrl", "gen1", "dep", "ILoadInjection")
    d.edge("ctrl", "gen2", "dep", "ILoadInjection")
    d.edge("gen1", "sut", "dep", "drives")
    d.edge("gen2", "sut", "dep", "drives")
    d.edge("apm", "sut", "dep", "instruments")
    d.edge("gen1", "metrics", "dep", "IMetricIngest")
    d.edge("gen2", "metrics", "dep", "IMetricIngest")
    d.edge("apm", "metrics", "dep", "IMetricIngest")
    d.edge("metrics", "results", "dep", "IResultStore")
    d.edge("analyse", "results", "dep", "IResultStore")
    d.edge("gate", "analyse", "dep", "IAnalysisReport")
    d.edge("gate", "plan", "dep", "ITestPlan")
    d.legend(COMPONENT_LEGEND + ["the gate compares results against the plan's targets"],
             x=910, y=440)
    return d.xml()


CFG96_Q = """\
"Ravensworth Consulting" - Performance Test Architecture

Ravensworth's load tests produce numbers nobody can turn into a pass or fail, \
because the target is remembered rather than recorded. Model an architecture \
that decides automatically.

a) The test plan repository provides ITestPlan and holds each test's workload \
profile AND its performance targets. It is the single source of both.
b) The load controller depends on ITestPlan and drives two load generators, A \
and B, through their ILoadInjection interface.
c) Both generators drive the system under test. Neither knows about the other.
d) An APM agent instruments the system under test. It is not in the load path.
e) Both generators and the APM agent send measurements to the metrics collector \
through IMetricIngest.
f) The metrics collector writes to the results store through IResultStore. No \
other component writes to it.
g) The results analyser reads from the results store through that same \
IResultStore interface and provides IAnalysisReport.
h) The quality gate depends on IAnalysisReport and on ITestPlan, and decides \
pass or fail by comparing the two.
i) Nothing depends on the quality gate, and the system under test depends on \
nothing in the test harness."""

CFG96_I = """\
1. Draw every component in requirements (a) to (h) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (h) is what solves the problem in the opening paragraph. Explain \
in one sentence why the quality gate must depend on ITestPlan as well as on the \
results, and what it could not decide with the results alone.
5. Requirement (i) says the system under test depends on nothing in the harness. \
State in one sentence why that matters for the validity of the measurements, and \
what requirement (d) is protecting."""


BATCH = [
    (83, CFG83_Q, CFG83_I, billing_operations),
    (84, CFG84_Q, CFG84_I, month_end_close),
    (85, CFG85_Q, CFG85_I, service_operations_records),
    (86, CFG86_Q, CFG86_I, change_deployment),
    (87, CFG87_Q, CFG87_I, service_desk_use_cases),
    (88, CFG88_Q, CFG88_I, kpi_definition_activity),
    (89, CFG89_Q, CFG89_I, requirements_documentation_flow),
    (90, CFG90_Q, CFG90_I, rfi_process),
    (91, CFG91_Q, CFG91_I, business_plan_flow),
    (92, CFG92_Q, CFG92_I, technical_presentation_flow),
    (93, CFG93_Q, CFG93_I, project_management_model),
    (94, CFG94_Q, CFG94_I, scheduling_flow),
    (95, CFG95_Q, CFG95_I, system_requirements_records),
    (96, CFG96_Q, CFG96_I, performance_testing_components),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 9")
