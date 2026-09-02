"""Batch 3: cfg 18-25. Component, sequence and five entity-relationship briefs."""

import sys

sys.path.insert(0, "/app")

from writer import write_batch
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

COMPONENT_LEGEND = [
    "component box = deployable unit",
    "lollipop (circle) = provided interface",
    "socket (half circle) = required interface",
    "dashed open arrow = dependency on an interface",
]

SEQUENCE_LEGEND = [
    "solid arrow = synchronous call",
    "dashed arrow = return",
    "open arrow = asynchronous message",
    "alt / loop box = combined fragment, guard in brackets",
]


# ------------------------------------------------- cfg 18, UML_COMPONENT
def storefront_components():
    d = Diagram("Kestrel Retail - Storefront Component Architecture",
                "UML component diagram (model answer)")
    d.shape("web", "WebStorefrontUI", "component", 40, 110, 210, 70)
    d.shape("mobile", "MobileAppBFF", "component", 40, 210, 210, 70)
    d.shape("gateway", "ApiGateway", "component", 320, 160, 210, 70)
    d.shape("catalog", "CatalogService", "component", 620, 100, 210, 70)
    d.shape("basket", "BasketService", "component", 620, 210, 210, 70)
    d.shape("order", "OrderService", "component", 620, 320, 210, 70)
    d.shape("payment", "PaymentService", "component", 620, 430, 210, 70)
    d.shape("inventory", "InventoryService", "component", 900, 100, 210, 70)
    d.shape("notify", "NotificationService", "component", 900, 320, 210, 70)
    d.shape("db", "OrderDatabase", "component", 900, 430, 210, 70)
    d.shape("i_gw", "IStorefront", "provided", 285, 175, 22, 22)
    d.shape("i_cat", "ICatalogQuery", "provided", 580, 120, 22, 22)
    d.shape("i_bas", "IBasket", "provided", 580, 230, 22, 22)
    d.shape("i_ord", "IOrderPlacement", "provided", 580, 340, 22, 22)
    d.shape("i_pay", "IPaymentAuth", "provided", 580, 450, 22, 22)
    d.shape("i_inv", "IStockCheck", "provided", 865, 120, 22, 22)
    d.shape("i_not", "IDispatchNotice", "provided", 865, 340, 22, 22)
    for src in ("web", "mobile"):
        d.edge(src, "gateway", "dep", "IStorefront")
    for dst, name in (("catalog", "ICatalogQuery"), ("basket", "IBasket"),
                      ("order", "IOrderPlacement")):
        d.edge("gateway", dst, "dep", name)
    d.edge("catalog", "inventory", "dep", "IStockCheck")
    d.edge("basket", "catalog", "dep", "ICatalogQuery")
    d.edge("order", "payment", "dep", "IPaymentAuth")
    d.edge("order", "inventory", "dep", "IStockCheck")
    d.edge("order", "notify", "dep", "IDispatchNotice")
    d.edge("order", "db", "dep", "persists to")
    d.legend(COMPONENT_LEGEND, x=320, y=430)
    return d.xml()


CFG18_Q = """\
"Kestrel Retail" Storefront Component Architecture

Kestrel is splitting a retail monolith into services and needs the component \
structure agreed before any code is written.

a) Two front ends exist: a web storefront UI and a mobile app backend-for-\
frontend. Neither talks to a service directly; both go through an API gateway, \
which is the only component they know about.
b) The gateway provides the IStorefront interface to those two front ends.
c) The gateway depends on three services: a catalog service (ICatalogQuery), a \
basket service (IBasket) and an order service (IOrderPlacement). Each service \
provides exactly that one interface to the gateway.
d) The catalog service checks stock through the inventory service's IStockCheck \
interface.
e) The basket service prices its lines through the catalog service's \
ICatalogQuery interface -- the same interface the gateway uses, not a second one.
f) The order service authorises payment through the payment service \
(IPaymentAuth), reserves stock through IStockCheck, tells the notification \
service to send a dispatch notice (IDispatchNotice), and persists to its own \
order database. No other component may reach that database.
g) No service calls the gateway, and no service calls a front end."""

