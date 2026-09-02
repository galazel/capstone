"""Batch 2: eight diagram questions as full briefs, with model answers.

Includes a redo of cfg 8, written in batch 1 before the builder could draw
decision diamonds. A decision rendered as a rectangle is not a decision, and
the reference is what a learner is shown as correct.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal
from app.domain.diagrams.mxgraph import Diagram, ERD_LEGEND, UML_LEGEND

MARKER = "\n\nTasks\n"

PROCESS_LEGEND = [
    "stadium = start / end",
    "rounded box = action or process step",
    "rhombus = decision, every branch carries its guard",
    "thick bar = fork / join (concurrent paths)",
]


# ------------------------------------------------ cfg 8, ACTIVITY (redo)
def expense_approval():
    d = Diagram("Helios Expense Management - Claim Approval",
                "UML activity diagram (model answer)")
    d.shape("start", "", "start", 120, 100, 40, 40)
    d.shape("submit", "Submit expense claim", "action", 60, 180, 180, 50)
    d.shape("validate", "Validate receipts\nagainst policy limits", "action", 60, 260, 180, 55)
    d.shape("d1", "receipts\ncomplete?", "decision", 80, 350, 140, 90)
    d.shape("ret", "Return claim\nto employee", "action", 320, 365, 160, 55)
    d.shape("d2", "amount\n> 500?", "decision", 80, 480, 140, 90)
    d.shape("fork", "", "bar", 400, 500, 10, 160)
    d.shape("mgr", "Line manager\nreviews claim", "action", 60, 620, 170, 55)
    d.shape("fin", "Finance officer\nreviews claim", "action", 470, 620, 170, 55)
    d.shape("join", "", "bar", 400, 710, 10, 160)
    d.shape("d3", "all approvals\ngiven?", "decision", 200, 790, 150, 90)
    d.shape("pay", "Schedule\nreimbursement", "action", 60, 910, 170, 55)
    d.shape("notify", "Notify employee\nof outcome", "action", 330, 910, 170, 55)
    d.shape("end", "", "end", 220, 1010, 40, 40)
    d.flow("start", "submit")
    d.flow("submit", "validate")
    d.flow("validate", "d1")
    d.flow("d1", "ret", "[no]")
    d.flow("ret", "submit", "resubmit")
    d.flow("d1", "d2", "[yes]")
    d.flow("d2", "mgr", "[<= 500: manager only]")
    d.flow("d2", "fork", "[> 500: both required]")
    d.flow("fork", "mgr")
    d.flow("fork", "fin")
    d.flow("mgr", "join")
    d.flow("fin", "join")
    d.flow("join", "d3")
    d.flow("d3", "pay", "[yes]")
    d.flow("d3", "notify", "[no: rejected]")
    d.flow("pay", "notify")
    d.flow("notify", "end")
    d.legend(PROCESS_LEGEND, x=700, y=120)
    return d.xml()


CFG8_Q = """\
"Helios" Expense Management - Claim Approval Process

Helios is automating the approval of employee expense claims. The process must \
be modelled before it is built.

