"""Batch 1: five diagram questions rewritten as full briefs, with model answers.

Each brief follows the pattern of a real examination item: a named scenario,
lettered requirements that state multiplicity and lifetime dependency IN WORDS
so the learner must choose between composition and aggregation rather than
guess, then numbered tasks ending in the judgements they have to defend.

The reference answers every lettered requirement, carries multiplicity at both
ends of every relationship, and uses the notation the type calls for.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

MARKER = "\n\nTasks\n"


# ---------------------------------------------------------------- cfg 6, ERD
def warehouse_inventory():
    d = Diagram("Northwind Logistics - Inventory Domain Model",
                "Entity-relationship diagram (model answer)")
    d.node("wh", "Warehouse", ["PK warehouseId: String", "name: String",
                               "address: String", "capacityM3: int"], 40, 90)
    d.node("zone", "StorageZone", ["PK zoneId: String", "FK warehouseId: String",
                                   "code: String", "temperatureC: int"], 40, 260)
    d.node("item", "InventoryItem", ["PK sku: String", "description: String",
                                     "unitOfMeasure: String", "reorderLevel: int"], 320, 90)
    d.node("stock", "StockLevel", ["PK stockId: String", "FK zoneId: String",
                                   "FK sku: String", "quantityOnHand: int"], 320, 280)
    d.node("count", "InventoryCount", ["PK countId: String", "FK warehouseId: String",
                                       "FK staffId: String", "countedOn: Date",
                                       "status: String"], 620, 90)
    d.node("line", "CountLine", ["PK countLineId: String", "FK countId: String",
                                 "FK sku: String", "countedQty: int",
                                 "systemQty: int"], 620, 300)
    d.node("disc", "Discrepancy", ["PK discrepancyId: String",
                                   "FK countLineId: String", "variance: int",
                                   "resolvedOn: Date"], 620, 480)
    d.node("staff", "Staff", ["PK staffId: String", "fullName: String",
                              "role: String"], 900, 90)
    d.edge("wh", "zone", "comp", "is divided into", "1", "1..*")
    d.edge("zone", "stock", "comp", "holds", "1", "0..*")
    d.edge("item", "stock", "assoc", "stocked as", "1", "0..*")
    d.edge("wh", "count", "assoc", "is audited by", "1", "0..*")
    d.edge("count", "line", "comp", "consists of", "1", "1..*")
    d.edge("item", "line", "assoc", "counted in", "1", "0..*")
    d.edge("line", "disc", "assoc", "may raise", "1", "0..1")
    d.edge("staff", "count", "assoc", "performs", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=300)
    return d.xml()


CFG6_Q = """\
"Northwind Logistics" Inventory Accuracy Study

Northwind Logistics runs several warehouses and cannot trust its stock figures: \
counts are done on paper, entered days later, and disagree with what the system \
says is on the shelf. Before any technical solution is proposed, the problem \
domain must be modelled as it exists today.

a) Each warehouse has an ID, name, address and capacity in cubic metres. A \
warehouse is divided into one or more storage zones; a zone has no meaning \
apart from the warehouse it sits in, and closing a warehouse closes its zones \
with it.
b) Every inventory item has a SKU, description, unit of measure and reorder \
level. The same item may be stocked in many zones, and a zone stocks many \
items; the quantity on hand is a property of that pairing, not of either side.
c) An inventory count is carried out at one warehouse on one date by exactly \
one member of staff, and has a status. A member of staff may carry out any \
number of counts.
d) A count consists of one or more count lines, each naming an item, the \
quantity counted and the quantity the system expected. A count line cannot \
exist outside its count.
e) A count line raises at most one discrepancy, recording the variance and the \
date it was resolved. An item appears in many count lines over time."""

CFG6_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Resolve the many-to-many in requirement (b) correctly, and explain in one \
sentence why the quantity on hand cannot live on either entity.
4. Justify in one sentence each: why Warehouse-StorageZone and \
InventoryCount-CountLine are identifying (existence-dependent) relationships, \
while Staff-InventoryCount is not.
5. Which entity would become orphaned if a count were deleted without \
cascading, and what does that tell you about the relationship?"""