CFG18_I = """\
1. Draw every component in requirements (a) to (f) as a UML component.
2. Show each provided interface as a lollipop on the component that provides \
it, and each required interface as a dependency from the component that needs it.
3. Name every interface on the arrow that uses it. Do not draw an unnamed \
dependency.
4. Requirement (e) says the basket service reuses ICatalogQuery. Show that one \
interface serving two consumers, and explain in one sentence why defining a \
second interface for the same operation would be a design fault.
5. Requirements (f) and (g) constrain the direction of dependencies. State what \
architectural property they are protecting, and identify which single component \
would become a bottleneck if requirement (g) were relaxed."""


# ----------------------------------------------- cfg 19, SEQUENCE_DIAGRAM
def checkout_sequence():
    d = Diagram("Kestrel Retail - Place Order Interaction",
                "UML sequence diagram (model answer)")
    d.lifeline("cust", "Customer", 40, 100, 140, 780)
    d.lifeline("ui", ":StorefrontUI", 230, 100, 150, 780)
    d.lifeline("order", ":OrderService", 430, 100, 150, 780)
    d.lifeline("inv", ":InventoryService", 630, 100, 160, 780)
    d.lifeline("pay", ":PaymentService", 840, 100, 160, 780)
    d.lifeline("notif", ":NotificationService", 1050, 100, 175, 780)
    d.msg("cust", "ui", "1: checkout()", 210)
    d.msg("ui", "order", "2: placeOrder(basketId)", 250)
    d.msg("order", "inv", "3: reserveStock(items)", 300)
    d.msg("inv", "order", "4: reservation result", 340, "return")
    d.frame("alt  [stock available]", 400, 380, 780, 300)
    d.msg("order", "pay", "5: authorise(amount, card)", 430)
    d.msg("pay", "order", "6: authResult", 470, "return")
    d.frame("loop  [while retries < 3 and auth declined]", 420, 500, 620, 110)
    d.msg("order", "pay", "7: authorise(amount, card)", 545)
    d.msg("pay", "order", "8: authResult", 585, "return")
    d.msg("order", "notif", "9: sendConfirmation(orderId)", 640, "async")
    d.msg("order", "inv", "10: releaseStock(items)", 710)
    d.msg("order", "ui", "11: orderOutcome", 750, "return")
    d.msg("ui", "cust", "12: display outcome", 790, "return")
    d.legend(SEQUENCE_LEGEND, x=1270, y=200)
    return d.xml()


CFG19_Q = """\
"Kestrel Retail" - Place Order Interaction

Kestrel's team needs the runtime interaction for placing an order agreed before \
the services are built. Model one successful and one failing path in a single \
diagram.

a) The customer starts checkout in the storefront UI, which calls the order \
service with the basket identifier.
b) The order service first asks the inventory service to reserve the stock, and \
waits for the answer before doing anything else.
c) If stock is available, the order service asks the payment service to \
authorise the amount and waits for the result.
d) A declined authorisation is retried up to three times. The customer is not \
asked again between retries.
e) On a successful authorisation the order service tells the notification \
service to send a confirmation. It does NOT wait for the notification to be \
sent -- the order is complete either way.
f) If stock is not available, or if all three authorisation attempts are \
declined, the order service releases any reserved stock and no confirmation is \
sent.
g) In every case the order service returns the outcome to the UI, which \
displays it to the customer."""

CFG19_I = """\
1. Draw a lifeline for the customer and for each of the five components named \
in requirements (a) to (f).
2. Number the messages in the order they occur, and show returns as dashed \
arrows.
3. Use an alt fragment for requirement (f) and a loop fragment for requirement \
(d), with the guard written in each fragment's bracket.
4. Requirement (e) is asynchronous but requirements (b) and (c) are \
synchronous. Draw the three differently, and explain in one sentence what the \
order service does differently in each case.
5. Requirement (f) says stock is released on both failure paths. Show that step \
where it belongs, and state what would go wrong in the warehouse if it were \
placed only on the payment-failure branch."""