a) An employee submits a claim. The system validates it against the receipt \
rules and the policy limits.
b) If any receipt is missing or unreadable the claim is returned to the \
employee, who may correct and resubmit it. A claim may go round this loop any \
number of times.
c) A claim of 500 or less needs the line manager's approval only.
d) A claim over 500 needs the line manager's AND the finance officer's \
approval. Those two reviews are independent: they may happen in either order or \
at the same time, and the claim proceeds only once both are in.
e) If every required approval is given the reimbursement is scheduled. If any \
approver rejects it, no reimbursement is scheduled.
f) In both cases the employee is notified of the outcome, and the process then \
ends."""

CFG8_I = """\
1. Draw the activity diagram with exactly one initial node and one final node.
2. Show every action in requirements (a) to (f) as an activity.
3. Model (b) as a loop returning to submission, not as a branch that terminates.
4. Model (d) with a fork and a join. Explain in one sentence why a decision node \
would model it incorrectly.
5. Label EVERY decision branch with its guard, and state which guard makes the \
two-approval path the exception rather than the default."""


# ----------------------------------------------------- cfg 11, UML_CLASS
def learning_platform():
    d = Diagram("Lumen Learning Platform - Class Model",
                "UML class diagram (model answer)")
    d.node("user", "User", ["# userId: String", "# email: String", "# fullName: String",
                            "+ authenticate(pw: String): boolean",
                            "+ displayName(): String"], 40, 100, 240, abstract=True)
    d.node("student", "Student", ["- enrolledOn: Date", "- creditsEarned: int",
                                  "+ enrol(c: Course): Enrolment",
                                  "+ progress(c: Course): double"], 40, 320, 230)
    d.node("instructor", "Instructor", ["- staffNumber: String", "- specialism: String",
                                        "+ publish(c: Course): void",
                                        "+ grade(s: Submission): Grade"], 310, 320, 230)
    d.node("course", "Course", ["- courseId: String", "- title: String",
                                "- credits: int", "- published: boolean",
                                "+ addModule(m: Module): void",
                                "+ isOpen(): boolean"], 600, 100, 240)
    d.node("module", "Module", ["- moduleId: String", "- title: String",
                                "- sequence: int", "+ duration(): int",
                                "+ addLesson(l: Lesson): void"], 600, 320, 240)
    d.node("lesson", "Lesson", ["- lessonId: String", "- title: String",
                                "- bodyRef: String", "+ estimatedMinutes(): int",
                                "+ markComplete(s: Student): void"], 600, 520, 240)
    d.node("enrol", "Enrolment", ["- enrolmentId: String", "- startedOn: Date",
                                  "- status: String", "+ complete(): void",
                                  "+ percentDone(): double"], 900, 320, 230)
    d.node("assess", "Assessment", ["- assessmentId: String", "- title: String",
                                    "- passMark: int", "+ open(): void",
                                    "+ mark(s: Submission): Grade"], 900, 100, 230)
    d.node("submission", "Submission", ["- submissionId: String",
                                        "- submittedOn: Date", "- content: String",
                                        "+ isLate(): boolean",
                                        "+ resubmit(): void"], 900, 520, 230)
    d.edge("user", "student", "gen")
    d.edge("user", "instructor", "gen")
    d.edge("course", "module", "comp", "is built from", "1", "1..*")
    d.edge("module", "lesson", "comp", "contains", "1", "1..*")
    d.edge("student", "enrol", "assoc", "holds", "1", "0..*")
    d.edge("course", "enrol", "assoc", "is taken through", "1", "0..*")
    d.edge("instructor", "course", "aggr", "teaches", "1..*", "0..*")
    d.edge("course", "assess", "comp", "is assessed by", "1", "0..*")
    d.edge("assess", "submission", "assoc", "receives", "1", "0..*")
    d.edge("student", "submission", "assoc", "makes", "1", "0..*")
    d.legend(UML_LEGEND, x=310, y=560)
    return d.xml()


CFG11_Q = """\
"Lumen" Online Learning Platform

Lumen is designing a platform for university short courses. Model its static \
structure.

a) Students and instructors are both users: each has a user ID, e-mail and full \
name. A student additionally has an enrolment date and credits earned; an \
instructor has a staff number and a specialism. Nobody is only a user.
b) A course has an ID, title, credit value and a published flag. A course is \
built from one or more modules, and a module from one or more lessons. Neither \
a module nor a lesson has any meaning outside the course it belongs to: \
deleting a course deletes both.
c) A course is taught by one or more instructors, and an instructor may teach \
many courses. Instructors are employed by the university and remain on the \
system when a course is retired.
d) A student takes a course through an enrolment, which records the start date \
and a status. A student holds many enrolments over time; a course is taken \
through many enrolments.
e) A course is assessed by any number of assessments, each with a title and a \
pass mark. An assessment belongs to exactly one course and is removed with it.
f) A student makes submissions against an assessment. A submission records when \
it was submitted and its content; an assessment receives many submissions and a \
student makes many."""

CFG11_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, choosing correctly \
between association, aggregation, composition and generalisation.
4. Justify in one sentence each: why Course-Module is composition but \
Instructor-Course is only aggregation.
5. Which class is abstract, why should it never be instantiated, and which \
sentence in requirement (a) tells you so?"""