# ---------------------------------------------------------------- cfg 7, ERD
def library_static():
    d = Diagram("Meridian University Library - Static Structure",
                "Entity-relationship diagram (model answer)")
    d.node("branch", "Branch", ["PK branchId: String", "name: String",
                                "address: String"], 40, 90)
    d.node("title", "Title", ["PK isbn: String", "name: String",
                              "publishedYear: int", "FK publisherId: String"], 320, 90)
    d.node("copy", "Copy", ["PK copyId: String", "FK isbn: String",
                            "FK branchId: String", "condition: String",
                            "acquiredOn: Date"], 320, 280)
    d.node("pub", "Publisher", ["PK publisherId: String", "name: String",
                                "country: String"], 620, 90)
    d.node("author", "Author", ["PK authorId: String", "fullName: String",
                                "nationality: String"], 40, 280)
    d.node("wrote", "Authorship", ["PK authorshipId: String", "FK authorId: String",
                                   "FK isbn: String", "role: String"], 40, 450)
    d.node("member", "Member", ["PK memberId: String", "fullName: String",
                                "email: String", "joinedOn: Date"], 900, 90)
    d.node("loan", "Loan", ["PK loanId: String", "FK copyId: String",
                            "FK memberId: String", "borrowedOn: Date",
                            "dueOn: Date", "returnedOn: Date"], 620, 300)
    d.node("fine", "Fine", ["PK fineId: String", "FK loanId: String",
                            "amount: double", "settledOn: Date"], 900, 320)
    d.edge("branch", "copy", "comp", "holds", "1", "0..*")
    d.edge("title", "copy", "assoc", "is realised as", "1", "1..*")
    d.edge("pub", "title", "assoc", "publishes", "1", "0..*")
    d.edge("author", "wrote", "assoc", "credited in", "1", "0..*")
    d.edge("title", "wrote", "assoc", "credits", "1", "1..*")
    d.edge("copy", "loan", "assoc", "is lent as", "1", "0..*")
    d.edge("member", "loan", "assoc", "takes out", "1", "0..*")
    d.edge("loan", "fine", "comp", "may incur", "1", "0..1")
    d.legend(ERD_LEGEND, x=900, y=520)
    return d.xml()


CFG7_Q = """\
"Meridian University Library" Catalogue

Meridian University is replacing the catalogue that runs its branch libraries. \
Model the static structure of the domain -- the things the system stores and \
how they relate -- before any screens or processes are considered.

a) The university has several branches, each with an ID, name and address. A \
branch holds physical copies of books; if a branch closes, its copies are \
withdrawn from the catalogue with it.
b) A title is identified by its ISBN and has a name and year of publication. A \
title is published by exactly one publisher, and a publisher publishes many \
titles.
c) A title exists in the catalogue whether or not any branch holds it, but a \
copy is always a copy OF a title. One title may have many copies across the \
branches; each copy records its condition and the date it was acquired.
d) A title is credited to one or more authors, and an author is credited on any \
number of titles. Each credit records the author's role -- author, editor, \
translator.
e) A member borrows a copy, not a title. A loan records the borrow date, due \
date and return date; a member may hold many loans over time and a copy is lent \
many times.
f) A loan that is returned late incurs at most one fine, recording the amount \
and when it was settled. A fine has no meaning apart from its loan."""