# ------------------------------------------------------------ cfg 20, ERD
def knowledge_base():
    d = Diagram("Corvus Analytics - Knowledge Base Domain Model",
                "Entity-relationship diagram (model answer)")
    d.node("source", "DataSource", ["PK sourceId: String", "name: String",
                                    "systemOfRecord: String", "refreshedOn: Date"], 40, 90)
    d.node("dataset", "Dataset", ["PK datasetId: String", "FK sourceId: String",
                                  "name: String", "rowCount: long"], 320, 90)
    d.node("field", "DataField", ["PK fieldId: String", "FK datasetId: String",
                                  "name: String", "dataType: String",
                                  "isSensitive: boolean"], 320, 300)
    d.node("report", "Report", ["PK reportId: String", "FK authorId: String",
                                "title: String", "publishedOn: Date"], 620, 90)
    d.node("insight", "Insight", ["PK insightId: String", "FK reportId: String",
                                  "statement: String", "confidence: double"], 620, 300)
    d.node("analyst", "Analyst", ["PK analystId: String", "fullName: String",
                                  "email: String", "team: String"], 900, 90)
    d.node("usage", "DatasetUsage", ["PK usageId: String", "FK reportId: String",
                                     "FK datasetId: String", "role: String"], 620, 500)
    d.node("term", "GlossaryTerm", ["PK termId: String", "term: String",
                                    "definition: String", "FK stewardId: String"], 900, 300)
    d.node("tagging", "FieldTerm", ["PK fieldTermId: String", "FK fieldId: String",
                                    "FK termId: String", "taggedOn: Date"], 900, 500)
    d.edge("source", "dataset", "assoc", "supplies", "1", "0..*")
    d.edge("dataset", "field", "comp", "is described by", "1", "1..*")
    d.edge("analyst", "report", "assoc", "authors", "1", "0..*")
    d.edge("report", "insight", "comp", "states", "1", "1..*")
    d.edge("report", "usage", "comp", "draws on", "1", "1..*")
    d.edge("dataset", "usage", "assoc", "is used in", "1", "0..*")
    d.edge("analyst", "term", "assoc", "stewards", "1", "0..*")
    d.edge("field", "tagging", "assoc", "carries", "1", "0..*")
    d.edge("term", "tagging", "assoc", "labels", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=420)
    return d.xml()


CFG20_Q = """\
"Corvus Analytics" Knowledge Base

Corvus turns raw operational data into published insight, and wants the \
relationship between data, information and knowledge recorded in one model.

a) A data source has an ID, name, system of record and a last-refreshed date, \
and supplies any number of datasets. A dataset belongs to exactly one source, \
but survives if that source is decommissioned -- the rows are still there.
b) A dataset is described by one or more data fields, each with a name, data \
type and a sensitivity flag. A field has no meaning apart from its dataset.
c) An analyst has an ID, name, e-mail and team, and authors any number of \
reports. A report has exactly one author.
d) A report states one or more insights, each with a statement and a confidence \
value. An insight is deleted with its report.
e) A report draws on one or more datasets, and a dataset may be used in many \
reports. Each such use records the role the dataset played in that report.
f) A glossary term has a term and a definition and is stewarded by exactly one \
analyst. Terms outlive the reports that use them.
g) A data field may be tagged with any number of glossary terms, and a term may \
label any number of fields. Each tagging records the date it was applied."""