# ----------------------------------------------------- cfg 12, UML_CLASS
def payment_layers():
    d = Diagram("Arcus Payments - Layered Architecture Class Model",
                "UML class diagram (model answer)")
    d.node("ctl", "PaymentController", ["- endpoint: String",
                                        "+ submit(r: PaymentRequest): PaymentResult",
                                        "+ status(id: String): PaymentStatus"], 40, 110, 250)
    d.node("svc", "PaymentService", ["- retryLimit: int",
                                     "+ process(p: Payment): PaymentResult",
                                     "+ refund(p: Payment): boolean"], 40, 300, 250)
    d.node("repo", "PaymentRepository", ["- connectionRef: String",
                                         "+ save(p: Payment): void",
                                         "+ findById(id: String): Payment"], 40, 490, 250)
    d.node("gateway", "PaymentGateway", ["# timeoutMs: int",
                                         "+ authorise(p: Payment): AuthResult",
                                         "+ capture(a: AuthResult): boolean"],
           360, 300, 240, abstract=True)
    d.node("card", "CardGateway", ["- acquirerUrl: String",
                                   "+ authorise(p: Payment): AuthResult",
                                   "+ tokenise(c: Card): String"], 330, 500, 230)
    d.node("wallet", "WalletGateway", ["- walletApiKey: String",
                                       "+ authorise(p: Payment): AuthResult",
                                       "+ balance(w: String): double"], 600, 500, 230)
    d.node("payment", "Payment", ["- paymentId: String", "- amount: double",
                                  "- currency: String", "- status: PaymentStatus",
                                  "+ isSettled(): boolean", "+ total(): double"], 680, 110, 240)
    d.node("line", "PaymentLine", ["- lineId: String", "- description: String",
                                   "- amount: double", "+ subtotal(): double",
                                   "+ applyTax(r: double): void"], 680, 320, 240)
    d.node("merchant", "Merchant", ["- merchantId: String", "- name: String",
                                    "- settlementAccount: String",
                                    "+ feeFor(p: Payment): double",
                                    "+ isActive(): boolean"], 960, 110, 240)
    d.node("audit", "AuditEntry", ["- entryId: String", "- occurredAt: Date",
                                   "- action: String", "+ describe(): String",
                                   "+ actor(): String"], 960, 320, 240)
    d.edge("ctl", "svc", "dep", "delegates to")
    d.edge("svc", "repo", "dep", "persists via")
    d.edge("svc", "gateway", "dep", "authorises through")
    d.edge("gateway", "card", "gen")
    d.edge("gateway", "wallet", "gen")
    d.edge("payment", "line", "comp", "consists of", "1", "1..*")
    d.edge("merchant", "payment", "aggr", "receives", "1", "0..*")
    d.edge("payment", "audit", "comp", "records", "1", "0..*")
    d.edge("repo", "payment", "assoc", "stores", "1", "0..*")
    d.legend(UML_LEGEND + ["dashed open arrow = dependency (uses)"], x=330, y=680)
    return d.xml()


CFG12_Q = """\
"Arcus" Payment Processing - Layered Design

Arcus is a fintech startup building a payment service on a strict layered \
architecture. Model its static structure.

a) A request enters at the controller layer, which delegates to a service \
layer; the service layer persists through a repository and authorises through a \
gateway. Each layer uses the one below it and knows nothing of the one above.
b) Card and wallet gateways are both payment gateways: every gateway has a \
timeout and can authorise and capture. A card gateway additionally holds an \
acquirer URL and can tokenise a card; a wallet gateway holds an API key and can \
report a balance. A bare gateway is never used directly -- one of the two \
concrete kinds always is.
c) A payment has an ID, amount, currency and status, and consists of one or \
more payment lines. A line cannot exist apart from its payment.
d) A payment is received on behalf of exactly one merchant. Merchants have an \
ID, name and settlement account, and remain on the platform after their \
payments are archived.
e) Every payment records any number of audit entries, each with a timestamp and \
an action. Audit entries are deleted with the payment they belong to."""

