"""Understanding of IT Business -> IT Business Fundamentals (MID 126).

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
most sections carrying more than one block, and no coloured card grids.

Written against TOPCIT ESSENCE Business Field (Ver.2), sections "Understanding
of the IT Business Service" and the ISMP/ISP/EA material.
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_BIZ_FUNDAMENTALS = 126

ERP_DIAGRAM = "/lesson-media/erp-shared-database.svg"
SCM_DIAGRAM = "/lesson-media/supply-chain.svg"
EA_DIAGRAM = "/lesson-media/enterprise-architecture.svg"
# ===========================================================================
# Enterprise Solutions: ERP, SCM, and CRM
# ===========================================================================

_ent_sections = [
    ("Why Enterprise Solutions Exist", [
        desc(
            "Before integrated systems, each department ran its own software: "
            "finance had a ledger, the warehouse had a stock system, sales had "
            "a contact database. Each was reasonable in isolation, chosen by "
            "people who understood that department's needs."
        ),
        desc(
            "The combination was not reasonable, because the same fact was "
            "recorded separately in several places and the copies inevitably "
            "diverged. A customer's address existed in three systems and "
            "differed in two of them, and nobody could say which was right."
        ),
    ]),

    ("The Symptom Everyone Recognises", [
        desc(
            "The visible consequence was that nobody could answer a question "
            "spanning departments without a reconciliation exercise. 'What did "
            "this customer cost us to serve?' required somebody to join three "
            "systems by hand in a spreadsheet."
        ),
        desc(
            "The answer arrived a week late, disputed by at least one "
            "department, and was obsolete by the time the argument was "
            "settled. Enterprise solutions exist to remove that join entirely, "
            "by holding the fact once."
        ),
    ]),

    ("The Integration Problem in Numbers", [
        desc(
            "Point-to-point integration is what an organisation gets by "
            "default, one interface at a time, each individually justified. It "
            "scales badly for a reason that is arithmetic rather than "
            "architectural: connecting n systems pairwise needs n(n-1)/2 "
            "interfaces."
        ),
        desc(
            "Six systems need fifteen interfaces. Ten need forty-five. Each is "
            "code somebody must maintain through every upgrade at both ends, "
            "and each fails independently. This is the same arithmetic that "
            "made symmetric key distribution unworkable in the security "
            "module, and it produces the same conclusion: pairwise "
            "relationships do not scale."
        ),
    ]),

    ("The Three Core Systems", [
        desc(
            "Three systems are discussed together constantly and answer "
            "genuinely different questions about different parts of the "
            "business. A memory hook that survives exams: ERP looks INSIDE the "
            "organisation, SCM looks UPSTREAM toward suppliers, CRM looks "
            "DOWNSTREAM toward customers."
        ),
        sub("ERP - Enterprise Resource Planning"),
        desc(
            "Internal operations on one shared database: finance, human "
            "resources, manufacturing, procurement, inventory. It concerns how "
            "the organisation runs itself."
        ),
        sub("SCM - Supply Chain Management"),
        desc(
            "The flow of goods and information from suppliers through "
            "production to customers. It concerns relationships with parties "
            "the organisation does not control."
        ),
        sub("CRM - Customer Relationship Management"),
        desc(
            "Every interaction with customers and prospects: sales pipeline, "
            "marketing campaigns, service history, complaints. It concerns "
            "demand and the relationships that generate it."
        ),
    ]),

    ("ERP and the Single Shared Database", [
        desc(
            "ERP's defining characteristic is the single shared database. When "
            "a warehouse records a goods receipt, the finance module sees the "
            "liability immediately, because there is no second copy to "
            "synchronise and no interface to fail."
        ),
        image(ERP_DIAGRAM),
    ]),

    ("What ERP Actually Delivers", [
        ul([
            "One record of each fact, so departments cannot disagree about "
            "what happened -- disputes become about interpretation rather than "
            "about data",
            "Standardised processes across the organisation, which is often "
            "the real change being bought and the real source of resistance",
            "Real-time visibility, since there is no batch reconciliation "
            "between modules and no overnight window during which the answer "
            "is unknown",
            "Regulatory and audit reporting from one source rather than a "
            "spreadsheet assembled by hand from four extracts",
            "A single customer and product master, which is what makes "
            "cross-departmental analysis possible at all",
        ]),
    ]),

    ("Why ERP Implementations Fail", [
        desc(
            "ERP has an unusually poor delivery record, and the causes are "
            "remarkably consistent across industries and decades. The system "
            "embodies a way of working, so adopting it means changing how "
            "people work."
        ),
        desc(
            "Organisations systematically underestimate that, treating a "
            "business change programme as a software installation and staffing "
            "it accordingly. The result is a system that works technically and "
            "that nobody uses as intended."
        ),
    ]),

    ("The Recurring Failure Causes", [
        accordion([
            ("Excessive customisation",
             "Modifying the package to match existing processes destroys the "
             "benefit twice over: it costs enormously up front, and every "
             "subsequent vendor upgrade must be reconciled with the "
             "modifications and retested. The discipline is to change the "
             "process to fit the package unless the process is genuinely a "
             "competitive advantage."),
            ("Underestimating change management",
             "Staff who have worked one way for fifteen years will not adopt a "
             "new way because a system went live on Monday. Training, "
             "communication and visible executive sponsorship are the project "
             "rather than overhead on it, and budgets that treat them as "
             "overhead are the ones that fail."),
            ("Poor data migration",
             "Legacy data is always dirtier than anyone believes. Duplicate "
             "customers, obsolete part numbers and inconsistent codes migrate "
             "faithfully into the new system and immediately destroy "
             "confidence in it -- and confidence, once lost at go-live, is "
             "very hard to recover."),
            ("Big bang cutover",
             "Switching every module and every site on one weekend "
             "concentrates all risk into a single irreversible moment with no "
             "way back. Phased rollout costs more in total and fails far more "
             "survivably."),
            ("Absent executive sponsorship",
             "Cross-departmental process change requires authority to settle "
             "disputes between departments. Without it the project negotiates "
             "endlessly and delivers a compromise that satisfies nobody and "
             "preserves the inefficiencies both sides wanted to keep."),
        ]),
    ]),

    ("Supply Chain Management", [
        desc(
            "SCM coordinates the movement of goods and the information about "
            "them across organisational boundaries. Its distinctive difficulty "
            "is that most of the participants are not you: suppliers, "
            "logistics providers and distributors have their own systems, "
            "their own incentives and no obligation to share data."
        ),
        image(SCM_DIAGRAM),
    ]),

    ("What SCM Covers", [
        ul([
            "Demand planning: forecasting what will be needed and when, which "
            "everything downstream depends on",
            "Procurement: sourcing, supplier selection and purchase execution",
            "Inventory management: balancing carrying cost against stockout "
            "risk, which is the central tension of the discipline",
            "Logistics: warehousing, transport and delivery execution",
            "Supplier relationship management: performance, risk and the "
            "dependency created by single-sourcing",
        ]),
    ]),

    ("The Bullwhip Effect", [
        desc(
            "A small variation in end-customer demand amplifies as it travels "
            "upstream, so a 5% retail fluctuation can become a 40% swing in "
            "orders at the component manufacturer. Each tier adds safety stock "
            "and rounds orders to convenient batch sizes, and the distortion "
            "compounds at every step."
        ),
        desc(
            "The cause is information rather than incompetence: each tier sees "
            "only its immediate customer's orders and must infer real demand "
            "from them, so it is reacting to a signal that has already been "
            "distorted by everyone downstream."
        ),
    ]),

    ("Why the Bullwhip Effect Justifies SCM Investment", [
        desc(
            "Because the cause is information, the remedy is information: "
            "sharing actual demand data upstream rather than letting each tier "
            "guess from order patterns."
        ),
        desc(
            "That is precisely what an integrated supply chain system provides, "
            "which is why the effect appears in exams as the standard "
            "justification for SCM investment. Forecasting harder does not "
            "help, because the problem is not forecasting skill but the "
            "quality of the signal being forecast from."
        ),
    ]),

    ("Customer Relationship Management", [
        desc(
            "CRM holds the organisation's relationship with each customer in "
            "one place, so that a service call, a marketing email and a sales "
            "conversation all draw on the same history rather than each "
            "starting from nothing."
        ),
        desc(
            "The business argument is straightforward and well evidenced: "
            "retaining an existing customer costs far less than acquiring a "
            "new one, and retention depends substantially on not appearing to "
            "have forgotten them. A customer who explains their problem three "
            "times to three departments is being told, accurately, that the "
            "organisation does not remember them."
        ),
    ]),

    ("The Three CRM Categories", [
        tabs([
            ("Operational", "Operational CRM",
             "Automates the customer-facing processes themselves: sales force "
             "automation, campaign execution, case management, contact "
             "history. This is what most people mean by CRM day to day, and it "
             "is where the data originates."),
            ("Analytical", "Analytical CRM",
             "Analyses accumulated customer data for segmentation, churn "
             "prediction, lifetime value and cross-sell opportunity. It "
             "depends entirely on the operational side having captured clean "
             "data, which is why analytical CRM projects so often stall on "
             "data quality."),
            ("Collaborative", "Collaborative CRM",
             "Shares customer information across departments and with "
             "partners, so that support, sales and delivery are not each "
             "surprising the customer with a different account of the "
             "relationship or a different promised date."),
        ]),
    ]),

    ("Two More Systems Worth Naming", [
        desc("ERP, SCM and CRM cover the money, the goods and the customer, but "
             "two further systems appear often enough in enterprise landscapes -- "
             "and in TOPCIT questions -- to be worth knowing by name. Both sit "
             "alongside the big three rather than replacing any of them."),
        accordion([
            ("PLM - Product Lifecycle Management",
             "Manages a product from concept through design, manufacture and "
             "service to retirement. Holds designs, specifications, bills of "
             "material and engineering change history -- the engineering "
             "counterpart to ERP's financial and operational view, and the "
             "system that answers 'which version of this part is in the "
             "machines we shipped last year?'"),
            ("EDW - Enterprise Data Warehouse",
             "Consolidates data from operational systems into a structure "
             "designed for analysis rather than transaction processing. "
             "Operational systems are optimised for many small writes; "
             "analysis needs large reads across history, and mixing the two "
             "workloads on one system serves neither well."),
            ("Enterprise mobility",
             "Extending these systems to staff working away from a desk -- "
             "field engineers, drivers, sales staff -- which raises its own "
             "questions about offline working, device management, and what "
             "happens to data on a device that gets lost."),
        ]),
    ]),

    ("Why Analysis Is Separated From Transactions", [
        desc(
            "This separation is examined and is worth understanding rather "
            "than memorising. A transaction system is tuned for many small "
            "writes with strict consistency: recording an order, updating a "
            "stock level, posting a ledger entry."
        ),
        desc(
            "An analytical query does the opposite -- it reads millions of "
            "rows across years of history and does not care about the last "
            "five minutes. Running it against the transaction database holds "
            "locks and consumes resources that the order-taking process needs, "
            "so a long report can slow or block the business it was meant to "
            "inform."
        ),
    ]),

    ("Build, Buy, or Configure", [
        desc(
            "Every enterprise system decision is a variation on one question. "
            "Buying a package brings embodied industry practice, a support "
            "arrangement and a predictable upgrade path, at the cost of "
            "adapting to how the package thinks."
        ),
        desc(
            "Building bespoke software fits the organisation exactly and makes "
            "it responsible for every line of it forever -- including security "
            "patching, dependency updates and retaining people who understand "
            "it after the original authors leave."
        ),
    ]),

    ("The Rule of Thumb That Survives Contact With Reality", [
        desc(
            "Buy for processes where you are the same as everyone else -- "
            "payroll, general ledger, expense claims -- and build only where "
            "the process is genuinely what makes you competitive."
        ),
        desc(
            "Customising a package heavily is the worst of both worlds: you "
            "pay to build AND you inherit the vendor's upgrade cycle, with "
            "every upgrade requiring your modifications to be reapplied and "
            "retested. The next lesson develops this into a fuller "
            "decision method."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Treating ERP as an IT project",
             "It is a business change programme with a software component. "
             "Projects run as IT deliveries produce a system that works "
             "technically and that nobody uses as intended, while spreadsheets "
             "quietly continue alongside it."),
            ("Customising the package to preserve existing processes",
             "This capitalises the very inefficiency the system was bought to "
             "remove, and makes every future upgrade a reconciliation "
             "exercise. If the process truly cannot change, the organisation "
             "should have built."),
            ("Assuming legacy data is clean",
             "It is not, in any organisation, ever. Migration must include "
             "profiling, deduplication and correction, and that work is "
             "invariably larger than estimated and invariably discovered "
             "late."),
            ("Confusing which system owns which data",
             "ERP is internal operations, SCM is upstream toward suppliers, "
             "CRM is downstream toward customers. Exams test exactly this "
             "boundary."),
            ("Running analytics on the operational database",
             "Transaction systems are tuned for many small writes and analysis "
             "needs large reads across history. Running both on one system "
             "degrades the transactional workload the business actually "
             "depends on."),
            ("Believing the bullwhip effect is a forecasting failure",
             "It is an information failure. Each tier forecasts competently "
             "from a signal that has already been distorted, so better "
             "forecasting does not fix it and shared demand data does."),
        ]),
    ]),

    ("Practical Example: A Manufacturer's Question", [
        desc(
            "A manufacturer cannot answer whether a particular customer is "
            "profitable. This sounds like a reporting problem and is actually "
            "a data architecture problem."
        ),
        desc(
            "Sales knows the revenue. The plant knows production cost. "
            "Logistics knows delivery cost. Finance knows the discounts and "
            "credit notes. Each figure lives in a different system with a "
            "different customer identifier, so the join is manual and the "
            "answer is contested every single time it is produced."
        ),
    ]),

    ("What Each System Contributes", [
        ul([
            "ERP supplies production cost, the general ledger view and -- "
            "critically -- a single customer master record, which is what "
            "makes the join possible at all",
            "SCM supplies the inbound material and outbound logistics cost "
            "attributable to that customer's orders",
            "CRM supplies the cost of serving them: support cases, sales "
            "effort, discount history, complaint handling",
            "The data warehouse is where these are brought together for "
            "analysis without loading the operational systems",
        ]),
    ]),

    ("The Real Obstacle", [
        desc(
            "The hard part is not the arithmetic, which is straightforward "
            "once the records can be matched. It is the shared customer "
            "identifier."
        ),
        desc(
            "Most enterprise integration difficulty is master data management "
            "wearing a different hat, and organisations that skip it end up "
            "with integrated systems that still cannot be joined -- having "
            "bought the integration and not the outcome. A programme that "
            "treats master data as a preliminary rather than a deliverable "
            "will discover this after the money is spent."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Which system owns which data -- the ERP/SCM/CRM boundary",
            "ERP's single shared database as its defining characteristic",
            "The recurring causes of ERP implementation failure",
            "The bullwhip effect: what it is, what causes it, what fixes it",
            "The three CRM categories",
            "Why analytical workloads are separated from transactional ones",
            "The interface count for point-to-point integration",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "ERP internal, SCM upstream to suppliers, CRM downstream to "
            "customers",
            "ERP's defining feature is the single shared database",
            "The commonest ERP failure causes are over-customisation, weak "
            "change management and dirty data migration",
            "The bullwhip effect is caused by information distortion and "
            "remedied by sharing real demand upstream",
            "CRM divides into operational, analytical and collaborative",
            "Buy for commodity processes, build only where the process is a "
            "competitive advantage",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Enterprise systems exist to hold a fact once rather than "
            "reconciling divergent copies of it",
            "Point-to-point integration costs n(n-1)/2 interfaces, which is "
            "the commercial case for an integrated platform",
            "ERP projects fail as change programmes far more often than as "
            "technical deliveries",
            "The bullwhip effect is an information problem rather than a "
            "forecasting one",
            "Analytical workloads belong in a warehouse, because they are the "
            "opposite shape to transactional ones",
            "Master data -- a shared customer identifier -- is usually the "
            "real integration obstacle and is treated as a preliminary far too "
            "often",
        ]),
    ]),
]

_ent_quiz = [
    mcq("EASY",
        "Which enterprise system focuses on the flow of goods and information "
        "from suppliers through production to customers?",
        [("SCM", True), ("ERP", False), ("CRM", False), ("PLM", False)],
        "Supply Chain Management looks upstream and across organisational "
        "boundaries at suppliers, logistics and demand planning. ERP covers "
        "internal operations on a shared database, CRM covers the downstream "
        "customer relationship, and PLM manages a product from concept to "
        "retirement."),
    mcq("EASY",
        "What is the defining architectural characteristic of an ERP system?",
        [("A single shared database across all functional modules", True),
         ("A separate database for each department, synchronised "
          "nightly", False),
         ("A message queue connecting independently deployed services", False),
         ("A data warehouse optimised for analytical queries", False)],
        "ERP's value comes from every module reading and writing the same "
        "data, so a goods receipt is immediately visible to finance with no "
        "reconciliation and no interface to fail. Departmental databases "
        "synchronised in batch is precisely the arrangement ERP was created to "
        "replace, and a warehouse serves analysis rather than transactions."),
    mcq("AVERAGE",
        "An organisation connects eight separate systems with point-to-point "
        "interfaces.\n\nHow many interfaces are required, and why does this "
        "matter?",
        [("28, and each is code that must be maintained through upgrades at "
          "both ends", True),
         ("8, one per system, which is manageable at this scale", False),
         ("64, because every system connects to every system including "
          "itself", False),
         ("16, two per system for inbound and outbound traffic", False)],
        "Pairwise connection of n systems needs n(n-1)/2 interfaces, so 8 x 7 "
        "/ 2 = 28. The maintenance burden rather than the build cost is what "
        "hurts: every interface must be revalidated whenever either endpoint "
        "changes, and each fails independently. This quadratic growth is the "
        "standard argument for an integrated platform."),
    mcq("AVERAGE",
        "A retailer sees a 5% variation in consumer demand, while its "
        "component supplier experiences order swings approaching "
        "40%.\n\nWhat is this called and what causes it?",
        [("The bullwhip effect, caused by each tier seeing only its immediate "
          "customer's orders and adding its own safety stock and "
          "batching", True),
         ("Seasonal variance, caused by predictable annual demand "
          "cycles", False),
         ("The bullwhip effect, caused by manufacturing capacity constraints "
          "upstream", False),
         ("Demand shaping, caused by promotional activity at the retail "
          "end", False)],
        "Each tier infers real demand from the orders it receives rather than "
        "from actual consumption, and adds safety stock and batch rounding on "
        "top -- so it is forecasting competently from an already-distorted "
        "signal. The distortion compounds upstream. It is an information "
        "problem, which is why the remedy is sharing genuine demand data "
        "rather than forecasting harder or adding capacity."),
    mcq("AVERAGE",
        "Why is heavy customisation of an ERP package usually a mistake?",
        [("It capitalises existing inefficiency and makes every future vendor "
          "upgrade a costly reconciliation exercise.", True),
         ("Customisation voids the vendor's licence agreement in most "
          "jurisdictions.", False),
         ("Customised modules cannot share the central database.", False),
         ("It prevents the system from being used across multiple "
          "countries.", False)],
        "The package embodies standard practice, and most of the benefit comes "
        "from adopting it. Customising to preserve existing processes pays to "
        "keep the inefficiency and then pays again at every upgrade, since the "
        "modifications must be reapplied and retested -- which is why heavily "
        "customised installations drift several versions behind. Licensing, "
        "database access and internationalisation are not the issue."),
    mcq("AVERAGE",
        "Which category of CRM analyses accumulated customer data for "
        "segmentation, churn prediction and lifetime value?",
        [("Analytical CRM", True), ("Operational CRM", False),
         ("Collaborative CRM", False), ("Transactional CRM", False)],
        "Analytical CRM works on the data that operational CRM captured, which "
        "is why its projects so often stall on data quality rather than on "
        "analysis technique. Operational CRM automates the customer-facing "
        "processes themselves, collaborative CRM shares information across "
        "departments and partners, and 'transactional CRM' is not one of the "
        "three categories."),
    mcq("HARD",
        "A manufacturer cannot determine whether a customer is profitable "
        "because revenue, production cost, logistics cost and discounts sit in "
        "four systems.\n\nWhat is the fundamental obstacle?",
        [("The absence of a shared master customer identifier, without which "
          "the four sources cannot be joined reliably", True),
         ("Insufficient computing capacity to run the calculation across four "
          "systems", False),
         ("The lack of a real-time interface between the four systems", False),
         ("Accounting standards that prohibit allocating logistics cost to "
          "individual customers", False)],
        "The arithmetic is trivial once the records can be matched; the "
        "difficulty is that the same customer appears under different "
        "identifiers in each system, so any join is manual and disputable. "
        "Master data management is the usual hidden obstacle in enterprise "
        "integration, and organisations that treat it as a preliminary rather "
        "than a deliverable discover this after the money is spent."),
    mcq("HARD",
        "Why should analytical reporting run against a data warehouse rather "
        "than directly against the ERP database?",
        [("Transaction systems are optimised for many small writes while "
          "analysis requires large reads across history, and combining the "
          "workloads degrades the transactional system the business depends "
          "on.", True),
         ("ERP databases do not retain historical data beyond the current "
          "financial year.", False),
         ("Data warehouses hold more accurate data because they are refreshed "
          "more frequently.", False),
         ("Regulatory rules forbid running reports against production "
          "financial systems.", False)],
        "The two workloads have opposite characteristics, and a long "
        "analytical scan can hold locks and consume resources the order-taking "
        "process needs -- so a report can slow the business it was meant to "
        "inform. Separating them protects the operational system. ERP systems "
        "do retain history, warehouses are refreshed less often rather than "
        "more, and no general regulation forbids reporting from production."),
    short_answer("EASY",
        "Which enterprise system manages a product from concept and design "
        "through manufacture and service to retirement? Give the acronym.",
        "PLM",
        ["plm", "product lifecycle management", "product life cycle "
         "management"]),
    short_answer("AVERAGE",
        "What term describes the amplification of demand variation as it "
        "travels upstream through a supply chain?",
        "Bullwhip effect",
        ["bullwhip effect", "bullwhip", "the bullwhip effect", "whiplash "
         "effect"]),
    descriptive("HARD",
        "Explain why ERP implementations fail more often as change programmes "
        "than as technical projects, and describe two practices that reduce "
        "that risk.",
        "An ERP package does not merely store data; it embodies a particular "
        "way of running a business, with defined processes, roles, approvals "
        "and controls. Adopting it therefore means changing how people work "
        "across several departments simultaneously, which is an organisational "
        "undertaking rather than a technical one. Organisations consistently "
        "underestimate this and staff the project as a software delivery, so "
        "the system goes live technically correct while the people it was "
        "bought for continue working as before -- maintaining spreadsheets "
        "alongside it, entering data late or incompletely, and refusing to "
        "accept its output as authoritative. The cross-departmental nature "
        "makes it worse: standardising a process means at least one department "
        "gives up its preferred way of working, and that dispute cannot be "
        "settled by a project team with no authority over either party. Two "
        "practices reduce the risk substantially. First, resist customisation: "
        "change the process to fit the package except where the process is "
        "genuinely a competitive advantage, since customising to preserve an "
        "existing way of working pays to keep the inefficiency the purchase "
        "was meant to remove and then pays again at every vendor upgrade, when "
        "each modification must be reapplied and retested. Second, secure "
        "genuine executive sponsorship with authority to settle "
        "inter-departmental disputes, and invest properly in training and "
        "communication so that staff understand why the change is happening "
        "rather than only that it is. A third practice worth adding is phased "
        "rather than big bang rollout, which costs more overall but confines "
        "the consequences of any single failure to one module or one site "
        "rather than concentrating all risk into a single irreversible "
        "weekend.",
        [("Explains that ERP embodies process and so requires organisational "
          "change", 4),
         ("Gives a valid first practice with justification", 3),
         ("Gives a valid second practice with justification", 3)]),
]

LESSON_ENTERPRISE = {
    "middle": MID_BIZ_FUNDAMENTALS,
    "name": "Enterprise Solutions: ERP, SCM, and CRM",
    "quiz": _ent_quiz,
    "structure": lesson_structure(
        "Enterprise Solutions: ERP, SCM, and CRM",
        "Most of what a large organisation runs on is one of a small number of "
        "enterprise systems, and this category previously covered none of "
        "them. This lesson explains why they exist -- the arithmetic of "
        "point-to-point integration is unforgiving -- and then works through "
        "ERP, SCM and CRM in turn: what each owns, how to tell which system a "
        "piece of data belongs to, why ERP projects fail so consistently as "
        "change programmes rather than as technical deliveries, what the "
        "bullwhip effect really demonstrates about supply chains, why "
        "analytical workloads belong somewhere other than the transaction "
        "system, and why master data is usually the real obstacle to "
        "integration.",
        [
            "Explain why integrated enterprise systems replaced departmental "
            "applications",
            "Calculate the interface count for point-to-point integration and "
            "explain its significance",
            "Distinguish ERP, SCM and CRM by what each owns and which "
            "direction it faces",
            "Identify ERP's single shared database as its defining "
            "characteristic and say what it delivers",
            "Identify the recurring causes of ERP implementation failure",
            "Explain the bullwhip effect, its cause and its remedy",
            "Distinguish operational, analytical and collaborative CRM",
            "Explain why analysis is separated from transactions",
            "Apply the build-versus-buy rule of thumb to a given process",
        ],
        55,
        _ent_sections,
        [
            ("ERP",
             "Enterprise Resource Planning: internal operations -- finance, "
             "HR, manufacturing, procurement -- on a single shared database."),
            ("SCM",
             "Supply Chain Management: the flow of goods and information from "
             "suppliers through production to customers."),
            ("CRM",
             "Customer Relationship Management: all interactions with "
             "customers and prospects, divided into operational, analytical "
             "and collaborative."),
            ("PLM",
             "Product Lifecycle Management: a product from concept through "
             "design and manufacture to retirement."),
            ("EDW",
             "Enterprise Data Warehouse: consolidated data structured for "
             "analysis rather than transaction processing."),
            ("Bullwhip effect",
             "Amplification of demand variation as it travels upstream, caused "
             "by each tier inferring demand from its immediate customer's "
             "orders."),
            ("Point-to-point integration",
             "Connecting systems pairwise, requiring n(n-1)/2 interfaces and "
             "scaling badly."),
            ("Master data management",
             "Maintaining a single authoritative identifier for shared "
             "entities such as customers -- usually the real obstacle to "
             "integration."),
            ("Big bang cutover",
             "Switching all modules and sites at once, concentrating all risk "
             "into one irreversible moment."),
        ],
        "Enterprise systems exist because holding the same fact in several "
        "departmental applications guarantees the copies will diverge, and "
        "because connecting those applications pairwise costs n(n-1)/2 "
        "interfaces that must be maintained forever. ERP holds internal "
        "operations on one shared database, SCM manages the upstream flow of "
        "goods and information, and CRM manages the downstream relationship "
        "with customers -- a distinction that answers most exam questions "
        "about which system owns what. ERP fails far more often as a change "
        "programme than as a technical delivery, because the package embodies "
        "a way of working and adopting it means changing how people work "
        "across departments at once. The bullwhip effect is the standard "
        "illustration that supply chain problems are usually information "
        "problems rather than forecasting ones. Analysis belongs in a "
        "warehouse because its workload is the opposite shape to a "
        "transactional one. And underneath all of it, the shared customer "
        "identifier is usually the thing that actually decides whether "
        "integration delivers an answer."),
}


# ===========================================================================
# IT Strategy Planning: ISP, ISMP, and Enterprise Architecture
# ===========================================================================

_isp_sections = [
    ("Why IT Needs a Plan of Its Own", [
        desc(
            "An organisation that buys systems as each department asks for "
            "them ends up with an estate nobody designed: overlapping "
            "capabilities, incompatible data, and a budget consumed by keeping "
            "it all running rather than by doing anything new."
        ),
        desc(
            "IT strategy planning exists to make the estate a consequence of "
            "business direction rather than of purchasing history. The "
            "difference is not tidiness -- it is whether the organisation can "
            "still afford to change."
        ),
    ]),

    ("The Test of Whether It Is Working", [
        desc(
            "There is a simple diagnostic. Ask why a particular system exists."
        ),
        desc(
            "In a planned estate the answer traces to a business objective, "
            "and somebody can name it. In an unplanned one the answer is that "
            "somebody once needed it and nobody has turned it off, and often "
            "nobody is quite sure who uses it now. Applying that question "
            "across an application inventory is uncomfortable and immediately "
            "informative."
        ),
    ]),

    ("Strategic Alignment", [
        desc(
            "Alignment means IT investment follows business strategy rather "
            "than technology fashion. It sounds obvious and is genuinely rare, "
            "because the two sides speak different languages: the business "
            "expresses goals in market and financial terms and IT expresses "
            "capability in technical ones, and neither translation happens by "
            "itself."
        ),
        ul([
            "Every significant IT investment should trace to a stated business "
            "objective, and the trace should be written down rather than "
            "assumed",
            "The alignment is bidirectional: technology also creates business "
            "options that strategy should then exploit",
            "Misalignment shows up as a portfolio full of technically "
            "excellent systems nobody can connect to a business outcome",
            "It is a continuous activity, because business strategy changes "
            "considerably faster than an application estate does",
        ]),
    ]),

    ("ISP: The Information Strategy Plan", [
        desc(
            "An Information Strategy Plan translates business strategy into a "
            "plan for information systems over a defined horizon, typically "
            "three to five years. It establishes what the organisation needs "
            "its systems to do, what it currently has, and how to get from one "
            "to the other."
        ),
        ol([
            "Analyse the business environment: strategy, objectives, "
            "constraints and the external pressures acting on them",
            "Assess the current state: applications, data, infrastructure and "
            "the organisation running them",
            "Define the target state: the systems and capabilities the "
            "strategy requires",
            "Perform gap analysis: what is missing, what is redundant, what "
            "must change",
            "Produce a roadmap: sequenced initiatives with dependencies, cost "
            "and expected benefit",
        ]),
    ]),

    ("ISMP: The Information Strategy Master Plan", [
        desc(
            "An ISMP is broader and more detailed than an ISP. Where an ISP "
            "concentrates on information systems, an ISMP covers the whole "
            "informatisation programme -- systems, infrastructure, "
            "organisation, processes, governance and the investment plan."
        ),
        desc(
            "The practical difference is the level of specification it "
            "produces. In Korean public sector practice, from which TOPCIT "
            "draws, an ISMP is commonly the mandated precursor to a large "
            "system procurement precisely because it produces requirements "
            "detailed enough to tender against. The distinction the exam tests "
            "is scope and depth: ISP sets direction, ISMP specifies the "
            "programme that delivers it."
        ),
    ]),

    ("Enterprise Architecture", [
        desc(
            "Enterprise architecture is the discipline of describing an "
            "organisation's structure -- business, data, applications and "
            "technology -- and governing how it changes. Where an ISP is a "
            "plan with a horizon and an end date, EA is a continuing practice "
            "with a maintained model."
        ),
        image(EA_DIAGRAM),
    ]),

    ("The Four Layers", [
        tabs([
            ("Business", "Business architecture",
             "Processes, capabilities, organisational units and the "
             "relationships between them. Everything else exists to serve this "
             "layer, which is why architecture that starts with technology "
             "tends to produce elegant systems answering the wrong question."),
            ("Data", "Data architecture",
             "What information the organisation holds, where each item is "
             "mastered and how it flows between systems. This is the layer "
             "where master data problems are either solved deliberately or "
             "perpetuated by default."),
            ("Application", "Application architecture",
             "The applications, what each is responsible for, and how they "
             "interact. Its most common immediate output is the discovery of "
             "duplication nobody realised existed."),
            ("Technology", "Technology architecture",
             "Infrastructure, platforms, networks and standards -- the "
             "foundation the applications run on, and the layer with the "
             "shortest useful lifespan."),
        ]),
    ]),

    ("Comparing the Three Instruments", [
        desc(
            "Exams ask for this distinction directly, so it is worth being "
            "able to state each in one sentence."
        ),
        sub("ISP"),
        desc(
            "A plan. Medium horizon, focused on information systems, producing "
            "a roadmap from current to target state. It has a completion date."
        ),
        sub("ISMP"),
        desc(
            "A programme specification. Broader scope and greater detail, "
            "covering systems, infrastructure, organisation and investment, "
            "detailed enough to procure against."
        ),
        sub("Enterprise architecture"),
        desc(
            "A continuing practice. Maintains a model of the organisation "
            "across four layers and governs change against it. It has no "
            "completion date, which is the point -- it exists to prevent drift "
            "between plans."
        ),
    ]),

    ("Gap Analysis", [
        desc(
            "Gap analysis is the mechanism common to all three, and its "
            "quality depends almost entirely on honesty about the current "
            "state."
        ),
        desc(
            "An assessment based on what systems were SUPPOSED to do, or on "
            "what their owners say they do, produces a plan addressing an "
            "estate that does not exist. Documentation describes intent and is "
            "almost never updated as systems drift, so a gap analysis built "
            "from it is a roadmap to somewhere nobody is."
        ),
    ]),

    ("The Categories of Gap", [
        ul([
            "Capability gaps: something the strategy needs that no system "
            "provides",
            "Redundancy: several systems doing the same thing, usually "
            "discovered during the analysis rather than known beforehand",
            "Technical debt: systems that work but cannot be changed, extended "
            "or supported, which constrain every future initiative",
            "Data gaps: information the organisation believes it holds and "
            "does not, or holds in a form nobody can use",
            "Organisational gaps: skills, roles and governance, which are "
            "frequently the binding constraint rather than the technology",
        ]),
    ]),

    ("Portfolio Prioritisation", [
        desc(
            "A roadmap listing everything worth doing is not a plan, because "
            "the organisation cannot do everything at once. Prioritisation "
            "must weigh business value, cost, risk, dependency -- and the "
            "organisation's capacity to absorb change."
        ),
        desc(
            "That last factor is the one most often ignored, and it is not a "
            "soft consideration. An organisation can only tolerate so much "
            "simultaneous disruption, and a roadmap that exceeds it delivers a "
            "series of technically successful projects into an exhausted "
            "business that adopts none of them properly -- paying full cost "
            "for no benefit."
        ),
    ]),

    ("Governance", [
        accordion([
            ("Steering committee",
             "Senior business and IT leaders who approve investment, resolve "
             "cross-departmental disputes and own the roadmap. Its real "
             "function is having the authority to say no, which a project "
             "manager does not and cannot acquire."),
            ("Architecture review",
             "Checks that proposed changes fit the target architecture rather "
             "than quietly adding another exception. Without it the target "
             "state remains a document while the estate drifts steadily away "
             "from it."),
            ("Benefits realisation",
             "Checking after delivery whether the promised benefit actually "
             "materialised. Almost universally skipped, which is precisely why "
             "business cases can promise anything without consequence."),
            ("Portfolio review",
             "Periodic reassessment of whether in-flight initiatives still "
             "make sense given changes in strategy -- including the discipline "
             "of stopping ones that no longer do, which organisations find "
             "extremely difficult."),
        ]),
    ]),

    ("Why Plans Become Shelfware", [
        desc(
            "The characteristic failure of IT strategy planning is a handsome "
            "document that changes nothing. The causes are consistent enough "
            "to be predicted in advance."
        ),
        ul([
            "It was written by consultants without the people who must execute "
            "it, so nobody in the organisation feels ownership",
            "It describes a target three years out with no sequenced first "
            "steps, so nothing can start on Monday",
            "Its assumptions were never revisited as circumstances changed",
            "No governance body owns it after the engagement ended",
            "It was never connected to the budgeting cycle, so the initiatives "
            "it recommends compete for funding as though it did not exist",
        ]),
    ]),

    ("What Makes a Plan Survive", [
        desc(
            "The plans that survive have a named owner, a review cycle, and "
            "enough near-term specificity that the first six months of work is "
            "unambiguous."
        ),
        desc(
            "Everything beyond eighteen months is direction rather than "
            "commitment, and pretending otherwise is what makes a document "
            "brittle: the moment one distant assumption proves wrong, the "
            "whole plan is discredited rather than adjusted. Stating openly "
            "which parts are firm and which are indicative is what allows the "
            "plan to be revised rather than abandoned."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Planning the technology before the business capability",
             "Architecture that starts from technology produces well-built "
             "systems answering questions nobody asked. Business architecture "
             "comes first for a reason, and the layer order is not arbitrary."),
            ("Assessing the current state from documentation",
             "Documentation describes what was intended and is rarely updated "
             "as systems drift. A gap analysis against an imagined estate "
             "produces a roadmap to nowhere."),
            ("Confusing ISP with ISMP",
             "ISP sets direction for information systems; ISMP specifies the "
             "whole informatisation programme in enough detail to procure "
             "against. Scope and depth are the distinction."),
            ("Ignoring organisational absorptive capacity",
             "A roadmap that overwhelms the business produces change fatigue "
             "and systems that go live unused -- full cost, no benefit."),
            ("No benefits realisation",
             "If nobody checks whether the promised benefit appeared, business "
             "cases become fiction with no downside, and the next round of "
             "investment is decided on the same unreliable basis."),
            ("Treating the plan as fixed for its whole horizon",
             "Beyond about eighteen months a plan is direction rather than "
             "commitment. Pretending otherwise makes it brittle and gets it "
             "discarded at the first surprise."),
        ]),
    ]),

    ("Practical Example: Two Departments, One Capability", [
        desc(
            "A gap analysis discovers that customer service and field "
            "operations have each procured a scheduling system. Both work. "
            "Both were justified individually, by competent people, following "
            "the correct procurement process."
        ),
        desc(
            "Together they hold overlapping engineer availability data that "
            "disagrees, and a customer booking made in one is invisible to the "
            "other -- so customers are occasionally promised an engineer who "
            "is already committed elsewhere."
        ),
    ]),

    ("How the Planning Instruments Handle It", [
        ul([
            "Enterprise architecture should have prevented it: an architecture "
            "review of the second purchase would have identified the existing "
            "capability before the money was committed",
            "The ISP records the redundancy as a gap and places consolidation "
            "on the roadmap with a business value attached",
            "Governance decides which system survives -- a decision requiring "
            "authority over both departments, which is precisely what a "
            "steering committee exists to provide",
            "Benefits realisation checks afterwards whether the promised saving "
            "and the promised data consistency actually arrived",
        ]),
    ]),

    ("What the Example Actually Demonstrates", [
        desc(
            "The instructive part is that no individual decision was wrong. "
            "Each purchase was justified on its own terms and would survive "
            "scrutiny in isolation."
        ),
        desc(
            "The problem arose entirely from the absence of anyone looking "
            "ACROSS the decisions, which is the whole argument for having a "
            "planning function. Blaming either department misses the point and "
            "guarantees a repeat, because the next two departments will make "
            "equally defensible decisions in the same vacuum."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "ISP versus ISMP versus EA -- scope, depth and permanence",
            "The four EA layers and their order of precedence",
            "The stages of an ISP",
            "Gap analysis and why current-state honesty matters",
            "Absorptive capacity as a prioritisation constraint",
            "Benefits realisation as the commonly skipped governance step",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "ISP plans information systems over a medium horizon; ISMP "
            "specifies the whole informatisation programme in "
            "procurement-level detail; EA is a continuing practice",
            "EA's four layers are business, data, application, technology -- "
            "in that order of precedence",
            "Gap analysis compares current state to target state and depends "
            "entirely on an honest current state",
            "Strategic alignment is bidirectional and continuous",
            "Benefits realisation is the governance step almost everyone "
            "skips",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Without planning, an IT estate is a record of purchasing history "
            "rather than a design -- and the test is whether anyone can say "
            "why a system exists",
            "ISP, ISMP and EA differ in scope, depth and permanence, and exams "
            "test that distinction directly",
            "Enterprise architecture works from business capability down to "
            "technology, never the reverse",
            "Gap analysis is only as good as the honesty of the current-state "
            "assessment",
            "Prioritisation must account for how much change the organisation "
            "can actually absorb",
            "A plan with no owner, review cycle or near-term specificity "
            "becomes shelfware",
            "Benefits realisation is what makes business cases accountable, "
            "and almost nobody does it",
        ]),
    ]),
]

_isp_quiz = [
    mcq("EASY",
        "What is the primary purpose of an Information Strategy Plan (ISP)?",
        [("To translate business strategy into a plan for information systems "
          "over a defined horizon", True),
         ("To specify the technical architecture of a single new "
          "system", False),
         ("To document the organisation's current network "
          "infrastructure", False),
         ("To define service level agreements with IT suppliers", False)],
        "An ISP takes business direction as its input and produces a roadmap "
        "from the current systems estate to a target state supporting that "
        "direction. Designing one system, documenting infrastructure and "
        "agreeing service levels are all narrower activities that may follow "
        "from it but are not its purpose."),
    mcq("EASY",
        "Which enterprise architecture layer should be defined first, and why?",
        [("Business architecture, because every other layer exists to serve "
          "it", True),
         ("Technology architecture, because it constrains what is "
          "possible", False),
         ("Data architecture, because all systems depend on data", False),
         ("Application architecture, because applications deliver the "
          "value", False)],
        "Processes and capabilities determine what data is needed, which "
        "determines what applications are required, which determines the "
        "technology to run them. Starting from technology produces well-built "
        "systems that answer questions nobody asked -- the characteristic "
        "failure of technology-led architecture."),
    mcq("AVERAGE",
        "How does an ISMP differ from an ISP?",
        [("An ISMP is broader and more detailed, covering systems, "
          "infrastructure, organisation and investment at a level detailed "
          "enough to procure against.", True),
         ("An ISMP covers only infrastructure while an ISP covers "
          "applications.", False),
         ("An ISMP is produced annually while an ISP covers a five-year "
          "horizon.", False),
         ("An ISMP is an internal document while an ISP is published to "
          "suppliers.", False)],
        "The distinction is scope and depth. An ISP sets direction for "
        "information systems; an ISMP specifies the whole informatisation "
        "programme, which is why it is commonly the mandated precursor to a "
        "large procurement -- its requirements are detailed enough to tender "
        "against. Neither is defined by frequency or by audience."),
    mcq("AVERAGE",
        "A gap analysis is performed using system documentation rather than "
        "examining the systems themselves.\n\nWhat is the consequence?",
        [("The resulting roadmap addresses an estate that does not exist, "
          "because documentation records intent rather than reality.", True),
         ("The analysis will be accurate but will take longer to "
          "complete.", False),
         ("Only the technology layer will be affected; business and data "
          "layers remain valid.", False),
         ("The analysis will overstate redundancy and understate capability "
          "gaps.", False)],
        "Documentation describes what systems were meant to do and is almost "
        "never updated as they drift. A target state and roadmap built against "
        "it will miss capabilities that quietly disappeared, redundancies that "
        "accumulated, and workarounds that became load-bearing. The error is "
        "not directional -- it can distort in either direction."),
    mcq("AVERAGE",
        "Why must portfolio prioritisation consider the organisation's "
        "capacity to absorb change?",
        [("Too much simultaneous disruption produces change fatigue, so "
          "technically successful projects go live without being properly "
          "adopted.", True),
         ("Regulators limit the number of major system changes permitted per "
          "year.", False),
         ("Project budgets cannot be committed across more than one financial "
          "year.", False),
         ("Vendors will not support concurrent implementations.", False)],
        "Every change costs the business attention, training and disruption "
        "beyond its project budget. Exceed the tolerance and delivery still "
        "succeeds while adoption fails, producing the worst possible outcome: "
        "full cost and no benefit. Regulation, budgeting rules and vendor "
        "support are not the constraint."),
    mcq("AVERAGE",
        "Which governance body has the authority to resolve a dispute between "
        "two departments about which of their overlapping systems should be "
        "retired?",
        [("The steering committee", True),
         ("The architecture review board", False),
         ("The project management office", False),
         ("The benefits realisation panel", False)],
        "Resolving a dispute between departments requires authority over both, "
        "which only a body of senior business and IT leaders possesses -- and "
        "having the authority to say no is its real function. Architecture "
        "review identifies that the overlap exists, a PMO tracks delivery, and "
        "benefits realisation checks outcomes afterwards; none of them can "
        "compel a department to give up a system."),
    mcq("HARD",
        "Two departments independently procure overlapping scheduling systems, "
        "each with a sound individual business case.\n\nWhat does this "
        "primarily demonstrate?",
        [("The absence of a governance function looking across departmental "
          "decisions, which is the core argument for enterprise "
          "architecture.", True),
         ("That both business cases must have been fraudulent.", False),
         ("That the scheduling capability was genuinely needed twice.", False),
         ("That procurement rules were breached by at least one "
          "department.", False)],
        "No individual decision was wrong -- each was justified on its own "
        "terms and would survive scrutiny in isolation -- and that is exactly "
        "the point. The failure is structural: nobody was looking across the "
        "decisions to notice the overlap. Architecture review exists to catch "
        "this, and blaming either department guarantees a repeat by the next "
        "two departments."),
    mcq("HARD",
        "Why is benefits realisation described as the governance step most "
        "often skipped, and what follows from skipping it?",
        [("Checking after delivery whether promised benefits materialised is "
          "unglamorous and often uncomfortable; without it, business cases can "
          "promise anything without consequence.", True),
         ("It requires financial data that IT departments are not permitted to "
          "access.", False),
         ("It can only be performed by external auditors, which makes it "
          "expensive.", False),
         ("Benefits are inherently unmeasurable, so the step has no "
          "value.", False)],
        "The measurement happens long after the project team has dispersed, "
        "and its findings are frequently unwelcome to people still in post. "
        "But if nobody ever checks, the forecasts in a business case carry no "
        "accountability whatever, and the next investment round is decided on "
        "the same unreliable basis. Access, cost and measurability are not the "
        "real obstacles -- willingness is."),
    short_answer("EASY",
        "What is the term for the comparison between an organisation's current "
        "state and its desired target state?",
        "Gap analysis",
        ["gap analysis", "gap-analysis", "a gap analysis", "gap assessment"]),
    short_answer("AVERAGE",
        "Name the four layers of enterprise architecture in the conventional "
        "order of precedence.",
        "Business, data, application, technology",
        ["business, data, application, technology",
         "business data application technology",
         "business, data, applications, technology",
         "business architecture, data architecture, application architecture, "
         "technology architecture"]),
    descriptive("HARD",
        "Explain what strategic alignment between IT and business means, why "
        "it is difficult to achieve, and how an organisation would recognise "
        "that it has failed.",
        "Strategic alignment means that IT investment and capability follow "
        "from business strategy rather than from technology fashion or "
        "departmental purchasing history -- and, in the other direction, that "
        "the business actively exploits the options technology creates. Every "
        "significant investment should trace to a stated business objective, "
        "and that trace should be explicit and written down rather than "
        "assumed. It is difficult for several reasons. The two sides express "
        "themselves in different languages: business goals are stated in "
        "market, customer and financial terms while IT capability is described "
        "technically, and nothing translates between them automatically. "
        "Business strategy also changes considerably faster than an "
        "application estate can, so alignment achieved once decays steadily; "
        "it is a continuous activity rather than a document produced at a "
        "point in time. And individual purchasing decisions are usually "
        "entirely defensible on their own terms, so misalignment accumulates "
        "without anyone making an obviously wrong decision -- which makes it "
        "hard to notice and hard to attribute. An organisation recognises "
        "failure by symptoms rather than by announcement. Asking why a "
        "particular system exists produces answers about history rather than "
        "about objectives. The portfolio contains technically excellent "
        "systems nobody can connect to a business outcome. Several departments "
        "hold overlapping capabilities, discovered only during an audit or a "
        "gap analysis. The budget is consumed by keeping existing systems "
        "running with little left for anything the strategy actually requires. "
        "And requests arrive as named products rather than as capability "
        "needs, which is a reliable sign that the conversation has stopped "
        "being about business outcomes altogether.",
        [("Defines alignment, ideally noting it is bidirectional", 3),
         ("Explains at least two genuine reasons it is difficult", 3),
         ("Describes recognisable symptoms of misalignment", 4)]),
]

LESSON_ISP = {
    "middle": MID_BIZ_FUNDAMENTALS,
    "name": "IT Strategy Planning: ISP, ISMP, and Enterprise Architecture",
    "quiz": _isp_quiz,
    "structure": lesson_structure(
        "IT Strategy Planning: ISP, ISMP, and Enterprise Architecture",
        "An IT estate that nobody planned is a record of purchasing history, "
        "and it shows: overlapping capabilities, incompatible data and a "
        "budget consumed by keeping it all running. This lesson covers the "
        "instruments organisations use to prevent that. You will learn what "
        "strategic alignment means and why it decays, how an Information "
        "Strategy Plan moves from business direction to a sequenced roadmap, "
        "how an ISMP differs in scope and depth and why it precedes a large "
        "procurement, what enterprise architecture maintains that a plan does "
        "not, why gap analysis depends entirely on an honest current state, "
        "and why so many strategy documents change nothing at all.",
        [
            "Explain what strategic alignment means, why it is bidirectional, "
            "and how misalignment shows itself",
            "Apply the 'why does this system exist' test to an estate",
            "Describe the five stages of an Information Strategy Plan",
            "Distinguish ISP, ISMP and enterprise architecture by scope, depth "
            "and permanence",
            "Name the four enterprise architecture layers and explain their "
            "order of precedence",
            "Explain gap analysis and the five categories of gap it identifies",
            "Explain why portfolio prioritisation must account for "
            "organisational absorptive capacity",
            "Describe the governance bodies that keep a plan operative, "
            "including benefits realisation",
            "Identify why strategy documents become shelfware and what "
            "prevents it",
        ],
        55,
        _isp_sections,
        [
            ("Strategic alignment",
             "IT investment following business strategy, and the business "
             "exploiting options technology creates. Continuous rather than "
             "one-off."),
            ("ISP",
             "Information Strategy Plan: a medium-horizon plan taking business "
             "strategy to a target systems state via a roadmap."),
            ("ISMP",
             "Information Strategy Master Plan: broader and deeper than an "
             "ISP, covering systems, infrastructure, organisation and "
             "investment in enough detail to procure against."),
            ("Enterprise architecture",
             "A continuing practice maintaining a model of the organisation "
             "across business, data, application and technology layers, and "
             "governing change against it."),
            ("Gap analysis",
             "Comparison of current state to target state, identifying "
             "capability gaps, redundancy, technical debt, data gaps and "
             "organisational gaps."),
            ("Technical debt",
             "Systems that function but cannot readily be changed, extended or "
             "supported, constraining every future initiative."),
            ("Absorptive capacity",
             "How much simultaneous change an organisation can adopt, and the "
             "constraint most often omitted from a roadmap."),
            ("Architecture review",
             "Governance checking that a proposed change fits the target "
             "architecture rather than adding another exception."),
            ("Benefits realisation",
             "Post-delivery verification that promised benefits materialised. "
             "The step most often skipped, and what makes business cases "
             "accountable."),
            ("Shelfware",
             "A strategy document that changes nothing, typically lacking an "
             "owner, a review cycle or near-term specificity."),
        ],
        "Planning exists so that the systems estate is a consequence of "
        "business direction rather than of who asked for what and when -- and "
        "the diagnostic is simply whether anyone can say why a given system "
        "exists. An ISP carries business strategy through current-state "
        "assessment, target state and gap analysis into a sequenced roadmap; "
        "an ISMP does the same across a wider scope and in enough detail to "
        "procure against; and enterprise architecture is the continuing "
        "practice that maintains the model and governs change against it, "
        "working from business capabilities down to technology rather than the "
        "reverse. All three depend on an honest current state, because a gap "
        "analysis against documentation produces a roadmap to an estate "
        "nobody has. Prioritisation has to respect how much change the "
        "organisation can actually absorb, since exceeding it buys full cost "
        "and no adoption. And the governance that keeps any of it real is a "
        "steering committee with genuine authority, architecture review that "
        "catches duplication before it is bought, and benefits realisation -- "
        "which almost nobody performs, which is exactly why business cases can "
        "promise anything."),
}

LESSONS = [LESSON_ENTERPRISE, LESSON_ISP]