CFG20_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (e) and (g) are many-to-many. Resolve each into an associative \
entity, and explain in one sentence why requirement (e) could not be resolved \
by a simple foreign key.
4. Justify in one sentence each why Dataset-DataField and Report-Insight are \
identifying relationships, while DataSource-Dataset is not.
5. Requirement (a) says a dataset survives its source. State what that fixes \
about the foreign key on Dataset, and name the referential action the database \
should take when a source is deleted."""


# ------------------------------------------------------------ cfg 21, ERD
def gym_requirements():
    d = Diagram("Ironside Gyms - Membership Domain Model",
                "Entity-relationship diagram (model answer)")
    d.node("member", "Member", ["PK memberId: String", "fullName: String",
                                "email: String", "joinedOn: Date"], 40, 90)
    d.node("branch", "Branch", ["PK branchId: String", "name: String",
                                "address: String", "capacity: int"], 620, 90)
    d.node("ms", "Membership", ["PK membershipId: String", "FK memberId: String",
                                "FK planId: String", "FK branchId: String",
                                "startsOn: Date", "endsOn: Date"], 320, 90)
    d.node("plan", "MembershipPlan", ["PK planId: String", "name: String",
                                      "monthlyFee: double", "classCredits: int"], 320, 320)
    d.node("payment", "Payment", ["PK paymentId: String", "FK membershipId: String",
                                  "amount: double", "paidOn: Date",
                                  "method: String"], 40, 320)
    d.node("cls", "FitnessClass", ["PK classId: String", "FK branchId: String",
                                   "FK trainerId: String", "name: String",
                                   "startsAt: Date", "capacity: int"], 620, 320)
    d.node("trainer", "Trainer", ["PK trainerId: String", "fullName: String",
                                  "qualification: String", "hourlyRate: double"], 900, 90)
    d.node("booking", "ClassBooking", ["PK bookingId: String", "FK membershipId: String",
                                       "FK classId: String", "bookedOn: Date",
                                       "attended: boolean"], 620, 540)
    d.node("equip", "Equipment", ["PK equipmentId: String", "FK branchId: String",
                                  "assetTag: String", "type: String",
                                  "servicedOn: Date"], 900, 320)
    d.edge("member", "ms", "assoc", "holds", "1", "0..*")
    d.edge("plan", "ms", "assoc", "is sold as", "1", "0..*")
    d.edge("branch", "ms", "assoc", "is based at", "1", "0..*")
    d.edge("ms", "payment", "comp", "is paid by", "1", "0..*")
    d.edge("branch", "cls", "assoc", "hosts", "1", "0..*")
    d.edge("trainer", "cls", "assoc", "leads", "1", "0..*")
    d.edge("ms", "booking", "comp", "makes", "1", "0..*")
    d.edge("cls", "booking", "assoc", "receives", "1", "0..*")
    d.edge("branch", "equip", "comp", "houses", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=540)
    return d.xml()


CFG21_Q = """\
"Ironside Gyms" - Requirements Gathering Outcome

A requirements workshop with Ironside's operations team produced the statements \
below. They are written as the stakeholders said them; your job is to turn them \
into a model.

a) "Every member has a name, e-mail and the date they joined. We keep members \
on file after they leave."
b) "A member takes out a membership. Someone can have several over the years -- \
they leave and come back -- but only one is active at a time."
c) "A membership is on one of our plans. A plan has a monthly fee and a number \
of class credits. Plans are set centrally and don't disappear when nobody's on \
them."
d) "A membership is based at one branch. Branches have a name, address and \
capacity."
e) "Payments are against the membership, not the person. If we delete a \
membership record its payments go with it."
f) "Classes run at a branch and are led by one trainer. A trainer works across \
branches and stays on the books between classes."
g) "Members book classes through their membership. We record when they booked \
and whether they turned up."
h) "Equipment belongs to the branch it's installed at. If we close a branch, \
those asset records go too."""

CFG21_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (g) is many-to-many between memberships and classes. Resolve it \
into an associative entity carrying its own attributes.
4. Justify in one sentence each why Membership-Payment and Branch-Equipment are \
identifying relationships, while Trainer-FitnessClass is not.
5. Requirement (b) says only one membership is active at a time. State in one \
sentence why that is a business rule your ERD cannot express, and where it \
would have to be enforced instead."""


# ------------------------------------------------------------ cfg 22, ERD
def conference_conceptual():
    d = Diagram("Aurora Conference - Conceptual Data Model",
                "Entity-relationship diagram (model answer)")
    d.node("conf", "Conference", ["PK conferenceId: String", "name: String",
                                  "year: int", "venue: String"], 40, 90)
    d.node("track", "Track", ["PK trackId: String", "FK conferenceId: String",
                              "name: String", "theme: String"], 320, 90)
    d.node("session", "Session", ["PK sessionId: String", "FK trackId: String",
                                  "FK roomId: String", "title: String",
                                  "startsAt: Date"], 620, 90)
    d.node("room", "Room", ["PK roomId: String", "FK conferenceId: String",
                            "name: String", "seats: int"], 620, 320)
    d.node("paper", "Paper", ["PK paperId: String", "FK sessionId: String",
                              "title: String", "abstract: String",
                              "status: String"], 900, 90)
    d.node("person", "Person", ["PK personId: String", "fullName: String",
                                "email: String", "affiliation: String"], 40, 320)
    d.node("author", "Authorship", ["PK authorshipId: String", "FK paperId: String",
                                    "FK personId: String", "position: int",
                                    "isCorresponding: boolean"], 900, 320)
    d.node("review", "Review", ["PK reviewId: String", "FK paperId: String",
                                "FK personId: String", "score: int",
                                "comments: String"], 900, 540)
    d.node("reg", "Registration", ["PK registrationId: String",
                                   "FK conferenceId: String", "FK personId: String",
                                   "registeredOn: Date", "ticketType: String"], 320, 320)
    d.edge("conf", "track", "comp", "is divided into", "1", "1..*")
    d.edge("track", "session", "comp", "schedules", "1", "1..*")
    d.edge("conf", "room", "comp", "provides", "1", "1..*")
    d.edge("room", "session", "assoc", "hosts", "1", "0..*")
    d.edge("session", "paper", "assoc", "presents", "1", "1..*")
    d.edge("paper", "author", "comp", "is credited to", "1", "1..*")
    d.edge("person", "author", "assoc", "writes", "1", "0..*")
    d.edge("paper", "review", "comp", "receives", "1", "0..*")
    d.edge("person", "review", "assoc", "gives", "1", "0..*")
    d.edge("conf", "reg", "comp", "accepts", "1", "0..*")
    d.edge("person", "reg", "assoc", "makes", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=540)
    return d.xml()


CFG22_Q = """\
"Aurora" Academic Conference - Conceptual Design