CFG12_I = """\
1. Identify the classes and their attributes, with data types and visibility \
(+ public, - private, # protected).
2. Add at least two operations per class, with parameters and return types.
3. Draw the relationships with multiplicities at BOTH ends, and show the \
layer-to-layer relationships of requirement (a) as dependencies rather than \
associations.
4. Justify in one sentence each: why Payment-PaymentLine is composition, but \
Merchant-Payment is only aggregation.
5. Which class is abstract, why should it never be instantiated, and what would \
break in requirement (a) if the service layer depended on CardGateway directly?"""


# ------------------------------------------------------ cfg 13, FLOWCHART
def code_review_flow():
    d = Diagram("Meridian Logistics - Code Review and Merge Process",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 120, 90, 140, 45)
    d.shape("branch", "Create feature branch", "action", 100, 165, 180, 50)
    d.shape("commit", "Commit changes\nand push", "action", 100, 245, 180, 55)
    d.shape("ci", "Automated build\nand unit tests run", "action", 100, 330, 180, 55)
    d.shape("d1", "build and\ntests pass?", "decision", 110, 420, 160, 95)
    d.shape("fix1", "Fix defects\nlocally", "action", 350, 435, 160, 55)
    d.shape("pr", "Open pull request", "action", 100, 555, 180, 50)
    d.shape("review", "Peer reviews\nthe change", "action", 100, 635, 180, 55)
    d.shape("d2", "reviewer\napproves?", "decision", 110, 725, 160, 95)
    d.shape("rework", "Address review\ncomments", "action", 350, 740, 160, 55)
    d.shape("d3", "second approval\nrequired?", "decision", 110, 855, 160, 95)
    d.shape("second", "Second reviewer\napproves", "action", 350, 870, 160, 55)
    d.shape("merge", "Merge to main", "action", 100, 990, 180, 50)
    d.shape("deploy", "Deploy to staging", "action", 100, 1065, 180, 50)
    d.shape("e", "End", "terminator", 120, 1140, 140, 45)
    d.flow("s", "branch")
    d.flow("branch", "commit")
    d.flow("commit", "ci")
    d.flow("ci", "d1")
    d.flow("d1", "fix1", "[no]")
    d.flow("fix1", "commit")
    d.flow("d1", "pr", "[yes]")
    d.flow("pr", "review")
    d.flow("review", "d2")
    d.flow("d2", "rework", "[no]")
    d.flow("rework", "commit")
    d.flow("d2", "d3", "[yes]")
    d.flow("d3", "second", "[yes: touches payment code]")
    d.flow("second", "merge")
    d.flow("d3", "merge", "[no]")
    d.flow("merge", "deploy")
    d.flow("deploy", "e")
    d.legend(PROCESS_LEGEND, x=620, y=120)
    return d.xml()


CFG13_Q = """\
"Meridian Logistics" Code Review and Merge Process

Meridian's platform team is writing down the process every change must follow \
before it reaches main. Model it as a flowchart.

a) A developer creates a feature branch, commits their changes and pushes them.
b) Every push triggers an automated build and the unit test suite.
c) If the build or any test fails, the developer fixes the defects locally and \
commits again. This may happen any number of times.
d) Once the build is green the developer opens a pull request, which a peer \
reviews.
e) If the reviewer does not approve, the developer addresses the comments and \
commits again -- returning to the same build and test step, not straight back \
to review.
f) A change that touches the payment code requires a second reviewer's approval \
as well; any other change does not.
g) Once every required approval is in, the change is merged to main and \
deployed to staging, and the process ends."""