CFG7_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Resolve the many-to-many in requirement (d) with an associative entity that \
carries the role.
4. Explain in one sentence why requirement (e) means Loan must reference Copy \
rather than Title.
5. Justify in one sentence each why Branch-Copy and Loan-Fine are \
existence-dependent, while Publisher-Title is not."""


# ------------------------------------------------- cfg 8, ACTIVITY_DIAGRAM
def expense_approval():
    d = Diagram("Helios Expense Management - Claim Approval",
                "UML activity diagram (model answer)")
    d.node("start", "( start )", [], 60, 100, 120)
    d.node("submit", "Submit expense claim", [], 60, 180, 200)
    d.node("validate", "Validate receipts and policy limits", [], 60, 260, 200)
    d.node("d1", "[ receipts complete? ]", [], 60, 350, 200)
    d.node("reject1", "Return claim to employee", [], 320, 350, 200)
    d.node("d2", "[ amount > 500 ? ]", [], 60, 450, 200)
    d.node("mgr", "Manager reviews claim", [], 60, 550, 200)
    d.node("fin", "Finance officer reviews claim", [], 320, 550, 200)
    d.node("fork", "-- fork --", [], 320, 470, 200)
    d.node("d3", "[ both approvals given? ]", [], 60, 650, 200)
    d.node("pay", "Schedule reimbursement", [], 60, 750, 200)
    d.node("notify", "Notify employee of outcome", [], 320, 750, 200)
    d.node("join", "-- join --", [], 60, 840, 200)
    d.node("end", "( end )", [], 60, 920, 120)
    d.edge("start", "submit", "assoc")
    d.edge("submit", "validate", "assoc")
    d.edge("validate", "d1", "assoc")
    d.edge("d1", "reject1", "assoc", "[no]")
    d.edge("reject1", "submit", "assoc", "resubmit")
    d.edge("d1", "d2", "assoc", "[yes]")
    d.edge("d2", "mgr", "assoc", "[no: manager only]")
    d.edge("d2", "fork", "assoc", "[yes: both required]")
    d.edge("fork", "fin", "assoc")
    d.edge("fork", "mgr", "assoc")
    d.edge("mgr", "d3", "assoc")
    d.edge("fin", "d3", "assoc")
    d.edge("d3", "pay", "assoc", "[yes]")
    d.edge("d3", "notify", "assoc", "[no: rejected]")
    d.edge("pay", "join", "assoc")
    d.edge("notify", "join", "assoc")
    d.edge("join", "end", "assoc")
    d.legend([
        "( ) = initial and final node",
        "[ ] = decision, branches labelled with their guard",
        "fork / join = concurrent paths",
    ], x=620, y=100)
    return d.xml()


CFG8_Q = """\
"Helios" Expense Management - Claim Approval Process

Helios is automating the approval of employee expense claims. The process below \
must be modelled before it is built.