Aurora runs an annual research conference. Produce the conceptual data model, \
independent of any particular database product.

a) A conference has a name, year and venue, and is divided into one or more \
tracks. A track belongs to exactly one conference and does not outlive it.
b) A track schedules one or more sessions. A session belongs to exactly one \
track.
c) A conference provides one or more rooms. A session is hosted in exactly one \
room, and a room hosts many sessions across the programme.
d) A session presents one or more papers. Each paper is presented in exactly \
one session.
e) A person has a name, e-mail and affiliation. The same person may be an \
author, a reviewer and a delegate; the system holds one record per person, not \
three.
f) A paper is credited to one or more people. Each authorship records the \
position in the author list and whether that author is the corresponding one.
g) A paper receives any number of reviews. Each review is given by exactly one \
person and records a score and comments. A person may review many papers.
h) A person makes a registration for a conference, recording the date and the \
ticket type. Registrations are deleted when the conference record is purged; \
people are not."""

CFG22_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK). Use conceptual data types only -- do not choose column \
lengths or index types.
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (f) and (g) are many-to-many between Person and Paper. Resolve \
both, and explain in one sentence why they must become two separate associative \
entities rather than one.
4. Requirement (e) says one record per person. State what modelling error you \
have avoided by following it, and what would go wrong on an e-mail change if \
you had not.
5. Identify which relationships are identifying and which are not, and state in \
one sentence what distinguishes the two at the conceptual level."""


# ------------------------------------------------------------ cfg 23, ERD
def supply_chain_model():
    d = Diagram("Northwind Supply - Order Fulfilment Data Model",
                "Entity-relationship diagram (model answer)")
    d.node("cust", "Customer", ["PK customerId: String", "name: String",
                                "creditLimit: double", "onHold: boolean"], 40, 90)
    d.node("order", "SalesOrder", ["PK orderId: String", "FK customerId: String",
                                   "orderedOn: Date", "status: String"], 320, 90)
    d.node("line", "OrderLine", ["PK orderLineId: String", "FK orderId: String",
                                 "FK productId: String", "quantity: int",
                                 "unitPrice: double"], 320, 320)
    d.node("product", "Product", ["PK productId: String", "sku: String",
                                  "name: String", "unitWeight: double"], 620, 320)
    d.node("supplier", "Supplier", ["PK supplierId: String", "name: String",
                                    "leadTimeDays: int", "rating: int"], 900, 320)
    d.node("supply", "SupplyAgreement", ["PK agreementId: String",
                                         "FK supplierId: String", "FK productId: String",
                                         "cost: double", "minOrderQty: int"], 900, 540)
    d.node("wh", "Warehouse", ["PK warehouseId: String", "name: String",
                               "region: String", "capacity: int"], 620, 90)
    d.node("stock", "StockLevel", ["PK stockLevelId: String", "FK warehouseId: String",
                                   "FK productId: String", "onHand: int",
                                   "reorderPoint: int"], 620, 540)
    d.node("ship", "Shipment", ["PK shipmentId: String", "FK orderId: String",
                                "FK warehouseId: String", "despatchedOn: Date",
                                "carrier: String"], 40, 320)
    d.node("shipline", "ShipmentLine", ["PK shipmentLineId: String",
                                        "FK shipmentId: String", "FK orderLineId: String",
                                        "quantityShipped: int"], 40, 540)
    d.edge("cust", "order", "assoc", "places", "1", "0..*")
    d.edge("order", "line", "comp", "consists of", "1", "1..*")
    d.edge("product", "line", "assoc", "is ordered as", "1", "0..*")
    d.edge("supplier", "supply", "assoc", "offers", "1", "0..*")
    d.edge("product", "supply", "assoc", "is supplied under", "1", "0..*")
    d.edge("wh", "stock", "comp", "holds", "1", "0..*")
    d.edge("product", "stock", "assoc", "is stocked as", "1", "0..*")
    d.edge("order", "ship", "assoc", "is fulfilled by", "1", "0..*")
    d.edge("wh", "ship", "assoc", "despatches", "1", "0..*")
    d.edge("ship", "shipline", "comp", "carries", "1", "1..*")
    d.edge("line", "shipline", "assoc", "is shipped as", "1", "0..*")
    d.legend(ERD_LEGEND, x=320, y=540)
    return d.xml()