CFG13_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (g), using the correct symbol for \
each: terminator, process step, decision.
3. Label EVERY decision branch with its guard condition.
4. Requirement (e) says rework returns to the build step, not to review. Show \
that loop correctly and explain in one sentence why returning straight to \
review would be wrong.
5. Requirement (f) is conditional. Show it as a decision rather than as an \
always-executed step, and state what the guard is."""


# ------------------------------------------------------ cfg 14, FLOWCHART
def sdlc_testing():
    d = Diagram("SDLC with Verification Points",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 120, 90, 140, 45)
    d.shape("req", "Gather requirements", "action", 100, 165, 180, 50)
    d.shape("rev1", "Review requirements\n(static)", "action", 360, 165, 180, 55)
    d.shape("d1", "requirements\nbaselined?", "decision", 110, 250, 160, 90)
    d.shape("design", "Produce design", "action", 100, 370, 180, 50)
    d.shape("rev2", "Design walkthrough\n(static)", "action", 360, 370, 180, 55)
    d.shape("code", "Implement code", "action", 100, 455, 180, 50)
    d.shape("unit", "Unit testing\n(dynamic)", "action", 360, 455, 180, 55)
    d.shape("integ", "Integration testing\n(dynamic)", "action", 100, 545, 180, 55)
    d.shape("sys", "System testing\n(dynamic)", "action", 100, 635, 180, 55)
    d.shape("d2", "exit criteria\nmet?", "decision", 110, 725, 160, 90)
    d.shape("defect", "Log and fix\ndefects", "action", 360, 740, 180, 55)
    d.shape("uat", "Acceptance testing\nwith the customer", "action", 100, 855, 180, 55)
    d.shape("d3", "accepted?", "decision", 110, 945, 160, 85)
    d.shape("release", "Release to production", "action", 100, 1065, 180, 50)
    d.shape("e", "End", "terminator", 120, 1140, 140, 45)
    d.flow("s", "req")
    d.flow("req", "rev1")
    d.flow("rev1", "d1")
    d.flow("d1", "req", "[no: rework]")
    d.flow("d1", "design", "[yes]")
    d.flow("design", "rev2")
    d.flow("rev2", "code")
    d.flow("code", "unit")
    d.flow("unit", "integ")
    d.flow("integ", "sys")
    d.flow("sys", "d2")
    d.flow("d2", "defect", "[no]")
    d.flow("defect", "code")
    d.flow("d2", "uat", "[yes]")
    d.flow("uat", "d3")
    d.flow("d3", "defect", "[no]")
    d.flow("d3", "release", "[yes]")
    d.flow("release", "e")
    d.legend(PROCESS_LEGEND + ["static = examined without executing"], x=620, y=560)
    return d.xml()


CFG14_Q = """\
Software Development Lifecycle with Verification Points

A quality manager is documenting where verification happens across the \
lifecycle, so that no phase is completed without evidence. Model the process.

a) Requirements are gathered and then reviewed statically -- examined, not \
executed. If the review does not baseline them, they are gathered again.
b) Once baselined, a design is produced and put through a design walkthrough, \
which is also static.
c) Code is implemented, then exercised dynamically: unit testing, then \
integration testing, then system testing, in that order.
d) After system testing the exit criteria are checked. If they are not met, \
defects are logged and fixed, and the process returns to implementation -- not \
to design.
e) When the exit criteria are met, acceptance testing is carried out with the \
customer.
f) If the customer does not accept, the defects are logged and fixed on the same \
path as (d). If they accept, the software is released and the process ends."""

CFG14_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (f) with the correct symbol.
3. Mark which verification steps are static and which are dynamic, and explain \
in one sentence what distinguishes them.
4. Label EVERY decision branch with its guard, and show both rework loops \
returning to the correct step.
5. Requirement (c) fixes the order of the three dynamic levels. State in one \
sentence what each level can find that the one before it cannot."""