a) An employee submits a claim. The system validates it against the receipt \
rules and the policy limits.
b) If any receipt is missing or unreadable the claim is returned to the \
employee, who may correct and resubmit it. A claim may go round this loop any \
number of times.
c) A claim of 500 or less needs the line manager's approval only.
d) A claim over 500 needs the line manager's AND the finance officer's \
approval. Those two reviews are independent and may happen in either order or \
at the same time; the claim proceeds only when both are in.
e) If every required approval is given, the reimbursement is scheduled. If any \
approver rejects it, the employee is notified of the outcome instead.
f) Either way the process ends once the employee has been informed."""

CFG8_I = """\
1. Draw the activity diagram with an initial node and a final node.
2. Show every action in requirements (a) to (e) as an activity.
3. Represent (b) as a loop back to submission, not as a separate path that ends.
4. Represent (d) with a fork and a join, and explain in one sentence why a \
decision node would model it incorrectly.
5. Label EVERY decision branch with its guard condition, and state which guard \
makes the two-approval path the exception rather than the default."""


# ---------------------------------------------------------- cfg 9, UML_CLASS
def review_workflow():
    d = Diagram("Vantage Requirements Review - Class Model",
                "UML class diagram (model answer)")
    d.node("doc", "RequirementsDocument",
           ["- documentId: String", "- title: String", "- version: String",
            "- status: DocStatus", "+ addRequirement(r: Requirement): void",
            "+ baseline(): void", "+ openDefects(): Defect[]"], 40, 100, 250)
    d.node("req", "Requirement",
           ["- requirementId: String", "- text: String", "- priority: int",
            "+ isTestable(): boolean", "+ trace(): TestCase[]"], 40, 330, 250)
    d.node("person", "Participant",
           ["# personId: String", "# fullName: String", "# email: String",
            "+ contact(): String", "+ role(): String"], 380, 100, 230, abstract=True)
    d.node("author", "Author", ["- department: String",
                                "+ revise(r: Requirement): void",
                                "+ respond(d: Defect): void"], 340, 320, 210)
    d.node("reviewer", "Reviewer", ["- expertise: String",
                                    "+ raise(d: Defect): void",
                                    "+ signOff(s: ReviewSession): void"], 600, 320, 210)
    d.node("session", "ReviewSession",
           ["- sessionId: String", "- heldOn: Date", "- outcome: String",
            "+ start(): void", "+ close(): boolean"], 880, 100, 230)
    d.node("defect", "Defect",
           ["- defectId: String", "- description: String", "- severity: Severity",
            "- status: String", "+ assign(a: Author): void", "+ resolve(): void"],
           880, 330, 230)
    d.node("checklist", "ChecklistItem",
           ["- itemId: String", "- criterion: String", "- satisfied: boolean",
            "+ evaluate(): boolean"], 880, 540, 230)
    d.edge("doc", "req", "comp", "contains", "1", "1..*")
    d.edge("person", "author", "gen")
    d.edge("person", "reviewer", "gen")
    d.edge("doc", "session", "assoc", "is reviewed in", "1", "0..*")
    d.edge("session", "reviewer", "aggr", "is attended by", "1", "1..*")
    d.edge("session", "defect", "comp", "records", "1", "0..*")
    d.edge("defect", "req", "assoc", "is raised against", "0..*", "1")
    d.edge("defect", "author", "assoc", "is assigned to", "0..*", "0..1")
    d.edge("session", "checklist", "comp", "applies", "1", "1..*")
    d.legend(UML_LEGEND, x=380, y=540)
    return d.xml()


CFG9_Q = """\
"Vantage Systems" Requirements Review

Vantage Systems formalises the inspection of its requirements documents before \
they are baselined. Model the static structure of that process.

a) A requirements document has an ID, title, version and status, and contains \
one or more requirements. A requirement has no existence outside its document: \
deleting the document deletes them.
b) Every requirement has an ID, text and priority.
c) Authors and reviewers are both participants: each has a person ID, full name \
and e-mail. An author additionally has a department; a reviewer has a field of \
expertise. No one is ever simply a participant -- every participant is one or \
the other.
d) A document is reviewed in any number of review sessions over its life; a \
session reviews exactly one document and records the date and its outcome.
e) A session is attended by one or more reviewers. Reviewers exist independently \
of any session and continue to exist when it ends.
f) A session records the defects raised in it; a defect has no meaning apart \
from the session that raised it. Each defect is raised against exactly one \
requirement, and may be assigned to at most one author to fix.
g) Every session applies one or more checklist items, each stating a criterion \
and whether it was satisfied."""

CFG9_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Justify in one sentence each: why Document-Requirement and Session-Defect are \
composition, but Session-Reviewer is only aggregation.
5. Which class is abstract, why should it never be instantiated, and what in \
requirement (c) tells you so?"""