CFG23_Q = """\
"Northwind Supply" - Order Fulfilment Model

Northwind distributes goods from several warehouses. Model the data supporting \
order fulfilment.

a) A customer has a name, credit limit and an on-hold flag, and places any \
number of sales orders. An order belongs to exactly one customer; customers \
remain on file after their orders are archived.
b) An order consists of one or more order lines, each naming a product with a \
quantity and the unit price at the time of the order. A line has no meaning \
apart from its order.
c) A product has an SKU, name and unit weight, and appears on many order lines.
d) A supplier offers products under supply agreements, each recording the cost \
and a minimum order quantity. A supplier offers many products, and a product \
may be offered by many suppliers.
e) A warehouse holds a stock level per product, recording the quantity on hand \
and a reorder point. A stock level cannot exist without its warehouse.
f) An order is fulfilled by any number of shipments -- a partial delivery is \
normal. Each shipment is despatched from exactly one warehouse and records the \
despatch date and carrier.
g) A shipment carries one or more shipment lines. Each shipment line refers to \
exactly one order line and records how many units of it were shipped. One order \
line may be shipped across several shipments."""

CFG23_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (d), (e) and (g) each produce an associative entity. Draw all \
three and name the attributes that justify each one's existence.
4. Requirement (b) stores the unit price on the order line rather than reading \
it from the product. Explain in one sentence why, and what would be wrong with \
an invoice reprinted a year later if you had not.
5. Requirement (g) allows one order line to be shipped across several \
shipments. State the cardinality that expresses this, and what business \
question becomes unanswerable if you instead put a single shipmentId directly \
on OrderLine."""


# ------------------------------------------------------------ cfg 24, ERD
def insurance_subtypes():
    d = Diagram("Sentinel Insurance - Policy Model with Subtypes",
                "Entity-relationship diagram (model answer)")
    d.node("party", "Party", ["PK partyId: String", "partyType: String",
                              "name: String", "createdOn: Date"], 40, 90)
    d.node("person", "PersonParty", ["PK partyId: String (FK)", "dateOfBirth: Date",
                                     "nationalId: String"], 40, 300)
    d.node("org", "OrganisationParty", ["PK partyId: String (FK)",
                                        "registrationNo: String",
                                        "sector: String"], 40, 470)
    d.node("policy", "Policy", ["PK policyId: String", "FK holderId: String",
                                "policyType: String", "startsOn: Date",
                                "endsOn: Date", "premium: double"], 340, 90)
    d.node("motor", "MotorPolicy", ["PK policyId: String (FK)",
                                    "vehicleReg: String",
                                    "noClaimsYears: int"], 340, 320)
    d.node("home", "HomePolicy", ["PK policyId: String (FK)",
                                  "propertyAddress: String",
                                  "rebuildValue: double"], 340, 490)
    d.node("cover", "CoverItem", ["PK coverItemId: String", "FK policyId: String",
                                  "peril: String", "sumInsured: double",
                                  "excess: double"], 640, 90)
    d.node("claim", "Claim", ["PK claimId: String", "FK policyId: String",
                              "reportedOn: Date", "status: String",
                              "reserve: double"], 640, 320)
    d.node("payment", "ClaimPayment", ["PK paymentId: String", "FK claimId: String",
                                       "amount: double", "paidOn: Date"], 640, 540)
    d.node("agent", "Agent", ["PK agentId: String", "FK partyId: String",
                              "agencyCode: String", "commissionRate: double"], 920, 90)
    d.node("place", "Placement", ["PK placementId: String", "FK policyId: String",
                                  "FK agentId: String", "placedOn: Date"], 920, 300)
    d.edge("party", "person", "gen")
    d.edge("party", "org", "gen")
    d.edge("policy", "motor", "gen")
    d.edge("policy", "home", "gen")
    d.edge("party", "policy", "assoc", "holds", "1", "0..*")
    d.edge("policy", "cover", "comp", "provides", "1", "1..*")
    d.edge("policy", "claim", "comp", "is claimed against", "1", "0..*")
    d.edge("claim", "payment", "comp", "settles through", "1", "0..*")
    d.edge("party", "agent", "assoc", "acts as", "1", "0..1")
    d.edge("policy", "place", "comp", "is placed by", "1", "1..*")
    d.edge("agent", "place", "assoc", "places", "1", "0..*")
    d.legend(ERD_LEGEND + ["hollow triangle = subtype (is-a)"], x=920, y=520)
    return d.xml()


CFG24_Q = """\
"Sentinel Insurance" - Policy Model with Subtypes