# ------------------------------------------------------ cfg 15, FLOWCHART
def adaptive_maintenance():
    d = Diagram("Accounting System - Platform Upgrade Response",
                "Flowchart (model answer)")
    d.shape("s", "Start: vendor announces\nplatform upgrade", "terminator", 90, 90, 220, 55)
    d.shape("assess", "Assess impact on\nthe accounting system", "action", 110, 175, 180, 55)
    d.shape("d1", "system affected?", "decision", 120, 265, 160, 90)
    d.shape("monitor", "Record and\nmonitor only", "action", 380, 280, 170, 55)
    d.shape("d2", "change is a\ndefect fix?", "decision", 120, 385, 160, 95)
    d.shape("corr", "Corrective\nmaintenance", "action", 380, 400, 170, 55)
    d.shape("d3", "driven by the\nenvironment?", "decision", 120, 515, 160, 95)
    d.shape("adapt", "Adaptive\nmaintenance", "action", 380, 530, 170, 55)
    d.shape("d4", "new user\nrequirement?", "decision", 120, 645, 160, 95)
    d.shape("perf", "Perfective\nmaintenance", "action", 380, 660, 170, 55)
    d.shape("prev", "Preventive\nmaintenance", "action", 110, 780, 180, 55)
    d.shape("plan", "Plan and schedule\nthe change", "action", 110, 865, 180, 55)
    d.shape("impl", "Implement\nand regression test", "action", 110, 950, 180, 55)
    d.shape("d5", "regression\npasses?", "decision", 120, 1040, 160, 90)
    d.shape("fix", "Repair the\nregression", "action", 380, 1055, 170, 55)
    d.shape("rel", "Release the change", "action", 110, 1160, 180, 50)
    d.shape("e", "End", "terminator", 130, 1235, 140, 45)
    d.flow("s", "assess")
    d.flow("assess", "d1")
    d.flow("d1", "monitor", "[no]")
    d.flow("monitor", "e")
    d.flow("d1", "d2", "[yes]")
    d.flow("d2", "corr", "[yes]")
    d.flow("corr", "plan")
    d.flow("d2", "d3", "[no]")
    d.flow("d3", "adapt", "[yes]")
    d.flow("adapt", "plan")
    d.flow("d3", "d4", "[no]")
    d.flow("d4", "perf", "[yes]")
    d.flow("perf", "plan")
    d.flow("d4", "prev", "[no]")
    d.flow("prev", "plan")
    d.flow("plan", "impl")
    d.flow("impl", "d5")
    d.flow("d5", "fix", "[no]")
    d.flow("fix", "impl")
    d.flow("d5", "rel", "[yes]")
    d.flow("rel", "e")
    d.legend(PROCESS_LEGEND, x=650, y=200)
    return d.xml()


CFG15_Q = """\
"Ledgerline" Accounting System - Responding to a Platform Upgrade

Ledgerline's accounting software must keep running as the database and \
operating system beneath it are upgraded. The maintenance team wants the \
decision process written down, so that every change is classified before it is \
scheduled.

a) When a vendor announces a platform upgrade, the team assesses its impact on \
the accounting system. If the system is not affected, the change is recorded, \
monitored, and the process ends.
b) If it is affected, the change is classified. A change that repairs a defect \
in the delivered system is corrective maintenance.
c) A change driven by the environment moving underneath the system -- a new \
database version, a changed OS API -- while its own requirements are unchanged, \
is adaptive maintenance.
d) A change that answers a new or refined user requirement is perfective \
maintenance.
e) A change that is none of those -- refactoring, raising test coverage, \
addressing technical debt, with no visible change for users -- is preventive \
maintenance.
f) Whichever it is, the change is then planned and scheduled, implemented, and \
regression tested. If regression fails, the regression is repaired and \
retested. Once it passes, the change is released and the process ends."""

CFG15_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show the classification in requirements (b) to (e) as a chain of decisions, \
each with its guard, reaching exactly one of the four maintenance categories.
3. Show the common path of requirement (f) once, not four times, and explain in \
one sentence why duplicating it would be a modelling error.
4. Show the regression loop returning to implementation.
5. Requirement (c) says the system's own requirements are unchanged. State in \
one sentence why that single fact is what separates adaptive from perfective."""