# --------------------------------------------------------------- cfg 10, ERD
def wms_requirements():
    d = Diagram("Cascade WMS - Requirements Traceability Model",
                "Entity-relationship diagram (model answer)")
    d.node("proj", "Project", ["PK projectId: String", "name: String",
                               "startedOn: Date"], 40, 90)
    d.node("baseline", "Baseline", ["PK baselineId: String", "FK projectId: String",
                                    "version: String", "approvedOn: Date"], 40, 250)
    d.node("req", "Requirement", ["PK requirementId: String", "FK baselineId: String",
                                  "text: String", "priority: int",
                                  "status: String"], 320, 250)
    d.node("stake", "Stakeholder", ["PK stakeholderId: String", "fullName: String",
                                    "organisation: String"], 320, 70)
    d.node("raised", "RequirementSource", ["PK sourceId: String",
                                           "FK requirementId: String",
                                           "FK stakeholderId: String",
                                           "capturedOn: Date"], 620, 70)
    d.node("cr", "ChangeRequest", ["PK changeRequestId: String",
                                   "FK requirementId: String",
                                   "FK stakeholderId: String", "reason: String",
                                   "decision: String", "raisedOn: Date"], 620, 250)
    d.node("test", "TestCase", ["PK testCaseId: String", "title: String",
                                "expectedResult: String"], 320, 470)
    d.node("trace", "TraceLink", ["PK traceId: String", "FK requirementId: String",
                                 "FK testCaseId: String", "linkType: String"], 620, 470)
    d.edge("proj", "baseline", "comp", "is baselined as", "1", "0..*")
    d.edge("baseline", "req", "comp", "fixes", "1", "1..*")
    d.edge("stake", "raised", "assoc", "raises", "1", "0..*")
    d.edge("req", "raised", "assoc", "originates from", "1", "1..*")
    d.edge("req", "cr", "assoc", "is subject to", "1", "0..*")
    d.edge("stake", "cr", "assoc", "submits", "1", "0..*")
    d.edge("req", "trace", "assoc", "is verified by", "1", "0..*")
    d.edge("test", "trace", "assoc", "verifies", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=430)
    return d.xml()


CFG10_Q = """\
"Cascade" Warehouse Management System - Requirements Traceability

Cascade's warehouse management project must show, at audit, where every \
requirement came from and how it was verified. Model the domain that records it.

a) A project has an ID, name and start date, and is baselined any number of \
times. A baseline records its version and approval date and cannot exist \
without its project.
b) A baseline fixes one or more requirements. A requirement belongs to exactly \
one baseline and disappears with it; each has an ID, text, priority and status.
c) A stakeholder has an ID, name and organisation, and exists independently of \
any project.
d) Every requirement originates from one or more stakeholders, and a \
stakeholder may be the source of many requirements. The date each origin was \
captured must be recorded.
e) A requirement may be subject to any number of change requests. A change \
request is submitted by exactly one stakeholder and records the reason, the \
decision and when it was raised.
f) A requirement is verified by any number of test cases, and a test case may \
verify several requirements. Each link records its type -- verifies, \
partially verifies, derived from. Test cases exist whether or not they are yet \
linked to anything."""

CFG10_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Resolve BOTH many-to-many relationships -- (d) and (f) -- with associative \
entities that carry their own attributes.
4. Justify in one sentence each why Project-Baseline and Baseline-Requirement \
are identifying relationships, while Stakeholder-ChangeRequest is not.
5. Requirement (f) says test cases exist before they are linked. State what \
that rules out about the cardinality on the TestCase end, and why."""


BATCH = [
    (6, CFG6_Q, CFG6_I, warehouse_inventory),
    (7, CFG7_Q, CFG7_I, library_static),
    (8, CFG8_Q, CFG8_I, expense_approval),
    (9, CFG9_Q, CFG9_I, review_workflow),
    (10, CFG10_Q, CFG10_I, wms_requirements),
]


def main():
    db = SessionLocal()
    for config_id, question, instructions, build in BATCH:
        xml = build()
        row = db.execute(text(
            "select question_id from public.diagram_question_configs "
            "where diagram_question_config_id = :c"), {"c": config_id}).fetchone()
        if row is None:
            print("  cfg %-4s NOT FOUND" % config_id)
            continue
        db.execute(text("update public.questions set question_text = :q where question_id = :id"),
                   {"q": question.strip() + MARKER + instructions.strip(), "id": row[0]})
        db.execute(text("""
            update public.diagram_question_configs
               set instructions = :i, reference_diagram_xml = :x
             where diagram_question_config_id = :c"""),
            {"i": instructions.strip(), "x": xml, "c": config_id})
        db.commit()
        print("  cfg %-4s stem %5d chars   reference %5d chars, %2d cells"
              % (config_id, len(question) + len(instructions), len(xml), xml.count("<mxCell")))
    print()
    print("batch 1 written: %d questions" % len(BATCH))


if __name__ == "__main__":
    main()