Sentinel writes motor and home insurance for individuals and companies. Their \
current model repeats the same columns in several tables; you are to produce one \
that does not.

a) Every customer, company and broker on the system is a party, with an ID, a \
type discriminator, a name and a creation date.
b) A party is either a person -- with a date of birth and a national ID -- or \
an organisation, with a registration number and a sector. No party is only a \
party, and none is both.
c) A policy has a start date, end date and premium, and is held by exactly one \
party. A party may hold many policies over time.
d) A policy is either a motor policy -- with a vehicle registration and \
no-claims years -- or a home policy, with a property address and a rebuild \
value. The shared attributes must not be repeated in both.
e) A policy provides one or more cover items, each naming a peril with a sum \
insured and an excess. Cover items are deleted with the policy.
f) A policy is claimed against any number of times. A claim records the report \
date, a status and a reserve, and settles through any number of claim payments.
g) Some parties act as agents, holding an agency code and a commission rate. A \
party acts as at most one agent, and most parties are not agents at all.
h) A policy is placed by one or more agents, each placement recording the date \
it was placed."""

CFG24_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw the two supertype/subtype hierarchies of requirements (b) and (d), \
showing the shared attributes on the supertype only.
3. State whether each hierarchy is complete or partial, and disjoint or \
overlapping, quoting the sentence in the requirements that decides it.
4. Requirement (g) is a role, not a subtype. Model it as a 1-to-0..1 \
relationship and explain in one sentence why making Agent a subtype of Party \
would be wrong given requirements (b) and (g) together.
5. Requirement (h) is many-to-many. Resolve it, and justify in one sentence why \
Policy-CoverItem is an identifying relationship but Agent-Placement is not."""