# ----------------------------------------------------------- cfg 16, ERD
def hospital_admissions():
    d = Diagram("St Aidan's Hospital - Admissions Domain Model",
                "Entity-relationship diagram (model answer)")
    d.node("patient", "Patient", ["PK patientId: String", "nhsNumber: String",
                                  "fullName: String", "dateOfBirth: Date"], 40, 90)
    d.node("adm", "Admission", ["PK admissionId: String", "FK patientId: String",
                                "FK wardId: String", "admittedOn: Date",
                                "dischargedOn: Date"], 320, 90)
    d.node("ward", "Ward", ["PK wardId: String", "name: String",
                            "specialty: String", "bedCount: int"], 620, 90)
    d.node("bed", "Bed", ["PK bedId: String", "FK wardId: String",
                          "bedNumber: String", "status: String"], 620, 270)
    d.node("clin", "Clinician", ["PK clinicianId: String", "fullName: String",
                                 "registrationNo: String", "grade: String"], 900, 90)
    d.node("care", "CareEpisode", ["PK episodeId: String", "FK admissionId: String",
                                   "FK clinicianId: String", "startedOn: Date",
                                   "role: String"], 900, 280)
    d.node("diag", "Diagnosis", ["PK diagnosisId: String", "FK admissionId: String",
                                 "code: String", "description: String",
                                 "isPrimary: boolean"], 320, 300)
    d.node("transfer", "Transfer", ["PK transferId: String", "FK admissionId: String",
                                    "FK fromBedId: String", "FK toBedId: String",
                                    "movedOn: Date"], 320, 500)
    d.edge("patient", "adm", "assoc", "is admitted as", "1", "0..*")
    d.edge("ward", "adm", "assoc", "receives", "1", "0..*")
    d.edge("ward", "bed", "comp", "contains", "1", "1..*")
    d.edge("adm", "diag", "comp", "records", "1", "1..*")
    d.edge("adm", "transfer", "comp", "involves", "1", "0..*")
    d.edge("bed", "transfer", "assoc", "is moved between", "1", "0..*")
    d.edge("adm", "care", "comp", "is managed through", "1", "1..*")
    d.edge("clin", "care", "assoc", "leads", "1", "0..*")
    d.legend(ERD_LEGEND, x=900, y=490)
    return d.xml()


CFG16_Q = """\
"St Aidan's Hospital" Admissions and Discharge

St Aidan's is replacing the system that tracks patients through the hospital. \
Model the domain.

a) A patient has an ID, NHS number, full name and date of birth, and exists on \
the system whether or not they are currently in hospital.
b) A patient is admitted any number of times over their life. An admission \
records the admission and discharge dates and belongs to exactly one patient.
c) An admission is received by exactly one ward. A ward has an ID, name, \
specialty and bed count, and receives many admissions.
d) A ward contains one or more beds. A bed has no meaning apart from its ward: \
closing a ward removes its beds.
e) Every admission records one or more diagnoses, each with a code, description \
and a flag marking the primary one. A diagnosis belongs to its admission and is \
removed with it.
f) During an admission a patient may be transferred between beds any number of \
times. A transfer records the bed moved from, the bed moved to, and the date.
g) An admission is managed through one or more care episodes, each led by \
exactly one clinician and recording that clinician's role. Clinicians are \
employed by the hospital and remain on the system after an admission ends."""

CFG16_I = """\
1. Identify the entities and their attributes, marking primary keys (PK) and \
foreign keys (FK).
2. Draw every relationship with its cardinality at BOTH ends.
3. Requirement (f) has two foreign keys to the same entity. Show both, and name \
them so their roles are distinguishable.
4. Justify in one sentence each why Ward-Bed, Admission-Diagnosis and \
Admission-CareEpisode are identifying relationships, while \
Clinician-CareEpisode is not.
5. Requirement (a) says a patient exists whether or not they are in hospital. \
State what that fixes about the cardinality on the Patient end of Admission, \
and why."""


# ------------------------------------------------------ cfg 17, FLOWCHART
def re_process():
    d = Diagram("Requirements Engineering Process",
                "Flowchart (model answer)")
    d.shape("s", "Start", "terminator", 130, 90, 140, 45)
    d.shape("elicit", "Elicit requirements\nfrom stakeholders", "action", 110, 165, 190, 55)
    d.shape("analyse", "Analyse and\nnegotiate", "action", 110, 255, 190, 55)
    d.shape("d1", "conflicts\nresolved?", "decision", 125, 345, 160, 90)
    d.shape("neg", "Negotiate with\nstakeholders", "action", 390, 360, 180, 55)
    d.shape("spec", "Specify: write the\nrequirements document", "action", 110, 465, 190, 55)
    d.shape("val", "Validate with\nstakeholders", "action", 110, 555, 190, 55)
    d.shape("d2", "requirements\nagreed?", "decision", 125, 645, 160, 90)
    d.shape("rework", "Revise the\nspecification", "action", 390, 660, 180, 55)
    d.shape("base", "Baseline the\nspecification", "action", 110, 765, 190, 55)
    d.shape("d3", "change request\nreceived?", "decision", 125, 855, 160, 95)
    d.shape("impact", "Assess impact and\nupdate the baseline", "action", 390, 870, 190, 55)
    d.shape("e", "End", "terminator", 130, 985, 140, 45)
    d.flow("s", "elicit")
    d.flow("elicit", "analyse")
    d.flow("analyse", "d1")
    d.flow("d1", "neg", "[no]")
    d.flow("neg", "elicit")
    d.flow("d1", "spec", "[yes]")
    d.flow("spec", "val")
    d.flow("val", "d2")
    d.flow("d2", "rework", "[no]")
    d.flow("rework", "spec")
    d.flow("d2", "base", "[yes]")
    d.flow("base", "d3")
    d.flow("d3", "impact", "[yes]")
    d.flow("impact", "d3")
    d.flow("d3", "e", "[no]")
    d.legend(PROCESS_LEGEND, x=650, y=200)
    return d.xml()


CFG17_Q = """\
Requirements Engineering Process at "Northgate Software"

Northgate's process group is documenting how requirements are produced and kept \
current, so that every project follows the same route. Model it.

a) Requirements are elicited from stakeholders, then analysed and negotiated.
b) If conflicts between stakeholders remain unresolved, the team negotiates and \
returns to elicitation. This may happen any number of times.
c) Once conflicts are resolved, the requirements are specified -- written up as \
a requirements document.
d) The specification is validated with the stakeholders. If they do not agree \
it, the specification is revised and validated again; the team does NOT return \
to elicitation for this.
e) When the stakeholders agree, the specification is baselined.
f) After baselining, any change request received is assessed for impact and the \
baseline is updated; the process then waits for the next change request. The \
process ends only when no further change request is outstanding."""

CFG17_I = """\
1. Draw the flowchart with one start terminator and one end terminator.
2. Show every step in requirements (a) to (f) with the correct symbol.
3. Label EVERY decision branch with its guard.
4. Requirements (b) and (d) both loop, but to different places. Show both \
correctly and explain in one sentence why a failed validation must not return \
to elicitation.
5. Requirement (f) describes requirements MANAGEMENT rather than requirements \
DEVELOPMENT. State in one sentence what distinguishes the two, and mark on your \
diagram where one ends and the other begins."""


BATCH = [
    (8, CFG8_Q, CFG8_I, expense_approval),
    (11, CFG11_Q, CFG11_I, learning_platform),
    (12, CFG12_Q, CFG12_I, payment_layers),
    (13, CFG13_Q, CFG13_I, code_review_flow),
    (14, CFG14_Q, CFG14_I, sdlc_testing),
    (15, CFG15_Q, CFG15_I, adaptive_maintenance),
    (16, CFG16_Q, CFG16_I, hospital_admissions),
    (17, CFG17_Q, CFG17_I, re_process),
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
    print("batch 2 written: %d questions" % len(BATCH))


if __name__ == "__main__":
    main()