# ------------------------------------------------------------ cfg 25, ERD
def cabling_plant():
    d = Diagram("Halden Campus - Physical Network Plant Model",
                "Entity-relationship diagram (model answer)")
    d.node("site", "Site", ["PK siteId: String", "name: String",
                            "address: String", "region: String"], 40, 90)
    d.node("building", "Building", ["PK buildingId: String", "FK siteId: String",
                                    "name: String", "floors: int"], 320, 90)
    d.node("room", "CommsRoom", ["PK roomId: String", "FK buildingId: String",
                                 "roomNumber: String", "floor: int"], 620, 90)
    d.node("rack", "Rack", ["PK rackId: String", "FK roomId: String",
                            "rackLabel: String", "unitHeight: int"], 900, 90)
    d.node("device", "NetworkDevice", ["PK deviceId: String", "FK rackId: String",
                                       "hostname: String", "model: String",
                                       "rackUnit: int"], 900, 300)
    d.node("port", "Port", ["PK portId: String", "FK deviceId: String",
                            "portNumber: String", "mediaType: String",
                            "speedMbps: int"], 900, 520)
    d.node("panel", "PatchPanel", ["PK panelId: String", "FK rackId: String",
                                   "panelLabel: String", "portCount: int"], 620, 300)
    d.node("outlet", "WallOutlet", ["PK outletId: String", "FK buildingId: String",
                                    "outletLabel: String", "floor: int"], 320, 300)
    d.node("cable", "CableRun", ["PK cableRunId: String", "FK panelId: String",
                                 "FK outletId: String", "cableType: String",
                                 "lengthMetres: double", "testedOn: Date"], 320, 520)
    d.node("link", "PortConnection", ["PK connectionId: String", "FK portId: String",
                                      "FK panelId: String", "patchedOn: Date"], 620, 520)
    d.edge("site", "building", "comp", "contains", "1", "1..*")
    d.edge("building", "room", "comp", "houses", "1", "1..*")
    d.edge("room", "rack", "comp", "contains", "1", "1..*")
    d.edge("rack", "device", "assoc", "mounts", "1", "0..*")
    d.edge("device", "port", "comp", "exposes", "1", "1..*")
    d.edge("rack", "panel", "comp", "holds", "1", "0..*")
    d.edge("building", "outlet", "comp", "provides", "1", "0..*")
    d.edge("panel", "cable", "assoc", "terminates", "1", "0..*")
    d.edge("outlet", "cable", "assoc", "is fed by", "1", "0..1")
    d.edge("port", "link", "assoc", "is patched by", "1", "0..1")
    d.edge("panel", "link", "assoc", "receives", "1", "0..*")
    d.legend(ERD_LEGEND, x=40, y=520)
    return d.xml()


CFG25_Q = """\
"Halden Campus" - Physical Network Plant Records

Halden's network team keeps no reliable record of what is cabled to what. Model \
the physical layer so that any socket can be traced back to a switch port.

a) A site has a name, address and region, and contains one or more buildings. A \
building belongs to exactly one site and does not survive it in the records.
b) A building houses one or more communications rooms, identified by room \
number and floor. A comms room cannot exist without its building.
c) A comms room contains one or more racks, each with a label and a height in \
rack units.
d) A rack mounts any number of network devices, each with a hostname, model and \
the rack unit it starts at. A device may be moved to another rack, so it is not \
destroyed when a rack is decommissioned.
e) A device exposes one or more ports, each with a port number, media type and \
speed. A port has no existence apart from its device.
f) A rack also holds any number of patch panels, each with a label and a port \
count. A panel is deleted with its rack.
g) A building provides any number of wall outlets, each with a label and a \
floor.
h) A cable run connects exactly one patch panel to exactly one wall outlet, and \
records the cable type, length in metres and the date it was last tested. An \
outlet is fed by at most one cable run; a panel terminates many.
i) A switch port may be patched to a panel. A port carries at most one such \
connection at a time, and the date it was patched is recorded."""

CFG25_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirements (a), (b), (c), (e), (f) and (g) are containment. Show them as \
identifying relationships, and explain in one sentence why requirement (d) is \
NOT one despite also being containment.
4. Requirements (h) and (i) both use "at most one". Show the 0..1 cardinality \
in both places, and state what physical fact about a wall socket requirement \
(h) is recording.
5. Trace on your diagram the path from a wall outlet to the switch port serving \
it, naming every entity crossed. State how many joins that path costs, and one \
thing you would denormalise if that query had to run on every helpdesk ticket."""


BATCH = [
    (18, CFG18_Q, CFG18_I, storefront_components),
    (19, CFG19_Q, CFG19_I, checkout_sequence),
    (20, CFG20_Q, CFG20_I, knowledge_base),
    (21, CFG21_Q, CFG21_I, gym_requirements),
    (22, CFG22_Q, CFG22_I, conference_conceptual),
    (23, CFG23_Q, CFG23_I, supply_chain_model),
    (24, CFG24_Q, CFG24_I, insurance_subtypes),
    (25, CFG25_Q, CFG25_I, cabling_plant),
]

if __name__ == "__main__":
    write_batch(BATCH, "batch 3")
